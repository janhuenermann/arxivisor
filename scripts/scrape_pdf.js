const fs = require('fs')
const fetch = require('node-fetch')
const { createCanvas } = require('canvas')
const { MongoClient } = require('mongodb')
const { URL } = require('url')
const AWS = require('aws-sdk')
const chalk = require('chalk')

const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { ArgumentParser } = require('argparse')

const Entities = require('html-entities').AllHtmlEntities
const entities = new Entities()


if (!process.env.MONGODB_CONNECTION_STRING)
  require("dotenv").config({ path: path.resolve(process.cwd(), '.env.local') })

const pdfjs = require('pdfjs-dist/es5/build/pdf.js')
pdfjs.GlobalWorkerOptions.workerSrc = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/es5/build/pdf.worker.js')


// Setup mongodb connection
const connectionString = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

var db

const browserHeaders = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
  'Cache-Control': 'max-age=0',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
}


// Canvas factory
function NodeCanvasFactory() {}
NodeCanvasFactory.prototype = {
  create: function NodeCanvasFactory_create(width, height) {
    // assert(width > 0 && height > 0, 'Invalid canvas size');
    var canvas = createCanvas(width, height);
    var context = canvas.getContext("2d");
    return {
      canvas: canvas,
      context: context
    };
  },

  reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
    // assert(canvasAndContext.canvas, 'Canvas is not specified');
    // assert(width > 0 && height > 0, 'Invalid canvas size');
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
    // assert(canvasAndContext.canvas, 'Canvas is not specified');

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
};

async function getWebPageTitle(url) {
  const res = await fetch(url, { headers: browserHeaders, timeout: 1000 })
  if (!res.ok) {
    return null
  }
  const size = res.headers.get('content-length')
  if (+size > 10 ** 6) {
    throw `document too large (size: ${+size})`
  }
  const titleRegExp = /\<\s*title[^\>]*>([^\<]*)<\/\s*title\s*>/
  const body = await res.text()
  const match = body.match(titleRegExp)
  if (!match) {
    return null
  }
  const title = entities.decode(match[1])
  return title
}

async function parse(paper, pdfPath, imagePathBase) {
  var doc = await pdfjs.getDocument(pdfPath).promise

  let factory = new NodeCanvasFactory()
  let pageCanvas = null, outCanvas = null
  let projectUrl = null, thumbs = [], fetchedAnnotations = []

  for (let i = 1; i <= Math.min(doc.numPages, 8); ++i) {
    const page = await doc.getPage(i)

    if (!projectUrl) {
      let annotations = await page.getAnnotations(), domain = null
      for (let annotation of annotations) {
        // We want to check all url annotations
        if (!annotation.url)
          continue
        const url = new URL(annotation.url)
        // Skip arxiv urls
        if (url.host.toLowerCase() == 'arxiv.org')
          continue
        // Skip urls that were already tested for this paper
        if (fetchedAnnotations.indexOf(annotation.url) >= 0)
          continue
        // Fetch web page title
        try {
          const webPageTitle = await getWebPageTitle(annotation.url)
          // Record dataset
          if (webPageTitle) {
            console.log(chalk.blue(`Fetched annotation, '${annotation.url}' '${webPageTitle}'`))
            const record = {
              guid: paper.guid,
              title: paper.title,
              url: annotation.url,
              urlTitle: webPageTitle,
              pageNumber: i,
              updated: (new Date).getTime(),
            }
            // Insert into db
            await db.collection('annotations')
              .updateOne({ guid: record.guid, url: record.url }, { $set: record }, { upsert: true })
          }
          // Memorise that we have tested this url
          fetchedAnnotations.push(annotation.url)
        }
        catch (err) {
          console.log(chalk.red(`Error during annotation fetch: ${err}`))
        }
      }
    }

    const vp = page.getViewport({ scale: 4., })
    if (!pageCanvas) {
      pageCanvas = factory.create(vp.width, vp.height) 
    }
    await page.render({ canvasContext: pageCanvas.context, viewport: vp, canvasFactory: factory }).promise
    const h = 450
    const w = Math.round(h * vp.width / vp.height)
    if (!outCanvas) {
      outCanvas = factory.create(w,h)
    }
    outCanvas.context.drawImage(pageCanvas.canvas, 0, 0, w,h)

    const buf = outCanvas.canvas.toBuffer('image/jpeg', { quality: 0.7, progressive: false, chromaSubsampling: true })
    const imagePath = imagePathBase + `-${i}.jpg`
    fs.writeFileSync(imagePath, buf)
    thumbs.push(imagePath)
  }

  return { thumbs, projectUrl }
}

async function download(paper, pdfPath) {
  const file = fs.createWriteStream(pdfPath)
  var success = false
  console.log(chalk.green(`Step 1) Downloading....`))
  try {
    if (!paper.pdf) {
      console.log(chalk.red(`Fatal. Paper does not have a pdf url.`))
      process.exit(1)
    }
    const res = await fetch(paper.pdf, {
      headers: browserHeaders,
    })
    await new Promise((resolve, reject) => {
      res.body.pipe(file);
      res.body.on("error", reject)
      file.on("finish", resolve)
    })

    success = true
  }
  catch (err) {
    console.log(chalk.red(`Error downloading paper: ${err}`))
  }
  finally {
    file.close()
  }
  return success
}

async function upload(paper, thumbs, s3) {
  const BUCKET_NAME = process.env.AWS_BUCKET_NAME
  let result = []

  for (var i = 0; i < thumbs.length; ++i) {
    let imagePath = thumbs[i]
    let paperKey = crypto.createHash('md5').update(paper.guid).digest('hex')
    const ext = path.extname(imagePath)
    let thumbKey = `thumbs/${paperKey}_page${i+1}${ext}`
    try {
      let data = await new Promise((resolve, reject) => {
        s3.upload({
          Bucket: BUCKET_NAME,
          Key: thumbKey,
          Body: fs.readFileSync(imagePath),
          ACL: 'public-read',
          CacheControl: 'max-age=31536000'
        }, function (err, data) {
          if (err) {
            reject(err)
          }
          resolve(data)
        })
      })
      result.push(data.Location)
    }
    catch (err) {
      console.log(chalk.red(`Error while uploading to AWS: ${err}`))
      process.exit(1)
    }
  }

  return result
}

async function updatePaper(paper, info) {
  let dbResult = await db.collection('papers').updateOne({ _id: paper._id } , { $set: { info, } })
  if (!(dbResult.result.nModified || dbResult.result.n)) {
    console.log(dbResult)
    console.log(chalk.red(`Error during update`))
    process.exit(1)
  }
}

async function scrape(pdfPath, imagePathBase, s3) {
  // 1) fetch a record from the database that has no thumbnail field
  const recordsOp = db.collection('papers').find({ info: { $exists: false } }).sort({ datePublished: -1 }).limit(1).toArray()
  const countOp = db.collection('papers').countDocuments({ info: { $exists: false } })

  const [records, count] = await Promise.all([recordsOp, countOp])

  if (!records.length)
    return false
  const paper = records[0]

  console.log(chalk.bold(`- - - Paper [/${String(count).padStart(4, '0')}] - - -`))
  console.log(chalk.yellow.bold(`${paper.title}`))
  console.log(chalk.cyan.italic(paper.authors.join(', ')))
  console.log(chalk.magenta.italic(paper.pdf))

  // 2) download pdf
  const downloaded = await download(paper, pdfPath)
  if (!downloaded)
    return true
  // 3) generate thumbnail / parse
  console.log(chalk.green(`Step 2) Parsing pdf....`))
  let info = {}
  await updatePaper(paper, info) // mark as read
  try {
    const { thumbs, projectUrl, } = await parse(paper, pdfPath, imagePathBase)
    // 4) upload to aws
    if (args.thumbs) {
      console.log(chalk.green(`Step 3) Uploading thumbnails to S3....`))
      info.thumbs = await upload(paper, thumbs, s3)
    }
    else {
      console.log(chalk.green(`Step 3) Skipping thumnbail upload`))
    }
    // 5) Set project url
    info.projectUrl = projectUrl || null
  }
  catch (err) {
    console.log(chalk.red(`Error parsing PDF: ${err}`))
  }
  
  console.log(chalk.green(`Step 4) Updating database record....`))
  await updatePaper(paper, info)
  // start at 1)
  return true
}

async function scrapeAll() {
  try {
    await client.connect()
    db = client.db('app')
  }
  catch (err) {
    console.log(chalk.red(`Failed to establish database connection. Error: ${err}`))
    return
  }

  const ID = process.env.AWS_ID
  const SECRET = process.env.AWS_SECRET

  const s3 = new AWS.S3({
      accessKeyId: ID,
      secretAccessKey: SECRET
  })

  const tmp = os.tmpdir()
  const pdfPath = path.join(tmp, 'some_paper.pdf')
  const imagePathBase = path.join(tmp, 'some_paper_render')
  while (await scrape(pdfPath, imagePathBase, s3)) {}
}


const parser = new ArgumentParser({
  description: 'Arxivisor scraper',
  add_help: true,
});

parser.add_argument('--thumbs', { default: 1, type: 'int', help: 'Should upload thumbs' })
const args = parser.parse_args()

scrapeAll().then(() => process.exit(0))

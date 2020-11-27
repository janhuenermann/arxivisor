const fs = require('fs')
const request = require('request')
const { createCanvas } = require('canvas')
const { MongoClient } = require('mongodb')
const AWS = require('aws-sdk')

const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { ArgumentParser } = require('argparse')

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

async function parse(pdfPath, imagePathBase) {
  var doc = await pdfjs.getDocument(pdfPath).promise

  const domainRegExp = /^(https?:\/\/)?(([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+)(\/[a-zA-Z0-9\_\-]+)*\/?)$/
  let factory = new NodeCanvasFactory()
  let pageCanvas = null, outCanvas = null
  let projectUrl = null, thumbs = []

  for (let i = 1; i <= Math.min(doc.numPages, 8); ++i) {
    const page = await doc.getPage(i)

    if (!projectUrl) {
      let annotations = await page.getAnnotations(), domain = null
      for (let annotation of annotations) {
        if (!annotation.url)
          continue
        if (domain = annotation.url.match(domainRegExp)) {
          if (domain[3].toLowerCase() == 'arxiv.org')
            continue
          projectUrl = domain[2]
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

    const buf = outCanvas.canvas.toBuffer('image/jpeg', { quality: 0.8, progressive: false, chromaSubsampling: true })
    const imagePath = imagePathBase + `-${i}.jpg`
    fs.writeFileSync(imagePath, buf)
    thumbs.push(imagePath)
  }

  return { thumbs, projectUrl }
}

async function download(paper, pdfPath) {
  const file = fs.createWriteStream(pdfPath)
  var success = false
  console.log(`Downloading paper '${paper.title}' from ${paper.pdf}...`)
  try {
    if (!paper.pdf) {
      console.log(`Fatal. Paper does not have a pdf url.`)
      process.exit(1)
    }
    await new Promise((resolve, reject) => {
      request({
        uri: paper.pdf,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
        },
        gzip: true,
      }).pipe(file).on('finish', () => resolve()).on('error', (err) => reject(err))

    }) 
    console.log(`Done`)
    success = true
  }
  catch (err) {
    console.log(`Error downloading paper: ${err}`)
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
    let paperKey = crypto.createHash('md5').update(paper.id).digest('hex')
    const ext = path.extname(imagePath)
    let thumbKey = `thumbs/${paperKey}_page${i+1}${ext}`
    try {
      let data = await new Promise((resolve, reject) => {
        s3.upload({
          Bucket: BUCKET_NAME,
          Key: thumbKey,
          Body: fs.readFileSync(imagePath),
          ACL:'public-read'
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
      console.log(`Error while uploading to AWS: ${err}`)
      process.exit(1)
    }
  }

  console.log(`Did upload thumbs to S3 successfully.`)

  return result
}

async function scrape(pdfPath, imagePathBase, s3) {
  // 1) fetch a record from the database that has no thumbnail field
  const records = await db.collection('papers').find({ info: { $exists: false } }).sort({ datePublished: -1 }).limit(1).toArray()
  if (!records.length)
    return false
  const paper = records[0]
  console.log(paper)
  // 2) download pdf
  const downloaded = await download(paper, pdfPath)
  if (!downloaded)
    return true
  // 3) generate thumbnail / parse
  console.log(`Opening pdf and rendering pages... [${pdfPath}]`)
  let info
  try {
    const { thumbs, projectUrl, } = await parse(pdfPath, imagePathBase)
    // 4) upload to aws
    let thumbUrls = await upload(paper, thumbs, s3)
    // 5) update fields
    info = { thumbs: thumbUrls, projectUrl, }
  }
  catch (err) {
    console.log(`Error parsing PDF: ${err}`)
    info = {}
  }
  
  let dbResult = await db.collection('papers').updateOne({ _id: paper._id } , { $set: { info, } })
  if (!dbResult.result.nModified) {
    console.log(dbResult)
    console.log(`Error during update`)
    process.exit(1)
  }
  // start at 1)
  return true
}

async function scrapeAll() {
  try {
    await client.connect()
    db = client.db('app')
  }
  catch (err) {
    console.log(`Failed to establish database connection. Error: ${err}`)
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


scrapeAll().then(() => process.exit(0))

import FeedParser from 'feedparser'
import { getDatabase } from '@/db/connection';
import request from 'request'
import fs from 'fs'
import { createCanvas } from 'canvas'
import os from 'os'
import path from 'path'

const pdfjs = require('pdfjs-dist/es5/build/pdf.js')
pdfjs.GlobalWorkerOptions.workerSrc = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/es5/build/pdf.worker.js')

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


async function fetchFromArxiv(startIndex, resultCount = 1) {
  const url = `http://export.arxiv.org/api/query?search_query=cat:cs.CV+OR+cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.NE+OR+cat:stat.ML&sortBy=lastUpdatedDate&start=${startIndex}&max_results=${resultCount}`
  
  let response = await fetch(url)

  /** ugly hack to deal with lack of support for streams/pipeline in node 12 */
  let papers = await new Promise((resolve, reject) => {
    let feedparser = new FeedParser()
    let result = []

    feedparser.on('readable', function () {
      var stream = this
      var meta = this.meta
      var item

      while (item = stream.read()) {
        /// -- Begin parsing
        let authors = []

        if (Array.isArray(item['atom:author']))
          authors = item['atom:author'].map(x => x.name['#'])
        else
          authors = [item['atom:author'].name['#']]

        let pdfUrl = ''
        const pdfLink = item['atom:link'].map(x => x['@']).filter(x => x['type'] == 'application/pdf')
        if (pdfLink.length) {
          pdfUrl = pdfLink[0]['href']
        }
        
        result.push({ 
          title: item.title, 
          summary: item.summary, 
          url: item.link, 
          id: item.guid, 
          authors: authors, 
          datePublished: item.pubDate.getTime(),
          pdf: pdfUrl,
          orig: item
        })
        /// --- End parsing
      }
    })

    feedparser.on('error', function (err) {
      reject(err)
    })

    feedparser.on('end', function () {
      resolve(result)
    })

    response.body.pipe(feedparser)
  })

  return papers
}

async function createThumb(paper) {
  let dir = os.tmpdir()
  let pdfPath = path.join(dir, 'paper.pdf')
  let imagePath = path.join(dir, 'paper.png')

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(pdfPath);
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

  let doc = await pdfjs.getDocument(pdfPath).promise

  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 1., })
  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(
     vp.width,
     vp.height
  );  
  await page.render({ canvasContext: canvasAndContext.context, viewport: vp, canvasFactory }).promise

  const buf = canvasAndContext.canvas.toBuffer()
  fs.writeFileSync(imagePath, buf)

  return imagePath
}

module.exports = async (req, res) => {
  const papers = await fetchFromArxiv(0)

  const imagePaths = await Promise.all(papers.map(paper => {
    return createThumb(paper)
  }))
  const imagePath = imagePaths[0]
  const stat = fs.statSync(imagePath)

  res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': stat.size
  })

  var readStream = fs.createReadStream(imagePath)
  // We replaced all the event handlers with a simple call to readStream.pipe()
  readStream.pipe(res)
}
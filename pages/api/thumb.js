import FeedParser from 'feedparser'
import { getDatabase } from '../../middleware/database';
import request from 'request'
import fs from 'fs'
import gm from 'gm'


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
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream("paper.pdf");
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

  await new Promise((resolve, reject) => {
    gm("paper.pdf[0]") // The name of your pdf
      .setFormat("png")
      .resize(400) // Resize to fixed 200px width, maintaining aspect ratio
      .quality(100) // Quality from 0 to 100
      .write("cover.png", function(error){
          // Callback function executed when finished
          if (!error) {
              resolve()
          } else {
              reject(error)
          }
      })
  })

}

module.exports = async (req, res) => {
  try {
    const papers = await fetchFromArxiv(0)

    await Promise.all(papers.map(paper => {
      return createThumb(paper)
    }))

    const imagePath = 'cover.png'
    const stat = fs.statSync(imagePath)

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': stat.size
    })

    var readStream = fs.createReadStream(imagePath)
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(res)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
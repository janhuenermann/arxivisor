const FeedParser = require('feedparser')
const { MongoClient } = require('mongodb')
const fetch = require('node-fetch')
const path = require('path')


if (!process.env.MONGODB_CONNECTION_STRING)
  require("dotenv").config({ path: path.resolve(process.cwd(), '.env.local') })

const connectionString = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})


async function fetchFromArxiv(startIndex, resultCount = 100) {
  const url = `http://export.arxiv.org/api/query?search_query=cat:cs.CV+OR+cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.NE+OR+cat:stat.ML&sortBy=lastUpdatedDate&start=${startIndex}&max_results=${resultCount}`
  let response = await fetch(url)

  if (!response.ok) {
    console.log(`Backing off.. response not ok`)
    console.log(await response.text())
    throw 'Response not ok'
  }
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
        let authors = [], categories = []
        let pdf = item['atom:link'].map(x => x['@']).find(x => x.type == 'application/pdf')['href']

        if (Array.isArray(item['atom:author']))
          authors = item['atom:author'].map(x => x.name['#'])
        else
          authors = [item['atom:author'].name['#']]

        if (Array.isArray(item['atom:category']))
          categories = item['atom:category'].map(x => x['@'].term)
        else
          categories = [item['atom:category']['@'].term]

        let idAndVersion = item.guid.match(/([^/]+)v(\d+)$/)
        let version = '1', id = item.guid
        if (idAndVersion) {
          version = idAndVersion[2]
          id = idAndVersion[1]
        }

        result.push({ 
          title: item.title, 
          summary: item.summary, 
          url: item.link,
          guid: item.guid,
          ref: { id, version },
          authors,
          categories,
          pdf,
          datePublished: item.pubDate.getTime(),
          dateUpdated: item.date.getTime()
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


async function runIndex() {
  try {
    await client.connect()
    var db = client.db('app')
  }
  catch (err) {
    console.log(`Failed to establish database connection. Error: ${err}`)
    return
  }

  const MAX_FETCHES = 20
  const paperCollection = db.collection('papers')

  let status = { count: 0 }
  let insertCount = 0
  let paperIndex = 0
  let fetches = 0

  while (!fetches || (insertCount > 0 && fetches < MAX_FETCHES && fetches > 0)) {
    const papers = await fetchFromArxiv(paperIndex)
    console.log(`Fetched ${papers.length} papers, starting with index ${paperIndex}`)
    if (papers.length == 0)
      break

    const result = await paperCollection.bulkWrite(papers.map(paper => {
      return { 
        updateOne: { 
          filter: { guid: paper.guid }, 
          update: { $set: paper },
          upsert: true
        }
      }
    }))

    paperIndex += papers.length
    insertCount = result.upsertedCount
    fetches += 1
    status.count += insertCount
    console.log(`Upserted ${insertCount}, matched ${result.matchedCount}`)
  }

  console.log(`Done`)
  process.exit(0)
}


runIndex()

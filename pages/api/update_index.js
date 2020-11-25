import FeedParser from 'feedparser'
import { getDatabase } from '../../middleware/database';


async function fetchFromArxiv(startIndex, resultCount = 200) {
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
        
        result.push({ 
          title: item.title, 
          summary: item.summary, 
          url: item.link, 
          id: item.guid, 
          authors: authors, 
          datePublished: item.pubDate.getTime()
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

module.exports = async (req, res) => {
  try {
    const db = await getDatabase()
    const paperCollection = db.collection('papers')

    let insertCount = 0, totalInsertCount = 0
    let paperIndex = 0
    let fetches = 0
    while ((insertCount > 0 && fetches < 8 && fetches > 0) || fetches == 0) {
      const papers = await fetchFromArxiv(paperIndex)
      if (papers.length == 0)
        break
      const result = await paperCollection.bulkWrite(papers.map(paper => {
        return { 
          replaceOne: { 
            filter: { id: paper.id }, 
            replacement: paper,
            upsert: true
          }
        }
      }))

      paperIndex += papers.length
      insertCount = result.upsertedCount
      totalInsertCount += insertCount
      fetches += 1
    }
    
    res.status(200).json(totalInsertCount)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
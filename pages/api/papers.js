import { getDatabase } from '@/db/connection';


export async function getPapers({ search = null, offset = 0, authors = [], retrieveCount = false }) {
    let db = await getDatabase()
    let countOp = null
    const n = 10

    let paperOps = (() => {
        // Build query
        let selector = {}, projection = { _id: 0 }, sorting = {}
        if (!!search) {
            selector['$text'] = { 
                $search: search,
                $language: 'en',
                $caseSensitive: false,
                $diacriticSensitive: false
            }
            projection.score = { $meta: "textScore" }
            sorting.score = { $meta: "textScore" }
        }
        if (authors.length) {
            selector['authors'] = { $in: authors }
        }
        // Make int
        offset = parseInt(offset) || 0
        // Add that last
        sorting.datePublished = -1
        // Get results
        let result = db.collection('papers').find(selector).project(projection).sort(sorting).skip(offset).limit(n + 1)
        return { items: result.clone().limit(n).toArray(), hasNext: result.count(true).then(count => count > n) }
    })()

    let ops = paperOps
    if (retrieveCount) {
        ops.count = db.collection('papers').countDocuments()
    }

    let results = await Promise.all(Object.values(ops))
    let keys = Object.keys(ops)
    return Object.fromEntries(results.map((r, i) => [keys[i], r]))
}

export default async function (req, res) {
    let options = req.query
    if (!options.search || !options.search.length)
        options.search = null
    if (!options.authors)
        options.authors = []
    if (!Array.isArray(options.authors))
        options.authors = [options.authors]
    let data = await getPapers(options)
    res.json(data)
}

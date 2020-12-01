import { getDatabase } from '@/db/connection';


export async function getPapers({ search = null, authors = [], retrieveCount = false }) {
    let db = await getDatabase()
    let countOp = null

    let paperOp = (async () => {
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
        // Add that last
        sorting.datePublished = -1
        // Get results
        let result = await db.collection('papers').find(selector).project(projection).sort(sorting).limit(25)
        return result.toArray() 
    })()

    let ops = [paperOp]
    if (retrieveCount) {
        let countOp = db.collection('papers').countDocuments()
        ops.push(countOp)
    }

    return await Promise.all(ops)    
}

export default async function (req, res) {
    let options = req.query
    if (!options.search || !options.search.length)
        options.search = null
    if (!options.authors)
        options.authors = []
    if (!Array.isArray(options.authors))
        options.authors = [options.authors]
    let [papers] = await getPapers(options)
    res.json(papers)
}

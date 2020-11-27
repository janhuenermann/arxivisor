import { getDatabase } from '@/db/connection';


export async function getPapers({ search = null, retrieveCount = false }) {
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
    let options = {}
    if (req.query.q) {
        options.search = req.query.q
    }
    let [papers] = await getPapers(options)
    res.json(papers)
}

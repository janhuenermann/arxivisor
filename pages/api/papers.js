import { getDatabase } from '../../middleware/database';


export async function getPapers() {
    let db = await getDatabase()

    let countOp = db.collection('papers').count()
    let paperOp = (async () => {
        let result = await db.collection('papers').find().sort({ datePublished: -1 }).project({ _id: 0 }).limit(50)
        return await result.toArray() 
    })()

    let [count, papers] = await Promise.all([countOp, paperOp])    

    return { papers, count }
}

export default async function (req, res) {
    let papers = await getPapers()
    res.json(papers)
}

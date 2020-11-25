import { getDatabase } from '../../middleware/database';


export async function getPapers() {
    let db = await getDatabase()
    let result = await db.collection('papers').find().sort({ datePublished: -1 }).project({ _id: 0 }).limit(50)
    let papers = result.toArray()
    return papers
}

export default async function (req, res) {
    let papers = await getPapers()
    res.json(papers)
}

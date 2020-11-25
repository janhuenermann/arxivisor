import { getDatabase } from '../../middleware/database';


export async function searchPapers(keywords) {
    let db = await getDatabase()
    let result = await db.collection('papers')
        .find({ $text: { 
            $search: keywords,
            $language: 'en',
            $caseSensitive: false,
            $diacriticSensitive: false
        } })
        .project({ score: { $meta: "textScore" }, _id: 0 })
        .sort({ score: { $meta: "textScore" } })
        .limit(10)
    let papers = result.toArray()
    return papers
}

export default async function (req, res) {
    let papers = await searchPapers(req.query.q)
    res.json(papers)
}

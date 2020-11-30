const { MongoClient } = require('mongodb')
const path = require('path')
const readline = require('readline')
const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout
})

const chalk = require('chalk')

if (!process.env.MONGODB_CONNECTION_STRING || !process.env.MONGODB_CONNECTION_STRING.length) {
   require("dotenv").config({
      path: path.resolve(process.cwd(), '.env.local')
   })
}

const connectionString = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(connectionString, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
})

async function ask(question) {
   return await new Promise((resolve, reject) => {
      rl.question(question, (result) => {
         resolve(result)
      })
   })
}

async function getFeedback(availableAnnotations) {
   let ans = ""
   let parsed = -1

   while (parsed != ans || !(parsed >= 0 && parsed <= availableAnnotations.length)) {
      ans = await ask(chalk.red.bold(`[${1}-${availableAnnotations.length}]`) + `: `)
      if (ans === 'EXIT') {
         process.exit(0)
         return
      }
      parsed = parseInt(ans)
   }

   if (parsed == 0) {
      console.log(`Unmatched.`)
   }
   else {
      let label = availableAnnotations[parsed - 1]
      console.log(`${chalk.bold('Selected label')}: ${label.urlTitle}`)
   }

   return parsed
}

async function labelOne() {
   let aggrOp = db.collection('annotations')
      .aggregate([
         { $sort: { guid: 1 } }, 
         { $group: { _id: '$guid', items: { $addToSet: '$$CURRENT' } } },
         { $lookup: {
            from: 'papers',
            localField: '_id',
            foreignField: 'guid',
            as: 'paper'
         } },
         { $project: {
            _id: 1,
            items: 1,
            paper: { $arrayElemAt: [ '$paper', 0 ] }
         } },
         { $match: { 'paper.label.projectUrl': { $exists: false } } }
      ]).limit(1).toArray()

   let totalAnnotatedOp = db.collection('annotations').aggregate([
      { $group: { _id: '$guid' } },
      { $group: { _id: 1, count: { $sum: 1 } } }
   ]).toArray()

   let totalPapersOp = db.collection('papers').count()

   let countOp = db.collection('papers').find({
      'label.projectUrl': { $exists: false }
   }).count()

   let [result, totalAnnotated, totalPapers, count] = await Promise.all([aggrOp, totalAnnotatedOp, totalPapersOp, countOp])
   if (result.length == 0)
      return false

   totalAnnotated = totalAnnotated[0].count

   const blank = '\n'.repeat(process.stdout.rows)
   console.log(blank)

   readline.cursorTo(process.stdout, 0, 0)
   readline.clearScreenDown(process.stdout)

   let labelledCount = (totalPapers - count)

   let annot = result[0]
   let paper = annot.paper
   const sep = chalk.yellow.bold
   console.log(sep(`- - -  STATS  - - -`))
   console.log(`Papers labelled: ${labelledCount} / ${totalAnnotated}`)
   console.log(sep(`- - -  PAPER  - - -`))
   console.log(`${chalk.green.bold(paper.title.replace('\n', ''))}`)
   console.log(`${chalk.cyan(paper.authors.join(', '))}`)
   console.log(`${chalk.hex('#DEADED')(paper.pdf)}`)
   console.log()
   console.log(`${chalk.italic(paper.summary)}`)
   console.log(sep(`- - ANNOTATIONS - -`))

   let availableAnnotations = annot.items
   availableAnnotations.sort((a, b) => a.pageNumber - b.pageNumber)

   for (var i = 1; i <= availableAnnotations.length; ++i) {
      let a = availableAnnotations[i-1]
      console.log(chalk.bold(`${i})`) + ` ${a.urlTitle} [Page ${a.pageNumber}]`)
      console.log(`=> ${a.url}`)
   }

   console.log(`Type 0 for no match.`)

   let label = await getFeedback(availableAnnotations)
   let ok = false
   while (!ok) {
      try {
         await new Promise((resolve, reject) => rl.question(`${chalk.italic('OK')}: [y] `, (ans) => {
            ans = ans.trim()
            if (ans != '' && ans != 'y' && ans != 'yes') {
               reject()
            }
            resolve()
         }))
         ok = true
      }
      catch {
         label = await getFeedback(availableAnnotations)
      }
   }
   
   let projectUrl = false
   if (label > 0) {
      projectUrl = availableAnnotations[label - 1].url
   }

   let update = { $set: { label: { projectUrl: projectUrl } } }
   let updateResult = await db.collection('papers').updateOne({ guid: annot._id }, update)
   if (updateResult.result.nModified != 1) {
      console.log(updateResult)
      console.log(`Error: update result does not seem ok`)
      return false
   }
   return true
}

async function labelAnnotations() {
   try {
      await client.connect()
      db = client.db('app')
   }
   catch (err) {
      console.log(`Failed to establish database connection. Error: ${err}`)
      return
   }

   while (await labelOne()) {}
}


labelAnnotations().then(process.exit)
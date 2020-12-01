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

async function askAnnotation(q, availableAnnotations) {
   let ans = ""
   let parsed = -1

   while (parsed != ans || !(parsed >= 0 && parsed <= availableAnnotations.length)) {
      ans = await ask(chalk.white.bold(q) + ' ' + chalk.red.bold(`[${1}-${availableAnnotations.length}]`) + `: `)
      if (ans === 'EXIT') {
         process.exit(0)
         return
      }
      if (ans == '') {
         ans = '0'
      }
      parsed = parseInt(ans)
   }

   return parsed
}

function logLabel(label) {
   let projectPage = label.projectPage || 'unmatched'
   let sourceCode = label.sourceCode || 'unmatched'
   let demo = label.demo || 'unmatched'

   console.log(chalk.yellow.bold(`- - -  LABEL  - - -`))
   console.log(`Selected ${chalk.italic('project page')}: ${chalk.green(projectPage)}`)
   console.log(`Selected ${chalk.italic('source code')}: ${chalk.green(sourceCode)}`)
   console.log(`Selected ${chalk.italic('demo')}: ${chalk.green(demo)}`)
}

async function getFeedback(availableAnnotations) {
   let projectPage = await askAnnotation('Project page', availableAnnotations)
   let sourceCode = await askAnnotation('Source code', availableAnnotations)
   let demo = await askAnnotation('Demo', availableAnnotations)

   let label = { projectPage: false, sourceCode: false, demo: false }
   if (projectPage > 0)
      label.projectPage = availableAnnotations[projectPage - 1].url
   if (sourceCode > 0)
      label.sourceCode = availableAnnotations[sourceCode - 1].url
   if (demo > 0)
      label.demo = availableAnnotations[demo - 1].url

   logLabel(label)

   return label
}

async function labelOne() {
   let aggrOp = db.collection('annotations')
      .aggregate([
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
         { $match: { 'paper': { $exists: true }, 'paper.label.projectPage': { $exists: false } } }
      ]).limit(1).toArray()

   let annotationsCountOp = db.collection('annotations')
      .aggregate([
         { $group: { _id: '$guid' } },
         { $count: 'count' }
      ]).next()

   let labelsCountOp = db.collection('papers').find({
      'label.projectPage': { $exists: true }
   }).count()

   let [result, annotationsCount, labelsCount] = await Promise.all([aggrOp, annotationsCountOp, labelsCountOp])
   if (result.length == 0)
      return false

   annotationsCount = annotationsCount.count
   let annot = result[0]
   let paper = annot.paper
   let availableAnnotations = annot.items
   availableAnnotations.sort((a, b) => a.pageNumber - b.pageNumber)

   function printInfo() {
      const blank = '\n'.repeat(process.stdout.rows)
      console.log(blank)

      readline.cursorTo(process.stdout, 0, 0)
      readline.clearScreenDown(process.stdout)

      const sep = chalk.yellow.bold
      console.log(sep(`- - -  STATS  - - -`))
      console.log(`Papers labelled: ${labelsCount} / ${annotationsCount}`)
      console.log(sep(`- - -  PAPER  - - -`))
      console.log(`${chalk.green.bold(paper.title.replace('\n', ''))}`)
      console.log(`${chalk.cyan(paper.authors.join(', '))}`)
      console.log(`${chalk.hex('#DEADED')(paper.pdf)}`)
      console.log()
      console.log(`${chalk.italic(paper.summary)}`)
      console.log(sep(`- - ANNOTATIONS - -`))

      for (var i = 1; i <= availableAnnotations.length; ++i) {
         let a = availableAnnotations[i-1]
         console.log(chalk.bold(`${i})`) + ` ${a.urlTitle} [Page ${a.pageNumber}]`)
         console.log(`=> ${a.url}`)
      }

      console.log(`Type 0 for no match.`)
   }

   printInfo()

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
         printInfo()
         label = await getFeedback(availableAnnotations)
      }
   }

   let update = { $set: { label, } }
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
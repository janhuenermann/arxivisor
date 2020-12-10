/**
 * dataset_cleaner.js
 *
 * Tool to display stats about URL dataset created using `label_annotations.js`
 *
 * Requires MONGODB_CONNECTION_STRING environment variable to be set
 */


const { MongoClient } = require('mongodb')
const path = require('path')
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

async function dataset() {
   try {
      await client.connect()
      db = client.db('app')
   }
   catch (err) {
      console.log(`Failed to establish database connection. Error: ${err}`)
      return
   }
   let aggr = (await db.collection('annotations')
         .aggregate([
            { $group: { _id: '$guid' } },
            { $count: 'count' }
         ]).next()).count

   console.log(aggr)
}


dataset().then(process.exit)
/**
 * sync_social.js
 *
 *
 * Tool to automatically sync social media stats about each paper with database
 * Currently fetches twitter and reddit
 * 
 * Requires MONGODB_CONNECTION_STRING and TWITTER_BEARER_TOKEN environment variables to be set
 */

const needle = require('needle')
const { MongoClient } = require('mongodb')
const path = require('path')

if (!process.env.MONGODB_CONNECTION_STRING || !process.env.MONGODB_CONNECTION_STRING.length) {
   require("dotenv").config({ path: path.resolve(process.cwd(), '.env.local') })
}

const connectionString = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(connectionString, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
})

const token = process.env.TWITTER_BEARER_TOKEN


async function getRedditStats(record) {
   const endpointURL = `https://www.reddit.com/r/MachineLearning/search.json`
   let queryComponents = [`( "${record.url}" )`, `( "${record.pdf}" )`, `( "${record.title}" )`]
   if (record.info && record.info.projectUrl) {
      queryComponents.push(`( "${record.info.projectUrl.replace(/^\/|\/$/g, '')}" )`)
   }

   const query = queryComponents.join(" OR ")
   const params = {
      // restrict_sr: 1,
      sort: 'hot',
      q: query,
      type: 'link'
   }
   const res = await needle('GET', endpointURL, params, {
      headers: { accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Safari/605.1.15' }
   })
   if (res.statusCode == 200 && res.body) {
      if (res.body.data.children.length) {
         for (let p of res.body.data.children) {
            const hottest = p.data
            const replies = hottest.num_comments
            const score = hottest.score
            const permalink = hottest.permalink
            const upvoteRatio = hottest.upvote_ratio
            const createdAt = hottest.created_utc
            const info = {
               post: true, score, createdAt, replies, permalink, upvoteRatio
            }
            console.log(`Comparing ${createdAt * 1000} with ${record.datePublished} (=${createdAt * 1000 - record.datePublished})`)
            if (createdAt * 1000 > record.datePublished) {
               return info
            }
         }
      }
      return { post: false, }
   }
   return null
}


async function getTwitterStats(record) {
   const endpointURL = `https://api.twitter.com/2/tweets/search/recent`
   let queryComponents = [`( url:"${record.url}" )`, `( url:"${record.pdf}" )`, `( "${record.title}" )`]
   if (record.info && record.info.projectUrl) {
      queryComponents.push(`( url:"${record.info.projectUrl.replace(/^\/|\/$/g, '')}" )`)
   }
   const query = queryComponents.join(" OR ")
   const fields = ['created_at','public_metrics'].join(',')
   const expansions = 'author_id'
   const user_fields = ['username','public_metrics'].join(',')
   const params = { query, "tweet.fields": fields, "user.fields": user_fields, expansions, }
   const res = await needle('GET', endpointURL, params, {
      headers: {
         "authorization": `Bearer ${token}`
      }
   })
   if (res.statusCode == 200 && res.body) {
      let tweets = []
      for (var i = 0; res.body.data && i < res.body.data.length; ++i) {
         const postInfo = res.body.data[i]
         const userInfo = res.body.includes.users.find(x => x.id == postInfo.author_id)
         if (userInfo.username.toLowerCase().indexOf('arxiv') >= 0) {
            continue
         }
         tweets.push({ id: postInfo.id, ...postInfo.public_metrics, createdAt: postInfo.created_at,
                       user: { username: userInfo.username, ...userInfo.public_metrics } })
      }

      return { tweets, count: tweets.length }
   }
   return null
}

async function fetchStats() {
   try {
      await client.connect()
      db = client.db('app')
   } catch (err) {
      console.log(`Failed to establish database connection. Error: ${err}`)
      return
   }

   const t = (new Date).getTime()
   const old = t - 4 * 3600 * 1000
   const records = await db.collection('papers')
      .find({ $or: [{ twitter: { $exists: false } }, { twitter: { updated: { $lt: old } } }]  })
      .sort({ datePublished: -1 }).limit(10)
      .toArray()
   const paper = records[0]
   console.log(paper)

   let [reddit, twitter] = await Promise.all([getRedditStats(paper), getTwitterStats(paper)])
   reddit.updated = t
   twitter.updated = t
   const update = { reddit, twitter }
   console.log(update)
   let dbResult = await db.collection('papers').updateOne({ _id: paper._id } , { $set: update })
   if (!dbResult.result.nModified) {
      console.log(dbResult)
      console.log(`Error during update`)
      process.exit(1)
   }

}

fetchStats().then(process.exit)

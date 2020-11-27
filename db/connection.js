import { MongoClient } from 'mongodb'


const DB_NAME = 'app'

global.mongo = global.mongo || {}
global.mongo.initiated = false
global.mongo.indexesCreated = false
global.mongo.pendingConnectionPromise = null
global.mongo.client = new MongoClient(process.env.MONGODB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})


export async function createIndexes(db) {
    await Promise.all([
        db.collection('papers').createIndex({ id: -1 }, { unique: true }),
        db.collection('papers').createIndex({ title: 'text', summary: 'text', authors: 'text' })
    ])
}


export async function getDatabase() {
    let shouldCreateIndex = false
    if (!global.mongo.initiated) {
        if (!global.mongo.pendingConnectionPromise) {
            global.mongo.pendingConnectionPromise = global.mongo.client.connect()
        }
        try {
            await global.mongo.pendingConnectionPromise
        }
        finally {
            global.mongo.pendingConnectionPromise = null
            global.mongo.initiated = true
        }

        shouldCreateIndex = true
    }
    let db = global.mongo.client.db(DB_NAME)
    if (shouldCreateIndex && !global.mongo.indexesCreated) {
        global.mongo.indexesCreated = true  // make sure to not run this in other requests
        await createIndexes(db)
    }
    return db
}

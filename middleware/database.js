import { MongoClient } from 'mongodb'


const connectionString = process.env.MONGODB_CONNECTION_STRING
const client = new MongoClient(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

let clientDb = null
let pendingPromise = null

export async function getDatabase() {
    if (!client.isConnected()) {
        if (!pendingPromise) {
            pendingPromise = client.connect()
        }            
        try {
            await pendingPromise
        }
        finally {
            pendingPromise = null
        }
    }
    if (clientDb == null) {
        clientDb = client.db('app')
    }
    return clientDb
}

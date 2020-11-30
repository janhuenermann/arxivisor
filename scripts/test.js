const fetch = require('node-fetch')
const Entities = require('html-entities').AllHtmlEntities
const entities = new Entities()


const browserHeaders = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
  'Cache-Control': 'max-age=0',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
}


async function getWebPageTitle(url) {
  const res = await fetch(url, { headers: browserHeaders })
  if (!res.ok) {
    return null
  }
  const titleRegExp = /\<\s*title[^\>]*>([^\<]*)<\/\s*title\s*>/
  const body = await res.text()
  const match = body.match(titleRegExp)
  if (!match) {
    return null
  }
  const title = entities.decode(match[1])
  return title
}

async function test() {
  const result = await getWebPageTitle('https://www.justinpinkney.com/ukiyoe-dataset/')
  console.log(result)
}

test()

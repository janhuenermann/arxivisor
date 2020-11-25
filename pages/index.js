import { useState, useEffect } from 'react'
import Head from 'next/head'

import { Paper } from '../components/paper.jsx'
import { getPapers } from './api/papers'
import { useDebouncedEffect } from '../src/debouncedEffect'


export default function Home({ papers, paperCount }) {
  const [results, setResults] = useState(papers)
  const [searchText, setSearchText] = useState('')

  useDebouncedEffect(async () => {
    let strippedSearchText = searchText.trim()
    if (strippedSearchText.length == 0)
      setResults(papers)
    else {
      let response = await fetch(`/api/search?q=${encodeURIComponent(strippedSearchText)}`)
      let data = await response.json()
      setResults(data)
    }
  }, 250, [searchText])

  return (
    <div className="container max-w-7xl pt-12 px-10 mx-auto">
      <Head>
        <title>Arxivisor</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="">
        <h1 className="font-extrabold text-3xl text-center pb-8">Arxivisor</h1>
        <div className="flex flex-col space-y-6">
          <input 
            className="text-xl p-1 pl-2 w-full rounded-lg border-2 border-black focus:ring-2 ring-gray-400 outline-none"
            type="text" 
            value={searchText} 
            placeholder={`Search ${paperCount} papers...`}
            onChange={(e) => setSearchText(e.target.value)} />
          <ol className="flex flex-col space-y-6">
          {results.map((paper) => {
            return (<li key={paper.id}><Paper {...paper} /></li>)
          })}
          </ol>
        </div>
      </main>

      <footer className="">
        <a>
        Arxivisor
        </a>
      </footer>
    </div>
  )
}


export async function getStaticProps() {
  let { papers, count, } = await getPapers()

  return {
    props: { papers, paperCount: count }, // will be passed to the page component as props
    revalidate: 360,
  }
}

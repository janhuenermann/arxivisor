import { useState, useEffect } from 'react'
import Head from 'next/head'

import { Paper } from '../components/paper.jsx'
import { getPapers } from './api/papers'
import { useDebouncedEffect } from '../src/debouncedEffect'


function updateQueryString(search) {
  const params = new URLSearchParams(location.search)
  if (search)
    params.set('q', search)
  else
    params.delete('q')
  let queryString = params.toString()
  if (queryString.length)
    queryString = `?${queryString}`
  window.history.replaceState({}, '', `${location.pathname}${queryString}`)
}


export default function Home({ initialSearchText, papers, paperCount }) {
  const [results, setResults] = useState(papers)
  const [searchText, setSearchText] = useState(initialSearchText)

  useDebouncedEffect(async () => {
    let strippedSearchText = searchText.trim()
    updateQueryString(searchText)
    if (strippedSearchText.length == initialSearchText)
      setResults(papers)
    else {
      let response = await fetch(`/api/papers?q=${encodeURIComponent(strippedSearchText)}`)
      let data = await response.json()
      setResults(data)
    }
  }, 250, [searchText])

  return (
    <div className="container max-w-7xl pt-12 px-4 mx-auto">
      <Head>
        <title>Arxivisor</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="">
        <h1 className="font-extrabold text-3xl text-center pb-8">Arxivisor</h1>
        <div className="flex flex-col space-y-6">
          <input 
            className="text-xl p-1 pl-2 w-full rounded-lg border-2 border-black focus:ring-2 ring-gray-400 outline-none 
                       dark:bg-gray-600 dark:border-gray-500 dark:ring-gray-400"
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


export async function getServerSideProps(context) {
  let initialSearchText = context.query.q || ''
  let [ papers, count, ] = await getPapers({
    search: initialSearchText.length ? initialSearchText : null,
    retrieveCount: true
  })

  return {
    props: { initialSearchText, papers, paperCount: count }, // will be passed to the page component as props
  }
}

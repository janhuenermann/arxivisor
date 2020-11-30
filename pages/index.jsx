import { useState, useEffect } from 'react'
import Head from 'next/head'
import useSWR from 'swr'

import fetcher from '@/lib/fetch'
import { Paper } from '@/components/paper.jsx'
import { getPapers } from './api/papers'
import { updateQueryString, useDebouncedEffect } from '@/lib/util'


const buildAPIURI = (query) => {
  let params = new URLSearchParams()
  // search
  if (query.q.length)
    params.set('q', query.q)
  // build url
  let uriQuery = params.toString()
  if (uriQuery.length)
    return `/api/papers?${uriQuery}`
  return `/api/papers`
}


export default function Home({ initialSearchText, initialPapers, paperCount }) {
  const [searchText, setSearchText] = useState(initialSearchText)
  const [query, setQuery] = useState({ q: initialSearchText, })
  const apiUri = buildAPIURI(query)
  const { data: papers, error, isValidating, mutate } = useSWR(apiUri, fetcher, { 
    initialData: initialPapers,
    // dedupingInterval: 0,
    // focusThrottleInterval: 0, 
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: false })

  useDebouncedEffect(async () => {
    let strippedSearchText = searchText.trim()
    updateQueryString(searchText)
    setQuery({ ...query, q: strippedSearchText })
    mutate(papers, true)
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
          {papers.map((paper) => {
            return (<li key={paper.guid}><Paper {...paper} /></li>)
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
  let initialSearchText = (context.query.q || '').trim()
  let [ papers, count, ] = await getPapers({
    search: initialSearchText.length ? initialSearchText : null,
    retrieveCount: true
  })

  return {
    props: { initialSearchText, initialPapers: papers, paperCount: count }, // will be passed to the page component as props
  }
}

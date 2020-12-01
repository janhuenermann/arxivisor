import { useState, useEffect } from 'react'
import Head from 'next/head'
import useSWR from 'swr'

import fetcher from '@/lib/fetch'
import { Paper } from '@/components/paper.jsx'
import RemoveIcon from '@/lib/icons/circle-remove.svg'
import { getPapers } from './api/papers'
import { useQueryState, useDebouncedEffect } from '@/lib/util'

import qs from "query-string"


const buildAPIURI = (query) => {
  let queryString = qs.stringify(query)
  // build url
  if (queryString.length)
    return `/api/papers?${queryString}`
  return `/api/papers`
}


export default function Home({ initialFilters, initialPapers, paperCount }) {
  const [strippedFilters, updateStrippedFilters] = useQueryState(initialFilters)
  const [filters, updateFilters] = useState({ ...strippedFilters })

  const apiUri = buildAPIURI(strippedFilters)
  const { data: papers, error, isValidating, mutate } = useSWR(apiUri, fetcher, { 
    initialData: initialPapers,
    dedupingInterval: 0,
    focusThrottleInterval: 0, 
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: false
  })

  useEffect(() => {
    updateStrippedFilters({ 
      authors: filters.authors, 
      search: strippedFilters.search, 
    })
    // mutate swr
    return mutate()
  }, [filters.authors])

  useDebouncedEffect(() => {
    // clean filters
    updateStrippedFilters({ 
      ...strippedFilters,
      search: filters.search.trim(),
    })
    // mutate swr
    return mutate()
  }, 250, [filters.search])

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
            value={filters.search} 
            placeholder={`Search ${paperCount} papers...`}
            onChange={(e) => updateFilters({ ...filters, search: e.target.value })} />
          <div className="flex flex-row space-x-4">
          {filters.authors.map(author => {
            return (<a
              onClick={(e) => updateFilters({ ...filters, authors: [...filters.authors.filter(x => x != author)], })} 
              className="px-2 py-1 bg-gray-200 rounded-lg text-s align-middle leading-6 cursor-pointer"><span>Author: </span><i>{author}</i> <RemoveIcon className="inline-block align-top transform scale-75" /></a>)
          })}
          </div>
          <ol className="flex flex-col space-y-6">
          {papers.map((paper) => {
            return (<li key={paper.guid}>
              <Paper
                onauthorclick={(author) => updateFilters({ ...filters, authors: [author, ...filters.authors.filter(x => x != author)], })} 
                {...paper} /></li>)
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
  let authors = context.query.authors
  if (!authors)
    authors = []
  if (!Array.isArray(authors))
    authors = [authors]
  let initialFilters = {
    search: (context.query.search || '').trim(),
    authors: authors || []
  }

  let [ papers, count, ] = await getPapers({
    ...initialFilters,
    retrieveCount: true
  })

  return {
    props: { initialFilters, initialPapers: papers, paperCount: count }, // will be passed to the page component as props
  }
}

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import Head from 'next/head'
import qs from "query-string"

import { Paper } from '@/components/paper.jsx'
import RemoveIcon from '@/lib/icons/circle-remove.svg'
import { getPapers } from './api/papers'
import { useQueryState } from '@/lib/util'



const fetcher = async (filters) => {
  let resp = await fetch(buildAPIURI(filters))
  return await resp.json()
}


const buildAPIURI = (query) => {
  let queryString = qs.stringify(query, { skipNull: true, skipEmptyString: true })
  // build url
  if (queryString.length)
    return `/api/papers?${queryString}`
  return `/api/papers`
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect


export default function Home({ initialFilters, initialPapers, paperCount }) {
  const [strippedFilters, setStrippedFilters] = useQueryState(initialFilters)
  const [filters, setFilters] = useState({ ...strippedFilters })
  const [papers, _setPapers] = useState(initialPapers)

  useIsomorphicLayoutEffect(() => {
    fetcher(strippedFilters).then(result => _setPapers(result))
  }, [strippedFilters])

  const updateFilters = useCallback((newValue) => {
    const newStrippedFilters = { ...strippedFilters, ...newValue }
    setStrippedFilters(newStrippedFilters)
    setFilters({ ...filters, ...newValue })
  })

  const debounceRef = useRef(null)
  const updateSearch = useCallback((newValue) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const newStrippedFilters = { ...strippedFilters, search: newValue }
      setStrippedFilters(newStrippedFilters)
    }, 250)
    setFilters({ ...filters, search: newValue })
  })

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
            onChange={(e) => updateSearch(e.target.value)} />
          <div className="flex flex-row space-x-4">
          {filters.authors.map(author => {
            return (<a
              onClick={(e) => updateFilters({ authors: [...filters.authors.filter(x => x != author)], })} 
              className="px-2 py-1 bg-gray-200 rounded-lg text-s align-middle leading-6 cursor-pointer"><span>Author: </span><i>{author}</i> <RemoveIcon className="inline-block align-top transform scale-75" /></a>)
          })}
          </div>
          <ol className="flex flex-col space-y-6">
          {papers.map((paper) => {
            return (<li key={paper.guid}>
              <Paper
                onauthorclick={(author) => updateFilters({ authors: [...filters.authors.filter(x => x != author), author], })} 
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

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import Head from 'next/head'
import qs from "query-string"
import Link from 'next/link'

import { Paper } from '@/components/paper.jsx'
import RemoveIcon from '@/lib/icons/circle-remove.svg'
import { getPapers } from './api/papers'
import { useQueryState } from '@/lib/util'



const fetcher = async (filters, offset = 0) => {
  let resp = await fetch(buildAPIURI({ ...filters, offset, }))
  let data = await resp.json()
  return data
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


function InfiniteList({ initialData, filters, onauthorclick, }) {
  const [page, setPage] = useState(0)
  const [papers, setPapers] = useState(initialData.items)
  const [hasNext, setHasNext] = useState(initialData.hasNext)

  // Fetch on filter update
  useIsomorphicLayoutEffect(() => {
    fetcher(filters).then(data => {
      setPapers(data.items)
      setHasNext(data.hasNext)
      setPage(0)
      pageRef.current = 0
    })
  }, [filters])

  const pageRef = useRef(0)

  // Fetch on infinite scroll
  useEffect(() => {
    if (pageRef.current >= page) {
      return
    }

    fetcher(filters, papers.length).then(data => {
      setPapers((p) => [].concat(p, data.items))
      setHasNext(data.hasNext)
      pageRef.current += 1
    })
  }, [page])

  const intersectionObserver = useRef()
  const prevY = useRef(0)

  // Update page for infinite scroll
  useIsomorphicLayoutEffect(() => {
    intersectionObserver.current = new IntersectionObserver((entries) => {
      const firstEntry = entries[0]
      const y = firstEntry.boundingClientRect.y

      if (prevY.current > y) {
        setPage((page) => page + 1)
      }

      prevY.current = y
    }, { threshold: 0.5 })
  }, [])

  const [loadingRef, setLoadingRef] = useState(null)

  useEffect(() => {
    const currentLoadingRef = loadingRef
    const currentObserver = intersectionObserver.current

    if (currentLoadingRef) {
      currentObserver.observe(currentLoadingRef)
    }

    return () => {
      if (currentLoadingRef) {
        currentObserver.unobserve(currentLoadingRef)
      }
    };
  }, [loadingRef])

  return (
    <>
      {papers.map((paper) => {
        return (
          <li key={paper.guid}>
            <Paper onauthorclick={onauthorclick} {...paper} />
          </li>)
      })}
      {hasNext ? (<li key={'loadingLabel'} ref={setLoadingRef}><p>Loading more papers....</p></li>) : (<></>)}
    </>
  )
}


export default function Home({ initialFilters, initialData, paperCount }) {
  const [strippedFilters, setStrippedFilters] = useQueryState(initialFilters)
  const [filters, setFilters] = useState({ ...strippedFilters })

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
            <InfiniteList initialData={initialData} filters={strippedFilters} 
              onauthorclick={(author) => updateFilters({ authors: [...filters.authors.filter(x => x != author), author], })} />
          </ol>
        </div>
      </main>

      <footer className="text-center mt-6 mb-16">
        <Link href="/"><a className="font-semibold">Arxivisor</a></Link>
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

  let initialData = await getPapers({
    ...initialFilters,
    retrieveCount: true
  })

  let count = initialData.count
  delete initialData.count

  return {
    props: { initialFilters, initialData, paperCount: count, }, // will be passed to the page component as props
  }
}

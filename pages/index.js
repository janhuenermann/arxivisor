import { useState, useEffect } from 'react'

import Head from 'next/head'
import styles from '../styles/Home.module.css'

import { Paper } from '../components/paper.jsx'
import { getPapers } from './api/papers'
import { useDebouncedEffect } from '../src/debouncedEffect'


export default function Home({ papers }) {
  const [results, setResults] = useState(papers)
  const [searchText, setSearchText] = useState('')

  useDebouncedEffect(async () => {
    if (searchText.length == 0)
      setResults(papers)
    else {
      let response = await fetch(`/api/search?q=${encodeURIComponent(searchText)}`)
      let data = await response.json()
      setResults(data)
      console.log(data)
    }
  }, 500, [searchText])

  return (
    <div className={styles.container}>
      <Head>
        <title>Arxiv Library</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <input className={styles.searchField} type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        {results.map((paper) => {
          return (<Paper key={paper.id} {...paper} />)
        })}
      </main>

      <footer className={styles.footer}>
        <a>
        Arxiv Lib
        </a>
      </footer>
    </div>
  )
}


export async function getStaticProps() {
  let papers = await getPapers()

  return {
    props: { papers }, // will be passed to the page component as props
    revalidate: 360,
  }
}

import Latex from 'react-latex'
import Image from 'next/image'

import ExternalLinkIcon from '@/lib/icons/external-link.svg'


const dateTimeFormatterOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric',
  hour12: false
}

const locale = Intl.DateTimeFormat().resolvedOptions().locale
const dateTimeFormatter = new Intl.DateTimeFormat(locale, dateTimeFormatterOptions)
const formatDateTime = (dt) => dateTimeFormatter.format(dt)

const catRegExp = /^[\w0-9\-]+\.[\w0-9\-]+$/


function latexify(str) {
    return str.indexOf('$') >= 0 ? (<Latex>{str}</Latex>) : str
}


export function Paper({
    title,
    summary,
    authors,
    categories,
    datePublished,
    url,
    info = null,
    onauthorclick = null,
    oncategoryclick = null,
}) {
    const titleEl = latexify(title)
    const summaryEl = latexify(summary)
    const filteredCategories = categories.filter(x => catRegExp.test(x))

    return (
        <div className="paper relative">
            <div className="flex flex-col space-y-0.5">
                <h3 className="text-lg font-bold leading-tight"><a target="_blank" rel="noopener noreferrer" href={url}>{titleEl}</a>{info && info.projectUrl && <a className="inline-block align-middle pl-2" href={`http://${info.projectUrl}`} target="_blank"> <ExternalLinkIcon className="transform scale-90" /></a>}</h3>
                <p>{authors.map((author, index) => (
                    <span><a onClick={(e) => onauthorclick && onauthorclick(author, e)} className="cursor-pointer hover:text-gray-500">{author}</a>{index < authors.length-1 ? ", " : ""}</span>))}</p>
                <div className="flex flex-row space-x-2 flex-wrap">
                    <span>{formatDateTime(new Date(datePublished))}</span>
                    {filteredCategories.map(tag => (<span onClick={(e) => oncategoryclick && oncategoryclick(tag, e)} className="place-self-center px-1.5 rounded text-sm uppercase align-middle font-medium text-white bg-gray-400 hover:bg-black cursor-default">{tag}</span>))}
                </div>
                {info && info.thumbs && (
                <div className="flex flex-row space-x-1 overflow-y-scroll disable-scrollbars">
                    {info.thumbs.map(thumb => (<div className="min-w-200 max-w-12rem"><Image
                        src={thumb}
                        alt="Page" className="bg-gray-100"
                        width={280}
                        height={400}
                      /></div>))}
                </div>
                )}
            </div>
            <p className="mt-4 font-sans break-words overflow-x-hidden">{summaryEl}</p>
        </div>
    )
}

export default Paper
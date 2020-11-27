import Latex from 'react-latex'
import Image from 'next/image'


const dateTimeFormatterOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric',
  hour12: false
}

const locale = Intl.DateTimeFormat().resolvedOptions().locale
const dateTimeFormatter = new Intl.DateTimeFormat(locale, dateTimeFormatterOptions)
const formatDateTime = (dt) => dateTimeFormatter.format(dt)


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
}) {
    const titleEl = latexify(title)
    const summaryEl = latexify(summary)
    return (
        <div className="paper relative">
            <div className="flex flex-col space-y-0.5">
                <h3 className="text-lg font-bold leading-tight"><a target="_blank" rel="noopener noreferrer" href={url}>{titleEl}</a></h3>
                <p>{authors.map(author => (<span><a className="hover:text-gray-500">{author}</a>, </span>))}</p>
                <div className="flex flex-row space-x-2 flex-wrap">
                    <span>{formatDateTime(new Date(datePublished))}</span>
                    {categories.map(tag => (<span className="place-self-center px-1.5 rounded text-sm uppercase align-middle font-medium text-white bg-gray-400 hover:bg-black cursor-default">{tag}</span>))}
                </div>
                {info && (
                <div className="flex flex-row space-x-1 overflow-y-scroll">
                    {info.thumbs.map(thumb => (<div className="min-w-200"><Image
                        src={thumb}
                        alt="Page" className="bg-gray-100"
                        width={280}
                        height={400}
                      /></div>))}
                </div>
                )}
            </div>
            <p className="mt-4 font-sans">{summaryEl}</p>
        </div>
    )
}

export default Paper
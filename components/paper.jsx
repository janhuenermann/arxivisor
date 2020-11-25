const dateTimeFormatterOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric',
  hour12: false
}

const locale = Intl.DateTimeFormat().resolvedOptions().locale
const dateTimeFormatter = new Intl.DateTimeFormat(locale, dateTimeFormatterOptions)
const formatDateTime = (dt) => dateTimeFormatter.format(dt)


export function Paper({
    title,
    summary,
    authors,
    datePublished,
    url,
}) {
    return (
        <div className="">
            <h3 className="text-lg font-bold"><a target="_blank" rel="noopener noreferrer" href={url}>{title}</a></h3>
            <p>{authors.map(author => (<span><a>{author}</a>, </span>))}</p>
            <p>{formatDateTime(new Date(datePublished))}</p>
            <p className="mt-4 font-sans">{summary}</p>
        </div>
    )
}

export default Paper
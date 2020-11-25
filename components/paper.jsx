import styles from '../styles/Item.module.css'


const formatter = new Intl.DateTimeFormat


export function Paper({
    title,
    summary,
    authors,
    datePublished,
    url,
}) {
    return (
        <div className={styles.paper}>
            <h3><a target="_blank" rel="noopener noreferrer" href={url}>{title}</a></h3>
            <p>{authors.map(author => (<span><a>{author}</a>, </span>))}</p>
            <p>{formatter.format(datePublished)}</p>
            <p>{summary}</p>
        </div>
    )
}

export default Paper
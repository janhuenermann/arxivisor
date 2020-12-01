import { useState, useCallback, useEffect } from "react"
import qs from "query-string"


const queryStringFormat = { skipNull: true, skipEmptyString: true }


export function setQueryString(query) {
  let queryString = qs.stringify(query, queryStringFormat) 
  if (queryString.length) {
    queryString = `?${queryString}`
  }
  window.history.replaceState({}, '', `${window.location.pathname}${queryString}`)
}

export function getQueryString(str = null) {
  if (!str && typeof window !== 'undefined') {
    str = window.location.search
  }
  return qs.parse(str, queryStringFormat)
}

export function useQueryState(initialValue = {}) {
  const [value, setValue] = useState({ ...initialValue })
  const onSetValue = useCallback(newValue => {
    console.log(newValue)
    setValue(newValue)
    setQueryString(newValue)
  }, [])

  return [value, onSetValue]
}


export const useDebouncedEffect = (effect, delay , deps) => {
    const callback = useCallback(effect, deps);

    useEffect(() => {
        const handler = setTimeout(() => {
            callback();
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [callback, delay]);
}

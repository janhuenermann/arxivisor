import { useCallback, useEffect } from "react"


export function updateQueryString(search) {
  const params = new URLSearchParams(location.search)
  if (search)
    params.set('q', search)
  else
    params.delete('q')
  let queryString = params.toString()
  if (queryString.length)
    queryString = `?${queryString}`
  window.history.replaceState({}, '', `${location.pathname}${queryString}`)
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

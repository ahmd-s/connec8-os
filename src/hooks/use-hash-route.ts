'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Tiny hash router. Routes look like:
 *   #/dashboard  #/leads  #/leads/:id  #/products/:id?lead=xxx
 * Returns path segments, query params and a navigate function.
 */
export function useHashRoute() {
  const [hash, setHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash || '#/dashboard' : '#/dashboard'
  )

  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/dashboard')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: string) => {
    const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`
    if (window.location.hash === target) {
      // force re-render for same-path navigations with new query
      setHash(target + ' ')
      setTimeout(() => setHash(target), 0)
      return
    }
    window.location.hash = target
    window.scrollTo({ top: 0 })
  }, [])

  const pathAndQuery = hash.trim().split('?')
  const segments = (pathAndQuery[0] || '').replace(/^#\/?/, '').split('/').filter(Boolean)
  const query = new URLSearchParams(pathAndQuery[1] || '')

  return { hash, segments, query, navigate }
}

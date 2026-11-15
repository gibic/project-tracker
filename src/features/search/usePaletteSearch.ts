'use client'

import { useEffect, useState } from 'react'

import { parseSearchTerms, type SearchKind } from '@/domain/search/search'
import { EMPTY_PALETTE_RESULTS, type PaletteResults } from './paletteResults'

const DEBOUNCE_MS = 120

interface Response {
  key: string
  results: PaletteResults
  error: string | null
}

/**
 * Debounced `GET /search` for the palette. Superseded requests are aborted. While a new query
 * loads, the previous results stay on screen so the list does not flash empty between keystrokes.
 */
export function usePaletteSearch(query: string, { kinds, limit }: { kinds?: SearchKind[]; limit?: number } = {}) {
  const terms = parseSearchTerms(query)
  const params = new URLSearchParams({ q: terms.join(' ') })
  for (const kind of kinds ?? []) params.append('kind', kind)
  if (limit) params.set('limit', String(limit))
  const key = terms.length ? params.toString() : ''

  const [response, setResponse] = useState<Response | null>(null)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/search?${key}`, { signal: controller.signal })
        if (!res.ok) {
          const message = res.status === 401 ? 'Your session expired. Sign in again.' : 'Search failed.'
          setResponse({ key, results: EMPTY_PALETTE_RESULTS, error: message })
          return
        }
        setResponse({ key, results: (await res.json()) as PaletteResults, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error(error)
        setResponse({ key, results: EMPTY_PALETTE_RESULTS, error: 'Search failed.' })
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key])

  if (!key) return { results: EMPTY_PALETTE_RESULTS, loading: false, error: null }
  return {
    results: response?.results ?? EMPTY_PALETTE_RESULTS,
    loading: response?.key !== key,
    error: response?.key === key ? response.error : null,
  }
}

import { useCallback, useEffect, useState } from 'react'

/** Carga datos asíncronos y permite recargarlos. */
export function useData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined) // undefined = cargando
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    load()
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload }
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Algo salió mal, intenta de nuevo.'
}

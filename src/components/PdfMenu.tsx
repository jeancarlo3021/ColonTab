import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

/**
 * Muestra un PDF completo como imágenes, página por página.
 * Android no muestra PDFs dentro de la página y iPhone solo la primera hoja, por eso se usa PDF.js
 * (versión "legacy", compatible con iPhones viejos). Se carga solo cuando hace falta.
 */
export function PdfMenu({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [pages, setPages] = useState(0)

  useEffect(() => {
    let cancelled = false
    const container = box.current
    if (!container) return
    container.innerHTML = ''
    setState('loading')
    ;(async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = worker
      const doc = await pdfjs.getDocument({ url }).promise
      if (cancelled) return
      setPages(doc.numPages)
      const width = container.clientWidth || 360
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5)
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width / base.width) * ratio })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.className = 'pdf-page'
        canvas.setAttribute('aria-label', `Página ${i} de ${doc.numPages}`)
        container.appendChild(canvas)
        await page.render({ canvas, viewport }).promise
        if (i === 1 && !cancelled) setState('ok')
      }
    })().catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="pdf-menu">
      {state === 'loading' && <div className="pdf-loading"><div className="spinner" /><small>Cargando el menú…</small></div>}
      {state === 'error' && <p className="error pad">No se pudo mostrar el PDF aquí. Ábrelo con el botón de abajo.</p>}
      <div ref={box} className="pdf-pages" />
      <a className="c-outline-btn" href={url} target="_blank" rel="noreferrer" download={url.startsWith('data:') ? 'menu.pdf' : undefined}>
        <Icon name="download" size={18} /> {pages > 1 ? `Abrir el PDF (${pages} páginas)` : 'Abrir el PDF'}
      </a>
    </div>
  )
}

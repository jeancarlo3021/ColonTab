// Grabar etiquetas NFC con Web NFC (solo Chrome en Android, con HTTPS).

interface NDEFRecordInit {
  recordType: 'url' | 'text'
  data: string
}
interface NDEFWriter {
  write(message: { records: NDEFRecordInit[] }, options?: { overwrite?: boolean; signal?: AbortSignal }): Promise<void>
  makeReadOnly?(options?: { signal?: AbortSignal }): Promise<void>
}
type NDEFReaderCtor = new () => NDEFWriter

function ctor(): NDEFReaderCtor | null {
  return (window as unknown as { NDEFReader?: NDEFReaderCtor }).NDEFReader ?? null
}

export function nfcSupported(): boolean {
  return typeof window !== 'undefined' && !!ctor() && window.isSecureContext
}

export function nfcCanLock(): boolean {
  const C = ctor()
  return !!C && typeof C.prototype.makeReadOnly === 'function'
}

/** Espera a que acerquen una etiqueta y graba el enlace. Si lock es true, la deja de solo lectura. */
export async function writeNfcUrl(url: string, opts: { lock?: boolean; signal?: AbortSignal } = {}): Promise<void> {
  const C = ctor()
  if (!C) throw new Error('Este navegador no puede grabar NFC')
  const writer = new C()
  await writer.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal: opts.signal })
  if (opts.lock) {
    if (!writer.makeReadOnly) throw new Error('Este navegador no puede bloquear etiquetas')
    await writer.makeReadOnly({ signal: opts.signal })
  }
}

export function nfcErrorText(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'AbortError') return 'Cancelado'
  if (name === 'NotAllowedError') return 'Permiso de NFC denegado. Actívalo en el navegador e inténtalo de nuevo.'
  if (name === 'NotSupportedError') return 'NFC no disponible. Revisa que el NFC del teléfono esté encendido.'
  if (name === 'NetworkError') return 'Se perdió la conexión con la etiqueta. Mantenla quieta junto al teléfono.'
  return e instanceof Error ? e.message : 'No se pudo grabar la etiqueta.'
}

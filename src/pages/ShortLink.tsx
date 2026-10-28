import { Navigate, useParams } from 'react-router-dom'
import { parseShortCode } from '../lib/links'
import { NotFound } from './NotFound'

/**
 * Enlaces viejos /m/la-esquina-4 (usaban el número de mesa, que se podía cambiar).
 * Ahora solo abren la vista previa: para avisar al personal hay que usar el QR/NFC nuevo.
 */
export function ShortLink() {
  const { code = '' } = useParams()
  const parsed = parseShortCode(code)
  if (!parsed) return <NotFound message="Enlace de mesa no válido. Escanea el QR de tu mesa." />
  return <Navigate to={`/r/${parsed.slug}/${parsed.table}`} replace />
}

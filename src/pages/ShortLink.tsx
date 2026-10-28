import { Navigate, useLocation, useParams } from 'react-router-dom'
import { parseShortCode } from '../lib/links'
import { NotFound } from './NotFound'

/** /m/la-esquina-4 → /r/la-esquina/4 (conserva ?v=nfc / ?v=qr) */
export function ShortLink() {
  const { code = '' } = useParams()
  const { search } = useLocation()
  const parsed = parseShortCode(code)
  if (!parsed) return <NotFound message="Enlace de mesa no válido. Escanea el QR de tu mesa." />
  return <Navigate to={`/r/${parsed.slug}/${parsed.table}${search}`} replace />
}

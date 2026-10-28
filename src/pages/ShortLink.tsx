import { Navigate, useLocation, useParams } from 'react-router-dom'
import { parseShortCode } from '../lib/links'
import { NotFound } from './NotFound'

/** /m/la-esquina-4 → /r/la-esquina/4 (conserva ?v=nfc / ?v=qr). Con ?v=qr va directo al menú. */
export function ShortLink() {
  const { code = '' } = useParams()
  const { search } = useLocation()
  const parsed = parseShortCode(code)
  if (!parsed) return <NotFound message="Enlace de mesa no válido. Escanea el QR de tu mesa." />
  // El QR abre directo el menú; NFC y enlaces abren la pantalla de la mesa
  const toMenu = new URLSearchParams(search).get('v') === 'qr'
  return <Navigate to={`/r/${parsed.slug}/${parsed.table}${toMenu ? '/menu' : ''}${search}`} replace />
}

export function money(value: number, currency = 'MXN') {
  const locale = currency === 'CRC' ? 'es-CR' : currency === 'USD' ? 'en-US' : 'es-MX'
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'CRC' ? 0 : 2 }).format(value)
}

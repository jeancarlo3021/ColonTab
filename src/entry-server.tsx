// Se usa solo en la build para pre-generar el HTML de la página de inicio (SEO).
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { Landing } from './pages/Landing'

export { FAQ, PARENT_NAME, PARENT_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './lib/site'

export function render(): string {
  return renderToString(
    <StaticRouter location="/">
      <Landing />
    </StaticRouter>,
  )
}

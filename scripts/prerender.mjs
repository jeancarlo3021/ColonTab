// Después de `vite build`: escribe el HTML de la página de inicio dentro de dist/index.html
// para que Google lea el contenido sin ejecutar JavaScript. dist/app.html queda vacío para
// el resto de rutas (mesas y paneles).
import { readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.join(root, 'dist')
const ssr = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href)

const template = await readFile(path.join(dist, 'index.html'), 'utf8')

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${ssr.SITE_URL}/#organization`,
      name: ssr.SITE_NAME,
      url: `${ssr.SITE_URL}/`,
      logo: `${ssr.SITE_URL}/icon-512.png`,
      parentOrganization: { '@type': 'Organization', name: ssr.PARENT_NAME, url: ssr.PARENT_URL },
    },
    {
      '@type': 'WebSite',
      '@id': `${ssr.SITE_URL}/#website`,
      url: `${ssr.SITE_URL}/`,
      name: ssr.SITE_NAME,
      inLanguage: 'es-CR',
      publisher: { '@id': `${ssr.SITE_URL}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: ssr.SITE_NAME,
      url: `${ssr.SITE_URL}/`,
      description: ssr.SITE_DESCRIPTION,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      areaServed: { '@type': 'Country', name: 'Costa Rica' },
      inLanguage: 'es-CR',
      publisher: { '@id': `${ssr.SITE_URL}/#organization` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: ssr.FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
}
const ldTag = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`

// app.html: para mesas y paneles (sin contenido pre-generado ni datos de la portada)
const app = template.replace('<!--jsonld-->', '').replace('<!--app-->', '')
await writeFile(path.join(dist, 'app.html'), app)

// index.html: portada con su contenido
const home = template.replace('<!--jsonld-->', ldTag).replace('<!--app-->', ssr.render())
await writeFile(path.join(dist, 'index.html'), home)

await rm(path.join(root, 'dist-ssr'), { recursive: true, force: true })
console.log('✓ portada pre-generada (dist/index.html) y dist/app.html')

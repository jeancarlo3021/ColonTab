import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import './admin.css'
import './landing.css'
import './client.css'
import { AuthProvider } from './lib/auth'
import { Landing } from './pages/Landing'
import { RestaurantLayout } from './pages/RestaurantLayout'
import { Home } from './pages/Home'
import { Menu } from './pages/Menu'
import { Games } from './pages/Games'
import { NotFound } from './pages/NotFound'
import { ShortLink } from './pages/ShortLink'
import { RequireAuth } from './admin/AdminShell'
import { AdminLogin } from './admin/AdminLogin'
import { AdminHome } from './admin/AdminHome'
import { RestaurantAdmin } from './admin/RestaurantAdmin'
import { PlatformAdmin } from './admin/PlatformAdmin'

const app = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Lo que abre el QR / NFC: código secreto de la mesa */}
          <Route path="/t/:token" element={<RestaurantLayout />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="juegos" element={<Games />} />
          </Route>
          {/* Vista previa para el dueño (no envía avisos) */}
          <Route path="/r/:slug/:mesa" element={<RestaurantLayout />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="juegos" element={<Games />} />
          </Route>
          <Route path="/m/:code" element={<ShortLink />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAuth><AdminHome /></RequireAuth>} />
          <Route path="/admin/r/:slug" element={<RequireAuth><RestaurantAdmin /></RequireAuth>} />
          <Route path="/admin/plataforma" element={<RequireAuth platform><PlatformAdmin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)

// La portada viene pre-generada en el HTML (SEO): se hidrata. El resto se dibuja desde cero.
const container = document.getElementById('root')!
if (window.location.pathname === '/' && container.firstElementChild) hydrateRoot(container, app)
else {
  container.innerHTML = ''
  createRoot(container).render(app)
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import './admin.css'
import { AuthProvider } from './lib/auth'
import { Landing } from './pages/Landing'
import { RestaurantLayout } from './pages/RestaurantLayout'
import { Home } from './pages/Home'
import { Menu } from './pages/Menu'
import { Games } from './pages/Games'
import { NotFound } from './pages/NotFound'
import { RequireAuth } from './admin/AdminShell'
import { AdminLogin } from './admin/AdminLogin'
import { AdminHome } from './admin/AdminHome'
import { RestaurantAdmin } from './admin/RestaurantAdmin'
import { PlatformAdmin } from './admin/PlatformAdmin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/r/:slug/:mesa" element={<RestaurantLayout />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="juegos" element={<Games />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAuth><AdminHome /></RequireAuth>} />
          <Route path="/admin/r/:slug" element={<RequireAuth><RestaurantAdmin /></RequireAuth>} />
          <Route path="/admin/plataforma" element={<RequireAuth platform><PlatformAdmin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

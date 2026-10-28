import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { checkPlatformAdmin } from './adminApi'

interface AuthState {
  loading: boolean
  email: string | null
  isPlatformAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<'ok' | 'confirm-email'>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const DEMO_KEY = 'mesaclick:demo-admin'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  const applyEmail = useCallback(async (next: string | null) => {
    const admin = next ? await checkPlatformAdmin(next).catch(() => false) : false
    setEmail(next)
    setIsPlatformAdmin(admin)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) {
      let saved: string | null = null
      try {
        saved = sessionStorage.getItem(DEMO_KEY)
      } catch {
        /* sin almacenamiento */
      }
      void applyEmail(saved)
      return
    }
    supabase.auth.getSession().then(({ data }) => applyEmail(data.session?.user.email ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // setTimeout: Supabase recomienda no llamar a la API dentro de este callback
      setTimeout(() => void applyEmail(session?.user.email ?? null), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [applyEmail])

  const signIn = async (mail: string, password: string) => {
    if (!supabase) {
      try {
        sessionStorage.setItem(DEMO_KEY, mail)
      } catch {
        /* sin almacenamiento */
      }
      return applyEmail(mail)
    }
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
  }

  const signUp = async (mail: string, password: string) => {
    if (!supabase) {
      await signIn(mail, password)
      return 'ok' as const
    }
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })
    if (error) throw new Error(error.message)
    return data.session ? ('ok' as const) : ('confirm-email' as const)
  }

  const signOut = async () => {
    if (!supabase) {
      try {
        sessionStorage.removeItem(DEMO_KEY)
      } catch {
        /* sin almacenamiento */
      }
      return applyEmail(null)
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ loading, email, isPlatformAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

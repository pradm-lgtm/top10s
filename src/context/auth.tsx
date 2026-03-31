'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAnonymous: boolean
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<void>
  linkWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAnonymous: false,
  signInWithGoogle: async () => {},
  signInAnonymously: async () => {},
  linkWithGoogle: async () => {},
  signOut: async () => {},
})

function getBaseUrl() {
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  if (isLocalhost) return window.location.origin
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return raw.startsWith('http') ? raw : `https://${raw}`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const isAnonymous = !!user?.is_anonymous

  useEffect(() => {
    async function init() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const code = new URLSearchParams(window.location.search).get('code')
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }

      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      if (session?.user && !session.user.is_anonymous) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user && !session.user.is_anonymous) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${getBaseUrl()}/home` },
    })
  }

  async function signInAnonymously() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) return // already signed in (anon or real)
    await supabase.auth.signInAnonymously()
  }

  async function linkWithGoogle() {
    // Upgrade an anonymous session to a real Google account.
    // After linking, the user's id stays the same — all their data persists.
    await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${getBaseUrl()}/home` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAnonymous, signInWithGoogle, signInAnonymously, linkWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

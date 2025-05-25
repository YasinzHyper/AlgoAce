"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/utils/supabase/client"

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      // console.log("Refreshing session:", currentSession)
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
    } catch (error) {
      console.error("Error refreshing session:", error)
    }
  }

  useEffect(() => {
    // Get initial session
    refresh()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("Auth state changed:", event, currentSession)
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value = {
    user,
    session,
    loading,
    refresh
  }

  // console.log("Auth context value:", value)

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
} 
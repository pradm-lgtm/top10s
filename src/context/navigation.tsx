'use client'

import { createContext, useContext, useState } from 'react'

export type NavPill = 'all' | 'prompt' | 'editorial' | 'recent' | 'by-year'

type NavigationContextType = {
  navPill: NavPill
  setNavPill: (pill: NavPill) => void
}

const NavigationContext = createContext<NavigationContextType>({
  navPill: 'all',
  setNavPill: () => {},
})

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [navPill, setNavPillState] = useState<NavPill>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('home_nav_pill') as NavPill) ?? 'all'
    }
    return 'all'
  })

  function setNavPill(pill: NavPill) {
    setNavPillState(pill)
    if (typeof window !== 'undefined') localStorage.setItem('home_nav_pill', pill)
  }

  return (
    <NavigationContext.Provider value={{ navPill, setNavPill }}>
      {children}
    </NavigationContext.Provider>
  )
}

export const useNavigation = () => useContext(NavigationContext)

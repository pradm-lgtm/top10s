'use client'

import { useRouter } from 'next/navigation'
import { SearchOverlay } from '@/components/SearchOverlay'

// Direct navigation to /search shows full-screen search
export default function SearchPage() {
  const router = useRouter()
  return <SearchOverlay onClose={() => router.back()} />
}

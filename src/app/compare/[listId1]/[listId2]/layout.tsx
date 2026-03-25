import type { Metadata } from 'next'
import { getAdminSupabase } from '@/lib/supabase-admin'

type Props = { params: Promise<{ listId1: string; listId2: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listId1, listId2 } = await params
  const supabase = getAdminSupabase()

  const [{ data: list1 }, { data: list2 }] = await Promise.all([
    supabase.from('lists').select('title, profiles(username, display_name)').eq('id', listId1).single(),
    supabase.from('lists').select('title, profiles(username, display_name)').eq('id', listId2).single(),
  ])

  if (!list1 || !list2) return { title: 'Compare Lists — Ranked' }

  const p1 = list1.profiles as unknown as { display_name: string | null; username: string } | null
  const p2 = list2.profiles as unknown as { display_name: string | null; username: string } | null
  const name1 = p1?.display_name ?? p1?.username ?? 'Someone'
  const name2 = p2?.display_name ?? p2?.username ?? 'Someone'

  const title = `${name1} vs ${name2} — ${list1.title}`
  const description = `Compare "${list1.title}" by ${name1} against "${list2.title}" by ${name2} on Ranked.`
  const rawSite = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const siteUrl = rawSite.startsWith('http') ? rawSite : rawSite ? `https://${rawSite}` : ''
  const url = `${siteUrl}/compare/${listId1}/${listId2}`
  const ogImage = `${siteUrl}/api/og/compare?id1=${listId1}&id2=${listId2}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Ranked',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

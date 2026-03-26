import type { Metadata } from 'next'
import { getAdminSupabase } from '@/lib/supabase-admin'

type Props = { params: Promise<{ listId1: string; listId2: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listId1, listId2 } = await params
  const supabase = getAdminSupabase()

  const [{ data: list1 }, { data: list2 }] = await Promise.all([
    supabase.from('lists').select('title, owner_id, source_label, profiles(username, display_name)').eq('id', listId1).single(),
    supabase.from('lists').select('title, owner_id, source_label, profiles(username, display_name)').eq('id', listId2).single(),
  ])

  if (!list1 || !list2) return { title: 'Compare Lists — Ranked' }

  const p1 = list1.profiles as unknown as { display_name: string | null; username: string } | null
  const p2 = list2.profiles as unknown as { display_name: string | null; username: string } | null

  // Fallback chain: display_name → source_label → list title (never "Someone")
  const name1 = p1?.display_name ?? list1.source_label ?? list1.title
  const name2 = p2?.display_name ?? list2.source_label ?? list2.title

  // Same user: use list titles in og:title instead of "Prad vs Prad"
  const sameUser = !!(list1.owner_id && list2.owner_id && list1.owner_id === list2.owner_id)

  const title = sameUser
    ? `${list1.title} vs ${list2.title} — ${name1} | Ranked`
    : `${name1} vs ${name2} — ${list1.title} | Ranked`

  const description = sameUser
    ? `Compare "${list1.title}" against "${list2.title}" on Ranked.`
    : `Compare "${list1.title}" by ${name1} against "${list2.title}" by ${name2} on Ranked.`

  const rawSite = process.env.NEXT_PUBLIC_SITE_URL ?? 'rankedhq.app'
  const siteUrl = rawSite.startsWith('http') ? rawSite : `https://${rawSite}`
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

import type { Metadata } from 'next'
import { getAdminSupabase } from '@/lib/supabase-admin'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = getAdminSupabase()

  const [{ data: list }, { data: entries }] = await Promise.all([
    supabase
      .from('lists')
      .select('id, title, year, category, list_format, profiles(username, display_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('list_entries')
      .select('title, rank')
      .eq('list_id', id)
      .order('rank', { ascending: true })
      .limit(5),
  ])

  if (!list) {
    return { title: 'Ranked' }
  }

  const owner = (Array.isArray(list.profiles) ? list.profiles[0] : list.profiles) as { username: string; display_name: string | null } | null
  const ownerName = owner?.display_name ?? owner?.username ?? ''
  const title = ownerName
    ? `${list.title} — ${ownerName} | Ranked`
    : `${list.title} | Ranked`

  const topTitles = (entries ?? []).slice(0, 3).map((e) => e.title).join(', ')
  const extra = (entries?.length ?? 0) > 3 ? ` and ${(entries?.length ?? 0) - 3} more` : ''
  const description = topTitles
    ? `${topTitles}${extra}`
    : `A ${list.category === 'movies' ? 'movies' : 'TV shows'} list on Ranked`

  const rawSite = process.env.NEXT_PUBLIC_SITE_URL ?? 'rankedhq.app'
  const siteUrl = rawSite.startsWith('http') ? rawSite : `https://${rawSite}`
  const ogImageUrl = `${siteUrl}/api/og?id=${id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/list/${id}`,
      siteName: 'Ranked',
      images: [{ url: ogImageUrl, secureUrl: ogImageUrl, width: 1200, height: 630, alt: list.title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

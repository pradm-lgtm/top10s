import type { Metadata } from 'next'
import { getAdminSupabase } from '@/lib/supabase-admin'

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params
  const supabase = getAdminSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', username)
    .single()

  if (!profile) {
    return { title: 'Ranked' }
  }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s lists | Ranked`
  const description = `See ${displayName}'s ranked film & TV lists on Ranked.`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${username}`,
      siteName: 'Ranked',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/context/auth'
import type { List, ListEntry, Profile } from '@/types'

type ListWithPreview = List & { entries: ListEntry[] }

type GroupedByYear = {
  year: number
  movies: ListWithPreview[]
  tv: ListWithPreview[]
}

const GENRE_COLORS: Record<string, string> = {
  'rom-com':  '#f472b6',
  'horror':   '#f87171',
  'action':   '#fb923c',
  'drama':    '#60a5fa',
  'scifi':    '#34d399',
  'comedy':   '#facc15',
  'animated': '#a78bfa',
}

function themeColor(genre: string | null) {
  return genre ? (GENRE_COLORS[genre] ?? '#f472b6') : '#f472b6'
}

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  const { profile: authProfile } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [annualGrouped, setAnnualGrouped] = useState<GroupedByYear[]>([])
  const [themeLists, setThemeLists] = useState<ListWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isOwnProfile = authProfile?.username === username

  useEffect(() => {
    if (username) loadProfile(username)
  }, [username])

  async function loadProfile(uname: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', uname)
      .single()

    if (!prof) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setProfile(prof)

    const { data: lists } = await supabase
      .from('lists')
      .select('*')
      .eq('owner_id', prof.id)
      .order('year', { ascending: false, nullsFirst: false })

    if (!lists || lists.length === 0) {
      setLoading(false)
      return
    }

    const listIds = lists.map((l) => l.id)
    const { data: entries } = await supabase
      .from('list_entries')
      .select('*')
      .in('list_id', listIds)
      .lte('rank', 3)
      .order('rank', { ascending: true })

    const entryMap: Record<string, ListEntry[]> = {}
    for (const entry of entries ?? []) {
      if (!entryMap[entry.list_id]) entryMap[entry.list_id] = []
      entryMap[entry.list_id].push(entry)
    }

    const withPreviews: ListWithPreview[] = lists.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
    }))

    const annual = withPreviews.filter((l) => l.list_type !== 'theme')
    const THEME_ORDER = ['All-Time TV Shows', 'Marvel Movies (Phases 1-4)', 'Rom-Coms 💞']
    const theme = withPreviews
      .filter((l) => l.list_type === 'theme')
      .sort((a, b) => {
        const ai = THEME_ORDER.indexOf(a.title)
        const bi = THEME_ORDER.indexOf(b.title)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })

    const yearMap: Record<number, { movies: ListWithPreview[]; tv: ListWithPreview[] }> = {}
    for (const list of annual) {
      const y = list.year!
      if (!yearMap[y]) yearMap[y] = { movies: [], tv: [] }
      yearMap[y][list.category].push(list)
    }
    const grouped: GroupedByYear[] = Object.entries(yearMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, cats]) => ({ year: Number(year), ...cats }))

    setAnnualGrouped(grouped)
    setThemeLists(theme)
    setLoading(false)
  }

  const initials = (profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase()

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      {notFound ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-lg font-semibold">User not found</p>
          <Link href="/home" className="text-sm" style={{ color: 'var(--muted)' }}>← Back to home</Link>
        </div>
      ) : (
        <>
          {/* Profile hero */}
          <div
            className="relative py-12 px-4 overflow-hidden"
            style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(232,197,71,0.07) 0%, transparent 70%)' }}
          >
            <div className="max-w-5xl mx-auto flex items-center gap-5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full shrink-0" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  {!loading && initials}
                </div>
              )}
              {profile && (
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {profile.display_name ?? profile.username}
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>@{profile.username}</p>
                </div>
              )}
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 pb-20 flex gap-10 items-start">
            {/* Sidebar */}
            {!loading && (
              <nav className="hidden lg:flex flex-col gap-1 w-36 shrink-0 sticky top-24 pt-8">
                {themeLists.length > 0 && (
                  <>
                    <span className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                      All-Time
                    </span>
                    {themeLists.map((list) => (
                      <a key={list.id} href={`/list/${list.id}`} className="text-sm py-0.5 transition-colors hover:text-white truncate" style={{ color: 'var(--muted)' }}>
                        {list.title}
                      </a>
                    ))}
                    <div className="my-3 h-px" style={{ background: 'var(--border)' }} />
                  </>
                )}
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  By Year
                </span>
                {annualGrouped.map(({ year }) => (
                  <a key={year} href={`#year-${year}`} className="text-sm py-0.5 font-medium transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>
                    {year}
                  </a>
                ))}
              </nav>
            )}

            <main className="flex-1 min-w-0 space-y-16 pt-8">
              {loading && (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                </div>
              )}

              {!loading && themeLists.length === 0 && annualGrouped.length === 0 && (
                <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
                  No lists yet.
                </div>
              )}

              {/* Theme Lists */}
              {!loading && themeLists.length > 0 && (
                <section id="all-time" style={{ scrollMarginTop: '80px' }}>
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-xl font-bold tracking-tight">All-Time Rankings</h2>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {themeLists.map((list) => (
                      <ProfileListCard key={list.id} list={list} />
                    ))}
                  </div>
                </section>
              )}

              {/* Annual Lists */}
              {annualGrouped.map(({ year, movies, tv }) => (
                <section key={year} id={`year-${year}`} style={{ scrollMarginTop: '80px' }}>
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{year}</h2>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(['movies', 'tv'] as const).map((cat) => {
                      const catLists = cat === 'movies' ? movies : tv
                      if (catLists.length === 0) return null
                      return (
                        <div key={cat} className="space-y-3">
                          <span
                            className="text-xs tracking-[0.25em] uppercase font-semibold px-2 py-1 rounded inline-block"
                            style={{
                              background: cat === 'movies' ? 'rgba(232,197,71,0.12)' : 'rgba(139,92,246,0.12)',
                              color: cat === 'movies' ? 'var(--accent)' : '#a78bfa',
                            }}
                          >
                            {cat === 'movies' ? 'Movies' : 'TV Shows'}
                          </span>
                          {catLists.map((list) => (
                            <ProfileListCard key={list.id} list={list} />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}

              {/* Add new list — own profile */}
              {!loading && isOwnProfile && (
                <Link
                  href="/create"
                  className="block w-full py-4 rounded-xl text-sm font-medium text-center transition-all hover:opacity-80"
                  style={{ border: '1px dashed rgba(232,197,71,0.3)', color: 'var(--muted)' }}
                >
                  + Create New List
                </Link>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}

function ProfileListCard({ list }: { list: ListWithPreview }) {
  const isTheme  = list.list_type === 'theme'
  const isMovie  = list.category === 'movies'
  const accent   = isTheme ? themeColor(list.genre) : isMovie ? 'var(--accent)' : '#a78bfa'
  const hoverBg  = isTheme ? `rgba(244,114,182,0.06)` : isMovie ? `rgba(232,197,71,0.06)` : `rgba(139,92,246,0.06)`
  const hoverBorder = isTheme ? `rgba(244,114,182,0.4)` : isMovie ? `rgba(232,197,71,0.4)` : `rgba(139,92,246,0.4)`

  const isTiered = list.list_format === 'tiered'
  const isTierRanked = list.list_format === 'tier-ranked'

  const tierGroups: { rank: number; titles: string[] }[] = []
  if (isTiered) {
    const map = new Map<number, string[]>()
    for (const e of list.entries) {
      if (!map.has(e.rank)) map.set(e.rank, [])
      map.get(e.rank)!.push(e.title)
    }
    Array.from(map.entries()).sort(([a], [b]) => a - b).forEach(([rank, titles]) => tierGroups.push({ rank, titles }))
  }

  return (
    <Link href={`/list/${list.id}`} className="block group">
      <div
        className="rounded-xl p-5 transition-all duration-200 group-hover:translate-y-[-2px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: '220px' }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = hoverBorder
          el.style.boxShadow = `0 4px 24px ${hoverBg}`
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border)'
          el.style.boxShadow = ''
        }}
      >
        <div className="mb-3 shrink-0">
          <h3 className="font-semibold text-base leading-tight">{list.title}</h3>
        </div>

        <div className="flex-1 min-h-0 relative overflow-hidden">
          {isTierRanked ? (
            <ol className="space-y-1.5">
              {list.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-bold w-5 shrink-0" style={{ color: accent }}>{entry.rank}</span>
                  <span className="truncate">{entry.title}</span>
                </li>
              ))}
            </ol>
          ) : isTiered ? (
            <div className="space-y-1.5">
              {tierGroups.map(({ rank, titles }) => (
                <div key={rank} className="flex items-baseline gap-2 text-sm">
                  <span className="text-[10px] font-bold shrink-0 w-5" style={{ color: accent }}>{`T${rank}`}</span>
                  <span className="truncate">{titles.join(', ')}</span>
                </div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1.5">
              {list.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-bold w-5 shrink-0" style={{ color: accent }}>{entry.rank}</span>
                  <span className="truncate">{entry.title}</span>
                </li>
              ))}
              {list.entries.length === 0 && (
                <li className="text-xs italic" style={{ color: 'var(--muted)' }}>Coming soon…</li>
              )}
            </ol>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--surface))' }}
          />
        </div>

        <div className="mt-2 text-xs font-medium tracking-wide flex items-center gap-1 shrink-0" style={{ color: accent }}>
          See full list
          <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
        </div>
      </div>
    </Link>
  )
}

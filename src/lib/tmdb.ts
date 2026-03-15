const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185'

// Strip season/series qualifiers before searching, e.g.
// "The Bear (Season 2)" → "The Bear"
// "Shōgun (Season 1)" → "Shōgun"
function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(Season \d+\)/i, '')
    .replace(/\s*S\d+$/i, '')
    .trim()
}

export async function fetchPoster(
  title: string,
  category: 'movies' | 'tv',
  year?: number | null
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || apiKey === 'your-tmdb-api-key') return null

  const type = category === 'movies' ? 'movie' : 'tv'
  const query = cleanTitle(title)
  // For TV, first_air_date_year is the show's premiere year, not the season year,
  // so filtering by list year returns nothing for returning shows (e.g. Atlanta S4, The Bear S2).
  const yearParam = year && category === 'movies'
    ? `&primary_release_year=${year}`
    : ''

  async function search(extraParam: string): Promise<string | null> {
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&api_key=${apiKey}&page=1${extraParam}`,
      { next: { revalidate: 60 * 60 * 24 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.results ?? []) as { poster_path?: string; vote_count: number }[]
    const best = results
      .filter((r) => r.poster_path)
      .sort((a, b) => b.vote_count - a.vote_count)[0]
    return best?.poster_path ? `${TMDB_IMAGE_BASE}${best.poster_path}` : null
  }

  try {
    const result = await search(yearParam)
    // If year-filtered search found nothing, retry without year —
    // handles films with different release years by country (e.g. Eye in the Sky 2015/2016)
    if (!result && yearParam) return search('')
    return result
  } catch {
    return null
  }
}

export async function fetchPosters(
  entries: { id: string; title: string }[],
  category: 'movies' | 'tv',
  year?: number | null
): Promise<Record<string, string | null>> {
  const results = await Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      url: await fetchPoster(entry.title, category, year),
    }))
  )

  return Object.fromEntries(results.map((r) => [r.id, r.url]))
}

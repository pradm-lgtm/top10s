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
  const yearParam = year
    ? category === 'movies'
      ? `&primary_release_year=${year}`
      : `&first_air_date_year=${year}`
    : ''

  try {
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&api_key=${apiKey}&page=1${yearParam}`,
      { next: { revalidate: 60 * 60 * 24 } } // cache for 24h
    )
    if (!res.ok) return null

    const data = await res.json()
    // Pick the result with the highest vote_count to avoid obscure titles
    // shadowing well-known ones (e.g. "Pretty Woman" the 1990 film)
    const results = data.results ?? []
    const best = results
      .filter((r: { poster_path?: string }) => r.poster_path)
      .sort((a: { vote_count: number }, b: { vote_count: number }) => b.vote_count - a.vote_count)[0]
    return best?.poster_path ? `${TMDB_IMAGE_BASE}${best.poster_path}` : null
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

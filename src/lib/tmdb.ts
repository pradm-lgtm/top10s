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
  category: 'movies' | 'tv'
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || apiKey === 'your-tmdb-api-key') return null

  const type = category === 'movies' ? 'movie' : 'tv'
  const query = cleanTitle(title)

  try {
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&api_key=${apiKey}&page=1`,
      { next: { revalidate: 60 * 60 * 24 } } // cache for 24h
    )
    if (!res.ok) return null

    const data = await res.json()
    const posterPath = data.results?.[0]?.poster_path
    return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null
  } catch {
    return null
  }
}

export async function fetchPosters(
  entries: { id: string; title: string }[],
  category: 'movies' | 'tv'
): Promise<Record<string, string | null>> {
  const results = await Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      url: await fetchPoster(entry.title, category),
    }))
  )

  return Object.fromEntries(results.map((r) => [r.id, r.url]))
}

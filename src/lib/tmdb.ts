const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185'

export type PosterInfo = {
  poster: string | null
  imdbUrl: string | null
}

// Strip season/series qualifiers before searching, e.g.
// "The Bear (Season 2)" → "The Bear"
// "Shōgun (Season 1)" → "Shōgun"
function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(Season \d+\)/i, '')
    .replace(/\s*S\d+$/i, '')
    .trim()
}

async function searchTmdb(
  query: string,
  type: string,
  apiKey: string,
  yearParam: string
): Promise<{ poster: string | null; tmdbId: number | null }> {
  const res = await fetch(
    `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&api_key=${apiKey}&page=1${yearParam}`,
    { next: { revalidate: 60 * 60 * 24 } }
  )
  if (!res.ok) return { poster: null, tmdbId: null }
  const data = await res.json()
  const results = (data.results ?? []) as { poster_path?: string; vote_count: number; id: number }[]
  const best = results
    .filter((r) => r.poster_path)
    .sort((a, b) => b.vote_count - a.vote_count)[0]
  return {
    poster: best?.poster_path ? `${TMDB_IMAGE_BASE}${best.poster_path}` : null,
    tmdbId: best?.id ?? null,
  }
}

async function getImdbUrl(tmdbId: number, type: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `${TMDB_BASE}/${type}/${tmdbId}/external_ids?api_key=${apiKey}`,
    { next: { revalidate: 60 * 60 * 24 } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const imdbId = data.imdb_id as string | null
  return imdbId ? `https://www.imdb.com/title/${imdbId}` : null
}

export async function fetchPoster(
  title: string,
  category: 'movies' | 'tv',
  year?: number | null
): Promise<PosterInfo> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || apiKey === 'your-tmdb-api-key') return { poster: null, imdbUrl: null }

  const type = category === 'movies' ? 'movie' : 'tv'
  const query = cleanTitle(title)
  // For TV, first_air_date_year is the show's premiere year, not the season year,
  // so filtering by list year returns nothing for returning shows (e.g. Atlanta S4, The Bear S2).
  const yearParam = year && category === 'movies' ? `&primary_release_year=${year}` : ''

  try {
    let result = await searchTmdb(query, type, apiKey, yearParam)
    // If year-filtered search found nothing, retry without year —
    // handles films with different release years by country (e.g. Eye in the Sky 2015/2016)
    if (!result.poster && yearParam) {
      result = await searchTmdb(query, type, apiKey, '')
    }
    const imdbUrl = result.tmdbId ? await getImdbUrl(result.tmdbId, type, apiKey) : null
    return { poster: result.poster, imdbUrl }
  } catch {
    return { poster: null, imdbUrl: null }
  }
}

export async function fetchPosters(
  entries: { id: string; title: string }[],
  category: 'movies' | 'tv',
  year?: number | null
): Promise<Record<string, PosterInfo>> {
  const results = await Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      info: await fetchPoster(entry.title, category, year),
    }))
  )
  return Object.fromEntries(results.map((r) => [r.id, r.info]))
}

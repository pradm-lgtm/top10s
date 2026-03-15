export type Visitor = {
  id: string
  name: string
  created_at: string
}

export type List = {
  id: string
  title: string
  year: number | null
  category: 'movies' | 'tv'
  list_type: 'annual' | 'theme'
  list_format: 'ranked' | 'tiered' | 'tier-ranked'
  genre: string | null
  description: string | null
  created_at: string
}

export type ListEntry = {
  id: string
  list_id: string
  rank: number
  tier: string | null
  title: string
  notes: string | null
  image_url: string | null
  created_at: string
}

export type Comment = {
  id: string
  list_id: string
  visitor_id: string
  content: string
  created_at: string
  visitors?: { name: string }
}

export type Reaction = {
  id: string
  list_id: string
  visitor_id: string
  emoji: string
  created_at: string
}

export type ReactionCount = {
  emoji: string
  count: number
  reacted: boolean
}

export type HonorableMention = {
  id: string
  list_id: string
  title: string
  created_at: string
}

export type AlsoWatched = {
  id: string
  list_id: string
  title: string
  created_at: string
}

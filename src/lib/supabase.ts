import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
    }
    _client = createClient(url, key)
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Database = {
  public: {
    Tables: {
      visitors: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
      }
      lists: {
        Row: {
          id: string
          title: string
          year: number
          category: 'movies' | 'tv'
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          year: number
          category: 'movies' | 'tv'
          description?: string | null
          created_at?: string
        }
      }
      list_entries: {
        Row: {
          id: string
          list_id: string
          rank: number
          title: string
          notes: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          rank: number
          title: string
          notes?: string | null
          image_url?: string | null
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          list_id: string
          visitor_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          visitor_id: string
          content: string
          created_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          list_id: string
          visitor_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          visitor_id: string
          emoji: string
          created_at?: string
        }
      }
    }
  }
}

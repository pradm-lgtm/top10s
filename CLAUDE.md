# CLAUDE.md — Ranked

Read this file at the start of every session before making any changes.
Check .claude/project-plans/ to understand what's been done and what's next.

---

## What is Ranked

A platform for opinionated film & TV lists with rich commentary.
The core insight: we consume more art and media than ever — films, TV, 
music, books — but rarely stop to articulate what we actually think.
Ranked is where your taste becomes a statement: opinionated, structured, 
and worth more than a quick reaction.

Tagline: "Your take. Ranked."

Target user: people with strong opinions on film/TV who want to share
deeper takes than a star rating or a group chat message allows.

Live at: top10s.vercel.app
Repo: github.com/pradm-lgtm/top10lists
Admin: top10s.vercel.app/admin/login

---

## What Ranked is NOT
- Not a logging app (not everything you've watched)
- Not a review aggregator
- Not a place for snark or shallow takes
- Not a place to rank anything (focused on film/TV/art)

---

## Key Differentiators
1. Lists over logs — ranking forces an opinion, no hiding behind ratings
2. TV as first-class citizen — not an afterthought like on Letterboxd
3. Depth rewarded — commentary is front and center, feed surfaces richer 
   takes over shallow ones
4. Side by side comparisons — your list vs friends vs IMDB (key flywheel)
5. Taste as identity — rankings build a profile that says something real

---

## Desired Flywheel
Side by side comparisons shared on social media → people visit to see 
their friends' lists → they stay for the deeper takes → they create their 
own lists → they share comparisons → repeat.

---

## Project Planning

Phase plans live in `.claude/project-plans/` as markdown files named
`phase-N-short-description.md`.

### Frontmatter schema
```yaml
---
phase: <int>
title: "<string>"
status: draft | in-progress | complete | blocked
depends_on: <phase int> | null
priority: high | medium | low
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

### Sections in each plan
- **Goal** — what this phase delivers
- **Tasks** — checkbox list, update as you go
- **Testing** — specific things to verify on mobile AND desktop
- **Decisions** — log of decisions made with rationale
- **Notes** — anything worth preserving

---

## Stack & Versions

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Database | Supabase (Postgres) | supabase-js 2.99.1 |
| Auth | Supabase Auth (Google OAuth) | @supabase/ssr 0.9.0 |
| Rich text | Tiptap | 3.20.4 |
| Drag/drop | dnd-kit | core 6.3.1, sortable 10.0.0 |
| Movie data | TMDB API | via NEXT_PUBLIC_TMDB_API_KEY |
| AI - quality | Anthropic Claude | @anthropic-ai/sdk 0.79.0 |
| AI - transcription | OpenAI Whisper | direct fetch |
| Hosting | Vercel | auto-deploy from main branch |

---

## Running Locally
```bash
npm run dev      # starts at localhost:3099
npm run build    # check for TS errors before deploying
```

Always run `npm run build` locally before pushing — Vercel will fail 
if there are TypeScript errors.

---

## Project Structure
```
src/
  app/
    /                  # Landing page
    /home              # Home feed (all users' lists)
    /[username]        # User profile page
    /create            # List creation wizard
    /list/[id]         # List detail page
    /admin/login       # Admin login (secret, only Prad knows)
    /auth/callback     # OAuth callback
    /api/
      /claude/suggest  # Generate movie/TV suggestions
      /claude/refine   # Reorder suggestions by relevance
      /claude/import   # Parse pasted list text
      /claude/transcribe # Clean up Whisper transcripts
      /transcribe      # Audio → Whisper → text
  components/
    AdminBar.tsx        # Admin editing UI overlay
    AppHeader.tsx       # Top nav
    EditableText.tsx    # Inline editable fields (admin mode)
    EntryDrawer.tsx     # Slide-in entry detail + comments
    NavAuth.tsx         # Auth state in nav
    OnboardingModal.tsx # Name capture for visitors
    RichTextEditor.tsx  # Tiptap editor component
    ThoughtCloud.tsx    # TMDB suggestion grid
    VoiceMicButton.tsx  # MediaRecorder + Whisper voice input
  context/
    auth.tsx            # Supabase OAuth/Google auth context
    admin.tsx           # Admin mode context
  lib/
    admin-auth.ts       # Admin token logic (SHA256 of password)
    notes.ts            # Tiptap JSON ↔ plain text ↔ HTML
    supabase-admin.ts   # Admin Supabase client (service role)
    supabase.ts         # Client Supabase client (anon, lazy singleton)
    tmdb.ts             # TMDB API helpers
```

Path alias: `@/` → `src/`. Use consistently.

---

## Database Schema

| Table | Key Columns |
|-------|-------------|
| visitors | id, name, created_at |
| lists | id, title, year, category ('movies'\|'tv'), list_type ('annual'\|'theme'), list_format ('ranked'\|'tiered'\|'tier-ranked'), genre, description, owner_id, created_at |
| list_entries | id, list_id, rank, tier_id (FK→tiers), tier (legacy string), title, notes, image_url, created_at |
| tiers | id, list_id, label, color, position, created_at |
| comments | id, list_id, visitor_id, content, created_at |
| reactions | id, list_id, visitor_id, emoji, created_at |
| entry_comments | id, list_entry_id, visitor_id, content, created_at |
| entry_reactions | id, list_entry_id, visitor_id, emoji, created_at |
| profiles | id, username, display_name, avatar_url, created_at |
| honorable_mentions | id, list_id, title, created_at |
| also_watched | id, list_id, title, created_at |

**Important:** list_entries has both `tier_id` (FK to tiers table) and 
`tier` (legacy plain string). Both are actively used — don't remove either.

No migration files — schema is managed via Supabase dashboard only.

---

## Environment Variables
```
# Client-exposed (NEXT_PUBLIC_)
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TMDB_API_KEY

# Server-only
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
ADMIN_PASSWORD
```

---

## AI Usage

### Anthropic (Claude)
| Route | Model | Purpose |
|-------|-------|---------|
| /api/claude/suggest | haiku for speed, sonnet for quality | Generate movie/TV title suggestions |
| /api/claude/refine | claude-opus-4-6 | Reorder suggestions by relevance |
| /api/claude/import | claude-haiku-4-5-20251001 | Parse pasted list text |
| /api/claude/transcribe | claude-haiku-4-5-20251001 | Clean up Whisper transcripts |

### OpenAI
| Route | Model | Purpose |
|-------|-------|---------|
| /api/transcribe | whisper-1 | Audio-to-text transcription |

### AI Cost Controls
- Use Haiku for: adaptive suggestions, refine bar, import parsing, 
  voice cleanup
- Use Sonnet for: initial suggestion generation where quality matters
- Cap adaptive suggestion updates at 3 per list creation session
- Debounce adaptive calls — only fire after 3 seconds of inactivity
- Always handle Claude API failures gracefully with fallbacks

---

## Key Code Conventions

1. **Data fetching**: Public pages (list detail, profile) fetched 
   server-side via admin Supabase client. Client-side mutations use 
   `fetch()` to API routes with Bearer token from Supabase session.

2. **Auth pattern**: User API routes validate Supabase Bearer token 
   via Authorization header. Admin routes validate an httpOnly 
   `admin_token` cookie (SHA256 of password).

3. **Rich text**: Entry notes and list descriptions stored as Tiptap 
   JSON (stringified). Use `src/lib/notes.ts` for all parsing and 
   HTML rendering — never parse Tiptap JSON directly in components.

4. **Selects**: Never use `select('*')` on large tables. Always specify 
   columns explicitly.

5. **Mobile first**: Test every UI change at 390px width. Use bottom 
   sheets for mobile interactions, not modals.

6. **No tests**: No test framework is set up. Manually test happy path 
   and error states before marking phases complete.

7. **React Compiler**: Enabled (`reactCompiler: true` in next.config.ts).

---

## Before Marking Any Phase Complete
- [ ] Test on mobile (390px) AND desktop
- [ ] Test happy path AND empty/error states
- [ ] Confirm existing functionality still works
- [ ] Run `npm run build` — zero TypeScript errors
- [ ] Push to main and verify Vercel deployment succeeds
```

# CLAUDE.md — Ranked

Read this file at the start of every session before making any changes.
Check .claude/project-plans/ to understand what's been done and what's next.

---

## What is Ranked
Opinionated film & TV list platform. Tagline: "Your take. Ranked."
Live: rankedhq.app | Repo: github.com/pradm-lgtm/top10lists | Admin: rankedhq.app/admin/login

---

## Project Planning
Phase plans live in `.claude/project-plans/` as `phase-N-short-description.md`.

**Session start:** Read only the frontmatter of all phase files to get project status. Only read the full content of the active phase file when explicitly working on that phase.

Frontmatter fields: `phase`, `title`, `status` (draft|in-progress|complete|blocked), `depends_on`, `priority`, `created`, `updated`

Each plan has sections: Goal, Tasks (checkboxes), Testing, Decisions, Notes.

---

## Stack
Next.js · TypeScript · React · Tailwind CSS 4.x · Supabase (Postgres + Auth) · Tiptap · dnd-kit · TMDB API · Anthropic Claude · OpenAI Whisper · Vercel

---

## Running Locally
```bash
npm run dev      # localhost:3099
npm run build    # always run before pushing — Vercel fails on TS errors
```

---

## Database Schema

| Table | Key Columns |
|-------|-------------|
| visitors | id, name, created_at |
| lists | id, title, year, category ('movies'\|'tv'), list_type, list_format ('ranked'\|'tiered'\|'tier-ranked'), genre, description, owner_id, topic_id, created_at |
| list_entries | id, list_id, rank, tier_id (FK→tiers), tier (legacy string), title, notes, image_url, created_at |
| tiers | id, list_id, label, color, position, created_at |
| comments | id, list_id, visitor_id, content, created_at |
| reactions | id, list_id, visitor_id, emoji, created_at |
| entry_comments | id, list_entry_id, visitor_id, content, created_at |
| entry_reactions | id, list_entry_id, visitor_id, emoji, created_at |
| profiles | id, username, display_name, avatar_url, created_at |
| honorable_mentions | id, list_id, title, created_at |
| also_watched | id, list_id, title, created_at |
| topics | id, slug, title, category, cluster_id, created_at |
| invites | id, token, topic_id, sender_id, sender_list_id, message, accepted_at |
| follows | id, follower_id, following_id, created_at |
| notifications | id, user_id, type, actor_id, list_id, comment_id, read, created_at |
| weekly_prompt_cache | id, prompt_week, prompt_text, suggestions, created_at |

**Important:** list_entries has both `tier_id` (FK to tiers) and `tier` (legacy string). Both active — don't remove either.
No migration files — schema is managed via Supabase dashboard only.

---

## Environment Variables
```
NEXT_PUBLIC_SITE_URL  NEXT_PUBLIC_SUPABASE_URL  NEXT_PUBLIC_SUPABASE_ANON_KEY  NEXT_PUBLIC_TMDB_API_KEY
SUPABASE_SERVICE_ROLE_KEY  ANTHROPIC_API_KEY  OPENAI_API_KEY  ADMIN_PASSWORD
```

---

## AI Cost Controls
- Haiku for: suggestions, refine bar, import parsing, voice cleanup
- Sonnet for: initial suggestion generation where quality matters
- Cap adaptive suggestions at 3 per session; debounce 3s of inactivity
- Always handle Claude API failures gracefully with fallbacks

---

## Key Code Conventions

1. **Data fetching**: Public pages fetched server-side via admin Supabase client. Client-side mutations use `fetch()` to API routes with Bearer token from Supabase session.
2. **Auth**: User routes validate Supabase Bearer token via Authorization header. Admin routes validate `admin_token` cookie (SHA256 of password).
3. **Rich text**: Stored as Tiptap JSON. Use `src/lib/notes.ts` for all parsing/rendering — never parse Tiptap JSON directly in components.
4. **Selects**: Never `select('*')` on large tables. Specify columns explicitly.
5. **Mobile first**: Test at 390px. Use bottom sheets, not modals.
6. **No tests**: Manually test happy path and error states.
7. **React Compiler**: Enabled (`reactCompiler: true` in next.config.ts).
8. **Path alias**: `@/` → `src/`. Use consistently.

---

## Before Marking Any Phase Complete
- [ ] Test on mobile (390px) AND desktop
- [ ] Test happy path AND empty/error states
- [ ] Run `npm run build` — zero TypeScript errors
- [ ] Push to main and verify Vercel deployment succeeds

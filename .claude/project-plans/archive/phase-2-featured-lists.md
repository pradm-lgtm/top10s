---
phase: 2
title: "Strangers — Featured & Objective Lists"
status: in-progress
depends_on: "1"
priority: high
created: 2026-03-23
updated: 2026-03-23
---

## Goal
Seed the platform with high-quality editorial lists that give strangers
something to engage with immediately — before the community has enough
user lists. "Compare your taste to Obama's" or "See how you stack up
against IMDB's top 250" is the hook.

These are NOT user accounts. They are a distinct editorial list type
that looks curated and authoritative, not like a regular user profile.

## Tasks

### Database
- [x] Add a featured boolean column to lists table (default false)
- [x] Add a source_label text column to lists (e.g. "IMDB", "Barack Obama",
      "AFI", "Academy Awards")
- [x] Add a source_url text column (link to original list)

### Editorial list type UI
- [x] On home page, add a "Featured Lists" section above All Time
- [x] Featured list cards look distinct — show source label badge
      (e.g. "IMDB Top 250") instead of a user avatar
- [x] On list detail page, featured lists show a source attribution
      line with link to original ("Source: IMDB Top 250")
- [x] Featured lists are read-only — no edit mode, no admin controls

### Seed the following lists via admin:
- [ ] IMDB Top 250 Movies (top 25 as a ranked list)
- [ ] AFI 100 Greatest Movies
- [ ] Academy Award Best Picture winners (all time, tiered by decade)
- [ ] Barack Obama's favourite movies (his annual lists)

### Admin tooling
- [x] Add ability to mark any list as featured from admin mode
- [x] Add source_label and source_url fields to admin edit mode

## Testing
- [ ] Featured Lists section appears at top of home page
- [ ] Featured list cards show source badge, not user avatar
- [ ] List detail page for featured list shows source attribution
- [ ] No edit controls visible on featured lists for any user including admin
- [ ] IMDB Top 250 list loads with correct posters from TMDB
- [ ] Tested on mobile and desktop
- [ ] npm run build passes with zero errors

## Decisions
Editorial lists are the right approach over fake user accounts — more
honest, more authoritative, and avoids confusion with real user profiles.

## Notes
Obama's movie lists are publicly available from his annual roundups.
IMDB Top 250 is publicly available at imdb.com/chart/top.
AFI 100 is at afi.com/afis-10-top-10.
All can be manually entered — no scraping needed at this stage.
---
phase: 0a
title: "Friends & Family — Bug Fixes"
status: complete
depends_on: null
priority: high
created: 2026-03-23
updated: 2026-03-23
completed: 2026-03-23
---

## Goal
Fix the quick bugs blocking a polished friends & family experience.
These are all small, low-risk changes that should take less than a day.

## Tasks
- [x] Remove "by prad" showing incorrectly on landing page
- [x] Flip TV Shows and Movies order on home page (TV first)
- [x] Collapse long entry descriptions by default — show first 2 lines
      with "read more" expand. Collapse back with "show less".
- [x] Home feed algorithm — surface lists with more commentary/reactions
      higher, ensure new lists from friends appear in correct sections
      (not just Recently Added), fix any lists missing from home page
- [x] Change ranked list UI to show more movies on screen (reduce
      poster size or switch to compact list view option)


## Testing
- [ ] Landing page shows no "by prad" reference
- [ ] Home page shows TV Shows section before Movies section
- [ ] All fixes tested on mobile (390px) AND desktop
- [ ] Long descriptions collapse to 2 lines with "read more" on both 
      mobile and desktop
- [ ] A newly created list by any user appears in the correct home page 
      section (All Time or correct year) within 1 minute
- [ ] Home feed visually prioritises lists with descriptions over empty ones
- [ ] Ranked list creation shows more posters visible without scrolling
- [ ] npm run build passes with zero errors

## Decisions

## Notes
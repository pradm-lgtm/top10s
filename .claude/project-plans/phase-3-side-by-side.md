---
phase: 3
title: "Strangers — Side by Side Comparisons"
status: in-progress
depends_on: "2"
priority: high
created: 2026-03-23
updated: 2026-03-23
---

## Goal
The primary social hook for the strangers campaign. Users compare their
list against a friend's list or a featured list (IMDB, Obama) and share
the result. "I agreed with Obama on 4/10" is inherently shareable.

## Tasks

### Comparison UI
- [ ] Add a "Compare" button on every list detail page
- [ ] Compare flow: pick any other list of the same category to compare 
      against (search by user or pick from featured lists)
- [ ] Side by side view shows both lists in two columns:
      - Left: current list, Right: comparison list
      - Matching entries highlighted (appears on both lists)
      - Unique entries shown in muted style
      - Overlap score shown at top: "You agree on X/Y titles"
- [ ] Mobile: stack vertically with toggle to switch between lists, 
      overlap score prominent at top
- [ ] Desktop: true side by side columns

### Shareable comparison card
- [ ] "Share comparison" button generates an OG image showing:
      - Both list owner names/labels
      - Overlap score ("4 titles in common")
      - Matching titles listed
      - Ranked branding
- [ ] Shareable URL: /compare/[list-id-1]/[list-id-2]
- [ ] The /compare route has its own OG meta tags

### Featured list comparisons
- [ ] "Compare to IMDB Top 250" shortcut on any movies list
- [ ] "Compare to Obama's list" shortcut where relevant

## Testing
- [ ] Can compare any two lists of same category
- [ ] Overlap score calculates correctly (exact title match)
- [ ] Matching entries visually highlighted on both sides
- [ ] Share button generates a working shareable URL
- [ ] Pasting compare URL into Twitter/iMessage shows rich card
- [ ] Works on mobile (390px) — readable without horizontal scroll
- [ ] Featured list comparison shortcuts work
- [ ] npm run build passes with zero errors

## Decisions

## Notes
Title matching should be case-insensitive and strip articles 
("The", "A", "An") for better fuzzy matching.
Consider using TMDB ID matching instead of title string matching
for accuracy — entries already have TMDB data attached.
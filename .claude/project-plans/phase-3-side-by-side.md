---
phase: 3
title: "Strangers — Side by Side Comparisons"
status: in-progress
depends_on: "2"
priority: high
created: 2026-03-23
updated: 2026-03-25
---

## Goal
The primary social hook for the strangers campaign. Users compare their
list against a friend's list or a featured list (IMDB, Obama) and share
the result. "I agreed with Obama on 4/10" is inherently shareable.

## Tasks

### Comparison UI
- [x] Add a "Compare" button on every list detail page
- [x] Compare flow: pick any other list of the same category to compare
      against (search by title)
- [x] Side by side view shows both lists in two columns:
      - Left: current list, Right: comparison list
      - Matching entries highlighted (appears on both lists)
      - Unique entries shown in muted style
      - Overlap score shown at top with matched title chips
- [x] Mobile: stacked with tab toggle to switch between lists
- [x] Desktop: true side by side columns
- [ ] Show tier labels on entries for tiered/tier-ranked lists
      (replace rank "0" with the tier name for tiered-only lists)
- [ ] Swap control: "× Remove" button on each list header in compare view
      allows replacing that list with a different one via the picker sheet

### Shareable comparison card
- [ ] OG image for /compare/[id1]/[id2] route showing:
      - Both list owner names
      - "X titles in common" count
      - Two stacked poster thumbnail columns (one per list, partial overlap)
      - Matched titles listed below
      - Ranked branding
- [x] Shareable URL: /compare/[list-id-1]/[list-id-2]
- [x] The /compare route has its own OG meta tags (title + description)
- [ ] "Titles in common" section shows poster thumbnails for matched entries

### Featured list comparisons
- [ ] "Compare to IMDB Top 250" shortcut on any movies list
- [ ] "Compare to Obama's list" shortcut where relevant

## Testing
- [ ] Can compare any two lists of same category
- [ ] Overlap score calculates correctly (case-insensitive, strips The/A/An)
- [ ] Tiered list entries show tier name instead of rank 0
- [ ] Tier-ranked entries show both tier name and rank number
- [ ] Matching entries highlighted in gold on both sides
- [ ] "Titles in common" chips show poster thumbnails
- [ ] Swap control: clicking × on a list header opens picker to replace it
- [ ] After swap, URL updates to /compare/[newId1]/[newId2]
- [ ] Share button opens native share sheet or copies URL
- [ ] Pasting /compare URL into iMessage/Twitter shows rich OG card
- [ ] OG image renders: two poster stacks + overlap count
- [ ] Works on mobile (390px) — readable without horizontal scroll
- [ ] npm run build passes with zero errors

## Decisions
- Title matching: case-insensitive + strip leading articles (The/A/An)
  and punctuation. Simple enough, avoids TMDB ID dependency.
- Tier display: fetch tiers for both lists on the compare page.
  For tiered entries (no rank), show tier label badge instead of rank number.

## Notes
Title matching should be case-insensitive and strip articles
("The", "A", "An") for better fuzzy matching.
Consider using TMDB ID matching instead of title string matching
for accuracy — entries already have TMDB data attached.

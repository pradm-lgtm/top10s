---
phase: 1
title: "Strangers — Social Sharing Cards"
status: in-progress
depends_on: "0a"
priority: high
created: 2026-03-23
updated: 2026-03-23
---

## Goal
Make every list shareable on social media with a rich preview card.
This is the primary mechanic for the strangers campaign — people share
their list on Instagram/Twitter/Reddit and the card does the work of
making people want to click.

## Tasks
- [x] Add Open Graph meta tags to every list detail page (/list/[id])
      - og:title → list title + owner name
      - og:description → first 3 entries + entry count
      - og:image → dynamically generated card image
- [x] Build dynamic OG image generation using Next.js ImageResponse
      (app/api/og/route.tsx) — card shows:
      - Ranked logo/wordmark
      - List title and owner name + avatar
      - Top 3 poster thumbnails
      - Entry count and list format (ranked/tiered)
      - Dark cinematic design matching the site
- [x] Add Open Graph tags to user profile pages (/[username])
- [x] Add Twitter/X card meta tags alongside OG tags
- [ ] Test sharing flow: copy link → paste into iMessage, Twitter,
      Reddit, WhatsApp → confirm card preview appears correctly
- [x] Add a "Share" button on list detail pages that copies the URL
      with a "Copied!" confirmation
- [ ] The 'Share' button should open a share card asking which medium they want to share to (Instagram, FB, Twitter, Messages etc) and it should also show a preview of what the share will look like from the share card. 

## Testing
- [ ] Paste a list URL into Twitter composer — rich card appears
- [ ] Paste a list URL into iMessage — preview appears
- [ ] Paste into Reddit — card appears
- [ ] OG image loads in under 2 seconds
- [ ] Card looks good for: short list titles, long list titles, 
      lists with no posters (fallback)
- [ ] Share button works on mobile and desktop
- [ ] npm run build passes with zero errors

## Decisions

## Notes
Use Next.js built-in ImageResponse for OG image generation — no external
service needed. Vercel serves these automatically.
TMDB poster images may have CORS restrictions for server-side rendering —
may need to proxy them through an API route.
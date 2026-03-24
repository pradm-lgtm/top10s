---
phase: 4
title: "Strangers — Domain, URL & Pre-launch"
status: draft
depends_on: "3"
priority: high
created: 2026-03-23
updated: 2026-03-23
---

## Goal
Get the site looking and feeling launch-ready for strangers. Clean URL,
professional branding, and a pre-launch checklist per audience.

## Tasks

### Domain
- [ ] Purchase new domain (decision pending — ranked.tv, rankd.tv, 
      or getrankd.com)
- [ ] Connect custom domain in Vercel (Settings → Domains)
- [ ] Update NEXT_PUBLIC_SITE_URL env variable in Vercel
- [ ] Verify all OG image URLs and share links use new domain
- [ ] Set up redirect from top10s.vercel.app → new domain

### URL cleanup
- [ ] Audit all hardcoded URLs in codebase and update to use 
      NEXT_PUBLIC_SITE_URL
- [ ] Ensure /list/[id] URLs are clean and shareable

### Pre-launch checklist per audience
- [ ] Reely communities checklist:
      - Which subreddits/communities to post in
      - Post format and hook copy
      - Which featured lists are most relevant
- [ ] Bollywood/Indian film audience checklist:
      - Seed 2-3 Bollywood featured lists before posting
      - Hindi language suggestion support confirmed working
- [ ] General launch checklist:
      - All Milestone 0 bugs confirmed fixed
      - Featured lists seeded and looking good
      - Social sharing cards tested across platforms
      - Side by side comparisons working
      - Mobile experience polished

## Testing
- [ ] New domain loads correctly
- [ ] top10s.vercel.app redirects to new domain
- [ ] All share links use new domain
- [ ] OG cards show correct new domain URL
- [ ] Site loads fast on mobile (test on real device, not simulator)
- [ ] npm run build passes with zero errors

## Decisions

## Notes
Buy domain before starting this phase so there's no delay at the end.
Vercel domain connection usually takes < 1 hour to propagate.
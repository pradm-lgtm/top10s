---
phase: 8
title: "Challenges — Invite, Topic Pages & Social Feed"
status: draft
depends_on: 7
priority: high
created: 2026-03-27
updated: 2026-03-27
---

## Goal
Build the core viral loop for Ranked. Anyone can challenge 
anyone to make a list on a given topic — existing users or 
complete strangers. The challenge link lands them in a 
frictionless list creation flow, and the topic page becomes 
a social hub where everyone's answers live side by side with 
inline comments. This is the hook that gets people sharing 
and coming back.

---

## Phase 8a — Core Challenge Loop

### DATABASE:
- [ ] Create topics table:
      id (uuid), slug (text unique), title (text), 
      category ('movies'|'tv'|'any'), created_by (uuid nullable),
      created_at
- [ ] Create topic_clusters table:
      id (uuid), name (text), description (text), created_at
- [ ] Add cluster_id (uuid nullable) to topics table
- [ ] Add topic_id (uuid nullable) to lists table
- [ ] Create challenge_invites table:
      id (uuid), topic_id (uuid), sender_id (uuid nullable),
      recipient_identifier (text — email or username),
      token (text unique — for shareable links),
      accepted_at (timestamptz nullable), created_at
- [ ] Create anonymous_sessions table:
      id (uuid), token (text unique), created_at,
      upgraded_to_user_id (uuid nullable)
- [ ] Give me all SQL to run in Supabase SQL Editor
- [ ] Add indexes: topics(slug), lists(topic_id), 
      challenge_invites(token), topic_clusters(id)

### TOPIC ID SYSTEM:
- [ ] When a list is created via a challenge invite, 
      automatically set topic_id on the new list
- [ ] When a list is created via the weekly prompt, 
      automatically set topic_id linking to that week's prompt
- [ ] When a user manually creates a list, optionally 
      match to an existing topic via Claude API:
      * After publish, send the list title to 
        claude-haiku-4-5-20251001 with existing topic titles
      * Ask: "Does this list title match any of these topics? 
        Return the matching topic slug or null."
      * If match found with >80% confidence, assign topic_id
      * Never assign automatically below that threshold

### TOPIC CLUSTERING:
- [ ] topic_clusters groups related topic_ids together
      e.g. cluster "tv-comedies" contains:
      "top-5-tv-comedies", "top-10-tv-comedies", 
      "best-tv-comedies-ever" etc.
- [ ] When a new topic is created, Claude suggests a 
      cluster match — admin confirms before assigning
- [ ] Topic page shows all lists in the same cluster 
      (not just exact topic match) with a note like 
      "Showing all Top TV Comedy lists"
- [ ] Build a simple admin UI at /admin/topics to:
      * View all topics and their cluster assignments
      * Create new clusters
      * Manually assign topics to clusters
      * Merge duplicate topics

### ANONYMOUS SESSION (GUEST FLOW):
- [ ] When a non-logged-in user arrives via challenge link:
      * Generate an anonymous session token (UUID)
      * Store in localStorage and as a cookie
      * Allow them to complete the full list creation flow
      * Show a subtle "Save your list" banner at the top 
        (not a blocking modal) throughout the flow
- [ ] When guest taps "Save your list" or tries to publish:
      * Show Google sign-in option
      * After sign-in, migrate their in-progress list 
        to the new account using the anonymous session token
      * Upgrade anonymous_sessions row with upgraded_to_user_id
- [ ] If guest closes without saving: list is lost — 
      that's acceptable, no need to persist indefinitely
- [ ] Anonymous users can browse and create but cannot 
      comment or react without signing in

### CHALLENGE INVITE MECHANIC:
- [ ] "Challenge a friend" button on every list detail page 
      and on the topic page
- [ ] Challenge flow:
      * Step 1: Pick a topic (pre-filled if on a list page)
      * Step 2: Optional message ("I bet you can't beat my 
        list 😏")
      * Step 3: Generate a shareable link with a unique token
        Format: rankedhq.app/challenge/[token]
      * Copy link button + native share sheet on mobile
- [ ] Anyone can create a challenge — you don't need to 
      have made the list yourself
- [ ] Challenge link landing page (/challenge/[token]):
      * Shows the challenger's name + optional message
      * Shows the topic title prominently
      * If challenger has made this list: shows their 
        list as a teaser (top 3 entries, blurred/semi-opaque)
        with "See their full list after you make yours"
      * Big CTA: "Make your [Topic Title] list →"
      * Tapping CTA goes to list creation wizard with:
        - Topic title pre-filled
        - Same format as challenger's list (if available)
        - Same category pre-selected
        - Topic suggestions loaded (same as weekly prompt)
        - topic_id set on publish
      * Works for logged-in users AND guests (anonymous session)

### CHALLENGE OG IMAGE (share preview):
- [ ] New OG image route: /api/og/challenge?token=[token]
- [ ] Layout:
      * Background: semi-opaque poster collage from 
        topic suggestions (same as home page OG)
      * Dark overlay
      * "[Name] challenged you to rank:" in muted text (18px)
      * Topic title large and bold (40px, white)
      * If challenger has a list: show their top 3 poster 
        thumbnails stacked/fanned
      * "Can you beat them? →" in gold at bottom
      * Ranked logo top left
- [ ] Set as og:image on /challenge/[token] page
- [ ] This preview should work in iMessage, WhatsApp, 
      Twitter/X

### TOPIC PAGE (/topic/[slug]):
- [ ] URL: /topic/[slug] — e.g. /topic/top-5-tv-comedies
- [ ] Page header:
      * Topic title large at top
      * Entry count: "X people have ranked this"
      * "Challenge a friend" button top right
      * Filter/sort pills: "Most Recent" | "Most Reactions" | 
        "Friends" (if logged in and following people)
- [ ] Main content: grid of list cards, each showing:
      * Owner avatar + name
      * Top 3 poster thumbnails
      * Reaction count + comment count
      * On TAP: card expands inline (does not navigate away)
        showing the full list + inline comments (see below)
      * A subtle "Compare →" button appears on expand
- [ ] EXPANDED CARD (tap to expand):
      * Full list entries visible in compact format
        (rank number + poster thumbnail + title per row)
      * Below entries: inline comment thread
        - Existing comments shown (newest first, max 3 visible)
        - "Show X more comments" expands inline
        - Text input at bottom: "Add your take..."
        - Post button — requires sign-in, prompts if not
      * Collapse button at top right of expanded card
      * Smooth expand/collapse animation
- [ ] If cluster has related topics: show "Also see: 
      [related topic titles]" as pills at top
- [ ] Empty state: show the weekly prompt card for this 
      topic with suggestions, invite friends CTA

### NAVIGATION IMPROVEMENTS:
- [ ] Move the feed filter pills (All/Prompt/Editorial/
      Recently Added/By Year) to a sticky bottom bar 
      on mobile — like a tab bar, always visible
- [ ] On desktop: keep pills at top of feed as they are
- [ ] Bottom tab bar on mobile should have:
      Home | This Week | Search | My Lists | Profile
      (replace current top nav items with bottom nav)

---

## Phase 8b — Search, Tagging & Polish

### SEARCH:
- [ ] Global search bar accessible from nav (magnifying 
      glass icon)
- [ ] Search covers: list titles, topic titles, usernames
- [ ] Search results page (/search?q=[query]):
      * Tab bar: "Lists" | "Topics" | "People"
      * Lists tab: matching lists with filter/sort options:
        - Filter: Movies / TV Shows / All
        - Filter: Year (dropdown)
        - Filter: Format (Ranked / Tiered / All)
        - Sort: Most Recent / Most Reactions / Most Comments
      * Topics tab: matching topic pages with entry counts
      * People tab: matching user profiles
- [ ] Search uses Supabase full-text search (to_tsvector) 
      on list titles and topic titles
- [ ] Add GIN indexes for full-text search:
      CREATE INDEX idx_lists_title_fts ON lists 
      USING gin(to_tsvector('english', title));
      CREATE INDEX idx_topics_title_fts ON topics 
      USING gin(to_tsvector('english', title));

### @TAGGING IN COMMENTS:
- [ ] In all comment inputs (list comments, entry comments, 
      topic page inline comments), support @username mentions
- [ ] As user types @, show a dropdown of matching usernames 
      from profiles table
- [ ] Tagged usernames are highlighted in gold in the 
      rendered comment
- [ ] When a comment containing @username is posted, 
      create a notification for the tagged user:
      type: 'mention', with the comment and list reference
- [ ] Notification copy: "[Name] mentioned you in a comment 
      on [List Title]"

### ICON TOOLTIPS ON LIST ACTIONS:
- [ ] The compare / fork / share icon row on list detail page
- [ ] Desktop: show tooltip on hover with action name
      ("Compare lists", "Make your version", "Share")
- [ ] Mobile: on first visit to any list page, show a 
      one-time tooltip coach mark that labels each icon
      Store dismissal in localStorage
- [ ] Consider adding short text labels below icons on 
      mobile permanently (8px, muted) since hover doesn't 
      exist on mobile:
      "Compare" | "Your version" | "Share"

---

## Testing

### Phase 8a:
- [ ] Challenge link generates correctly and is copyable
- [ ] Visiting /challenge/[token] on desktop shows correct 
      OG preview in Facebook debugger
- [ ] Visiting /challenge/[token] as logged-out user shows 
      guest flow, can complete list creation
- [ ] Guest list migrates correctly to account after sign-in
- [ ] Published list via challenge has correct topic_id set
- [ ] Topic page /topic/[slug] loads all lists for that topic
- [ ] Tap to expand on topic page shows full list + comments
- [ ] Inline comment posts correctly from topic page
- [ ] Challenge OG image renders correctly as PNG at 
      /api/og/challenge?token=[token]
- [ ] iMessage preview shows correctly for challenge link
- [ ] Bottom tab bar visible on mobile, sticky at bottom
- [ ] Admin topics page loads at /admin/topics
- [ ] Topic cluster assignment works in admin UI
- [ ] Anonymous session token generated on challenge landing
- [ ] "Save your list" banner appears throughout guest flow

### Phase 8b:
- [ ] Search returns relevant results for list titles
- [ ] Search filters work (Movies/TV, year, format)
- [ ] @username dropdown appears when typing @ in comments
- [ ] Tagged user receives notification
- [ ] @username renders in gold in posted comment
- [ ] Icon tooltips appear on hover (desktop)
- [ ] Coach marks appear on first mobile visit, dismiss correctly
- [ ] Short text labels under icons readable on mobile

### General:
- [ ] All flows tested on mobile (390px) AND desktop
- [ ] npm run build passes with zero TypeScript errors
- [ ] No existing functionality broken

---

## Decisions

Guest-first flow (option 2 — anonymous session): new users 
arriving via challenge link can make their list immediately 
without signing in. Account creation is prompted at save/publish 
time. Anonymous session upgrades to real account on sign-in.

Anyone can create a challenge — not just list owners. Makes 
the mechanic more viral and social.

Tap-to-expand on topic page (not hover) — hover doesn't exist 
on mobile. Tap expands the card inline without navigating away.

Topic clustering is manual with AI suggestions — keeps quality 
high. Claude proposes cluster matches, admin confirms.

Phase 8b ships together with 8a in one deploy — search and 
tagging are table stakes for the social features to work well.

---

## Notes

The challenge invite is the primary viral mechanic for Ranked. 
Every list becomes a potential entry point for new users. 
The OG image for challenge links needs to be compelling enough 
that people actually tap through from iMessage/WhatsApp.

The topic page is the social hub — it's where the "parking lot 
conversation" actually happens. The inline expand + comment 
pattern (inspired by Reddit) keeps users on one page rather 
than navigating away, which increases the chance of them 
engaging with multiple lists.

The bottom tab bar on mobile is a significant UX improvement — 
the current top-only navigation is hard to reach on large phones.

Weekly prompt topic_ids should be pre-created each Monday 
as part of the prompt rotation logic built in Phase 6.
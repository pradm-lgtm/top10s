---
phase: 8
title: "Invites — Topic Pages & Social Feed"
status: in-progress
depends_on: 7
priority: high
created: 2026-03-27
updated: 2026-03-30
---

## Goal
Build the core viral loop for Ranked. Anyone can invite
anyone to share their take on a given topic — existing users
or complete strangers. The invite link lands them in a
frictionless list creation flow, and the topic page becomes
a social hub where everyone's answers live side by side with
inline comments. This is the hook that gets people sharing
and coming back.

---

## Phase 8a — Core Invite Loop

### DATABASE:
- [ ] Create topics table:
      id (uuid), slug (text unique), title (text),
      category ('movies'|'tv'|'any'), created_by (uuid nullable),
      created_at
- [ ] Create topic_clusters table:
      id (uuid), name (text), description (text), created_at
- [ ] Add cluster_id (uuid nullable) to topics table
- [ ] Add topic_id (uuid nullable) to lists table
- [ ] Create invites table:
      id (uuid), topic_id (uuid), sender_id (uuid nullable),
      sender_list_id (uuid nullable),
      token (text unique — default encode(gen_random_bytes(16), 'hex')),
      accepted_at (timestamptz nullable), created_at
- [ ] Give me all SQL to run in Supabase SQL Editor
- [ ] Add indexes: topics(slug), lists(topic_id),
      invites(token), topic_clusters(id)

SQL to run in Supabase:
```sql
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'any' CHECK (category IN ('movies', 'tv', 'any')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cluster_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_list_id uuid REFERENCES lists(id) ON DELETE SET NULL,
  message text,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lists ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX ON topics (slug);
CREATE INDEX ON invites (token);
CREATE INDEX ON lists (topic_id);
```

### TOPIC ID SYSTEM:
- [ ] When a list is created via an invite,
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
- [x] When a non-logged-in user arrives via invite link:
      * Call signInAnonymously() via Supabase
      * Allow them to complete the full list creation flow
      * Show a subtle "Sign in to save your list" banner at
        the top (not a blocking modal) throughout the flow
- [x] When guest taps "Sign in" in banner or tries to publish:
      * Calls linkWithGoogle() — upgrades anonymous session
      * After sign-in, user's id stays the same — data persists
- [ ] Anonymous users can browse and create but cannot
      comment or react without signing in

### INVITE MECHANIC:
- [x] "Invite" button on every list detail page and on the
      topic page (icon in the action row)
- [x] Invite flow:
      * Optional message ("I bet you can't beat my list 😏")
      * Generate a shareable link with a unique token
        Format: rankedhq.app/invite/[token]
      * Copy link button + native share sheet on mobile
- [x] Anyone can create an invite — you don't need to
      have made the list yourself
- [x] Invite link landing page (/invite/[token]):
      * Headline: "[Name] wants to know your take"
      * Sub-headline: "Rank your [Topic Title]"
      * Shows sender's optional message
      * If sender has made this list: shows their
        list as a teaser (top 3 entries, blurred/semi-opaque)
        with "[Name]'s list — share your take first to see it"
      * Big CTA: "Share your take →"
      * Tapping CTA goes to list creation wizard with:
        - Topic title pre-filled
        - Same category pre-selected
        - topic_id set on publish
      * Works for logged-in users AND guests (anonymous session)

### INVITE OG IMAGE (share preview):
- [x] New OG image route: /api/og/invite?token=[token]
- [x] Layout:
      * Background: semi-opaque poster collage from sender's list
      * Dark overlay + left gradient
      * "[Name] wants your take on" in muted text (22px)
      * Topic title large and bold (52px, white)
      * Sender's optional message in italic if present
      * "Share your take →" in gold
      * Ranked logo top left
- [x] Set as og:image on /invite/[token] page

### TOPIC PAGE (/topic/[slug]):
- [x] URL: /topic/[slug] — e.g. /topic/top-5-tv-comedies
- [x] Page header:
      * Topic title large at top
      * Entry count: "X people have shared their take"
      * "Invite" button top right
      * Sort pills: "Most Recent" | "Most Reactions"
- [x] Main content: expandable list cards, each showing:
      * Owner avatar + name
      * Reaction count + comment count
      * On TAP: card expands inline (does not navigate away)
        showing the full list + inline comments
      * A "Compare →" button appears on expand
- [x] EXPANDED CARD (tap to expand):
      * Full list entries visible in compact format
      * Below entries: inline comment thread
      * Text input at bottom: "Add your take..."
      * Post button — requires sign-in, prompts if not
      * Collapse button at top right of expanded card
- [ ] If cluster has related topics: show "Also see:
      [related topic titles]" as pills at top
- [x] Empty state: show topic name with invite friends CTA

### NAVIGATION IMPROVEMENTS:
- [x] Bottom tab bar on mobile (sm:hidden):
      Home | This Week | Search | My Lists | Profile
- [x] Home/This Week tabs set navPill via NavigationContext
- [x] Pills remain visible on Home tab; desktop unchanged
- [x] NavigationContext persists pill choice to localStorage

---

## Phase 8b — Search, Tagging & Polish

### SEARCH:
- [ ] Global search bar accessible from nav
- [ ] Search covers: list titles, topic titles, usernames
- [ ] Search results page (/search?q=[query]):
      * Tab bar: "Lists" | "Topics" | "People"
      * Filter: Movies / TV Shows / All
      * Sort: Most Recent / Most Reactions / Most Comments
- [ ] Supabase full-text search (to_tsvector) on titles

### @TAGGING IN COMMENTS:
- [ ] Support @username mentions in all comment inputs
- [ ] Dropdown of matching usernames appears on @
- [ ] Tagged usernames highlighted in gold in rendered comment
- [ ] Notification copy: "[Name] mentioned you in a comment
      on [List Title]"

### ICON TOOLTIPS ON LIST ACTIONS:
- [x] Desktop hover tooltips on all icon buttons:
      "Compare lists" | "Share" | "Invite a friend" |
      "Make your own version"
- [ ] Mobile: one-time coach mark on first visit

---

## Testing

### Phase 8a:
- [ ] Invite link generates correctly and is copyable
- [ ] Visiting /invite/[token] on desktop shows correct
      OG preview in Facebook debugger
- [ ] Visiting /invite/[token] as logged-out user shows
      guest flow, can complete list creation
- [ ] Guest list migrates correctly to account after sign-in
- [ ] Published list via invite has correct topic_id set
- [ ] Topic page /topic/[slug] loads all lists for that topic
- [ ] Tap to expand on topic page shows full list + comments
- [ ] Inline comment posts correctly from topic page
- [ ] Invite OG image renders correctly as PNG at
      /api/og/invite?token=[token]
- [ ] iMessage preview shows correctly for invite link
- [ ] Bottom tab bar visible on mobile, sticky at bottom
- [ ] "Sign in to save your list" banner appears for anon users
- [ ] topics and invites tables created in Supabase

### Phase 8b:
- [ ] Search returns relevant results for list titles
- [ ] Search filters work (Movies/TV, year, format)
- [ ] @username dropdown appears when typing @ in comments
- [ ] Tagged user receives notification
- [ ] @username renders in gold in posted comment

### General:
- [ ] All flows tested on mobile (390px) AND desktop
- [ ] npm run build passes with zero TypeScript errors
- [ ] No existing functionality broken

---

## Decisions

Guest-first flow: users arriving via invite link can make
their list immediately without signing in. Account creation
is prompted at save/publish time via a sticky banner.
Supabase anonymous auth upgrades to real account on sign-in
with the same user UUID — all data persists.

Anyone can create an invite — not just list owners. Makes
the mechanic more viral and social.

Tap-to-expand on topic page (not hover) — works on mobile
and desktop alike.

Topic clustering is manual with AI suggestions — keeps quality
high. Claude proposes cluster matches, admin confirms.

---

## Notes

The invite mechanic is the primary viral loop for Ranked.
Every list becomes a potential entry point for new users.
The OG image for invite links needs to be compelling enough
that people actually tap through from iMessage/WhatsApp.

Copy language guide:
- Button label: "Invite"
- Notification: "[Name] invited you to share your take on [Topic]"
- Landing headline: "[Name] wants to know your take"
- Landing sub-headline: "Rank your [Topic Title]"
- Landing CTA: "Share your take →"
- OG image: "[Name] wants your take on [Topic Title]"
- Topic page count: "X people have shared their take"
- After publishing: "Your take is in — see how others ranked it"
- Success toast: "Your take is live!"

Weekly prompt topic_ids should be pre-created each Monday
as part of the prompt rotation logic built in Phase 6.

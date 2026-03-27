---
phase: 6
title: "Social — Following, Notifications & Prompts"
status: in-progress
depends_on: n/a
priority: high
created: 2026-03-25
updated: 2026-03-26
---

## Goal
Add the foundational social mechanics that give users a reason 
to return after their first visit. Follow people whose taste you 
trust, get notified when something happens on your lists, and 
get prompted to create new lists when there's nothing new to see.

## Tasks

### DATABASE:
- [x] Create follows table: id, follower_id, following_id,
      created_at. Add unique constraint on (follower_id,
      following_id). Add indexes on both columns.
- [x] Create notifications table: id, user_id, type
      ('new_follower' | 'new_comment' | 'new_reaction' |
      'new_list_from_following'), actor_id, list_id, comment_id,
      read boolean default false, created_at
- [x] Give me the SQL to run in Supabase SQL Editor
- [x] Create weekly_prompt_cache table
- [x] Add prompt_week column to lists table

### FOLLOW / UNFOLLOW:
- [x] Follow button on every user profile page (/[username])
      — shows "Follow" if not following, "Following" if already
      following (click to unfollow with confirmation)
- [x] Follow button on list cards on home page — small subtle
      follow icon next to owner name, appears on hover/tap
- [x] Follower and following counts on profile page
- [x] A "Following" tab on the profile page showing who
      the user follows and who follows them
- [x] API routes: POST /api/follow, DELETE /api/follow,
      GET /api/follow/status?userId=, GET /api/follow/list

### IN-APP NOTIFICATION BELL:
- [x] Bell icon in the nav bar (top right, next to avatar)
- [x] Red dot badge on bell when there are unread notifications
- [x] Clicking bell opens a dropdown panel showing recent
      notifications, newest first
- [x] Notification types and copy:
      * new_follower: "[Name] started following you"
      * new_comment: "[Name] commented on [List Title]"
      * new_reaction: "[Name] reacted to [List Title]"
      * new_list_from_following: "[Name] published [List Title]"
- [x] Each notification links to the relevant page
- [x] "Mark all as read" button at top of dropdown
- [x] Notifications are created server-side when the
      triggering action happens (comment posted, reaction
      added, list published, follow created)
- [x] Poll for new notifications every 60 seconds while
      user is on the site (simple polling, no websockets)
- [x] Max 50 notifications shown, newest first

### HOME FEED FILTER:
- [x] Add a toggle/tab at the top of the home page:
      "Everyone" | "Following"
- [x] "Everyone" = current behaviour (all lists)
- [x] "Following" = only lists from users the current
      user follows + featured/editorial lists always shown
- [x] If user has no follows, "Following" tab shows an
      empty state: "Follow some people to see their lists
      here" with suggestions of active users
- [x] Remember the user's last selected tab in localStorage
- [x] Only show the filter to logged-in users

### "WHAT'S YOUR TOP 5" WEEKLY PROMPT:
- [x] A prominent card at the very top of the home page,
      shown to logged-in users only, above all list sections
- [x] Rotates weekly — new prompt every Monday, same prompt
      shown to all users in the same week
- [x] Prompt examples (hardcode a list of 12, cycle through)
- [x] CARD DESIGN — full width, dark surface, gold border,
      prompt text 20px+, semi-opaque posters, CTA button,
      dismiss ×
- [x] SUGGESTED ENTRIES: Claude haiku → TMDB posters →
      cached in weekly_prompt_cache table
- [x] INTERACTIONS:
      * "Start your list →" pre-fills create wizard (title +
        entries pre-loaded, step jumps to 3)
      * Dismiss (×) hides until next Monday via localStorage
      * Show next week's prompt if user already created a list
        matching current week's prompt_week

## Testing
- [ ] Follow a user → their lists appear in Following feed
- [ ] Unfollow a user → their lists disappear from Following feed
- [ ] Post a comment on someone's list → notification appears 
      in their bell within 60 seconds
- [ ] React to someone's list → notification appears in their bell
- [ ] Publish a new list → followers get a notification
- [ ] Red dot appears on bell for unread notifications
- [ ] Red dot disappears after opening the bell dropdown
- [ ] "Mark all as read" clears all unread notifications
- [ ] Weekly prompt changes every Monday
- [ ] "Create this list →" pre-fills the wizard with prompt text
- [ ] Dismiss hides prompt until next Monday
- [ ] Following feed shows editorial lists even with no follows
- [ ] Empty state shows correctly when user follows nobody
- [ ] All features tested on mobile (390px) AND desktop
- [ ] npm run build passes with zero TypeScript errors

## Decisions
No email notifications at this stage — want to validate 
the value prop of notifications before adding email. 
In-app bell is sufficient for now.

Simple polling (every 60s) instead of websockets — 
keeps complexity low, fine for current user count.

## Notes
Notifications should be created in the same API routes 
that handle the triggering actions — e.g. when 
POST /api/comments is called, also insert a notification 
row for the list owner.

The weekly prompt rotation can be based on 
Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % 12 
to consistently show the same prompt to all users in the 
same week.
```

Once you've saved that, paste this into Claude Code to kick it off:
```
Read .claude/project-plans/phase-6-social.md and implement 
everything in it. Start with the database schema and give 
me the SQL to run in Supabase before touching any code.
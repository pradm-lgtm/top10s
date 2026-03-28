---
phase: 7
title: "Engagement — Add to List, Feed, Versions & Discovery"
status: draft
depends_on: 6
priority: high
created: 2026-03-26
updated: 2026-03-26
---

## Goal
Turn passive list browsing into active participation. Users should 
be able to act on what they discover — adding entries to their own 
lists, making their own version of someone else's list, and finding 
similar lists to compare against. The home feed should feel alive 
and current, not static.

## Tasks

### 1. ADD ENTRY TO MY LIST (from someone else's list):
- [ ] On every entry row in a list detail page, show a small 
      "+" button on the right side (visible on hover desktop, 
      always visible mobile)
- [ ] Tapping "+" opens a bottom sheet with:
      * "Add [Title] to one of your lists"
      * A scrollable list of the user's existing lists 
        (show list title, format badge, entry count)
      * Each list row is tappable — tapping adds the entry 
        to that list immediately
      * A "Create a new list" option at the bottom
- [ ] Only show to logged-in users — if not logged in, 
      tapping "+" prompts sign in
- [ ] Adding the entry appends it to the bottom of the 
      target list (no rank input — user can reorder later)
- [ ] For tiered lists: show tier selector after picking 
      the list (same bottom sheet, step 2)
- [ ] Show a brief success toast: "Added to [List Title] ✓"
- [ ] API route: POST /api/list-entries/add with list_id, 
      title, tmdb_id, image_url

### 2. ADD TO RANKED LIST — APPEND NOT NUMBER INPUT:
- [ ] When adding an entry to a pure ranked list (from 
      the + button above OR from the list creation wizard), 
      always append to the bottom of the list
- [ ] Remove any number/rank input field from the add flow
- [ ] User reorders via drag and drop after adding
- [ ] This applies to: the + button flow, list creation 
      wizard step 3, and admin edit mode

### 3. HOME FEED — PRIORITIZE RECENTLY ADDED:
- [ ] Update the home page feed algorithm to surface 
      recently created/updated lists more prominently
- [ ] Sorting logic: score = recency_score + engagement_score
      * recency_score: lists created/updated in last 24hrs 
        get a large boost, last 7 days medium boost
      * engagement_score: weighted sum of reactions + 
        comments (with diminishing returns)
- [ ] "All Time" section stays static (not affected by feed)
- [ ] "By Year" sections and "Recently Added" strip should 
      reflect new activity within minutes of a list being 
      published
- [ ] Featured/editorial lists are pinned and not affected 
      by the feed algorithm

### 4. REMOVE "THIS WEEK" FROM PROMPT SECTION:
- [ ] Remove the "This week" or "This week's prompt" label 
      from the weekly prompt card on the home page
- [ ] Just show the prompt text directly with no time label

### 5. "MAKE YOUR OWN VERSION" BUTTON:
- [ ] On every list detail page, show a "Make your own 
      version" button below the list title/header
- [ ] Clicking it takes the user to step 3 of the list 
      creation wizard with:
      * Same list title pre-filled
      * Same list format (ranked/tiered/tiered+ranked)
      * Same category (movies/tv)
      * Same year/time scope
      * Empty entries — user starts fresh (does not copy 
        the original entries)
- [ ] Only show to logged-in users
- [ ] Track versions: add an original_list_id column to 
      the lists table (nullable uuid, no FK constraint)
      — set this when a list is created via "make your 
      own version"
- [ ] Give me the SQL for this column

### 6. "SEE SIMILAR LISTS" ON LIST DETAIL PAGE:
- [ ] Below the list entries, show a "Similar lists" 
      section
- [ ] A list qualifies as "similar" if:
      * Same category (movies/tv)
      * Same year/time scope (within 1 year for annual 
        lists, or both "all time")
      * At least 30% title overlap with the current list 
        (match by TMDB ID)
      * OR it was created via "Make your own version" 
        of this list (original_list_id matches)
- [ ] Show max 4 similar list cards in a horizontal 
      scroll row
- [ ] Each card shows: owner avatar, list title, overlap 
      percentage ("6 titles in common"), compare button
- [ ] "Compare" button goes directly to the comparison 
      page for those two lists
- [ ] If no similar lists exist, hide the section entirely

### 7. "SEE OTHER PEOPLE'S LISTS" FROM WEEKLY PROMPT:
- [ ] On the weekly prompt card, add a secondary link 
      below the "Start your list →" button:
      "See what others ranked →"
- [ ] Clicking it smooth-scrolls the page down to a 
      section that shows all lists created in response 
      to the current week's prompt
- [ ] This section is identified by matching list titles 
      that contain keywords from the prompt (fuzzy match)
      OR lists with original_list_id linking back to a 
      prompt-seeded list
- [ ] If no matching lists exist yet, scroll to the 
      Recently Added section instead
- [ ] The target section gets a subtle highlight/pulse 
      animation when scrolled to

### 8. "SEE ALL NOTIFICATIONS" PAGE:
- [ ] At the bottom of the notification bell dropdown, 
      add a "See all notifications →" link
- [ ] Clicking it navigates to /notifications — a 
      dedicated full page
- [ ] Page shows all notifications for the user, 
      paginated (20 per page, load more button)
- [ ] Each notification row: actor avatar, notification 
      text, relative timestamp, read/unread indicator
- [ ] Unread notifications have a subtle left border 
      accent in gold
- [ ] Clicking any notification marks it as read and 
      navigates to the relevant page
- [ ] "Mark all as read" button at the top of the page
- [ ] Empty state: "No notifications yet — start 
      engaging with lists to get the conversation going"

## Testing
- [ ] "+" button visible on entry rows when browsing 
      someone else's list (logged in)
- [ ] "+" button not visible when browsing own list
- [ ] "+" opens bottom sheet with user's lists
- [ ] Tapping a list in the sheet adds entry to bottom 
      of that list with success toast
- [ ] For tiered lists: tier selector appears after 
      picking the list
- [ ] Not logged in: "+" prompts sign in
- [ ] Adding entry to ranked list appends to bottom, 
      no rank input shown
- [ ] Home feed shows newly published list within 
      minutes of publishing
- [ ] "This week" label gone from prompt card
- [ ] "Make your own version" button appears on all 
      list detail pages (logged in)
- [ ] Clicking it opens wizard pre-filled with correct 
      title, format, category, year
- [ ] Created list has original_list_id set correctly
- [ ] Similar lists section shows for lists with 30%+
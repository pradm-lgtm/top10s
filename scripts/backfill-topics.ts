#!/usr/bin/env node
/**
 * scripts/backfill-topics.ts
 *
 * Retroactively assigns topic_id to lists whose title matches a topic title.
 * Matching rules:
 *   - Case-insensitive
 *   - Strip trailing parentheticals: "Best Miyazaki films (test)" → "Best Miyazaki films"
 *   - Match if normalised list title equals OR starts with normalised topic title
 *
 * Run (dry run — prints matches, no DB writes):
 *   DRY_RUN=true npx tsx --env-file=.env.local scripts/backfill-topics.ts
 *
 * Run (live — updates Supabase):
 *   npx tsx --env-file=.env.local scripts/backfill-topics.ts
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.env.DRY_RUN !== 'false'

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/, '') // strip trailing parenthetical e.g. "(test)"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function titlesMatch(listTitle: string, topicTitle: string): boolean {
  const nList = normalizeTitle(listTitle)
  const nTopic = normalizeTitle(topicTitle)
  // Exact match OR list title starts with topic title followed by space/end
  return nList === nTopic || nList.startsWith(nTopic + ' ')
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  RANKED — Topic Backfill')
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no DB writes)' : '🚀 LIVE (writing to Supabase)'}`)
  console.log(`${'═'.repeat(60)}\n`)

  // 1. Fetch all topics
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, slug, title')
    .order('title')

  if (topicsErr || !topics?.length) {
    console.log('No topics found.', topicsErr?.message ?? '')
    return
  }
  console.log(`Found ${topics.length} topic(s).\n`)

  let totalAssigned = 0

  for (const topic of topics) {
    // Fetch unassigned lists whose title starts with this topic title (broad ilike)
    const { data: candidates } = await supabase
      .from('lists')
      .select('id, title, owner_id')
      .ilike('title', `${topic.title}%`)
      .is('topic_id', null)

    if (!candidates?.length) continue

    // JS-level precision filter
    const matches = candidates.filter((l) => titlesMatch(l.title, topic.title))
    if (!matches.length) continue

    console.log(`📌 Topic: "${topic.title}" (${topic.id})`)
    for (const list of matches) {
      console.log(`   ${DRY_RUN ? '[DRY]' : '     '} → list "${list.title}" (${list.id})`)
    }

    if (!DRY_RUN) {
      const ids = matches.map((l) => l.id)
      const { error: updateErr } = await supabase
        .from('lists')
        .update({ topic_id: topic.id })
        .in('id', ids)
      if (updateErr) {
        console.error(`   ❌ Update failed: ${updateErr.message}`)
      } else {
        console.log(`   ✅ Assigned topic_id to ${ids.length} list(s)`)
        totalAssigned += ids.length
      }
    } else {
      totalAssigned += matches.length
    }
    console.log()
  }

  console.log(`${'═'.repeat(60)}`)
  if (DRY_RUN) {
    console.log(`  Dry run complete. ${totalAssigned} list(s) would be assigned.`)
    console.log('  Run without DRY_RUN=true to apply changes.')
  } else {
    console.log(`  ✅ Done. ${totalAssigned} list(s) assigned to topics.`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch((err) => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})

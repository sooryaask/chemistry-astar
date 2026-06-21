// Guided-flow + weakness-targeting helpers. Reuses existing data/utilities so the
// app can always answer "what should I do next?" and surface weak topics, without
// any new persistence or systems.

import { getItem, KEYS } from './localStorage.js'
import { SPEC, FREQ_RANK, getSpecPoint, PREREQUISITES } from '../data/spec.js'
import { mergeSpec } from './priority.js'
import { getDeck, dueCount } from './reviewDeck.js'
import { getErrors, errorsDue } from './errorLog.js'
import { dayOfChallenge } from './stats.js'
import { PLAN } from '../data/plan.js'

// Mastery status for one spec point, derived from confidence + SR-deck presence
// + error count. Returns 'weak' | 'developing' | 'strong'.
export function topicMastery(specId, ctx = {}) {
  const progress = ctx.progress || getItem(KEYS.specProgress, {})
  const deck = ctx.deck || getDeck()
  const errors = ctx.errors || getErrors()

  const p = progress[specId] || {}
  const confidence = typeof p.confidence === 'number' ? p.confidence : 0
  const inDeck = deck.some((c) => c.specId === specId) // still being learned via SR
  const errorCount = errors.filter((e) => e.specId === specId).length

  if (p.complete && confidence >= 3 && !inDeck) return 'strong'
  const effective = confidence - (inDeck ? 1 : 0) - (errorCount > 0 ? 0.5 : 0)
  if (effective <= 1) return 'weak'
  if (confidence >= 3 && !inDeck) return 'strong'
  return 'developing'
}

const MASTERY_RANK = { weak: 0, developing: 1, strong: 2 }

// Unmastered topics, weakest + highest-frequency first.
export function weakestTopics(n = 5, ctx = {}) {
  const progress = ctx.progress || getItem(KEYS.specProgress, {})
  const deck = getDeck()
  const errors = getErrors()
  return mergeSpec(progress)
    .filter((s) => !(s.complete && s.confidence >= 3))
    .map((s) => ({ ...s, mastery: topicMastery(s.id, { progress, deck, errors }) }))
    .sort((a, b) => {
      const fr = FREQ_RANK[a.frequency] - FREQ_RANK[b.frequency]
      if (fr !== 0) return fr
      const mr = MASTERY_RANK[a.mastery] - MASTERY_RANK[b.mastery]
      if (mr !== 0) return mr
      return a.confidence - b.confidence
    })
    .slice(0, n)
}

// The single best next action for the "do this next" home.
// Priority: due SR reviews -> today's plan step -> weakest high-frequency topic.
export function nextAction() {
  const progress = getItem(KEYS.specProgress, {})

  // 1. Spaced-repetition reviews due today.
  const due = dueCount()
  if (due > 0) {
    return {
      kind: 'review',
      title: `${due} review${due === 1 ? '' : 's'} due`,
      detail:
        'Spaced-repetition cards from earlier days are due. Clearing these first is the highest-value thing you can do.',
      to: '/drill',
      cta: 'Start reviews →',
    }
  }

  // 2. Today's plan step.
  const day = dayOfChallenge()
  const planDay = PLAN.find((d) => d.day === day)
  if (planDay) {
    if (planDay.specIds.length > 0) {
      const id = planDay.specIds[0]
      const sp = getSpecPoint(id)
      return {
        kind: 'plan',
        title: `Day ${day}: ${planDay.title}`,
        detail: `Today's plan. Start by learning ${id} ${sp ? sp.title : ''}, then drill and practise it.`,
        to: `/learn?spec=${id}`,
        cta: 'Start today →',
      }
    }
    return {
      kind: 'plan',
      title: `Day ${day}: ${planDay.title}`,
      detail: `Practice day — drill your due topics and sit questions on "${planDay.smartTopic}".`,
      to: '/drill',
      cta: 'Practise →',
    }
  }

  // 3. Plan finished (or before/after window) -> weakest high-frequency topic.
  const weakest = weakestTopics(1, { progress })[0]
  if (weakest) {
    return {
      kind: 'weak',
      title: `Strengthen ${weakest.id}: ${weakest.title}`,
      detail: `Your weakest high-frequency topic (${weakest.frequency}, ${weakest.mastery}). Learn it, then drill until it sticks.`,
      to: `/learn?spec=${weakest.id}`,
      cta: 'Study this →',
    }
  }

  // 4. Everything solid.
  return {
    kind: 'done',
    title: 'Everything looks solid — sit a paper',
    detail: 'No reviews due and every topic is at full confidence. Time to test under exam conditions.',
    to: '/papers',
    cta: 'Go to papers →',
  }
}

export const MASTERY_LABEL = {
  weak: 'Weak',
  developing: 'Developing',
  strong: 'Strong',
}

// Check prerequisites for a spec point. Returns array of unmastered prereqs.
export function unmasteredPrereqs(specId, ctx = {}) {
  const prereqs = PREREQUISITES[specId]
  if (!prereqs || prereqs.length === 0) return []
  const progress = ctx.progress || getItem(KEYS.specProgress, {})
  return prereqs
    .map((pid) => {
      const p = progress[pid] || {}
      const sp = getSpecPoint(pid)
      const confidence = typeof p.confidence === 'number' ? p.confidence : 0
      return { id: pid, title: sp?.title || pid, confidence, complete: !!p.complete }
    })
    .filter((p) => p.confidence < 2) // shaky or no idea = warn
}

// Smart Daily Agenda: builds an ordered checklist of tasks for today.
export function buildDailyAgenda() {
  const progress = getItem(KEYS.specProgress, {})
  const deck = getDeck()
  const errors = getErrors()
  const due = errorsDue()
  const dueCards = dueCount()
  const day = dayOfChallenge()
  const planDay = PLAN.find((d) => d.day === day)
  const agenda = []

  // 1. Spaced-rep reviews (highest priority)
  if (dueCards > 0) {
    agenda.push({
      type: 'review',
      title: `Clear ${dueCards} spaced-rep review${dueCards === 1 ? '' : 's'}`,
      detail: 'Due cards from the hidden review deck — highest retention value.',
      to: '/drill',
      priority: 1,
    })
  }

  // 2. Error log reviews due
  if (due.length > 0) {
    agenda.push({
      type: 'errors',
      title: `Re-quiz ${due.length} error log item${due.length === 1 ? '' : 's'}`,
      detail: 'Missed questions scheduled for review today.',
      to: '/errors',
      priority: 2,
    })
  }

  // 3. Today's plan topics
  if (planDay && planDay.specIds.length > 0) {
    for (const sid of planDay.specIds) {
      const sp = getSpecPoint(sid)
      const p = progress[sid] || {}
      const conf = typeof p.confidence === 'number' ? p.confidence : 0
      if (conf >= 3 && p.complete) continue // already mastered, skip
      agenda.push({
        type: 'learn',
        title: `Learn: ${sid} ${sp?.title || ''}`,
        detail: `From today's plan (Day ${day}). ${sp?.frequency || ''} frequency.`,
        to: `/learn?spec=${sid}`,
        priority: 3,
      })
    }
  }

  // 4. Plan practice session
  if (planDay && planDay.smartTopic) {
    agenda.push({
      type: 'practice',
      title: `Practice: ${planDay.smartTopic}`,
      detail: 'Sit past-paper questions on today\'s topic.',
      to: '/practice',
      priority: 4,
    })
  }

  // 5. Weakest topics not on today's plan
  const planSpecIds = new Set(planDay?.specIds || [])
  const weakest = weakestTopics(3, { progress })
    .filter((s) => !planSpecIds.has(s.id))
  for (const w of weakest) {
    agenda.push({
      type: 'strengthen',
      title: `Strengthen: ${w.id} ${w.title}`,
      detail: `${w.frequency} frequency, ${w.mastery}. Needs more work.`,
      to: `/learn?spec=${w.id}`,
      priority: 5,
    })
  }

  return agenda.sort((a, b) => a.priority - b.priority)
}

// Pace tracker: are you on track to finish by exam day?
export function paceStatus() {
  const progress = getItem(KEYS.specProgress, {})
  const merged = mergeSpec(progress)
  const completed = merged.filter((s) => s.complete).length
  const total = SPEC.length
  const day = dayOfChallenge()
  const totalDays = PLAN.length // 21

  const expectedByNow = Math.round((day / totalDays) * total)
  const pctComplete = Math.round((completed / total) * 100)
  const daysLeft = Math.max(0, totalDays - day)
  const remaining = total - completed
  const perDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining

  // Projected completion
  const rate = day > 0 ? completed / day : 0
  const projectedTotal = Math.round(rate * totalDays)

  let status = 'on-track'
  if (completed < expectedByNow - 3) status = 'behind'
  else if (completed > expectedByNow + 3) status = 'ahead'

  return {
    completed,
    total,
    day,
    totalDays,
    daysLeft,
    expectedByNow,
    pctComplete,
    remaining,
    perDay,
    projectedTotal,
    status,
  }
}

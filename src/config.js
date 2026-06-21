// The experiment start date. Day X of 21 is calculated from this.
// Set to the day the 21-day challenge began. Update here to re-base the countdown.
export const START_DATE = '2026-06-16'

// Total days in the challenge.
export const CHALLENGE_DAYS = 21

// Total number of tracked spec points (used for the "X/60" summary).
export const TOTAL_SPEC_POINTS = 60

// Anthropic model used for rigorous quiz/past-paper marking and lessons.
export const MODEL = 'claude-sonnet-4-6'

// Faster, lighter model for the rapid drill (recall marking + flashcard gen).
export const FAST_MODEL = 'claude-haiku-4-5'

// Confidence scale labels (0–3).
export const CONFIDENCE_LABELS = ['No idea', 'Shaky', 'Okay', 'Confident']

// Demó „mostani” időpont: ezzel a képernyőtervekkel egyező állapot látszik
// (2026-10-08, őszi félév). Éles használatban állítsd null-ra, ekkor az
// alkalmazás a valós rendszeridőt használja.
export const DEMO_NOW = '2026-10-08T08:00:00'

// Ügyfélfogadási idő és az időpontok rácsa (percben).
export const OPENING = { start: '08:00', end: '16:00', step: 15 }

// Ennyi órával az időpont előtt lehet legkésőbb lemondani.
export const CANCEL_LIMIT_HOURS = 24

// Ügytípus felvételénél a csúszka határai (perc).
export const DURATION_RANGE = { min: 5, max: 60, step: 5, default: 15 }

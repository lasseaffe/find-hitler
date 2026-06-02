const BADGE_RULES = [
  { id: 'first_blood',    check: ({ totalGames, won }) => totalGames === 1 && won },
  { id: 'three_clicks',   check: ({ won, clicks, mode }) => won && mode === 'classic' && clicks <= 3 },
  { id: 'speed_demon',    check: ({ won, mode, seconds }) => won && mode === 'speedrun' && seconds < 60 },
  { id: 'speed_run_1',    check: ({ won, mode, seconds }) => won && mode === 'speedrun' && seconds < 30 },
  { id: 'hole_in_one',    check: ({ won, mode, clicks }) => won && mode === 'jesus' && clicks === 1 },
  { id: 'no_undo',        check: ({ won, mode }) => won && mode === 'classic' },
  { id: 'daily_7',        check: ({ streak }) => streak >= 7 },
  { id: 'daily_30',       check: ({ streak }) => streak >= 30 },
  { id: 'ranked_win',     check: ({ won, mode }) => won && mode === 'ranked' },
  { id: 'gold_rank',      check: ({ elo }) => elo >= 2000 },
  { id: 'fact_ace',       check: ({ won, mode, wrongAccusations }) => won && mode === 'fact-checker' && wrongAccusations === 0 },
  { id: 'fact_historian', check: ({ mode, totalGames }) => mode === 'fact-checker' && totalGames >= 10 },
  { id: 'hardcore_clear', check: ({ won, hardcore }) => won && hardcore },
  { id: 'century',        check: ({ totalGames }) => totalGames >= 100 },
  { id: 'veteran',        check: ({ totalGames }) => totalGames >= 365 },
  { id: 'no_hub_clear',   check: ({ won, mode }) => won && mode === 'nohub' },
  { id: 'golf_eagle',     check: ({ won, mode, clicks }) => won && mode === 'golf' && clicks <= 3 },
  { id: 'globetrotter',   check: () => false },
  { id: 'nerd',           check: () => false },
  { id: 'challenger',     check: () => false },
]

export function computeNewBadges(ctx) {
  const owned = new Set(ctx.existingBadges ?? [])
  return BADGE_RULES
    .filter(rule => !owned.has(rule.id) && rule.check(ctx))
    .map(rule => rule.id)
}

export const ALL_BADGE_IDS = BADGE_RULES.map(r => r.id)

export const BADGE_META = {
  first_blood:    { label: 'First Blood',      desc: 'Win your first game' },
  three_clicks:   { label: 'Three Clicks',     desc: 'Win Classic in 3 clicks or fewer' },
  speed_demon:    { label: 'Speed Demon',      desc: 'Finish Speedrun in under 60 seconds' },
  speed_run_1:    { label: 'Blink',            desc: 'Finish Speedrun in under 30 seconds' },
  hole_in_one:    { label: 'Hole in One',      desc: '5-Clicks: reach Jesus in 1 click' },
  no_undo:        { label: 'No Safety Net',    desc: 'Win Classic without using any undos' },
  daily_7:        { label: 'Weekly',           desc: '7-day play streak' },
  daily_30:       { label: 'Monthly',          desc: '30-day play streak' },
  ranked_win:     { label: 'Ranked',           desc: 'Win your first ranked duel' },
  gold_rank:      { label: 'Gold',             desc: 'Reach Gold division' },
  fact_ace:       { label: 'Fact Ace',         desc: 'Complete Fact Checker with zero wrong accusations' },
  fact_historian: { label: 'Historian',        desc: 'Complete 10 Fact Checker games' },
  hardcore_clear: { label: 'Hardcore',         desc: 'Win any mode with Hardcore modifier' },
  century:        { label: 'Century',          desc: 'Play 100 total games' },
  veteran:        { label: 'Veteran',          desc: 'Play 365 total games' },
  no_hub_clear:   { label: 'Pathfinder',       desc: 'Win No-Hub mode' },
  golf_eagle:     { label: 'Eagle',            desc: 'Golf mode: Eagle or better (3 clicks)' },
  globetrotter:   { label: 'Globetrotter',     desc: 'Win with 5 different targets' },
  nerd:           { label: 'Nerd',             desc: 'Win 10 games using 1 undo or fewer total' },
  challenger:     { label: 'Challenger',       desc: 'Reach top 50 players by ELO' },
}

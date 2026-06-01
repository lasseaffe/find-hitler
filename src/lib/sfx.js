// Procedural Web Audio SFX — no asset files, $0. Character approved in brainstorm
// (audio-cues.html). All cues fire from a user gesture (START click) so autoplay
// policy is satisfied. Honors a persistent mute toggle + prefers-reduced-motion.

const MUTE_KEY = 'fh:muted'
let _ctx = null

function reducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function isMuted() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(MUTE_KEY) === '1'
}

export function setMuted(v) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MUTE_KEY, v ? '1' : '0')
}

export function toggleMuted() {
  const next = !isMuted()
  setMuted(next)
  return next
}

function ctx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!_ctx) _ctx = new AC()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// Unlock/resume the AudioContext synchronously inside a user gesture (the START
// click) so cues fired slightly later (from animation timers) are allowed to play.
export function primeAudio() {
  if (isMuted()) return
  ctx()
}

// gate every cue behind mute + reduced-motion + audio availability
function audio() {
  if (isMuted() || reducedMotion()) return null
  return ctx()
}

function blip(a, t, freq, dur, type, gain) {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noiseSource(a, dur) {
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const s = a.createBufferSource()
  s.buffer = buf
  return s
}

/* Crowd of NPCs vocalizing — staggered low murmur blips, randomized each call. */
export function vocalize() {
  const a = audio()
  if (!a) return
  const now = a.currentTime
  const n = 14
  for (let i = 0; i < n; i++) {
    const t = now + i * 0.06 + Math.random() * 0.03
    const f = 120 + Math.random() * 170
    blip(a, t, f, 0.05 + Math.random() * 0.05, Math.random() < 0.5 ? 'sawtooth' : 'triangle', 0.035 + Math.random() * 0.025)
  }
}

/* The crowd turning around — filtered noise sweep. */
export function shuffle() {
  const a = audio()
  if (!a) return
  const now = a.currentTime
  const dur = 0.42
  const s = noiseSource(a, dur)
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.7
  bp.frequency.setValueAtTime(400, now)
  bp.frequency.exponentialRampToValueAtTime(3200, now + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(0.22, now + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  s.connect(bp).connect(g).connect(a.destination)
  s.start(now)
  s.stop(now + dur)
}

/* Race begins — low thud + hard high crack (brutalist stamp). */
export function start() {
  const a = audio()
  if (!a) return
  const now = a.currentTime
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(170, now)
  o.frequency.exponentialRampToValueAtTime(45, now + 0.2)
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(0.6, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
  o.connect(g).connect(a.destination)
  o.start(now)
  o.stop(now + 0.34)

  const s = noiseSource(a, 0.08)
  const hp = a.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2200
  const g2 = a.createGain()
  g2.gain.setValueAtTime(0.4, now)
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
  s.connect(hp).connect(g2).connect(a.destination)
  s.start(now)
  s.stop(now + 0.1)
}

/* Win — muffled scream on the slide-down. */
export function scream() {
  const a = audio()
  if (!a) return
  const now = a.currentTime
  const dur = 0.7
  const s = noiseSource(a, dur)
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 4
  bp.frequency.setValueAtTime(900, now)
  bp.frequency.linearRampToValueAtTime(600, now + dur)
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(0.18, now + 0.05)
  g.gain.setValueAtTime(0.16, now + 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  s.connect(bp).connect(lp).connect(g).connect(a.destination)
  s.start(now)
  s.stop(now + dur)
}

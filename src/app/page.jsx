'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hasPlayedDailyToday } from '@/lib/dailyChallenge'
import { Frame, MonoLabel, RedButton, SelectCell } from '@/components/ui/primitives'
import HitlerMark from '@/components/ui/HitlerMark'
import CrowdIntro from '@/components/intro/CrowdIntro'
import { primeAudio } from '@/lib/sfx'
import WikiAutocomplete from '@/components/WikiAutocomplete'

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'pt', label: 'PT', name: 'Português' },
]

const TARGET_CATEGORIES = [
  {
    label: 'Political Figures',
    targets: [
      { label: 'Adolf Hitler', featured: true },
      { label: 'Joseph Stalin' },
      { label: 'Mao Zedong' },
      { label: 'Winston Churchill' },
      { label: 'Napoleon Bonaparte' },
      { label: 'Donald Trump' },
    ],
  },
  {
    label: 'Religion',
    targets: [
      { label: 'Jesus' },
      { label: 'Muhammad' },
      { label: 'Pope Francis' },
      { label: 'Gautama Buddha' },
    ],
  },
  {
    label: 'Pop Culture',
    targets: [
      { label: 'Taylor Swift' },
      { label: 'Minecraft' },
      { label: 'Black hole' },
      { label: '9/11 attacks' },
    ],
  },
  {
    label: 'Controversial',
    targets: [
      { label: 'The Holocaust' },
      { label: 'Osama bin Laden' },
      { label: 'Jeffrey Epstein' },
    ],
  },
]

const VARIANTS = [
  { value: 'speedrun',     label: 'Speedrun',  sub: 'Fastest Time', desc: 'Curated start, race the clock.' },
  { value: 'golf',         label: 'Golf',       sub: '5-Min Cap',    desc: 'Lowest clicks inside 5 minutes.' },
  { value: 'fact-checker', label: 'Fact Check', sub: 'Spot the Lie', desc: 'Find planted inaccuracies.' },
]

const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   hops: '~2 hops',  meta: '5 undos · no timer' },
  { value: 'normal', label: 'Normal', hops: '3–4 hops', meta: '3 undos · no timer' },
  { value: 'hard',   label: 'Hard',   hops: '5–6 hops', meta: '1 undo · 5-min cap' },
  { value: 'brutal', label: 'Brutal', hops: '6+ hops',  meta: '0 undos · hub penalty' },
]

const TIME_LIMITS = [
  { value: 0,   label: 'Off' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
]

export default function HomePage() {
  const router = useRouter()

  // play config
  const [playType, setPlayType]         = useState('normal')   // 'normal' | 'ranked' | 'custom'
  const [subType, setSubType]           = useState('solo')     // 'solo' | 'multi' (normal only)
  const [target, setTarget]             = useState('Adolf Hitler')
  const [customTarget, setCustomTarget] = useState('')
  const [customStatus, setCustomStatus] = useState(null)
  const [customCanonical, setCustomCanonical] = useState('')
  const [isCustomTarget, setIsCustomTarget] = useState(false)
  const [lang, setLang]                 = useState('en')
  const [mode, setMode]                 = useState('classic')
  const [difficulty, setDifficulty]     = useState('normal')

  // custom-game options
  const [customUndos, setCustomUndos]         = useState(3)
  const [customTimeLimit, setCustomTimeLimit] = useState(0)
  const [customHubPenalty, setCustomHubPenalty] = useState(false)
  const [customStartPage, setCustomStartPage] = useState('')
  const [customStartStatus, setCustomStartStatus] = useState(null)
  const [customStartCanonical, setCustomStartCanonical] = useState('')

  // player / lobby
  const [playerName, setPlayerName] = useState('')
  const [botCount, setBotCount]     = useState(1)
  const [friends, setFriends]       = useState([])
  const [rankedUser, setRankedUser] = useState(null)

  // ui state
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showIntro, setShowIntro] = useState(false)

  const startReq        = useRef(null)
  const validateTimer   = useRef(null)
  const startValidTimer = useRef(null)

  const alreadyPlayedDaily = mode === 'daily' && hasPlayedDailyToday()
  const effectiveTarget = isCustomTarget ? customCanonical : target

  // pre-fill codename + fetch ranked user
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) return
        const displayName = d.user.username || d.user.name
        if (displayName) setPlayerName(displayName)
        setRankedUser({ rank: d.user.rank, elo: d.user.elo })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (subType !== 'multi') return
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(d.friends || []))
      .catch(() => {})
  }, [subType])

  const handleCustomInput = useCallback((val) => {
    setCustomTarget(val)
    setCustomStatus('checking')
    setCustomCanonical('')
    clearTimeout(validateTimer.current)
    if (!val.trim()) { setCustomStatus(null); return }
    validateTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wikipedia/validate?title=${encodeURIComponent(val)}&lang=${lang}`)
        const data = await res.json()
        if (data.valid) { setCustomStatus('valid'); setCustomCanonical(data.canonicalTitle) }
        else setCustomStatus('invalid')
      } catch { setCustomStatus('invalid') }
    }, 400)
  }, [lang])

  const handleAutoSelect = (title) => {
    setCustomTarget(title)
    setCustomCanonical(title)
    setCustomStatus('valid')
    clearTimeout(validateTimer.current)
  }

  const handleCustomStartInput = useCallback((val) => {
    setCustomStartPage(val)
    setCustomStartStatus('checking')
    setCustomStartCanonical('')
    clearTimeout(startValidTimer.current)
    if (!val.trim()) { setCustomStartStatus(null); return }
    startValidTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wikipedia/validate?title=${encodeURIComponent(val)}&lang=${lang}`)
        const data = await res.json()
        if (data.valid) { setCustomStartStatus('valid'); setCustomStartCanonical(data.canonicalTitle) }
        else setCustomStartStatus('invalid')
      } catch { setCustomStartStatus('invalid') }
    }, 400)
  }, [lang])

  const handleLangChange = (code) => {
    setLang(code)
    if (isCustomTarget && customTarget) { setCustomStatus('checking'); setCustomCanonical('') }
  }

  const handleInviteFriend = async (friendId) => {
    const lobbyCode = sessionStorage.getItem('roomCode') || ''
    if (!lobbyCode) return
    await fetch('/api/lobby/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: friendId, lobbyCode, target: effectiveTarget, mode }),
    })
  }

  const handleStart = () => {
    if (playType === 'ranked') { router.push('/ranked'); return }
    if (!playerName.trim()) { setError('Enter a codename to continue'); return }
    if (isCustomTarget && customStatus !== 'valid') { setError('Choose a valid Wikipedia target'); return }
    setError('')

    if (mode === 'fact-checker') {
      const params = new URLSearchParams({ difficulty: difficulty === 'easy' || difficulty === 'normal' ? 'medium' : 'hard' })
      router.push(`/play/fact-checker?${params}`)
      return
    }

    if (playType === 'normal' && subType === 'multi') {
      sessionStorage.setItem('lobbyConfig', JSON.stringify({ playerName: playerName.trim(), mode, target: effectiveTarget, botCount, difficulty }))
      router.push('/lobby/new')
      return
    }

    primeAudio()
    setLoading(true)

    const body = {
      target: effectiveTarget,
      mode: mode === 'daily' ? 'daily' : mode,
      playerName: playerName.trim(),
      difficulty,
      lang,
      ...(playType === 'custom' && {
        custom: true,
        undos: customUndos,
        timeLimit: customTimeLimit,
        hubPenalty: customHubPenalty,
        startPage: customStartCanonical || null,
      }),
    }

    startReq.current = fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      return { ...data, target: data.target || effectiveTarget, mode: body.mode, difficulty, playerName: playerName.trim() }
    })

    setShowIntro(true)
  }

  const handleIntroDone = async () => {
    try {
      const data = await startReq.current
      sessionStorage.setItem('gameInit', JSON.stringify(data))
      router.push('/play')
    } catch (e) {
      setShowIntro(false)
      setLoading(false)
      setError(e?.message === 'Failed to fetch' ? 'Could not reach server — is it running?' : (e?.message || 'Server error'))
    }
  }

  const targetLabel = isCustomTarget ? (customCanonical || customTarget || '?') : target
  const modeLabel   = mode === 'classic' ? 'FIND TARGET' : (VARIANTS.find(v => v.value === mode)?.label || mode).toUpperCase()

  const canStart = playType === 'ranked'
    || (!!playerName.trim() && (!isCustomTarget || customStatus === 'valid') && !alreadyPlayedDaily)

  if (showIntro) return <CrowdIntro onDone={handleIntroDone} />

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:py-12">
      <main className="mx-auto max-w-2xl">
        <Frame>

          {/* MASTHEAD */}
          <div className="flex items-center gap-4 px-5 py-5 border-b-4 border-ink">
            <HitlerMark size={56} className="flex-none" />
            <div className="flex-1">
              <h1 className="text-[clamp(2rem,9vw,2.75rem)] leading-[0.82]">Six Clicks</h1>
              <MonoLabel className="mt-1.5 block">Wikirace · Taboo Edition</MonoLabel>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2">
              <a href="/profile"     className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">Profile →</a>
              <a href="/leaderboard" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">Leaderboard →</a>
              <a href="/study"       className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70 hover:text-red">Study Mode →</a>
            </div>
          </div>

          {/* STICKY SUMMARY BAR */}
          <div className="sticky top-0 z-10 bg-red text-paper border-b-4 border-ink px-5 py-3 flex items-center justify-between gap-4">
            <div>
              <MonoLabel className="text-paper/70 block mb-0.5">Your Race</MonoLabel>
              <p className="font-mono text-[13px] tracking-[0.1em] leading-none">
                {playType === 'ranked'
                  ? '⚔ Ranked Duel — Find Match'
                  : `→ ${targetLabel.toUpperCase().slice(0, 14)} · ${modeLabel} · ${playType === 'custom' ? 'CUSTOM' : difficulty.toUpperCase()}`
                }
              </p>
            </div>
            <button
              onClick={handleStart}
              disabled={loading || !canStart}
              className="bg-paper text-red font-display uppercase text-[18px] tracking-[0.06em] px-5 py-2 disabled:opacity-40 cursor-pointer"
            >
              {loading ? '…' : playType === 'ranked' ? 'Queue ⚔' : subType === 'multi' && playType === 'normal' ? 'Lobby →' : 'Start →'}
            </button>
          </div>

          {/* CODENAME */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-2">Codename</MonoLabel>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="enter codename"
              className="w-full border-[3px] border-ink bg-paper px-3 py-3 font-mono text-base text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
            />
          </div>

          {/* TARGET */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <div className="flex items-center justify-between mb-3">
              <MonoLabel>Target</MonoLabel>
              <div className="flex gap-1">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    title={l.name}
                    onClick={() => handleLangChange(l.code)}
                    className={`font-mono text-[10px] px-2 py-1 border-[2px] border-ink tracking-[0.1em] transition-colors cursor-pointer ${lang === l.code ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-dim'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={mode === 'daily' ? 'opacity-40 pointer-events-none' : ''}>
              {TARGET_CATEGORIES.map(cat => (
                <div key={cat.label} className="mb-4 last:mb-0">
                  <MonoLabel className="text-red block mb-2">▸ {cat.label}</MonoLabel>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {cat.targets.map(t => {
                      const sel = !isCustomTarget && target === t.label
                      return (
                        <SelectCell
                          key={t.label}
                          selected={sel}
                          onClick={() => { setTarget(t.label); setIsCustomTarget(false) }}
                          className="flex-none min-w-[110px] flex flex-col justify-center py-3 px-3"
                        >
                          {t.featured && (
                            <HitlerMark
                              size={36}
                              fill={sel ? 'var(--color-paper)' : 'var(--color-ink)'}
                              className="mb-1.5"
                            />
                          )}
                          <span className="font-display uppercase text-base leading-none">{t.label}</span>
                        </SelectCell>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-2">
                <MonoLabel className="text-red block mb-2">▸ Custom</MonoLabel>
                <SelectCell
                  selected={isCustomTarget}
                  onClick={() => setIsCustomTarget(true)}
                  className="inline-flex items-center gap-2 px-3 py-3 border-[3px] border-dashed border-ink"
                >
                  <span className="font-display uppercase text-base">+ Own Target</span>
                </SelectCell>
                {isCustomTarget && (
                  <div className="mt-2">
                    <WikiAutocomplete
                      value={customTarget}
                      lang={lang}
                      onChange={handleCustomInput}
                      onSelect={handleAutoSelect}
                      placeholder="search Wikipedia page title…"
                      className="w-full border-[3px] border-ink bg-paper px-3 py-3 font-mono text-base text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
                    />
                    {customStatus === 'checking' && <MonoLabel className="mt-1 block text-ink/60">Checking…</MonoLabel>}
                    {customStatus === 'valid'    && <MonoLabel className="mt-1 block" style={{ color: 'green' }}>✓ Valid — {customCanonical}</MonoLabel>}
                    {customStatus === 'invalid'  && <MonoLabel className="mt-1 block text-red">✗ Not found on Wikipedia</MonoLabel>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MODE */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-3">Mode</MonoLabel>

            <SelectCell
              selected={mode === 'classic'}
              onClick={() => setMode('classic')}
              className="w-full flex items-center gap-4 px-4 py-5 mb-2 border-[3px] border-ink"
            >
              <HitlerMark size={52} fill={mode === 'classic' ? 'var(--color-paper)' : 'var(--color-ink)'} className="flex-none" />
              <div className="flex-1 text-left">
                <div className="font-display uppercase text-2xl leading-none">Find Target</div>
                <div className={`mt-1.5 font-mono text-[13px] ${mode === 'classic' ? 'text-paper/70' : 'text-ink/60'}`}>
                  Navigate from a random Wikipedia page to your chosen target. Fewest clicks wins.
                </div>
              </div>
              {mode === 'classic' && (
                <span className="flex-none font-mono text-[9px] uppercase tracking-[0.12em] bg-paper text-red border border-red px-2 py-1">★ Main</span>
              )}
            </SelectCell>

            <MonoLabel className="block mt-4 mb-2">Variants</MonoLabel>
            <div className="flex gap-2 overflow-x-auto pb-1 border-[3px] border-ink bg-ink">
              {VARIANTS.map(v => {
                const sel = mode === v.value
                return (
                  <SelectCell
                    key={v.value}
                    selected={sel}
                    onClick={() => setMode(v.value)}
                    className="flex-none min-w-[130px] flex flex-col py-4 px-3 border-0"
                  >
                    <span className="font-display uppercase text-lg leading-none">{v.label}</span>
                    <MonoLabel className={`mt-1.5 block ${sel ? 'text-paper/70' : ''}`}>{v.sub}</MonoLabel>
                    <p className={`mt-2 font-mono text-[11px] leading-tight ${sel ? 'text-paper/60' : 'text-ink/50'}`}>{v.desc}</p>
                  </SelectCell>
                )
              })}
            </div>

            {/* DAILY CHALLENGE — own section */}
            <div
              className="mt-3 flex items-center justify-between px-4 py-3 border-[3px] cursor-pointer"
              style={{ borderColor: '#6b21a8', background: mode === 'daily' ? '#6b21a8' : '#f9f5ff' }}
              onClick={() => setMode(mode === 'daily' ? 'classic' : 'daily')}
            >
              <div>
                <MonoLabel className="block" style={{ color: mode === 'daily' ? '#e9d5ff' : '#6b21a8' }}>
                  ▸ Daily Challenge
                </MonoLabel>
                <p className="font-mono text-[11px] mt-0.5" style={{ color: mode === 'daily' ? '#d8b4fe' : '#7e22ce' }}>
                  One seed · shared with all players · one attempt
                </p>
              </div>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 border-[2px]"
                style={mode === 'daily'
                  ? { background: '#f9f5ff', color: '#6b21a8', borderColor: '#f9f5ff' }
                  : { background: '#6b21a8', color: '#f9f5ff', borderColor: '#6b21a8' }
                }
              >
                {alreadyPlayedDaily ? '✓ Done' : mode === 'daily' ? 'Selected' : 'Play →'}
              </span>
            </div>
          </div>

          {/* DIFFICULTY */}
          {mode !== 'fact-checker' && mode !== 'daily' && playType !== 'custom' && (
            <div className="px-5 py-4 border-b-4 border-ink">
              <MonoLabel className="block mb-3">Difficulty</MonoLabel>
              <div className="grid grid-cols-4 gap-[3px] bg-ink border-[3px] border-ink">
                {DIFFICULTIES.map(d => {
                  const sel = difficulty === d.value
                  return (
                    <SelectCell
                      key={d.value}
                      selected={sel}
                      onClick={() => setDifficulty(d.value)}
                      className="flex flex-col items-center text-center py-4 px-2"
                    >
                      <span className="font-display uppercase text-lg leading-none">{d.label}</span>
                      <MonoLabel className={`mt-1.5 block ${sel ? 'text-paper/70' : ''}`}>{d.hops}</MonoLabel>
                      <p className={`mt-1 font-mono text-[10px] leading-tight ${sel ? 'text-paper/60' : 'text-ink/40'}`}>{d.meta}</p>
                    </SelectCell>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PLAY TYPE SELECTOR ── */}
          <div className="px-5 py-4 border-b-4 border-ink">
            <MonoLabel className="block mb-3">Play Type</MonoLabel>
            <div className="grid grid-cols-3 gap-[3px] bg-ink border-[3px] border-ink">

              {/* Normal */}
              <SelectCell
                selected={playType === 'normal'}
                onClick={() => setPlayType('normal')}
                className="flex flex-col items-center text-center py-4 px-2"
              >
                <span className="font-display uppercase text-lg leading-none">Normal</span>
                <MonoLabel className={`mt-1.5 block ${playType === 'normal' ? 'text-paper/70' : ''}`}>Tracked</MonoLabel>
                <p className={`mt-1 font-mono text-[10px] leading-tight ${playType === 'normal' ? 'text-paper/60' : 'text-ink/40'}`}>Standard rules</p>
              </SelectCell>

              {/* Ranked */}
              <SelectCell
                selected={playType === 'ranked'}
                onClick={() => setPlayType('ranked')}
                className="flex flex-col items-center text-center py-4 px-2"
              >
                <span className="font-display uppercase text-lg leading-none">Ranked ⚔</span>
                <MonoLabel className={`mt-1.5 block ${playType === 'ranked' ? 'text-paper/70' : ''}`}>ELO · LP</MonoLabel>
                {rankedUser && playType !== 'ranked' && (
                  <p className="mt-1 font-mono text-[9px] leading-tight text-red uppercase">{rankedUser.rank?.replace('_', ' ')} · {rankedUser.elo}</p>
                )}
                {playType === 'ranked' && (
                  <p className="mt-1 font-mono text-[10px] leading-tight text-paper/60">1v1 duel format</p>
                )}
              </SelectCell>

              {/* Custom */}
              <SelectCell
                selected={playType === 'custom'}
                onClick={() => setPlayType('custom')}
                className="flex flex-col items-center text-center py-4 px-2"
              >
                <span className="font-display uppercase text-lg leading-none">Custom 🎛</span>
                <MonoLabel className={`mt-1.5 block ${playType === 'custom' ? 'text-paper/70' : ''}`}>Untracked</MonoLabel>
                <p className={`mt-1 font-mono text-[10px] leading-tight ${playType === 'custom' ? 'text-paper/60' : 'text-ink/40'}`}>Free rules</p>
              </SelectCell>
            </div>

            {/* Normal sub-toggle: Solo / Multiplayer */}
            {playType === 'normal' && (
              <div className="grid grid-cols-2 border-[3px] border-t-0 border-ink mt-0">
                {[['solo', 'Solo'], ['multi', 'Multiplayer']].map(([val, lbl], i) => (
                  <button
                    key={val}
                    onClick={() => setSubType(val)}
                    className={`min-h-[44px] py-3 text-center font-display uppercase tracking-[0.06em] text-base cursor-pointer ${i === 1 ? 'border-l-4 border-ink' : ''} ${subType === val ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-dim'}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            {/* Ranked info panel */}
            {playType === 'ranked' && (
              <div className="border-[3px] border-t-0 border-ink px-4 py-3 bg-paper-dim">
                {rankedUser ? (
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink/60">Your standing</div>
                    <div className="font-display text-base">{rankedUser.rank?.replace('_', ' ')}</div>
                    <div className="font-mono text-[11px] text-red">{rankedUser.elo} ELO</div>
                  </div>
                ) : (
                  <p className="font-mono text-[11px] text-ink/60">Sign in to track your ELO and rank.</p>
                )}
              </div>
            )}

            {/* Custom options panel */}
            {playType === 'custom' && (
              <div className="border-[3px] border-t-0 border-ink px-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Undo count */}
                  <div>
                    <MonoLabel className="block mb-2">Undos</MonoLabel>
                    <div className="flex items-center gap-2 border-[3px] border-ink">
                      <button onClick={() => setCustomUndos(n => Math.max(0, n - 1))} className="px-3 py-2 font-display text-xl hover:bg-paper-dim cursor-pointer">−</button>
                      <span className="flex-1 text-center font-mono text-base">{customUndos}</span>
                      <button onClick={() => setCustomUndos(n => Math.min(10, n + 1))} className="px-3 py-2 font-display text-xl hover:bg-paper-dim cursor-pointer">+</button>
                    </div>
                  </div>
                  {/* Time limit */}
                  <div>
                    <MonoLabel className="block mb-2">Time Limit</MonoLabel>
                    <div className="flex gap-[2px] border-[3px] border-ink">
                      {TIME_LIMITS.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setCustomTimeLimit(t.value)}
                          className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-[0.08em] cursor-pointer ${customTimeLimit === t.value ? 'bg-ink text-paper' : 'hover:bg-paper-dim'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hub penalty */}
                <label className="flex items-center gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customHubPenalty}
                    onChange={e => setCustomHubPenalty(e.target.checked)}
                    className="w-4 h-4 accent-red"
                  />
                  <div>
                    <span className="font-display uppercase text-base">Hub Penalty</span>
                    <MonoLabel className="block">Hub pages cost an undo</MonoLabel>
                  </div>
                </label>

                {/* Custom start page */}
                <div className="mt-4">
                  <MonoLabel className="block mb-2">Start Page</MonoLabel>
                  <WikiAutocomplete
                    value={customStartPage}
                    lang={lang}
                    onChange={handleCustomStartInput}
                    onSelect={(title) => { setCustomStartPage(title); setCustomStartCanonical(title); setCustomStartStatus('valid') }}
                    placeholder="random (leave blank)"
                    className="w-full border-[3px] border-ink bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink/40 outline-none focus:bg-paper-dim caret-red"
                  />
                  {customStartStatus === 'valid'   && <MonoLabel className="mt-1 block" style={{ color: 'green' }}>✓ {customStartCanonical}</MonoLabel>}
                  {customStartStatus === 'invalid' && <MonoLabel className="mt-1 block text-red">✗ Not found on Wikipedia</MonoLabel>}
                </div>

                <p className="mt-3 font-mono text-[10px] text-ink/40 uppercase tracking-[0.1em]">Custom games are not recorded in match history</p>
              </div>
            )}
          </div>

          {/* MULTIPLAYER OPTIONS (normal + multi) */}
          {playType === 'normal' && subType === 'multi' && (
            <div className="px-5 py-4 border-b-4 border-ink">
              <MonoLabel className="block mb-3">Friends</MonoLabel>
              {friends.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {friends.map(f => (
                    <div key={f.id} className="border-[3px] border-ink px-4 py-3 flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-none ${f.online ? 'bg-green-500' : 'bg-ink/20'}`} />
                      <div className="flex-1">
                        <p className="font-display uppercase text-base leading-none">{f.name}</p>
                        <MonoLabel className="mt-0.5 block">ELO {f.elo}</MonoLabel>
                      </div>
                      <button
                        onClick={() => handleInviteFriend(f.id)}
                        className="bg-red text-paper font-display uppercase text-sm px-4 py-2 tracking-[0.06em] cursor-pointer"
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[11px] text-ink/50">No friends yet — share your friend code from your profile.</p>
              )}

              <div className="mt-4">
                <MonoLabel className="block mb-2">Bot Opponents: {botCount}</MonoLabel>
                <input
                  type="range" min={0} max={3} value={botCount}
                  onChange={e => setBotCount(Number(e.target.value))}
                  className="w-full accent-red"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-ink/50"><span>0 Bots</span><span>3 Bots</span></div>
              </div>
            </div>
          )}

          {error && <p className="px-5 py-3 font-mono text-xs text-red border-b-4 border-ink">{error}</p>}

          <RedButton onClick={handleStart} disabled={loading || alreadyPlayedDaily || !canStart}>
            {loading ? 'Connecting…'
              : alreadyPlayedDaily ? 'Already played today ✓'
              : playType === 'ranked' ? 'Find Match ⚔'
              : playType === 'normal' && subType === 'multi' ? 'Create Lobby →'
              : 'Start Race →'}
          </RedButton>

        </Frame>

        {/* Mobile nav */}
        <div className="sm:hidden mt-3 grid grid-cols-3 gap-3">
          <a href="/profile"     className="border-[3px] border-ink py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em]">Profile →</a>
          <a href="/leaderboard" className="border-[3px] border-ink py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em]">Leaderboard →</a>
          <a href="/study"       className="border-[3px] border-ink py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em]">Study →</a>
        </div>
      </main>
    </div>
  )
}

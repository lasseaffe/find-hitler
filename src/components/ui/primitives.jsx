// Brutalist / Newsprint primitives — encode the locked patterns once so screens
// stop re-deriving inline Tailwind. Tokens: paper / ink / red, heavy rules,
// hard corners, mono data labels. See design plan + brainstorm mockups.

const cn = (...a) => a.filter(Boolean).join(' ')

/* Heavy-border block. The base container for every screen section. */
export function Frame({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cn('border-4 border-ink bg-paper', className)} {...rest}>
      {children}
    </Tag>
  )
}

/* A heavy divider rule. */
export function Rule({ className }) {
  return <div className={cn('border-t-4 border-ink', className)} />
}

/* Small uppercase monospace section label, e.g. "TARGET", "GAME MODE". */
export function MonoLabel({ className, children, ...rest }) {
  return (
    <span
      className={cn('font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70', className)}
      {...rest}
    >
      {children}
    </span>
  )
}

/* The primary CTA — full-bleed red bar. */
export function RedButton({ as: Tag = 'button', className, children, ...rest }) {
  return (
    <Tag
      className={cn(
        'block w-full bg-red text-paper font-display uppercase tracking-[0.06em]',
        'text-lg sm:text-xl px-4 py-4 text-center cursor-pointer',
        'min-h-[48px] transition-[filter] hover:brightness-110 active:brightness-95',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* Selectable cell (targets, modes). selected = ink fill + paper text + red tick. */
export function SelectCell({ selected, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      className={cn(
        'relative text-left p-3 min-h-[48px] cursor-pointer',
        selected ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-dim',
        className,
      )}
      {...rest}
    >
      {children}
      {selected && <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red" />}
    </button>
  )
}

/* Hard toggle switch with a label + sublabel (e.g. HARDCORE MODIFIER). */
export function ToggleRow({ label, sublabel, checked, onChange, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-5 py-4', className)}>
      <div>
        <div className="font-display text-base uppercase">{label}</div>
        {sublabel && <MonoLabel className="mt-1 block">{sublabel}</MonoLabel>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative h-7 w-[54px] flex-none border-[3px] border-ink cursor-pointer',
          checked ? 'bg-red/15' : 'bg-paper',
        )}
      >
        <span
          className={cn(
            'absolute top-0 bottom-0 w-[20px] bg-ink transition-[left] duration-100',
            checked ? 'left-[28px]' : 'left-0',
          )}
        />
      </button>
    </div>
  )
}

/* A labelled data stat — mono label over a display-font value. */
export function Stat({ label, value, unit, accent, className }) {
  return (
    <div className={cn('px-4 py-2.5', className)}>
      <MonoLabel className="block">{label}</MonoLabel>
      <div className={cn('font-display text-2xl leading-none mt-1', accent && 'text-red')}>
        {value}
        {unit && <span className="text-[0.5em] ml-1">{unit}</span>}
      </div>
    </div>
  )
}

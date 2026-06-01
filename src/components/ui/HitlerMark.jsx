// The iconic mark — side-swept hair + strict-rectangle toothbrush 'stache (22x26),
// no face outline. Single source of truth, reused across intro / win / targets /
// nodes / masthead / profile. Pure SVG, no state — safe in server or client trees.
//
// Design contract (locked in brainstorm):
//   hair path + 'stache rect on a 200x200 viewBox.
//   text=true  -> "FOUND" / "HIM" stacked inside the 'stache (sized to fit, never stretch box).
//   mouth      -> 'none' | 'open' : screaming oval in the lower face (win-reveal slide/fall).

const HAIR_D =
  'M 36 96 C 28 52, 62 22, 108 22 C 152 22, 174 50, 170 92 ' +
  'C 162 74, 146 66, 130 70 C 128 56, 120 50, 108 50 ' +
  'C 92 50, 78 60, 70 74 C 60 80, 46 86, 36 96 Z'

export default function HitlerMark({
  size = 120,
  fill = 'var(--color-ink)',
  text = false,
  mouth = 'none',
  title = 'Find Hitler',
  className = '',
  style,
  ...rest
}) {
  // knockout color for text/labels sitting on the black fill
  const knockout = 'var(--color-paper)'
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      className={className}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <path d={HAIR_D} fill={fill} />
      <rect x="89" y="114" width="22" height="26" fill={fill} />

      {text && (
        <>
          <text
            x="100" y="125" textAnchor="middle" fill={knockout}
            fontFamily="var(--font-display)" fontSize="4.8" letterSpacing="-0.4"
          >
            FOUND
          </text>
          <text
            x="100" y="135" textAnchor="middle" fill={knockout}
            fontFamily="var(--font-display)" fontSize="4.8" letterSpacing="-0.2"
          >
            HIM
          </text>
        </>
      )}

      {mouth === 'open' && <ellipse cx="100" cy="158" rx="9" ry="14" fill={fill} />}
    </svg>
  )
}

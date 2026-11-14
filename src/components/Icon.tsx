// One consistent icon family: 24×24 grid, 2px rounded strokes (SF Symbols-like).
// Decorative by default (aria-hidden); pass `label` when the icon carries meaning alone.

const paths: Record<string, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  train: (
    <>
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </>
  ),
  eat: (
    <>
      <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" />
      <path d="M17 21V3c-2.2 1.3-3.5 4-3.5 7.2V13H17" />
    </>
  ),
  progress: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: (
    <path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.4-2.4-5.5-3.8-8.2-.4 2-1.4 3.2-2.6 3.8.2-2.9-.9-5.6-3.3-7.3.3 3.1-1.6 5-2.9 6.9A7 7 0 0 0 5.5 14.7C5.5 18.4 8.1 21 12 21z" />
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  scale: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0L12 12" />
    </>
  ),
  chevron: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bolt: <path d="M13 2.5L4.5 14H12l-1 7.5L19.5 10H12z" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20.5h7M9.5 17h5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.5l2.2 11h10.6L20.5 7.5H6.4" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  run: (
    <>
      <circle cx="14.5" cy="4.5" r="1.8" />
      <path d="M9 21l2.5-5.5 3 2.5V21M6.5 11.5L9.5 8l4 1 2 3.5 3 1M11.5 15.5l1.5-5.5" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="2" />
      <rect x="16.5" y="14" width="4.5" height="6.5" rx="2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  close:<path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  share: (
    <>
      <path d="M12 3.5v11M8 7l4-4 4 4" />
      <path d="M7 10.5H5.5v9h13v-9H17" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19l7-7" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />,
  swap: <path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" />,
  wand: (
    <>
      <path d="M4 20L15 9M13 7l4 4" />
      <path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M10 3v2M9 4h2" />
    </>
  ),
  pencil: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />,
  barcode: <path d="M4 5v14M7.5 5v14M10 5v14M13.5 5v14M16 5v14M20 5v14" />,
  store: (
    <>
      <path d="M4 9.5l1.5-5h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8" />
    </>
  ),
  sparkle:<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
}

export type IconName = keyof typeof paths

export function Icon({
  name,
  size = 22,
  label,
  className,
  strokeWidth = 2,
}: {
  name: IconName
  size?: number
  label?: string
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {paths[name]}
    </svg>
  )
}

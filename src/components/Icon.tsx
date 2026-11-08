// Simple stroked icons drawn on a 24px grid.
const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  issue: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11a1 1 0 100 2 1 1 0 000-2z',
  issueClosed: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6',
  pr: 'M6 3a2 2 0 100 4 2 2 0 000-4zM6 7v10M6 17a2 2 0 100 4 2 2 0 000-4zM18 17a2 2 0 100 4 2 2 0 000-4zM18 17V9a3 3 0 00-3-3h-4M13 4l-2 2 2 2',
  merge: 'M6 3a2 2 0 100 4 2 2 0 000-4zM6 7v10M6 17a2 2 0 100 4 2 2 0 000-4zM18 13a2 2 0 100 4 2 2 0 000-4zM6 7c0 5 4 8 10 8',
  play: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5v7l6-3.5-6-3.5z',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  history: 'M4 12a8 8 0 108-8 8 8 0 00-6.5 3.3M4 4v4h4M12 8v4l3 2',
  branch: 'M6 3a2 2 0 100 4 2 2 0 000-4zM6 7v10M6 17a2 2 0 100 4 2 2 0 000-4zM18 5a2 2 0 100 4 2 2 0 000-4zM18 9c0 5-12 3-12 8',
  file: 'M6 3h8l5 5v13H6V3zM14 3v5h5',
  folder: 'M3 6h6l2 2h10v11H3V6z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  dot: 'M12 8a4 4 0 100 8 4 4 0 000-8z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z',
  fork: 'M6 3a2 2 0 100 4 2 2 0 000-4zM18 3a2 2 0 100 4 2 2 0 000-4zM12 17a2 2 0 100 4 2 2 0 000-4zM6 7v2a3 3 0 003 3h6a3 3 0 003-3V7M12 12v5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  comment: 'M4 5h16v11H9l-5 4V5z',
  commit: 'M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h6M16 12h6',
  user: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c1-4 4-6 8-6s7 2 8 6',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1',
  wrap: 'M4 6h16M4 12h13a3 3 0 010 6h-4M14 16l-2 2 2 2M4 18h5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  stop: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 9h6v6H9z',
  skip: 'M12 3a9 9 0 100 18 9 9 0 000-18zM6 18L18 6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5z',
  mention: 'M12 8a4 4 0 100 8 4 4 0 000-8zM16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-4 7.5',
  eyeCheck: 'M5 12l5 5 9-10',
}

export function Icon({ name, size = 16, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  )
}

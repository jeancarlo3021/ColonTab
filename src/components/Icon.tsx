// Íconos de línea propios de ColonTab (24×24, trazo redondeado).
const PATHS = {
  menu: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5v-13ZM13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13V4Zm2.5 4H18M15.5 11.5H18M6.5 8H9M6.5 11.5H9',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0M12 3v2',
  receipt: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Zm3 5h6M9 11.5h6M9 15h3.5',
  games: 'M7.5 8h9a4.5 4.5 0 0 1 4.2 6.2l-.9 2.3a2.3 2.3 0 0 1-3.8.7L14 15h-4l-2 2.2a2.3 2.3 0 0 1-3.8-.7l-.9-2.3A4.5 4.5 0 0 1 7.5 8Zm.5 2.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  chat: 'M4 12a8 8 0 1 1 3.6 6.7L4 20l1.3-3.5A8 8 0 0 1 4 12Zm5-1h.01M12 11h.01M15 11h.01',
  camera: 'M4 8.5C4 7.7 4.7 7 5.5 7h2.3L9.5 5h5l1.7 2h2.3c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13C4.7 19 4 18.3 4 17.5v-9ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  idea: 'M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.7.6-1 1.4-1 2.3V17h-5v-.2c0-.9-.3-1.7-1-2.3Z',
  chevron: 'M9.5 6l6 6-6 6',
  back: 'M14.5 6l-6 6 6 6',
  hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V5a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.7 7-6.5 7-2.4 0-4.2-1.3-5.4-3.4L3.4 14a1.4 1.4 0 0 1 2.3-1.6L8 15',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11C4.7 20 4 19.3 4 18.5v-11C4 6.7 4.7 6 5.5 6H10',
  download: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6 6 0 0 1 3 5.5',
  file: 'M7 3h7l5 5v12.5c0 .3-.2.5-.5.5h-11.5a.5.5 0 0 1-.5-.5V3.5c0-.3.2-.5.5-.5ZM14 3v5h5M9.5 13h5M9.5 16.5h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

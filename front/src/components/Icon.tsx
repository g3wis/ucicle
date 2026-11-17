import React from 'react';

export type IconName = 'help' | 'stats' | 'menu' | 'close' | 'up' | 'down' | 'check' | 'share' | 'not';

const PATHS: Record<IconName, React.ReactNode> = {
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6" />
      <path d="M12 17h.01" />
    </>
  ),
  stats: <path d="M6 20v-8M12 20V5M18 20v-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  share: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </>
  ),
  not: <path d="M6 9h12M6 15h12M15 5L9 19" />,
};

/** Inline SVG icons, 2 px stroke, round caps. Always decorative: the text beside them carries the meaning. */
export default function Icon({ name, className }: { name: IconName, className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

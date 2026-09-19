import type { CSSProperties } from "react";
export function Icon({ name, size = 22, style }: { name: string; size?: number; style?: CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    flower: <><path d="M12 8C5 0 1 9 8 12c-8 5 0 12 4 4 4 8 12 1 4-4 7-3 3-12-4-4Z"/><circle cx="12" cy="12" r="2.5"/></>,
    map: <><path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2V5Z"/><path d="M9 3v15M15 6v15"/></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></>,
    leaf: <><path d="M20 3C7 1 1 8 5 15s17 6 15-12ZM5 20 16 9"/><path d="m9 16-1-5m5 1 4 1"/></>,
    book: <><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Zm0 0v15"/><path d="M5 8h3m-3 4h3m8-4h3m-3 4h3"/></>,
    settings: <><path d="m9 3-1 3-3 1-2 4 2 2 1 4 3 1 3 3 3-3 4-1 1-4 2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    sound: <><path d="m11 4-5 4H3v8h3l5 4V4Zm5 4c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></>,
    mute: <><path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
    heart: <path d="M12 20 4 12C-2 5 7-1 12 6c5-7 14-1 8 6Z"/>,
    paw: <><ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="9" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="6" rx="2" ry="3"/><ellipse cx="20" cy="11" rx="2" ry="3"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    pause: <path d="M8 5v14M16 5v14"/>,
    play: <path d="m8 4 12 8-12 8V4Z"/>,
    replay: <><path d="M3 10a9 9 0 1 1 1 8M3 3v7h7"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  };
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.flower}</svg>;
}

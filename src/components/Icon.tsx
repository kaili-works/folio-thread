// 线性图标：与预览稿同一套线宽（1.6、圆角端点）。
// 用法：layout 里渲染一次 <IconSprite />，页面里写 <Icon name="search" />。
export type IconName =
  | "leaf"
  | "library"
  | "note"
  | "guide"
  | "exit"
  | "play"
  | "pause"
  | "sun"
  | "toc"
  | "head"
  | "upload"
  | "search"
  | "gear"
  | "refresh"
  | "up"
  | "down"
  | "swap"
  | "lock"
  | "shelve"
  | "trash"
  | "pencil"
  | "textminus"
  | "textplus"
  | "back"
  | "next"
  | "plus"
  | "list"
  | "path"
  | "themes"
  | "stats"
  | "market"
  | "today"
  | "globe"
  | "check"
  | "user";

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19c0-7 5-12 14-13-1 9-5 13-12 13H5Z" /><path d="M5 19c3-3 6-5 9-7" /></symbol>
      <symbol id="i-library" viewBox="0 0 24 24"><path d="M4 19.5V6.5A1.5 1.5 0 0 1 5.5 5H8v15H5.5A1.5 1.5 0 0 1 4 19.5Z" /><path d="M8 5h4v15H8z" /><path d="M12 5.8 16.6 4.6a1 1 0 0 1 1.2.7l3.1 12.8a1 1 0 0 1-.7 1.2l-2.4.6" /></symbol>
      <symbol id="i-note" viewBox="0 0 24 24"><path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M14 4v5h5" /><path d="M8 13h6M8 17h4" /></symbol>
      <symbol id="i-guide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="m15 9-2 4.5L9 15l2-4.5L15 9Z" /></symbol>
      <symbol id="i-exit" viewBox="0 0 24 24"><path d="M14 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8" /><path d="m17 8 4 4-4 4" /><path d="M21 12H10" /></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z" /></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></symbol>
      <symbol id="i-toc" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></symbol>
      <symbol id="i-head" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" /><path d="M20 14h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-5Z" /></symbol>
      <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></symbol>
      <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M4 9a8 8 0 0 1 13.7-3.7L20 7" /><path d="M20 4v3h-3" /><path d="M20 15a8 8 0 0 1-13.7 3.7L4 17" /><path d="M4 20v-3h3" /></symbol>
      <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></symbol>
      <symbol id="i-swap" viewBox="0 0 24 24"><path d="M4 9a8 8 0 0 1 13.7-3.7L20 7" /><path d="M20 4v3h-3" /><path d="M20 15a8 8 0 0 1-13.7 3.7L4 17" /><path d="M4 20v-3h3" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
      <symbol id="i-shelve" viewBox="0 0 24 24"><path d="M4 5h16v4H4z" /><path d="M5 9v10h14V9" /><path d="M10 13h4" /></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m14 6 4 4" /></symbol>
      <symbol id="i-textminus" viewBox="0 0 24 24"><path d="M4 18 9 6l5 12" /><path d="M6.2 14h5.6" /><path d="M16 12h5" /></symbol>
      <symbol id="i-textplus" viewBox="0 0 24 24"><path d="M4 18 9 6l5 12" /><path d="M6.2 14h5.6" /><path d="M16 12h5M18.5 9.5v5" /></symbol>
      <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></symbol>
      <symbol id="i-next" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-list" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></symbol>
      <symbol id="i-path" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2" /><circle cx="18" cy="12" r="2" /><circle cx="8" cy="19" r="2" /><path d="M8 6h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8" /></symbol>
      <symbol id="i-themes" viewBox="0 0 24 24"><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></symbol>
      <symbol id="i-stats" viewBox="0 0 24 24"><path d="M3 20h18" /><path d="M6 20v-7M12 20V5M18 20v-11" /></symbol>
      <symbol id="i-market" viewBox="0 0 24 24"><path d="M4 4h7l9 9-7 7-9-9V4Z" /><circle cx="8.2" cy="8.2" r="1.2" /></symbol>
      <symbol id="i-today" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /><circle cx="12" cy="14.5" r="1.3" /></symbol>
      <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.4 2.4 3.7 5.3 3.7 8.5s-1.3 6.1-3.7 8.5c-2.4-2.4-3.7-5.3-3.7-8.5S9.6 5.9 12 3.5Z" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.6" r="3.4" /><path d="M5.2 20c.6-3.6 3.4-5.6 6.8-5.6s6.2 2 6.8 5.6" /></symbol>
    </svg>
  );
}

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`ic${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

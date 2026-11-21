import type { Dict } from "./index";

// 英文文案：结构与 zh.ts 一一对应，缺键或多键都会在类型检查时报错。
export const en: Dict = {
  nav: {
    themes: "Themes & Lists",
    library: "Library",
    today: "Today's Pack",
    stats: "Stats",
    market: "Book Market",
    libraryShort: "Library",
    notes: "Notes",
    guide: "Guide",
    logout: "Sign out",
    newTheme: "New",
    todayShort: "Today",
    switchLanguage: "Switch language",
  },
  today: {
    title: "Today's reading",
    metaChapters: (chapters: number, minutes: number) =>
      `${chapters} chapter${chapters === 1 ? "" : "s"} · about ${minutes} min`,
    metaItems: (items: number, minutes: number) =>
      `${items} item${items === 1 ? "" : "s"} · about ${minutes} min`,
    regenerate: "Regenerate today's pack",
    settings: "Reading settings",
    generating: "Generating…",
    progressChapters: (pct: number, done: number, total: number) =>
      `${pct}% done · ${done} / ${total} chapters`,
    progressPlain: (pct: number) => `${pct}% done`,
    plannedMinutes: (minutes: number) => `about ${minutes} min`,
    readingOrder: (n: number) => `reading order ${String(n).padStart(2, "0")}`,
    chapterOne: (chapter: number, minutes: number) =>
      `Chapter ${chapter} · ${minutes} min`,
    chapterRange: (start: number, end: number, minutes: number) =>
      `Chapters ${start}–${end} · ${minutes} min`,
    wereadChip: (minutes: number) => `WeRead · about ${minutes} min`,
    startReading: "Start reading",
    openWeread: "Read on WeRead",
    unknownBook: "Untitled book",
    unknownTheme: "Untitled theme",
    todayReading: "Read today",
    ariaMinutes: "Minutes read today",
    minutesRead: (minutes: number, planned: number) =>
      `${minutes} / ${planned} min read today`,
    autoTracked:
      "Counted automatically from your reading time. Reading the planned minutes completes today's slice.",
    manualTrack:
      "Reading time isn't available right now, so you can drag to adjust.",
    loading: "Loading today's pack…",
    retry: "Retry",
    offline:
      "You're offline, so today's pack can't be loaded. It will recover when you're back online.",
    loadFailed:
      "Couldn't load today's pack. Check your connection and try again.",
    cachedHint: (date: string) =>
      `Showing the pack cached on ${date}. It will refresh once you're back online.`,
    empty:
      "No pack for today yet. Once your theme list has readable books, today's slices will be generated automatically.",
    emptyNoTheme:
      "You don't have a theme yet. Create one and we'll build an ordered list for it, starting tomorrow.",
    emptyNoBooks:
      "Your theme and list are ready, but none of the books are readable yet. Upload an EPUB or match a WeRead source to slice today's chapters.",
    flow: "The path: create a theme → generate and confirm a list → upload books → a new pack each day.",
    goThemes: "Themes & Lists",
    goLibrary: "Library",
    createTheme: "Create your first theme",
    uploadBook: "Upload in Library",
    viewList: "View list",
    generate: "Generate today's pack",
    generateEmpty:
      "Nothing readable yet. Generate a list in your theme and upload books first.",
    generated: "Today's slices have been re-planned from your current list.",
    generateFailed: (error: string | number) => `Generation failed: ${error}`,
    noReadable: "Nothing readable in this pack yet. Add books in your library first.",
    doneTitle: "Today's reading is done",
    doneSub: (chapters: number) =>
      `All ${chapters} chapters planned for today are finished. See you tomorrow.`,
    regenHelp:
      "Want more or less? Regenerating keeps your progress: chapters finished today stay counted and won't be scheduled twice. A new pack also rolls over automatically at midnight.",
    prefsKicker: "Reading pace",
    prefsUnit: "words / min",
    save: "Save",
    speedInvalid: "Reading speed must be between 100 and 1000 words per minute.",
    speedSaved: "Saved. Daily word estimates will use this speed.",
    speedSaveFailed: (error: string | number) => `Save failed: ${error}`,
    speedHelp:
      "This works with each theme's daily budget to split today's pack (budget × speed = words per day). Regenerate the pack to apply changes; adjust budgets in Themes & Lists.",
    quickKicker: "Shortcuts",
    quickLibrary: "My library",
    quickNotes: "All notes",
    quickThemes: "Themes & lists",
    statsKicker: "All-time reading",
    statsMore: "Full stats",
    statBooks: "Books finished",
    statChapters: "Chapters done",
    statWords: "Words read",
    unitBooks: "books",
    unitChapters: "chapters",
    words: (n: number) =>
      n >= 1000
        ? { value: (n / 1000).toFixed(1), unit: "k words" }
        : { value: n.toLocaleString("en-US"), unit: "words" },
  },
  library: {
    kicker: "Your shelf",
    title: "Library",
    shelfMeta: (books: number, pending: number, words: string) =>
      `${books} book${books === 1 ? "" : "s"} · ${pending} pending · ${words} total`,
    wordCount: (n: number) =>
      n >= 1000
        ? `${(n / 1000).toFixed(1)}k words`
        : `${n.toLocaleString("en-US")} words`,
    search: "Search library",
    closeSearch: "Close search",
    searchPlaceholder: "Search by title or author",
    noResults: "No matching books.",
    upload: "Upload EPUB",
    uploadTitle: "Upload an EPUB",
    uploadLead:
      "Up to 50 MB each · EPUB only for now. Convert PDF, MOBI, AZW3, or TXT files to EPUB before uploading.",
    uploadPrivacy:
      "Only upload files you have the right to use. Non-Chinese books are sent to a third-party AI service (DeepSeek) for machine translation while reading.",
    uploading: "Uploading and parsing…",
    chooseFile: "Choose file",
    reselect: "Choose another",
    picked: (name: string, size: string) => `Selected: ${name} (${size})`,
    submit: "Upload",
    submitting: "Parsing…",
    shelfKicker: "Shelf",
    pendingKicker: "To add",
    pendingBadge: "To add",
    pendingHelp:
      "These books are on your reading lists but aren't in the library yet. Upload the EPUBs, then hit Refresh in Themes & Lists to match them automatically.",
    pendingFrom: (themes: string[]) => `From: ${themes.join(", ")}`,
    unknownAuthor: "Unknown author",
    expandAll: (n: number) => `Show all ${n}`,
    collapse: "Show less",
    emptyTitle: "Upload your first EPUB",
    empty:
      "Your library is empty. The path is: create a theme → generate and confirm a list → upload the EPUBs → a new daily pack is generated each day.",
    emptyLink: "Create a theme",
    loading: "Loading your library…",
    pickFile: "Choose an EPUB file first.",
    duplicate: (title: string) =>
      `This book is already in your library: “${title}”.`,
    uploadSuccess: (
      title: string,
      chapters: number | string,
      paragraphs: number | string,
    ) =>
      `Uploaded: “${title}” — ${chapters} chapters, ${paragraphs} paragraphs.`,
    uploadFailed: (error: string | number) => `Upload failed: ${error}`,
    delete: "Delete",
    deleteConfirm: "Remove this book from your library?",
    deleteFailed: (error: string | number) => `Delete failed: ${error}`,
  },
  auth: {
    brandKicker: "FolioThread",
    brandTitle: "Read with direction.",
    brandLead: "One theme, a little reading every day.",
    steps: [
      "Describe the topic you want to study in one sentence",
      "AI recommends an ordered reading list",
      "Read a little each day within your budget and build your knowledge map",
    ],
    foot: "A guided reading navigator · finding the thread in a sea of books",
    loginTitle: "Continue today's reading",
    loginIntro: "Sign in to return to today's pack.",
    registerTitle: "Create your reading profile",
    registerIntro:
      "Start by describing a theme, and we'll arrange an ordered list for you.",
    tabLogin: "Sign in",
    tabRegister: "Create account",
    email: "Email",
    password: "Password",
    login: "Sign in",
    register: "Create account",
    signingIn: "Signing in…",
    creating: "Creating…",
    loginFailed: (error: string) => `Sign-in failed: ${error}`,
    registerFailed: (error: string) => `Sign-up failed: ${error}`,
    registerSuccess:
      "Account created. Open the confirmation link in your email, then sign in. If email confirmation is off, you can sign in right away.",
  },
};

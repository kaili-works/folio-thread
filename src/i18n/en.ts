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
  themes: {
    kicker: "Themes & Lists",
    title: "Themes & reading lists",
    newTheme: "New theme",
    newThemeClose: "Close form",
    newThemeHint: "Describe what you want to study in one sentence",
    nameLabel: "Theme name",
    namePlaceholder: "e.g. Urban sociology",
    descLabel: "Describe the theme in your own words",
    descPlaceholder:
      "e.g. A beginner's path into how cities work and how people live in them",
    createHelp:
      "Describe your reading theme in plain language. After creating it, hit “Let AI recommend books” and the model will pick 5–6 titles ordered from easy to hard. You can adjust or regenerate later; once the list is confirmed, upload the EPUBs to your library. If an EPUB isn't available but WeRead has the book, today's pack will link to WeRead directly.",
    create: "Create theme",
    cancel: "Cancel",
    loadingThemes: "Loading themes…",
    emptyKicker: "No themes yet",
    emptyTitle: "Start with one question you want to study",
    emptyBody:
      "For example, “A beginner's guide to how cities work.” AI will suggest 5–6 books in order; read a little each day within your budget, and your notes and progress stay here.",
    myThemes: (n: number) => `My themes · ${n}`,
    manage: "Manage",
    manageClose: "Done",
    railMeta: (books: number, read: number, minutes: number) =>
      `${books} ${books === 1 ? "book" : "books"} · ${read} read · ${minutes} min/day`,
    railMetaShort: (minutes: number) => `${minutes} min/day`,
    priority: "Priority",
    unpriority: "Remove priority",
    domainLabel: "Reading domain",
    domainHint: "Reading domain: groups themes on the stats page",
    shelved: "Shelved",
    railNew: "New theme",
    railNewHint: "One sentence is enough",
    currentList: "Current List",
    confirmed: "Confirmed",
    draft: "Draft",
    confirmList: "Confirm list",
    adjust: "Adjust in a sentence",
    goTodayPack: "Go to today's pack",
    goTodayPackHint:
      "Today's pack draws chapters from themes marked Priority or normal, split by each theme's daily budget. Shelved themes are left out.",
    statList: "List",
    statRead: "Finished",
    statPending: "To add",
    statBudget: "Daily budget",
    bookCount: (n: number) => `${n} ${n === 1 ? "book" : "books"}`,
    unitMinutes: "min",
    save: "Save",
    readingProgress: "Reading progress",
    progressMeta: (done: number, total: number, pct: number) =>
      `${done} / ${total} items · ${pct}%`,
    progressExtra: (n: number) => `${n} skipped or shelved`,
    path: "Path",
    list: "List",
    viewLabel: "List view",
    refresh: "Refresh",
    recommend: "Let AI recommend books",
    recommending: "Recommending…",
    unknownBook: "Unknown title",
    wereadChip: "WeRead",
    readingPath: "Reading Path",
    readingList: "Reading List",
    genPoints: "Key points",
    genPointsBusy: "Generating…",
    stateReading: "Reading",
    stateUnread: "Not started",
    stateSkipped: "Skipped",
    stateShelved: "Shelved",
    stateDone: "Finished",
    statePending: "To add",
    uploaded: "Uploaded",
    locked: "Locked",
    notInLibrary: "Not in library",
    pointsPending: "Key points pending",
    chapterProgress: (current: number, total: number, pct: number) =>
      `Ch. ${current}/${total} · ${pct}%`,
    readOnWeread: "Read on WeRead →",
    goUpload: "Upload →",
    startReading: "Start reading",
    continueReading: "Continue reading",
    reread: "Read again",
    moveUp: "↑ Up",
    moveDown: "↓ Down",
    replace: "Swap",
    replacing: "Swapping…",
    lock: "Lock",
    unlock: "Unlock",
    shelve: "Shelve",
    restore: "Restore",
    remove: "Delete",
    confirmReplace: (title: string) =>
      `Swapping will replace “${title}” with a new AI recommendation.`,
    confirmDelete: (title: string) =>
      `Remove “${title}” from this list? This can't be undone here.`,
    confirmReplaceOk: "Swap",
    confirmDeleteOk: "Delete",
    adjustSummary: "Adjust the list in a sentence",
    adjustPlaceholder:
      "One-line hint, e.g. more theoretical, easier, or more practical",
    regenerate: "Regenerate",
    regenerating: "Generating…",
    apply: "Apply",
    discard: "Discard",
    undoRegen: "Undo last regeneration",
    helpSummary: "How list controls work",
    helpMove: "Up / Down: change this book's place in the reading order.",
    helpReplace:
      "Swap: ask AI to pick a new book for this slot, keeping continuity with the books around it and avoiding duplicates.",
    helpLock:
      "Lock: pin this item so AI won't move or replace it when regenerating.",
    helpShelve:
      "Shelve: set it aside for now and restore it whenever you're ready.",
    helpPending:
      "To add: this book isn't in your library yet. Upload the EPUB, then hit Refresh to make it readable.",
    helpDelete: "Delete: remove this item from the list.",
    statusHelp:
      "Mark themes you want to read first as Priority, and pause others as Shelved. Shelved themes won't enter today's pack. Regenerate in Today after changing.",
    emptyThemes:
      "No themes yet. Hit “New theme” in the top-right to start building a list.",
    emptyList:
      "Nothing here yet. AI will recommend 5–6 books based on your description, ordered from easy to hard; you can edit them one by one afterwards.",
    listNoBooks:
      "None of these books can be read yet: there's no matching EPUB in your library and no WeRead match. Upload them, then hit Refresh to match by title automatically.",
    budgetInvalid: "Daily reading budget must be between 5 and 180 minutes.",
    replaced: (title: string) =>
      title ? `Swapped in “${title}”.` : "Swapped in a new book.",
    replaceFailed: (error: string | number) => `Swap failed: ${error}`,
    budgetSaved:
      "Budget saved. Hit Regenerate to apply it right away; otherwise it takes effect tomorrow.",
    budgetSaveFailed: (error: string | number) => `Couldn't save: ${error}`,
    budgetHelp:
      "Budget × reading speed decides how much you read each day. Hit Regenerate to apply now; otherwise it takes effect tomorrow.",
    itemUpdateFailed: (error: string | number) => `Update failed: ${error}`,
    statusUpdated: (status: string) =>
      status === "shelved"
        ? "Shelved: this theme won't enter today's pack, and your reading history is kept."
        : status === "priority"
          ? "Marked as priority."
          : "Back to normal order.",
    deleteConfirm: (name: string) =>
      `Delete the theme “${name}” and its list? This can't be undone.`,
    deleted: (name: string) => `Deleted “${name}”.`,
    deleteFailed: (error: string | number) => `Delete failed: ${error}`,
    createFailed: (error: string | number) => `Couldn't create: ${error}`,
    listGenerated: (hint?: string) =>
      ["Draft list generated. Review and adjust it as needed.", hint]
        .filter(Boolean)
        .join(" "),
    listGenerateFailed: (error: string | number) =>
      `Couldn't generate: ${error}`,
    refreshed: (matched: number) => `Refreshed: ${matched} items are readable.`,
    refreshFailed: (error: string | number) => `Refresh failed: ${error}`,
    regenFailed: (error: string | number) => `Regeneration failed: ${error}`,
    regenApplied: "List replaced. You can undo it below.",
    regenApplyFailed: (error: string | number) =>
      `Couldn't replace: ${error}`,
    regenUndone: "Undone. The list is back to how it was.",
    regenUndoFailed: (error: string | number) =>
      `Couldn't undo: ${error}`,
    confirmFailed: (error: string) => `Couldn't confirm: ${error}`,
    confirmedMsg: "List confirmed. Future reading follows this list.",
    keyPointsRunning: "List confirmed. Extracting key points…",
    keyPointsDone: (n: number) =>
      n > 0 ? `Key points generated for ${n} books.` : "Nothing to generate.",
    keyPointsFailed: (error: string | number) =>
      `Key points failed: ${error}`,
    regenPreview: (kept: number, removed: number) =>
      `Keeping ${kept}, replacing ${removed}, adding:`,
    completionBanner: (name: string) =>
      `You've finished the list for “${name}”`,
    completionSub: (count: number) => `${count} items`,
    domainSaveFailed: (error: string | number) =>
      `Couldn't save domain: ${error}`,
    domainUpdated: (domain: string) => `Domain set to “${domain}”`,
    uncategorized: "Uncategorized",
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

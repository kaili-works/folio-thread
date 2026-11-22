import type { Dict } from "./index";

// 英文文案：结构与 zh.ts 一一对应，缺键或多键都会在类型检查时报错。
export const en: Dict = {
  nav: {
    brandAlt: "",
    themes: "Themes & lists",
    library: "Library",
    today: "Today's reading",
    stats: "Stats",
    market: "Book-list market",
    libraryShort: "Library",
    notes: "Notes",
    guide: "Guide",
    account: "Account",
    logout: "Sign out",
    newTheme: "New",
    todayShort: "Today",
    switchLanguage: "Switch language",
  },
  themes: {
    kicker: "Themes & lists",
    title: "Themes & reading lists",
    nameLabel: "Theme name",
    namePlaceholder: "e.g. Urban sociology",
    descLabel: "Describe the theme in your own words",
    descPlaceholder:
      "e.g. A beginner's path into how cities work and how people live in them",
    createHelp:
      "Describe your reading theme in plain language. After creating it, hit “Let AI recommend books” and the model will pick 5–6 titles ordered from easy to hard. You can adjust or regenerate later; once the list is confirmed, upload the EPUBs to your library. If an EPUB isn't available but WeRead has the book, today's reading will link to WeRead directly.",
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
    todayPackRule:
      "How today's reading is built: while any list is marked Priority, chapters come only from priority lists, split by each list's daily budget — nothing else is scheduled. With no priority list, every active list takes part. Shelved lists are always skipped.",
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
      "Mark themes you want to read first as Priority, and pause others as Shelved. Shelved themes won't enter today's reading. Regenerate in Today after changing.",
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
        ? "Shelved: this theme won't enter today's reading, and your reading history is kept."
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
    regenerate: "Regenerate today's reading",
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
      "Counted automatically from your reading time. Reading the planned minutes completes today's portion.",
    manualTrack:
      "Reading time isn't available right now, so you can drag to adjust.",
    loading: "Loading today's reading…",
    retry: "Retry",
    offline:
      "You're offline, so today's reading can't be loaded. It will recover when you're back online.",
    loadFailed:
      "Couldn't load today's reading. Check your connection and try again.",
    cachedHint: (date: string) =>
      `Showing the version cached on ${date}. It will refresh once you're back online.`,
    empty:
      "Nothing scheduled for today yet. Once your theme list has readable books, today's chapters will be generated automatically.",
    emptyNoTheme:
      "You don't have a theme yet. Create one and we'll build an ordered list for it, starting tomorrow.",
    emptyNoBooks:
      "Your theme and list are ready, but none of the books are readable yet. Upload an EPUB or match a WeRead source to slice today's chapters.",
    flow: "The path: create a theme → generate and confirm a list → upload books → fresh reading every day.",
    goThemes: "Themes & lists",
    goLibrary: "Library",
    createTheme: "Create your first theme",
    uploadBook: "Upload in Library",
    viewList: "View list",
    generate: "Generate today's reading",
    generateEmpty:
      "Nothing readable yet. Generate a list in your theme and upload books first.",
    generated: "Today's reading has been re-planned from your current list.",
    generateFailed: (error: string | number) => `Generation failed: ${error}`,
    noReadable: "Nothing readable in today's reading yet. Add books in your library first.",
    doneTitle: "Today's reading is done",
    doneSub: (chapters: number) =>
      `All ${chapters} chapters planned for today are finished. See you tomorrow.`,
    regenHelp:
      "Want more or less? Regenerating keeps your progress: chapters finished today stay counted and won't be scheduled twice. A new day's reading also rolls over automatically at midnight.",
    prefsKicker: "Reading pace",
    prefsUnit: "words / min",
    save: "Save",
    speedInvalid: "Reading speed must be between 100 and 1000 words per minute.",
    speedSaved: "Saved. Daily word estimates will use this speed.",
    speedSaveFailed: (error: string | number) => `Save failed: ${error}`,
    speedHelp:
      "This works with each theme's daily budget to split today's reading (budget × speed = words per day). Regenerate today's reading to apply changes; adjust budgets in Themes & lists.",
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
      "These books are on your reading lists but aren't in the library yet. Upload the EPUBs, then hit Refresh in Themes & lists to match them automatically.",
    pendingFrom: (themes: string[]) => `From: ${themes.join(", ")}`,
    unknownAuthor: "Unknown author",
    expandAll: (n: number) => `Show all ${n}`,
    collapse: "Show less",
    emptyTitle: "Upload your first EPUB",
    empty:
      "Your library is empty. The path is: create a theme → generate and confirm a list → upload the EPUBs → a new reading is generated each day.",
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
    loginIntro: "Sign in to pick up today's reading.",
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
  stats: {
    kicker: "Stats",
    title: "Reading stats",
    loading: "Loading…",
    loadFailed: "Failed to load stats",
    classifyBtn: (n: number) => `Classify ${n} themes with AI`,
    classifying: "Classifying…",
    classifyHint:
      "Runs one AI classification call; unavailable without DEEPSEEK_API_KEY",
    classifyNoKey:
      "DEEPSEEK_API_KEY is not configured, so themes cannot be classified automatically (see the AI setup in README)",
    classifyFailed: "Classification failed. Please try again later.",
    exportRead: "Export finished list",
    exportTitle: "# Finished reading",
    exportFileName: "finished-reading.md",
    overallLabel: "All themes",
    overallMeta: (done: number, total: number, finished: number, themes: number) =>
      `${done}/${total} items · ${finished}/${themes} themes finished`,
    finishedTitle: "Finished",
    finishedCount: (n: number) => `${n} ${n === 1 ? "book" : "books"}`,
    lastFinished: (date: string) => ` · last finished ${date}`,
    allDoneTitle: "Every reading list is finished",
    allDoneSub: "You can start a new theme now.",
    statBooks: "Books finished",
    statChapters: "Chapters finished",
    statWords: "Words finished",
    unitBook: "books",
    unitChapter: "chapters",
    unitWord: "words",
    statNote: (translated: string) =>
      `Chinese is counted by characters and other languages by words; unfinished chapters are excluded. Translations estimated at ${translated} words.`,
    domainKicker: "Domain baskets",
    domainHint: "Click a card to pull it out, click again to open the list",
    domainNotReady:
      "Domain classification is not enabled yet: run database/0008_theme_domain.sql in the Supabase SQL Editor (adds a domain column to themes), then refresh and it classifies automatically.",
    domainMeta: (lists: number, books: number, pct: number) =>
      `${lists} ${lists === 1 ? "list" : "lists"} · ${books} ${books === 1 ? "book" : "books"} · ${pct}% done`,
    basketMeta: (total: number, completed: number) =>
      `${total} ${total === 1 ? "book" : "books"} · ${completed} read`,
    priorityTag: "Priority",
    keyPoints: (n: number) => `${n} key points`,
    emptyBox: "Empty",
    booksCount: (n: number) => `${n} ${n === 1 ? "book" : "books"}`,
    close: "Close",
    itemsProgress: (done: number, total: number) => `${done}/${total} items`,
    drawerEmpty: "This list has no books yet.",
    drawerEditDomain: "Change the domain:",
    drawerGoThemes: "Themes & lists →",
    noItems: "Nothing to read yet — generate a list from a theme first.",
    noThemes: "No themes yet. Progress shows up here once you create one.",
    noFinished: "No finished books yet.",
    stateDone: "Finished",
    stateReading: "Reading",
    stateSkipped: "Skipped",
    stateShelved: "Shelved",
    statePending: "Needs EPUB",
    stateNotStarted: "Not started",
    wereadProgress: (pct: number) => `WeRead ${pct}%`,
  },
  notes: {
    kicker: "Notes",
    title: "My notes",
    summary: (total: number, books: number) =>
      `${total} ${total === 1 ? "note" : "notes"} across ${books} ${books === 1 ? "book" : "books"}`,
    export: "Export Markdown",
    exportTitle: "# My notes",
    exportFileName: "my-notes.md",
    loading: "Loading…",
    empty:
      "No notes yet. Highlight some text while reading and notes collect here.",
    count: (n: number) => `${n} ${n === 1 ? "note" : "notes"}`,
  },
  bookNotes: {
    kicker: "Notes",
    back: "← Back to reading",
    titleFallback: "Book notes",
    notFound: "This book could not be found — it may be deleted or private.",
    loadFailed: "Failed to load. Please try again later.",
    retry: "Retry",
    loading: "Loading…",
    empty: "No notes yet. Highlight a paragraph while reading to add one.",
    export: "Export Markdown",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    remove: "Delete",
    confirmDelete: "Delete this note?",
    deleteFailed: (error: string) => `Delete failed: ${error}`,
    saveFailed: (error: string) => `Save failed: ${error}`,
    emptyComment: "(No comment, highlight only)",
    paragraphRef: (order: number) => `Paragraph ${order}`,
    exportTitle: (title: string) => `# Notes on ${title}`,
    exportParagraph: (order: number, excerpt: string) =>
      `### Paragraph ${order} · "${excerpt}…"`,
    exportFileName: (title: string) => `${title} - notes.md`,
    exportFileFallback: "notes",
  },
  market: {
    kicker: "Book-list market",
    title: "Reading path ideas",
    intro:
      "Curated theme reading lists, ready to become your own; or generate a fresh one at random.",
    loadFailed: "Failed to load lists. Please try again later.",
    applied: (name: string) =>
      `Added “${name}” to your themes — open Themes & lists to review or refresh matches.`,
    applyFailed: (error: string) => `Failed to use: ${error}`,
    randomFailed: (error: string) => `Generation failed: ${error}`,
    generating: "Generating with AI…",
    randomCta: "Generate a random list",
    randomKicker: "AI generated",
    using: "Adding…",
    useList: "Use this list",
    regenerate: "Try another",
    regenerating: "Generating…",
    booksLabel: "Books",
    budgetLabel: "Daily budget",
    booksCount: (n: number) => `${n} ${n === 1 ? "book" : "books"}`,
    minutes: (n: number) => `${n} min`,
    perDay: (n: number) => `${n} min a day`,
    afterUseTip:
      "After adding it, you can fine-tune order and budget in Themes & lists.",
    loading: "Loading…",
    expand: "Show books",
    pendingTip:
      "Books in these lists start as “Needs EPUB”. Open Themes & lists and hit Refresh to match books already in your library.",
    goThemes: "Go to my themes & lists →",
  },
  guide: {
    kicker: "Guide · How it works",
    aria: "Guide",
    close: "Close guide",
    startTitle: "Four steps to start today's reading",
    startLead:
      "You don't need a finished list or a finished book. Follow the sequence once and a daily reading rhythm forms.",
    prev: "Back",
    readerTab: "Reader features →",
    finish: "Start reading",
  },
  onboarding: {
    kicker: ["Before you start", "How it works", ""],
    step: (n: number) => `${n} / 3`,
    closeLabel: "Close onboarding",
    aria: "Onboarding",
    slideLabel: (n: number) => `Slide ${n}`,
    title: "Hi, welcome to FolioThread",
    intro:
      "Build a sequence of books around a theme you care about, and read a small portion every day.",
    steps: [
      {
        title: "Create a theme",
        text: "Create the theme you want to explore in Themes & lists. Short on ideas? Browse the book-list market for ready-made lists.",
      },
      {
        title: "Generate and confirm a list",
        text: "Describe the topic in your own words and hit “Recommend with AI”. The model picks 5–6 books and orders them from easier to harder.",
      },
      {
        title: "Upload books and match",
        text: "Upload EPUBs for the pending books in your Library; the app splits them into daily portions automatically.",
      },
      {
        title: "Generate today's reading and start",
        text: "Open Today, generate today's reading, and start on today's portion.",
      },
    ],
    startTitle: "Start your tailored reading journey",
    startCta: "Let's start",
    prev: "Back",
    next: "Continue",
    readerTitle: "Reader tips",
    readerLead:
      "After the four steps, everyday reading happens in the reader: it opens on today's portion, with translation, audio, progress and notes along the way.",
    reader: [
      {
        label: "Today's portion",
        text: "The reader opens on today's share; tap “Finish chapter” at the bottom to count it toward today's progress.",
      },
      {
        label: "Whole-chapter translation",
        text: "Books in other languages are translated chapter by chapter; switch back to the original anytime. Machine translation can be imperfect.",
      },
      {
        label: "Audio",
        text: "Speech tries Azure first when it's configured, then a local Edge TTS install, then Baidu as the last cloud option; if none of them works, it falls back to the browser's built-in voices. Speed is adjustable, and the default rain ambience can be turned off, switched to piano, or replaced with your own audio file.",
      },
      {
        label: "WeRead",
        text: "When a list item has no EPUB but exists on WeRead, the link opens it there; reading time and progress are tracked automatically.",
      },
      {
        label: "Paragraph notes",
        text: "Select a whole paragraph to add a note. Notes collect under My notes, grouped by book, and export to Markdown.",
      },
    ],
  },
  reader: {
    // 侧栏与目录
    backToday: "← Today's reading",
    notFound: "This book doesn't exist or you don't have access",
    loading: "Loading…",
    langZh: "Original text",
    langOther: "Machine translation",
    chaptersMeta: (total: number, read: number) =>
      `${total} chapter${total === 1 ? "" : "s"} · ${read} read`,
    progressChapters: (read: number, total: number) =>
      `${read} / ${total} chapters`,
    readingNow: "Reading",
    sliceLabel: (start: number, end: number) =>
      `Today's portion · chapters ${start}–${end}`,
    completedSection: "Completed",
    collapseOthers: "Hide other chapters",
    expandAllChapters: (n: number) => `Show all ${n} chapters`,
    contents: "Contents",
    // 工具栏
    chapterLabel: (order: number) => `Chapter ${order}`,
    bodyLabel: "Text",
    listen: "Audio",
    original: "Original",
    translate: "Translate",
    translating: "Translating…",
    translateTitle:
      "Runs one AI translation call; unavailable without DEEPSEEK_API_KEY",
    settings: "Settings",
    fontSizeLabel: "Font size",
    fontSizeDown: "Decrease font size",
    fontSizeUp: "Increase font size",
    themeLabel: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    // 正文
    paragraphsHint: (n: number) =>
      `${n} paragraph${n === 1 ? "" : "s"} · tap a paragraph to add a note`,
    machineTag: " · Machine translation, for gist only",
    slowLoad: "The connection is slow — still loading this chapter. Please wait…",
    // 笔记
    notePanelTitle: (order: number) => `Add a note · paragraph ${order}`,
    notePlaceholder: "Write a thought… (leave blank to just highlight)",
    saveNote: "Save note",
    noteSaved: "Saved.",
    noteFailed: (error: string | number) => `Couldn't save: ${error}`,
    sessionExpired: "Your session has expired. Please sign in again.",
    // 完成本章与翻页
    chapterDone: "Chapter finished",
    submitting: "Submitting…",
    completeChapter: "Finish chapter",
    prevChapter: "Previous chapter",
    nextChapter: "Next chapter",
    completedFallback: "Done — counted toward your stats",
    offlineSaved: "Saved offline; it will sync when you're back online.",
    bookCompleted:
      "You've finished this book. Open Book notes to review or export your notes.",
    chapterCompleted: "Chapter finished and counted toward today's progress.",
    completeFailed: (error: string | number) => `Couldn't submit: ${error}`,
    // 空态与提示
    empty: "Loading reader",
    completeGuide:
      "When you finish a chapter, tap Finish chapter at the bottom to count it toward today's progress.",
    offlineHint:
      "Offline mode: showing the cached chapter text. Translations are available when you're back online.",
    translateFailed:
      "Translation is temporarily unavailable, so the original text is shown. It will retry automatically when you turn the page.",
    noApiKey:
      "DEEPSEEK_API_KEY is not configured, so translation is unavailable (see the AI setup in README)",
  },
  audio: {
    kicker: "Listen",
    open: "Listen",
    collapse: "Close",
    position: (i: number, total: number) => `Paragraph ${i} of ${total}`,
    preparing: "Preparing…",
    localVoice: "Browser voice",
    prevSegment: "Previous",
    play: "Play",
    pause: "Pause",
    nextSegment: "Next",
    voice: "Voice",
    fallbackVoice: "Chinese female",
    rate: (value: string) => `Speed ${value}×`,
    music: "Background music",
    musicOff: "Off",
    musicRain: "Rain / white noise",
    musicPiano: "Minimal piano",
    localTrack: (name: string) => `Local: ${name}`,
    localMusic: "Local file…",
    musicVolume: (pct: number) => `Music volume ${pct}%`,
    synthFailed: "Speech synthesis failed",
    unsupported: "This browser does not support speech playback",
    systemFailed:
      "System speech cannot play — check your device's text-to-speech settings",
    cloudFallback:
      "Cloud speech is unavailable; switched to the browser voice",
  },
  account: {
    kicker: "Account",
    title: "Account & data",
    intro: "Check the email you signed in with, or delete the whole account.",
    emailLabel: "Email",
    loading: "Loading account…",
    signedOutHint: "Your session has expired. Please sign in again.",
    dataTitle: "Your data",
    dataBody:
      "Your library and EPUBs, notes, themes and lists, and reading progress live only under your account; they never appear in anyone else's lists.",
    dangerKicker: "Danger zone",
    deleteTitle: "Delete account",
    deleteBody:
      "Deleting removes the account itself, your library and uploaded EPUBs, notes, themes and lists, and reading progress. This can't be undone.",
    deleteCta: "Delete my account",
    confirmTitle: "Confirm account deletion",
    confirmBody: (email: string) =>
      `Type ${email} to confirm. This cannot be undone.`,
    confirmPlaceholder: "Type your email again",
    cancel: "Cancel",
    confirmCta: "Delete permanently",
    deleting: "Deleting…",
    mismatch: "That email doesn't match. Try again.",
    failed: (error: string | number) => `Couldn't delete the account: ${error}`,
  },
  common: {
    closeHint: "Dismiss hint",
  },
};

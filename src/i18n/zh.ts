// 中文文案。新增文案先加到这里，再在 en.ts 补对应英文，类型会强制两边对齐。
export const zh = {
  nav: {
    themes: "主题与清单",
    library: "我的书库",
    today: "今日阅读包",
    stats: "统计",
    market: "书单市集",
    libraryShort: "书库",
    notes: "笔记",
    guide: "指南",
    logout: "退出",
    newTheme: "新建",
    todayShort: "今日",
    switchLanguage: "切换语言",
  },
  today: {
    title: "今日阅读",
    metaChapters: (chapters: number, minutes: number) =>
      `${chapters} 章 · 约 ${minutes} 分钟`,
    metaItems: (items: number, minutes: number) =>
      `${items} 份 · 约 ${minutes} 分钟`,
    regenerate: "重新生成今日包",
    settings: "阅读偏好",
    generating: "生成中…",
    progressChapters: (pct: number, done: number, total: number) =>
      `已完成 ${pct}% · ${done} / ${total} 章`,
    progressPlain: (pct: number) => `已完成 ${pct}%`,
    plannedMinutes: (minutes: number) => `预计 ${minutes} 分钟`,
    readingOrder: (n: number) => `阅读顺序 ${String(n).padStart(2, "0")}`,
    chapterOne: (chapter: number, minutes: number) =>
      `第 ${chapter} 章 · ${minutes} 分钟`,
    chapterRange: (start: number, end: number, minutes: number) =>
      `第 ${start}–${end} 章 · ${minutes} 分钟`,
    wereadChip: (minutes: number) => `微信读书 · 建议 ${minutes} 分钟`,
    startReading: "开始阅读",
    openWeread: "去微信读书阅读",
    unknownBook: "未知书名",
    unknownTheme: "未知主题",
    todayReading: "今日阅读",
    ariaMinutes: "今日已读分钟",
    minutesRead: (minutes: number, planned: number) =>
      `今日已读 ${minutes} / ${planned} 分钟`,
    autoTracked:
      "按阅读时长自动计算，读满计划分钟就算完成今天这一档。",
    manualTrack: "暂时读不到微信读书的阅读时长，可以手动拖一下。",
    loading: "正在读取今日包…",
    retry: "重试",
    offline: "当前处于离线状态，无法读取今日包；联网后会自动恢复。",
    loadFailed: "今日包读取失败，请检查网络后重试。",
    cachedHint: (date: string) =>
      `显示 ${date} 缓存的今日包；联网或服务恢复后会自动刷新。`,
    empty:
      "今天还没有可排的阅读包。确认主题清单、书库里也有对应的书之后，系统会自动生成今天的份额。",
    emptyNoTheme:
      "还没有研究主题。先创建一个主题，让系统按主题生成书单，明天就会自动排进今日包。",
    emptyNoBooks:
      "主题和清单都有了，但清单里的书还读不了。上传 EPUB 或匹配到微信读书后，才能切出今天的章节。",
    flow: "顺序是：创建主题 → 生成并确认清单 → 上传图书 → 今日包每天自动生成。",
    goThemes: "主题与清单",
    goLibrary: "书库",
    createTheme: "创建第一个主题",
    uploadBook: "去书库上传",
    viewList: "查看清单",
    generate: "生成今日阅读包",
    generateEmpty: "暂无可读材料。先到主题里生成清单、上传图书。",
    generated: "已按当前清单重新排好今天的份额。",
    generateFailed: (error: string | number) => `生成失败：${error}`,
    noReadable: "这个包里暂时没有可读材料，先到书库补充图书。",
    doneTitle: "今日份阅读已完成",
    doneSub: (chapters: number) => `今天安排的 ${chapters} 章都读完了，明天继续。`,
    regenHelp:
      "想多读一点或换换份量，可以重新生成：已读进度不会清零，今天读完的章节会保留并计入进度，也不会重复安排。不手动点也会在每天零点自动换成新一天的包。",
    prefsKicker: "阅读偏好",
    prefsUnit: "字 / 分钟",
    save: "保存",
    speedInvalid: "阅读速度需在 100~1000 字/分钟之间。",
    speedSaved: "已保存。将按此速度估算每天可读的字数。",
    speedSaveFailed: (error: string | number) => `保存失败：${error}`,
    speedHelp:
      "它与各主题的「每日预算」共同决定今日包的切分（预算 × 速度 = 每日可读字数）。修改后点今日包上的「重新生成」生效；每日预算在「主题与清单」里按主题调整。",
    quickKicker: "快捷",
    quickLibrary: "我的书库",
    quickNotes: "全部笔记",
    quickThemes: "主题与清单",
    statsKicker: "累计阅读",
    statsMore: "详细统计",
    statBooks: "读完整本",
    statChapters: "完成章节",
    statWords: "完成字数",
    unitBooks: "本",
    unitChapters: "章",
    words: (n: number) =>
      n >= 10000
        ? { value: (n / 10000).toFixed(1), unit: "万字" }
        : { value: n.toLocaleString("zh-CN"), unit: "字" },
  },
  library: {
    kicker: "你的书架",
    title: "我的书库",
    shelfMeta: (books: number, pending: number, words: string) =>
      `${books} 本藏书 · ${pending} 本待补充 · 累计 ${words}`,
    wordCount: (n: number) =>
      n >= 10000
        ? `${(n / 10000).toFixed(1)} 万字`
        : `${n.toLocaleString("zh-CN")} 字`,
    search: "搜索书库",
    closeSearch: "关闭搜索",
    searchPlaceholder: "搜索书名或作者",
    noResults: "没有找到匹配的书。",
    upload: "上传 EPUB",
    uploadTitle: "上传一本 EPUB",
    uploadLead:
      "单本 ≤ 50MB · 目前仅支持 .epub；PDF / MOBI / AZW3 / TXT 等格式请先自行转换为 EPUB 再上传。",
    uploadPrivacy:
      "仅上传你有权使用的文件；非中文材料在阅读时会发送给第三方 AI 服务（DeepSeek）进行机器翻译。",
    uploading: "上传解析中…",
    chooseFile: "选择文件",
    reselect: "重新选择",
    picked: (name: string, size: string) => `已选择：${name}（${size}）`,
    submit: "上传",
    submitting: "解析中…",
    shelfKicker: "书库",
    pendingKicker: "待补充",
    pendingBadge: "待补",
    pendingHelp:
      "这些阅读清单中的书还未上传书库。上传 EPUB 后到「主题与清单」点「刷新」可自动匹配。",
    pendingFrom: (themes: string[]) => `来自主题：${themes.join("、")}`,
    unknownAuthor: "未知作者",
    expandAll: (n: number) => `展开全部 ${n} 本`,
    collapse: "收起",
    emptyTitle: "先上传一本 EPUB",
    empty:
      "书库还是空的。顺序是：创建主题 → 生成并确认清单 → 按清单上传 EPUB → 今日包每天自动生成。",
    emptyLink: "去创建主题",
    loading: "正在读取书库…",
    pickFile: "请选择 EPUB 文件。",
    duplicate: (title: string) =>
      `这本书已在书库中：《${title}》，无需重复上传。`,
    uploadSuccess: (
      title: string,
      chapters: number | string,
      paragraphs: number | string,
    ) => `上传完成：《${title}》，共 ${chapters} 章、${paragraphs} 段。`,
    uploadFailed: (error: string | number) => `上传失败：${error}`,
    delete: "删除",
    deleteConfirm: "从书库删除这本书？",
    deleteFailed: (error: string | number) => `删除失败：${error}`,
  },
  auth: {
    brandKicker: "FolioThread",
    brandTitle: "页脉研读",
    brandLead: "围绕一个问题，每天读一小份。",
    steps: [
      "用一句话描述你想研究的主题",
      "由 AI 为你推荐序列书单",
      "每天按预算读一点，逐渐构建你的知识地图",
    ],
    foot: "主题研读导航 · 于书海中寻线织脉",
    loginTitle: "继续今天的阅读",
    loginIntro: "登录后回到今日阅读包。",
    registerTitle: "建立你的阅读档案",
    registerIntro: "注册后先描述一个主题，我们会为你排一份有序书单。",
    tabLogin: "登录",
    tabRegister: "注册",
    email: "邮箱",
    password: "密码",
    login: "登录",
    register: "注册",
    signingIn: "登录中…",
    creating: "注册中…",
    loginFailed: (error: string) => `登录失败：${error}`,
    registerFailed: (error: string) => `注册失败：${error}`,
    registerSuccess:
      "注册完成。请到邮箱点击确认链接后登录；若已关闭邮箱确认，可直接登录。",
  },
};

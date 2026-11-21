// 全站提示文案集中管理。调整语气时只改这里，页面只负责调用。
export const copy = {
  auth: {
    subtitle: "围绕一个问题，每天读一小份。",
    loginFailed: (error: string) => `登录失败：${error}`,
    registerFailed: (error: string) => `注册失败：${error}`,
    registerSuccess:
      "注册完成。请到邮箱点击确认链接后登录；若已关闭邮箱确认，可直接登录。",
  },

  onboarding: {
    kicker: ["开始之前", "使用方式", ""],
    step: (n: number) => `${n} / 3`,
    closeLabel: "关闭引导",
    title: "Hi，欢迎来到页脉研读",
    intro: "围绕你感兴趣的主题组建书籍序列，每天研读一小份。",
    steps: [
      {
        title: "创建主题",
        text: "在「主题与清单」创建你想深入研究的主题。如果一时没有灵感，可以去书单市集逛一逛。",
      },
      {
        title: "生成并确认清单",
        text: "用自然语言描述你感兴趣的阅读主题，点「AI 推荐书单」，大模型会推荐 5–6 本，并排好由浅入深的顺序。",
      },
      {
        title: "上传书并匹配",
        text: "根据清单中的待补充书籍到「书库」上传 EPUB，系统将自动为你拆解每日阅读份额。",
      },
      {
        title: "生成今日包，开始阅读",
        text: "到「今日」点「生成今日阅读包」，即可开始阅读今日份的章节。",
      },
    ],
    startTitle: "开始你的定制阅读之旅",
    startCta: "Let's start",
    prev: "上一步",
    next: "继续",
    readerTitle: "阅读器使用小贴士",
    readerLead:
      "四步走完之后，日常阅读都在阅读器里完成：默认停在今日份额，翻译、听书、进度和笔记随读随记。",
    reader: [
      {
        label: "今日切片",
        text: "打开阅读器默认停在今日份额，读完点底部「完成本章」就会计入今日进度。",
      },
      {
        label: "整章自动翻译",
        text: "非中文书籍由大模型整章翻译为中文，可随时切回原文；机器翻译可能会有不准确之处。",
      },
      {
        label: "听书",
        text: "语音优先使用 Edge TTS，不可用时自动改用百度语音源，仍不可用则退回浏览器本地语音；可调语速，默认雨声背景音可关闭或更换为本地音频。",
      },
      {
        label: "微信读书",
        text: "清单里没有 EPUB、但微信读书有书源时，链接会跳转微信读书阅读；系统会自动读取阅读时长并统计进度。",
      },
      {
        label: "段落笔记",
        text: "选中一整段即可写批注；笔记汇总在「我的笔记」，按书分组，可导出 Markdown。",
      },
    ],
  },

  today: {
    speedInvalid: "阅读速度需在 100~1000 字/分钟之间。",
    speedSaved: "已保存。将按此速度估算每天可读的字数。",
    speedSaveFailed: (error: string) => `保存失败：${error}`,
    speedHelp:
      "它与各主题的「每日预算」共同决定今日包的切分（预算 × 速度 = 每日可读字数）。修改后点今日包上的「重新生成」生效；每日预算在「主题与清单」里按主题调整。",
  },

  dailyPack: {
    empty:
      "今天还没有可排的阅读包。确认主题清单、书库里也有对应的书之后，系统会自动生成今天的份额。",
    emptyNoTheme:
      "还没有研究主题。先创建一个主题，让系统按主题生成书单，明天就会自动排进今日包。",
    emptyNoBooks:
      "主题和清单都有了，但清单里的书还读不了。上传 EPUB 或匹配到微信读书后，才能切出今天的章节。",
    flow: "顺序是：创建主题 → 生成并确认清单 → 上传图书 → 今日包每天自动生成。",
    generateEmpty: "暂无可读材料。先到主题里生成清单、上传图书。",
    generated: "已按当前清单重新排好今天的份额。",
    generateFailed: (error: string) => `生成失败：${error}`,
    confirmed: "今天的阅读任务已生效。",
    confirmFailed: (error: string) => `确认失败：${error}`,
    noReadable: "这个包里暂时没有可读材料，先到书库补充图书。",
    loadFailed: "今日包读取失败，请检查网络后重试。",
    offline: "当前处于离线状态，无法读取今日包；联网后会自动恢复。",
    cachedHint: (date: string) =>
      `显示 ${date} 缓存的今日包；联网或服务恢复后会自动刷新。`,
    retry: "重试",
    regenHelp:
      "想多读一点或换换份量，可以重新生成：已读进度不会清零，今天读完的章节会保留并计入进度，也不会重复安排。不手动点也会在每天零点自动换成新一天的包。",
    doneTitle: "今日份阅读已完成",
    doneSub: (chapters: number) => `今天安排的 ${chapters} 章都读完了，明天继续。`,
  },

  themes: {
    createHelp:
      "用自然语言写下你感兴趣的阅读主题。创建后点「让 AI 推荐书单」，模型会挑 5–6 本并按由浅入深排好顺序；之后可微调或重新生成，确认清单后再到书库补 EPUB。如果书库还没有 EPUB、但微信读书上有对应书源，今日包会直接使用微信读书链接。",
    statusHelp:
      "想先读的主题设为「优先」，暂时不读的设为「搁置」，搁置的主题不会排进今日包。改完到「今日」重新生成。",
    emptyThemes: "还没有主题。在上方写下想研究的问题，就能开始组书。",
    emptyList:
      "这里还空着。AI 会按你对主题的自然语言描述推荐 5–6 本，按由浅入深排好；生成后可以逐本删改。",
    listNoBooks:
      "这份清单里的书还不能读：书库没有对应的 EPUB，也没匹配到微信读书。上传后再点「刷新」，系统会自动按书名匹配。",
    budgetInvalid: "每日阅读预算需在 5~180 分钟之间。",
    replaced: (title: string) => (title ? `已换成《${title}》。` : "已换一本。"),
    replaceFailed: (error: string | number) => `换书失败：${error}`,
    budgetSaved:
      "预算已保存。点「重新生成」立即按新预算切分，不点则次日自动生效。",
    budgetSaveFailed: (error: string) => `保存失败：${error}`,
    budgetHelp:
      "预算 × 阅读速度决定每天读多少；改完点「重新生成」立即生效，否则次日自动生效。",
    itemUpdateFailed: (error: string) => `更新失败：${error}`,
    statusUpdated: (status: string) =>
      status === "shelved"
        ? "已搁置：该主题不再排入今日包，已完成的阅读记录会保留。"
        : status === "priority"
          ? "已设为优先。"
          : "已恢复正常排序。",
    deleteConfirm: (name: string) =>
      `删除主题「${name}」及其清单？此操作不可撤销。`,
    deleted: (name: string) => `已删除主题「${name}」。`,
    deleteFailed: (error: string) => `删除失败：${error}`,
    createFailed: (error: string) => `创建失败：${error}`,
    listGenerated: (hint?: string) =>
      ["清单草稿已生成，可以检查并调整。", hint].filter(Boolean).join(" "),
    listGenerateFailed: (error: string) => `生成失败：${error}`,
    refreshed: (matched: number) => `刷新完成：${matched} 项已可读。`,
    refreshFailed: (error: string) => `刷新失败：${error}`,
    regenFailed: (error: string) => `重新生成失败：${error}`,
    regenApplied: "已替换清单，可在下方撤销。",
    regenApplyFailed: (error: string) => `替换失败：${error}`,
    regenUndone: "已撤销，清单恢复原样。",
    regenUndoFailed: (error: string) => `撤销失败：${error}`,
    confirmFailed: (error: string) => `确认失败：${error}`,
    confirmed: "清单已确认，后续阅读按此清单安排。",
    keyPointsRunning: "清单已确认，正在从章节标题提炼知识点…",
    keyPointsDone: (n: number) =>
      n > 0 ? `已为 ${n} 本书生成知识点。` : "没有需要生成的知识点。",
    keyPointsFailed: (error: string) => `知识点生成失败：${error}`,
    regenPreview: (kept: number, removed: number) =>
      `保留 ${kept} 项，替换 ${removed} 项，新增如下：`,
    completionBanner: (name: string) => `《${name}》的清单已读完`,
    completionSub: (count: number) => `共 ${count} 项`,
  },

  library: {
    pickFile: "请选择 EPUB 文件。",
    duplicate: (title: string) => `这本书已在书库中：《${title}》，无需重复上传。`,
    uploadSuccess: (
      title: string,
      chapters: number | string,
      paragraphs: number | string,
    ) => `上传完成：《${title}》，共 ${chapters} 章、${paragraphs} 段。`,
    uploadFailed: (error: string) => `上传失败：${error}`,
    deleteConfirm: "从书库删除这本书？",
    deleteFailed: (error: string) => `删除失败：${error}`,
    pendingHelp:
      "这些阅读清单中的书还未上传书库。上传 EPUB 后到「主题与清单」点「刷新」可自动匹配。",
    uploadedHelp: "已上传的 EPUB 都在这里，点击书名即可打开阅读。",
    empty:
      "书库还是空的。顺序是：创建主题 → 生成并确认清单 → 按清单上传 EPUB → 今日包每天自动生成。",
    emptyLink: "去创建主题",
  },

  market: {
    intro:
      "这里整理了搭配好的主题书单，选中即可转为你的清单；也可以随机生成一份新的。",
    loadFailed: "书单加载失败，请稍后重试。",
    applied: (name: string) =>
      `已将《${name}》加入主题清单，可到「主题与清单」查看或刷新匹配。`,
    applyFailed: (error: string) => `使用失败：${error}`,
    randomFailed: (error: string) => `生成失败：${error}`,
  },

  stats: {
    noItems: "暂无可推进的清单项，先到主题里生成清单。",
    noThemes: "还没有主题。创建后会在这里显示进度。",
    noNotes: "还没有笔记。阅读时选中一段即可记录。",
    noFinished: "还没有读完的书。",
  },

  reader: {
    empty: "阅读器加载中",
    completeGuide: "读完本章后，点底部「完成本章」，会计入今日进度。",
    noteSaved: "已保存。",
    noteFailed: (error: string) => `保存失败：${error}`,
    sessionExpired: "登录已失效，请重新登录。",
    offlineSaved: "已离线记录，联网后会自动同步。",
    bookCompleted: "本书已读完，可在「本书笔记」中查看或导出笔记。",
    chapterCompleted: "本章已完成，已计入今日进度。",
    completeFailed: (error: string) => `提交失败：${error}`,
    offlineHint: "离线模式：显示已缓存章节原文，联网后可查看译文。",
    translateFailed: "翻译暂时不可用，已显示原文；稍后翻页会自动重试。",
  },
};

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

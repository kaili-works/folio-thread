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
  auth: {
    brandKicker: "FolioThread",
    brandTitle: "Read with direction.",
    brandLead: "One question, a little reading every day.",
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

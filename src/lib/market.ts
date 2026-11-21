// 书单市集：预置的「主题 + 已搭配书单」模板，供会员一键克隆成自己的主题与清单。
// demo 阶段用硬编码模板，避免引入新的发布/审核数据模型。

export type MarketTemplate = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  daily_budget_minutes: number;
  books: { title: string; author: string; reason: string }[];
};

export const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    id: "ai-intro",
    name: "AI 入门",
    tagline: "从科普到经典教材，循序渐进建立 AI 认知",
    description: "零基础入门人工智能，先建立直觉，再进入经典教材。",
    daily_budget_minutes: 30,
    books: [
      { title: "智能时代", author: "吴军", reason: "从历史视角讲清数据与智能的关系，建立整体直觉。" },
      { title: "AI 3.0", author: "梅拉妮·米歇尔", reason: "澄清 AI 的能与不能，纠正常见误解。" },
      { title: "机器学习", author: "周志华", reason: "中文经典「西瓜书」，打牢机器学习基础。" },
      { title: "人工智能：一种现代方法", author: "Russell & Norvig", reason: "领域标准教材，系统覆盖核心主题。" },
      { title: "深度学习", author: "Goodfellow 等", reason: "进阶深度学习，承接前面的机器学习基础。" },
    ],
  },
  {
    id: "cognitive-science",
    name: "认知科学",
    tagline: "理解大脑如何思考、判断与决策",
    description: "从行为经济学到认知心理学，理解人的思维机制。",
    daily_budget_minutes: 25,
    books: [
      { title: "思考，快与慢", author: "丹尼尔·卡尼曼", reason: "双系统思维模型，理解直觉与理性的分工。" },
      { title: "认知觉醒", author: "周岭", reason: "通俗讲清大脑结构与学习机制，适合起步。" },
      { title: "表象与本质", author: "侯世达", reason: "探讨类比如何驱动思维，深化认知理解。" },
      { title: "超越智商", author: "基思·斯坦诺维奇", reason: "理性与智力的区别，补全决策心理学的框架。" },
      { title: "思考的框架", author: "沙恩·帕里什", reason: "可复用的思维模型工具箱，便于落地实践。" },
    ],
  },
  {
    id: "psychology",
    name: "心理学基础",
    tagline: "从教材体系到日常应用，理解自己与他人",
    description: "先建立心理学的基本框架，再进入社会心理与自我理解。",
    daily_budget_minutes: 25,
    books: [
      { title: "心理学与生活", author: "菲利普·津巴多", reason: "体系完整的入门教材，先建立心理学的整体框架。" },
      { title: "社会心理学", author: "戴维·迈尔斯", reason: "理解他人与群体如何影响我们的判断与行为。" },
      { title: "影响力", author: "罗伯特·西奥迪尼", reason: "讲清说服的六种机制，学会识别日常中的操控。" },
      { title: "被讨厌的勇气", author: "岸见一郎 / 古贺史健", reason: "用对话体讲阿德勒心理学，理解课题分离。" },
      { title: "也许你该找个人聊聊", author: "洛莉·戈特利布", reason: "从咨询现场看情绪与改变如何真实发生。" },
    ],
  },
  {
    id: "economics",
    name: "经济学思维",
    tagline: "用成本、激励与稀缺性重新理解世界",
    description: "从通俗入门到经典原理，建立经济学思维方式。",
    daily_budget_minutes: 30,
    books: [
      { title: "小岛经济学", author: "彼得·希夫", reason: "用故事讲清经济如何运转，入门无门槛。" },
      { title: "薛兆丰经济学讲义", author: "薛兆丰", reason: "中文语境下的经济学常识，案例贴近生活。" },
      { title: "经济学原理", author: "曼昆", reason: "标准入门教材，系统掌握供需与市场机制。" },
      { title: "贫穷的本质", author: "班纳吉 & 迪弗洛", reason: "用实验方法看贫困决策，理解激励与约束。" },
      { title: "国富论", author: "亚当·斯密", reason: "回到源头理解分工与市场，补全思想史脉络。" },
    ],
  },
  {
    id: "product-design",
    name: "产品设计",
    tagline: "从用户心理到交付流程，做出好用产品",
    description: "覆盖用户体验、需求洞察与产品交付的经典路径。",
    daily_budget_minutes: 25,
    books: [
      { title: "Don't Make Me Think", author: "Steve Krug", reason: "可用性第一课，讲清「别让用户思考」。" },
      { title: "设计心理学", author: "唐纳德·诺曼", reason: "从心理机制理解好设计与坏设计。" },
      { title: "用户体验要素", author: "Jesse James Garrett", reason: "五层模型梳理产品设计全流程。" },
      { title: "启示录", author: "Marty Cagan", reason: "讲清产品经理如何定义与交付产品。" },
      { title: "人人都是产品经理", author: "苏杰", reason: "中文语境下的产品方法论，偏实践落地。" },
    ],
  },
  {
    id: "personal-finance",
    name: "个人与家庭财务",
    tagline: "从财商启蒙到家庭资产规划，建立金钱观",
    description: "面向零基础的理财入门，先建立观念，再谈方法。",
    daily_budget_minutes: 25,
    books: [
      { title: "小狗钱钱", author: "博多·舍费尔", reason: "用故事讲清储蓄与理财的底层逻辑，无门槛入门。" },
      { title: "富爸爸穷爸爸", author: "罗伯特·清崎", reason: "重塑资产与负债的认知，建立财商思维。" },
      { title: "纳瓦尔宝典", author: "埃里克·乔根森", reason: "关于财富与幸福的底层原则，简短易读。" },
      { title: "邻家的百万富翁", author: "托马斯·斯坦利", reason: "用数据揭示稳健积累财富的常见习惯。" },
      { title: "好好赚钱", author: "简七", reason: "中文语境下的实用理财框架，偏家庭场景落地。" },
    ],
  },
  {
    id: "nutrition",
    name: "营养学",
    tagline: "破除饮食误区，学会科学吃饭",
    description: "从权威指南到食物科学，建立靠谱的营养认知。",
    daily_budget_minutes: 25,
    books: [
      { title: "中国居民膳食指南", author: "中国营养学会", reason: "官方权威基础，先建立均衡饮食的框架。" },
      { title: "你是你吃出来的", author: "夏萌", reason: "通俗讲清营养如何影响身体，贴近日常。" },
      { title: "饮食的迷思", author: "蒂姆·斯佩克特", reason: "用研究破除常见饮食误区，纠正直觉。" },
      { title: "食物与厨艺", author: "哈洛德·马基", reason: "从食材科学理解烹饪与营养，打牢底层知识。" },
      { title: "控糖革命", author: "杰西·安佐斯佩", reason: "聚焦血糖与代谢健康，给出可执行的建议。" },
    ],
  },
  {
    id: "writing",
    name: "写作方法",
    tagline: "从心法到结构，把想法清楚写出来",
    description: "覆盖非虚构写作的结构、风格与日常练习。",
    daily_budget_minutes: 25,
    books: [
      { title: "文心", author: "叶圣陶 / 夏丏尊", reason: "中文写作经典，从读写故事讲透基本功。" },
      { title: "金字塔原理", author: "芭芭拉·明托", reason: "结构化表达的核心方法，先练逻辑框架。" },
      { title: "写作这回事", author: "斯蒂芬·金", reason: "真诚的写作心法，激发持续写下去的意愿。" },
      { title: "风格感觉", author: "史蒂芬·平克", reason: "非虚构写作的文体指南，讲清如何写得清晰。" },
      { title: "写作是门手艺", author: "刘军强", reason: "中文学术与论说文写作，偏方法论落地。" },
    ],
  },
  {
    id: "energy",
    name: "能量管理",
    tagline: "管好精力，而不是管理时间",
    description: "从体能、情绪、注意力到休息，建立可持续的个人能量系统。",
    daily_budget_minutes: 25,
    books: [
      { title: "精力管理", author: "吉姆·洛尔 / 托尼·施瓦茨", reason: "把精力拆成体能、情绪、思维、意志四个账户，先建立整体框架。" },
      { title: "我们为什么要睡觉", author: "马修·沃克", reason: "睡眠是能量恢复的地基，理解缺觉如何消耗判断力与情绪。" },
      { title: "心流", author: "米哈里·契克森米哈赖", reason: "讲清注意力如何转化为高质量的心理能量。" },
      { title: "倦怠社会", author: "韩炳哲", reason: "从社会结构解释「过度积极」为何让人持续耗竭。" },
      { title: "自我关怀的力量", author: "克里斯汀·内夫", reason: "在低谷时修复情绪能量，避免靠自责硬撑。" },
    ],
  },
];

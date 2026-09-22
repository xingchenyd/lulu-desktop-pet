(function registerInteractions(root, factory) {
  const interactions = factory();
  if (typeof module === "object" && module.exports) module.exports = interactions;
  if (root) root.LULU_INTERACTIONS = interactions;
})(typeof globalThis === "undefined" ? this : globalThis, () => [
  {
    id: "pet",
    icon: "♥",
    name: "摸摸噜噜",
    description: "小手从头顶轻轻落下，噜噜闭眼抱着玩偶蹭一蹭。",
  },
  {
    id: "feed",
    icon: "🥕",
    name: "喂胡萝卜",
    description: "胡萝卜送到嘴边，噜噜连续咔嚓并掉出小碎屑。",
  },
  {
    id: "sleep",
    icon: "☾",
    name: "哄睡 / 叫醒",
    description: "噜噜坐下闭眼，月亮升起、星光闪烁并持续冒出 Z。",
  },
  {
    id: "hug",
    icon: "🧸",
    name: "抱抱噜噜",
    description: "噜噜把玩偶抱得更紧，爱心环绕着一起摇晃。",
  },
  {
    id: "highfive",
    icon: "✋",
    name: "和噜噜击掌",
    description: "噜噜跳起来迎向手掌，碰掌瞬间炸开一颗庆祝星。",
  },
  {
    id: "play",
    icon: "⚽",
    name: "一起玩小球",
    description: "彩色小球滚过脚边，噜噜追着球连续跳两下。",
  },
  {
    id: "praise",
    icon: "✨",
    name: "夸夸噜噜",
    description: "小皇冠落到头顶，噜噜骄傲地挺起胸口闪闪发光。",
  },
  {
    id: "chat",
    icon: "💬",
    name: "说悄悄话",
    description: "噜噜侧身凑近，小气泡飘到耳边说一句悄悄话。",
  },
  {
    id: "stretch",
    icon: "🌿",
    name: "一起伸懒腰",
    description: "噜噜踮起脚把身体拉长，叶子和水滴随动作舒展开。",
  },
]);

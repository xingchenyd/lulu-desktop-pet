(function registerInteractions(root, factory) {
  const interactions = factory();
  if (typeof module === "object" && module.exports) module.exports = interactions;
  if (root) root.LULU_INTERACTIONS = interactions;
})(typeof globalThis === "undefined" ? this : globalThis, () => [
  {
    id: "pet",
    icon: "♥",
    name: "摸摸噜噜",
    description: "轻轻摸摸脑袋，让噜噜抱着小玩偶贴贴。",
  },
  {
    id: "feed",
    icon: "🥕",
    name: "喂胡萝卜",
    description: "投喂一根清甜胡萝卜，收获满足的咔嚓声。",
  },
  {
    id: "sleep",
    icon: "☾",
    name: "哄睡 / 叫醒",
    description: "让噜噜眯一会儿，再次互动就会温柔醒来。",
  },
  {
    id: "hug",
    icon: "🧸",
    name: "抱抱噜噜",
    description: "给噜噜一个软乎乎的拥抱，也把安心分给你。",
  },
  {
    id: "highfive",
    icon: "✋",
    name: "和噜噜击掌",
    description: "啪！为刚刚完成的小事认真庆祝一下。",
  },
  {
    id: "play",
    icon: "⚽",
    name: "一起玩小球",
    description: "陪噜噜玩一小会儿，让它开心地晃来晃去。",
  },
  {
    id: "praise",
    icon: "✨",
    name: "夸夸噜噜",
    description: "告诉噜噜今天也很可爱，它会把夸奖还给你。",
  },
  {
    id: "chat",
    icon: "💬",
    name: "说悄悄话",
    description: "听噜噜说一句只属于此刻的温柔小话。",
  },
  {
    id: "stretch",
    icon: "🌿",
    name: "一起伸懒腰",
    description: "暂停片刻，和噜噜一起松松肩、喝口水。",
  },
]);

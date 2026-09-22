const appElement = document.querySelector("#app");
const petStage = document.querySelector("#petStage");
const lulu = document.querySelector("#lulu");
const speech = document.querySelector("#speech");
const speechText = document.querySelector("#speechText");
const effects = document.querySelector("#effects");
const actionProps = document.querySelector("#actionProps");
const quickButtons = [...document.querySelectorAll(".quick-action")];
const interactionMap = new Map(window.LULU_INTERACTIONS.map((item) => [item.id, item]));
const actionClasses = [...interactionMap.keys()].map((id) => `action-${id}`);

const state = {
  mode: "idle",
  sleeping: false,
  strolling: true,
  walking: false,
  dragging: false,
  dragMoved: false,
  direction: -1,
  affection: Number(localStorage.getItem("luluAffection") || 0),
  snacks: Number(localStorage.getItem("luluSnacks") || 0),
  clickMoodIndex: 0,
  activeAction: null,
  quickActions: ["pet", "feed", "sleep"],
};

const visualAssets = {
  idle: "assets/lulu-idle.png",
  walk: "assets/lulu-idle.png",
  happy: "assets/lulu-happy.png",
  eating: "assets/lulu-eating.png",
  sleeping: "assets/lulu-sleeping.png",
  grumpy: "assets/lulu-grumpy.png",
};

Object.values(visualAssets).forEach((source) => {
  const image = new Image();
  image.src = source;
});

const chatter = [
  "忙累了就看看我吧。",
  "今天也一起慢慢来～",
  "噜噜正在认真陪伴你。",
  "别忘了喝一口水呀。",
  "伸个懒腰，会舒服一点。",
  "我可以安静地待在这里。",
  "你的努力，噜噜都看见啦。",
];

const petLines = [
  "抱着小玩偶，好安心呀～",
  "软乎乎地贴贴一下。",
  "噜噜和小玩偶都收到喜欢啦！",
  "给你也抱一下。",
];

const foodLines = [
  "咔嚓咔嚓，好甜！",
  "胡萝卜是会发光的快乐。",
  "谢谢你投喂噜噜～",
  "这一根我要慢慢嚼。",
];

const whisperLines = [
  "悄悄告诉你：慢一点也完全没关系。",
  "噜噜把今天最软的一朵云留给你。",
  "只要你回头，我就还在这里。",
  "今天辛苦的部分，也值得被温柔接住。",
];

const praiseLines = [
  "你今天也做得很好，噜噜很认真地看见了。",
  "哇，被你夸得心里暖乎乎的！你也超棒。",
  "这份夸奖分你一半，我们一起收藏。",
];

let speechTimer = null;
let modeTimer = null;
let actionTimer = null;
let walkTimer = null;
let walkStartTimer = null;
let clickTimer = null;
let pointerStart = null;

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function speak(message, duration = 3600) {
  clearTimeout(speechTimer);
  speechText.textContent = message;
  speech.classList.remove("hidden");
  speechTimer = setTimeout(() => speech.classList.add("hidden"), duration);
}

function setMode(mode, duration = 0) {
  clearTimeout(modeTimer);
  state.mode = mode;
  petStage.classList.remove("idle", "happy", "eating", "sleeping", "walk", "grumpy");
  petStage.classList.add(mode);
  const nextSource = visualAssets[mode] || visualAssets.idle;
  if (!lulu.src.endsWith(nextSource)) {
    lulu.classList.add("switching");
    lulu.src = nextSource;
    requestAnimationFrame(() => lulu.classList.remove("switching"));
  }
  if (duration > 0) {
    modeTimer = setTimeout(() => setMode(state.sleeping ? "sleeping" : "idle"), duration);
  }
}

function clearActionVisuals({ keepSleeping = false } = {}) {
  clearTimeout(actionTimer);
  actionTimer = null;
  petStage.classList.remove(...actionClasses);
  actionProps.replaceChildren();
  state.activeAction = null;
  delete petStage.dataset.action;
  if (!keepSleeping && state.sleeping) state.sleeping = false;
}

function renderActionProps(props = []) {
  actionProps.replaceChildren();
  props.forEach(({ className, text = "" }) => {
    const prop = document.createElement("span");
    prop.className = `action-prop ${className}`;
    prop.textContent = text;
    actionProps.appendChild(prop);
  });
}

function beginAction(action, {
  mode = "happy",
  duration = 1500,
  props = [],
  onFinish,
} = {}) {
  clearActionVisuals({ keepSleeping: true });
  state.activeAction = action;
  clearTimeout(walkStartTimer);
  petStage.classList.add(`action-${action}`);
  petStage.dataset.action = action;
  renderActionProps(props);
  setMode(mode);

  if (duration > 0) {
    actionTimer = setTimeout(() => {
      petStage.classList.remove(`action-${action}`);
      actionProps.replaceChildren();
      state.activeAction = null;
      delete petStage.dataset.action;
      setMode(state.sleeping ? "sleeping" : "idle");
      onFinish?.();
      scheduleWalk();
    }, duration);
  }
}

function setFacing(direction) {
  state.direction = direction;
  petStage.classList.toggle("facing-left", direction < 0);
  petStage.classList.toggle("facing-right", direction >= 0);
}

function burst(symbols, count = 6) {
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = pick(symbols);
    particle.style.setProperty("--x", `${18 + Math.random() * 80}px`);
    particle.style.setProperty("--y", `${28 + Math.random() * 40}px`);
    particle.style.setProperty("--size", `${10 + Math.random() * 7}px`);
    particle.style.setProperty("--drift", `${-16 + Math.random() * 32}px`);
    particle.style.animationDelay = `${Math.random() * 180}ms`;
    effects.appendChild(particle);
    setTimeout(() => particle.remove(), 1500);
  }
}

function wakeUp(announce = true) {
  clearActionVisuals({ keepSleeping: true });
  state.sleeping = false;
  delete petStage.dataset.action;
  setMode("idle");
  if (announce) speak("唔……噜噜醒啦，继续陪你。", 3200);
  scheduleWalk();
}

function petLulu() {
  if (state.dragMoved) return;
  if (state.sleeping) wakeUp(false);
  state.affection += 1;
  localStorage.setItem("luluAffection", String(state.affection));
  stopWalking();
  beginAction("pet", {
    mode: "happy",
    duration: 1650,
    props: [
      { className: "pat-hand", text: "✋" },
      { className: "pet-heart pet-heart-one", text: "♥" },
      { className: "pet-heart pet-heart-two", text: "♡" },
    ],
  });
  burst(["♥", "♡", "✦"], 7);
  const bonus = state.affection % 8 === 0 ? " 我们已经越来越熟啦！" : "";
  speak(`${pick(petLines)}${bonus}`);
  playTone(540, 0.07);
}

function cycleClickMood() {
  if (state.dragMoved) return;
  if (state.sleeping) {
    wakeUp();
    return;
  }

  clearActionVisuals({ keepSleeping: true });

  const moods = [
    { mode: "happy", line: "闭上眼，和小玩偶贴贴～", symbols: ["♥", "✦"] },
    { mode: "grumpy", line: "唔……不要一直戳我的大嘴筒嘛。", symbols: ["💢", "·"] },
    { mode: "happy", line: "抱一下，烦恼会变轻一点～", symbols: ["♡", "✦"] },
  ];
  const mood = moods[state.clickMoodIndex % moods.length];
  state.clickMoodIndex += 1;
  stopWalking();
  setMode(mood.mode, mood.mode === "grumpy" ? 1900 : 1050);
  burst(mood.symbols, mood.mode === "grumpy" ? 3 : 6);
  speak(mood.line, 3000);
  playTone(mood.mode === "grumpy" ? 260 : 520, 0.07);
}

function feedLulu() {
  if (state.sleeping) wakeUp(false);
  state.snacks += 1;
  localStorage.setItem("luluSnacks", String(state.snacks));
  stopWalking();
  beginAction("feed", {
    mode: "eating",
    duration: 1900,
    props: [
      { className: "crunch crunch-one", text: "✦" },
      { className: "crunch crunch-two", text: "·" },
      { className: "crunch crunch-three", text: "♪" },
    ],
  });
  burst(["🥕", "✦"], 5);
  const bonus = state.snacks % 5 === 0 ? ` 这是今天的第 ${state.snacks} 根！` : "";
  speak(`${pick(foodLines)}${bonus}`, 4200);
  playTone(440, 0.06);
  setTimeout(() => playTone(590, 0.08), 100);
}

function toggleSleep() {
  stopWalking();
  state.sleeping = !state.sleeping;
  if (state.sleeping) {
    beginAction("sleep", {
      mode: "sleeping",
      duration: 0,
      props: [
        { className: "dream-moon", text: "☾" },
        { className: "dream-star dream-star-one", text: "✦" },
        { className: "dream-star dream-star-two", text: "·" },
      ],
    });
    speak("噜噜先眯一小会儿……晚安。", 3000);
    playTone(360, 0.12);
  } else {
    wakeUp();
  }
}

function prepareDelight() {
  if (state.sleeping) wakeUp(false);
  state.affection += 1;
  localStorage.setItem("luluAffection", String(state.affection));
  stopWalking();
}

function hugLulu() {
  prepareDelight();
  beginAction("hug", {
    mode: "happy",
    duration: 2100,
    props: [
      { className: "hug-ring", text: "" },
      { className: "hug-heart", text: "♡" },
    ],
  });
  burst(["♥", "♡", "✦"], 8);
  speak("抱紧一点～噜噜和小玩偶把安心都分给你。", 3900);
  playTone(470, 0.12);
}

function highFiveLulu() {
  prepareDelight();
  beginAction("highfive", {
    mode: "idle",
    duration: 1700,
    props: [
      { className: "highfive-hand", text: "✋" },
      { className: "highfive-flash", text: "★" },
    ],
  });
  setTimeout(() => burst(["✦", "★"], 8), 430);
  speak("啪！击掌成功，刚刚的你真的很厉害！", 3600);
  playTone(620, 0.07);
  setTimeout(() => playTone(790, 0.09), 420);
}

function playWithLulu() {
  prepareDelight();
  beginAction("play", {
    mode: "idle",
    duration: 2400,
    props: [
      { className: "play-ball", text: "" },
      { className: "play-speed play-speed-one", text: "·" },
      { className: "play-speed play-speed-two", text: "·" },
    ],
  });
  burst(["●", "✦"], 4);
  speak("小球滚过来啦！噜噜追到它了——", 3800);
  playTone(565, 0.08);
  setTimeout(() => playTone(665, 0.08), 760);
}

function praiseLulu() {
  prepareDelight();
  beginAction("praise", {
    mode: "happy",
    duration: 2100,
    props: [
      { className: "praise-crown", text: "♛" },
      { className: "praise-star praise-star-one", text: "✦" },
      { className: "praise-star praise-star-two", text: "★" },
    ],
  });
  burst(["✦", "★", "♡"], 7);
  speak(pick(praiseLines), 4100);
  playTone(585, 0.1);
  setTimeout(() => playTone(700, 0.1), 150);
}

function chatWithLulu() {
  prepareDelight();
  beginAction("chat", {
    mode: "idle",
    duration: 2300,
    props: [
      { className: "whisper-bubble", text: "···" },
      { className: "whisper-heart", text: "♡" },
    ],
  });
  burst(["♡", "·"], 4);
  speak(pick(whisperLines), 4600);
  playTone(425, 0.13);
}

function stretchWithLulu() {
  prepareDelight();
  beginAction("stretch", {
    mode: "idle",
    duration: 2300,
    props: [
      { className: "stretch-sun", text: "☀" },
      { className: "stretch-leaf stretch-leaf-one", text: "❯" },
      { className: "stretch-leaf stretch-leaf-two", text: "❮" },
      { className: "stretch-drop", text: "●" },
    ],
  });
  burst(["🌿", "✦", "·"], 6);
  speak("一起伸——个懒腰，肩膀放松，再喝一小口水吧。", 4300);
  playTone(500, 0.12);
  setTimeout(() => playTone(555, 0.09), 500);
}

function playTone(frequency, duration) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Audio is a small optional delight; interactions still work if unavailable.
  }
}

function stopWalking() {
  state.walking = false;
  clearInterval(walkTimer);
  walkTimer = null;
  if (!state.sleeping && state.mode === "walk") setMode("idle");
}

async function walkStep() {
  if (!state.walking || state.dragging || state.sleeping) return;
  const result = await window.luluDesktop.moveBy(state.direction * 3, 0);
  if (result?.hitEdge) {
    setFacing(state.direction * -1);
    speak("到边边啦，掉个头～", 2200);
  }
}

function startWalking() {
  if (!state.strolling || state.sleeping || state.dragging || state.walking || state.activeAction) return;
  state.walking = true;
  setFacing(Math.random() > 0.5 ? 1 : -1);
  setMode("walk");
  if (Math.random() > 0.55) speak(pick(["我去旁边转一小圈。", "噜噜散个步，很快回来～", "一步、两步，慢慢走。"]), 2600);
  walkTimer = setInterval(walkStep, 72);
  setTimeout(() => {
    stopWalking();
    scheduleWalk();
  }, 3300 + Math.random() * 3000);
}

function scheduleWalk() {
  clearTimeout(walkStartTimer);
  if (!state.strolling) return;
  walkStartTimer = setTimeout(startWalking, 9000 + Math.random() * 12000);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "还没睡吗？噜噜安静陪着你。";
  if (hour < 11) return "早呀！今天也慢慢来。";
  if (hour < 14) return "午安～记得好好吃饭。";
  if (hour < 18) return "下午好，摸摸噜噜充个电吧。";
  if (hour < 23) return "晚上好，辛苦的一天快结束啦。";
  return "夜深啦，忙完就早点休息喔。";
}

function handleAction(action) {
  const handlers = {
    pet: petLulu,
    feed: feedLulu,
    sleep: toggleSleep,
    hug: hugLulu,
    highfive: highFiveLulu,
    play: playWithLulu,
    praise: praiseLulu,
    chat: chatWithLulu,
    stretch: stretchWithLulu,
  };
  handlers[action]?.();
}

function updateQuickActions(actions) {
  if (!Array.isArray(actions) || actions.length !== quickButtons.length) return;
  state.quickActions = [...actions];
  quickButtons.forEach((button, index) => {
    const interaction = interactionMap.get(actions[index]);
    if (!interaction) return;
    button.dataset.action = interaction.id;
    button.textContent = interaction.icon;
    button.title = interaction.name;
    button.setAttribute("aria-label", interaction.name);
  });
}

quickButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handleAction(button.dataset.action);
  });
});

petStage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button")) return;
  pointerStart = { x: event.screenX, y: event.screenY };
  state.dragMoved = false;
  state.dragging = true;
  stopWalking();
  petStage.classList.add("dragging");
  petStage.setPointerCapture(event.pointerId);
  window.luluDesktop.dragStart(event.screenX, event.screenY);
});

petStage.addEventListener("pointermove", (event) => {
  if (!state.dragging || !pointerStart) return;
  if (Math.hypot(event.screenX - pointerStart.x, event.screenY - pointerStart.y) > 5) {
    state.dragMoved = true;
  }
  window.luluDesktop.dragMove(event.screenX, event.screenY);
});

function endDrag(event) {
  if (!state.dragging) return;
  state.dragging = false;
  pointerStart = null;
  petStage.classList.remove("dragging");
  window.luluDesktop.dragEnd();
  if (petStage.hasPointerCapture(event.pointerId)) petStage.releasePointerCapture(event.pointerId);
  if (state.dragMoved) {
    speak("这里的风景也不错～", 2300);
    setTimeout(() => {
      state.dragMoved = false;
      scheduleWalk();
    }, 80);
  }
}

petStage.addEventListener("pointerup", endDrag);
petStage.addEventListener("pointercancel", endDrag);

petStage.addEventListener("click", () => {
  if (state.dragMoved) return;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(cycleClickMood, 220);
});

petStage.addEventListener("dblclick", () => {
  if (state.dragMoved) return;
  clearTimeout(clickTimer);
  feedLulu();
});

appElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.luluDesktop.showContextMenu();
});

window.luluDesktop.onAction(handleAction);
window.luluDesktop.onQuickActions(updateQuickActions);
window.luluDesktop.onSetting(({ key, value }) => {
  if (key !== "strolling") return;
  state.strolling = value;
  if (value) {
    speak("好呀，噜噜会自己走走。", 2500);
    scheduleWalk();
  } else {
    stopWalking();
    clearTimeout(walkStartTimer);
    speak("好，噜噜就在这里陪你。", 2500);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopWalking();
  else scheduleWalk();
});

setFacing(-1);
window.luluDesktop.getQuickActions().then(updateQuickActions);
speak(greeting(), 5000);
scheduleWalk();

setInterval(() => {
  if (!state.sleeping && !state.walking && !state.dragging && Math.random() > 0.45) {
    speak(pick(chatter), 3300);
  }
}, 28000);

const path = require("node:path");
const fs = require("node:fs");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
} = require("electron");
const interactions = require("./interactions");

// Avoid stale, independently moving DirectComposition layers in the
// transparent Windows window while the pet is being dragged.
app.commandLine.appendSwitch("disable-gpu-compositing");

if (process.env.LULU_TEST_USER_DATA) {
  app.setPath("userData", path.resolve(process.env.LULU_TEST_USER_DATA));
}

const WINDOW_SIZE = { width: 190, height: 220 };
const DEFAULT_QUICK_ACTIONS = ["pet", "feed", "sleep"];
const INTERACTION_IDS = new Set(interactions.map((item) => item.id));
let petWindow = null;
let libraryWindow = null;
let tray = null;
let isQuitting = false;
let dragOrigin = null;
let pendingDragPoint = null;
let dragMoveTimer = null;
let stableWindowSize = null;
let settings = {
  alwaysOnTop: true,
  strolling: true,
  quickActions: [...DEFAULT_QUICK_ACTIONS],
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => showPet());
}

function getAssetPath(filename) {
  return path.join(__dirname, "assets", filename);
}

function validateQuickActions(actions, fallback = DEFAULT_QUICK_ACTIONS) {
  if (
    !Array.isArray(actions) ||
    actions.length !== 3 ||
    new Set(actions).size !== 3 ||
    actions.some((action) => !INTERACTION_IDS.has(action))
  ) {
    return [...fallback];
  }
  return [...actions];
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "lulu-settings.json");
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    settings = {
      alwaysOnTop: saved.alwaysOnTop !== false,
      strolling: saved.strolling !== false,
      quickActions: validateQuickActions(saved.quickActions),
    };
  } catch {
    settings.quickActions = [...DEFAULT_QUICK_ACTIONS];
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn("Unable to save Lulu settings:", error.message);
  }
}

function getWorkAreaForBounds(bounds) {
  const center = {
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2),
  };
  return screen.getDisplayNearestPoint(center).workArea;
}

function getStableWindowBounds() {
  const bounds = petWindow.getBounds();
  const size = stableWindowSize || { width: bounds.width, height: bounds.height };
  return { ...bounds, ...size };
}

function clampPosition(x, y, bounds = getStableWindowBounds()) {
  const area = getWorkAreaForBounds({ ...bounds, x, y });
  return {
    x: Math.min(Math.max(x, area.x), area.x + area.width - bounds.width),
    y: Math.min(Math.max(y, area.y), area.y + area.height - bounds.height),
    area,
  };
}

function setPetPosition(x, y) {
  if (!petWindow) return;
  const { width, height } = getStableWindowBounds();
  petWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height }, false);
}

function resetPosition() {
  if (!petWindow) return;
  const area = screen.getPrimaryDisplay().workArea;
  const { width, height } = getStableWindowBounds();
  setPetPosition(area.x + area.width - width - 22, area.y + area.height - height - 14);
  showPet();
}

function showPet() {
  if (!petWindow) return;
  if (petWindow.isMinimized()) petWindow.restore();
  petWindow.showInactive();
}

function togglePetVisibility() {
  if (!petWindow) return;
  if (petWindow.isVisible()) {
    petWindow.hide();
  } else {
    showPet();
  }
}

function sendAction(action) {
  if (!INTERACTION_IDS.has(action)) return;
  showPet();
  petWindow?.webContents.send("pet:action", action);
}

function broadcastQuickActions() {
  const actions = [...settings.quickActions];
  petWindow?.webContents.send("pet:quick-actions", actions);
  libraryWindow?.webContents.send("pet:quick-actions", actions);
}

function getLoginItemOptions(enabled) {
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  const options = {
    path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    args: [],
  };

  if (!app.isPackaged && !isPortable) {
    options.args = [path.resolve(process.argv[1])];
  }

  if (typeof enabled === "boolean") {
    options.openAtLogin = enabled;
    options.openAsHidden = false;
  }

  return options;
}

function getAutoLaunch() {
  return app.getLoginItemSettings(getLoginItemOptions()).openAtLogin;
}

function setAutoLaunch(enabled) {
  app.setLoginItemSettings(getLoginItemOptions(enabled));
}

function setAlwaysOnTop(enabled) {
  settings.alwaysOnTop = enabled;
  petWindow?.setAlwaysOnTop(enabled, "floating");
  saveSettings();
  buildTrayMenu();
}

function setStrolling(enabled) {
  settings.strolling = enabled;
  petWindow?.webContents.send("pet:setting", { key: "strolling", value: enabled });
  saveSettings();
  buildTrayMenu();
}

function applyPendingDragMove() {
  dragMoveTimer = null;
  if (!petWindow || !dragOrigin || !pendingDragPoint) return;
  const point = pendingDragPoint;
  pendingDragPoint = null;
  const next = clampPosition(
    dragOrigin.windowX + point.x - dragOrigin.pointerX,
    dragOrigin.windowY + point.y - dragOrigin.pointerY,
  );
  setPetPosition(next.x, next.y);
}

function menuTemplate() {
  return [
    { label: "打开互动库…", click: openInteractionLibrary },
    { type: "separator" },
    { label: "摸摸噜噜", click: () => sendAction("pet") },
    { label: "喂一根胡萝卜", click: () => sendAction("feed") },
    { label: "哄噜噜睡觉", click: () => sendAction("sleep") },
    { type: "separator" },
    {
      label: "允许自由散步",
      type: "checkbox",
      checked: settings.strolling,
      click: (item) => setStrolling(item.checked),
    },
    {
      label: "始终显示在最前",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked),
    },
    {
      label: "开机时叫醒噜噜",
      type: "checkbox",
      checked: getAutoLaunch(),
      click: (item) => {
        setAutoLaunch(item.checked);
        buildTrayMenu();
      },
    },
    { type: "separator" },
    { label: "回到右下角", click: resetPosition },
    { label: "暂时藏起来", click: () => petWindow?.hide() },
    {
      label: "让噜噜休息（退出）",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];
}

function openInteractionLibrary() {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    if (libraryWindow.isMinimized()) libraryWindow.restore();
    libraryWindow.show();
    libraryWindow.focus();
    return;
  }

  libraryWindow = new BrowserWindow({
    width: 620,
    height: 760,
    minWidth: 470,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f4efe4",
    title: "噜噜互动库",
    icon: getAssetPath("lulu-idle.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  libraryWindow.setMenuBarVisibility(false);
  libraryWindow.loadFile("library.html");
  libraryWindow.once("ready-to-show", () => {
    libraryWindow.show();
    const capturePath = process.env.LULU_CAPTURE_LIBRARY_PATH;
    if (capturePath) {
      setTimeout(async () => {
        const image = await libraryWindow.webContents.capturePage();
        fs.writeFileSync(capturePath, image.toPNG());
        isQuitting = true;
        app.quit();
      }, 900);
    }
  });
  libraryWindow.on("closed", () => {
    libraryWindow = null;
  });
}

function buildTrayMenu() {
  if (!tray) return;
  const topItems = [
    {
      label: petWindow?.isVisible() ? "藏起噜噜" : "叫出噜噜",
      click: togglePetVisibility,
    },
    { type: "separator" },
  ];
  tray.setContextMenu(Menu.buildFromTemplate([...topItems, ...menuTemplate()]));
}

function createTray() {
  const icon = nativeImage.createFromPath(getAssetPath("lulu-idle.png")).resize({
    width: 32,
    height: 32,
    quality: "best",
  });
  tray = new Tray(icon);
  tray.setToolTip("水豚噜噜正在陪你");
  tray.on("click", togglePetVisibility);
  buildTrayMenu();
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;

  petWindow = new BrowserWindow({
    ...WINDOW_SIZE,
    x: area.x + area.width - WINDOW_SIZE.width - 22,
    y: area.y + area.height - WINDOW_SIZE.height - 14,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    icon: getAssetPath("lulu-idle.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  petWindow.setMenuBarVisibility(false);
  petWindow.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile("index.html");

  petWindow.once("ready-to-show", async () => {
    const initialBounds = petWindow.getBounds();
    stableWindowSize = { width: initialBounds.width, height: initialBounds.height };
    petWindow.showInactive();
    petWindow.webContents.send("pet:setting", {
      key: "strolling",
      value: settings.strolling,
    });
    petWindow.webContents.send("pet:quick-actions", [...settings.quickActions]);

    const capturePath = process.env.LULU_CAPTURE_PATH;
    if (capturePath) {
      const allowedStates = new Set(["idle", "happy", "eating", "sleeping", "grumpy"]);
      const captureState = allowedStates.has(process.env.LULU_CAPTURE_STATE)
        ? process.env.LULU_CAPTURE_STATE
        : "idle";
      const captureAction = process.env.LULU_CAPTURE_ACTION;
      let dragTestStartBounds = null;
      await petWindow.webContents.executeJavaScript(`setMode(${JSON.stringify(captureState)})`);
      if (process.env.LULU_CAPTURE_QUICK_ACTIONS) {
        const requestedActions = process.env.LULU_CAPTURE_QUICK_ACTIONS.split(",");
        await petWindow.webContents.executeJavaScript(
          `window.luluDesktop.setQuickActions(${JSON.stringify(requestedActions)})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (captureAction === "click") {
        petWindow.webContents.sendInputEvent({
          type: "mouseDown",
          x: Math.round(WINDOW_SIZE.width / 2),
          y: 145,
          button: "left",
          clickCount: 1,
        });
        petWindow.webContents.sendInputEvent({
          type: "mouseUp",
          x: Math.round(WINDOW_SIZE.width / 2),
          y: 145,
          button: "left",
          clickCount: 1,
        });
      }
      if (captureAction === "drag") {
        dragTestStartBounds = petWindow.getBounds();
        const pointer = {
          x: dragTestStartBounds.x + Math.round(WINDOW_SIZE.width / 2),
          y: dragTestStartBounds.y + 145,
        };
        await petWindow.webContents.executeJavaScript(
          `window.luluDesktop.dragStart(${pointer.x}, ${pointer.y})`,
        );
        for (let step = 0; step < 5; step += 1) {
          await new Promise((resolve) => setTimeout(resolve, 45));
          await petWindow.webContents.executeJavaScript(
            `window.luluDesktop.dragMove(${pointer.x - 12 * (step + 1)}, ${pointer.y})`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
        await petWindow.webContents.executeJavaScript("window.luluDesktop.dragEnd()");
      }
      if (captureAction?.startsWith("interaction:")) {
        sendAction(captureAction.slice("interaction:".length));
      }
      setTimeout(async () => {
        if (captureAction) {
          const rendererState = await petWindow.webContents.executeJavaScript(`({
            mode: state.mode,
            activeAction: state.activeAction,
            src: document.querySelector("#lulu").getAttribute("src"),
            actionProps: [...document.querySelectorAll(".action-prop")].map((prop) => prop.className),
            parents: {
              buttons: document.querySelector(".quick-actions").parentElement.id,
              character: document.querySelector("#lulu").parentElement.id,
              name: document.querySelector(".name-tag").parentElement.id,
            },
            quickActions: [...document.querySelectorAll(".quick-action")].map((button) => button.dataset.action),
          })`);
          console.log("Lulu verification state:", rendererState);
          if (captureAction === "drag") {
            console.log("Lulu drag verification bounds:", {
              before: dragTestStartBounds,
              after: petWindow.getBounds(),
            });
          }
        }
        const image = await petWindow.webContents.capturePage();
        fs.writeFileSync(capturePath, image.toPNG());
        isQuitting = true;
        app.quit();
      }, captureAction ? 900 : 500);
    }
  });

  petWindow.on("show", buildTrayMenu);
  petWindow.on("hide", buildTrayMenu);
  petWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      petWindow.hide();
    }
  });
}

function registerIpc() {
  ipcMain.on("window:drag-start", (_event, point) => {
    if (!petWindow) return;
    if (dragMoveTimer) clearTimeout(dragMoveTimer);
    dragMoveTimer = null;
    pendingDragPoint = null;
    const [x, y] = petWindow.getPosition();
    dragOrigin = { pointerX: point.x, pointerY: point.y, windowX: x, windowY: y };
  });

  ipcMain.on("window:drag-move", (_event, point) => {
    if (!petWindow || !dragOrigin) return;
    pendingDragPoint = point;
    if (!dragMoveTimer) dragMoveTimer = setTimeout(applyPendingDragMove, 16);
  });

  ipcMain.on("window:drag-end", () => {
    if (dragMoveTimer) clearTimeout(dragMoveTimer);
    dragMoveTimer = null;
    applyPendingDragMove();
    dragOrigin = null;
    pendingDragPoint = null;
  });

  ipcMain.handle("window:move-by", (_event, delta) => {
    if (!petWindow) return { hitEdge: true };
    const [x, y] = petWindow.getPosition();
    const targetX = x + Number(delta.x || 0);
    const targetY = y + Number(delta.y || 0);
    const next = clampPosition(targetX, targetY);
    setPetPosition(next.x, next.y);
    return {
      x: next.x,
      y: next.y,
      hitEdge: next.x !== targetX || next.y !== targetY,
    };
  });

  ipcMain.on("pet:context-menu", () => {
    if (!petWindow) return;
    Menu.buildFromTemplate(menuTemplate()).popup({ window: petWindow });
  });

  ipcMain.on("pet:set-setting", (_event, payload) => {
    if (payload.key === "strolling") setStrolling(Boolean(payload.value));
    if (payload.key === "alwaysOnTop") setAlwaysOnTop(Boolean(payload.value));
  });

  ipcMain.on("pet:open-library", openInteractionLibrary);
  ipcMain.on("pet:trigger-action", (_event, action) => sendAction(action));
  ipcMain.handle("pet:get-quick-actions", () => [...settings.quickActions]);
  ipcMain.handle("pet:set-quick-actions", (_event, actions) => {
    const validated = validateQuickActions(actions, settings.quickActions);
    settings.quickActions = validated;
    saveSettings();
    broadcastQuickActions();
    return [...settings.quickActions];
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.codex.lulu-desktop-pet");
  loadSettings();
  registerIpc();
  createWindow();
  createTray();
  if (process.env.LULU_CAPTURE_LIBRARY_PATH) openInteractionLibrary();
});

app.on("activate", showPet);

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Keep the tray process alive even if the pet window is temporarily unavailable.
});

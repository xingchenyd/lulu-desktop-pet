const interactions = window.LULU_INTERACTIONS;
const interactionMap = new Map(interactions.map((item) => [item.id, item]));
const defaultShortcuts = ["pet", "feed", "sleep"];
const shortcutSlots = document.querySelector("#shortcutSlots");
const interactionGrid = document.querySelector("#interactionGrid");
const saveStatus = document.querySelector("#saveStatus");
const resetShortcuts = document.querySelector("#resetShortcuts");
const interactionCount = document.querySelector("#interactionCount");

let shortcuts = [...defaultShortcuts];
let statusTimer = null;

function showStatus(message, tone = "success") {
  clearTimeout(statusTimer);
  saveStatus.textContent = message;
  saveStatus.className = `save-status ${tone}`;
  statusTimer = setTimeout(() => {
    saveStatus.textContent = "修改后会自动保存。";
    saveStatus.className = "save-status";
  }, 2600);
}

function shortcutLabel(actionId) {
  const item = interactionMap.get(actionId);
  return item ? `${item.icon} ${item.name}` : actionId;
}

function renderShortcutSlots() {
  shortcutSlots.replaceChildren();
  shortcuts.forEach((actionId, slotIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "shortcut-slot";

    const label = document.createElement("label");
    label.htmlFor = `shortcut-${slotIndex}`;
    label.textContent = `快捷位 ${slotIndex + 1}`;

    const select = document.createElement("select");
    select.id = `shortcut-${slotIndex}`;
    select.dataset.slot = String(slotIndex);
    interactions.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.icon} ${item.name}`;
      option.selected = item.id === actionId;
      select.appendChild(option);
    });
    select.addEventListener("change", async () => {
      const next = [...shortcuts];
      next[slotIndex] = select.value;
      if (new Set(next).size !== next.length) {
        showStatus("三个快捷位不能选择同一个互动。", "error");
        renderShortcutSlots();
        return;
      }
      shortcuts = await window.luluDesktop.setQuickActions(next);
      showStatus(`已保存：快捷位 ${slotIndex + 1} 是“${shortcutLabel(shortcuts[slotIndex])}”。`);
      renderShortcutSlots();
      renderInteractionGrid();
    });

    wrapper.append(label, select);
    shortcutSlots.appendChild(wrapper);
  });
}

function renderInteractionGrid() {
  interactionGrid.replaceChildren();
  interactions.forEach((item) => {
    const card = document.createElement("article");
    card.className = "interaction-card";

    const selectedIndex = shortcuts.indexOf(item.id);
    if (selectedIndex >= 0) {
      const badge = document.createElement("span");
      badge.className = "shortcut-badge";
      badge.textContent = `快捷 ${selectedIndex + 1}`;
      card.appendChild(badge);
    }

    const icon = document.createElement("div");
    icon.className = "interaction-icon";
    icon.textContent = item.icon;

    const copy = document.createElement("div");
    copy.className = "interaction-copy";
    const title = document.createElement("h3");
    title.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description;
    const button = document.createElement("button");
    button.className = "interaction-button";
    button.type = "button";
    button.textContent = "现在互动";
    button.addEventListener("click", () => {
      window.luluDesktop.triggerAction(item.id);
      showStatus(`已叫噜噜来“${item.name}”。`);
    });

    copy.append(title, description, button);
    card.append(icon, copy);
    interactionGrid.appendChild(card);
  });
}

resetShortcuts.addEventListener("click", async () => {
  shortcuts = await window.luluDesktop.setQuickActions(defaultShortcuts);
  renderShortcutSlots();
  renderInteractionGrid();
  showStatus("已恢复为摸摸、胡萝卜和睡觉。" );
});

window.luluDesktop.onQuickActions((next) => {
  shortcuts = next;
  renderShortcutSlots();
  renderInteractionGrid();
});

async function initialize() {
  shortcuts = await window.luluDesktop.getQuickActions();
  interactionCount.textContent = `${interactions.length} 种`;
  renderShortcutSlots();
  renderInteractionGrid();
}

initialize();

const state = {
  unlocked: false,
  password: "",
  entries: [],
  filtered: [],
  selectedId: null
};

const el = (id) => document.getElementById(id);

const entryList = el("entryList");
const tagList = el("tagList");
const searchInput = el("searchInput");
const masterPassword = el("masterPassword");
const vaultBanner = el("vaultBanner");
const vaultHint = el("vaultHint");
const editorTitle = el("editorTitle");
const editorSub = el("editorSub");
const fieldName = el("fieldName");
const fieldUser = el("fieldUser");
const fieldPass = el("fieldPass");
const fieldUrl = el("fieldUrl");
const fieldTags = el("fieldTags");
const fieldNotes = el("fieldNotes");

const btnUnlock = el("btnUnlock");
const btnCreate = el("btnCreate");
const btnNew = el("btnNew");
const btnSave = el("btnSave");
const btnDelete = el("btnDelete");
const btnCopy = el("btnCopy");
const btnGen = el("btnGen");
const btnClearPass = el("btnClearPass");
const btnTogglePass = el("btnTogglePass");
const btnReveal = el("btnReveal");
const btnExportJson = el("btnExportJson");
const btnImportJson = el("btnImportJson");
const btnExportCsv = el("btnExportCsv");
const btnTagManage = el("btnTagManage");
const toast = el("toast");
const genModal = el("genModal");
const genLen = el("genLen");
const genUpper = el("genUpper");
const genLower = el("genLower");
const genNum = el("genNum");
const genSym = el("genSym");
const btnGenOk = el("btnGenOk");
const btnGenCancel = el("btnGenCancel");
const tagModal = el("tagModal");
const tagNameInput = el("tagNameInput");
const tagColorInput = el("tagColorInput");
const btnTagAdd = el("btnTagAdd");
const btnTagClose = el("btnTagClose");
const tagManageList = el("tagManageList");

const CLIPBOARD_CLEAR_MS = 15000;
const activeTags = new Set();
let tagLibrary = loadTagLibrary();

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1400);
}

function setUnlocked(on) {
  state.unlocked = on;
  vaultBanner.style.display = on ? "none" : "flex";
}

function renderList() {
  entryList.innerHTML = "";
  state.filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry-card" + (item.id === state.selectedId ? " active" : "");
    card.innerHTML = `
      <div class="entry-title">${escapeHtml(item.name || "未命名")}</div>
      <div class="entry-meta">${escapeHtml(item.username || "")}</div>
      <div class="entry-meta">${escapeHtml(item.tags || "")}</div>
    `;
    card.addEventListener("click", () => selectEntry(item.id));
    entryList.appendChild(card);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function filterEntries() {
  const q = searchInput.value.trim().toLowerCase();
  const byTag = (e) => {
    if (activeTags.size === 0) return true;
    const tags = (e.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(activeTags).some((t) => tags.includes(t));
  };
  const byQuery = (e) =>
    !q ||
    `${e.name} ${e.username} ${e.url} ${e.tags} ${e.notes}`.toLowerCase().includes(q);
  state.filtered = state.entries.filter((e) => byTag(e) && byQuery(e));
  renderList();
}

function selectEntry(id) {
  state.selectedId = id;
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;
  editorTitle.textContent = entry.name || "未命名";
  editorSub.textContent = entry.username || "无账号";
  fieldName.value = entry.name || "";
  fieldUser.value = entry.username || "";
  fieldPass.value = entry.password || "";
  fieldUrl.value = entry.url || "";
  fieldTags.value = entry.tags || "";
  fieldNotes.value = entry.notes || "";
  renderList();
}

function clearEditor() {
  state.selectedId = null;
  editorTitle.textContent = "新条目";
  editorSub.textContent = "填写条目详情。";
  fieldName.value = "";
  fieldUser.value = "";
  fieldPass.value = "";
  fieldUrl.value = "";
  fieldTags.value = "";
  fieldNotes.value = "";
  renderList();
}

function rebuildTags() {
  const set = new Set(tagLibrary.map((t) => t.name));
  state.entries.forEach((e) => {
    (e.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => set.add(t));
  });
  const tags = Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  Array.from(activeTags).forEach((t) => {
    if (!set.has(t)) {
      activeTags.delete(t);
    }
  });
  tagList.innerHTML = "";
  const allChip = document.createElement("div");
  allChip.className = "tag-chip" + (activeTags.size === 0 ? " active" : "");
  allChip.textContent = "全部";
  allChip.addEventListener("click", () => {
    activeTags.clear();
    rebuildTags();
    filterEntries();
  });
  tagList.appendChild(allChip);
  tags.forEach((tag) => {
    const chip = document.createElement("div");
    chip.className = "tag-chip" + (activeTags.has(tag) ? " active" : "");
    chip.textContent = tag;
    const color = getTagColor(tag);
    if (color) {
      chip.style.borderColor = color;
      chip.style.color = color;
    }
    chip.addEventListener("click", () => {
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
      } else {
        activeTags.add(tag);
      }
      rebuildTags();
      filterEntries();
    });
    tagList.appendChild(chip);
  });
}

async function saveVault() {
  if (!state.unlocked) return;
  const res = await window.vault.save(state.password, state.entries);
  if (!res.ok) {
    showToast("保存失败");
  }
}

function updateCurrentFromFields() {
  if (!state.selectedId) return null;
  const entry = state.entries.find((e) => e.id === state.selectedId);
  if (!entry) return null;
  entry.name = fieldName.value.trim();
  entry.username = fieldUser.value.trim();
  entry.password = fieldPass.value;
  entry.url = fieldUrl.value.trim();
  entry.tags = fieldTags.value.trim();
  entry.notes = fieldNotes.value;
  return entry;
}

btnUnlock.addEventListener("click", async () => {
  const pw = masterPassword.value;
  if (!pw) return;
  const res = await window.vault.open(pw);
  if (!res.ok) {
    vaultHint.textContent = "密码错误或库已损坏。";
    return;
  }
  state.password = pw;
  state.entries = res.data || [];
  if (!res.exists) {
    vaultHint.textContent = "未找到库，请创建新库。";
    return;
  }
  setUnlocked(true);
  rebuildTags();
  filterEntries();
  clearEditor();
});

btnCreate.addEventListener("click", async () => {
  const pw = masterPassword.value;
  if (!pw) return;
  const res = await window.vault.create(pw);
  if (!res.ok) {
    vaultHint.textContent = "创建失败。";
    return;
  }
  state.password = pw;
  state.entries = [];
  setUnlocked(true);
  rebuildTags();
  filterEntries();
  clearEditor();
});

btnNew.addEventListener("click", () => {
  clearEditor();
});

btnSave.addEventListener("click", async () => {
  if (!state.unlocked) return;
  const name = fieldName.value.trim();
  if (!name) {
    showToast("名称不能为空");
    return;
  }
  let entry = updateCurrentFromFields();
  if (!entry) {
    entry = {
      id: crypto.randomUUID(),
      name,
      username: fieldUser.value.trim(),
      password: fieldPass.value,
      url: fieldUrl.value.trim(),
      tags: fieldTags.value.trim(),
      notes: fieldNotes.value
    };
    state.entries.unshift(entry);
    state.selectedId = entry.id;
  }
  await saveVault();
  rebuildTags();
  filterEntries();
  selectEntry(state.selectedId);
  showToast("已保存");
});

btnDelete.addEventListener("click", async () => {
  if (!state.selectedId) return;
  state.entries = state.entries.filter((e) => e.id !== state.selectedId);
  state.selectedId = null;
  await saveVault();
  rebuildTags();
  filterEntries();
  clearEditor();
  showToast("已删除");
});

btnCopy.addEventListener("click", () => {
  const pw = fieldPass.value;
  if (!pw) return;
  navigator.clipboard.writeText(pw);
  showToast("已复制，15 秒后清空剪贴板");
  setTimeout(() => {
    navigator.clipboard.writeText("");
  }, CLIPBOARD_CLEAR_MS);
});

btnClearPass.addEventListener("click", async () => {
  if (!state.selectedId) {
    showToast("请先选择条目");
    return;
  }
  fieldPass.value = "";
  const entry = updateCurrentFromFields();
  if (!entry) return;
  await saveVault();
  filterEntries();
  selectEntry(state.selectedId);
  showToast("密码已清空");
});

btnTogglePass.addEventListener("click", () => {
  const isHidden = fieldPass.type === "password";
  fieldPass.type = isHidden ? "text" : "password";
  btnTogglePass.textContent = isHidden ? "隐藏" : "显示";
});

btnReveal.addEventListener("click", () => {
  window.vault.revealPath();
});

searchInput.addEventListener("input", filterEntries);

rebuildTags();

document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });
});

btnExportJson.addEventListener("click", async () => {
  if (!state.unlocked) return;
  const res = await window.vault.exportJson(state.entries);
  if (res.ok) showToast("已导出 JSON");
});

btnImportJson.addEventListener("click", async () => {
  if (!state.unlocked) return;
  const res = await window.vault.importJson();
  if (!res.ok) return;
  if (!Array.isArray(res.data)) {
    showToast("导入失败：格式不正确");
    return;
  }
  state.entries = res.data.map((e) => ({
    id: e.id || crypto.randomUUID(),
    name: e.name || "",
    username: e.username || "",
    password: e.password || "",
    url: e.url || "",
    tags: e.tags || "",
    notes: e.notes || ""
  }));
  await saveVault();
  rebuildTags();
  filterEntries();
  clearEditor();
  showToast("已导入 JSON");
});

btnExportCsv.addEventListener("click", async () => {
  if (!state.unlocked) return;
  const res = await window.vault.exportCsv(state.entries);
  if (res.ok) showToast("已导出 CSV");
});

btnGen.addEventListener("click", () => {
  genModal.classList.add("show");
});

btnGenCancel.addEventListener("click", () => {
  genModal.classList.remove("show");
});

btnGenOk.addEventListener("click", () => {
  const len = Math.max(8, Math.min(64, parseInt(genLen.value || "16", 10)));
  const pwd = generatePassword(len, {
    upper: genUpper.checked,
    lower: genLower.checked,
    num: genNum.checked,
    sym: genSym.checked
  });
  fieldPass.value = pwd;
  genModal.classList.remove("show");
  showToast("已生成");
});

function generatePassword(length, opts) {
  const sets = [];
  if (opts.upper) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (opts.lower) sets.push("abcdefghijklmnopqrstuvwxyz");
  if (opts.num) sets.push("0123456789");
  if (opts.sym) sets.push("!@#$%^&*()_+-={}[]:;,.?");
  if (sets.length === 0) return "";
  let all = sets.join("");
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % all.length;
    result += all[idx];
  }
  return result;
}

btnTagManage.addEventListener("click", () => {
  renderTagManager();
  tagModal.classList.add("show");
});

btnTagClose.addEventListener("click", () => {
  tagModal.classList.remove("show");
});

btnTagAdd.addEventListener("click", () => {
  const name = tagNameInput.value.trim();
  if (!name) return;
  if (tagLibrary.find((t) => t.name === name)) {
    showToast("标签已存在");
    return;
  }
  tagLibrary.push({ name, color: tagColorInput.value });
  saveTagLibrary();
  tagNameInput.value = "";
  renderTagManager();
  rebuildTags();
});

function renderTagManager() {
  tagManageList.innerHTML = "";
  const sorted = [...tagLibrary].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  sorted.forEach((tag) => {
    const row = document.createElement("div");
    row.className = "tag-manage-item";
    row.innerHTML = `
      <div>${escapeHtml(tag.name)}</div>
      <input class="tag-color" type="color" value="${tag.color}" />
      <button class="btn ghost">删除</button>
    `;
    const colorInput = row.querySelector("input");
    const delBtn = row.querySelector("button");
    colorInput.addEventListener("input", () => {
      tag.color = colorInput.value;
      saveTagLibrary();
      rebuildTags();
    });
    delBtn.addEventListener("click", () => {
      tagLibrary = tagLibrary.filter((t) => t.name !== tag.name);
      saveTagLibrary();
      renderTagManager();
      rebuildTags();
    });
    tagManageList.appendChild(row);
  });
}

function loadTagLibrary() {
  try {
    const raw = localStorage.getItem("tagLibrary");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function saveTagLibrary() {
  localStorage.setItem("tagLibrary", JSON.stringify(tagLibrary));
}

function getTagColor(name) {
  const found = tagLibrary.find((t) => t.name === name);
  return found ? found.color : "";
}

const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

setUnlocked(false);

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const FILE_NAME = "vault.pwm";
const MAGIC = "PWM1";
const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 100_000;
const KEY_LEN = 32;

let mainWindow;

function getVaultPath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#0b0f14",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  const template = [
    {
      label: "文件",
      submenu: [
        { label: "新建窗口", role: "newWindow" },
        { type: "separator" },
        { label: "关闭窗口", role: "close" },
        { label: "退出", role: "quit" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { label: "开发者工具", role: "toggleDevTools" },
        { type: "separator" },
        { label: "实际大小", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { type: "separator" },
        { label: "全屏", role: "togglefullscreen" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        { label: "缩放", role: "zoom" },
        { type: "separator" },
        { label: "置于前台", role: "front" }
      ]
    },
    {
      label: "帮助",
      submenu: [{ label: "了解更多", role: "about" }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, "sha256");
}

function encryptVault(plain, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.concat([
    Buffer.from(MAGIC, "ascii"),
    Buffer.from([salt.length]),
    Buffer.from([iv.length]),
    salt,
    iv,
    tag
  ]);
  return Buffer.concat([header, enc]);
}

function decryptVault(buffer, password) {
  if (buffer.length < 4 + 1 + 1 + SALT_LEN + IV_LEN + 16) {
    throw new Error("Invalid file.");
  }
  const magic = buffer.subarray(0, 4).toString("ascii");
  if (magic !== MAGIC) throw new Error("Bad file format.");
  const saltLen = buffer.readUInt8(4);
  const ivLen = buffer.readUInt8(5);
  let offset = 6;
  const salt = buffer.subarray(offset, offset + saltLen);
  offset += saltLen;
  const iv = buffer.subarray(offset, offset + ivLen);
  offset += ivLen;
  const tag = buffer.subarray(offset, offset + 16);
  offset += 16;
  const enc = buffer.subarray(offset);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

function loadVault(password) {
  const file = getVaultPath();
  if (!fs.existsSync(file)) {
    return { exists: false, data: [] };
  }
  const buf = fs.readFileSync(file);
  const json = decryptVault(buf, password);
  const parsed = JSON.parse(json);
  return { exists: true, data: parsed };
}

function saveVault(password, data) {
  const file = getVaultPath();
  const json = JSON.stringify(data, null, 2);
  const enc = encryptVault(json, password);
  fs.writeFileSync(file, enc);
}

ipcMain.handle("vault:open", async (_evt, password) => {
  try {
    const res = loadVault(password);
    return { ok: true, exists: res.exists, data: res.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("vault:create", async (_evt, password) => {
  try {
    saveVault(password, []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("vault:save", async (_evt, password, data) => {
  try {
    saveVault(password, data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("vault:revealPath", async () => {
  const file = getVaultPath();
  try {
    await dialog.showMessageBox({
      type: "info",
      message: "库文件位置",
      detail: file
    });
  } catch {
    // ignore
  }
});

ipcMain.handle("vault:exportJson", async (_evt, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "导出 JSON",
    defaultPath: "vault.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("vault:importJson", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "导入 JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const content = fs.readFileSync(filePaths[0], "utf8");
    const parsed = JSON.parse(content);
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("vault:exportCsv", async (_evt, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "导出 CSV",
    defaultPath: "vault.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const header = "name,username,password,url,tags,notes\n";
    const lines = data.map((e) => {
      return [
        e.name || "",
        e.username || "",
        e.password || "",
        e.url || "",
        e.tags || "",
        (e.notes || "").replaceAll("\\n", " ")
      ].map(csvEscape).join(",");
    });
    fs.writeFileSync(filePath, header + lines.join("\n"), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function csvEscape(value) {
  const v = String(value);
  if (v.includes("\"") || v.includes(",") || v.includes("\n")) {
    return "\"" + v.replaceAll("\"", "\"\"") + "\"";
  }
  return v;
}

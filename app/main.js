const { app, BrowserWindow, Menu, ipcMain, shell, dialog, screen, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const QRCode = require('qrcode');
const lan = require('./lan');
const mediaLib = require('./media-library');
const mobileInbox = require('./mobile-inbox');
const pdfView = require('./pdf-view');

const isDev = !app.isPackaged;
const DATA_DIR = path.join(app.getPath('appData'), '六爻书房');
const USER_DATA = path.join(DATA_DIR, 'data');
const RENDERER = path.join(__dirname, 'renderer');
const DIRS = ['assets', 'assets/backgrounds', 'backups', 'logs'];
const REPO = 'fengye126/liuyao-study';
const RELEASES_API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const UPDATE_CHECK_KEY = 'lastUpdateCheck';
const DATA_FILES = ['books.js', 'media.js', 'media-index.js', 'lessons-manifest.js', 'library.js', 'almanac.js'];

let mainWindow = null;
let lanServer = null;
let lanHandle = null;
let lanPort = 0;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(USER_DATA, { recursive: true });
  for (const d of DIRS) fs.mkdirSync(path.join(DATA_DIR, d), { recursive: true });
}

function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); } catch (e) { return fallback; }
}

function writeJsonAtomic(name, value) {
  const target = path.join(DATA_DIR, name);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function backupData() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(DATA_DIR, 'backups', stamp);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['data.json', 'config.json', 'peers.json']) {
      const src = path.join(DATA_DIR, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
    }
    const list = fs.readdirSync(path.join(DATA_DIR, 'backups'))
      .filter((x) => fs.statSync(path.join(DATA_DIR, 'backups', x)).isDirectory()).sort();
    while (list.length > 3) fs.rmSync(path.join(DATA_DIR, 'backups', list.shift()), { recursive: true, force: true });
  } catch (e) { console.error('backup failed', e); }
}

function parseVersion(v) { return String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0); }
function isNewer(remote, local) {
  const a = parseVersion(remote), b = parseVersion(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(RELEASES_API, {
      headers: { 'User-Agent': 'liuyao-shufang-updater', Accept: 'application/vnd.github+json' }, timeout: 12000
    }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function checkForUpdates({ silent }) {
  const current = app.getVersion();
  let release;
  try { release = await fetchLatestRelease(); }
  catch (e) {
    if (!silent) {
      dialog.showMessageBox({
        type: 'warning', title: '检查更新', message: '暂时连不上 GitHub，没法检查更新。',
        detail: '稍后再试，或直接打开发布页查看。', buttons: ['打开发布页', '知道了'], defaultId: 1, cancelId: 1
      }).then((r) => { if (r.response === 0) shell.openExternal('https://github.com/' + REPO + '/releases'); });
    }
    return;
  }
  writeJsonAtomic(UPDATE_CHECK_KEY, { at: Date.now() });
  if (!release) { if (!silent) dialog.showMessageBox({ type: 'info', title: '检查更新', message: '还没有发布过版本。' }); return; }
  const tag = release.tag_name || release.name || '';
  if (!isNewer(tag, current)) {
    if (!silent) dialog.showMessageBox({ type: 'info', title: '检查更新', message: '已是最新版本 v' + current });
    return;
  }
  const asset = (release.assets || []).find((a) => /\.exe$/i.test(a.name));
  dialog.showMessageBox({
    type: 'info', title: '发现新版本',
    message: '有新版 ' + tag + '（当前 v' + current + '）',
    detail: (release.body || '').split('\n').slice(0, 8).join('\n'),
    buttons: asset ? ['下载新版', '稍后', '打开发布页'] : ['打开发布页', '稍后'],
    defaultId: 0, cancelId: 1
  }).then((r) => {
    if (asset && r.response === 0) shell.openExternal(asset.browser_download_url);
    else if ((!asset && r.response === 0) || r.response === 2) shell.openExternal(release.html_url);
  });
}

/* ---------- 资料导入 ---------- */
function importedStatus() {
  const books = path.join(USER_DATA, 'books.js');
  return {
    imported: fs.existsSync(books),
    booksBytes: fs.existsSync(books) ? fs.statSync(books).size : 0,
    files: DATA_FILES.filter((f) => fs.existsSync(path.join(USER_DATA, f)))
  };
}

function findDataFiles(root) {
  const found = {};
  const queue = [root];
  let guard = 0;
  while (queue.length && guard++ < 300) {
    const dir = queue.shift();
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!/node_modules|\.git/.test(ent.name)) queue.push(full); }
      else if (DATA_FILES.includes(ent.name) && !found[ent.name]) found[ent.name] = full;
    }
  }
  return found;
}

const DATA_GLOBALS = {
  'books.js': 'window.BOOKS_TEXT',
  'library.js': 'window.LIUYAO_LIBRARY',
  'media.js': 'window.MEDIA',
  'media-index.js': 'window.MEDIA_INDEX',
  'lessons-manifest.js': 'window.LESSONS',
  'almanac.js': 'window.ALMANAC'
};
function checkDataFile(file, name) {
  const stat = fs.statSync(file);
  if (stat.size > 120 * 1024 * 1024) return '文件超过 120MB';
  const head = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).slice(0, 400000);
  const globalName = DATA_GLOBALS[name];
  if (globalName && !head.includes(globalName)) return '缺少 ' + globalName + ' 定义（不是本应用的资料文件）';
  if (name === 'library.js' && !/"books"\s*:/.test(head)) return '书库结构不完整';
  return '';
}
async function importData(win) {
  const res = await dialog.showOpenDialog(win, {
    title: '选择资料目录（含 books.js 的 data 文件夹或其上一级）', properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const found = findDataFiles(res.filePaths[0]);
  if (!found['books.js']) {
    dialog.showMessageBox(win, { type: 'warning', title: '导入资料', message: '这个目录里没找到 books.js', detail: '请选择项目里的 09_原型\\data 文件夹（或它的上一级）。' });
    return { ok: false, reason: 'no-books' };
  }
  const bad = [];
  for (const name of DATA_FILES) {
    if (!found[name]) continue;
    const err = checkDataFile(found[name], name);
    if (err) bad.push(name + '：' + err);
  }
  if (bad.length) {
    dialog.showMessageBox(win, { type: 'error', title: '导入资料', message: '资料文件校验没通过，未导入任何文件', detail: bad.join('\n') });
    return { ok: false, reason: 'invalid', detail: bad };
  }
  fs.mkdirSync(USER_DATA, { recursive: true });
  try { backupData(); } catch (e) {}
  const tmp = [];
  for (const name of DATA_FILES) {
    if (!found[name]) continue;
    const dst = path.join(USER_DATA, name);
    const t = dst + '.importing';
    fs.copyFileSync(found[name], t);
    tmp.push([t, dst]);
  }
  for (const [t, dst] of tmp) fs.renameSync(t, dst);
  if (win) win.webContents.reload();
  return { ok: true, imported: importedStatus() };
}

/* ---------- 局域网 ---------- */
async function startLan() {
  if (lanServer) return;
  const r = await lan.start({
    renderer: RENDERER, userData: USER_DATA, dataDir: DATA_DIR, version: app.getVersion(),
    logFile: path.join(DATA_DIR, 'logs', 'lan-audit.log')
  });
  lanServer = r.server;
  lanHandle = r;
  try { r.setInboxHandler((item) => mobileInbox.append(DATA_DIR, item)); } catch (e) {}
  lanPort = r.port;
}

async function lanInfo() {
  await startLan();
  const ips = lan.lanIPs();
  const token = (lanHandle && lanHandle.token) || '';
  const base = 'http://' + (ips[0] || '127.0.0.1') + ':' + lanPort + '/';
  const url = token ? base + '?k=' + token : base;
  let qr = '';
  try { qr = await QRCode.toDataURL(url, { margin: 1, width: 240 }); } catch (e) { qr = ''; }
  let failures = [];
  try {
    if (lanHandle && typeof lanHandle.audit === 'function') failures = lanHandle.audit().filter((a) => a.status >= 400).slice(-10);
  } catch (e) {}
  return {
    url, port: lanPort, qr, ips,
    pairCode: (lanHandle && lanHandle.pairCode) || '',
    pairExpires: (lanHandle && lanHandle.pairExpires) || 0,
    auditFailures: failures,
    imported: importedStatus()
  };
}

function lanRegenPair() {
  if (!lanHandle || typeof lanHandle.regeneratePair !== 'function') return { pairCode: '', pairExpires: 0 };
  return lanHandle.regeneratePair();
}
function lanAudit() {
  try { return lanHandle && typeof lanHandle.audit === 'function' ? lanHandle.audit() : []; } catch (e) { return []; }
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.max(900, Math.min(1440, Math.round(area.width * 0.96)));
  const height = Math.max(600, Math.min(920, Math.round(area.height * 0.94)));
  const win = new BrowserWindow({
    width, height, minWidth: 900, minHeight: 600, center: true,
    backgroundColor: '#F7F4EC', autoHideMenuBar: true, title: '六爻书房',
    icon: path.join(RENDERER, 'brand-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  mainWindow = win;
  Menu.setApplicationMenu(null);
  win.center();
  win.loadFile(path.join(RENDERER, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') win.webContents.openDevTools({ mode: 'detach' });
  });
  return win;
}

ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: DATA_DIR, isDev, imported: importedStatus() }));
ipcMain.handle('app:checkUpdate', () => checkForUpdates({ silent: false }));
ipcMain.handle('data:import', (e) => importData(BrowserWindow.fromWebContents(e.sender)));
ipcMain.handle('data:status', () => importedStatus());
ipcMain.handle('lan:info', () => lanInfo());
ipcMain.handle('lan:regenPair', () => lanRegenPair());
ipcMain.handle('lan:pushCases', (_e, list) => { try { lanHandle && lanHandle.setSnapshot(list); } catch (err) {} return true; });
ipcMain.handle('mobile:list', () => mobileInbox.list(DATA_DIR));
ipcMain.handle('mobile:ack', (_e, id) => mobileInbox.ack(DATA_DIR, String(id)));
ipcMain.handle('lan:audit', () => lanAudit());
ipcMain.on('media:rootSync', (e) => {
  try { e.returnValue = mediaLib.loadConfig(DATA_DIR, RENDERER).root; } catch (err) { e.returnValue = ''; }
});
ipcMain.handle('media:info', () => mediaLib.info(DATA_DIR, RENDERER));
ipcMain.handle('media:scan', () => mediaLib.info(DATA_DIR, RENDERER));
ipcMain.handle('media:chooseRoot', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: '选择媒体库文件夹', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return mediaLib.info(DATA_DIR, RENDERER);
  mediaLib.setRoot(DATA_DIR, r.filePaths[0]);
  return mediaLib.info(DATA_DIR, RENDERER);
});
ipcMain.handle('media:revealRoot', () => {
  const root = mediaLib.loadConfig(DATA_DIR, RENDERER).root;
  return shell.openPath(root);
});
ipcMain.handle('pdf:openInApp', async (e, href) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const base = (() => { try { return path.basename(decodeURIComponent(String(href).replace(/^file:\/\/\//i, ''))); } catch (err) { return ''; } })();
  const roots = readJson('pdf-paths.json', {}) || {};
  let target = href;
  /* 之前定位过的 PDF：优先用记住的路径 */
  if (base && roots[base] && fs.existsSync(roots[base])) target = 'file:///' + roots[base];
  try {
    let r;
    try { r = pdfView.openPdfWindow(target, BrowserWindow, { parent: win }); }
    catch (err) {
      if (!/不在本机/.test(err.message)) throw err;
      /* 首次缺失：让用户定位（一次性记住） */
      const sel = await dialog.showOpenDialog(win, { title: '定位 PDF 原文：' + (base || ''), properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (sel.canceled || !sel.filePaths || !sel.filePaths[0]) return { ok: false, error: err.message };
      const chosen = sel.filePaths[0];
      if (base) { roots[base] = chosen; writeJsonAtomic('pdf-paths.json', roots); }
      r = pdfView.openPdfWindow('file:///' + chosen, BrowserWindow, { parent: win });
    }
    return { ok: !!r.ok, path: r.path, size: r.size };
  } catch (err) {
    dialog.showMessageBox({ type: 'info', title: 'PDF 应用内阅读', message: err.message });
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('pdf:open', async (e, href) => {
  const file = String(href || '').replace(/^file:\/\/\//, '');
  if (!file || !fs.existsSync(file)) {
    dialog.showMessageBox({ type: 'info', title: 'PDF 原件', message: 'PDF 原件不在这台电脑上。', detail: '安装包不含书源文件；请把 PDF 放进资料目录后再试。' });
    return { ok: false };
  }
  await shell.openPath(file);
  return { ok: true };
});
ipcMain.handle('data:load', (_e, name) => (['data.json', 'config.json', 'peers.json'].includes(name) ? readJson(name, null) : null));
ipcMain.handle('data:save', (_e, name, value) => {
  if (!['data.json', 'config.json', 'peers.json'].includes(name)) return false;
  backupData(); writeJsonAtomic(name, value); return true;
});
ipcMain.handle('background:import', async () => {
  const res = await dialog.showOpenDialog({
    title: '选择背景图片 / GIF / 视频', properties: ['openFile'],
    filters: [{ name: '图片与视频', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'] }]
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const src = res.filePaths[0];
  const stat = fs.statSync(src);
  const ext = path.extname(src).toLowerCase();
  const cap = ['.mp4', '.webm', '.mov'].includes(ext) ? 200 * 1024 * 1024 : 30 * 1024 * 1024;
  if (stat.size > cap) return { error: '文件超过同步/导入上限' };
  const name = 'background' + ext;
  const dst = path.join(DATA_DIR, 'assets', 'backgrounds', name);
  fs.copyFileSync(src, dst);
  return { name, path: dst, size: stat.size };
});

app.whenReady().then(() => {
  ensureDirs();
  // 必须等 app ready 之后才能接管 file 协议
  protocol.interceptFileProtocol('file', (req, cb) => {
    try {
      const u = new URL(req.url);
      const p = decodeURIComponent(u.pathname).replace(/^\//, '');
      const m = p.match(/renderer\/data\/([a-z0-9-]+\.js)$/i);
      if (m) {
        const imported = path.join(USER_DATA, m[1]);
        if (fs.existsSync(imported)) return cb({ path: imported });
      }
      cb({ path: p });
    } catch (e) { cb({ path: req.url }); }
  });
  writeJsonAtomic('config.json', readJson('config.json', { theme: 'paper', background: null, font: 'song', fontSize: 18, schemaVersion: 1 }));
  writeJsonAtomic('data.json', readJson('data.json', { schemaVersion: 1, cases: [], notes: [], bookmarks: [], calendar: {}, modifiedAt: new Date().toISOString() }));
  createWindow();
  startLan();
  setTimeout(() => checkForUpdates({ silent: true }), 5000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

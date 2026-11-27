/**
 * 应用内 PDF 只读窗口：校验路径后用独立 BrowserWindow 打开 Chromium 内置 PDF 查看器。
 * 不引入 pdf.js；只读，不提供编辑/保存。
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const MAX_BYTES = 300 * 1024 * 1024;

function resolvePdf(href) {
  let raw = String(href || '').trim();
  if (!raw) throw new Error('缺少 PDF 路径');
  if (/^file:\/\//i.test(raw)) {
    try { raw = decodeURIComponent(raw.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '')); } catch (e) { throw new Error('PDF 路径无法解析'); }
  }
  if (!/\.pdf$/i.test(raw)) throw new Error('只支持 PDF 文件');
  const abs = path.resolve(raw);
  let st;
  try { st = fs.statSync(abs); } catch (e) { throw new Error('PDF 原文不在本机：' + path.basename(abs)); }
  if (!st.isFile()) throw new Error('PDF 路径不是文件');
  if (st.size > MAX_BYTES) throw new Error('PDF 超过 300MB，拒绝打开');
  if (st.size < 5) throw new Error('PDF 文件为空');
  return { path: abs, size: st.size };
}

function openPdfWindow(href, BrowserWindow, opts = {}) {
  const { path: file, size } = resolvePdf(href);
  const parent = opts.parent && !opts.parent.isDestroyed() ? opts.parent : null;
  const win = new BrowserWindow({
    width: 1040, height: 800, minWidth: 640, minHeight: 480,
    parent: parent || undefined, modal: false, show: true,
    title: path.basename(file), backgroundColor: '#F7F4EC', autoHideMenuBar: true,
    webPreferences: {
      plugins: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.loadURL(pathToFileURL(file).href);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return { ok: true, path: file, size, win };
}

module.exports = { resolvePdf, openPdfWindow, MAX_BYTES };

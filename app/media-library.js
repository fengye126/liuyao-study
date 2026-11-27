/**
 * 媒体库：媒体根目录配置 + 缺失扫描。
 * 数据索引来自 renderer/data/media-index.js（生成产物，523 条，含相对路径与字节数）。
 */
const fs = require('fs');
const path = require('path');

const CONFIG_NAME = 'media-root.json';

function indexOf(renderer) {
  const file = path.join(renderer, 'data', 'media-index.js');
  try {
    const src = fs.readFileSync(file, 'utf8');
    const m = src.match(/window\.MEDIA_INDEX\s*=\s*([\s\S]*);\s*$/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    return data && Array.isArray(data.items) ? data : null;
  } catch (e) {
    return null;
  }
}

function configPath(dataDir) {
  return path.join(dataDir, CONFIG_NAME);
}

function defaultRoot(dataDir, renderer) {
  const idx = indexOf(renderer);
  const legacy = idx && idx.root ? idx.root : 'D:/BaiduNetdiskDownload';
  try { if (legacy && fs.existsSync(legacy)) return legacy; } catch (e) {}
  return path.join(dataDir, 'media');
}

function loadConfig(dataDir, renderer) {
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(configPath(dataDir), 'utf8')); } catch (e) {}
  const root = cfg && typeof cfg.root === 'string' && cfg.root.trim() ? cfg.root : defaultRoot(dataDir, renderer);
  return { root, updatedAt: (cfg && cfg.updatedAt) || null };
}

function saveConfig(dataDir, root) {
  const cfg = { root: String(root), updatedAt: new Date().toISOString() };
  const target = configPath(dataDir);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, target);
  return cfg;
}

function fileSafe(root, rel) {
  const full = path.join(root, rel.split('/').join(path.sep));
  return full;
}

function info(dataDir, renderer) {
  const { root, updatedAt } = loadConfig(dataDir, renderer);
  const idx = indexOf(renderer);
  if (!idx) {
    return { ok: false, error: 'media-index 缺失', root, exists: fs.existsSync(root), total: 0, present: 0, missingCount: 0, missing: [], bytes: 0 };
  }
  let present = 0, bytes = 0;
  const missing = [];
  for (const item of idx.items) {
    const full = fileSafe(root, item.rel);
    let st = null;
    try { st = fs.statSync(full); } catch (e) {}
    if (st && st.isFile()) {
      present++;
      bytes += st.size;
      if (item.bytes > 0 && st.size !== item.bytes) {
        /* 大小不一致只记录，不判缺失（转码/替换常见） */
      }
    } else {
      missing.push(item.rel);
    }
  }
  const kindOf = (rel) => {
    const ext = path.extname(rel).toLowerCase();
    if (/\.(mp3|m4a|wav|ogg|flac|aac)$/.test(ext)) return 'audio';
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(ext)) return 'image';
    if (/\.(mp4|webm|mov|m4v)$/.test(ext)) return 'video';
    if (/\.pdf$/.test(ext)) return 'pdf';
    return 'other';
  };
  const missingByKind = {};
  for (const rel of missing) missingByKind[kindOf(rel)] = (missingByKind[kindOf(rel)] || 0) + 1;
  return {
    ok: true,
    root,
    updatedAt,
    exists: fs.existsSync(root),
    total: idx.items.length,
    present,
    missingCount: missing.length,
    missing: missing.slice(0, 60),
    missingByKind,
    bytes
  };
}

function setRoot(dataDir, root) {
  const cfg = saveConfig(dataDir, root);
  return cfg;
}

module.exports = { indexOf, loadConfig, saveConfig, defaultRoot, info, setRoot };

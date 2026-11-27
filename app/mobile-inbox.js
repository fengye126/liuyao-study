/**
 * 手机提交收件箱：追加写入 JSON 文件，桌面端合并后移出。
 * 文件：<dataDir>/mobile-inbox.json，结构 {items:[{id,at,kind,caseId,text,ip}]}
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'mobile-inbox.json';
const MAX_ITEMS = 200;
const MAX_TEXT = 8000;

function fileOf(dataDir) { return path.join(dataDir, NAME); }

function load(dataDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(fileOf(dataDir), 'utf8'));
    return raw && Array.isArray(raw.items) ? raw : { items: [] };
  } catch (e) { return { items: [] }; }
}

function save(dataDir, data) {
  const target = fileOf(dataDir);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function append(dataDir, item) {
  const data = load(dataDir);
  const id = crypto.randomUUID();
  const rec = {
    id,
    at: Date.now(),
    kind: item.kind,
    caseId: item.caseId || '',
    text: String(item.text || '').slice(0, MAX_TEXT),
    ip: item.ip || ''
  };
  data.items.push(rec);
  if (data.items.length > MAX_ITEMS) data.items = data.items.slice(-MAX_ITEMS);
  save(dataDir, data);
  return rec;
}

function list(dataDir) { return load(dataDir).items; }
function ack(dataDir, id) {
  const data = load(dataDir);
  data.items = data.items.filter((x) => x.id !== id);
  save(dataDir, data);
  return true;
}
function count(dataDir) { return load(dataDir).items.length; }

module.exports = { fileOf, load, save, append, list, ack, count, MAX_TEXT };

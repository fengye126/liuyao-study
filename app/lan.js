const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

const MEDIA_EXT = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.webm', '.mov', '.m4v',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.bmp']);

const DATA_ALLOW = new Set(['books.js', 'media.js', 'media-index.js', 'library.js', 'almanac.js', 'lessons-manifest.js']);
const PAIR_TTL = 5 * 60 * 1000;
const AUTH_FAIL_LIMIT = 5;
const AUTH_BLOCK_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 300;

function isPrivateIP(ip) {
  if (!ip) return false;
  let v = String(ip);
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v === '127.0.0.1' || v === '::1') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  return /^f[cd][0-9a-f]{2}:/i.test(v) || /^fe80:/i.test(v);
}

function timingEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function mediaRootsOf(dataDir, userData) {
  const roots = new Set();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'media-root.json'), 'utf8'));
    if (cfg && cfg.root) roots.add(path.resolve(cfg.root));
  } catch (e) {}
  roots.add(path.resolve(path.join(dataDir, 'media')));
  const files = [
    path.join(dataDir, 'media.js'), path.join(userData, 'media.js'),
    path.join(dataDir, 'lessons-manifest.js'), path.join(userData, 'lessons-manifest.js')
  ];
  for (const f of files) {
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const re = /file:\/\/\/([^"'\\<>]+)/g;
    let m;
    while ((m = re.exec(text))) {
      try { roots.add(path.dirname(path.resolve(decodeURIComponent(m[1])))); } catch (e) {}
    }
  }
  return [...roots];
}

function lanBootScript(token) {
  return `<script>(function(){
window.__LAN_MODE=1;window.__LAN_READONLY=1;var TK='${String(token || '').replace(/'/g, '')}';
function rw(u){if(typeof u!=='string')return u;if(u.indexOf('file:///')!==0)return u;return '/media?src='+encodeURIComponent(u)+'\u0026k='+TK}
function wrap(name){var store;try{Object.defineProperty(window,name,{configurable:true,get:function(){return store},set:function(v){
  try{if(name==='MEDIA'&&v&&v.audio){v.audio.forEach(function(g){g.items.forEach(function(it){it.path=rw(it.path)})})}
  if(name==='MEDIA'&&v&&v.images){v.images.forEach(function(it){it.path=rw(it.path)})}
  if(name==='MEDIA'&&v&&v.video){v.video.forEach(function(it){it.path=rw(it.path)})}
  if(name==='LESSONS'&&Array.isArray(v)){v.forEach(function(it){it.img=rw(it.img);it.audio=rw(it.audio)})}
  }catch(e){}
  store=v;}})}catch(e){}}
wrap('MEDIA');wrap('LESSONS');
document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){
  var sel='#checkUpdate,#ghReleases,[data-c-backup],[data-c-restore],[data-edit-result],[data-c-save-result],[data-new-case],#castAgain,#saveCase,#saveModalConfirm';
  document.querySelectorAll(sel).forEach(function(el){el.style.display='none'});
  document.querySelectorAll('button').forEach(function(b){var t=(b.textContent||'').trim();if(/^(保存|存入|补记|新建|导入|导出|恢复|删除|创建备份|Open PDF)/.test(t))b.style.display='none'});
  document.documentElement.setAttribute('data-lan-readonly','1');
},300)});
/* 手机轻写入：提交反馈/复盘到桌面收件箱 */
function mobileWriteUI(){
  var btn=document.createElement('button');
  btn.textContent='手机提交';
  btn.style.cssText='position:fixed;right:14px;bottom:76px;z-index:220;padding:10px 14px;border-radius:999px;border:1px solid #c9a06a;background:#fdf6e8;color:#7a5a2e;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.18)';
  document.body.appendChild(btn);
  btn.addEventListener('click',function(){
    if(document.getElementById('mobileWriteWrap'))return;
    var wrap=document.createElement('div');
    wrap.id='mobileWriteWrap';
    wrap.style.cssText='position:fixed;inset:0;z-index:230;background:rgba(20,24,22,.45);display:flex;align-items:center;justify-content:center';
    wrap.innerHTML='<div style="width:min(92vw,420px);background:#f7f4ec;border-radius:14px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.3)">'+
      '<h3 style="margin:0 0 10px;font-size:16px">手机提交</h3>'+
      '<label style="font-size:12px;color:#6b6457">卦例</label><select id="mwCase" style="width:100%;margin:4px 0 10px;padding:8px"></select>'+
      '<label style="font-size:12px;color:#6b6457">类型</label><select id="mwKind" style="width:100%;margin:4px 0 10px;padding:8px"><option value="feedback">补反馈</option><option value="review">写复盘</option></select>'+
      '<label style="font-size:12px;color:#6b6457">内容</label><textarea id="mwText" rows="4" style="width:100%;margin:4px 0 10px;padding:8px"></textarea>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button id="mwCancel" style="padding:8px 12px">取消</button><button id="mwSend" style="padding:8px 12px;background:#2f5d50;color:#fff;border:0;border-radius:8px">提交</button></div>'+
      '<p id="mwState" style="font-size:12px;color:#8a8070;margin:8px 0 0"></p></div>';
    document.body.appendChild(wrap);
    var sel=wrap.querySelector('#mwCase');
    sel.innerHTML='<option value="">加载中…</option>';
    fetch('/api/cases',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){
      sel.innerHTML=(j.cases||[]).map(function(c){return '<option value="'+c.id+'">'+String(c.q||'').slice(0,24)+' · '+(c.date||'')+'</option>'}).join('')||'<option value="">没有卦例</option>';
    }).catch(function(){sel.innerHTML='<option value="">加载失败</option>'});
    wrap.querySelector('#mwCancel').addEventListener('click',function(){wrap.remove()});
    wrap.querySelector('#mwSend').addEventListener('click',function(){
      var caseId=sel.value, kind=wrap.querySelector('#mwKind').value, text=wrap.querySelector('#mwText').value;
      var st=wrap.querySelector('#mwState');
      if((kind!=='newPending'&&!caseId)||!text.trim()){st.textContent=kind==='newPending'?'请填写占问内容':'请选择卦例并填写内容';return}
      st.textContent='提交中…';
      fetch('/api/inbox',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-lan-write':'1'},body:JSON.stringify({kind:kind,caseId:caseId,text:text})})
        .then(function(r){return r.json().then(function(j){return {s:r.status,j:j}})})
        .then(function(x){ if(x.s===200&&x.j.ok){st.textContent='已提交到桌面收件箱，打开电脑端合并后生效';wrap.querySelector('#mwText').value='';} else st.textContent='提交失败（'+x.s+'）'; })
        .catch(function(){st.textContent='网络错误';});
    });
  });
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',mobileWriteUI);}else{mobileWriteUI();}
})();</script>`;
}

function makeHandler(opts) {
  const { renderer, userData, dataDir, version, token, state, logFile } = opts;
  const root = path.resolve(renderer);
  const userRoot = path.resolve(userData);
  const dataRoot = path.resolve(dataDir);
  const MEDIA_ROOTS = mediaRootsOf(dataDir, userData);
  const sessions = new Map();
  const rates = new Map();
  const authFails = new Map();
  const audit = state.audit;

  function note(ip, pathName, status, reason) {
    if (audit && typeof audit.push === 'function') audit.push({ t: Date.now(), ip, path: pathName, status, reason });
    if (logFile) {
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFile(logFile, new Date().toISOString() + ' ' + ip + ' ' + status + ' ' + (reason || '') + ' ' + pathName + '\n', () => {});
      } catch (e) {}
    }
  }
  function blocked(ip) {
    const b = authFails.get(ip);
    return !!(b && b.blockUntil && Date.now() < b.blockUntil);
  }
  function fail(ip) {
    const now = Date.now();
    const b = authFails.get(ip) || { count: 0, since: now, blockUntil: 0 };
    if (now - b.since > AUTH_BLOCK_MS) { b.count = 0; b.since = now; b.blockUntil = 0; }
    b.count++;
    if (b.count >= AUTH_FAIL_LIMIT) b.blockUntil = now + AUTH_BLOCK_MS;
    authFails.set(ip, b);
  }
  function rateOk(ip) {
    const now = Date.now();
    const r = rates.get(ip) || { start: now, count: 0 };
    if (now - r.start > RATE_WINDOW_MS) { r.start = now; r.count = 0; }
    r.count++;
    rates.set(ip, r);
    return r.count <= RATE_MAX;
  }
  function cookieOf(req, name) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return rest.join('=');
    }
    return '';
  }
  function tokenOf(req, u) {
    return u.searchParams.get('k') || req.headers['x-lan-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  }
  function authorized(req, u) {
    const t = tokenOf(req, u);
    if (t && timingEqual(t, token)) return true;
    const sid = cookieOf(req, 'lan_sid');
    if (!sid) return false;
    const s = sessions.get(sid);
    if (!s) return false;
    if (Date.now() - s.created > 12 * 60 * 60 * 1000) { sessions.delete(sid); return false; }
    return true;
  }
  function ensureSession(req, res) {
    const sid = cookieOf(req, 'lan_sid');
    if (sid && sessions.has(sid)) return;
    const id = crypto.randomBytes(16).toString('hex');
    sessions.set(id, { created: Date.now(), ip: req.socket.remoteAddress });
    res.setHeader('Set-Cookie', 'lan_sid=' + id + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200');
  }
  function serveLanFile(req, res, urlPath) {
    let rel;
    try { rel = decodeURIComponent(urlPath).replace(/^\/+/, ''); } catch (e) { res.writeHead(400); return res.end('bad path'); }
    if (!rel) rel = 'index.html';
    const isData = rel.startsWith('data/');
    if (isData && !DATA_ALLOW.has(path.basename(rel))) { res.writeHead(403); return res.end('forbidden'); }
    let file = path.resolve(root, rel);
    if (isData) {
      const imported = path.resolve(userRoot, path.basename(rel));
      if (fs.existsSync(imported)) file = imported;
    }
    const insideRoot = file === root || file.startsWith(root + path.sep);
    const insideData = isData && (file === dataRoot || file.startsWith(userRoot + path.sep));
    if (!insideRoot && !insideData) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
      const ext = path.extname(file).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
      if (ext === '.html') {
        let html = buf.toString('utf8').replace('</head>', lanBootScript(token) + '</head>');
        res.writeHead(200, headers); return res.end(html);
      }
      res.writeHead(200, headers); res.end(buf);
    });
  }
  function mediaAllowed(file) {
    const abs = path.resolve(file);
    const ext = path.extname(abs).toLowerCase();
    if (!MEDIA_EXT.has(ext)) return false;
    return MEDIA_ROOTS.some((r) => abs === r || abs.startsWith(r + path.sep));
  }
  function streamMedia(req, res, q) {
    const src = q.get('src') || '';
    if (!src.startsWith('file:///')) { res.writeHead(400); return res.end('bad src'); }
    const file = decodeURIComponent(src.replace(/^file:\/\/\//, ''));
    if (!mediaAllowed(file)) { res.writeHead(403); return res.end('forbidden'); }
    let stat;
    try { stat = fs.statSync(file); } catch (e) { res.writeHead(404); return res.end('missing'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }

  return (req, res) => {
    const ip = req.socket.remoteAddress || '';
    const u = new URL(req.url, 'http://localhost');
    const pathName = u.pathname;
    try {
      if (!isPrivateIP(ip)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); note(ip, pathName, 403, 'non-private'); return res.end('lan only'); }
      if (blocked(ip)) { res.writeHead(429, { 'Retry-After': '600' }); note(ip, pathName, 429, 'auth-blocked'); return res.end('too many failures'); }
      if (!rateOk(ip)) { res.writeHead(429, { 'Retry-After': '60' }); note(ip, pathName, 429, 'rate'); return res.end('rate limited'); }
      if (pathName === '/api/inbox' && req.method === 'POST') {
        if (!authorized(req, u)) { fail(ip); note(ip, pathName, 403, 'unauthorized'); res.writeHead(403); return res.end('unauthorized'); }
        if (req.headers['x-lan-write'] !== '1') { note(ip, pathName, 403, 'no-write-header'); res.writeHead(403); return res.end('missing write header'); }
        let size = 0; const chunks = [];
        req.on('data', (c) => { size += c.length; if (size > 20000) { try { req.destroy(); } catch (e) {} } else chunks.push(c); });
        req.on('end', () => {
          if (size > 20000) { res.writeHead(413); return res.end('too large'); }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { res.writeHead(400); return res.end('bad json'); }
          const kind = body && body.kind;
          if (!['feedback', 'review', 'newPending'].includes(kind)) { res.writeHead(400); return res.end('bad kind'); }
          if ((kind !== 'newPending' && !body.caseId) || typeof body.text !== 'string' || !body.text.trim()) { res.writeHead(400); return res.end('missing text'); }
          let rec;
          try { rec = state.onInbox ? state.onInbox({ kind, caseId: body.caseId ? String(body.caseId) : '', text: body.text.slice(0, 8000), ip }) : null; }
          catch (e) { res.writeHead(500); return res.end('inbox failed'); }
          note(ip, pathName, 200, 'inbox:' + kind);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(JSON.stringify({ ok: true, id: rec ? rec.id : null }));
        });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); note(ip, pathName, 405, 'method'); return res.end('read-only'); }

      if (pathName === '/pair') {
        const code = u.searchParams.get('code') || '';
        const now = Date.now();
        if (!state.pairUsed && now < state.pairExpires && timingEqual(code, state.pairCode)) {
          state.pairUsed = true;
          note(ip, pathName, 200, 'paired');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(JSON.stringify({ ok: true, token, url: 'http://' + (req.headers.host || '') + '/?k=' + token }));
        }
        fail(ip); note(ip, pathName, 403, 'bad-pair');
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: '配对码错误或已过期' }));
      }
      if (pathName === '/api/cases') {
        if (!authorized(req, u)) { fail(ip); note(ip, pathName, 403, 'unauthorized'); res.writeHead(403); return res.end('unauthorized'); }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ ok: true, cases: state.snapshot || [] }));
      }
      if (pathName === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ app: 'liuyao-shufang', version, lan: true, readonly: true }));
      }
      /* 其余全部要求 token 或会话 cookie */
      if (!authorized(req, u)) {
        fail(ip); note(ip, pathName, 403, 'unauthorized');
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('unauthorized');
      }
      if (pathName === '/media') return streamMedia(req, res, u.searchParams);
      /* HTML 入口发会话 cookie，后续相对资源靠 cookie */
      if (pathName === '/' || pathName === '/index.html') ensureSession(req, res);
      return serveLanFile(req, res, pathName);
    } catch (e) {
      res.writeHead(500); res.end('error');
    }
  };
}

function lanIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  const prefer = out.filter((ip) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip));
  return prefer.length ? prefer : out;
}

function makePairState() {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return { pairCode: code, pairExpires: Date.now() + PAIR_TTL, pairUsed: false };
}

function start(opts) {
  const token = opts.token || crypto.randomBytes(16).toString('hex');
  const state = Object.assign({ audit: [], pairCode: '', pairExpires: 0, pairUsed: false, snapshot: [], onInbox: null }, makePairState(), opts.state || {});
  if (!Array.isArray(state.audit)) state.audit = [];
  const logFile = opts.logFile || null;
  const server = http.createServer(makeHandler(Object.assign({}, opts, { token, state, logFile })));
  return new Promise((resolve) => {
    const tryPort = (i) => {
      const ports = [51888, 51889, 51890, 0];
      const port = ports[i];
      const onError = () => { server.removeListener('listening', onOk); tryPort(i + 1); };
      const onOk = () => {
        server.removeListener('error', onError);
        resolve({
          server, port: server.address().port, token,
          pairCode: state.pairCode, pairExpires: state.pairExpires,
          setSnapshot: function (list) { state.snapshot = Array.isArray(list) ? list.slice(0, 500) : []; },
          setInboxHandler: function (fn) { state.onInbox = typeof fn === 'function' ? fn : null; },
          regeneratePair() { Object.assign(state, makePairState()); return { pairCode: state.pairCode, pairExpires: state.pairExpires }; },
          audit() { return state.audit.slice(-50); }
        });
      };
      server.once('error', onError);
      server.once('listening', onOk);
      server.listen(port, '0.0.0.0');
    };
    tryPort(0);
  });
}

module.exports = { start, lanIPs, makeHandler, lanBootScript, MIME, isPrivateIP, makePairState };

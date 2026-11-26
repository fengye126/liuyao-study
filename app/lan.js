const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

function lanBootScript() {
  return `<script>(function(){
window.__LAN_MODE=1;window.__LAN_READONLY=1;
function rw(u){if(typeof u!=='string')return u;if(u.indexOf('file:///')!==0)return u;return '/media?src='+encodeURIComponent(u)}
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
})();</script>`;
}

function makeHandler(opts) {
  const { renderer, userData, dataDir, version } = opts;
  const root = path.resolve(renderer);
  const userRoot = path.resolve(userData);
  const dataRoot = path.resolve(dataDir);
  function serveLanFile(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
    if (!rel) rel = 'index.html';
    const isData = rel.startsWith('data/');
    let file = path.resolve(root, rel);
    if (isData) {
      const imported = path.resolve(userRoot, path.basename(rel));
      if (fs.existsSync(imported)) file = imported;
    }
    const insideRoot = file === root || file.startsWith(root + path.sep);
    const insideData = isData && (file === dataRoot || file.startsWith(userRoot + path.sep));
    if (!insideRoot && !insideData) {
      res.writeHead(403); return res.end('forbidden');
    }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
      const ext = path.extname(file).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
      if (ext === '.html') {
        let html = buf.toString('utf8').replace('</head>', lanBootScript() + '</head>');
        res.writeHead(200, headers); return res.end(html);
      }
      res.writeHead(200, headers); res.end(buf);
    });
  }
  function streamMedia(req, res, q) {
    const src = q.get('src') || '';
    if (!src.startsWith('file:///')) { res.writeHead(400); return res.end('bad src'); }
    const file = decodeURIComponent(src.replace(/^file:\/\/\//, ''));
    let stat;
    try { stat = fs.statSync(file); } catch (e) { res.writeHead(404); return res.end('missing'); }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size, 'Content-Length': end - start + 1
      });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }
  return (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      if (u.pathname === '/media') return streamMedia(req, res, u.searchParams);
      if (u.pathname === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ app: 'liuyao-shufang', version, lan: true, readonly: true }));
      }
      return serveLanFile(req, res, u.pathname);
    } catch (e) { res.writeHead(500); res.end('error'); }
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

function start(opts) {
  const server = http.createServer(makeHandler(opts));
  return new Promise((resolve) => {
    const tryPort = (i) => {
      const ports = [51888, 51889, 51890, 0];
      const port = ports[i];
      const onError = () => { server.removeListener('listening', onOk); tryPort(i + 1); };
      const onOk = () => { server.removeListener('error', onError); resolve({ server, port: server.address().port }); };
      server.once('error', onError);
      server.once('listening', onOk);
      server.listen(port, '0.0.0.0');
    };
    tryPort(0);
  });
}

module.exports = { start, lanIPs, makeHandler, lanBootScript, MIME };

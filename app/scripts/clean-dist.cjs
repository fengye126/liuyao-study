/**
 * 构建前清理旧产物：只保留当前版本安装包，删除历史安装包、blockmap 与 win-unpacked。
 * 历史版本在 GitHub Releases 仍可下载，本地不保留。
 */
const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const dist = path.join(appDir, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const version = pkg.version;
const keep = `liuyao-shufang-${version}-setup`;

if (!fs.existsSync(dist)) {
  console.log('[clean-dist] dist 不存在，跳过');
  process.exit(0);
}

let freed = 0;
let removed = 0;
for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  const full = path.join(dist, entry.name);
  const isOldInstaller =
    entry.isFile() &&
    (/^liuyao-shufang-\d+\.\d+\.\d+-setup/.test(entry.name) || /^六爻书房-\d+\.\d+\.\d+-setup/.test(entry.name)) &&
    !entry.name.startsWith(keep);
  const isUnpacked = entry.isDirectory() && entry.name === 'win-unpacked';
  const isOldMeta =
    entry.isFile() &&
    /^builder-(effective-config|debug)\.ya?ml$/.test(entry.name);

  if (isOldInstaller || isOldMeta) {
    const size = entry.isFile() ? fs.statSync(full).size : 0;
    fs.rmSync(full, { force: true });
    freed += size;
    removed++;
    console.log('[clean-dist] 删除', entry.name);
  } else if (isUnpacked) {
    const size = dirSize(full);
    fs.rmSync(full, { recursive: true, force: true });
    freed += size;
    removed++;
    console.log('[clean-dist] 删除解包目录 win-unpacked');
  }
}

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSize(f);
    else if (e.isFile()) total += fs.statSync(f).size;
  }
  return total;
}

console.log(
  `[clean-dist] 完成：删除 ${removed} 项，释放 ${(freed / 1024 / 1024).toFixed(1)} MB；保留 ${version}`
);

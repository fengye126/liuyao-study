/**
 * 安装包冒烟：检查 dist/win-unpacked/resources/app.asar。
 * 用法：node tools/check/package_smoke.cjs [app.asar 路径]
 * 没有 dist 时跳过（退出 0）。
 */
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const defaultAsar = path.join(repo, 'app', 'dist', 'win-unpacked', 'resources', 'app.asar');
const asarPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultAsar;

if (!fs.existsSync(asarPath)) {
  console.log('package smoke: 未找到 dist asar，跳过（先打包）');
  process.exit(0);
}

let asar = null;
const candidates = [
  path.join(repo, 'app', 'node_modules', '@electron/asar'),
  path.join(process.cwd(), 'node_modules', '@electron/asar'),
  path.resolve(repo, '..', '..', '08_应用', 'app', 'node_modules', '@electron/asar')
];
for (const c of candidates) {
  try { asar = require(c); break; } catch (e) {}
}
if (!asar) {
  console.log('package smoke: 缺少 @electron/asar，跳过');
  process.exit(0);
}

const read = (name) => {
  const variants = [name, name.replace(/\//g, '\\'), '\\' + name.replace(/\//g, '\\'), '/' + name];
  for (const v of variants) {
    try { return asar.extractFile(asarPath, v).toString('utf8'); } catch (e) {}
  }
  return '';
};
const pkg = read('package.json');
const html = read('renderer/index.html');
const bridge = read('renderer/方案预览/desktop-bridge.js');
const lan = read('lan.js');
const mediaIndex = read('renderer/data/media-index.js');
const inbox = read('mobile-inbox.js');
const pdfView = read('pdf-view.js');
const preload = read('preload.js');

const fails = [];
const version = (() => { try { return JSON.parse(pkg).version || ''; } catch (e) { return ''; } })();
if (!version) fails.push('asar package.json 缺失或版本为空');
if (version && !new RegExp('v' + version.replace(/\./g, '\\.')).test(html)) fails.push('页面版本号未注入：' + version);
if (!bridge) fails.push('缺少 desktop-bridge.js');
if (!lan) fails.push('缺少 lan.js');
if (!mediaIndex) fails.push('缺少 data/media-index.js（媒体库索引）');
if (!inbox) fails.push('缺少 mobile-inbox.js（手机收件箱）');
if (!pdfView) fails.push('缺少 pdf-view.js（应用内 PDF）');
if (preload && !preload.includes('openPdfInApp')) fails.push('preload 未暴露 openPdfInApp');
if (pdfView && !pdfView.includes('resolvePdf')) fails.push('pdf-view.js 未包含路径校验');
['其它起卦法', '练习入口', '规则集', '手机提交'].forEach((marker) => {
  if (!html.includes(marker)) fails.push('页面缺少能力标记：' + marker);
});
if (lan && !lan.includes('pairUsed')) fails.push('lan.js 未包含配对码加固');
if (bridge && !bridge.includes('markAssetStatus')) fails.push('bridge 未包含学习资产状态');

if (fails.length) {
  console.log('PACKAGE FAIL');
  fails.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
const size = Math.round(fs.statSync(asarPath).size / 1024 / 1024 * 10) / 10;
console.log('PACKAGE PASS v' + version + ' · ' + size + ' MB · ' + asarPath);

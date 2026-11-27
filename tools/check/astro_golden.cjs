/**
 * 历法金样例（构建自检用）：
 * 1) 精确交节：12 个「节」在交节时刻前后月柱必须切换；
 * 2) 立春年柱按交节时刻切换；
 * 3) 23:00 子时换日；
 * 4) 源页必须使用精确历法 API（防止改回旧口径）。
 * 用法：node tools/check/astro_golden.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.resolve(__dirname, '..', '..');
const vendorPath = path.join(repo, 'app', 'renderer', 'vendor', 'liuyao.js');
const srcPath = path.join(repo, 'src', 'index.html');
const fails = [];

if (!fs.existsSync(vendorPath)) {
  console.log('SKIP 历法金样例：仓库缺少 app/renderer/vendor/liuyao.js');
  process.exit(0);
}
vm.runInThisContext(fs.readFileSync(vendorPath, 'utf8'), { filename: 'liuyao.js' });
const LY = globalThis.LiuYao;

// 2026 年 12 个「节」的交节时刻（Asia/Shanghai）
const JIE = [
  ['小寒', 1, 5, 16, 23], ['立春', 2, 4, 4, 2], ['惊蛰', 3, 5, 21, 59],
  ['清明', 4, 5, 2, 40], ['立夏', 5, 5, 19, 48], ['芒种', 6, 5, 23, 48],
  ['小暑', 7, 7, 9, 56], ['立秋', 8, 7, 19, 42], ['白露', 9, 7, 22, 41],
  ['寒露', 10, 8, 14, 29], ['立冬', 11, 7, 17, 52], ['大雪', 12, 7, 10, 52],
];
function monthAtOffset(y, m, d, h, mi, offsetMin) {
  var total = h * 60 + mi + offsetMin;
  var dd = d + Math.floor(total / 1440);
  var rem = ((total % 1440) + 1440) % 1440;
  return LY.Solar.fromYmdHms(y, m, dd, Math.floor(rem / 60), rem % 60, 0).getLunar().getMonthInGanZhiExact();
}
for (const [name, m, d, h, mi] of JIE) {
  const before = monthAtOffset(2026, m, d, h, mi, -3);
  const after = monthAtOffset(2026, m, d, h, mi, 3);
  if (before === after) fails.push(name + ' 交节前后月柱未切换（' + before + '）');
}
// 立春年柱
const yBefore = LY.Solar.fromYmdHms(2026, 2, 4, 4, 0, 0).getLunar().getYearInGanZhiExact();
const yAfter = LY.Solar.fromYmdHms(2026, 2, 4, 4, 5, 0).getLunar().getYearInGanZhiExact();
if (yBefore !== '乙巳') fails.push('立春前年柱应为乙巳，实际 ' + yBefore);
if (yAfter !== '丙午') fails.push('立春后年柱应为丙午，实际 ' + yAfter);
// 23:00 换日
const d2259 = LY.Solar.fromYmdHms(2026, 11, 23, 22, 59, 0).getLunar().getDayInGanZhiExact();
const d2300 = LY.Solar.fromYmdHms(2026, 11, 23, 23, 0, 0).getLunar().getDayInGanZhiExact();
if (d2259 !== '辛丑' || d2300 !== '壬寅') fails.push(`子时换日不符：22:59 ${d2259} / 23:00 ${d2300}`);

// 源页契约
const src = fs.readFileSync(srcPath, 'utf8');
const contract = {
  年柱精确: src.includes('getYearInGanZhiExact'),
  月柱精确: src.includes('getMonthInGanZhiExact'),
  日柱精确: src.includes('getDayInGanZhiExact'),
  六十甲子校验: src.includes('JIAZI60'),
  五虎遁: src.includes('expectedMonthGanzhi'),
};
for (const [k, v] of Object.entries(contract)) if (!v) fails.push('源页缺少：' + k);

if (fails.length) {
  console.log('FAIL 历法金样例');
  fails.forEach((f) => console.log(' -', f));
  process.exit(1);
}
console.log('历法金样例：12 节 + 立春年柱 + 子时换日 + 源页契约 全部通过');

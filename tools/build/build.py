from pathlib import Path
import re
from refine_c import refine_c
from refine_product import refine_product

root = Path(__file__).resolve().parent.parent
source = (root / 'index.html').read_text(encoding='utf-8')

# All three proposals keep the v6 data and chart engine. These replacements are
# limited to the isolated review copies; index.html is never written here.
wheel = '''function wheelEpochAngles(now) {
    var days = Math.round((state.wheel.manual || 0) / 30);
    var d = now && now.getTime ? now : new Date(Date.now() + days * 86400000);
    var key = Math.floor(d.getTime() / 60000);
    if (wheelEpochAngles._key === key) return wheelEpochAngles._angles;
    var t = wheelToday(d);
    var angles = {
      zhi: Math.max(0, t.starIdx) * 30,
      hex: 0,
      jz: Math.max(0, t.gzIdx) * 6,
      jq: Math.max(0, t.jqIdx) * 15
    };
    wheelEpochAngles._key = key;
    wheelEpochAngles._angles = angles;
    return angles;
  }
  function setRing'''
changed, count = re.subn(r'function wheelEpochAngles\(now\) \{[\s\S]*?\n  \}\n  function setRing', wheel, source, count=1)
assert count == 1, 'wheel function not found'
changed, count = re.subn(
    r'function wheelToday\(\) \{\n    var now = new Date\(\);',
    'function wheelToday(date) {\n    var now = date instanceof Date ? date : new Date();',
    changed, count=1
)
assert count == 1, 'wheelToday function not found'
old_ring = '''    setRing('ring-zhi', (base.zhi || 0) + m * WHEEL_PARA.zhi);
    setRing('ring-hex', (base.hex || 0) + m * WHEEL_PARA.hex);
    setRing('ring-jz', (base.jz || 0) + m * WHEEL_PARA.jz);
    setRing('ring-jq', (base.jq || 0) + m * WHEEL_PARA.jq);
    setRing('ring-bagua', m * WHEEL_PARA.bagua);
    setRing('ring-shan', m * WHEEL_PARA.shan);
    setRing('ring-ticks', m * WHEEL_PARA.ticks);'''
new_ring = '''    setRing('ring-zhi', base.zhi || 0);
    setRing('ring-hex', 0);
    setRing('ring-jz', base.jz || 0);
    setRing('ring-jq', base.jq || 0);
    setRing('ring-bagua', 0);
    setRing('ring-shan', 0);
    setRing('ring-ticks', 0);'''
assert old_ring in changed, 'ring angle block not found'
changed = changed.replace(old_ring, new_ring, 1)
changed, count = re.subn(
    r'  function wheelAnimStart\(\) \{[\s\S]*?\n  \}\n  function wheelAnimStop\(\)',
    '''  function wheelAnimStart() {
    if (!wheelMinTimer) {
      wheelMinTimer = setInterval(function () {
        wheelRefreshReadout(state.wheel.manual);
        applyRingAngles(wheelEpochAngles());
      }, 60000);
    }
    if (still() || !state.wheel.tween || state.wheel.animOn) return;
    state.wheel.animOn = true;
    var tick = function () {
      if (!state.wheel.animOn) return;
      wheelFrameNow();
      if (state.wheel.tween && !document.hidden) wheelAnimRaf = requestAnimationFrame(tick);
      else { state.wheel.animOn = false; wheelAnimRaf = 0; }
    };
    wheelAnimRaf = requestAnimationFrame(tick);
  }
  function wheelAnimStop()''',
    changed, count=1
)
assert count == 1, 'wheel animation loop not found'
changed = changed.replace(
    '    applyRingAngles(wheelEpochAngles());\n    var tw = state.wheel.tween;',
    '    var tw = state.wheel.tween;', 1
)
changed = changed.replace(
    '    state.wheel.tween = { from: state.wheel.manual || 0, t0: Date.now(), dur: 500 };',
    '    state.wheel.tween = { from: state.wheel.manual || 0, t0: Date.now(), dur: 500 };\n    wheelAnimStart();', 1
)
old_motion = """    state.reduced = !!state.reduced || document.documentElement.classList.contains('still') || prefersReduce;
    document.documentElement.classList.toggle('still', state.reduced);"""
new_motion = """    state.reduced = !!state.reduced || prefersReduce;
    document.documentElement.classList.toggle('still', state.reduced || params.get('still') === '1');"""
assert old_motion in changed, 'motion initialization block not found'
changed = changed.replace(old_motion, new_motion, 1)
changed = changed.replace("var head = isChapterHead(p);", "var head = isChapterHead(p) && !/[—–-]{3,}|_{3,}/.test(p);")
changed = changed.replace(
    "var paras = String(text || '').replace(/\\r/g, '').split('\\n');",
    """var rawLines = String(text || '').replace(/\\r/g, '').split('\\n');
    var joined = [];
    rawLines.forEach(function (line) {
      var prev = joined[joined.length - 1];
      if (line.trim() && prev && prev.trim() && prev.trim().length >= 18 &&
          !/[。！？!?：:；;]$/.test(prev.trim()) && !isChapterHead(prev)) {
        joined[joined.length - 1] = prev + line.trim();
      } else joined.push(line);
    });
    var paras = joined;""",
    1
)
old_head = """      if (head) {
        if (cur.length) flush();
        if (curHeads.length) flush();
        heads.push({ label: p, page: pages.length });
        cur = [p]; curHeads = [p]; used = linesOf(p) + GAP + 0.5;
        return;
      }"""
new_head = """      if (head) {
        if (cur.length && used + linesOf(p) + 2 > maxLines) flush();
        heads.push({ label: p, page: pages.length });
        cur.push(p); curHeads.push(p); used += linesOf(p) + GAP + 0.5;
        return;
      }"""
assert old_head in changed, 'heading pagination block not found'
changed = changed.replace(old_head, new_head, 1)
changed = changed.replace("var designH = Math.min(860, Math.max(480, window.innerHeight - 184));", "var designH = Math.max(580, window.innerHeight - 150);")
changed = changed.replace("contentH = Math.max(160, Math.min(page.clientHeight, designH) -", "contentH = Math.max(160, Math.max(page.clientHeight, designH) -")
new_paginate = r'''function paginate(text) {
    var m = pageMetrics(), cpl = m.cpl, maxLines = m.lines, GAP = 0.55;
    var rawLines = String(text || '').replace(/\r/g, '').split('\n');
    var joined = [];
    rawLines.forEach(function (line) {
      var prev = joined[joined.length - 1];
      if (line.trim() && prev && prev.trim() && prev.trim().length >= 18 &&
          !/[。！？!?：:；;]$/.test(prev.trim()) && !isChapterHead(prev)) {
        joined[joined.length - 1] = prev + line.trim();
      } else joined.push(line);
    });
    var pages = [], cur = [], curHeads = [], heads = [], used = 0;
    function flush() {
      if (cur.length) pages.push({ paras: cur.slice(), heads: curHeads.slice() });
      cur = []; curHeads = []; used = 0;
    }
    joined.forEach(function (line) {
      var p = line.replace(/[ \t]+/g, ' ').trim();
      if (!p) return;
      var head = isChapterHead(p) && !/[—–-]{3,}|_{3,}/.test(p);
      if (head) {
        if (cur.length && used + 2 > maxLines) flush();
        heads.push({ label: p, page: pages.length });
        cur.push(p); curHeads.push(p); used += Math.ceil(p.length / cpl) + 1;
        return;
      }
      var remaining = p, firstPart = true;
      while (remaining.length) {
        var available = Math.floor(maxLines - used - (cur.length && firstPart ? GAP : 0));
        if (available < 1) { flush(); available = maxLines; }
        var count = Math.max(cpl, available * cpl);
        var chunk = remaining.slice(0, count);
        cur.push(chunk);
        used += Math.ceil(chunk.length / cpl) + (firstPart ? GAP : 0);
        remaining = remaining.slice(count);
        firstPart = false;
        if (remaining.length || used >= maxLines - 0.5) flush();
      }
    });
    flush();
    return { pages: pages, toc: heads };
  }
  function buildR5Pages()'''
changed, count = re.subn(r'function paginate\(text\) \{[\s\S]*?\n  \}\n  function buildR5Pages\(\)', lambda _: new_paginate, changed, count=1)
assert count == 1, 'pagination function not found'

names = {'A': '案卷书房', 'B': '观象仪台', 'C': '静读书院'}
for key, title in names.items():
    if key != 'C':
        continue
    page = changed.replace('</head>', f'<link rel="stylesheet" href="方案预览/common.css"><link rel="stylesheet" href="方案预览/{key}.css">\n</head>', 1)
    page = page.replace('</body>', f'<script src="方案预览/common.js"></script>\n</body>', 1)
    page = page.replace('<html lang="zh-CN"', f'<html data-proposal="{key}" lang="zh-CN"', 1)
    page = page.replace('<title>六爻书房</title>', f'<title>{title} · 六爻书房设计预览</title>', 1)
    page = refine_c(page)
    page = refine_product(page)
    output = root / f'方案{key}_{title}.html'
    output.write_text(page, encoding='utf-8')
    print(output)

from pathlib import Path
import re

def refine_c(page):
    def fn(name, body):
        nonlocal page
        pattern = r'  function ' + name + r'\([^\n]*\) \{[\s\S]*?\n  \}'
        page, n = re.subn(pattern, lambda _: body, page, count=1)
        assert n == 1, name

    page = page.replace('</head>', '<script src="方案预览/c-core.js"></script><link rel="stylesheet" href="方案预览/c-refine.css"><link rel="stylesheet" href="方案预览/c-polish.css">\n</head>', 1)
    page = page.replace('</body>', '<script src="方案预览/c-main.js"></script><script src="方案预览/c-drafts.js"></script>\n</body>', 1)
    fn('currentJieqiName', '''  function currentJieqiName(date) {
    return CCore.calendar(ENGINE, date || new Date()).current;
  }''')
    fn('renderWheel', '''  function renderWheel() { CCore.renderWheel($('#wheelSvg'), ALMANAC); }''')
    fn('wheelEpochAngles', '''  function wheelEpochAngles() { return {zhi:0,hex:0,jz:0,jq:0}; }''')
    fn('applyRingAngles', '''  function applyRingAngles() {
    CCore.moveWheel(state.wheel.manual || 0);
  }''')
    fn('wheelAnimStart', '''  function wheelAnimStart() {
    if (!wheelMinTimer) wheelMinTimer = setInterval(function () { wheelRefreshReadout(); }, 1000);
  }''')
    fn('wheelRefreshReadout', '''  function wheelRefreshReadout() { CCore.readout(ENGINE, ALMANAC); }''')
    fn('applyWheelManual', '''  function applyWheelManual(a) {
    state.wheel.manual = Number(a) || 0;
    CCore.moveWheel(state.wheel.manual);
  }''')
    fn('bindWheel', '''  function bindWheel() { CCore.bindWheel($('#wheelWrap'), applyWheelManual); }''')
    fn('wheelTweenToNow', '''  function wheelTweenToNow() {}''')
    fn('wheelPointedLabel', '''  function wheelPointedLabel() { return '旋转浏览；中心为北京时间实时历法'; }''')
    fn('navigate', '''  function navigate(route, opts) { setRoute(route, opts || {}); }''')
    fn('paginate', '''  function paginate(text) { return CCore.paginate(text, pageMetrics(), isChapterHead, NAME_TO_BITS); }''')
    fn('pageMetrics', '''  function pageMetrics() { return CCore.metrics(state.font); }''')
    page = page.replace("    var single = state.spreadSingle;\n    var fontCss = readerFontOf();", """    var single = state.spreadSingle;
    CCore.chartPage(R5.pages, R5.page, $('#bookSpread'));
    var fontCss = readerFontOf();""", 1)
    page = page.replace("    var next = clamp(R5.page + dir * step, 0, limit);", "    var next = CCore.nextPage(R5.pages, R5.page, dir, state.spreadSingle);\n    if(next!==R5.page) R5.focusAnchor=null;", 1)
    page = page.replace("    if (still()) { R5.page = next; renderPages(); saveReaderPos(); return; }", """    if (still() || R5.pages[R5.page].chart || R5.pages[next].chart) {
      R5.page = next; renderPages(); saveReaderPos(); return;
    }""", 1)
    # A swipe uses the existing page-turn engine and its cancellation/queue logic.
    page = page.replace("    var saved = savedReaderPage(item);", "    window.CReaderTurn = turnPage;\n    var saved = savedReaderPage(item);\n    R5.focusAnchor=saved.anchor||null;", 1)
    fn('savedReaderPage', '''  function savedReaderPage(item) {
    var key = readingKeyOf(item);
    var raw = (key === 'demo' ? state.reading.demo : state.reading.items[key]) || {};
    return {page:CCore.findAnchorPage(R5.pages, raw.anchor, raw.page),pct:raw.pct||0,anchor:raw.anchor||null};
  }''')
    fn('sanitizeReading', '''  function sanitizeReading(raw) {
    var out={demo:{pct:0,para:1,at:0,page:0},items:{},recent:[]};
    if(!raw || typeof raw!=='object') return out;
    var clean=function(it) {
      var a=it.anchor;
      return {pct:clamp(Number(it.pct)||0,0,100),at:Number(it.at)||0,page:Math.max(0,Number(it.page)||0),
        kind:String(it.kind||''),name:String(it.name||''),chapter:String(it.chapter||''),
        anchor:a&&Number.isFinite(a.offset)&&a.offset>=0?{offset:a.offset,quote:String(a.quote||'').slice(0,80),chart:!!a.chart}:null};
    };
    if(raw.demo&&typeof raw.demo==='object')out.demo=Object.assign({para:1},clean(raw.demo));
    if(raw.items&&typeof raw.items==='object')Object.keys(raw.items).slice(0,40).forEach(function(k){
      if(raw.items[k]&&typeof raw.items[k]==='object')out.items[k]=clean(raw.items[k]);
    });
    if(Array.isArray(raw.recent))out.recent=raw.recent.slice(0,8).map(String);
    return out;
  }''')
    fn('saveReaderPos', '''  function saveReaderPos() {
    if (!R5.built || !R5.pages.length) return;
    var key = readingKeyOf(R5.item);
    var chapter = ''; R5.toc.forEach(function(t) { if(t.page<=R5.page) chapter=t.label; });
    var data = {pct:clamp(Math.round((R5.page+1)/R5.pages.length*100),0,100),at:Date.now(),page:R5.page,
      anchor:R5.focusAnchor||CCore.anchorOf(R5.pages,R5.page),chapter:chapter,kind:R5.item.kind,name:R5.item.name};
    if(key==='demo') state.reading.demo=data;
    else state.reading.items[key]=Object.assign({},state.reading.items[key]||{},data);
    persist(); renderHero(); renderHomeReading();
  }''')
    old_reflow = '''      var ratio = R5.pages.length ? (R5.page + 1) / R5.pages.length : 0;
      buildR5Pages();
      R5.page = clamp(Math.floor(ratio * R5.pages.length) - (state.spreadSingle ? 0 : 1), 0, Math.max(0, R5.pages.length - 1));
      renderPages();'''
    new_reflow = '''      var anchor = R5.focusAnchor || CCore.anchorOf(R5.pages, R5.page);
      buildR5Pages();
      R5.page = CCore.findAnchorPage(R5.pages, anchor);
      R5.focusAnchor=anchor;
      renderPages(); saveReaderPos();'''
    assert old_reflow in page, 'font reflow block'
    page = page.replace(old_reflow, new_reflow)
    page = page.replace('R5.page = target;', 'R5.focusAnchor=null; R5.page = target;')
    # Resize uses the same content anchor, after the new viewport has settled.
    page = page.replace(old_reflow.replace('      ','        '),new_reflow.replace('      ','        '))
    page = page.replace("    window.addEventListener('resize', function () {\n      /* ≤900", "    var cResizeTimer;\n    window.addEventListener('resize', function () {\n      clearTimeout(cResizeTimer); cResizeTimer=setTimeout(function () {\n      /* ≤900", 1)
    page = page.replace("      updateReaderProgress();\n    });\n\n    /* 起卦方式", "      updateReaderProgress();\n      },140);\n    });\n\n    /* 起卦方式", 1)
    page = page.replace("    if (pct) pct.textContent = Math.round(p) + '%';", """    if (pct) pct.textContent = Math.round(p) + '%';
    var key=readingKeyOf(t),raw=(key==='demo'?state.reading.demo:state.reading.items[key])||{};
    window.CHomeReadingExtra && window.CHomeReadingExtra(p,raw.chapter||'');""", 1)
    page = page.replace("    var rev = allCases().filter(function (c) { return c.revisit; })[0];", "    var rev = allCases().filter(function (c) { return c.revisit; }).sort(function(a,b){return String(a.date).localeCompare(String(b.date));})[0];", 1)
    page = page.replace("('最近 · ' + rev.q.slice(0, 14) + ' · ' + shortDate(rev.date))", "(rev.q + ' · ' + shortDate(rev.date))", 1)
    page = page.replace("    var cover = originEl;\n    readerOriginEl", """    if (state.cRailBeforeReading == null) state.cRailBeforeReading = state.railMin;
    setRailMin(true);
    var cover = originEl;
    readerOriginEl""", 1)
    page = page.replace("    route = canonRoute(route);\n    var prevRoute", """    route = canonRoute(route);
    if (state.cRailBeforeReading != null && (route !== 'study' || !state.readerOpen)) {
      setRailMin(state.cRailBeforeReading); state.cRailBeforeReading = null;
    }
    var prevRoute""", 1)
    page = page.replace("    var caseObj = buildCaseFromBuilt(state.cast.built, q, cat);\n    addCase(caseObj);", """    var gender = document.querySelector('#cSaveGender input:checked');
    if (!gender) { $('#saveHint').textContent = '请选择男测或女测'; return; }
    if(window.CDraftMatches && !window.CDraftMatches()) { $('#saveHint').textContent='盘面已经改变，请确认当前笔记后再存入'; return; }
    var caseObj = buildCaseFromBuilt(state.cast.built, q, cat);
    caseObj.gender = gender.value;
    caseObj.note = ($('#cCastNotes') && $('#cCastNotes').value) || '';
    caseObj.jingguo = caseObj.note || caseObj.jingguo;
    addCase(caseObj);""", 1)
    page = page.replace("    var c = state.cast;\n    clearCastTimer();\n    c.step = 0;", "    var c = state.cast;\n    if (window.CClearDraft) window.CClearDraft();\n    clearCastTimer();\n    c.step = 0;", 1)
    # Hooks retain the v6 engine; the three entry modes share one reset routine.
    page = page.replace("  function bindCastControls() {", """  window.CResetCast = function () {
    resetCast(false); resetManual();
    state.cast.pick.name = '水火既济'; state.cast.pick.moving = [];
    updatePickUI();
    if (window.CClearDraft) window.CClearDraft();
  };
  function bindCastControls() {""", 1)
    page = page.replace("  function bindCastControls() {", """  window.CRefreshHomeReading = renderHomeReading;
  window.CGetCastSnapshot = function () {
    var c=state.cast;
    return {version:2,when:c.when.toISOString(),mode:c.mode,lines:castStageLines(),
      tossed:c.tossed.map(function(y){return y.yao;}),manual:c.manual.lines.slice(),
      pick:{name:c.pick.name,moving:c.pick.moving.slice()},manualDate:c.manualDate,
      manualMonth:c.manualMonth,manualDay:c.manualDay,confirmed:!!c.built};
  };
  window.CRestoreCastSnapshot = function (saved) {
    if(!saved || !parseDate(String(saved.when).replace('T',' '))) return false;
    var valid=function(y){return ['young_yang','young_yin','old_yang','old_yin'].indexOf(y)>=0;};
    var c=state.cast;clearCastTimer();c.when=new Date(saved.when);c.built=null;c.busy=false;c.confirmed=false;
    c.tossed=(saved.tossed||[]).filter(valid).slice(0,6).map(function(y){return yaoObj(valueOfYao(y));});c.step=c.tossed.length;
    if(saved.manual && saved.manual.length===6 && saved.manual.every(valid))c.manual.lines=saved.manual.slice();
    if(saved.pick && NAME_TO_BITS[saved.pick.name])c.pick={name:saved.pick.name,moving:(saved.pick.moving||[]).filter(function(n){return n>=1&&n<=6;})};
    c.manualDate=!!saved.manualDate;c.manualMonth=saved.manualMonth||'';c.manualDay=saved.manualDay||'';
    renderManual();renderPick();switchCastMode(saved.mode);updateCastTimeUI({setValue:true});
    if(saved.confirmed && castStageLines().every(valid))confirmCast();else renderCastUI();
    return true;
  };
  function bindCastControls() {""", 1)
    page = page.replace("  function renderCastUI() {", "  function renderCastUI() {\n    if(window.CCastChanged) window.CCastChanged();", 1)
    page = page.replace(' · 干支历 ', ' · 黄历 ')
    return page

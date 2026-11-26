"""C-only product fixes. Original v6 and proposals A/B are input, never targets."""
import re


def refine_product(page):
    def fn(name, body):
        nonlocal page
        pattern = r'  function ' + name + r'\([^\n]*\) \{[\s\S]*?\n  \}'
        page, n = re.subn(pattern, lambda _: body, page, count=1)
        assert n == 1, name

    modules = ['c-lesson26', 'c-dialog', 'c-storage', 'c-cases', 'c-study', 'c-lessons']
    page = page.replace('</head>', ''.join('<script src="方案预览/' + n + '.js"></script>' for n in modules) + '<link rel="stylesheet" href="方案预览/c-product.css">\n</head>', 1)
    page = page.replace('</body>', '<script src="方案预览/c-product.js"></script>\n</body>', 1)
    # Apply full-height reader geometry before its first synchronous pagination.
    # A MutationObserver runs too late; it previously measured the shelf-sized view.
    page = page.replace('    state.readerOpen = true;\n    state.lessonOpen = false;\n    navigate',
                        "    state.readerOpen = true;\n    state.lessonOpen = false;\n    state.spreadSingle = window.innerWidth<=900 || state.spreadSingle;\n    document.documentElement.classList.add('c-reader-open');\n    document.documentElement.classList.remove('c-lesson-open');\n    navigate", 1)

    fn('hexHeadLabel', '''  function hexHeadLabel(palaceCn, hexName, flags) {
    return '<span class="c-palace">' + esc(palaceCn) + '</span><span class="c-hex-name">' + esc(hexName) + '</span>' +
      '<span class="c-hex-flags">' + flags.map(function(f){return '<em>'+esc(f)+'</em>';}).join('') + '</span>';
  }''')
    fn('renderBackups', '''  function renderBackups() { return CStorage.render(); }''')
    fn('runSync', '''  function runSync() {
    CStorage.create().then(function(){toast('完整备份已保存');}).catch(function(e){toast(e.message);});
  }''')
    fn('pairNew', '''  function pairNew() { CStorage.exportFile(); }''')
    fn('saveCaseResult', '''  function saveCaseResult(id) { CCases.saveFeedback(id); }''')
    fn('showResultEditor', '''  function showResultEditor() { CCases.openEditor(); }''')
    fn('deleteCase', '''  function deleteCase(id) {
    var c=allCases().find(function(c){return c.id===id;});if(!c)return;
    CUI.confirm('删除这条卦例？','卦例及其反馈会从当前书房移除。','删除').then(function(yes){
      if(!yes)return;var rows=state.cases.filter(function(c){return c.id!==id;});
      try{localStorage.setItem(CASE_KEY,JSON.stringify(rows));}catch(e){toast('删除未完成，原记录保留');return;}
      state.cases=rows;closeCaseDetail();renderCaseList();updateCaseTotals();renderHomePanels();toast('卦例已删除');
    });
  }''')
    fn('toggleCaseRevisit', '''  function toggleCaseRevisit(id) {
    var c=allCases().find(function(c){return c.id===id;});if(!c)return;
    if(CApp.updateCase(Object.assign({},c,{revisit:!c.revisit,outcomeStatus:c.revisit?'observed':'pending'})))toast(c.revisit?'已结束回访':'已重新标记回访');
  }''')
    fn('saveCases', '''  function saveCases() {
    if(window.CRestoringData)return true;
    try { localStorage.setItem(CASE_KEY,JSON.stringify(state.cases));return true; }
    catch(e){toast('卦例尚未写入本机，请导出数据后释放空间');return false;}
  }''')
    fn('addCase', '''  function addCase(caseObj) {
    var next=[caseObj].concat(state.cases);
    try{localStorage.setItem(CASE_KEY,JSON.stringify(next));}catch(e){toast('卦例尚未保存，请先导出数据');return false;}
    state.cases=next;updateCaseTotals();return true;
  }''')
    page = page.replace('    addCase(caseObj);', '    if(!addCase(caseObj))return;', 1)
    page = page.replace("sort(function(a,b){return String(a.date).localeCompare(String(b.date));})", "sort(function(a,b){return String(a.followUpAt||a.date).localeCompare(String(b.followUpAt||b.date));})", 1)
    page = page.replace("(rev.q + ' · ' + shortDate(rev.date))", "(rev.q + (rev.followUpAt?' · 回访 '+rev.followUpAt.slice(5):' · '+shortDate(rev.date)))", 1)
    page = page.replace("(c.revisit ? '待回访' : '已归档')", "(c.outcomeStatus==='unverifiable'?'无法核实':c.revisit?(c.followUpAt?'回访 '+c.followUpAt.slice(5):'待回访'):'已归档')", 1)
    page = page.replace('  function persist() {', '  function persist() {\n    if(window.CRestoringData)return;', 1)
    page = page.replace("    add('动作', '单双页切换',", "    if(window.innerWidth>900) add('动作', '单双页切换',", 1)
    page = page.replace("state.spreadSingle = el.dataset.spreadMode === 'single';", "state.spreadSingle = window.innerWidth<=900 || el.dataset.spreadMode === 'single';")
    page = page.replace("    window.scrollTo(0, 0);\n    if (!still() && !params.get('demo')) {", "    if(window.CCases) CCases.decorate(caseObj);\n    window.scrollTo(0, 0);\n    if (!still() && !params.get('demo')) {", 1)
    page = page.replace('    return items.filter(function (it) {\n      return (it.group', '    return items.filter(function (it) {\n      return (it.group', 1)
    old = '''    return items.filter(function (it) {
      return (it.group + ' ' + it.label + ' ' + it.hint).toLowerCase().indexOf(q) >= 0;
    });'''
    assert old in page
    page = page.replace(old, old[:-1] + '.concat(window.CStudy ? CStudy.commandMatches(state.cmdk.query.trim()) : []);', 1)
    page = page.replace('      updateReaderProgress(); renderReaderToc(); return;', '      updateReaderProgress(); renderReaderToc(); if(window.CStudy)CStudy.afterReader(); return;', 1)
    page = page.replace('    renderReaderToc();\n  }\n  function turnPage', '    renderReaderToc();\n    if(window.CStudy)CStudy.afterReader();\n  }\n  function turnPage', 1)
    page = page.replace("    if (ap) ap.textContent = '点列表播放 · 共 ' + total + ' 条';", "    if (ap) ap.textContent = '点列表播放 · 共 ' + total + ' 条';\n    if(window.CLessons)CLessons.decorateAudio();", 1)
    fn('renderLesson', '''  function renderLesson(item) {
    if(window.CLessons)CLessons.beforeRender();
    var no=$('#lessonNo');if(no)no.textContent=item.n?'第 '+Number(item.n)+' 课':'';
    var title=$('#lessonTitle');if(title)title.textContent=item.title||'录音';
    var img=$('#lessonImg');if(img){img.hidden=!item.img;if(item.img)img.src=mediaPath(item.img);}
    var audio=$('#lessonAudio');if(audio){audio.src=mediaPath(item.audio||'');audio.closest('.lesson-audio').hidden=!item.audio;}
    if(window.CLessons)CLessons.render(item);
  }''')
    fn('closeLesson', '''  function closeLesson() {
    $('#lessonAudio').pause();if(window.CLessons)CLessons.beforeRender();
    state.lessonOpen=false;state.lessonId=null;setRoute('study',{noScroll:true});
    window.scrollTo(0,window.CLessonListScroll||0);
  }''')
    page = page.replace('    state.lessonId = Number(n);', '    if(!state.lessonOpen)window.CLessonListScroll=window.scrollY;\n    state.lessonId = Number(n);', 1)
    page = page.replace('    renderLesson(item);\n    if (!still()) {', '    renderLesson(item);\n    window.scrollTo(0,0);\n    if (!still()) {', 1)
    # A narrow bridge exposes existing model operations to the C modules.
    api = '''  window.CApp = {
    toast:toast,cases:allCases,lessons:lessonsData,openLesson:openLesson,openReader:openReader,turn:turnPage,
    flush:function(){localStorage.setItem(STORAGE_KEY,JSON.stringify(persistPayload()));localStorage.setItem(CASE_KEY,JSON.stringify(state.cases));},
    updateCase:function(next){
      var rows=state.cases.map(function(c){return c.id===next.id?next:c;});
      try{localStorage.setItem(CASE_KEY,JSON.stringify(rows));}catch(e){toast('记录尚未保存，请先导出数据');return false;}
      state.cases=rows;renderCaseList();updateCaseTotals();renderHomePanels();if(state.caseOpenId===next.id)renderCaseDetail(next);return true;
    },
    catalog:function(){return BOOKS.map(function(b){return {kind:'book',id:b.id,name:'《'+b.title+'》',text:textOf(b.id)||textOf('book:'+b.id)||''};}).concat(NOTES.map(function(n){return {kind:'note',id:n.id,name:n.title||n.name,text:textOf('note:'+n.id)||''};}));},
    reading:function(){
      var p=R5.pages[R5.page]||{},item=R5.item||{},anchor=CCore.anchorOf(R5.pages,R5.page),s=getSelection();
      if(s&&s.rangeCount){var range=s.getRangeAt(0),node=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer,body=node&&node.closest?node.closest('.pg-body'):null;
        if(body&&$('#bookSpread').contains(body)){var index=R5.page+(body.closest('#pageRight')?1:0),prefix=document.createRange();prefix.selectNodeContents(body);prefix.setEnd(range.startContainer,range.startOffset);anchor={offset:(R5.pages[index].start||0)+prefix.toString().length,quote:s.toString().slice(0,36),chart:false};}}
      return {item:{kind:item.kind,id:item.id,name:item.name},page:R5.page,anchor:anchor,chart:p.chart||(p.continuation?R5.pages[R5.page-1].chart:null)};
    },
    readerMatches:function(q){
      var matches=[];if(!q)return matches;
      R5.pages.forEach(function(p,i){if(p.continuation||p.indexOnly)return;var text=p.chart?[p.chart.title,p.chart.meta].concat(p.chart.rows.map(function(r){return r.raw||r.ben+r.bian;})).join(''):(p.paras||[]).join('');
        var at=text.indexOf(q);if(at>=0)matches.push({page:i,offset:(p.start||0)+at,snippet:text.slice(Math.max(0,at-25),at+q.length+65)});});return matches;
    },
    pageOfOffset:function(offset){return CCore.findAnchorPage(R5.pages,{offset:offset});},
    jumpAnchor:function(offset){jumpToPage(CCore.findAnchorPage(R5.pages,{offset:offset}));R5.focusAnchor={offset:offset,quote:'',chart:!!(R5.pages[R5.page]&&R5.pages[R5.page].chart)};saveReaderPos();},
    showLesson:function(item){if(!state.lessonOpen)window.CLessonListScroll=window.scrollY;state.lessonId=null;state.lessonOpen=true;state.readerOpen=false;setRoute('study',{noScroll:true});renderLesson(item);window.scrollTo(0,0);}
  };
'''
    page = page.replace('  function bindCastControls() {', api + '  function bindCastControls() {', 1)
    return page

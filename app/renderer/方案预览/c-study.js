window.CStudy = (() => {
  const key='liuyao-c-learning-v1';let data={notes:[],attempts:[],drafts:{}},app,selection='',selectedRef=null,readerIdentity='',searchTerm='',searchTimer;
  try{data=Object.assign(data,JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
  if(!Array.isArray(data.notes))data.notes=[];if(!Array.isArray(data.attempts))data.attempts=[];if(!data.drafts||typeof data.drafts!=='object')data.drafts={};
  const esc=s=>CUI.esc(s),persist=()=>{if(window.CRestoringData)return false;try{localStorage.setItem(key,JSON.stringify(data));return true}catch{app?.toast('笔记尚未保存，请导出数据后释放本机空间');return false}};
  const bookKey=r=>r.kind+':'+r.id;
  function practiceDraft(id){return data.drafts[id]||''}
  function attemptsFor(id){return data.attempts.filter(a=>a.target===id)}
  function setPracticeDraft(id,text){data.drafts[id]=String(text);persist()}
  function savePractice(id,text,ref){data.attempts.push({id:crypto.randomUUID(),target:id,text,reference:ref||null,at:Date.now()});delete data.drafts[id];persist()}
  function commandMatches(q){
    if(!app||q.length<2)return [];
    const found=[];
    for(const r of app.catalog()){
      let at=r.text.indexOf(q);if(at<0)continue;
      const first=at;for(let n=0;n<100&&at>=0;n++){const start=r.text.lastIndexOf('\n',at)+1,end=r.text.indexOf('\n',at),line=r.text.slice(start,end<0?undefined:end).trim();if(!/^第[〇零一二三四五六七八九十百千万\d]+[章回节卷篇讲]/.test(line))break;const next=r.text.indexOf(q,at+q.length);if(next<0){at=first;break}at=next;}
      found.push({group:'书内文字',label:r.name,hint:r.text.slice(Math.max(0,at-18),at+q.length+42).replace(/\s+/g,' '),icon:'i-reader',key:'',run:()=>{app.openReader(r.kind,r.id);searchTerm=q;const m=app.readerMatches(q)[0];if(m)app.jumpAnchor(m.offset);afterReader();}});if(found.length===8)break;
    }
    for(const lesson of app.lessons()){
      if(found.length>=12)break;
      const numMatch=q.match(/^第?\s*0*(\d{1,3})\s*课?$/);
      const alias=numMatch&&Number(numMatch[1])===Number(lesson.n);
      const at=String(lesson.text||'').indexOf(q);
      if(at<0&&!lesson.title.includes(q)&&!alias)continue;
      found.push({group:'课程',label:lesson.title+'（第 '+lesson.n+' 课）',hint:at>=0?lesson.text.slice(Math.max(0,at-16),at+45):'录音讲解与配图',icon:'i-audio',key:'',run:()=>app.openLesson(lesson.n)});
    }
    return found;
  }

  /* ---- P1：书页卦例 → 对应讲解课 ---- */
  function pairFromTitle(title){
    const t=String(title||'');
    let m=/([\u4e00-\u9fa5]{1,2})之([\u4e00-\u9fa5]{1,2})/.exec(t);
    if(m)return {a:m[1],b:m[2]};
    m=/([\u4e00-\u9fa5]{1,2})卦(?:$|[^一-龥])/.exec(t);
    if(m)return {a:m[1],b:null};
    return null;
  }
  function ganzhiOf(text){
    const m=/([\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])\u6708\s*([\u7532\u4e59\u4e19\u4e01\u620a\u5df1\u5e9a\u8f9b\u58ec\u7678][\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])\u65e5/.exec(String(text||''));
    return m?{yue:m[1],ri:m[2]}:null;
  }
  function hexPairOfPage(){
    const host=document.querySelector('#bookSpread');
    if(!host||host.hidden)return null;
    const t=host.innerText||'';
    const names=[...t.matchAll(/([\u4e00-\u9fa5]{1,2})\u5bab\uff1a([\u4e00-\u9fa5]{2})/g)].map((m)=>m[2]);
    if(!names.length)return null;
    return {a:names[0],b:names[1]||null,ganzhi:ganzhiOf(t)};
  }
  let lessonPairCache=null;
  function lessonPairs(){
    if(lessonPairCache)return lessonPairCache;
    lessonPairCache=(app.lessons()||[]).map((l)=>{const pr=pairFromTitle(l.title);return pr?{n:l.n,title:l.title,a:pr.a,b:pr.b,gz:ganzhiOf(l.title)}:null}).filter(Boolean);
    return lessonPairCache;
  }
  function lessonsForChart(page){
    if(!page)return [];
    return lessonPairs().filter((l)=>{
      if(l.a!==page.a)return false;
      if(page.b&&l.b&&l.b!==page.b)return false;
      if(page.gz&&l.gz&&(page.gz.yue!==l.gz.yue||page.gz.ri!==l.gz.ri))return false;
      return true;
    });
  }
  let pageLessonCache = {};
  function lessonsOnCurrentPage(){
    if(!app) return [];
    const r = app.reading();
    if(!r || !r.item || r.item.kind !== 'book') return [];
    const bookId = r.item.id, page = r.page;
    const cached = pageLessonCache[bookId];
    if(cached && cached.at && Date.now() - cached.at < 60000) return cached.map[page] || [];
    const book = (app.catalog() || []).find((x) => x.kind === 'book' && x.id === bookId);
    if(!book || typeof app.pageOfOffset !== 'function') return [];
    const text = String(book.text || ''), map = {};
    for(const l of lessonPairs()){
      if(!l.a) continue;
      const needle = l.b ? l.a + '之' + l.b : l.a;
      let at = text.indexOf(needle);
      while(at >= 0){
        const near = text.slice(Math.max(0, at - 600), at + 600);
        const g = /([\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])月[\s　]*([\u7532\u4e59\u4e19\u4e01\u620a\u5df1\u5e9a\u8f9b\u58ec\u7678][\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])日/.exec(near);
        if(!l.gz || (g && g[1] === l.gz.yue && g[2] === l.gz.ri)){
          const pg = app.pageOfOffset(at);
          if(typeof pg === 'number' && pg >= 0) (map[pg] = map[pg] || []).push({ n: l.n, title: l.title });
        }
        at = text.indexOf(needle, at + needle.length);
        if(at > 2000000) break;
      }
    }
    pageLessonCache[bookId] = { at: Date.now(), map };
    return map[page] || [];
  }
  function renderChartLessonChip(){
    document.querySelectorAll('.c-chart-lesson').forEach((e) => e.remove());
    const list = lessonsOnCurrentPage();
    if(!list.length) return;
    const bar = document.querySelector('#rv5Bar') || document.querySelector('#view-reader .main');
    if(!bar) return;
    const box = document.createElement('div');
    box.className = 'c-chart-lesson';
    box.innerHTML = '<span class="c-chart-lesson-label">同卦讲解</span>' + list.slice(0, 3).map((l) =>
      `<button type="button" class="btn btn-sm" data-lesson="${l.n}">${esc(String(l.n).padStart(3, '0'))} · ${esc(l.title.split('-').slice(1).join(' · ').slice(0, 20))}</button>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lesson]');
      if(!b) return;
      if(app.openLesson) app.openLesson(Number(b.dataset.lesson));
    });
    bar.appendChild(box);
  }
  function afterReader(){
    const spread=document.querySelector('#bookSpread');if(!spread)return;
    if(app){const r=app.reading(),id=bookKey(r.item)+':'+r.page;if(readerIdentity!==id){selection='';selectedRef=null;readerIdentity=id;}}
    spread.querySelectorAll('mark.c-search-mark').forEach(e=>e.replaceWith(document.createTextNode(e.textContent)));spread.normalize();
    if(!searchTerm)return;
    for(const root of spread.querySelectorAll('.pg-body,.book-chart-pan')){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];let n;
      while(n=walker.nextNode())if(n.parentElement.tagName!=='MARK'&&n.textContent.includes(searchTerm))texts.push(n);
      for(const node of texts){const parts=node.textContent.split(searchTerm),f=document.createDocumentFragment();parts.forEach((s,i)=>{if(i){const mark=document.createElement('mark');mark.className='c-search-mark';mark.textContent=searchTerm;f.append(mark)}f.append(document.createTextNode(s))});node.replaceWith(f)}
    }
    renderChartLessonChip();
  }
  function openSearch(){
    const d=CUI.dialog('书内查找','<label class="sr-only" for="cBookQuery">查找文字</label><input id="cBookQuery" type="search" placeholder="输入书内文字" autocomplete="off"><div id="cBookResults" class="c-search-results" aria-live="polite"></div>');
    const input=d.el.querySelector('input'),results=d.el.querySelector('#cBookResults');input.value=searchTerm;
    const run=()=>{searchTerm=input.value.trim();const matches=searchTerm?app.readerMatches(searchTerm).slice(0,60):[];results.innerHTML=matches.length?matches.map((m,i)=>`<button type="button" data-hit="${i}"><span>第 ${m.page+1} 页</span><p>${esc(m.snippet)}</p></button>`).join(''):(searchTerm?'<p class="c-muted">本书中没有匹配文字</p>':'');results.onclick=e=>{const b=e.target.closest('[data-hit]');if(!b)return;app.jumpAnchor(matches[Number(b.dataset.hit)].offset);d.el.close('selected');afterReader();};};
    input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(run,120)});run();input.focus();
  }
  function reference(){const r=selectedRef||app.reading();return {kind:r.item.kind,id:r.item.id,name:r.item.name,anchor:r.anchor,quote:selection.trim().slice(0,2500)}}
  function fmtTime(sec){const s=Math.max(0,Math.round(sec||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
  function addNote(ref){
    const choices=app.cases().map(c=>`<option value="${esc(c.id)}">${esc(c.q)}</option>`).join('');
    const d=CUI.dialog('摘录与笔记',`<div class="c-reference-source">${esc(ref.name)}${ref.lessonTime!=null?' · '+fmtTime(ref.lessonTime):''}</div><blockquote>${esc(ref.quote||'')}</blockquote><label for="cQuoteNote">笔记</label><textarea id="cQuoteNote" rows="4" placeholder="写下理解或疑问"></textarea><label for="cQuoteCase">关联卦例</label><select id="cQuoteCase"><option value="">仅存为读书笔记</option>${choices}</select>`,[{value:'cancel',label:'取消'},{value:'save',label:'保存',primary:true}]);
    d.result.then(({value,form})=>{if(value!=='save')return;const entry={id:crypto.randomUUID(),reference:ref,note:form.querySelector('textarea').value.trim(),caseId:form.querySelector('select').value,createdAt:Date.now()};data.notes.push(entry);if(persist()){app.toast('已存入笔记库');renderStudyNoteEntry();}selection='';selectedRef=null;});
  }
  function highlightReaderQuote(quote){
    const q=String(quote||'').trim();
    if(q.length<2)return;
    const mark=()=>{
      const bodies=[...document.querySelectorAll('#bookSpread .pg-body')];
      for(const body of bodies){
        if(body.querySelector('mark.c-focus-mark'))continue;
        const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT,{acceptNode(n){return n.nodeValue&&n.nodeValue.includes(q)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
        const node=walker.nextNode();
        if(!node)continue;
        const idx=node.nodeValue.indexOf(q);
        try{
          const range=document.createRange();range.setStart(node,idx);range.setEnd(node,idx+q.length);
          const m=document.createElement('mark');m.className='c-focus-mark';
          m.style.cssText='background:var(--accent-wash,rgba(166,58,46,.16));color:inherit;box-shadow:0 0 0 1px var(--accent-soft,rgba(166,58,46,.3));border-radius:2px';
          range.surroundContents(m);
          return true;
        }catch(e){return false}
      }
      return false;
    };
    const retry=(n)=>{
      if(mark())return;
      if(n<=0)return;
      setTimeout(()=>retry(n-1),350);
    };
    setTimeout(()=>retry(3),200);
  }

  function openReference(ref){
    if(!ref||!ref.kind||ref.kind==='manual'){app.toast('这是随手笔记，没有原文出处');return;}
    if(ref.kind==='lesson'){if(app.openLesson)app.openLesson(Number(ref.id));return;}
    app.openReader(ref.kind,ref.id);searchTerm=(ref.quote||'').slice(0,24);afterReader();
    const target=ref.anchor&&ref.anchor.offset||0;
    const doJump=(tries)=>{
      if(tries<=0){try{app.jumpAnchor(target)}catch(e){};highlightReaderQuote(ref.quote);return;}
      const bodies=document.querySelectorAll('#bookSpread .pg-body');
      const pageNo=(document.querySelector('.reader-pager .pg-num, #readerPageNo')?.textContent||'');
      if(bodies.length&&pageNo){
        var byText=-1;
        try{byText=app.findPageByText?app.findPageByText(ref.quote):-1}catch(e){}
        if(byText>=0&&app.jumpToPage){app.jumpToPage(byText)}else{app.jumpAnchor(target)}
        setTimeout(()=>highlightReaderQuote(ref.quote),520);
        return;
      }
      setTimeout(()=>doJump(tries-1),140);
    };
    setTimeout(()=>doJump(24),160);
    highlightReaderQuote(ref.quote);
  }
  function renderCaseReferences(id,host){
    const notes=data.notes.filter(n=>n.caseId===id);host.innerHTML=notes.map(n=>`<button type="button" class="c-reference-link" data-c-reference="${esc(n.id)}">${esc(n.reference.name)}<span>${esc((n.reference.quote||n.note||'').slice(0,65))}</span></button>`).join('');
  }
  function openNotes(){
    const r=app.reading(),ref=reference();
    if(ref.quote){addNote(ref);return;}
    const notes=data.notes.filter(n=>bookKey(n.reference)===bookKey(r.item)),attempts=data.attempts.filter(a=>a.reference&&bookKey(a.reference)===bookKey(r.item));
    const d=CUI.dialog('读书笔记',`${r.chart?'<button type="button" class="btn" id="cPracticeBook">独立分析此卦</button>':''}<div class="c-reader-notes">${notes.length?notes.map(n=>`<article><button type="button" class="c-reference-link" data-note-id="${esc(n.id)}">${esc((n.reference.quote||'').slice(0,60))}</button><p>${esc(n.note)}</p><small>${esc(n.caseId?app.cases().find(c=>c.id===n.caseId)?.q||'原卦例已移除':'读书笔记')}</small></article>`).join(''):'<p class="c-muted">选中正文后，可在这里保存摘录与笔记</p>'}${attempts.length?`<details class="c-attempt-history"><summary>练习记录 · ${attempts.length}</summary>${attempts.map(a=>`<button type="button" class="c-reference-link" data-attempt-id="${esc(a.id)}">${esc(a.text)}</button>`).join('')}</details>`:''}</div>`);
    d.el.addEventListener('click',e=>{const b=e.target.closest('[data-note-id]'),a=e.target.closest('[data-attempt-id]');if(b){const n=notes.find(n=>n.id===b.dataset.noteId);d.el.close();openReference(n.reference)}else if(a){d.el.close();openReference(attempts.find(x=>x.id===a.dataset.attemptId).reference)}else if(e.target.closest('#cPracticeBook')){d.el.close();practiceBook(r)}});
  }
  /* ---- P0：笔记库 ---- */
  function listNotes(){return data.notes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
  function sourceLabel(n){const r=n.reference||{};const base=r.kind==='lesson'?('课 '+String(r.id||'').padStart(3,'0')+' · '+String(r.name||'').split('·')[0]):(r.name||'随手笔记');return r.lessonTime!=null?base+' · '+fmtTime(r.lessonTime):base}
  function noteGroupKey(n){
    const r = n.reference || {};
    if(r.kind === 'book') return 'book';
    if(r.kind === 'lesson') return 'lesson';
    return 'manual';
  }
  function noteGroupLabel(n){
    const r = n.reference || {};
    if(r.kind === 'book') return r.name || '书摘';
    if(r.kind === 'lesson') return '课 ' + String(r.id || '').padStart(3, '0') + (r.name ? ' · ' + String(r.name).split('·')[0].slice(0, 18) : '');
    return '随手笔记';
  }
  function noteMarkdown(notes){
    const d = new Date().toISOString().slice(0, 10);
    const lines = ['# 六爻书房 · 笔记', '', '导出时间：' + d + ' · 共 ' + notes.length + ' 条', ''];
    const groups = {};
    for(const n of notes){ (groups[noteGroupLabel(n)] = groups[noteGroupLabel(n)] || []).push(n); }
    for(const g of Object.keys(groups)){
      lines.push('## ' + g, '');
      for(const n of groups[g]){
        const r = n.reference || {};
        lines.push('> ' + String(r.quote || '').trim().replace(/\n+/g, ' '));
        lines.push('');
        lines.push(String(n.note || '').trim() || '（未写内容）');
        lines.push('');
        lines.push('— ' + new Date(n.createdAt || Date.now()).toLocaleString('zh-CN') + (r.lessonTime != null ? ' · ' + fmtTime(r.lessonTime) : ''));
        lines.push('');
      }
    }
    return lines.join('\n');
  }
  function downloadText(text, name, mime){
    try{
      const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    }catch(e){ return false; }
  }
  function openNoteLibrary(){
    let filter = 'all', q = '';
    const d = CUI.dialog('笔记库', `<div class="c-note-tools">
      <input id="cNoteQuery" type="search" placeholder="搜笔记或摘录" aria-label="搜索笔记" autocomplete="off">
      <div class="c-note-groups" role="group" aria-label="按出处筛选">
        <button type="button" class="filter" data-group="all" aria-pressed="true">全部</button>
        <button type="button" class="filter" data-group="book" aria-pressed="false">书摘</button>
        <button type="button" class="filter" data-group="lesson" aria-pressed="false">课摘</button>
        <button type="button" class="filter" data-group="manual" aria-pressed="false">随手</button>
      </div>
      <span class="c-note-tools-right"><button type="button" class="btn btn-sm" id="cExportMd">导出 Markdown</button>
      <button type="button" class="btn btn-sm" id="cExportTxt">导出文本</button>
      <button type="button" class="btn btn-sm" id="cNewNote">新建随手笔记</button></span>
    </div><p class="c-note-count" id="cNoteCount"></p><div class="c-note-list" id="cNoteList"></div>`);
    const el = d.el, list = el.querySelector('#cNoteList'), count = el.querySelector('#cNoteCount');

    function current(){
      const all = listNotes();
      return all.filter(function(n){
        if(filter !== 'all' && noteGroupKey(n) !== filter) return false;
        if(!q) return true;
        const hay = ((n.note || '') + ' ' + ((n.reference || {}).quote || '') + ' ' + noteGroupLabel(n)).toLowerCase();
        return hay.indexOf(q.toLowerCase()) >= 0;
      });
    }
    function row(n){
      const r = n.reference || {};
      return `<article class="c-note-row" data-note="${esc(n.id)}">
        ${r.quote ? `<button type="button" class="c-note-quote" data-jump="${esc(n.id)}">${esc(r.quote.slice(0, 120))}</button>` : ''}
        <p class="c-note-body">${esc(n.note || '（未写内容）')}</p>
        <div class="c-note-meta"><span>${esc(noteGroupLabel(n))}${r.lessonTime != null ? ' · ' + fmtTime(r.lessonTime) : ''}</span>
        <time>${new Date(n.createdAt || Date.now()).toLocaleDateString('zh-CN')}</time>
        <span class="c-note-actions"><button type="button" data-edit="${esc(n.id)}">编辑</button><button type="button" data-del="${esc(n.id)}">删除</button>${r.kind && r.kind !== 'manual' ? '<button type="button" data-jump="' + esc(n.id) + '">回到原文</button>' : ''}</span></div>
      </article>`;
    }
    function render(){
      const notes = current();
      const all = listNotes();
      if(count) count.textContent = '共 ' + all.length + ' 条' + (notes.length !== all.length ? ' · 当前 ' + notes.length + ' 条' : '');
      if(!notes.length){ list.innerHTML = '<p class="c-muted">' + (all.length ? '没有符合条件的笔记' : '还没有笔记。读书时选中正文，点「摘录」即可保存。') + '</p>'; return; }
      if(filter === 'all' && !q){
        const groups = {};
        for(const n of notes){ (groups[noteGroupLabel(n)] = groups[noteGroupLabel(n)] || []).push(n); }
        list.innerHTML = Object.keys(groups).map(function(g){
          return '<section class="c-note-group"><h3>' + esc(g) + '<span>' + groups[g].length + '</span></h3>' + groups[g].map(row).join('') + '</section>';
        }).join('');
      } else {
        list.innerHTML = notes.map(row).join('');
      }
    }
    render();

    el.querySelector('#cNoteQuery').addEventListener('input', function(e){ q = e.target.value.trim(); render(); });
    el.querySelectorAll('[data-group]').forEach(function(b){
      b.addEventListener('click', function(){
        filter = b.dataset.group;
        el.querySelectorAll('[data-group]').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
        render();
      });
    });
    el.querySelector('#cExportMd').addEventListener('click', function(){
      const notes = current();
      if(!notes.length){ app.toast('没有可导出的笔记'); return; }
      const ok = downloadText(noteMarkdown(notes), '六爻书房-笔记-' + new Date().toISOString().slice(0, 10) + '.md', 'text/markdown;charset=utf-8');
      app.toast(ok ? '已导出 ' + notes.length + ' 条笔记' : '导出失败');
    });
    el.querySelector('#cExportTxt').addEventListener('click', function(){
      const notes = current();
      if(!notes.length){ app.toast('没有可导出的笔记'); return; }
      const text = noteMarkdown(notes).replace(/^#+\s?/gm, '').replace(/\*\*/g, '');
      const ok = downloadText(text, '六爻书房-笔记-' + new Date().toISOString().slice(0, 10) + '.txt', 'text/plain;charset=utf-8');
      app.toast(ok ? '已导出 ' + notes.length + ' 条笔记' : '导出失败');
    });
    el.querySelector('#cNewNote').addEventListener('click', function(){ d.el.close(); editNote(null); });
    el.addEventListener('click', function(e){
      const t = e.target;
      const edit = t.closest('[data-edit]'), del = t.closest('[data-del]'), jump = t.closest('[data-jump]');
      if(edit){ const n = data.notes.find(function(x){ return x.id === edit.dataset.edit; }); d.el.close(); editNote(n); return; }
      if(del){
        const id = del.dataset.del;
        const target = data.notes.find(function(x){ return x.id === id; });
        const brief = String((target && target.note) || '').replace(/\s+/g, ' ').slice(0, 36);
        Promise.resolve(CUI.confirm('删除这条笔记？', brief ? ('删除后无法恢复：' + brief + '…') : '删除后无法恢复。', '删除')).then(function(ok){
          if(!ok)return;
          data.notes = data.notes.filter(function(x){ return x.id !== id; });
          if(persist()){ d.el.close(); openNoteLibrary(); app.toast('笔记已删除'); renderStudyNoteEntry(); }
        });
        return;
      }
      if(jump){ const n = data.notes.find(function(x){ return x.id === jump.dataset.jump; }); if(n){ d.el.close(); openReference(n.reference); } }
    });
  }
  function editNote(n){
    const isNew=!n;
    const d=CUI.dialog(isNew?'新建笔记':'编辑笔记',`<label for="cNoteText">笔记内容</label><textarea id="cNoteText" rows="6" placeholder="写你的理解、疑问或结论">${esc(isNew?'':n.note||'')}</textarea>${(!isNew&&n.reference&&n.reference.quote)?`<blockquote class="c-note-refquote">${esc(n.reference.quote.slice(0,200))}</blockquote>`:''}`,[{value:'cancel',label:'取消'},{value:'save',label:'保存',primary:true}]);
    d.result.then(({value,form})=>{if(value!=='save')return;const text=form.querySelector('textarea').value.trim();if(!text){app.toast('内容不能为空');return}
      if(isNew){const entry={id:crypto.randomUUID(),reference:{kind:'manual',id:'',name:'随手笔记',anchor:{offset:0},quote:''},note:text,caseId:'',createdAt:Date.now()};data.notes.push(entry)}
      else{n.note=text;n.updatedAt=Date.now()}
      if(persist()){app.toast(isNew?'已新建笔记':'笔记已更新');renderStudyNoteEntry();}
    });
  }
  function refreshStudyNoteCount(){
    const host=document.querySelector('#studyNotesMeta');
    if(!host)return;
    host.textContent=data.notes.length+' 条笔记 · 摘录与随手记';
  }
  function renderStudyNoteEntry(){
    const grid=document.querySelector('#notesGrid');if(!grid)return;
    const host=grid.parentElement||grid;
    let bar=host.querySelector('.c-study-notes-entry');
    if(!bar){
      bar=document.createElement('div');bar.className='c-study-notes-entry';
      bar.innerHTML='<button type="button" class="btn btn-sm" id="cOpenNotes">笔记库</button><button type="button" class="btn btn-sm" id="cNewNote2">新建笔记</button>';
      bar.querySelector('#cOpenNotes').addEventListener('click',openNoteLibrary);
      bar.querySelector('#cNewNote2').addEventListener('click',()=>editNote(null));
      host.insertBefore(bar,grid);
    }
    const btn=bar.querySelector('#cOpenNotes');if(btn)btn.textContent='笔记库（'+data.notes.length+'）';
    refreshStudyNoteCount();
  }
  /* ---- 浮动「摘录」按钮 ---- */
  let floatBtn=null;
  function ensureFloat(){
    if(floatBtn)return floatBtn;
    floatBtn=document.createElement('button');floatBtn.type='button';floatBtn.className='c-float-excerpt';floatBtn.textContent='摘录';floatBtn.hidden=true;
    document.body.appendChild(floatBtn);
    floatBtn.addEventListener('mousedown',e=>e.preventDefault());
    floatBtn.addEventListener('click',()=>{
      const ref=takeSelection();floatBtn.hidden=true;
      if(!ref){app.toast('没有选中文字');return}
      addNote(ref);
    });
    return floatBtn;
  }
  function takeSelection(){
    const sel=window.getSelection();if(!sel||!sel.rangeCount)return null;const text=sel.toString().trim();if(text.length<2)return null;
    const spread=document.querySelector('#bookSpread'),lesson=document.querySelector('#view-lesson');
    if(spread&&!spread.hidden&&spread.contains(sel.anchorNode)&&app){selection=text;selectedRef=app.reading();return reference()}
    if(lesson&&!lesson.hidden&&lesson.contains(sel.anchorNode)){
      const n=Number(lesson.dataset.lessonN||0);const title=lesson.dataset.lessonTitle||'';
      const audio=lesson.querySelector('audio');const t=audio?audio.currentTime:null;
      return {kind:'lesson',id:String(n),name:title,anchor:{offset:0},quote:text.slice(0,2500),lessonTime:t};
    }
    return null;
  }
  function onSelect(){
    const sel=window.getSelection();if(!sel||!sel.rangeCount||!sel.toString().trim()){if(floatBtn)floatBtn.hidden=true;return}
    const spread=document.querySelector('#bookSpread'),lesson=document.querySelector('#view-lesson');
    const inSpread=spread&&!spread.hidden&&spread.contains(sel.anchorNode),inLesson=lesson&&!lesson.hidden&&lesson.contains(sel.anchorNode);
    if(!inSpread&&!inLesson){if(floatBtn)floatBtn.hidden=true;return}
    const range=sel.getRangeAt(0);const rect=range.getBoundingClientRect();if(!rect||!rect.width){if(floatBtn)floatBtn.hidden=true;return}
    const b=ensureFloat();b.style.left=Math.max(8,Math.min(window.innerWidth-80,rect.left+rect.width/2-30))+'px';
    b.style.top=Math.max(8,rect.top-38)+'px';b.hidden=false;
  }
  function attachExcerpt(){
    ensureFloat();
    document.addEventListener('mouseup',()=>setTimeout(onSelect,10),true);
    document.addEventListener('touchend',()=>setTimeout(onSelect,80),true);
    document.addEventListener('selectionchange',()=>{const s=window.getSelection();if(!s||!s.toString().trim()){if(floatBtn)floatBtn.hidden=true}});
  }
  function practiceBook(r){
    const target='book:'+r.item.id+':'+r.anchor.offset;
    const d=CUI.dialog('独立分析',`<div class="c-practice-chart">${CCore.chartHTML(r.chart)}</div><label for="cBookAttempt">我的分析</label><textarea id="cBookAttempt" rows="5" placeholder="取用、依据与判断">${esc(practiceDraft(target))}</textarea>`,[{value:'cancel',label:'稍后继续'},{value:'compare',label:'保存并继续阅读原解',primary:true}]);
    const text=d.el.querySelector('textarea');text.required=true;text.addEventListener('input',()=>setPracticeDraft(target,text.value));
    d.result.then(({value})=>{if(value!=='compare'||!text.value.trim())return;savePractice(target,text.value.trim(),{...r.item,anchor:r.anchor});app.turn(1)});
  }
  function init(api){
    app=api;const controls=document.querySelector('#rv5Bar');
    for(const [id,label,icon,run] of [['cBookSearch','书内查找','i-search',openSearch],['cBookNotes','摘录与读书笔记','i-pen',openNotes]]){
      const b=document.createElement('button');b.type='button';b.className='icon-btn c-reader-tool';b.id=id;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=`<svg aria-hidden="true"><use href="#${icon}"></use></svg>`;b.addEventListener('click',run);controls.append(b);
      b.addEventListener('pointerdown',()=>{const s=getSelection();if(s?.rangeCount&&document.querySelector('#bookSpread').contains(s.anchorNode)){selection=s.toString();selectedRef=app.reading();}});
    }
    document.addEventListener('click',e=>{const b=e.target.closest('[data-c-reference]');if(!b)return;const n=data.notes.find(n=>n.id===b.dataset.cReference);if(n)openReference(n.reference)});
    attachExcerpt();
    const tryMount=()=>{try{renderStudyNoteEntry();}catch(e){window.__cStudyErr=String(e)}};
    tryMount();setInterval(tryMount,2000);
    document.addEventListener('click',e=>{if(e.target.closest('[data-route="study"]'))setTimeout(tryMount,300)});
  }
  return {init,afterReader,commandMatches,renderCaseReferences,practiceDraft,attemptsFor,setPracticeDraft,savePractice,openSearch,openNotes,openReference,listNotes,openNoteLibrary,editNote,refreshStudyNoteCount,renderStudyNoteEntry,renderChartLessonChip};
})();

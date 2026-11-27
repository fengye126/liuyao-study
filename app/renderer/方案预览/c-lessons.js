window.CLessons = (() => {
  const key='liuyao-c-lessons-v1';let store={},app,current=null,raw=false,lastSave=0,onResume=null,audioQuery='',imageScroll=0;
  try{store=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
  const esc=s=>CUI.esc(s),norm=s=>{try{return decodeURI(String(s)).replace(/\\/g,'/').replace(/^file:\/\/\//i,'').toLowerCase()}catch{return String(s)}},identity=x=>String(x.id||x.n||x.audio);
  const record=()=>store[identity(current)]||(store[identity(current)]={bookmarks:[],position:0});
  const persist=()=>{if(window.CRestoringData)return false;try{localStorage.setItem(key,JSON.stringify(store));return true}catch{app?.toast('听课笔记尚未保存，请先导出数据');return false}};
  const stamp=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const edition=()=>window.CLessonEditions?.[current?.n];
  const readingText=()=>record().text??(edition()?.sections.map(s=>s.text).join('\n\n'))??tidy(current.text);
  function tidy(text){return String(text||'').replace(/(父母|官鬼|兄弟|子孫|子孙|妻財|妻财)搖(?=為|为|持|發|发|旺|衰|之|的)/g,'$1爻');}
  function paragraphs(text){
    const out=[];
    for(let p of String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean)){
      while(p.length>210){let cut=-1;const scan=p.slice(100,195),matches=[...scan.matchAll(/[。！？；]|(?=所以|那么|那麼|接下来|接下來|首先|其次|我们|我們)/g)];if(matches.length)cut=100+matches.at(-1).index+(matches.at(-1)[0]?1:0);if(cut<110)cut=170;out.push(p.slice(0,cut));p=p.slice(cut)}if(p)out.push(p);
    }
    return out;
  }
  function renderText(){
    if(!current)return;
    const r=record(),ed=edition(),host=document.querySelector('#lessonText');
    const seekBtn=(start)=>`<button class="c-lesson-seek" type="button" data-c-lesson-seek="${start}" aria-label="从 ${stamp(start)} 回听本段">${stamp(start)}</button>`;
    let html='';
    if(raw){
      html=paragraphs(current.text).map(p=>'<p>'+esc(p)+'</p>').join('');
    }else if(r.text==null){
      html=ed?ed.sections.map(s=>`<p>${seekBtn(s.start)}${esc(s.text)}</p>`).join(''):
        (current.text?paragraphs(current.text).map(p=>'<p>'+esc(p)+'</p>').join(''):'<div class="c-lesson-empty"><p>这堂课尚无转写</p><p class="c-muted">可以听录音，并在当前时间记下笔记</p></div>');
    }else{
      /* 个人校对稿：沿用整理稿的时间点，尽量保住回听入口 */
      const ps=paragraphs(r.text),secs=ed&&Array.isArray(ed.sections)?ed.sections:null;
      html=ps.map((txt,i)=>secs&&secs[i]?`<p>${seekBtn(secs[i].start)}${esc(txt)}</p>`:`<p>${esc(txt)}</p>`).join('');
    }
    host.innerHTML=html;
    const text=r.text!=null?r.text:(current.text||'');
    const state=document.querySelector('#cTranscriptState');
    if(state){
      state.textContent=!text?'':raw?'原始转写':(r.text!=null?(r.reviewed?'已校对':'个人校对稿'):(ed?ed.label:'待校转写'));
      state.title=ed?'整理稿删去口头重复；存疑处保留回听提示，原始转写可随时查看。':'';
    }
    const original=document.querySelector('#cLessonOriginal');if(original){original.hidden=!current.text;original.setAttribute('aria-pressed',String(raw));}
    const correction=document.querySelector('#cLessonCorrect');if(correction)correction.hidden=!current.text&&!r.text;
    let restore=document.querySelector('#cLessonRestore');
    const tools=document.querySelector('#view-lesson .c-lesson-tools div');
    if(r.text!=null&&tools){
      if(!restore){
        restore=document.createElement('button');restore.className='btn btn-sm';restore.id='cLessonRestore';restore.textContent='恢复整理稿';
        tools.appendChild(restore);
        restore.addEventListener('click',()=>{
          const rec=record();
          if(!rec||rec.text==null)return;
          if(rec.revisions)rec.revisions.push({at:Date.now(),text:rec.text,reviewed:!!rec.reviewed});
          delete rec.text;rec.reviewed=false;rec.editedAt=Date.now();
          if(persist()){raw=false;renderText();app.toast('已恢复整理稿与时间轴')}
        });
      }
    }else if(restore){restore.remove();}
  }

  /* ---- 课页与音频同步（有整理稿时间戳的课才启用） ---- */
  let syncTimer = null, syncActive = -1, syncUserScrollAt = 0;
  function currentSections() {
    const ed = edition();
    return ed && Array.isArray(ed.sections) ? ed.sections : null;
  }
  function decorateSync(view, audio) {
    const paras = [...view.querySelectorAll('#lessonText p')].map((p) => {
      const btn = p.querySelector('[data-c-lesson-seek]');
      if (btn) { p.dataset.start = btn.dataset.cLessonSeek; p.classList.add('c-lesson-para'); }
      return p;
    });
    const sections = currentSections();
    const tools = view.querySelector('.c-lesson-tools');
    if (tools && sections && !tools.querySelector('#cLessonRate')) {
      const wrap = document.createElement('div');
      wrap.className = 'c-lesson-sync';
      wrap.innerHTML = '<button type="button" class="btn btn-sm" id="cLessonPrev" aria-label="上一段">上一句</button>' +
        '<button type="button" class="btn btn-sm" id="cLessonNext" aria-label="下一段">下一句</button>' +
        '<label class="c-lesson-rate">倍速<select id="cLessonRate" aria-label="播放倍速">' +
        '<option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>';
      tools.appendChild(wrap);
      const rate = wrap.querySelector('#cLessonRate');
      rate.addEventListener('change', () => { audio.playbackRate = Number(rate.value) || 1; });
      wrap.querySelector('#cLessonPrev').addEventListener('click', () => jumpSection(-1));
      wrap.querySelector('#cLessonNext').addEventListener('click', () => jumpSection(1));
    }
    if (audio) audio.playbackRate = 1;
    paras.forEach((p) => {
      p.addEventListener('click', (e) => {
        if (e.target.closest('button, select, a')) return;
        if (!audio || !p.dataset.start) return;
        audio.currentTime = Math.max(0, Number(p.dataset.start) - 0.05);
        syncNote('已跳到 ' + stamp(p.dataset.start));
      });
    });
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    if (!sections || !audio) return;
    const marks = paras.filter((p) => p.dataset.start != null);
    const update = () => {
      if (!audio || !document.body.contains(view) || view.hidden) return;
      const t = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < sections.length; i++) { if (t + 0.15 >= Number(sections[i].start)) idx = i; else break; }
      if (idx === syncActive) return;
      syncActive = idx;
      marks.forEach((p, i) => {
        const on = i === idx;
        p.classList.toggle('is-speaking', on);
        if (on && Date.now() - syncUserScrollAt > 4000) {
          const r = p.getBoundingClientRect();
          if (r.top < 120 || r.bottom > innerHeight - 120) p.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
        }
      });
    };
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('seeked', update);
    syncTimer = setInterval(update, 400);
    view.addEventListener('wheel', () => { syncUserScrollAt = Date.now(); }, { passive: true });
    view.addEventListener('touchmove', () => { syncUserScrollAt = Date.now(); }, { passive: true });
    update();
  }
  function jumpSection(dir) {
    const sections = currentSections(); const audio = document.querySelector('#lessonAudio');
    if (!sections || !audio) return;
    const t = audio.currentTime; let idx = 0;
    for (let i = 0; i < sections.length; i++) { if (t + 0.3 >= Number(sections[i].start)) idx = i; }
    const next = Math.max(0, Math.min(sections.length - 1, idx + dir));
    audio.currentTime = Math.max(0, Number(sections[next].start) - 0.05);
    syncActive = -1;
    syncNote('第 ' + (next + 1) + '/' + sections.length + ' 段 · ' + stamp(sections[next].start));
  }
  function syncNote(text) { const el = document.querySelector('#cTranscriptState'); if (el) el.textContent = text; }


  /* ---- P1：课页 → 书里原文 ---- */
  function lessonBookLinks(){
    const host=document.querySelector('.c-lesson-booklinks');
    if(host)host.remove();
    const view=document.querySelector('#view-lesson');
    if(!view||view.hidden)return;
    const title=view.dataset.lessonTitle||'';
    let m=/([\u4e00-\u9fa5]{1,2})之([\u4e00-\u9fa5]{1,2})/.exec(title);
    let needle=m?(m[1]+'之'+m[2]):null;
    if(!needle){const s=/([\u4e00-\u9fa5]{1,2})卦(?:$|[^一-龥])/.exec(title);if(s)needle=s[1];}
    if(!needle)return;
    const gz=(/([\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])\u6708\s*([\u7532\u4e59\u4e19\u4e01\u620a\u5df1\u5e9a\u8f9b\u58ec\u7678][\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5])\u65e5/.exec(title));
    const hits=[];
    const escRe=(x)=>String(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const r of app.catalog()||[]){
      if(r.kind!=='book')continue;
      const t=String(r.text||'');
      let at=-1;
      if(gz){
        /* 正文格式：X月Y日，占..., 得「卦名」——先按干支+卦名同句匹配 */
        const re=new RegExp(escRe(gz[1])+'月[\\s\\u3000]*'+escRe(gz[2])+'日[\\s\\S]{0,80}?'+escRe(needle));
        const m2=re.exec(t);
        if(m2){at=m2.index+m2[0].lastIndexOf(needle);}
      }
      if(at<0)at=t.indexOf(needle);
      if(at<0)continue;
      hits.push({kind:'book',id:r.id,name:r.name,anchor:{offset:at},quote:needle});
      if(hits.length>=4)break;
    }
    if(!hits.length)return;
    const bar=document.createElement('div');bar.className='c-lesson-booklinks';
    bar.innerHTML='<span class="c-lesson-booklinks-label">书中原文</span>'+hits.map((h,i)=>`<button type="button" class="btn btn-sm" data-book-link="${i}">${esc(h.name.replace(/[《》]/g,''))}</button>`).join('');
    bar.addEventListener('click',(e)=>{const b=e.target.closest('[data-book-link]');if(!b)return;const h=hits[Number(b.dataset.bookLink)];if(window.CStudy&&CStudy.openReference)CStudy.openReference(h);});
    const tools=document.querySelector('#view-lesson .c-lesson-tools');
    (tools||document.querySelector('#view-lesson')).appendChild(bar);
  }

  function renderBookmarks(){const r=record(),host=document.querySelector('#cLessonBookmarks');if(!host)return;host.innerHTML=(r.bookmarks||[]).map(b=>`<button type="button" data-c-audio-bookmark="${esc(b.id)}"><time>${stamp(b.time)}</time><span>${esc(b.note)}</span></button>`).join('');}
  function savePosition(force=false){if(!current)return;const audio=document.querySelector('#lessonAudio');if(!audio?.currentSrc||norm(audio.currentSrc)!==norm(current.audio)||!Number.isFinite(audio.currentTime))return;if(force||Date.now()-lastSave>5000){lastSave=Date.now();record().position=audio.currentTime;persist()}}
  function beforeRender(){savePosition(true);if(onResume)document.querySelector('#lessonAudio').removeEventListener('loadedmetadata',onResume);current=null;}

  function decorateLessonTools(view){
    const tools=view.querySelector('.c-lesson-tools');
    if(!tools||tools.querySelector('.c-lesson-more'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn btn-sm c-lesson-more';btn.textContent='更多';
    btn.setAttribute('aria-expanded','false');
    btn.addEventListener('click',()=>{
      if(innerWidth>640)return;
      const collapsed=tools.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded',String(!collapsed));
      btn.textContent=collapsed?'更多':'收起';
    });
    /* 放在折叠区外面，收起后仍可点开 */
    tools.appendChild(btn);
  }

  function render(item){
    current=item;raw=false;imageScroll=0;
    const view=document.querySelector('#view-lesson');view.classList.toggle('c-audio-only',!item.img);view.classList.remove('c-show-lesson-image');
    view.dataset.lessonN=String(item.n||'');view.dataset.lessonTitle=item.title||'';
    view.querySelector('.lesson-img').hidden=!item.img;
    let toolbar=view.querySelector('.c-lesson-tools');if(!toolbar){toolbar=document.createElement('div');toolbar.className='c-lesson-tools';view.querySelector('.lesson-bar').after(toolbar)}
    toolbar.innerHTML='<span id="cTranscriptState"></span><div><button class="btn btn-sm" id="cLessonOriginal" aria-pressed="false">原文</button><button class="btn btn-sm" id="cLessonCorrect">校对</button>'+(item.img?'<button class="btn btn-sm" id="cLessonImage" aria-expanded="false">配图</button>':'')+'<button class="btn btn-sm" id="cLessonBookmark">记下此刻</button></div>';
    let bookmarks=document.querySelector('#cLessonBookmarks');if(!bookmarks){bookmarks=document.createElement('aside');bookmarks.id='cLessonBookmarks';bookmarks.setAttribute('aria-label','听课笔记');view.querySelector('.lesson-audio').after(bookmarks)}
    renderText();renderBookmarks();const audio=document.querySelector('#lessonAudio'),r=record();decorateSync(view,audio);lessonBookLinks();decorateLessonTools(view);
    const position=r.position;onResume=()=>{if(current===item&&position>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,Math.max(0,audio.duration-1));};if(audio.readyState>=1)onResume();else audio.addEventListener('loadedmetadata',onResume,{once:true});
  }
  function decorateAudio(){
    const list=document.querySelector('#audioList');if(!list)return;
    function filter(){
      const q=audioQuery.trim().toLowerCase();
      const numMatch=q.match(/^第?\s*0*(\d{1,3})\s*课?$/);
      for(const group of list.querySelectorAll('.audio-group')){
        let found=0;const rows=[...group.querySelectorAll('.c-audio-row')];
        for(const row of rows){
          const btn=row.querySelector('.audio-item');
          const title=(btn?.dataset.audioTitle||row.textContent||'').toLowerCase();
          const n=btn?.dataset.lessonN?Number(btn.dataset.lessonN):0;
          let match=!q||title.includes(q);
          if(!match&&numMatch&&n===Number(numMatch[1]))match=true;
          if(!match&&numMatch&&new RegExp('0*'+Number(numMatch[1])+'_').test(title))match=true;
          row.hidden=!match;
          if(match)found++;
        }
        const shown=rows.filter(r=>!r.hidden).sort((a,b)=>(b.querySelector('.audio-item')?.dataset.lessonN?1:0)-(a.querySelector('.audio-item')?.dataset.lessonN?1:0));
        for(const r of shown)group.appendChild(r);
        group.hidden=!found;
        group.dataset.lessonMatch=[...group.querySelectorAll('.audio-item')].some(b=>b.dataset.lessonN)?'1':'';
      }
      /* 有整理稿的组排前面 */
      const groups=[...list.querySelectorAll('.audio-group')];
      groups.sort((a,b)=>(b.dataset.lessonMatch?1:0)-(a.dataset.lessonMatch?1:0));
      for(const g of groups)list.appendChild(g);
    }
    if(!list.querySelector('#cAudioQuery')){const label=document.createElement('label');label.className='c-audio-search';label.innerHTML='<svg aria-hidden="true"><use href="#i-search"></use></svg><input id="cAudioQuery" type="search" placeholder="查找录音" aria-label="查找录音">';list.prepend(label);const input=label.querySelector('input');input.value=audioQuery;input.addEventListener('input',e=>{audioQuery=e.target.value;filter()});}
    for(const button of list.querySelectorAll('.audio-item')){
      if(button.parentElement.classList.contains('c-audio-row'))continue;
      const row=document.createElement('div');row.className='c-audio-row';button.before(row);row.append(button);
      const lessonMatch=(app.lessons()||[]).find(l=>norm(l.audio)===norm(button.dataset.audioSrc));
      if(lessonMatch){button.dataset.lessonN=String(lessonMatch.n);}
      const open=document.createElement('button');open.type='button';open.className='btn btn-sm';open.textContent=lessonMatch?'学习（有整理稿）':'学习';open.setAttribute('aria-label','学习：'+button.dataset.audioTitle);
      open.addEventListener('click',()=>{if(lessonMatch)app.openLesson(lessonMatch.n);else app.showLesson({id:'audio:'+button.dataset.audioSrc,title:button.dataset.audioTitle,audio:button.dataset.audioSrc,text:'',img:''})});row.append(open);
    }
    filter();
  }
  function correct(){
    const r=record(),text=readingText(),d=CUI.dialog('校对转写',`<textarea id="cCorrectText" rows="14" aria-label="校对正文">${esc(text)}</textarea><label class="c-reviewed-check"><input type="checkbox" id="cReviewed" ${r.reviewed?'checked':''}>已对照录音校对</label>`,[{value:'cancel',label:'取消'},{value:'save',label:'保存',primary:true}]);
    d.result.then(({value,form})=>{if(value!=='save')return;const next=form.querySelector('textarea').value;if(r.text!=null){r.revisions=r.revisions||[];r.revisions.push({at:r.editedAt||Date.now(),text:r.text,reviewed:!!r.reviewed});}r.text=next;r.reviewed=form.querySelector('input').checked;r.editedAt=Date.now();if(persist()){raw=false;renderText();app.toast('校对内容已保存，原文保留')}});
  }
  function bookmark(){
    const audio=document.querySelector('#lessonAudio'),time=Number.isFinite(audio.currentTime)?audio.currentTime:0,selected=getSelection()?.toString()||'';
    const d=CUI.dialog('听课笔记',`<time class="c-bookmark-time">${stamp(time)}</time><textarea rows="5" placeholder="记下此刻的理解或疑问" aria-label="听课笔记">${esc(selected)}</textarea>`,[{value:'cancel',label:'取消'},{value:'save',label:'保存',primary:true}]);
    d.result.then(({value,form})=>{if(value!=='save')return;const note=form.querySelector('textarea').value.trim();if(!note)return;const r=record();r.bookmarks=r.bookmarks||[];r.bookmarks.push({id:crypto.randomUUID(),time,note,at:Date.now()});if(persist())renderBookmarks()});
  }
  function init(api){app=api;const audio=document.querySelector('#lessonAudio');audio.addEventListener('timeupdate',()=>savePosition());audio.addEventListener('pause',()=>savePosition(true));window.addEventListener('pagehide',()=>savePosition(true));
    document.addEventListener('click',e=>{if(e.target.closest('#cLessonOriginal')){raw=!raw;renderText()}else if(e.target.closest('#cLessonCorrect'))correct();else if(e.target.closest('#cLessonImage')){const v=document.querySelector('#view-lesson'),on=v.classList.toggle('c-show-lesson-image');document.querySelector('#cLessonImage').setAttribute('aria-expanded',String(on));if(on){imageScroll=window.scrollY;if(innerWidth<=900)v.querySelector('.lesson-img').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})}else if(innerWidth<=900)window.scrollTo(0,imageScroll);}else if(e.target.closest('#cLessonBookmark'))bookmark();else{const b=e.target.closest('[data-c-audio-bookmark]');if(b){const found=(record().bookmarks||[]).find(x=>x.id===b.dataset.cAudioBookmark);if(found)audio.currentTime=found.time;}}});
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-c-lesson-seek]');if(b){const a=document.querySelector('#lessonAudio');if(a&&Number.isFinite(a.duration))a.currentTime=Math.min(Number(b.dataset.cLessonSeek),a.duration-1)}});
  return {init,render,beforeRender,decorateAudio,tidy,paragraphs};
})();

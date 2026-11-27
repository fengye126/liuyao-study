/* The active note and its exact cast travel together; snapshots never enter A/B. */
(() => {
  const key='liuyao-c-cast-drafts-v2',legacyKey='liuyao-c-cast-note';
  const $=s=>document.querySelector(s),input=$('#cCastNotes');
  const params=new URLSearchParams(location.search);let enabled=!params.has('capture')&&!params.has('demo');
  let store={active:'',drafts:{}},id='',snapshot=null,restoring=false,ready=false,timer=0,queued=false;
  try{const data=JSON.parse(localStorage.getItem(key)||'null');if(data?.drafts)store=data;}catch{}
  const signature=s=>JSON.stringify([s.when,s.lines,!!s.manualDate,s.manualMonth||'',s.manualDay||'']);
  const meaningful=(s,n)=>!!n.trim()||s.confirmed||(s.tossed||[]).length>0||s.mode!=='program';
  const persist=()=>{
    if(!enabled)return;
    try{localStorage.setItem(key,JSON.stringify(store));input.dataset.saved='true';$('#cDraftError')?.remove();}
    catch{input.dataset.saved='false';if(!$('#cDraftError')){const p=document.createElement('p');p.id='cDraftError';p.setAttribute('role','status');p.textContent='本机空间不足，草稿尚未保存';input.after(p);}}
  };
  function flush(){
    clearTimeout(timer);if(!enabled||!ready||restoring||!id||!snapshot)return;
    const n=input.value;
    if(meaningful(snapshot,n)){store.drafts[id]={snapshot,note:n,question:$('#castQuestion')?.value||'',category:$('#castCategory')?.value||'',gender:$('#cSaveGender input:checked')?.value||'',updatedAt:Date.now()};store.active=id;}
    else if(store.active===id)store.active='';
    persist();
  }
  window.CFlushDraft=flush;
  window.CSuspendDraft=()=>{enabled=false;clearTimeout(timer)};
  window.CResumeDraft=()=>{enabled=!params.has('capture')&&!params.has('demo')};
  function loadNote(record){
    input.value=record?.note||'';input.dataset.castId=id;
    const q=$('#castQuestion');if(q)q.value=record?.question||'';
    const category=$('#castCategory');if(category)category.value=record?.category||'';
    document.querySelectorAll('#cSaveGender input').forEach(e=>e.checked=e.value===record?.gender);
  }
  function sync(){
    queued=false;if(!ready||restoring||!window.CGetCastSnapshot)return;
    const next=CGetCastSnapshot(),nextId=signature(next);
    if(nextId!==id){flush();id=nextId;snapshot=next;loadNote(store.drafts[id]);}
    else snapshot=next;
    flush();
  }
  window.CCastChanged=()=>{if(!queued){queued=true;queueMicrotask(sync)}};
  window.CDraftMatches=()=>{if(!ready)return true;sync();return id===signature(CGetCastSnapshot());};
  window.CClearDraft=()=>{
    clearTimeout(timer);if(id){delete store.drafts[id];if(store.active===id)store.active='';}
    id='';snapshot=null;input.value='';input.dataset.castId='';
    document.querySelectorAll('#cSaveGender input').forEach(e=>e.checked=false);persist();
  };
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(flush,180)});
  input.addEventListener('blur',flush);window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
  for(const s of ['#castQuestion','#castCategory','#cSaveGender'])$(s)?.addEventListener('change',flush);
  new MutationObserver(()=>window.CCastChanged()).observe($('#plateTableRows'),{childList:true});
  new MutationObserver(()=>window.CCastChanged()).observe($('#plateTime'),{childList:true});
  Promise.resolve(window.__LIUYAO_ENGINE || window.__LIUYAO_DEPS).then(()=>requestAnimationFrame(()=>{
    if(!window.CGetCastSnapshot)return;
    const record=store.drafts[store.active];
    if(enabled&&record?.snapshot){
      restoring=true;const ok=window.CRestoreCastSnapshot?.(record.snapshot);restoring=false;
      if(ok){id=signature(CGetCastSnapshot());snapshot=CGetCastSnapshot();loadNote(record);}
    }
    ready=true;sync();
    let legacy='';try{legacy=localStorage.getItem(legacyKey)||''}catch{}
    if(enabled&&legacy.trim()&&!input.value.trim()){
      const b=document.createElement('button');b.type='button';b.className='btn c-legacy-note';b.textContent='恢复旧笔记';input.before(b);
      b.addEventListener('click',()=>{input.value=legacy;flush();try{localStorage.removeItem(legacyKey)}catch{}b.remove()});
    }
  }));
})();

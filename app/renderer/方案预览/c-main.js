(() => {
  const $=s=>document.querySelector(s),doc=document.documentElement;
  $('.proposal-caption')?.remove();
  const top=document.createElement('div');top.className='c-top-widgets';
  top.innerHTML='<span id="cNextTerm" class="c-term-count"></span><span class="c-time"><i class="c-breath" aria-hidden="true"></i><time id="cClock"></time></span><button class="c-mini-hex" aria-label="拨动六爻纹样" title="拨动六爻纹样">'+Array.from({length:6},(_,i)=>`<i style="--i:${i}"${i%2?' class="yin"':''}></i>`).join('')+'</button>';
  $('.topbar-right')?.append(top);
  const next=document.createElement('div');next.id='cWheelNext';next.className='c-wheel-next';$('#wheelWrap')?.after(next);
  $('.c-mini-hex')?.addEventListener('click',e=>e.currentTarget.classList.toggle('alternate'));
  const refreshClock=()=>{if(window.LiuYao)CCore.readout(window.LiuYao,window.ALMANAC)};
  Promise.resolve(window.__LIUYAO_DEPS).then(refreshClock);
  setInterval(()=>{if(!document.hidden&&doc.dataset.route!=='home')refreshClock()},1000);
  const head=$('#plate .plate-head'),stars=$('#starListWrap'),pillars=$('#plate .ph6-pillars');
  if(head&&stars&&pillars)head.append(pillars);
  const note=document.createElement('section');note.className='c-cast-notes';
  note.innerHTML='<label for="cCastNotes">笔记</label><textarea id="cCastNotes" placeholder="记录当下的判断、思路与待验证之处……" rows="4"></textarea>';
  const actions=$('#plate .proposal-plate-actions');if(actions)actions.before(note);
  const gender=document.createElement('fieldset');gender.id='cSaveGender';gender.innerHTML='<legend>测事人</legend><label><input type="radio" name="c-gender" value="男" required><span>男测</span></label><label><input type="radio" name="c-gender" value="女" required><span>女测</span></label>';
  $('#saveHint')?.before(gender);
  document.querySelectorAll('#castPanel .mode-pane').forEach(p=>{
    const b=document.createElement('button');b.className='btn c-restart';b.textContent='一键重来';b.type='button';
    b.addEventListener('click',()=>{window.CResetCast?.();doc.classList.remove('proposal-plate-active','proposal-plate-editing')});
    (p.querySelector('.toss-actions')||p).append(b);
  });
  // Retain calculation nodes used by v6, hiding only duplicate presentation.
  document.querySelectorAll('#castPanel p').forEach(p=>{if(p.textContent.includes('三枚铜钱同时掷出'))p.hidden=true});
  const cleanTime=()=>{
    $('#plateTime')?.querySelectorAll('.ph6-palace,#plateShiYing').forEach(e=>{const p=e.closest('span');if(p)p.hidden=true});
    const t=$('#plateTime');if(t)for(const n of t.childNodes)if(n.nodeType===3&&n.textContent.includes('干支历'))n.textContent=n.textContent.replace('干支历','黄历');
  };
  if($('#plateTime'))new MutationObserver(cleanTime).observe($('#plateTime'),{childList:true});cleanTime();
  // Route-specific shell state prevents a hidden full plate affecting home.
  const sync=()=>{
    doc.classList.toggle('c-reader-open',!$('#view-reader')?.hidden);
    const onCast=!$('#view-cast')?.hidden;
    doc.classList.toggle('c-on-cast',onCast);
    if(!onCast)doc.classList.remove('proposal-plate-active');
    else if(!$('#plate')?.hidden&&!doc.classList.contains('proposal-plate-editing'))doc.classList.add('proposal-plate-active');
  };
  for(const id of ['#view-reader','#view-cast'])if($(id))new MutationObserver(sync).observe($(id),{attributes:true,attributeFilter:['hidden']});sync();
  const spread=$('#bookSpread');let start=null;const pointers=new Map();let distance=0,scale=1,panX=0,panY=0;
  const pan=()=>{const el=$('.book-chart-pan');if(el)el.style.transform=`translate(${panX}px,${panY}px) scale(${scale*(Number(el.dataset.fit)||1)})`};
  spread?.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,a,input,textarea'))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1)start={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};
    if(pointers.size===2){const a=[...pointers.values()];distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);spread.setPointerCapture(e.pointerId)}
  });
  spread?.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(spread.classList.contains('is-chart')){
      if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);scale=Math.max(1,Math.min(3,scale*d/Math.max(1,distance)));distance=d;pan();}
      else if(scale>1&&start){panX+=e.clientX-start.lastX;panY+=e.clientY-start.lastY;pan();}
    }
    if(start){start.lastX=e.clientX;start.lastY=e.clientY}
  });
  spread?.addEventListener('pointerup',e=>{
    const had=pointers.size;pointers.delete(e.pointerId);
    if(had===1&&start&&scale===1){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4&&!getSelection()?.toString())window.CReaderTurn?.(dx<0?1:-1)}
    if(!pointers.size)start=null;
  });
  spread?.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);start=null});
  spread?.addEventListener('dblclick',e=>{if(!e.target.closest('.book-chart'))return;scale=scale===1?1.7:1;panX=panY=0;pan()});
  new MutationObserver(()=>{scale=1;panX=panY=0}).observe(spread,{childList:true});
  window.CHomeReadingExtra=(pct,chapter)=>{
    const card=$('.home-reading');if(!card)return;
    let row=card.querySelector('.c-home-progress');
    if(!row){row=document.createElement('div');row.className='c-home-progress';row.innerHTML='<span class="c-home-track"><i></i></span>';row.append($('#homeReadingPct'));card.append(row);const ch=document.createElement('span');ch.className='c-home-chapter';card.querySelector('.hr-book')?.after(ch);}
    row.querySelector('i').style.width=pct+'%';card.querySelector('.c-home-chapter').textContent=chapter;
    row.setAttribute('role','progressbar');row.setAttribute('aria-label','阅读进度');row.setAttribute('aria-valuenow',String(Math.round(pct)));row.setAttribute('aria-valuemin','0');row.setAttribute('aria-valuemax','100');
  };
  const setReadingInitial=()=>{if(window.CRefreshHomeReading)CRefreshHomeReading();else window.CHomeReadingExtra(parseFloat($('#homeReadingPct')?.textContent)||0,'')};
  Promise.resolve(window.__LIUYAO_DEPS).then(setReadingInitial);
  const alignPlateNames=()=>{
    const table=$('#plateTable');if(!table||$('#plate').hidden)return;
    for(const [id,sel] of [['#plateBenName','.p6-ben .p6-yao'],['#plateBianName','.p6-bian .p6-yao']]){
      const title=$(id),line=table.querySelector(sel);if(!title||!line)continue;
      const cell=title.closest('.p6-col').getBoundingClientRect(),r=line.getBoundingClientRect();
      title.style.setProperty('--name-x',(r.left+r.width/2-cell.left)+'px');
    }
  };
  let alignFrame=0;const alignSoon=()=>{cancelAnimationFrame(alignFrame);alignFrame=requestAnimationFrame(alignPlateNames)};
  new MutationObserver(alignSoon).observe($('#plateTableRows'),{childList:true});new ResizeObserver(alignSoon).observe($('#plateTable'));alignSoon();
  let wheelVisible=false;const pauseWheel=()=>doc.classList.toggle('c-wheel-paused',!wheelVisible||document.hidden||doc.dataset.route!=='home');
  new IntersectionObserver(entries=>{wheelVisible=entries[0]?.isIntersecting;pauseWheel()},{threshold:.12}).observe($('#wheelWrap'));
  document.addEventListener('visibilitychange',pauseWheel);new MutationObserver(pauseWheel).observe(doc,{attributes:true,attributeFilter:['data-route']});
})();


/* v6.2 移动端首屏起卦按钮 */
(function () {
  function ensureCta() {
    if (document.querySelector('.c-mobile-cta')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-mobile-cta';
    b.innerHTML = '起卦排盘';
    b.setAttribute('aria-label', '起卦排盘');
    b.addEventListener('click', function () {
      if (window.CApp && CApp.toast) {}
      var nav = document.querySelector('[data-route="cast"]');
      if (nav) nav.click(); else location.href = location.pathname + '?s=cast';
      var toss = document.querySelector('#tossBtn');
      if (toss) setTimeout(function () { toss.focus({ preventScroll: true }); }, 260);
    });
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureCta);
  else ensureCta();
})();

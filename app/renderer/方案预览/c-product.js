(async () => {
  await Promise.resolve(window.__LIUYAO_DEPS);
  const $=s=>document.querySelector(s);
  CStorage.init(CApp);CStudy.init(CApp);CCases.init();CLessons.init(CApp);
  $('.almanac-card')?.setAttribute('aria-label','建除与宜忌');
  const lessonScene=()=>document.documentElement.classList.toggle('c-lesson-open',!$('#view-lesson').hidden);
  new MutationObserver(lessonScene).observe($('#view-lesson'),{attributes:true,attributeFilter:['hidden']});lessonScene();
  const lessonHeights=()=>{const view=$('#view-lesson');for(const [sel,name]of [['.lesson-bar','--c-lesson-title-h'],['.c-lesson-tools','--c-lesson-tools-h']]){const h=view.querySelector(sel)?.getBoundingClientRect().height;if(h)view.style.setProperty(name,h+'px')}};
  const lessonSize=new ResizeObserver(lessonHeights);lessonSize.observe($('#view-lesson'));
  new MutationObserver(()=>{const tools=$('.c-lesson-tools');if(tools)lessonSize.observe(tools);lessonHeights()}).observe($('#view-lesson'),{childList:true,subtree:true});
  // Every saved case and current plate shares the same optical alignment.
  let frame=0;
  function align(){
    for(const table of document.querySelectorAll('.plate6')){
      if(!table.getBoundingClientRect().width)continue;
      const titles=table.querySelectorAll('.plate6-head>.p6-col');
      for(const [i,selector] of [[0,'.p6-ben .p6-yao'],[1,'.p6-bian .p6-yao']]){
        const title=titles[i]?.querySelector('b'),line=table.querySelector(selector);if(!title||!line)continue;
        const cell=titles[i].getBoundingClientRect(),r=line.getBoundingClientRect();title.style.setProperty('--name-x',(r.left+r.width/2-cell.left)+'px');
      }
      for(const row of table.querySelectorAll('.plate6-row')){row.tabIndex=0;row.setAttribute('aria-label',row.textContent.trim().replace(/\s+/g,' '));}
    }
  }
  const soon=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(align)};
  new MutationObserver(soon).observe($('#caseDetail'),{childList:true,subtree:true});new MutationObserver(soon).observe($('#plateTableRows'),{childList:true});new ResizeObserver(soon).observe($('.main'));soon();
  function focusRow(row){
    const table=row.closest('.plate6'),on=!row.classList.contains('c-focused-row');table.querySelectorAll('.c-focused-row').forEach(e=>e.classList.remove('c-focused-row'));
    table.querySelector('.c-row-inspector')?.remove();if(!on)return;
    row.classList.add('c-focused-row');const inspector=document.createElement('div');inspector.className='c-row-inspector';inspector.setAttribute('role','status');
    for(const sel of ['.p6-beast','.p6-ben','.p6-movecol','.p6-bian']){const src=row.querySelector(sel);if(!src)continue;const s=document.createElement('span');s.textContent=src.innerText.replace(/\s+/g,' ').trim();inspector.append(s)}table.append(inspector);
  }
  document.addEventListener('click',e=>{const row=e.target.closest('.plate6-row');if(row)focusRow(row);if(e.target.closest('#lessonImg')){const img=$('#lessonImg');CUI.dialog('配图','<img class="c-image-detail" src="'+CUI.esc(img.src)+'" alt="'+CUI.esc($('#lessonTitle').textContent)+'">');}});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.plate6-row')){e.preventDefault();focusRow(e.target)}});
  // Preview builds have no remote updater. Remove the simulated success panel.
  $('#checkUpdate')?.closest('.set-block')?.remove();
  document.documentElement.dataset.cProductReady='true';
})().catch(e=>{document.documentElement.dataset.jsError=e.message;console.error('C product',e)});

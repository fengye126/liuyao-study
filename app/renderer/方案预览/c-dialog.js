window.CUI = (() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function dialog(title,html,actions=[]){
    const el=document.createElement('dialog');el.className='c-dialog';el.innerHTML=`<form method="dialog"><header><h2>${esc(title)}</h2><button class="icon-btn" value="cancel" formnovalidate aria-label="关闭">×</button></header><div class="c-dialog-body">${html}</div><footer>${actions.map(a=>`<button type="submit" class="btn${a.primary?' btn-primary':''}" value="${esc(a.value)}" ${a.value==='cancel'?'formnovalidate':''}>${esc(a.label)}</button>`).join('')}</footer></form>`;
    document.body.append(el);const origin=document.activeElement;
    el.addEventListener('click',e=>{if(e.target===el){const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el.close('cancel')}});
    const result=new Promise(resolve=>el.addEventListener('close',()=>{resolve({value:el.returnValue,form:el.querySelector('form')});setTimeout(()=>el.remove(),0);if(origin?.isConnected)origin.focus({preventScroll:true})},{once:true}));
    el.showModal();return {el,result};
  }
  async function confirm(title,text,label='确定'){const d=dialog(title,'<p>'+esc(text)+'</p>',[{value:'cancel',label:'取消'},{value:'confirm',label,primary:true}]);return (await d.result).value==='confirm'}
  return {esc,dialog,confirm};
})();

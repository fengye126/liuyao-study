window.CCases = (() => {
  const esc=s=>window.CUI.esc(s),when=t=>new Date(t).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});
  const history=c=>Array.isArray(c.resultHistory)?c.resultHistory:(c.result?[{id:'legacy',at:c.resultAt||null,text:c.result}]:[]);
  let active=null,practice=false;
  function decorate(c){
    active=c;practice=false;const host=document.querySelector('#caseDetail'),record=host.querySelector('.case-record');if(!record)return;
    const category=host.querySelector('.detail-cat');if(category){category.textContent=(c.cat||'卦例')+(c.gender?' · '+c.gender+'测':'');category.title=c.source||'书房记录';}
    host.querySelector('.detail-meta')?.remove();host.querySelector('.mp-head')?.remove();host.querySelector('.reader-annot-note')?.remove();host.querySelectorAll('.detail-top-right .pill').forEach(e=>e.remove());
    const status=c.outcomeStatus||(c.revisit?'pending':'observed'),feedback=history(c);
    const source=c.note||c.jingguo||'';
    record.innerHTML=`<section class="c-original"><h3>${c.note?'原断':'当时记录'}</h3><p>${esc(source||'尚未记录判断')}</p><div class="c-case-references"></div></section><section class="c-feedback"><h3>反馈${feedback.length?' · '+feedback.length:''}</h3>${feedback.length?feedback.map(e=>`<article class="c-feedback-entry"><time>${Number.isFinite(e.at)?esc(when(e.at)):'既有反馈'}</time><p>${esc(e.text)}</p></article>`).join(''):'<p class="c-muted">尚无反馈</p>'}<div class="c-followup">${status==='unverifiable'?'无法核实':c.revisit?(c.followUpAt?'计划回访 '+esc(c.followUpAt):'待回访'):'已反馈'}</div></section><section class="c-review"><button class="btn btn-sm" data-c-review-toggle>${c.reviewNote?'查看复盘':'写复盘'}</button><div class="c-review-edit" hidden><label for="cReviewNote">复盘</label><textarea id="cReviewNote" rows="5" placeholder="哪些判断得到验证，哪些依据需要修正">${esc(c.reviewNote||'')}</textarea><button class="btn btn-sm btn-primary" data-c-review-save>保存复盘</button></div></section>`;
    const attempts=window.CStudy?.attemptsFor('case:'+c.id)||[];if(attempts.length){const block=document.createElement('details');block.className='c-attempt-history';block.innerHTML=`<summary>练习记录 · ${attempts.length}</summary>${attempts.map(a=>`<article><time>${esc(when(a.at))}</time><p>${esc(a.text)}</p></article>`).join('')}`;record.append(block);}
    const editor=host.querySelector('#resultEditor'),row=editor?.querySelector('.result-editor-row');
    if(row){row.querySelector('.switch')?.remove();const fields=document.createElement('div');fields.className='c-feedback-fields';fields.innerHTML=`<label>状态<select id="cFeedbackStatus"><option value="pending">继续观察</option><option value="observed">已反馈</option><option value="unverifiable">无法核实</option></select></label><label>回访日期<input id="cFollowUpDate" type="date" value="${esc(c.followUpAt||'')}"></label>`;row.prepend(fields);fields.querySelector('select').value=status;}
    const button=host.querySelector('[data-edit-result]');if(button)button.textContent=feedback.length?'补充反馈':'补记结果';
    const actions=host.querySelector('.detail-top-right'),b=document.createElement('button');b.className='btn btn-sm';b.dataset.cPractice='';b.textContent='独立分析';actions?.prepend(b);
    const practise=document.createElement('section');practise.className='c-practice-panel';practise.hidden=true;practise.innerHTML='<label for="cPracticeText">我的分析</label><textarea id="cPracticeText" rows="9" placeholder="先写取用、依据与判断，再对照原记录"></textarea><div class="c-practice-actions"><button class="btn btn-primary" data-c-practice-compare>对照原记录</button><button class="btn" data-c-practice-cancel>退出练习</button></div>';record.before(practise);
    const stored=window.CStudy?.practiceDraft('case:'+c.id);if(stored)practise.querySelector('textarea').value=stored;
    window.CStudy?.renderCaseReferences(c.id,record.querySelector('.c-case-references'));
    host.querySelectorAll('[data-toggle-revisit]').forEach(e=>e.textContent=c.revisit?'结束回访':'重新回访');
  }
  function openEditor(){const editor=document.querySelector('#resultEditor');if(!editor)return;editor.hidden=false;const input=document.querySelector('#resultText');input.value='';input.placeholder='新增本次反馈，先前记录会保留';input.focus();}
  function saveFeedback(id){
    const input=document.querySelector('#resultText'),text=input.value.trim();if(!text){input.setAttribute('aria-invalid','true');input.focus();CApp.toast('请填写本次反馈');return;}
    const c=CApp.cases().find(c=>c.id===id);if(!c)return;
    const next={...c,resultHistory:history(c).concat({id:crypto.randomUUID(),at:Date.now(),text}),result:text,resultAt:Date.now(),outcomeStatus:document.querySelector('#cFeedbackStatus').value,followUpAt:document.querySelector('#cFollowUpDate').value};
    next.revisit=next.outcomeStatus==='pending';if(CApp.updateCase(next))CApp.toast('本次反馈已保存');
  }
  function setPractice(on){practice=on;const host=document.querySelector('#caseDetail');host.classList.toggle('c-practising',on);host.querySelector('.case-record').hidden=on;host.querySelector('.c-practice-panel').hidden=!on;host.querySelector('[data-edit-result]').hidden=on;if(on){host.querySelector('#resultEditor').hidden=true;host.querySelector('#cPracticeText').focus();}}
  function init(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-c-review-toggle],[data-c-review-save],[data-c-practice],[data-c-practice-compare],[data-c-practice-cancel]');if(!b||!active)return;
      if(b.hasAttribute('data-c-review-toggle')){const box=document.querySelector('.c-review-edit');box.hidden=!box.hidden;if(!box.hidden)box.querySelector('textarea').focus()}
      else if(b.hasAttribute('data-c-review-save')){const next={...active,reviewNote:document.querySelector('#cReviewNote').value.trim(),reviewAt:Date.now()};if(CApp.updateCase(next))CApp.toast('复盘已保存');}
      else if(b.hasAttribute('data-c-practice'))setPractice(true);
      else if(b.hasAttribute('data-c-practice-cancel'))setPractice(false);
      else{const text=document.querySelector('#cPracticeText').value.trim();if(!text){document.querySelector('#cPracticeText').focus();return}window.CStudy?.savePractice('case:'+active.id,text);setPractice(false);const own=document.createElement('section');own.className='c-my-comparison';own.innerHTML='<h3>我的分析</h3><p>'+esc(text)+'</p>';document.querySelector('.case-record').prepend(own);}
    });
    document.addEventListener('input',e=>{if(e.target.id==='cPracticeText'&&active)window.CStudy?.setPracticeDraft('case:'+active.id,e.target.value)});
  }
  return {decorate,openEditor,saveFeedback,init,history};
})();

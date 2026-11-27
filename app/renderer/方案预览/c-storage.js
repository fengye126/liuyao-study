/* Real, local snapshots. Portable files are the cross-device transport. */
window.CStorage = (() => {
  const keys=['liuyaoshu.proto.v1','liuyao.cases.v1','liuyao.cats.v1','liuyao-c-cast-drafts-v2','liuyao-c-cast-note','liuyao-c-learning-v1','liuyao-c-lessons-v1'];
  const format='liuyao-study-backup';let database,app;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=t=>new Date(t).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});
  const bytes=n=>n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(1)+' MB';
  function db(){return database||(database=new Promise((resolve,reject)=>{const r=indexedDB.open('liuyao-c-backups',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=null;reject(r.error||new Error('无法打开本机备份'))};}));}
  async function transaction(mode,run){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('snapshots',mode),s=t.objectStore('snapshots');let result;try{result=run(s)}catch(e){t.abort();reject(e);return}t.oncomplete=()=>resolve(result?.result??result);t.onerror=()=>reject(t.error||new Error('本机备份写入失败'));t.onabort=()=>reject(t.error||new Error('备份操作已取消'));});}
  async function list(){return (await transaction('readonly',s=>s.getAll())).sort((a,b)=>b.createdAt-a.createdAt);}
  function validate(v){
    if(!v||v.format!==format||v.version!==1||!v.data||typeof v.data!=='object'||Array.isArray(v.data))throw new Error('不是有效的六爻书房备份');
    if(!Number.isFinite(v.createdAt))throw new Error('备份时间无效');
    for(const [k,value] of Object.entries(v.data)){
      if(!keys.includes(k))throw new Error('备份包含未知的数据项');
      if(value!==null&&typeof value!=='string')throw new Error('备份数据格式不正确');
      if(value!==null&&k!=='liuyao-c-cast-note'){
        let parsed;try{parsed=JSON.parse(value)}catch{throw new Error('备份中的数据无法读取')}
        if(k==='liuyao.cases.v1'&&(!Array.isArray(parsed)||parsed.some(c=>!c||typeof c.id!=='string'||typeof c.q!=='string')))throw new Error('卦例数据不完整');
        if(k==='liuyaoshu.proto.v1'&&(!parsed||typeof parsed!=='object'||Array.isArray(parsed)))throw new Error('阅读设置数据无效');
        if(['liuyao-c-learning-v1','liuyao-c-lessons-v1','liuyao-c-cast-drafts-v2'].includes(k)&&(!parsed||typeof parsed!=='object'||Array.isArray(parsed)))throw new Error('笔记或草稿数据无效');
      }
    }
    if(!Object.hasOwn(v.data,'liuyao.cases.v1')||!Object.hasOwn(v.data,'liuyaoshu.proto.v1'))throw new Error('备份缺少卦例或阅读数据');
    return v;
  }
  function snapshot(){app?.flush();window.CFlushDraft?.();const data=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));if(window.CCaseJSON)data['liuyao.cases.v1']=window.CCaseJSON();return {format,version:1,createdAt:Date.now(),data};}
  async function create(reason='manual'){
    const value=snapshot(),record={...value,id:crypto.randomUUID(),reason};
    record.size=new Blob([JSON.stringify(value)]).size;
    await transaction('readwrite',s=>s.put(record));
    const rows=await list();if(rows.length>3)await transaction('readwrite',s=>{for(const old of rows.slice(3))s.delete(old.id)});
    await render();return record;
  }
  async function render(){
    const box=document.querySelector('#backupList');if(!box)return;
    try{const rows=await list();box.innerHTML=rows.length?rows.map(r=>`<div class="backup-row"><time>${escape(date(r.createdAt))}</time><span class="num">${bytes(r.size)}</span><button type="button" class="btn btn-sm" data-c-restore="${escape(r.id)}">恢复</button></div>`).join(''):'<p class="c-empty-inline">尚无备份</p>';
      const last=document.querySelector('#lastSync');if(last)last.textContent=rows[0]?date(rows[0].createdAt):'尚未创建';
    }catch(e){box.innerHTML='<p class="c-inline-error" role="status">'+escape(e.message)+'</p>';}
  }
  async function restore(value,{confirm=true,reload=true}={}){
    validate(value);
    const CASES='liuyao.cases.v1';
    const cases=JSON.parse(value.data[CASES]||'[]');
    if(confirm&&!await window.CUI.confirm('恢复数据备份？',`${date(value.createdAt)} · ${cases.length} 条卦例。当前数据会先自动备份。`,'恢复'))return false;
    await create('before-restore');
    const previousCases = window.CCaseJSON ? window.CCaseJSON() : localStorage.getItem(CASES);
    const previous=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
    window.CSuspendDraft?.();
    window.CRestoringData=true;
    try{
      /* 1) 卦例先写 IndexedDB：不受 localStorage 5MB 限制 */
      if(window.CCaseStore){
        await CCaseStore.saveAll(cases);
        try{localStorage.removeItem(CASES)}catch(e){}
      }else{
        /* 没有 IndexedDB 的极端环境才退回 localStorage（受 5MB 限制） */
        if(previousCases===null)localStorage.removeItem(CASES);
        if(cases.length)localStorage.setItem(CASES,JSON.stringify(cases));
      }
      /* 2) 其余小键走 localStorage（卦例键排除） */
      const small=keys.filter(k=>k!==CASES);
      for(const k of small)localStorage.removeItem(k);
      for(const k of small){const v=value.data[k]??null;if(v!==null)localStorage.setItem(k,v)}
    }catch(e){
      /* 回滚小键 + 回滚 IndexedDB 卦例 */
      try{
        const small=keys.filter(k=>k!==CASES);
        for(const k of small)localStorage.removeItem(k);
        for(const k of small){const v=previous[k];if(v!==null)localStorage.setItem(k,v)}
        if(window.CCaseStore&&previousCases){
          try{await CCaseStore.saveAll(JSON.parse(previousCases))}catch(err){}
        }
      }catch(err){}
      window.CRestoringData=false;window.CResumeDraft?.();
      throw new Error('恢复未完成，当前数据已保留：'+(e&&e.message?e.message:e));
    }
    if(reload)location.reload();
    return true;
  }
  async function restoreId(id){const value=await transaction('readonly',s=>s.get(id));if(!value)throw new Error('这份备份已不存在');return restore(value);}
  async function exportFile(){
    const value=snapshot();
    const pass=await askPassword('导出加密备份','导出');
    if(pass===null)return false;
    let payload=value;
    try{payload=await encryptBackup(value,pass)}catch(e){app?.toast('加密失败：'+e.message);return false}
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='六爻书房-'+new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(value.createdAt))+'.json';
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    app?.toast('已导出加密备份');
    return true;
  }
  async function importFile(file){
    if(!file)return false;
    if(file.size>30*1024*1024)throw new Error('文件过大，请选择书房导出的数据文件');
    let value;try{value=JSON.parse(await file.text())}catch{throw new Error('文件无法读取，请选择 JSON 备份')}
    if(value&&value.format===encFormat){
      const pass=await askPassword('输入备份密码','解密并恢复');
      if(pass===null)return false;
      value=await decryptBackup(value,pass);
    }
    return restore(validate(value));
  }
  /* ===== 备份加密：PBKDF2-SHA256(150k) + AES-GCM-256 ===== */
  const encFormat = 'liuyao-study-backup-enc';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64(bytes) { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(str) { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptBackup(value, pass) {
    if (!pass) throw new Error('密码不能为空');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
    return { format: encFormat, version: 1, createdAt: value.createdAt, kdf: 'PBKDF2-SHA256-150k', salt: b64(salt), iv: b64(iv), data: b64(ct) };
  }
  async function decryptBackup(payload, pass) {
    if (!payload || payload.format !== encFormat || payload.version !== 1) throw new Error('不是加密备份文件');
    const key = await deriveKey(pass, unb64(payload.salt));
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.data)); }
    catch (e) { throw new Error('密码不正确，或文件已损坏'); }
    return JSON.parse(dec.decode(plain));
  }
  function askPassword(title, confirm) {
    return new Promise(function (resolve) {
      var d = window.CUI.dialog(title, '<label for="cBkPass">备份密码</label><input id="cBkPass" type="password" autocomplete="new-password" placeholder="至少 6 位，自己记住">' +
        '<p class="c-muted" style="margin:6px 0 0;font-size:12px">忘记密码无法恢复；加密文件扩展名仍为 .json。</p>',
        [{ value: 'cancel', label: '取消' }, { value: 'ok', label: confirm || '确定', primary: true }]);
      d.result.then(function (res) {
        if (res.value !== 'ok' || !res.form) { resolve(null); return; }
        var pass = res.form.querySelector('#cBkPass').value;
        if (!pass || pass.length < 6) { app?.toast('密码至少 6 位'); resolve(null); return; }
        resolve(pass);
      });
    });
  }

  async function busy(button,fn){if(button.disabled)return;const old=button.textContent;button.disabled=true;button.textContent='处理中';try{await fn()}catch(e){app?.toast(e.message)}finally{button.disabled=false;button.textContent=old}}
  function init(api){
    app=api;const section=document.querySelector('#setSyncTitle')?.closest('section');if(!section)return;
    section.classList.add('c-data-settings');section.querySelector('#setSyncTitle').textContent='数据与备份';section.querySelector('.set-head p').textContent='导出文件可在另一台设备导入';
    section.querySelector('#deviceList').innerHTML='<div class="device"><span class="device-mark">本机</span><div class="device-info"><div class="device-name">当前书房</div><div class="device-meta">卦例、笔记与阅读位置</div></div><span class="device-state online">本机保存</span></div>';
    const createButton=section.querySelector('#syncNow');createButton.textContent='创建备份';createButton.dataset.cBackup='create';
    const pair=section.querySelector('#pairNew');pair.textContent='导出加密备份';pair.dataset.cBackup='export';
    const importButton=document.createElement('button');importButton.className='btn btn-sm';importButton.type='button';importButton.textContent='导入备份 / 解密';importButton.dataset.cBackup='import';pair.after(importButton);
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='cImportBackup';section.append(file);
    section.querySelector('.backup-head').innerHTML='<span>最近三份完整备份</span>';
    section.querySelectorAll('.qr-card,.sync-side-note').forEach(e=>e.remove());const side=section.querySelector('.sync-body>div:nth-child(2)');side?.remove();
    const last=section.querySelector('.last-sync>span');if(last)last.textContent='上次备份';
    document.querySelectorAll('.rail-sync-text').forEach(e=>e.textContent='本机保存');document.querySelectorAll('#railSync').forEach(e=>{e.title='数据与备份';e.dataset.tip='数据与备份'});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-c-backup],[data-c-restore]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.cRestore)busy(b,()=>restoreId(b.dataset.cRestore));else if(b.dataset.cBackup==='create')busy(b,async()=>{await create();app.toast('完整备份已保存')});else if(b.dataset.cBackup==='export')exportFile();else file.click();},true);
    file.addEventListener('change',()=>busy(importButton,async()=>{try{await importFile(file.files[0])}finally{file.value=''}}));render();
  }
  return {keys,list,create,render,snapshot,validate,restore,restoreId,exportFile,importFile,encryptBackup,decryptBackup,init};
})();

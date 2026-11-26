/* C preview: calendar, five-ring interaction and faithful book chart layout. */
window.CCore = (() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const terms=['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];
  const branches='子丑寅卯辰巳午未申酉戌亥'.split('');
  let calKey='',calValue;
  function calendar(engine,date){
    engine=engine||window.LiuYaoNS||window.LiuYao;
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const key=[v.year,v.month,v.day,v.hour,v.minute,v.second].join('-');
    if(key===calKey)return calValue;
    const s=engine.Solar.fromYmdHms(+v.year,+v.month,+v.day,+v.hour,+v.minute,+v.second),l=s.getLunar();
    const prev=l.getPrevJieQi(false),next=l.getNextJieQi(false),ns=next.getSolar();
    const nextStamp=Date.UTC(ns.getYear(),ns.getMonth()-1,ns.getDay(),ns.getHour()-8,ns.getMinute(),ns.getSecond());
    calKey=key;calValue={current:prev.getName(),next:next.getName(),nextTime:ns.toYmdHms(),nextStamp,
      solar:s.toYmd(),lunar:l.toString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),second:+v.second,hourNumber:+v.hour,minute:+v.minute};
    return calValue;
  }
  function readout(engine,almanac){
    try{
      const c=calendar(engine,new Date()),star=almanac?.valueOf(c.month.slice(-1),c.day.slice(-1));
      const put=(id,text)=>{const e=document.getElementById(id);if(e&&e.textContent!==text)e.textContent=text};
      put('wrJieqi',c.current);put('wrDate',`${c.solar}\n${c.year}年 ${c.month}月\n${c.day}日`);
      put('wrShichen',`${c.hour}时`);put('wrStar',`建除 · ${star||'—'}`);
      const left=Math.max(0,Math.floor((c.nextStamp-Date.now())/1000));
      put('cNextTerm',`${c.next} · ${Math.floor(left/86400)}天 ${String(Math.floor(left%86400/3600)).padStart(2,'0')}:${String(Math.floor(left%3600/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`);
      put('cWheelNext',`${c.next} · ${Math.floor(left/86400)}天 ${String(Math.floor(left%86400/3600)).padStart(2,'0')}:${String(Math.floor(left%3600/60)).padStart(2,'0')}`);
      put('cClock',`${String(c.hourNumber).padStart(2,'0')}:${String(c.minute).padStart(2,'0')}`);
      const ac=document.getElementById('acTitle');if(ac)ac.textContent=`今日值神 · ${star||'—'}`;
      if(star&&almanac?.star[star]){const info=almanac.star[star];put('acDao',info.tao);put('acMeaning',info.meaning);put('acYi',info.yi.join(' · '));put('acJi',info.ji.join(' · '));}
      window.CCalendarSnapshot=c;
    }catch(e){console.warn('calendar',e.message)}
  }
  function renderWheel(svg,almanac){
    if(!svg)return;
    let ticks='';for(let i=0;i<360;i++)ticks+=`<line x1="260" y1="${i%30===0?10:i%5===0?15:20}" x2="260" y2="25" transform="rotate(${i} 260 260)" class="w-tk${i%5===0?' w-tk5':''}"/>`;
    const gz=Array.from({length:60},(_,i)=>'甲乙丙丁戊己庚辛壬癸'[i%10]+branches[i%12]);
    const ring=(id,labels,r,period,reverse)=>`<g id="${id}" class="c-ring" style="--period:${period}s;--direction:${reverse?'reverse':'normal'};--sign:${reverse?-1:1}">${labels.map((s,i)=>`<g transform="rotate(${i*360/labels.length} 260 260)"><text x="260" y="${260-r}" text-anchor="middle" class="c-ring-text">${esc(s)}</text></g>`).join('')}</g>`;
    svg.innerHTML=`<circle cx="260" cy="260" r="252" class="c-wheel-disc"/><g id="ring-ticks" class="c-ring" style="--period:145s;--direction:normal">${ticks}</g>`+
      ring('ring-jz',gz,215,180,true)+ring('ring-jq',terms,177,150,false)+ring('ring-branch',branches,140,125,true)+ring('ring-zhi',almanac?.order||[],108,110,false)+
      [234,195,158,122,88].map(r=>`<circle cx="260" cy="260" r="${r}" class="w-ring-line"/>`).join('')+'<circle cx="260" cy="260" r="84" class="w-center"/>';
  }
  function moveWheel(angle){document.querySelector('#wheelSvg')?.style.setProperty('--drag',angle+'deg');const wrap=document.querySelector('#wheelWrap'),v=String(Math.round((angle%360+360)%360));wrap?.setAttribute('aria-valuenow',v);wrap?.setAttribute('aria-valuetext',v+'度；中心为实时历法');}
  function bindWheel(wrap,apply){
    if(!wrap)return;let active=false,start=0,base=0,last=0,lastTime=0,velocity=0,raf=0,angle=0;
    const position=e=>{const r=wrap.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI};
    const move=()=>{apply(angle);raf=0};
    wrap.addEventListener('pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;active=true;start=last=position(e);base=angle;lastTime=performance.now();velocity=0;cancelAnimationFrame(raf);wrap.setPointerCapture(e.pointerId);wrap.classList.add('is-drag');e.preventDefault()});
    wrap.addEventListener('pointermove',e=>{if(!active)return;const a=position(e),delta=((a-last+540)%360)-180,now=performance.now();angle+=delta;velocity=delta/Math.max(8,now-lastTime);last=a;lastTime=now;if(!raf)raf=requestAnimationFrame(move)});
    const release=()=>{if(!active)return;active=false;wrap.classList.remove('is-drag');cancelAnimationFrame(raf);let t=performance.now();const tick=now=>{const dt=Math.min(32,now-t);t=now;angle+=velocity*dt;velocity*=Math.pow(.92,dt/16.7);apply(angle);if(Math.abs(velocity)>.004)raf=requestAnimationFrame(tick);else raf=0};raf=requestAnimationFrame(tick)};
    wrap.addEventListener('pointerup',release);wrap.addEventListener('pointercancel',release);
    wrap.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();angle+=e.key==='ArrowLeft'?-15:15;apply(angle)}});
    wrap.setAttribute('aria-label','五环历法罗盘，可拖动旋转；中心显示北京时间当前历法');
    wrap.setAttribute('aria-valuemin','0');wrap.setAttribute('aria-valuemax','359');
  }
  const beast=/^(螣蛇|腾蛇|白虎|勾陈|勾陳|朱雀|青龙|青龍|玄武)/;
  const yao=/[▅━─—]+(?:[ \u3000]+[▅━─—]+)?/g;
  function parseRow(raw){
    const name=raw.trim().match(beast)?.[0];if(!name)return null;
    const shapes=[...raw.matchAll(yao)];if(!shapes.length)return null;
    const clean=raw.replace(/\s+/g,'');
    const data=[...clean.matchAll(/(父母|兄弟|子孙|子孫|妻财|妻財|官鬼)[甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥][金木水火土]/g)].map(m=>m[0]);
    if(!data.length)return null;
    let ben=data[0]||'',bian=shapes.length>1?(data.at(-1)||''):'';
    let fu='';if(data.length>shapes.length){fu=data[0];ben=data[1]||ben;}
    const boundary=shapes[1]?.index??raw.length;
    return {beast:name,ben,bian,fu,yin:/\s/.test(shapes[0][0]),byin:shapes[1]?/\s/.test(shapes[1][0]):false,
      moving:/[○〇×xX]→?/.test(raw),mark:raw.slice(0,boundary).match(/[世应應]/)?.[0]||'',bmark:raw.slice(boundary).match(/[世应應]/)?.[0]||'',raw};
  }
  function blocks(text,nameMap={}){
    const original=String(text||'').replace(/\r/g,'').split('\n'),lines=[];
    for(let i=0;i<original.length;i++){
      let line=original[i];
      if(beast.test(line.trim())&&line.trim().length<12){
        for(let j=0;j<5&&i+1<original.length;j++){
          const n=original[i+1].trim();
          if(beast.test(n)||n.length>60||(!n&&!original[i+2]?.match(yao)))break;
          if(n&& !/^[▅━─—○〇×→\s父母兄弟子孙孫妻财財官鬼甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥金木水火土世应應伏神]+$/.test(n))break;
          line+=' '+n;i++;
        }
      }
      lines.push(line);
    }
    const out=[],plain=[];
    const flush=()=>{if(plain.length){out.push({text:plain.join('\n')});plain.length=0}};
    for(let i=0;i<lines.length;i++){
      if(/主变卦|主變卦/.test(lines[i])&&Object.keys(nameMap).length){
        const title=lines[i],names=Object.keys(nameMap).sort((a,b)=>b.length-a.length).filter(n=>title.includes(n)).sort((a,b)=>title.indexOf(a)-title.indexOf(b));
        if(names.length){
          const data=[];let end=i;
          for(let j=i+1;j<Math.min(lines.length,i+32);j++){
            const s=lines[j].trim();if(s.length>40)break;
            if(s&& !/^(?:[○〇×■工二一三━─—▅\s]*)?(?:父母|兄弟|子孙|子孫|妻财|妻財|官鬼)/.test(s)&&!/^[○〇×■工二一三━─—▅\s]*$/.test(s))break;
            const m=s.match(/(父母|兄弟|子孙|子孫|妻财|妻財|官鬼)[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥已巴卵]{1,3}[金木水火土][世应應]?/g);
            if(m)data.push(...m);end=j;
            if(data.length===(names.length>1?12:6))break;
          }
          if(data.length===(names.length>1?12:6)){
            flush();const rows=Array.from({length:6},(_,r)=>{const ben=data[r*(names.length>1?2:1)],bian=names.length>1?data[r*2+1]:'';const a=nameMap[names[0]][5-r],b=names[1]?nameMap[names[1]][5-r]:a;return {beast:'',ben:ben.replace(/[世应應]/g,''),bian:bian.replace(/[世应應]/g,''),fu:'',yin:a==='0',byin:b==='0',mark:ben.match(/[世应應]/)?.[0]||'',bmark:bian.match(/[世应應]/)?.[0]||'',moving:a!==b,raw:ben+' '+bian}});
            out.push({chart:{title,meta:'',rows}});i=end;continue;
          }
        }
      }
      if(/六神/.test(lines[i])||beast.test(lines[i].trim())){
        const rows=[];let end=i;
        for(let j=i;j<Math.min(lines.length,i+19);j++){
          const row=parseRow(lines[j]);if(row){rows.push(row);end=j;}
          else if(rows.length&&lines[j].trim()&&!/六神|本.*卦|变.*卦|變.*卦/.test(lines[j]))break;
          if(rows.length===6)break;
        }
        if(rows.length===6){
          let title='',meta='';
          while(plain.length&&(!plain.at(-1).trim()||/宫[：:]|宮[：:]|干支[：:]|旬空/.test(plain.at(-1)))){
            const prev=plain.pop();if(/宫|宮/.test(prev))title=prev.trim();else if(prev.trim())meta=prev.trim();
          }
          flush();out.push({chart:{title,meta,rows}});i=end;continue;
        }
      }
      plain.push(lines[i]);
    }
    flush();return out;
  }
  function metrics(font){
    const spread=document.querySelector('#bookSpread');if(spread&&innerWidth<=900)spread.classList.add('is-single');
    const wasChart=spread?.classList.contains('is-chart');if(wasChart)spread.classList.remove('is-chart');
    const page=document.querySelector('#pageLeft'),cs=page?getComputedStyle(page):null,fs=font.size||18,lh=fs*(font.leading||1.9);
    const contentW=Math.max(120,(page?.clientWidth||innerWidth/2)-(parseFloat(cs?.paddingLeft)||28)-(parseFloat(cs?.paddingRight)||28));
    const areaH=page?.clientHeight||spread?.clientHeight||Math.max(80,innerHeight-124);
    const contentH=Math.max(24,areaH-(parseFloat(cs?.paddingTop)||28)-(parseFloat(cs?.paddingBottom)||28)-26);
    const cpl=Math.max(8,Math.floor(contentW/fs*.97)),lines=Math.max(1,Math.floor(contentH/lh));
    if(wasChart)spread.classList.add('is-chart');
    return {cpl,lines,lineH:lh,contentH,cpp:cpl*lines};
  }
  function paginate(text,m,isHead,nameMap){
    const pages=[],toc=[];let cur=[],curIndex=[],heads=[],used=0,cursor=0,start=0;
    const flush=()=>{if(cur.length)pages.push({paras:cur,heads,start,end:cursor,indexOnly:curIndex.length>0&&curIndex.every(Boolean)});cur=[];curIndex=[];heads=[];used=0;start=cursor};
    for(const block of blocks(text,nameMap)){
      if(block.chart){flush();validateChart(block.chart,nameMap);if(pages.length%2)pages.push({paras:[],heads:[],start:cursor,end:cursor});const a=cursor;cursor+=block.chart.rows.map(r=>r.raw||r.ben+r.bian).join('').length+(block.chart.title||'').length;pages.push({chart:block.chart,paras:[],heads:[],start:a,end:cursor},{continuation:true,paras:[],heads:[],start:a,end:cursor});start=cursor;continue;}
      const lines=block.text.split('\n').map(s=>s.trim()),indexSlots=new Set();let run=[];
      const finishRun=()=>{if(run.filter(i=>isHead(lines[i])).length>=4)run.forEach(i=>indexSlots.add(i));run=[];};
      lines.forEach((line,i)=>{if(!line)return;if(isHead(line)||/^第[一二三四五六七八九十\d]+册[：:]?/.test(line)||/^\d{1,4}$/.test(line))run.push(i);else finishRun();});finishRun();
      const joined=[];lines.forEach((line,i)=>{const prev=joined.at(-1);if(line&&prev&&prev.text.length>=18&&!/[。！？：；!?]$/.test(prev.text)&&!isHead(prev.text)&&!isHead(line))prev.text+=line;else if(line)joined.push({text:line,index:indexSlots.has(i)})});
      for(const token of joined){let p=token.text;const h=isHead(p);if(h){if(m.lines-used<3)flush();if(!token.index)toc.push({label:p,page:pages.length,offset:cursor});heads.push(p)}
        while(p.length){let available=Math.floor(m.lines-used-.5);if(available<1){flush();available=m.lines;}const chunk=p.slice(0,available*m.cpl);if(!cur.length)start=cursor;cur.push(chunk);curIndex.push(token.index);cursor+=chunk.length;used+=Math.ceil(chunk.length/m.cpl)+.55;p=p.slice(chunk.length);if(p.length)flush();}
      }
    }
    flush();return {pages,toc};
  }
  function chartHTML(c){
    const line=yin=>`<span class="bc-yao${yin?' yin':''}" aria-label="${yin?'阴爻':'阳爻'}"></span>`;
    const data=s=>`<span class="bc-rel">${esc(s.slice(0,2))}</span><span class="bc-najia">${esc(s.slice(2))}</span>`;
    const review=c.issues?.length?`<details class="bc-review"><summary aria-label="查看本段卦例原文">原文</summary><p>${esc(c.issues.join('；'))}</p><pre>${esc([c.title,c.meta,...c.rows.map(r=>r.raw)].filter(Boolean).join('\n'))}</pre></details>`:'';
    return `<div class="bc-title">${esc(c.title||'')}</div>${c.meta?`<p class="bc-meta">${esc(c.meta)}</p>`:''}<div class="bc-rows">${c.rows.map(r=>`<div class="bc-row"><span>${esc(r.beast)}</span><span class="bc-data">${data(r.ben)}${r.fu?`<small>伏 ${esc(r.fu)}</small>`:''}</span>${line(r.yin)}<span class="bc-mark">${esc(r.mark)}</span><span>${r.moving?'○→':''}</span>${r.bian?line(r.byin):'<span></span>'}<span class="bc-data">${data(r.bian)} <em class="bc-mark">${esc(r.bmark)}</em></span></div>`).join('')}</div>${review}`;
  }
  function chartPage(pages,index,spread){
    spread.dataset.page=String(index);
    spread.dataset.anchorStart=String(pages[index]?.start||0);spread.dataset.anchorEnd=String(pages[index]?.end||0);
    const c=pages[index]?.chart||(pages[index]?.continuation?pages[index-1]?.chart:null);
    spread.classList.toggle('is-chart',!!c);spread.querySelector('.book-chart')?.remove();
    if(!c)return false;
    const el=document.createElement('article');el.className='book-chart';el.setAttribute('aria-label','书中本变卦');el.innerHTML=`<div class="book-chart-pan">${chartHTML(c)}</div>`;spread.append(el);
    el.firstElementChild.dataset.fit='1';
    return true;
  }
  function nextPage(pages,current,dir,single){let n=Math.max(0,Math.min(pages.length-(single?1:2),current+dir*(single?1:2)));if(single&&pages[n]?.continuation)n+=dir;return Math.max(0,Math.min(pages.length-1,n));}
  function anchorOf(pages,index){const p=pages[index];return {offset:p?.start||0,quote:(p?.chart?.rows.map(r=>r.raw).join('')||p?.paras?.join('')||'').slice(0,36),chart:!!p?.chart};}
  function findAnchorPage(pages,anchor,fallback=0){
    if(!anchor||!Number.isFinite(anchor.offset))return Math.max(0,Math.min(pages.length-1,fallback||0));
    let found=pages.findIndex(p=>!p.continuation&&p.end>p.start&&p.start<=anchor.offset&&anchor.offset<p.end);
    if(found<0)found=Math.max(0,pages.findLastIndex(p=>!p.continuation&&p.start<=anchor.offset));
    return found;
  }
  function validateChart(c,nameMap={}){
    const issues=[],names=Object.keys(nameMap).filter(n=>c.title?.includes(n)).sort((a,b)=>c.title.indexOf(a)-c.title.indexOf(b));
    if(c.rows.length!==6)issues.push('原文未形成完整六爻');
    const gods=c.rows.map(r=>r.beast.replace('腾','螣').replace('龍','龙').replace('陳','陈')).filter(Boolean);
    if(gods.length&&new Set(gods).size!==6)issues.push('六神行需对照原文');
    if(names[0]&&c.rows.some((r,i)=>r.yin!==(nameMap[names[0]][5-i]==='0')))issues.push('本卦爻形与卦名不一致');
    if(names[1]&&c.rows.some((r,i)=>r.bian&&r.byin!==(nameMap[names[1]][5-i]==='0')))issues.push('变卦爻形与卦名不一致');
    if(c.rows.some(r=>r.bian&&r.moving!==(r.yin!==r.byin)))issues.push('动爻标记与本变爻形需核对');
    c.issues=issues;return issues;
  }
  return {calendar,readout,renderWheel,moveWheel,bindWheel,blocks,parseRow,metrics,paginate,chartPage,nextPage,chartHTML,anchorOf,findAnchorPage,validateChart};
})();

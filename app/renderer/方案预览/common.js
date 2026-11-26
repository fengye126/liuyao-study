(() => {
  const doc = document.documentElement;
  const plate = document.getElementById('plate');
  const cast = document.getElementById('view-cast');
  const castHead = cast?.querySelector('.view-head');
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn proposal-edit';
  edit.textContent = '返回修改';
  edit.addEventListener('click', () => {
    doc.classList.remove('proposal-plate-active');
    cast.querySelector('#castPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  if (doc.dataset.proposal === 'C' && plate) {
    const actions = document.createElement('div');
    actions.className = 'proposal-plate-actions';
    plate.append(actions);
    const saveStrip = document.getElementById('saveStrip');
    if (saveStrip) actions.append(saveStrip);
    actions.append(edit);
  } else castHead?.append(edit);
  const syncPlate = () => {
    if (plate && !plate.hidden && !doc.classList.contains('proposal-plate-editing')) {
      const newlyActive = !doc.classList.contains('proposal-plate-active');
      doc.classList.add('proposal-plate-active');
      if (newlyActive && doc.dataset.proposal === 'C') requestAnimationFrame(() => plate.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  };
  new MutationObserver(() => {
    if (plate?.hidden) {
      doc.classList.remove('proposal-plate-active', 'proposal-plate-editing');
    } else if (!doc.classList.contains('proposal-plate-editing')) syncPlate();
  }).observe(plate, {attributes:true,attributeFilter:['hidden']});
  edit.addEventListener('click', () => doc.classList.add('proposal-plate-editing'));
  document.querySelectorAll('#castAgain,#resetBtn').forEach(b => b.addEventListener('click', () => doc.classList.remove('proposal-plate-active','proposal-plate-editing')));
  syncPlate();

  // A quiet physical bezel supplies visible motion without moving the
  // calendar rings away from the current values at the fixed pointer.
  const wheel = document.getElementById('wheelWrap');
  wheel?.setAttribute('aria-label','实时历法罗盘：指针指向当前值神、日干支与节气；外圈缓慢转动。拖拽预览其他时刻');
  const leftCards=document.getElementById('hpCol1'),rightCards=document.getElementById('hpCol2');
  if(leftCards&&rightCards){
    leftCards.append(document.getElementById('homeRevisit'));
    rightCards.prepend(document.getElementById('homeCastCta'));
  }
  const mark = document.createElement('div');
  mark.className = 'proposal-caption';
  mark.textContent = ({A:'案卷书房',B:'观象仪台',C:'静读书院'})[doc.dataset.proposal] + ' · 设计预览';
  document.getElementById('view-home')?.prepend(mark);

  // The reading controls themselves take the place of the global clock bar.
  const syncReader = () => doc.classList.toggle('proposal-reading', !document.getElementById('view-reader')?.hidden);
  new MutationObserver(syncReader).observe(document.getElementById('view-reader'), {attributes:true,attributeFilter:['hidden']});
  syncReader();

  // Make the media lesson's written record the reading surface. If the
  // transcript is still absent, the v6 empty state stays explicit.
  const lesson = document.getElementById('lessonText');
  if (lesson) {
    lesson.setAttribute('role','document');
    lesson.setAttribute('aria-label','录音转写阅读页');
  }
})();

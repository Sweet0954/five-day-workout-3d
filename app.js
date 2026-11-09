(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const canvas = $('scene');
  const scene = PushupScene.setup(canvas);
  const scrub = $('scrub');
  const {days,exercises}=Workouts;
  const variants = all('[data-variant]');
  const views = all('[data-view]');
  const steps = all('[data-step]');
  const sideButtons=all('[data-side]');
  const state = { progress:0, variant:'standard', error:'none', guides:true, muscles:true, rig:null, side:1 };
  let dayIndex=0, exerciseId='incline', current=exercises.incline;
  const keyframes = [0,.29,.54,.79];
  const pushupPhases = [
    {
      title:'准备支撑', breath:'自然呼吸',
      text:'掌根压稳，脚尖撑地。收紧腹部和臀部，让头、肩、髋和脚跟保持一条斜线。',
      cues:['双手比肩略宽，五指张开。','视线落在台面，后颈保持自然。'],
      narrow:'手距比标准略窄，保持掌根贴稳。'
    },
    {
      title:'控制下放', breath:'下放时吸气',
      text:'有控制地弯肘，让胸口和髋部一起下降。保持后颈自然，手掌和脚尖留在原位。',
      cues:['肘部向后斜移，避免向两侧撑开。','上臂与躯干约 45° 可作为方向提示。'],
      narrow:'让肘部沿身体两侧向后移，别用力夹紧。'
    },
    {
      title:'底部停顿', breath:'自然过渡',
      text:'胸口接近台沿时短暂停住。只降到还能维持对线、肩和手腕舒服的深度。',
      cues:['下巴微收，别先把头探向台面。','不要靠胸口撞台面来反弹。']
    },
    {
      title:'推回起点', breath:'推起时呼气',
      text:'双掌向下推台面，胸和髋一起抬起。回到手臂自然伸展的位置，继续稳住躯干。',
      cues:['肩膀远离耳朵，避免耸肩。','不要先抬胸再用腰带起髋部。']
    }
  ];
  const pushupComparisons = {
    none:['标准动作','选一种常见错误，比较它和标准姿势的差别。'],
    sag:['错误示范 · 塌腰','髋部掉到对线下方。收紧腹部和臀部；维持不了时，把支撑面升高。'],
    flare:['错误示范 · 肘外张','肘部几乎横向打开。让肘朝身体后侧斜移，窄距时可以更靠近躯干。'],
    neck:['错误示范 · 探头','头先伸向台沿，后颈折曲。下巴微收，让胸口带动身体靠近台沿。']
  };
  const standardComparison=['标准动作','选一种常见错误，比较它和标准姿势的差别。'];
  const sideLabels={
    训练手:['左手划','右手划'], 后撤腿:['左腿后撤','右腿后撤'],
    提膝腿:['左腿提膝','右腿提膝'], 负重手:['左手持铃','右手持铃']
  };
  let playing=false, frame=0, lastTime=null, displayKey='', comparisons={};
  const phaseProgress = () => state.rig==='march' && state.progress<1 ? state.progress*2%1 : state.progress;
  const phaseIndex = () => {
    const progress=phaseProgress();
    return progress < .085 || progress >= .97 ? 0 : progress < .48 ? 1 : progress <= .60 ? 2 : 3;
  };

  function pressed(group, key, value) {
    for(const button of group) button.setAttribute('aria-pressed',String(button.dataset[key] === String(value)));
  }
  function updateCoach() {
    const i = phaseIndex();
    const progress=phaseProgress();
    const firstSide=state.rig!=='march'||state.progress<.5;
    $('prev').disabled = i === 0 && progress < .085 && firstSide;
    $('next').disabled = i === 3 && (state.rig!=='march'||!firstSide);
    const key = exerciseId+':'+i;
    if(key === displayKey) return;
    displayKey=key;
    const p = (current.phases||pushupPhases)[i];
    $('step-count').firstChild.nodeValue = '0'+(i+1)+' ';
    $('step-title').textContent = p.title;
    $('step-description').textContent = p.text;
    $('breath').textContent = p.breath;
    const cues = cuesFor(p,i);
    $('step-cues').replaceChildren(...cues.map(text=>{
      const li=document.createElement('li');li.textContent=text;return li;
    }));
    pressed(steps,'step',i);
  }
  function update() {
    scrub.value=String(Math.round(state.progress*1000));
    $('progress').value=Math.round(state.progress*100)+'%';
    updateCoach();
    scene.draw(state);
  }
  function requestDraw() {
    if(!frame) frame=requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=0;
    if(playing) {
      if(lastTime!==null) state.progress=(state.progress + Math.min(110,now-lastTime)*Number($('speed').value)/(current.duration||4800))%1;
      lastTime=now;
    }
    update();
    if(playing) requestDraw();
  }
  function play(value) {
    playing=value;
    if(value && state.progress >= .999) state.progress=0;
    lastTime=null;
    $('play-label').textContent=value?'暂停':'播放';
    $('play').setAttribute('aria-label',value?'暂停动作':'播放动作');
    $('play-icon').setAttribute('href',value?'#i-pause':'#i-play');
    requestDraw();
  }
  function go(i,half=state.progress>=.5?1:0) {
    const frame=keyframes[Math.max(0,Math.min(3,i))];
    state.progress=state.rig==='march'?(half+frame)/2:frame;
    play(false);
  }
  function stepBy(direction) {
    const i=phaseIndex();
    const half=state.progress>=.5?1:0;
    if(direction<0 && phaseProgress()>=.97) go(3,half);
    else if(state.rig==='march' && i===0 && direction<0 && half) go(3,0);
    else if(state.rig==='march' && i===3 && direction>0 && !half) go(0,1);
    else go(i+direction,half);
  }
  function setView(name) {
    scene.view(name,state.rig);
    pressed(views,'view',name);
    requestDraw();
  }
  function setError(error) {
    const changed = error!==state.error;
    state.error=error;
    pressed(all('#error-control button'),'error',error);
    $('scene-mode').lastChild.nodeValue=' '+comparisons[error][0];
    $('scene-mode').dataset.error=String(error!=='none');
    $('compare-note').textContent=comparisons[error][1];
    if(changed && error!=='none') go(2);
    else requestDraw();
  }
  function cuesFor(phase,index) {
    if(state.variant!=='narrow'||!phase.narrow) return phase.cues;
    return index===0?[phase.narrow,phase.cues[1]]:[phase.cues[0],phase.narrow];
  }
  function makeButton(text,key,value) {
    const button=document.createElement('button');
    button.type='button';
    button.textContent=text;
    button.dataset[key]=value;
    return button;
  }
  function makeText(tag,text,className) {
    const element=document.createElement(tag);
    element.textContent=text;
    if(className) element.className=className;
    return element;
  }
  const pushupCaution=$('caution').textContent;
  function renderStandards() {
    $('standards-title').textContent=current.name+' · 动作检查';
    $('exercise-equipment').textContent=current.gear+' · '+current.area;
    const note=$('exercise-note');
    note.hidden=!current.note;
    note.textContent=current.note||'';
    const phases=current.phases||pushupPhases;
    const cards=[0,1,3].map((index,n)=>{
      const p=phases[index];
      const article=document.createElement('article');
      article.append(makeText('span','0'+(n+1)+' / '+['准备','过程','还原'][n],'check-number'),
        makeText('h3',p.title),makeText('p',p.text+' '+cuesFor(p,index).join(' ')));
      return article;
    });
    $('checks').replaceChildren(...cards);
    $('caution').textContent=current.push?pushupCaution:
      '注意'+current.mistake+'。'+current.correction+
      (exerciseId==='singleRow'?' 开始前先确认支撑台稳固防滑。':'');
  }
  function renderComparisons() {
    comparisons=current.push ? pushupComparisons : {
      none:standardComparison,
      [current.error]:['错误示范 · '+current.mistake,current.correction]
    };
    const options=current.push?{none:'标准',sag:'塌腰',flare:'肘外张',neck:'探头'}:
      {none:'标准',[current.error]:current.mistake};
    $('error-control').replaceChildren(...Object.entries(options).map(([key,name])=>{
      const button=makeButton(name,'error',key);
      button.addEventListener('click',()=>setError(key));
      return button;
    }));
  }
  function selectExercise(id,preserveDemo=false) {
    exerciseId=id;
    current=exercises[id];
    state.rig=current.push?null:current.rig||id;
    state.variant=current.push||'standard';
    state.side=1;
    state.mistake=current.mistake;
    const dose=days[dayIndex].entries.find(entry=>entry[0]===id)?.[1];
    $('exercise-title').textContent=current.name;
    $('exercise-dose').textContent=dose?days[dayIndex].name+' · '+dose:'手距对照';
    $('muscle-note').textContent='橙色标出'+(current.muscles||'胸部与上臂后侧')+'。';
    $('grip-control').hidden=!current.push;
    $('side-control').hidden=!current.side;
    $('side-control').setAttribute('aria-label',current.side||'示范侧');
    if(current.side) sideButtons.forEach((button,i)=>{button.textContent=sideLabels[current.side][i];});
    canvas.setAttribute('aria-label',current.name+' 3D 动作示范，可用上方按钮选择视角。');
    pressed(variants,'variant',state.variant);
    pressed(sideButtons,'side',state.side);
    pressed(all('#exercise-list button'),'exercise',id);
    (current.phases||pushupPhases).forEach((phase,i)=>{steps[i].lastElementChild.textContent=phase.title;});
    renderStandards();
    renderComparisons();
    setError(preserveDemo?state.error:'none');
    if(!preserveDemo) {
      setView('three');
      go(0,0);
    }
  }
  function selectDay(index) {
    dayIndex=index;
    const {entries}=days[index];
    pressed(all('#weekdays button'),'day',index);
    $('exercise-list').replaceChildren(...entries.map(([id,dose],i)=>{
      const exercise=exercises[id];
      const button=makeButton('','exercise',id);
      button.append(makeText('span',String(i+1).padStart(2,'0'),'exercise-number'),
        makeText('span',exercise.name,'exercise-name'),makeText('strong',dose,'exercise-reps'));
      button.addEventListener('click',()=>{
        selectExercise(id);
        if(matchMedia('(max-width: 680px)').matches) $('lab').scrollIntoView({block:'start'});
      });
      return button;
    }));
    selectExercise(entries[0][0]);
  }
  $('weekdays').replaceChildren(...days.map(({name,area},i)=>{
    const button=makeButton('','day',i);
    button.append(makeText('strong',name),makeText('span',area));
    button.addEventListener('click',()=>selectDay(i));
    return button;
  }));
  for(const button of variants) button.addEventListener('click',()=>{
    selectExercise(button.dataset.variant==='narrow'?'narrow':'incline',true);
  });
  for(const button of views) button.addEventListener('click',()=>setView(button.dataset.view));
  for(const button of steps) button.addEventListener('click',()=>go(Number(button.dataset.step)));
  for(const button of sideButtons) button.addEventListener('click',()=>{
    state.side=Number(button.dataset.side);
    pressed(sideButtons,'side',state.side);
    requestDraw();
  });
  $('play').addEventListener('click',()=>play(!playing));
  $('prev').addEventListener('click',()=>stepBy(-1));
  $('next').addEventListener('click',()=>stepBy(1));
  $('reset-view').addEventListener('click',()=>setView('three'));
  $('zoom-in').addEventListener('click',()=>{scene.zoom(.14);requestDraw();});
  $('zoom-out').addEventListener('click',()=>{scene.zoom(-.14);requestDraw();});
  scrub.addEventListener('input',()=>{state.progress=Number(scrub.value)/1000;play(false);});
  for(const key of ['guides','muscles']) $(key).addEventListener('change',()=>{
    state[key]=$(key).checked;requestDraw();
  });

  let drag=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || drag) return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag || drag.id!==e.pointerId) return;
    scene.orbit(e.clientX-drag.x,e.clientY-drag.y);
    drag.x=e.clientX;drag.y=e.clientY;
    pressed(views,'view','');
    requestDraw();
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
    canvas.addEventListener(name,e=>{if(drag?.id===e.pointerId) drag=null;});
  document.addEventListener('keydown',e=>{
    if(e.code!=='Space' || e.altKey || e.ctrlKey || e.metaKey ||
      e.target.closest('button,input,select,textarea,label,a,[contenteditable]') ||
      !$('lab').matches(':hover')) return;
    e.preventDefault();if(!e.repeat) play(!playing);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden && playing) play(false);});
  new ResizeObserver(requestDraw).observe(canvas);
  selectDay(0);
})();

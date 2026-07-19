'use strict';
/* ============================================================
   GAME SCHOOL — 4 класи × 3 предмети (математика/мова/фізкультура)
   зростаючої складності + перерви з іграми подвір'я між уроками.
   Викликається і зі стандартного розділу-меню (окремий клас), і з
   лінійної історії (stage 2, класи 1-4 — класи 5-9 лишаються
   старим простим "зайди в школу" циклом).
   ============================================================ */
const rndInt=(a,b)=>a+Math.floor(Math.random()*(b-a+1));

function genMathProblem(grade){
  if(grade===1){
    if(Math.random()<0.5){ const a=rndInt(1,9), b=rndInt(0,9-a); return {q:`${a} + ${b}`,answer:a+b}; }
    const a=rndInt(1,10), b=rndInt(0,a); return {q:`${a} − ${b}`,answer:a-b};
  }
  if(grade===2){
    if(Math.random()<0.5){ const a=rndInt(10,40), b=rndInt(5,40); return {q:`${a} + ${b}`,answer:a+b}; }
    const a=rndInt(20,60), b=rndInt(5,a); return {q:`${a} − ${b}`,answer:a-b};
  }
  if(grade===3){ const a=rndInt(2,9), b=rndInt(2,9); return {q:`${a} × ${b}`,answer:a*b}; }
  // grade 4
  if(Math.random()<0.5){ const a=rndInt(11,19), b=rndInt(2,5); return {q:`${a} × ${b}`,answer:a*b}; }
  const b=rndInt(2,9), answer=rndInt(2,9); return {q:`${b*answer} ÷ ${b}`,answer};
}
function makeChoices(answer){
  const wrongs=new Set();
  while(wrongs.size<2){
    const w=answer+rndInt(1,4)*(Math.random()<0.5?-1:1);
    if(w!==answer&&w>=0) wrongs.add(w);
  }
  return [answer,...wrongs].sort(()=>Math.random()-0.5);
}
function mathChoiceRects(choices){
  const w=110,h=60,gap=20, totalW=choices.length*w+(choices.length-1)*gap, x0=(W-totalW)/2, y=H*0.55;
  return choices.map((c,i)=>({x:x0+i*(w+gap),y,w,h}));
}
function playMathLesson(grade,count){
  count=count||5;
  return new Promise(resolve=>{
    let idx=0, cur=null, choices=null, flashIdx=-1, flashT=0, wrong=false;
    G.busy=true;
    function nextProblem(){ cur=genMathProblem(grade); choices=makeChoices(cur.answer); wrong=false; }
    nextProblem();
    G.activity={
      update(dt){ if(flashT>0) flashT-=dt; },
      onTap(x,y){
        const rects=mathChoiceRects(choices);
        for(let i=0;i<rects.length;i++){
          const r=rects[i];
          if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){
            flashIdx=i; flashT=0.25;
            if(choices[i]===cur.answer){
              sfxGood(); idx++;
              if(idx>=count) return finish();
              setTimeout(nextProblem,350);
            } else { wrong=true; sfxBad(); }
            return;
          }
        }
      },
      render(){
        mgBg('#fde9d0','#e8b25a');
        mgTitle('➕ Математика · '+grade+' клас');
        mgProgress('Приклад '+(idx+1)+'/'+count);
        ctx.font='bold 34px "Courier New",monospace'; ctx.textAlign='center';
        ctx.fillStyle='#3a2b1a'; ctx.fillText(cur.q+' = ?',W/2,H*0.38);
        ctx.textAlign='left';
        mathChoiceRects(choices).forEach((r,i)=>{
          const active=flashT>0&&flashIdx===i;
          ctx.fillStyle=active?(choices[i]===cur.answer?'#bff2c9':'#ffb3b3'):'#ffffff';
          ctx.fillRect(r.x,r.y,r.w,r.h);
          ctx.strokeStyle='#3a2b00'; ctx.lineWidth=2; ctx.strokeRect(r.x,r.y,r.w,r.h);
          ctx.fillStyle='#3a2b1a'; ctx.font='bold 22px monospace'; ctx.textAlign='center';
          ctx.fillText(String(choices[i]),r.x+r.w/2,r.y+r.h/2+8);
          ctx.textAlign='left';
        });
        if(wrong) mgTapHint('Спробуй ще раз 🙂');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('➕ Математика — '+count+'/'+count+' ✓',1400).then(()=>resolve({game:'math'}));
    }
  });
}

/* ---------- банк речень для уроку письма, за класами ---------- */
const UA_SENTENCES={
  1:['мама мила раму.','кіт спить на килимку.','ми йдемо у парк.'],
  2:['лєна любить грати з друзями.','сонце світить дуже яскраво.','ми читаємо цікаву книгу.'],
  3:['у неділю ми ходили в кіно разом.','навесні в саду цвітуть яблуні.','наш клас переміг у конкурсі.'],
  4:['після школи ми з друзями пішли гуляти у двір.','я мрію стати доброю і розумною людиною.','разом ми завжди знайдемо вихід зі складної ситуації.'],
};
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

/* ---------- контролер уроків одного класу ---------- */
async function runSchoolGrade(grade){
  await showCard('🎒 '+grade+' клас — початок навчального року',1500);
  await playMathLesson(grade,4+grade);
  await runRecess();
  await playTypeSentence(pick(UA_SENTENCES[grade]||UA_SENTENCES[1]));
  await runRecess();
  await showCard('🤸 Фізкультура!',1200);
  await playRunningRace(80+grade*15);
  await playLongJump();
  await playBasketballHoop(3+Math.floor(grade/2));
  await showCard('🎒 '+grade+' клас закінчено ✓',1600);
}
async function runRecess(){
  await showCard('🔔 Перерва! Гра з друзями',1200);
  await pickRandomGames(1)[0].play();
}

/* ---------- Садочок: один візит = 2 випадкові гри подвір'я ---------- */
async function runSadokVisit(){
  await showCard('🧸 Ще один день у садочку!',1200);
  for(const g of pickRandomGames(2)){
    await showCard('Зіграймо: '+g.label+' 🙂',1000);
    await g.play();
  }
}

/* ---------- вхідні точки для розділів (menu.js) ---------- */
function returnToTitle(){
  G.active=false; G.map=null; G.mode=null; G.busy=true;
  setObj(''); G.target=null;
  $('mute').style.display='none';
  $('title').style.display='flex';
}
async function startSadokChapter(){
  initAudio();
  $('title').style.display='none';
  $('mute').style.display='flex';
  G.mode='sadok'; G.active=true; G.busy=false; G.adult=false;
  G.onZoneFn=null; G.refreshObjFn=()=>setObj('🧸 Садочок');
  G.map=MAPS.zhyl; spawnAt(5,12);
  await fadeIn();
  await runSadokVisit();
  await runSadokVisit();
  G.busy=true;
  await showCard('🧸 Розділ «Садочок» пройдено ❤️',1800);
  returnToTitle();
}
async function startSchoolChapter(grade){
  initAudio();
  $('title').style.display='none';
  $('mute').style.display='flex';
  G.mode='school'; G.active=true; G.busy=false; G.adult=false;
  G.onZoneFn=null; G.refreshObjFn=()=>setObj('🎒 '+grade+' клас');
  G.map=MAPS.zhyl; spawnAt(21,12);
  await fadeIn();
  await runSchoolGrade(grade);
  G.busy=true;
  await showCard('🎒 Розділ «'+grade+' клас» пройдено ✓',1800);
  returnToTitle();
}

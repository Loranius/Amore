'use strict';
/* ============================================================
   GAME MINIGAMES — 4 гри подвір'я: скакалка, класики, м'яч, хованки
   в кущах (крот).
   ------------------------------------------------------------
   Спільний принцип: async-функція playXxx() встановлює G.activity
   ({update,render,onTap,onKey}), яка бере на себе весь екран (движок
   у game-engine.js делегує їй update/render, поки вона є), і
   резолвить Promise, коли гравець досяг мети. Жодна з них не має
   "програшу" — це дитячі ігри для теплої історії, не аркада: якщо
   щось не вийшло чи вийшов час, гра просто лагідно завершується з
   підбадьорливою фразою.
   ============================================================ */
const SC=5; // масштаб спрайтів у міні-іграх (вони не прив'язані до тайлової камери)
const NPC_KIDS = [
  bakeKidVariant('#f2c14e','#6e4a2a'),
  bakeKidVariant('#7fd9c4','#3a2b1a'),
];

function mgBg(topColor,botColor){
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,topColor); gr.addColorStop(1,botColor);
  ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
}
function mgTitle(text){
  ctx.font='bold 20px "Courier New",monospace'; ctx.textAlign='center';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(10,12,24,.85)';
  ctx.strokeText(text,W/2,40); ctx.fillStyle='#ffe9a8'; ctx.fillText(text,W/2,40);
  ctx.textAlign='left';
}
function mgProgress(label){
  ctx.font='bold 15px "Courier New",monospace'; ctx.textAlign='center';
  ctx.lineWidth=3; ctx.strokeStyle='rgba(10,12,24,.85)';
  ctx.strokeText(label,W/2,66); ctx.fillStyle='#dfe3ff'; ctx.fillText(label,W/2,66);
  ctx.textAlign='left';
}
function mgTapHint(text){
  ctx.font='bold 14px "Courier New",monospace'; ctx.textAlign='center';
  ctx.globalAlpha=0.55+Math.sin(G.time*4)*0.25;
  ctx.fillStyle='#f7c94b'; ctx.fillText(text,W/2,H-28);
  ctx.globalAlpha=1; ctx.textAlign='left';
}

/* ============================================================
   1. СТРИБКИ НА СКАКАЛЦІ — тайминг-тап у ритм
   ============================================================ */
function playJumpRope(target){
  target=target||8;
  return new Promise(resolve=>{
    let successes=0, misses=0, t=0, jumpFlash=0, msg='';
    const period=1.1; // с на один оберт скакалки
    G.busy=true;
    G.activity={
      update(dt){ t+=dt; if(jumpFlash>0) jumpFlash-=dt; },
      onTap(){
        const phase=(t%period)/period; // 0..1, "низ" мотузки ~ 0
        const good=phase<0.16||phase>0.90;
        if(good){ successes++; jumpFlash=0.25; sfxGood(); spawnHeartsScreen(); msg='Є!'; }
        else { misses++; sfxBad(); msg='Зачепилась 😅'; }
        if(successes>=target) finish();
      },
      render(){
        mgBg('#8fd0f0','#5fa7d8');
        mgTitle('🪢 Стрибки на скакалці');
        mgProgress('Стрибки: '+successes+'/'+target+(misses?'  ·  ой: '+misses:''));
        const cx=W/2, groundY=H*0.72;
        // мотузка — дуга, що "змахує" знизу/зверху за period
        const phase=(t%period)/period;
        const ropeY=groundY-Math.sin(phase*Math.PI*2)*46-10;
        ctx.strokeStyle='#f2c14e'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(cx-70,groundY); ctx.quadraticCurveTo(cx,ropeY,cx+70,groundY); ctx.stroke();
        // кіт-дитина плигає (легкий підскок під час jumpFlash)
        const hop=jumpFlash>0?-14*(jumpFlash/0.25):0;
        const img=SP_KID[0][Math.floor(t*4)%2];
        ctx.drawImage(img,cx-img.width*SC/2,groundY-img.height*SC+hop,img.width*SC,img.height*SC);
        if(msg&&jumpFlash>0){ ctx.font='bold 16px monospace'; ctx.textAlign='center';
          ctx.fillStyle=successes?'#bff2c9':'#ffb3b3'; ctx.fillText(msg,cx,groundY-img.height*SC-10); ctx.textAlign='left'; }
        mgTapHint('Тапни, коли мотузка внизу ▼');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('🪢 Скакалка — супер! '+target+'/'+target,1400).then(()=>resolve({game:'rope',score:successes}));
    }
  });
}
function spawnHeartsScreen(){ spawnHearts(W/2,H*0.5,4,40); }

/* ============================================================
   2. КЛАСИКИ — кидок битки, стрибки по клітинках 1-10 (4-5 і 7-8
   поряд, здвоєні), розворот у "раю", підбір битки на зворотному шляху.
   Спрощено до одного повного проходу (не 10 раундів) — щоб влізти
   в той самий темп, що й інші ігри подвір'я.
   ============================================================ */
const CLASSICS_ROWS=[[1],[2],[3],[4,5],[6],[7,8],[9],[10]]; // знизу вгору, [0]="рай"
function classicsRowRect(r){
  const sw=64, sh=42, gap=3, groundY=H*0.86;
  const y=groundY-(r+1)*(sh+gap);
  const cells=CLASSICS_ROWS[r];
  if(cells.length===1) return [{x:W/2-sw/2,y,w:sw,h:sh,n:cells[0]}];
  const w2=sw*0.62;
  return [{x:W/2-w2-1,y,w:w2,h:sh,n:cells[0]},{x:W/2+1,y,w:w2,h:sh,n:cells[1]}];
}
function playClassics(){
  return new Promise(resolve=>{
    // playerRow: -1 = ще не стрибала (перед клітинкою 1); 0..7 — індекс рядка КЛАСИКИ_РЯДКИ.
    let phase='throw', playerRow=-1, stonePlaced=false, turnT=0, flashT=0;
    G.busy=true;
    G.activity={
      update(dt){
        if(flashT>0) flashT-=dt;
        if(phase==='turn'){ turnT-=dt; if(turnT<=0) phase='down'; }
      },
      onTap(){
        flashT=0.2;
        if(phase==='throw'){ stonePlaced=true; sfxGood(); phase='up'; return; }
        if(phase==='up'){
          playerRow++; sfxGood();
          if(Math.random()<0.4) spawnHeartsScreen();
          if(playerRow>=CLASSICS_ROWS.length-1){ phase='turn'; turnT=0.55; }
          return;
        }
        if(phase==='down'){
          if(playerRow>0){ playerRow--; sfxGood(); if(Math.random()<0.4) spawnHeartsScreen(); }
          else phase='pickup';
          return;
        }
        if(phase==='pickup'){
          stonePlaced=false; sfxTada(); spawnHeartsScreen();
          setTimeout(finish,500);
          phase='done';
        }
      },
      render(){
        mgBg('#8a8a92','#5f5f68');
        mgTitle('👣 Класики');
        const hint={throw:'Тапни, щоб кинути битку в 1 ▼',up:'Тапни — стрибай далі вгору ▲',
          turn:'Розворот у "раю"! 🔄',down:'Тапни — стрибай вниз ▼',pickup:'Тапни, щоб підняти битку ✊',done:''}[phase];
        mgProgress(phase==='throw'?'Кидок битки':'Клітинка '+(playerRow>=0?CLASSICS_ROWS[playerRow].join('-'):'старт'));
        for(let r=0;r<CLASSICS_ROWS.length;r++){
          for(const cell of classicsRowRect(r)){
            const active=flashT>0&&playerRow===r&&phase!=='throw';
            ctx.fillStyle=active?'#d8d0b8':'#76767e';
            ctx.fillRect(cell.x,cell.y,cell.w,cell.h);
            ctx.strokeStyle='#e9e2cf'; ctx.lineWidth=2; ctx.strokeRect(cell.x,cell.y,cell.w,cell.h);
            ctx.fillStyle='#2a2a30'; ctx.font='bold 15px monospace'; ctx.textAlign='center';
            ctx.fillText(String(cell.n),cell.x+cell.w/2,cell.y+cell.h/2+5); ctx.textAlign='left';
          }
        }
        if(stonePlaced){
          const c=classicsRowRect(0)[0];
          ctx.fillStyle='#5a4a34'; ctx.beginPath(); ctx.arc(c.x+c.w/2,c.y+c.h/2,7,0,Math.PI*2); ctx.fill();
        }
        // персонаж: outside(playerRow<0)/пікап — стоїть перед 1; інакше — у своєму рядку
        const standRow=playerRow<0||phase==='pickup'||phase==='done'?-1:playerRow;
        const rect=standRow<0?classicsRowRect(0)[0]:classicsRowRect(standRow)[0];
        const py0=standRow<0?rect.y+rect.h+30:rect.y+rect.h*0.5;
        const img=SP_KID[0][Math.floor(G.time*5)%2];
        ctx.drawImage(img,W/2-img.width*SC*0.5,py0-img.height*SC*0.7,img.width*SC*0.85,img.height*SC*0.85);
        if(hint) mgTapHint(hint);
      },
    };
    function finish(){
      G.activity=null; G.busy=false;
      showCard('👣 Класики — вдало пройдено! ✓',1400).then(()=>resolve({game:'classics'}));
    }
  });
}

/* ============================================================
   3. КИДАННЯ М'ЯЧЕМ — сила через тайминг
   ============================================================ */
function playBallThrow(throws){
  throws=throws||5;
  return new Promise(resolve=>{
    let hits=0, done=0, t=0, phase='aim', ball=null, msg='';
    G.busy=true;
    G.activity={
      update(dt){
        t+=dt;
        if(phase==='fly'&&ball){
          ball.t+=dt;
          const p=ball.t/ball.dur;
          if(p>=1){
            phase='result';
            setTimeout(()=>{
              done++;
              if(done>=throws) return finish();
              phase='aim'; ball=null; msg='';
            },700);
          }
        }
      },
      onTap(){
        if(phase!=='aim') return;
        const power=(Math.sin(t*3.4)+1)/2; // 0..1
        const hit=power>0.42&&power<0.72;
        if(hit){ hits++; sfxGood(); msg='У кошик! 🧺'; spawnHeartsScreen(); }
        else { sfxBad(); msg='Мимо 😅'; }
        phase='fly'; ball={t:0,dur:0.6,power,hit};
      },
      render(){
        mgBg('#fbe0a0','#e8b25a');
        mgTitle('🏀 Кидання м\'ячем');
        mgProgress('Кидки: '+done+'/'+throws+'  ·  влучань: '+hits);
        const groundY=H*0.75, cx=W*0.28, targetX=W*0.74;
        // ціль (кошик)
        ctx.fillStyle='#8a6f52'; ctx.fillRect(targetX-2,groundY-70,4,70);
        ctx.fillStyle='#e5471f'; ctx.fillRect(targetX-24,groundY-72,48,6);
        ctx.fillStyle='#dfe3ea'; ctx.fillRect(targetX-24,groundY-66,48,18);
        // дитина
        const img=SP_KID[2][0];
        ctx.drawImage(img,cx-img.width*SC/2,groundY-img.height*SC,img.width*SC,img.height*SC);
        if(phase==='aim'){
          const power=(Math.sin(t*3.4)+1)/2;
          ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(W/2-70,H-64,140,16);
          ctx.fillStyle='#f7c94b'; ctx.fillRect(W/2-68,H-62,136*power,12);
          ctx.strokeStyle='#3a2b00'; ctx.lineWidth=2; ctx.strokeRect(W/2-70,H-64,140,16);
          mgTapHint('Тапни, коли смужка в жовтій зоні ▲');
        } else if(phase==='fly'&&ball){
          const p=ball.t/ball.dur;
          const bx=cx+(targetX-cx)*p, by=groundY-img.height*SC*0.6-Math.sin(p*Math.PI)*(ball.hit?90:60)-(ball.hit?0:(p>0.6?(p-0.6)*160:0));
          ctx.fillStyle='#e8763a'; ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='#3a2b00'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2); ctx.stroke();
        } else if(phase==='result'){
          ctx.font='bold 18px monospace'; ctx.textAlign='center';
          ctx.fillStyle=hits?'#bff2c9':'#ffe9a8'; ctx.fillText(msg,W/2,H*0.4); ctx.textAlign='left';
        }
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('🏀 Влучань: '+hits+'/'+throws,1400).then(()=>resolve({game:'ball',score:hits}));
    }
  });
}

/* ============================================================
   4. ХОВАНКИ В КУЩАХ — гра типу "ударь крота": друзі на мить
   визирають із випадкового куща, тапни поки видно.
   ============================================================ */
function playHideSeek(count,seconds){
  count=count||5; seconds=seconds||22;
  return new Promise(resolve=>{
    const spots=[{x:0.18,y:0.62},{x:0.5,y:0.7},{x:0.82,y:0.6},{x:0.32,y:0.42},{x:0.68,y:0.45}]
      .map(s=>({...s,up:false,upT:0}));
    let found=0, timeLeft=seconds, spawnT=0.6;
    G.busy=true;
    G.activity={
      update(dt){
        timeLeft-=dt;
        if(timeLeft<=0) return finish();
        spawnT-=dt;
        if(spawnT<=0){
          const down=spots.filter(s=>!s.up);
          if(down.length){ const s=down[Math.floor(Math.random()*down.length)]; s.up=true; s.upT=0.85+Math.random()*0.45; }
          spawnT=0.5+Math.random()*0.5;
        }
        for(const s of spots) if(s.up){ s.upT-=dt; if(s.upT<=0) s.up=false; }
      },
      onTap(x,y){
        for(const s of spots){
          const sx=s.x*W, sy=s.y*H;
          if(Math.hypot(x-sx,y-sy)<38){
            if(s.up){ s.up=false; found++; sfxGood(); spawnHearts(sx,sy-20,5,26); if(found>=count) finish(); }
            else { sfxBlip(); toast('Нікого немає 🙂',450); }
            return;
          }
        }
      },
      render(){
        mgBg('#79c96b','#3f8a3a');
        mgTitle('🙈 Хованки в кущах');
        mgProgress('Знайдено: '+found+'/'+count+'  ·  час: '+Math.max(0,Math.ceil(timeLeft))+'с');
        for(const s of spots){
          const sx=s.x*W, sy=s.y*H;
          ctx.fillStyle='#2f6b33'; ctx.beginPath(); ctx.arc(sx,sy,30,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#3f8a43'; ctx.beginPath(); ctx.arc(sx-8,sy-10,16,0,Math.PI*2); ctx.arc(sx+10,sy-6,14,0,Math.PI*2); ctx.fill();
          if(s.up){
            const bounce=Math.sin(G.time*10)*2;
            const img=NPC_KIDS[0][0][0];
            ctx.drawImage(img,sx-img.width*SC/2,sy-img.height*SC+bounce,img.width*SC,img.height*SC);
          }
        }
        mgTapHint('Тапни, коли друг визирне з куща!');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('🙈 Знайдено: '+found+'/'+count,1400).then(()=>resolve({game:'hide',score:found}));
    }
  });
}

/** Реєстр усіх ігор подвір'я — для перерв у школі (випадковий вибір 1) і станцій кімнати садочка. */
const PLAYGROUND_GAMES=[
  {id:'rope',label:'Скакалка',play:()=>playJumpRope()},
  {id:'classics',label:'Класики',play:()=>playClassics()},
  {id:'ball',label:'М\'яч',play:()=>playBallThrow()},
  {id:'hide',label:'Хованки',play:()=>playHideSeek()},
];
function pickRandomGames(n){
  return [...PLAYGROUND_GAMES].sort(()=>Math.random()-0.5).slice(0,n);
}

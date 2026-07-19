'use strict';
/* ============================================================
   GAME MINIGAMES — 4 гри подвір'я: скакалка, квач, м'яч, хованки.
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
   2. ПЯТНАШКИ (КВАЧ) — доганялки
   ============================================================ */
function playTag(count,seconds){
  count=count||3; seconds=seconds||20;
  return new Promise(resolve=>{
    const W0=280,H0=180; // умовний "дворик" у власних координатах міні-гри
    const me={x:W0/2,y:H0/2};
    const kids=Array.from({length:count},(_,i)=>({
      x:40+((i*97)%(W0-80)), y:30+((i*53)%(H0-60)), tagged:false, spriteIdx:i%NPC_KIDS.length,
      wx:Math.random()*2-1, wy:Math.random()*2-1, wt:0,
    }));
    let tagged=0, timeLeft=seconds;
    G.busy=true;
    G.activity={
      update(dt){
        timeLeft-=dt;
        let vx=0,vy=0;
        if(keys['arrowleft']||keys['a']) vx-=1;
        if(keys['arrowright']||keys['d']) vx+=1;
        if(keys['arrowup']||keys['w']) vy-=1;
        if(keys['arrowdown']||keys['s']) vy+=1;
        if(joy.active){ vx=Math.abs(joy.dx)>0.15?joy.dx:0; vy=Math.abs(joy.dy)>0.15?joy.dy:0; }
        const l=Math.hypot(vx,vy);
        if(l>0.05){ vx/=Math.max(1,l); vy/=Math.max(1,l);
          me.x=clamp(me.x+vx*70*dt,10,W0-10); me.y=clamp(me.y+vy*70*dt,10,H0-10); }
        for(const k of kids){
          if(k.tagged) continue;
          k.wt-=dt;
          if(k.wt<=0){ k.wx=Math.random()*2-1; k.wy=Math.random()*2-1; k.wt=0.6+Math.random()*0.8; }
          // легка втеча від гравця + випадкове блукання
          const dx=k.x-me.x, dy=k.y-me.y, d=Math.hypot(dx,dy)||1;
          const flee=d<60?1:0;
          const mx=flee?dx/d:k.wx, my=flee?dy/d:k.wy;
          k.x=clamp(k.x+mx*40*dt,10,W0-10); k.y=clamp(k.y+my*40*dt,10,H0-10);
          if(d<12){ k.tagged=true; tagged++; sfxGood(); spawnHeartsScreen(); }
        }
        if(tagged>=count||timeLeft<=0) finish();
      },
      render(){
        mgBg('#8fce6a','#4f9e46');
        mgTitle('🏃 Пятнашки');
        mgProgress('Спіймано: '+tagged+'/'+count+'  ·  час: '+Math.max(0,Math.ceil(timeLeft))+'с');
        const ox=(W-W0*SC)/2, oy=(H-H0*SC)/2*1.1+30;
        const toScreen=(x,y)=>[ox+x*SC,oy+y*SC];
        for(const k of kids){
          if(k.tagged) continue;
          const [sx,sy]=toScreen(k.x,k.y);
          const img=NPC_KIDS[k.spriteIdx][2][0];
          ctx.drawImage(img,sx-img.width*SC/2,sy-img.height*SC,img.width*SC,img.height*SC);
        }
        const [px,py]=toScreen(me.x,me.y);
        const img=SP_KID[2][Math.floor(G.time*6)%2];
        ctx.drawImage(img,px-img.width*SC/2,py-img.height*SC,img.width*SC,img.height*SC);
        mgTapHint('Рухайся джойстиком/стрілками — торкнись дітей');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      const msg=tagged>=count?'🏃 Всіх спіймала!':'🏃 Весело побігали: '+tagged+'/'+count;
      showCard(msg,1400).then(()=>resolve({game:'tag',score:tagged}));
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
   4. ХОВАНКИ — знайди друзів у дворі
   ============================================================ */
function playHideSeek(count,seconds){
  count=count||3; seconds=seconds||25;
  return new Promise(resolve=>{
    const spots=[{x:0.18,y:0.62},{x:0.5,y:0.7},{x:0.82,y:0.6},{x:0.32,y:0.42},{x:0.68,y:0.45}];
    const chosen=[...spots].sort(()=>Math.random()-0.5).slice(0,count).map(s=>({...s,found:false}));
    let found=0, timeLeft=seconds;
    G.busy=true;
    G.activity={
      update(dt){ timeLeft-=dt; if(timeLeft<=0) finish(); },
      onTap(x,y){
        for(const s of chosen){
          if(s.found) continue;
          const sx=s.x*W, sy=s.y*H;
          if(Math.hypot(x-sx,y-sy)<38){ s.found=true; found++; sfxGood(); spawnHearts(sx,sy-20,5,26);
            if(found>=count) finish(); return; }
        }
      },
      render(){
        mgBg('#79c96b','#3f8a3a');
        mgTitle('🙈 Хованки');
        mgProgress('Знайдено: '+found+'/'+count+'  ·  час: '+Math.max(0,Math.ceil(timeLeft))+'с');
        for(const s of chosen){
          const sx=s.x*W, sy=s.y*H;
          if(s.found){
            const img=NPC_KIDS[0][0][0];
            ctx.drawImage(img,sx-img.width*SC/2,sy-img.height*SC,img.width*SC,img.height*SC);
          } else {
            ctx.fillStyle='#2f6b33'; ctx.beginPath();
            ctx.arc(sx,sy,30,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#3f8a43'; ctx.beginPath(); ctx.arc(sx-8,sy-10,16,0,Math.PI*2); ctx.arc(sx+10,sy-6,14,0,Math.PI*2); ctx.fill();
          }
        }
        mgTapHint('Тапай по кущах — там ховаються друзі');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('🙈 Знайдено: '+found+'/'+count,1400).then(()=>resolve({game:'hide',score:found}));
    }
  });
}

/** Реєстр усіх ігор подвір'я — для випадкового вибору 2 з 4 (Садочок) і перерв у школі. */
const PLAYGROUND_GAMES=[
  {id:'rope',label:'Скакалка',play:()=>playJumpRope()},
  {id:'tag',label:'Пятнашки',play:()=>playTag()},
  {id:'ball',label:'М\'яч',play:()=>playBallThrow()},
  {id:'hide',label:'Хованки',play:()=>playHideSeek()},
];
function pickRandomGames(n){
  return [...PLAYGROUND_GAMES].sort(()=>Math.random()-0.5).slice(0,n);
}

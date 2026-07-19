'use strict';
/* ============================================================
   GAME PE — фізкультура: біг навипередки, стрибки в довжину,
   кидок у кільце (перевикористовує playBallThrow з
   game-minigames.js — та сама механіка "сила через тайминг",
   просто інший привід і антураж).
   ============================================================ */

/* ============================================================
   1. БІГ НАВИПЕРЕДКИ — часті тапи розганяють, суперник біжить рівно
   ============================================================ */
function playRunningRace(distance){
  distance=distance||100;
  return new Promise(resolve=>{
    let me=0, rival=0, t=0, tapFlash=0;
    const rivalSpeed=distance/9; // фінішує рівно за ~9с базового темпу
    G.busy=true;
    G.activity={
      update(dt){
        t+=dt; if(tapFlash>0) tapFlash-=dt;
        rival=Math.min(distance,rival+rivalSpeed*dt);
        me=Math.max(0,me-6*dt); // легке "згасання" темпу між тапами — стимул тапати ритмічно
        if(me>=distance||rival>=distance) finish();
      },
      onTap(){ me=Math.min(distance,me+7.5); tapFlash=0.12; sfxBlip(); },
      render(){
        mgBg('#bfe3f2','#7fb8d8');
        mgTitle('🏃 Біг навипередки');
        const trackY1=H*0.42, trackY2=H*0.58, x0=40, x1=W-60;
        const toX=v=>x0+(x1-x0)*clamp(v/distance,0,1);
        ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x1,trackY1-20); ctx.lineTo(x1,trackY2+20); ctx.stroke();
        const imgMe=SP_KID[2][tapFlash>0?1:0];
        ctx.drawImage(imgMe,toX(me)-imgMe.width*SC/2,trackY1-imgMe.height*SC,imgMe.width*SC,imgMe.height*SC);
        const imgRi=NPC_KIDS[0][2][Math.floor(t*6)%2];
        ctx.drawImage(imgRi,toX(rival)-imgRi.width*SC/2,trackY2-imgRi.height*SC,imgRi.width*SC,imgRi.height*SC);
        mgTapHint('Тапай швидко й ритмічно — обжени подругу до фінішу!');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      const won=me>=rival;
      showCard(won?'🏅 Перша на фініші!':'🏃 Гарний забіг! Друга — теж чудово',1500)
        .then(()=>resolve({game:'run',won}));
    }
  });
}

/* ============================================================
   2. СТРИБКИ В ДОВЖИНУ — розгін тапами + стрибок в потрібний момент
   ============================================================ */
function playLongJump(){
  return new Promise(resolve=>{
    let phase='runup', speed=0, t=0, jumpT=0, dist=0, tapFlash=0, finished=false;
    G.busy=true;
    G.activity={
      update(dt){
        t+=dt; if(tapFlash>0) tapFlash-=dt;
        if(phase==='runup'){
          speed=Math.max(0,speed-1.2*dt);
          if(t>1.3) phase='takeoff'; // невелике вікно на відштовх після розгону
          if(t>1.65){ // не встигла тапнути в вікно — короткий, але зарахований стрибок
            dist=clamp(speed*0.4+Math.random()*0.15,0,1);
            phase='jump'; jumpT=0;
          }
        } else if(phase==='jump'){
          jumpT+=dt;
          if(jumpT>0.8&&!finished){ finished=true; finish(); }
        }
      },
      onTap(){
        if(phase==='runup'){ speed=Math.min(1,speed+0.22); tapFlash=0.12; sfxBlip(); }
        else if(phase==='takeoff'){
          dist=clamp(speed,0,1); phase='jump'; jumpT=0; sfxGood();
        }
      },
      render(){
        mgBg('#fbe0a0','#e8b25a');
        mgTitle('🤸 Стрибки в довжину');
        const groundY=H*0.72, x0=40, x1=W*0.62;
        ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(30,H-60,W-60,14);
        ctx.fillStyle='#f7c94b'; ctx.fillRect(32,H-58,(W-64)*speed,10);
        const runX=x0+(x1-x0)*Math.min(1,t/1.3);
        const jumpX=phase==='jump'?x1+(dist*140):runX;
        const jumpY=phase==='jump'?groundY-Math.sin(Math.min(1,jumpT/0.8)*Math.PI)*50:groundY;
        const img=SP_KID[2][phase==='runup'?(tapFlash>0?1:0):0];
        ctx.drawImage(img,jumpX-img.width*SC/2,jumpY-img.height*SC,img.width*SC,img.height*SC);
        if(phase==='runup') mgTapHint('Тапай, щоб розігнатись!');
        else if(phase==='takeoff') mgTapHint('ТАП зараз — відштовхнись! 🚀');
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      const cm=Math.round(120+dist*180);
      showCard('🤸 Стрибок: '+cm+' см!',1500).then(()=>resolve({game:'jump',score:cm}));
    }
  });
}

/** Кидок баскетбольного м'яча в кільце — та сама механіка, що й "кидання м'ячем" у дворі. */
function playBasketballHoop(throws){
  return playBallThrow(throws||4);
}

const PE_GAMES=[
  {id:'run',label:'Біг навипередки',play:()=>playRunningRace()},
  {id:'jump',label:'Стрибки в довжину',play:()=>playLongJump()},
  {id:'hoop',label:'Кидок у кільце',play:()=>playBasketballHoop()},
];

'use strict';
/* ============================================================
   GAME KEYBOARD — кастомна піксельна клавіатура (ЙЦУКЕН) для
   уроку української мови: надрукувати задане речення.
   ------------------------------------------------------------
   Некараюча логіка: клавіатура ПРИЙМАЄ лише правильну наступну
   літеру (натискання "не тієї" літери просто дає легкий "буп" і
   нічого не додає) — тож дитина ніколи не застрягає з купою
   помилок, які треба стирати; Backspace лишається для охайності,
   якщо схотілось перетапати слово.
   ============================================================ */
const UA_ROWS=[
  ['й','ц','у','к','е','н','г','ш','щ','з','х','ї'],
  ['ф','і','в','а','п','р','о','л','д','ж','є'],
  ['я','ч','с','м','и','т','ь','б','ю'],
];

function kbLayout(){
  const rows=UA_ROWS, kbTop=H*0.56, kbH=H*0.34, rowH=kbH/(rows.length+1);
  const keys=[];
  rows.forEach((row,ri)=>{
    const kw=Math.min(46,(W-20)/row.length-4);
    const totalW=row.length*(kw+4)-4, x0=(W-totalW)/2;
    row.forEach((ch,ci)=>{
      keys.push({x:x0+ci*(kw+4),y:kbTop+ri*rowH,w:kw,h:rowH-6,char:ch});
    });
  });
  const lastY=kbTop+rows.length*rowH;
  const spaceW=W*0.5, spaceX=(W-spaceW)/2-30;
  keys.push({x:spaceX,y:lastY,w:spaceW,h:rowH-6,char:' ',isSpace:true});
  keys.push({x:spaceX+spaceW+12,y:lastY,w:80,h:rowH-6,isBack:true});
  return keys;
}

function playTypeSentence(sentence){
  const target=sentence.toLowerCase();
  return new Promise(resolve=>{
    let typed='', flashKey=null, flashT=0, badFlash=0;
    G.busy=true;
    function pressChar(ch){
      const need=target[typed.length];
      if(ch===need){ typed+=ch; sfxBlip(); if(typed.length>=target.length) return finish(); }
      else { badFlash=0.18; sfxBad(); }
    }
    function backspace(){ if(typed.length){ typed=typed.slice(0,-1); sfxBlip(); } }
    G.activity={
      update(dt){ if(flashT>0) flashT-=dt; if(badFlash>0) badFlash-=dt; },
      onTap(x,y){
        for(const k of kbLayout()){
          if(x>=k.x&&x<=k.x+k.w&&y>=k.y&&y<=k.y+k.h){
            flashKey=k; flashT=0.12;
            if(k.isBack) backspace(); else pressChar(k.char);
            return;
          }
        }
      },
      onKey(k){
        if(k==='backspace'){ backspace(); return; }
        if(k===' '||k.length===1) pressChar(k===' '?' ':k.toLowerCase());
      },
      render(){
        mgBg('#eef2ff','#c7d2f0');
        mgTitle('✏️ Українська мова');
        ctx.font='16px "Courier New",monospace'; ctx.textAlign='center';
        const y=H*0.22;
        ctx.lineWidth=3; ctx.strokeStyle='rgba(10,12,24,.7)';
        ctx.strokeText(target,W/2,y); ctx.fillStyle='#3a2b1a'; ctx.fillText(target,W/2,y);
        // набраний префікс — підсвічений поверх
        const typedShown=typed+(badFlash>0?'▮':'');
        ctx.fillStyle=badFlash>0?'#ff5d5d':'#2f8a4a';
        ctx.fillText(typedShown,W/2,y+26);
        ctx.textAlign='left';
        for(const k of kbLayout()){
          const active=flashKey===k&&flashT>0;
          ctx.fillStyle=active?'#f7c94b':'#2a2e44';
          ctx.fillRect(k.x,k.y,k.w,k.h);
          ctx.strokeStyle='#101326'; ctx.lineWidth=2; ctx.strokeRect(k.x,k.y,k.w,k.h);
          ctx.fillStyle=active?'#3a2b00':'#dfe3ff';
          ctx.font='bold 14px "Courier New",monospace'; ctx.textAlign='center';
          ctx.fillText(k.isBack?'⌫':(k.isSpace?'␣':k.char),k.x+k.w/2,k.y+k.h/2+5);
          ctx.textAlign='left';
        }
      },
    };
    function finish(){
      G.activity=null; G.busy=false; sfxTada();
      showCard('✏️ Речення написано правильно!',1400).then(()=>resolve({game:'type'}));
    }
  });
}

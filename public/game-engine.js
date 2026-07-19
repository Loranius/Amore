'use strict';
/* ============================================================
   GAME ENGINE — спільний рушій (тайли/спрайти/рух/діалоги/фейди/
   серця/звук/інпут/головний цикл). Контент (карти, сюжет, школа,
   міні-ігри, меню) — в окремих game-*.js, завантажених після цього.
   ------------------------------------------------------------
   Немає бандлера — усі game-*.js звичайні class-script (не type=
   module), тож top-level const/function спільні між файлами через
   одну глобальну scope-область classic-скриптів. Порядок підключення
   в game.html важливий: engine → maps → playground/pe/keyboard →
   story → school → menu.
   ============================================================ */
const CFG = {
  her: 'Лєна',
  him: 'Діма',
  colors: {
    skin:       '#f2c9a0',
    herHair:    '#9c7a45',
    herTop:     '#5aa7e0',
    herSkirt:   '#f4f4f7',
    herDressKid:'#f2a5c0',
    himHair:    '#8f6d3e',
    himShirt:   '#6e4a2a',
    himPants:   '#3f7a3a',
    himEyes:    '#4a90d9',
  },
};

/* ---------- базові речі ---------- */
const TILE=16;
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);
const hudEl=$('hud'), dlg=$('dialog'), dwho=$('dwho'), dtext=$('dtext'),
      cardEl=$('card'), toastEl=$('toast'), fader=$('fader'),
      stickBase=$('stickBase'), stickKnob=$('stickKnob');
let W=0,H=0,Z=3;
function resize(){
  W=cv.width=innerWidth; H=cv.height=innerHeight;
  Z=Math.max(2,Math.floor(Math.min(W/(TILE*22),H/(TILE*14))));
  ctx.imageSmoothingEnabled=false;
}
addEventListener('resize',resize); resize();

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
/** [0,1) детермінований псевдо-рандом із seed (для повторюваних, але не збіжних раундів міні-ігор). */
function seededRandom(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

/* ---------- звук (WebAudio, без файлів) ---------- */
let AC=null, muted=false;
function initAudio(){ if(AC) return; try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} }
function tone(f,d=0.08,type='square',v=0.045,when=0){
  if(!AC||muted) return;
  const t=AC.currentTime+when, o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.value=f;
  g.gain.setValueAtTime(v,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g); g.connect(AC.destination);
  o.start(t); o.stop(t+d+0.03);
}
const sfxBlip =()=>tone(700,0.05,'square',0.03);
const sfxOk   =()=>[523,659,784].forEach((f,i)=>tone(f,0.09,'square',0.05,i*0.09));
const sfxTada =()=>[523,659,784,1046,1318].forEach((f,i)=>tone(f,0.14,'triangle',0.06,i*0.1));
const sfxLove =()=>[880,1046,1318].forEach((f,i)=>tone(f,0.12,'sine',0.05,i*0.07));
const sfxGood =()=>[659,880].forEach((f,i)=>tone(f,0.09,'triangle',0.05,i*0.08));
const sfxBad  =()=>[220,180].forEach((f,i)=>tone(f,0.14,'sawtooth',0.05,i*0.09));
$('mute').addEventListener('click',()=>{muted=!muted;$('mute').textContent=muted?'🔇':'🔊';});

/* ---------- спрайти людей (малюємо пікселями) ---------- */
function flipCanvas(c){
  const n=mkCanvas(c.width,c.height), g=n.getContext('2d');
  g.translate(c.width,0); g.scale(-1,1); g.drawImage(c,0,0); return n;
}
function P_(g,x,y,w,h,col){ g.fillStyle=col; g.fillRect(x,y,w,h); }

// dir: 0 вниз(обличчям), 1 вліво, 2 вправо, 3 вгору(спиною); f: 0/1 крок
function renderPerson(o,dir,f){
  if(dir===1) return flipCanvas(renderPerson(o,2,f));
  const kid=!!o.kid, w=kid?12:14, h=kid?15:20;
  const c=mkCanvas(w,h), g=c.getContext('2d');
  const SK=o.skin, HA=o.hair, TP=o.top;
  const eye=o.eye||'#241d1a', shoe='#3a2f28';
  if(kid){
    P_(g,0,3,2,4,HA); P_(g,10,3,2,4,HA);
    P_(g,2,0,8,7,SK);
    P_(g,2,0,8,2,HA);
    if(dir===3){ P_(g,2,0,8,6,HA); }
    else if(dir===0){ P_(g,4,3,1,1,eye); P_(g,7,3,1,1,eye); }
    else { P_(g,8,3,1,1,eye); P_(g,2,2,1,1,HA); }
    P_(g,3,7,6,4,TP); P_(g,2,10,8,3,TP);
    P_(g,2,7,1,3,SK); P_(g,9,7,1,3,SK);
    const lo=f?-1:0, ro=f?0:-1;
    P_(g,4,13+lo,2,2-lo,SK); P_(g,7,13+ro,2,2-ro,SK);
    P_(g,4,14,2,1,shoe); P_(g,7,14,2,1,shoe);
  } else {
    const dress=!!o.dress, PN=o.pants||'#31415e';
    if(o.longHair){ P_(g,2,6,2,6,HA); P_(g,10,6,2,6,HA); }
    P_(g,3,1,8,7,SK);
    P_(g,3,0,8,3,HA); P_(g,2,1,1,5,HA); P_(g,11,1,1,5,HA);
    if(dir===3){ P_(g,3,1,8,7,HA); }
    else if(dir===0){ P_(g,5,4,1,1,eye); P_(g,8,4,1,1,eye); }
    else { P_(g,9,4,1,1,eye); }
    if(dress){ const BT=o.bottom||TP; P_(g,3,8,8,4,TP); P_(g,2,12,10,3,BT); }
    else { P_(g,3,8,8,6,TP); P_(g,4,14,6,2,PN); }
    const ao=(f?1:0);
    P_(g,2,8+ao,1,4,TP); P_(g,11,8+(1-ao),1,4,TP);
    P_(g,2,12+ao,1,2,SK); P_(g,11,12,1,2,SK);
    const lo=f?-1:0, ro=f?0:-1;
    if(dress){
      P_(g,4,15+lo,2,3-lo,SK); P_(g,8,15+ro,2,3-ro,SK);
    } else {
      P_(g,4,15+lo,2,3-lo,PN); P_(g,8,15+ro,2,3-ro,PN);
    }
    P_(g,4,18,2,2,shoe); P_(g,8,18,2,2,shoe);
  }
  return c;
}
function renderKneel(o,dir){
  const c=mkCanvas(18,20), g=c.getContext('2d');
  const SK=o.skin, HA=o.hair, TP=o.top, PN=o.pants||'#31415e';
  P_(g,6,3,8,7,SK); P_(g,6,2,8,3,HA); P_(g,5,3,1,5,HA); P_(g,14,3,1,5,HA);
  P_(g,7,6,1,1,o.eye||'#241d1a');
  P_(g,6,10,8,6,TP);
  P_(g,2,11,5,2,TP); P_(g,1,11,2,2,SK);
  P_(g,0,9,2,2,'#f7c94b');
  P_(g,0,7,1,1,'#ffffff');
  P_(g,6,16,4,4,PN);
  P_(g,11,15,3,3,PN); P_(g,11,18,3,2,'#3a2f28');
  return dir===2?flipCanvas(c):c;
}
function bakePerson(o){
  const d={};
  for(let dir=0;dir<4;dir++){ d[dir]=[renderPerson(o,dir,0),renderPerson(o,dir,1)]; }
  return d;
}
const SP_KID = bakePerson({kid:true, skin:CFG.colors.skin, hair:CFG.colors.herHair, top:CFG.colors.herDressKid});
const SP_HER = bakePerson({skin:CFG.colors.skin, hair:CFG.colors.herHair, top:CFG.colors.herTop, bottom:CFG.colors.herSkirt, dress:true, longHair:true});
const SP_HIM = bakePerson({skin:CFG.colors.skin, hair:CFG.colors.himHair, top:CFG.colors.himShirt, pants:CFG.colors.himPants, eye:CFG.colors.himEyes});
const SP_HIM_KNEEL_L = renderKneel({skin:CFG.colors.skin,hair:CFG.colors.himHair,top:CFG.colors.himShirt,pants:CFG.colors.himPants,eye:CFG.colors.himEyes},1);
/** Друга дитяча паличка (для NPC-дітей у міні-іграх подвір'я/фізкультури) — інша сукня/колір. */
function bakeKidVariant(topColor,hairColor){
  return bakePerson({kid:true, skin:CFG.colors.skin, hair:hairColor||CFG.colors.himHair, top:topColor});
}

/* ---------- тайли ---------- */
const SOLID=new Set(['#','~','f','R']);
const hashT=(i,j)=>((i*7349+j*9151)>>>0)%97;

function drawTileAt(t,i,j,time){
  const x=i*TILE, y=j*TILE, n=hashT(i,j);
  switch(t){
    case '.': {
      ctx.fillStyle='#5f9e4c'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#548f44';
      if(n%3===0) ctx.fillRect(x+(n%13),y+(n%11),2,1);
      if(n%4===0) ctx.fillRect(x+((n*3)%13),y+((n*5)%13),1,2);
      if(n%23===0){
        const cols=['#f5f0f8','#f2c14e','#e0709a'];
        ctx.fillStyle=cols[n%3]; ctx.fillRect(x+5,y+6,2,2);
        ctx.fillStyle='#3f7a35'; ctx.fillRect(x+6,y+8,1,3);
      }
      break;
    }
    case '=': {
      ctx.fillStyle='#c9a36a'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#b48f57';
      if(n%3===0) ctx.fillRect(x+(n%12),y+(n%9),2,2);
      if(n%5===0) ctx.fillRect(x+((n*7)%12),y+((n*3)%12),2,1);
      break;
    }
    case '-': {
      ctx.fillStyle='#6e6e78'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#61616b';
      if(n%3===0) ctx.fillRect(x+(n%12),y+(n%12),2,1);
      ctx.fillStyle='#7d7d88';
      if(n%6===0) ctx.fillRect(x+((n*3)%12),y+((n*5)%12),1,1);
      break;
    }
    case '~': {
      ctx.fillStyle='#3f7fc1'; ctx.fillRect(x,y,16,16);
      const ph=(i+j*2+Math.floor(time*2))%5;
      if(ph===0){ ctx.fillStyle='#5a9ad8'; ctx.fillRect(x+3,y+7,7,2); }
      if(ph===2){ ctx.fillStyle='#356fae'; ctx.fillRect(x+8,y+3,5,2); }
      break;
    }
    case 's': {
      ctx.fillStyle='#e8d59a'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#d9c383';
      if(n%3===0) ctx.fillRect(x+(n%13),y+(n%13),2,1);
      if(n%7===0) ctx.fillRect(x+((n*5)%13),y+((n*3)%13),1,1);
      break;
    }
    case '#': {
      ctx.fillStyle='#5f9e4c'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#7a4a2b'; ctx.fillRect(x+6,y+9,4,6);
      ctx.fillStyle='#2f6b33';
      ctx.fillRect(x+1,y+2,14,9); ctx.fillRect(x+3,y,10,3); ctx.fillRect(x+3,y+10,10,2);
      ctx.fillStyle='#3f8a43';
      ctx.fillRect(x+3,y+2,7,4); ctx.fillRect(x+5,y+7,5,2);
      break;
    }
    case 'f': {
      ctx.fillStyle='#5f9e4c'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#a87848'; ctx.fillRect(x,y+6,16,3);
      ctx.fillStyle='#8f6039'; ctx.fillRect(x+2,y+4,3,9); ctx.fillRect(x+11,y+4,3,9);
      break;
    }
    case 'R': {
      ctx.fillStyle='#57503f'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#3b3428';
      ctx.fillRect(x+1,y+2,3,12); ctx.fillRect(x+6,y+2,3,12); ctx.fillRect(x+11,y+2,3,12);
      ctx.fillStyle='#b8bdc9';
      ctx.fillRect(x,y+4,16,2); ctx.fillRect(x,y+10,16,2);
      break;
    }
    case 'y': { // спортмайданчик (для школи-фізкультури): жовтогаряча гумова доріжка
      ctx.fillStyle='#c96a3f'; ctx.fillRect(x,y,16,16);
      ctx.fillStyle='#b85f37';
      if(n%4===0) ctx.fillRect(x+(n%13),y+(n%11),3,1);
      break;
    }
  }
}

/* ---------- будівлі та пропси ---------- */
function drawBuilding(b){
  const X=b.x*TILE, Y=b.y*TILE, Wd=b.w*TILE, Ht=b.h*TILE;
  const roofH=Math.max(10,(Ht*0.4)|0);
  ctx.fillStyle=b.wall; ctx.fillRect(X,Y+roofH,Wd,Ht-roofH);
  ctx.fillStyle='#bfe3f2';
  const doorPx=b.doorX*TILE;
  for(let wy=Y+roofH+3; wy<=Y+Ht-12; wy+=10){
    for(let wx=X+4; wx<=X+Wd-10; wx+=10){
      if(wy>Y+Ht-16 && wx>doorPx-8 && wx<doorPx+14) continue;
      ctx.fillRect(wx,wy,6,6);
      ctx.fillStyle='#8fb9cc'; ctx.fillRect(wx,wy+3,6,1); ctx.fillStyle='#bfe3f2';
    }
  }
  ctx.fillStyle='#6b4326'; ctx.fillRect(doorPx+4,Y+Ht-11,8,11);
  ctx.fillStyle='#f2c14e'; ctx.fillRect(doorPx+10,Y+Ht-6,1,2);
  ctx.fillStyle=b.roof; ctx.fillRect(X-1,Y,Wd+2,roofH);
  ctx.fillStyle='rgba(0,0,0,.22)'; ctx.fillRect(X-1,Y+roofH-2,Wd+2,2);
  ctx.fillStyle='#23232c';
  ctx.fillRect(X-1,Y-1,Wd+2,1); ctx.fillRect(X-1,Y+Ht-1,Wd+2,1);
  ctx.fillRect(X-1,Y,1,Ht); ctx.fillRect(X+Wd,Y,1,Ht);
}
function drawProp(p,time){
  const px=p.x*TILE, py=p.y*TILE;
  if(p.type==='bus'){
    ctx.fillStyle='#8b8f99'; ctx.fillRect(px+7,py+2,2,13);
    ctx.fillStyle='#3a6fd8'; ctx.fillRect(px+3,py,10,8);
    ctx.fillStyle='#eef2ff'; ctx.fillRect(px+4,py+1,8,6);
    ctx.fillStyle='#3a6fd8'; ctx.fillRect(px+5,py+3,6,3);
  }
  if(p.type==='stone'){
    const o='#6b5416';
    ctx.fillStyle=o;
    ctx.fillRect(px+4,py+2,24,2); ctx.fillRect(px+2,py+4,2,4); ctx.fillRect(px+28,py+4,2,4);
    ctx.fillRect(px,py+8,2,12); ctx.fillRect(px+30,py+8,2,12); ctx.fillRect(px+2,py+20,28,2);
    ctx.fillStyle='#e6b93f'; ctx.fillRect(px+4,py+4,24,4); ctx.fillRect(px+2,py+8,28,12);
    ctx.fillStyle='#f4d97e'; ctx.fillRect(px+6,py+5,10,3);
    ctx.fillStyle='#f2d06b'; ctx.fillRect(px+4,py+9,6,4);
    ctx.fillStyle='#c19a2e'; ctx.fillRect(px+18,py+14,10,5); ctx.fillRect(px+8,py+17,18,3);
    ctx.fillStyle='#a07f22'; ctx.fillRect(px+16,py+8,1,7);
    if(Math.floor(time*2)%2===0){ ctx.fillStyle='#ffffff'; ctx.fillRect(px+9,py+6,1,1); }
  }
  if(p.type==='umbrella'){
    ctx.fillStyle='#8a6f52'; ctx.fillRect(px+7,py+2,2,14);
    ctx.fillStyle='#ff5d8f'; ctx.fillRect(px+4,py-2,8,2);
    ctx.fillStyle='#fff4f8'; ctx.fillRect(px+2,py,12,2);
    ctx.fillStyle='#ff5d8f'; ctx.fillRect(px,py+2,16,2);
  }
  if(p.type==='swing'){
    ctx.fillStyle='#8a7a5a'; ctx.fillRect(px,py,2,16); ctx.fillRect(px+16,py,2,16);
    ctx.fillStyle='#5a4a34'; ctx.fillRect(px,py,18,2);
    ctx.fillStyle='#e0709a'; ctx.fillRect(px+7,py+13,4,2);
  }
  if(p.type==='hoop'){
    ctx.fillStyle='#8a7a5a'; ctx.fillRect(px+7,py,2,20);
    ctx.fillStyle='#e5471f'; ctx.fillRect(px-2,py+2,14,2);
    ctx.fillStyle='#dfe3ea'; ctx.fillRect(px-2,py+4,14,6);
  }
}

/* ---------- карти (примітиви — самі карти в game-maps.js) ---------- */
function mkGrid(w,h){return Array.from({length:h},()=>Array(w).fill('.'));}
function FR(g,x,y,w,h,c){for(let j=y;j<y+h;j++){if(!g[j])continue;for(let i=x;i<x+w;i++){if(g[j][i]!==undefined)g[j][i]=c;}}}
function outlineG(g,c){const w=g[0].length,h=g.length;FR(g,0,0,w,1,c);FR(g,0,h-1,w,1,c);FR(g,0,0,1,h,c);FR(g,w-1,0,1,h,c);}
function Bd(m,id,x,y,w,h,label,wall,roof,doorKind){
  const b={id,x,y,w,h,label,wall,roof,doorX:x+Math.floor(w/2)};
  m.buildings.push(b);
  m.zones.push({id,kind:doorKind||'door',x:b.doorX,y:y+h,w:1,h:1,wasIn:false});
  return b;
}
function Zn(m,id,kind,x,y,w,h,label){ m.zones.push({id,kind,x,y,w,h,label,wasIn:false}); }
function Pr(m,type,x,y){ m.props.push({type,x,y}); }

const MAPS={};
function makeMap(id,name,w,h,bg,build){
  const m={id,name,w,h,g:mkGrid(w,h),buildings:[],zones:[],props:[],bg,solids:[]};
  build(m.g,m); MAPS[id]=m; return m;
}

/* ---------- стан гри ----------
   mode: 'story'|'sadok'|'school' — який контролер обробляє зони/HUD.
   active: чи можна рухатись (аналог старого stage>0, але не прив'язаний
   до конкретної лінійної стадії — так само вмикається й окремими
   розділами з меню). activity: поточна міні-гра (якщо є — займає весь
   екран і головний цикл делегує їй update/render). */
const G={mode:null,stage:0,sub:'',c:0,map:null,busy:true,follower:false,sunset:false,
  adult:false,time:0,target:null,active:false,activity:null,onZoneFn:null,refreshObjFn:null};
const P={x:0,y:0,dir:0,moving:false,animT:0,_mv:null};
const D={x:0,y:0,dir:1,moving:false,visible:false,kneel:false,animT:0,_mv:null};
let trail=[];
const cam={x:0,y:0};

function tileAt(px,py){
  const i=Math.floor(px/TILE), j=Math.floor(py/TILE);
  const row=G.map.g[j]; if(!row) return '#';
  const t=row[i]; return t===undefined?'#':t;
}
function solidPoint(px,py){
  if(SOLID.has(tileAt(px,py))) return true;
  for(const b of G.map.buildings){
    if(px>=b.x*TILE&&px<(b.x+b.w)*TILE&&py>=b.y*TILE&&py<(b.y+b.h)*TILE) return true;
  }
  for(const s of G.map.solids){
    if(px>=s.x&&px<s.x+s.w&&py>=s.y&&py<s.y+s.h) return true;
  }
  return false;
}
function canStand(x,y){
  return !(solidPoint(x-5,y-6)||solidPoint(x+4,y-6)||solidPoint(x-5,y-1)||solidPoint(x+4,y-1));
}
const zoneRectPx=z=>({x:z.x*TILE,y:z.y*TILE,w:z.w*TILE,h:z.h*TILE});
const pRect=()=>({x:P.x-5,y:P.y-6,w:10,h:7});

function stepActor(a,dt){
  if(!a._mv) return;
  const m=a._mv, dx=m.tx-a.x, dy=m.ty-a.y, dist=Math.hypot(dx,dy), step=m.speed*dt;
  if(dist<=step){ a.x=m.tx; a.y=m.ty; a.moving=false; const r=m.res; a._mv=null; r(); }
  else { a.x+=dx/dist*step; a.y+=dy/dist*step; a.moving=true; a.animT+=dt;
    a.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?2:1):(dy>0?0:3); }
}
const moveActor=(a,tx,ty,speed)=>new Promise(res=>{a._mv={tx,ty,speed:speed||55,res};});

/* ---------- UI-хелпери ---------- */
function setObj(t){ hudEl.style.display=t?'block':'none'; hudEl.textContent=t||''; }
function toast(t,ms){ toastEl.textContent=t; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>toastEl.classList.remove('show'),ms||1300); }
function showCard(t,ms){ return new Promise(r=>{ cardEl.innerHTML=t; cardEl.classList.add('show');
  setTimeout(()=>{ cardEl.classList.remove('show'); setTimeout(r,200); },ms||1400); }); }
function fadeOut(){ fader.style.opacity='1'; return wait(360); }
function fadeIn(){ fader.style.opacity='0'; return wait(360); }

let dState=null;
function say(who,text){
  return new Promise(res=>{
    dlg.style.display='block';
    if(who==='d'){ dwho.textContent=CFG.him; dwho.style.color='#7fa7f0'; }
    else if(who==='l'){ dwho.textContent=CFG.her; dwho.style.color='#ff8fb3'; }
    else { dwho.textContent='✦'; dwho.style.color='#c9cff0'; }
    dtext.textContent='';
    dState={full:text,i:0,done:false,res,tm:0};
    dState.tm=setInterval(()=>{
      if(!dState) return;
      dState.i++;
      dtext.textContent=dState.full.slice(0,dState.i);
      if(dState.i>=dState.full.length){ clearInterval(dState.tm); dState.done=true; }
    },16);
  });
}
function advanceDialog(){
  if(!dState) return false;
  if(!dState.done){ clearInterval(dState.tm); dtext.textContent=dState.full; dState.done=true; sfxBlip(); return true; }
  const r=dState.res; dState=null; dlg.style.display='none'; sfxBlip(); r(); return true;
}
async function sayAll(lines){ for(const ln of lines) await say(ln[0],ln[1]); }

/* ---------- сердечка ---------- */
let hearts=[];
function spawnHearts(x,y,n,spread){
  spread=spread||30;
  for(let k=0;k<n;k++) hearts.push({
    x:x+(Math.random()-0.5)*spread, y:y+(Math.random()-0.5)*14,
    vy:-(14+Math.random()*28), life:1.6+Math.random()*1.5, t:0,
    s:Math.random()<0.3?2:1, col:['#ff5d8f','#ff2e63','#f7c94b'][k%3] });
}
function updHearts(dt){ hearts=hearts.filter(h=>{ h.t+=dt; h.y+=h.vy*dt; h.x+=Math.sin(h.t*5+h.vy)*9*dt; return h.t<h.life; }); }
const HEART=['.##.##.','#######','#######','.#####.','..###..','...#...'];
function drawHearts(){
  for(const h of hearts){
    ctx.globalAlpha=clamp(1-h.t/h.life,0,1); ctx.fillStyle=h.col;
    for(let r=0;r<6;r++) for(let q=0;q<7;q++)
      if(HEART[r][q]==='#') ctx.fillRect(h.x+(q-3)*h.s,h.y+r*h.s,h.s,h.s);
  }
  ctx.globalAlpha=1;
}

function refreshObj(){ if(G.refreshObjFn) G.refreshObjFn(); else setObj(''); }

/* ---------- переміщення між сценами ---------- */
function camSnapNow(){
  const vw=W/Z, vh=H/Z, mw=G.map.w*TILE, mh=G.map.h*TILE;
  cam.x=mw<=vw?-(vw-mw)/2:clamp(P.x-vw/2,0,mw-vw);
  cam.y=mh<=vh?-(vh-mh)/2:clamp(P.y-vh/2,0,mh-vh);
}
function spawnAt(tx,ty){
  P.x=tx*TILE+8; P.y=ty*TILE+12; P._mv=null; P.moving=false;
  trail=[];
  if(G.follower){ D.visible=true; D.kneel=false; D._mv=null; D.x=P.x-14; D.y=P.y+3; }
  else if(G.stage!==6) D.visible=false;
  camSnapNow();
  const pr=pRect();
  for(const z of G.map.zones) z.wasIn=overlap(pr,zoneRectPx(z));
}
async function travel(mapId,tx,ty,cardText){
  await fadeOut();
  G.map=MAPS[mapId]; spawnAt(tx,ty);
  if(cardText) await showCard(cardText,1600);
  refreshObj();
  await fadeIn();
}
async function dayCycle(cardText,mapId,tx,ty){
  await fadeOut();
  await showCard(cardText,1450);
  if(mapId) G.map=MAPS[mapId];
  spawnAt(tx,ty);
  refreshObj();
  await fadeIn();
}

function checkZones(){
  const pr=pRect();
  for(const z of G.map.zones){
    const inz=overlap(pr,zoneRectPx(z));
    if(inz&&!z.wasIn){ z.wasIn=true; if(G.onZoneFn) G.onZoneFn(z); }
    else if(!inz) z.wasIn=false;
  }
}

/* ---------- керування ---------- */
const keys={};
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if(G.activity&&G.activity.onKey){ G.activity.onKey(k); return; }
  if(k===' '||k==='enter'||k==='e'){ if(advanceDialog()) return; }
  keys[k]=true;
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });

const joy={active:false,id:null,ox:0,oy:0,dx:0,dy:0};
addEventListener('pointerdown',e=>{
  if(e.target.closest('button')||e.target.closest('#mute')) return;
  initAudio();
  if(G.activity&&G.activity.onTap){ G.activity.onTap(e.clientX,e.clientY); return; }
  if(dState){ advanceDialog(); return; }
  if(G.busy) return;
  joy.active=true; joy.id=e.pointerId; joy.ox=e.clientX; joy.oy=e.clientY; joy.dx=0; joy.dy=0;
  stickBase.style.display='block';
  stickBase.style.left=(e.clientX-49)+'px';
  stickBase.style.top=(e.clientY-49)+'px';
  stickKnob.style.transform='translate(0,0)';
});
addEventListener('pointermove',e=>{
  if(!joy.active||e.pointerId!==joy.id) return;
  let dx=e.clientX-joy.ox, dy=e.clientY-joy.oy;
  const d=Math.hypot(dx,dy), max=40;
  if(d>max){ dx=dx/d*max; dy=dy/d*max; }
  joy.dx=dx/max; joy.dy=dy/max;
  stickKnob.style.transform='translate('+dx+'px,'+dy+'px)';
});
function joyEnd(e){ if(e.pointerId!==joy.id) return; joy.active=false; joy.dx=0; joy.dy=0; stickBase.style.display='none'; }
addEventListener('pointerup',joyEnd);
addEventListener('pointercancel',joyEnd);
addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

/* ---------- оновлення/рендер/цикл ---------- */
function update(dt){
  G.time+=dt;
  if(G.activity){ G.activity.update(dt); return; }
  stepActor(P,dt); stepActor(D,dt);
  updHearts(dt);
  if(!G.busy&&G.active&&!dState){
    let vx=0,vy=0;
    if(keys['arrowleft']||keys['a']) vx-=1;
    if(keys['arrowright']||keys['d']) vx+=1;
    if(keys['arrowup']||keys['w']) vy-=1;
    if(keys['arrowdown']||keys['s']) vy+=1;
    if(joy.active){
      vx=Math.abs(joy.dx)>0.2?joy.dx:0;
      vy=Math.abs(joy.dy)>0.2?joy.dy:0;
    }
    const l=Math.hypot(vx,vy);
    if(l>0.05){
      vx/=Math.max(1,l); vy/=Math.max(1,l);
      const sp=(G.adult?80:64)*dt;
      const nx=P.x+vx*sp;
      if(canStand(nx,P.y)) P.x=nx;
      const ny=P.y+vy*sp;
      if(canStand(P.x,ny)) P.y=ny;
      const mw=G.map.w*TILE, mh=G.map.h*TILE;
      P.x=clamp(P.x,6,mw-6); P.y=clamp(P.y,8,mh-2);
      P.moving=true; P.animT+=dt;
      if(Math.abs(vx)>Math.abs(vy)) P.dir=vx>0?2:1; else if(Math.abs(vy)>0) P.dir=vy>0?0:3;
      trail.push({x:P.x,y:P.y});
      if(trail.length>60) trail.shift();
    } else P.moving=false;
    checkZones();
  }
  if(G.follower&&D.visible&&!D._mv&&!D.kneel){
    const tgt=trail.length>16?trail[trail.length-16]:null;
    if(tgt){
      const dx=tgt.x-D.x, dy=tgt.y-D.y, d=Math.hypot(dx,dy);
      if(d>3){
        const st=Math.min(86*dt,d);
        D.x+=dx/d*st; D.y+=dy/d*st;
        D.moving=true; D.animT+=dt;
        D.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?2:1):(dy>0?0:3);
      } else D.moving=false;
    } else D.moving=false;
  }
  if(G.map){
    const vw=W/Z, vh=H/Z, mw=G.map.w*TILE, mh=G.map.h*TILE;
    const tx=mw<=vw?-(vw-mw)/2:clamp(P.x-vw/2,0,mw-vw);
    const ty=mh<=vh?-(vh-mh)/2:clamp(P.y-vh/2,0,mh-vh);
    cam.x+=(tx-cam.x)*Math.min(1,dt*7);
    cam.y+=(ty-cam.y)*Math.min(1,dt*7);
  }
}
function drawActor(a){
  if(a===D&&D.kneel){
    ctx.drawImage(SP_HIM_KNEEL_L,Math.round(a.x-9),Math.round(a.y-19));
    return;
  }
  const set=(a===P)?(G.adult?SP_HER:SP_KID):SP_HIM;
  const f=a.moving?(Math.floor(a.animT*7)%2):0;
  const img=set[a.dir][f];
  ctx.drawImage(img,Math.round(a.x-img.width/2),Math.round(a.y-img.height+1));
}
function render(){
  if(G.activity){ G.activity.render(); return; }
  const m=G.map;
  ctx.fillStyle=m?m.bg:'#101326';
  ctx.fillRect(0,0,W,H);
  if(!m) return;
  ctx.save(); ctx.scale(Z,Z); ctx.translate(-cam.x,-cam.y);
  const i0=Math.max(0,Math.floor(cam.x/TILE)), j0=Math.max(0,Math.floor(cam.y/TILE));
  const i1=Math.min(m.w-1,Math.ceil((cam.x+W/Z)/TILE)), j1=Math.min(m.h-1,Math.ceil((cam.y+H/Z)/TILE));
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) drawTileAt(m.g[j][i],i,j,G.time);
  const items=[];
  for(const b of m.buildings) items.push({y:(b.y+b.h)*TILE,d:()=>drawBuilding(b)});
  for(const p of m.props) items.push({y:p.y*TILE+(p.type==='stone'?22:16),d:()=>drawProp(p,G.time)});
  if(D.visible) items.push({y:D.y,d:()=>drawActor(D)});
  items.push({y:P.y,d:()=>drawActor(P)});
  items.sort((a,b)=>a.y-b.y);
  for(const it of items) it.d();
  if(G.target&&G.target[0]===m.id){
    const z=m.zones.find(q=>q.id===G.target[1]);
    if(z){
      const ax=z.x*TILE+z.w*8, ay=z.y*TILE-6+Math.sin(G.time*5)*2.5;
      ctx.fillStyle='#f7c94b';
      ctx.beginPath(); ctx.moveTo(ax-5,ay-8); ctx.lineTo(ax+5,ay-8); ctx.lineTo(ax,ay); ctx.closePath(); ctx.fill();
    }
  }
  drawHearts();
  ctx.restore();
  ctx.font='bold 11px "Courier New",monospace'; ctx.textAlign='center';
  const lbl=(txt,wx,wy)=>{
    const sx=(wx-cam.x)*Z, sy=(wy-cam.y)*Z;
    if(sx<-80||sx>W+80||sy<-24||sy>H+24) return;
    ctx.lineWidth=3; ctx.strokeStyle='rgba(10,12,24,.85)';
    ctx.strokeText(txt,sx,sy); ctx.fillStyle='#fff'; ctx.fillText(txt,sx,sy);
  };
  for(const b of m.buildings) if(b.label) lbl(b.label,b.x*TILE+b.w*8,b.y*TILE-4);
  for(const z of m.zones) if(z.label) lbl(z.label,z.x*TILE+z.w*8,z.y*TILE-3);
  ctx.textAlign='left';
  ctx.strokeStyle='rgba(10,12,24,.85)'; ctx.lineWidth=3;
  ctx.strokeText(m.name,10,H-10);
  ctx.fillStyle='#cfd6ff'; ctx.fillText(m.name,10,H-10);
  if(G.sunset){
    const gr=ctx.createLinearGradient(0,0,0,H);
    gr.addColorStop(0,'rgba(255,110,40,.30)');
    gr.addColorStop(.6,'rgba(255,80,60,.16)');
    gr.addColorStop(1,'rgba(90,40,110,.22)');
    ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  }
}

let last=0;
function loop(ts){
  const dt=Math.min(0.05,(ts-last)/1000||0.016);
  last=ts;
  update(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

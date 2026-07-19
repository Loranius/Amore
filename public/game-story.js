'use strict';
/* ============================================================
   GAME STORY — лінійна історія «Наша історія» (stages 1-11).
   ------------------------------------------------------------
   Без змін відносно оригіналу, окрім:
   - stage 1 (Садочок): обидва візити тепер грають runSadokVisit()
     (2 випадкові гри подвір'я з game-school.js) замість простого
     "зайди в будівлю x2";
   - stage 2 (Школа), класи 1-4: кожен клас тепер грає
     runSchoolGrade(N) (3 уроки + перерви) замість простого
     "зайди в будівлю". Класи 5-9 лишились старим простим циклом —
     їх поки не збагачували.
   ============================================================ */
Object.assign(CFG,{
  meet: [
    ['n','Четвертий курс. І раптом — повідомлення в дайвінчику…'],
    ['d','Класна ава, Лєна!'],
    ['l','У тебе також класна ава!'],
    ['d','Давай зустрічатись через дайвінчик.'],
    ['n','Трохи згодом…'],
    ['d','Бубос, люблю тебе.'],
    ['l','Люблю тебе, гівнюк.'],
    ['n','І з цього почалося все ❤️'],
  ],
  proposal: [
    ['d','Лєно…'],
  ],
  question: 'Будь моєю дружиною офіційно! 💍',
  yes1: 'ТАК ❤️',
  yes2: 'ЗВИЧАЙНО, ТАК! 💍',
  saidYes: 'ВОНА СКАЗАЛА «ТАК»! 💍',
  finalDate: '💍 13.07.2026 · пляж Отрада, Одеса',
});

function storyRefreshObj(){
  let t='', tg=null;
  switch(G.stage){
    case 1: t='🧸 Садочок: '+G.c+'/2'; tg=['zhyl','sadok']; break;
    case 2: t='🎒 Школа: '+G.c+'/9 клас'; tg=['zhyl','school']; break;
    case 3:
      if(G.sub==='go'){
        if(G.map.id==='zhyl'){ t='🚌 На зупинку — їдемо в Хмельницький!'; tg=['zhyl','busZhyl']; }
        else { t='🏛 Знайди ліцей'; tg=['khm','liceum']; }
      } else { t='🚌 Повертайся у Жилинці'; tg=['khm','busKhm']; }
      break;
    case 4:
      if(G.map.id==='prav'){ t='📚 Школа в Правдівці: '+G.c+'/2'; tg=['prav','schoolPrav']; }
      else { t='📚 Правдівка: '+G.c+'/2 · стежка на схід →'; tg=['zhyl','toPrav']; }
      break;
    case 5:
      if(G.sub==='bus'){ t='🚌 На зупинку — вступати у Вінницю!'; tg=['zhyl','busZhyl']; }
      else { t='🎓 ВТЕІ: курс '+G.c+'/3'; tg=['vin1','vtei']; }
      break;
    case 6: t='💘 4 курс: йди на пари…'; tg=['vin1','meet']; break;
    case 7: t='💼 Робота: рік '+G.c+'/2'; tg=['vysh','work']; break;
    case 8: t='🏡 Робота: рік '+G.c+'/3'; tg=['zal','workZ']; break;
    case 9: t='🚆 На вокзал! Потяг до Одеси 🌊'; tg=['zal','vokzal']; break;
    case 10: t='💛 Знайдіть Жовтий камінь на Отраді'; tg=['odesa','stone']; break;
  }
  setObj(t); G.target=tg;
}

function decoLine(id){
  const t={hata1:'Тут живуть сусіди 🙂',hata2:'Пахне свіжим хлібом 🍞',hata3:'Тут живе бабуся з котом 🐈',
    store:'Магазин. Зачинено на обід 🙂',poshta:'Пошта. Листів поки немає ✉️',
    phata1:'Хтось пече пиріжки 🥟',phata2:'Двір із соняхами 🌻',
    blockA:'Сусідська багатоповерхівка',blockB:'Тут ще триває ремонт 🔨',
    homeZ:'Ваша затишна квартира ❤️',homeV:'Ваша перша спільна квартира ❤️'};
  return t[id]||'Зачинено 🙂';
}
async function storyOnZone(z){
  if(G.busy) return;
  const id=z.id, s=G.stage;
  if(z.kind==='deco'){ toast(decoLine(id)); return; }
  if(id==='home'){ toast('Рідна хата ❤️'); return; }
  if(id==='dorm'){ toast('Гуртожиток. Сусідки ще сплять 😴'); return; }
  if(id==='homeV'){ toast(decoLine(id)); return; }

  // 1. Садочок ×2 — тепер справжні ігри подвір'я
  if(s===1){
    if(id==='sadok'){ G.busy=true; G.c++; sfxOk();
      await runSadokVisit();
      G.map=MAPS.zhyl; spawnAt(5,12);
      if(G.c>=2){
        await showCard('🧸 Садочок пройдено ✓',1600);
        await sayAll([['n','Садочок позаду! 🧸'],['n','Тепер — школа. Аж дев\'ять класів 🎒']]);
        G.stage=2; G.c=0;
      }
      refreshObj(); G.busy=false; return; }
    if(id==='school'){ toast('Спочатку — садочок 🙂'); return; }
    if(z.kind==='exit'){ toast('Ще зарано 🙂'); return; }
  }

  // 2. Школа 1–9: класи 1-4 — повний урочний день, 5-9 — старий простий цикл
  if(s===2){
    if(id==='school'){ G.busy=true; G.c++; sfxOk();
      if(G.c<=4){
        await runSchoolGrade(G.c);
        G.map=MAPS.zhyl; spawnAt(5,12);
      } else if(G.c<9){
        await dayCycle('🎒 '+G.c+' клас ✓',null,5,12);
      } else {
        await dayCycle('🎒 9 клас ✓',null,5,12);
        await showCard('Лєна виросла ✨',1600); G.adult=true; sfxTada();
        await sayAll([['n','Дев\'ять класів позаду!'],['n','Попереду — ліцей у Хмельницькому. Автобус чекає на зупинці біля дороги ⬆️']]);
        G.stage=3; G.sub='go';
      }
      refreshObj(); G.busy=false; return; }
    if(id==='sadok'){ toast('У садочок уже не треба 🙂'); return; }
    if(z.kind==='exit'){ toast('Спершу — школа 🎒'); return; }
  }

  // 3. Ліцей у Хмельницькому (туди й назад)
  if(s===3){
    if(id==='busZhyl'&&G.sub==='go'){ G.busy=true;
      await travel('khm',6,11,'🚌 Жилинці → Хмельницький');
      await say('n','Велике місто! Знайди ліцей 🏛');
      G.busy=false; return; }
    if(id==='liceum'){ if(G.sub!=='go'){ toast('Ліцей уже відвідано ✔️'); return; }
      G.busy=true; sfxOk();
      await say('n','Ліцей відвідано ✔️ Але серце тягне додому…');
      G.sub='back'; refreshObj(); G.busy=false; return; }
    if(id==='busKhm'){ if(G.sub!=='back'){ toast('Спершу — до ліцею 🏛'); return; }
      G.busy=true;
      await travel('zhyl',16,4,'🚌 Хмельницький → Жилинці');
      await sayAll([['n','Вдома найкраще ❤️'],['n','10 та 11 клас Лєна ходитиме до школи в сусідній Правдівці. Стежка — на схід ➡️']]);
      G.stage=4; G.c=0; refreshObj(); G.busy=false; return; }
    if(id==='school'||id==='sadok'){ toast('Тепер твій шлях далі 🙂'); return; }
    if(id==='toPrav'){ toast('Спершу — Хмельницький 🚌'); return; }
  }

  // 4. Правдівка: 10–11 клас
  if(s===4){
    if(id==='toPrav'){ G.busy=true; await travel('prav',2,7,'🚶 Стежкою до Правдівки'); G.busy=false; return; }
    if(id==='toZhyl'){ G.busy=true; await travel('zhyl',29,12,null); G.busy=false; return; }
    if(id==='schoolPrav'){ G.busy=true; G.c++; sfxOk();
      if(G.c===1) await dayCycle('📚 10 клас ✓','zhyl',5,12);
      else {
        await dayCycle('📚 11 клас ✓','zhyl',5,12);
        await showCard('🎉 ШКОЛУ ЗАКІНЧЕНО!',1800); sfxTada();
        await sayAll([['n','Випускний, атестат, великі мрії…'],['n','Вінниця кличе: вступ до ВТЕІ! 🚌 Мерщій на зупинку!']]);
        G.stage=5; G.sub='bus';
      }
      refreshObj(); G.busy=false; return; }
    if(id==='busZhyl'){ toast('Спершу — школа в Правдівці 📚'); return; }
    if(id==='school'||id==='sadok'){ toast('Це вже пройдений етап 🙂'); return; }
  }

  // 5. ВТЕІ: 3 курси
  if(s===5){
    if(id==='busZhyl'&&G.sub==='bus'){ G.busy=true;
      await travel('vin1',5,11,'🚌 Жилинці → Вінниця 🌻');
      await sayAll([['n','Вітаємо у Вінниці! Он і ВТЕІ 🎓'],['n','А твій новий дім — гуртожиток.']]);
      G.sub='study'; G.c=0; refreshObj(); G.busy=false; return; }
    if(id==='toPrav'||id==='school'||id==='sadok'){ toast('Тепер твій шлях — у Вінницю 🚌'); return; }
    if(id==='vtei'){ G.busy=true; G.c++; sfxOk();
      if(G.c<3) await dayCycle('🎓 '+G.c+' курс складено!',null,5,11);
      else {
        await dayCycle('🎓 3 курс складено!',null,5,11);
        await sayAll([['n','Три курси позаду. Починається четвертий…'],['n','Звичайний день. Звичайна дорога на пари. Чи ні? 😉']]);
        G.stage=6;
        D.visible=true; D.kneel=false; D.x=13*TILE+8; D.y=10*TILE+10; D.dir=1;
      }
      refreshObj(); G.busy=false; return; }
  }

  // 6. Зустріч із Дімою
  if(s===6&&(id==='meet'||id==='vtei')){ await meetScene(); return; }

  // 7. Вишенька: робота ×2
  if(s===7){
    if(id==='work'){ G.busy=true; G.c++; sfxOk();
      if(G.c===1) await dayCycle('💼 Рік перший: перша спільна зарплата ✓',null,5,10);
      else {
        await dayCycle('☕ Рік другий: робота, дім і затишні вечори ✓',null,5,10);
        await sayAll([['d','Лєно, є ідея! Переїжджаємо ближче до вокзалу?'],['l','Давай! 📦']]);
        await travel('zal',8,13,'🚚 Вишенька → район вокзалу');
        await say('n','Нова квартира — і три спокійні, щасливі роки.');
        G.stage=8; G.c=0;
      }
      refreshObj(); G.busy=false; return; }
  }

  // 8. Біля вокзалу: 3 роки
  if(s===8){
    if(id==='workZ'){ G.busy=true; G.c++; sfxOk();
      const cards=['🌸 Рік перший у новій квартирі ✓','❄️ Рік другий ✓','☀️ Рік третій ✓'];
      await dayCycle(cards[G.c-1],null,8,13);
      if(G.c>=3){
        await sayAll([['d','Лєно… а гайда до моря? В Одесу! 🌊'],['l','ТАК! Коли їдемо? 😍'],['n','Квитки куплено: 11 липня 2026, потяг до Одеси 🎫 Йдіть на вокзал!']]);
        G.stage=9;
      }
      refreshObj(); G.busy=false; return; }
    if(id==='vokzal'){ toast('Потяг ще не сьогодні 🙂'); return; }
  }

  // 9. Потяг до Одеси
  if(s===9){
    if(id==='vokzal'){ G.busy=true;
      await travel('odesa',2,3,'🚆 11.07.2026<br>Вінниця → Одеса');
      await sayAll([['n','Одеса! Сонце, чайки і море 🌊'],['n','Прогуляйтеся вдвох до Жовтого каменя на пляжі Отрада 💛']]);
      G.stage=10; refreshObj(); G.busy=false; return; }
    if(id==='workZ'){ toast('Сьогодні не до роботи — валізи! 🧳'); return; }
  }

  // 10. Жовтий камінь
  if(s===10&&id==='stone'){ await proposalScene(); return; }

  if(z.kind==='door') toast('Зачинено 🙂');
  else if(z.kind==='exit') toast('Не зараз 🙂');
}

async function meetScene(){
  G.busy=true;
  D.visible=true; D.kneel=false;
  await moveActor(D,P.x+20,P.y,72);
  D.dir=1; P.dir=2;
  spawnHearts((P.x+D.x)/2,P.y-24,6,20); sfxLove();
  await sayAll(CFG.meet);
  spawnHearts((P.x+D.x)/2,P.y-24,16,28); sfxLove();
  await showCard('❤️',1000);
  await say('n','Далі все закрутилось: побачення, прогулянки… І ось вони вже разом винаймають квартиру на Вишеньці!');
  G.follower=true;
  await travel('vysh',5,10,'📦 Переїзд на Вишеньку');
  await say('n','Доросле життя: разом на роботу, разом додому 🏠');
  G.stage=7; G.c=0; refreshObj(); G.busy=false;
}

async function proposalScene(){
  G.busy=true; G.stage=11; setObj(''); G.target=null;
  await showCard('☀️ 12 липня — цілий день моря, сонця і морозива',2000);
  await fadeOut();
  G.sunset=true;
  P.x=22*TILE+10; P.y=12*TILE+10; P.dir=2; P._mv=null;
  D.visible=true; D.kneel=false; D._mv=null; D.x=P.x-44; D.y=P.y+2;
  trail=[]; camSnapNow();
  await showCard('🌇 13 липня 2026 · вечір',2000);
  await fadeIn();
  await moveActor(D,P.x+28,P.y,44);
  D.dir=1; P.dir=2;
  await wait(500);
  await sayAll(CFG.proposal);
  D.kneel=true; sfxLove();
  spawnHearts(P.x+14,P.y-26,10,32);
  const drip=setInterval(()=>spawnHearts(P.x+14,P.y-32,2,46),550);
  await wait(750);
  document.getElementById('qt').textContent=CFG.question;
  document.getElementById('yes1').textContent=CFG.yes1;
  document.getElementById('yes2').textContent=CFG.yes2;
  document.getElementById('ask').style.display='flex';
  await new Promise(res=>{
    const h=()=>{ document.getElementById('ask').style.display='none'; res(); };
    document.getElementById('yes1').onclick=h;
    document.getElementById('yes2').onclick=h;
  });
  clearInterval(drip);
  sfxTada();
  spawnHearts(P.x+14,P.y-18,90,100);
  await wait(1000);
  await showCard(CFG.saidYes,2400);
  document.getElementById('finDate').textContent=CFG.finalDate;
  document.getElementById('final').style.display='flex';
}

/* ---------- старт повної лінійної історії ---------- */
async function startFullStory(){
  initAudio();
  document.getElementById('title').style.display='none';
  document.getElementById('mute').style.display='flex';
  G.mode='story'; G.onZoneFn=storyOnZone; G.refreshObjFn=storyRefreshObj;
  G.map=MAPS.zhyl; spawnAt(5,12);
  await fadeIn();
  await showCard('с. Жилинці · початок історії',1700);
  await sayAll([
    ['n','Десь на Хмельниччині є село Жилинці.'],
    ['n','Тут росте дівчинка на ім\'я Лєна 👧'],
    ['n','Пройди її шлях крок за кроком — він приведе далі, ніж здається ❤️'],
    ['n','Керування: тягни палець по екрану (джойстик) або стрілки/WASD. Іди туди, куди вказує жовта стрілочка!'],
  ]);
  G.stage=1; G.c=0; G.active=true; refreshObj(); G.busy=false;
}

// ============================================================
// FINANCE MODULE v4 — повністю переписаний
// Таблиця: transactions (існуюча)
// localStorage: amore_fin_v4
// ============================================================
const Budget = (() => {

  const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

  const INCOME_CATS  = ['Зарплата','Чайові','Подарунок','Фріланс','Інше'];
  const EXPENSE_CATS = ['Їжа','Транспорт','Комуналка','Розваги',"Здоров'я",
                        'Одяг','Подарунки','Кафе/Ресторани','Краса','Інше'];

  let yr, mo, allTx = [], moTx = [];
  const SK = 'amore_fin_v4';
  const LS = k => { try { return JSON.parse(localStorage.getItem(SK)||'{}'); } catch { return {}; } };
  const SS = o => localStorage.setItem(SK, JSON.stringify(Object.assign(LS(),o)));
  const el = id => document.getElementById(id);
  const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
  const fmtN = n => Math.round(Math.abs(n)).toLocaleString('uk-UA')+' ₴';
  const fmtS = n => (n>=0?'+':'-')+fmtN(n);

  // ── ІНІЦІАЛІЗАЦІЯ ──
  function initDate() { const n=new Date(); yr=n.getFullYear(); mo=n.getMonth(); }

  function moRange() {
    const s=new Date(yr,mo,1).toISOString().slice(0,10);
    const e=new Date(yr,mo+1,1).toISOString().slice(0,10);
    return { s, e };
  }

  // ── ДАНІ ──
  async function fetchAll() {
    const {data} = await supabase.from('transactions')
      .select('id,amount,type,category,description,date,created_by')
      .order('date',{ascending:false});
    allTx = data||[];
  }

  async function fetchMonth() {
    const {s,e} = moRange();
    const {data} = await supabase.from('transactions')
      .select('id,amount,type,category,description,date,created_by')
      .gte('date',s).lt('date',e).order('date',{ascending:false});
    moTx = data||[];
  }

  function calcBalance() {
    return allTx.reduce((acc,t)=>acc+(t.type==='income'?+t.amount:-t.amount),0);
  }

  function whoName(uid) {
    if (!uid) return null;
    try { const u=(Auth._getUsers()||[]).find(u=>u.id===uid); return u?.name||null; } catch { return null; }
  }

  // ── БАЛАНС ──
  function renderBalance() {
    const b = calcBalance();
    if (el('balance-total')) el('balance-total').textContent = fmtN(b);
  }

  // ── ВКЛАДКИ ДОХІД / ВИТРАТА ──
  function bindTabs() {
    document.querySelectorAll('.fin-tab-btn').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound='1';
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fin-tab-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.fin-tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        el('fin-panel-'+btn.dataset.tab)?.classList.add('active');
      });
    });
  }

  // ── ФОРМА ДОХОДУ ──
  function bindIncomeForm() {
    const form = el('income-form'); if (!form||form.dataset.bound) return;
    form.dataset.bound='1';

    // Кастом-категорія — тільки для Діми є чайові
    const user = Auth.getCurrentUser();
    if (user?.name === 'Діма') {
      // Чайові вже є в списку
    }

    el('income-save').addEventListener('click', async () => {
      const amount = parseFloat(el('income-amount').value);
      const cat    = el('income-cat').value;
      const date   = el('income-date').value;
      const desc   = el('income-desc').value.trim();
      if (!amount||amount<=0||!date) { shake(el('income-amount')); return; }
      await supabase.from('transactions').insert({
        amount, type:'income', category:cat, date,
        description:desc||null, created_by:user?.id||null
      });
      el('income-amount').value='';
      el('income-desc').value='';
      el('income-date').value=today();
      refresh();
    });
  }

  // ── ФОРМА ВИТРАТИ ──
  function bindExpenseForm() {
    const form = el('expense-form'); if (!form||form.dataset.bound) return;
    form.dataset.bound='1';

    const customToggle = el('expense-cat-custom-toggle');
    const selectWrap   = el('expense-cat-select-wrap');
    const customWrap   = el('expense-cat-custom-wrap');

    if (customToggle) {
      customToggle.addEventListener('change', () => {
        const on = customToggle.checked;
        selectWrap?.classList.toggle('hidden', on);
        customWrap?.classList.toggle('hidden', !on);
      });
    }

    const user = Auth.getCurrentUser();
    el('expense-save').addEventListener('click', async () => {
      const amount = parseFloat(el('expense-amount').value);
      const isCustom = customToggle?.checked;
      const cat = isCustom
        ? (el('expense-cat-custom').value.trim()||'Інше')
        : el('expense-cat-select').value;
      const date = el('expense-date').value;
      const desc = el('expense-desc').value.trim();
      if (!amount||amount<=0||!date) { shake(el('expense-amount')); return; }
      await supabase.from('transactions').insert({
        amount, type:'expense', category:cat, date,
        description:desc||null, created_by:user?.id||null
      });
      el('expense-amount').value='';
      el('expense-desc').value='';
      el('expense-date').value=today();
      refresh();
    });
  }

  // ── КАЛЕНДАР ──
  function renderCalendar() {
    const wrap = el('fin-calendar'); if (!wrap) return;
    const now  = new Date();
    const days = new Date(yr,mo+1,0).getDate();
    const first= (new Date(yr,mo,1).getDay()+6)%7; // Пн=0

    // Групуємо по датах
    const byDay={};
    moTx.forEach(t=>{
      const d=+t.date.slice(8,10);
      if(!byDay[d]) byDay[d]={inc:0,exp:0};
      t.type==='income' ? byDay[d].inc+=+t.amount : byDay[d].exp+=+t.amount;
    });

    const heads=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    let h='<div class="fin-cal-grid">';
    heads.forEach(n=>h+=`<div class="fin-cal-head">${n}</div>`);
    for(let i=0;i<first;i++) h+='<div class="fin-cal-cell fin-cal-empty"></div>';
    for(let d=1;d<=days;d++){
      const isToday=d===now.getDate()&&mo===now.getMonth()&&yr===now.getFullYear();
      const data=byDay[d];
      let dots='';
      if(data?.inc)  dots+=`<span class="fin-cal-dot fin-dot-in">+${Math.round(data.inc/1000)||'<1'}k</span>`;
      if(data?.exp)  dots+=`<span class="fin-cal-dot fin-dot-ex">-${Math.round(data.exp/1000)||'<1'}k</span>`;
      h+=`<div class="fin-cal-cell${isToday?' fin-cal-today':''}" data-day="${d}">${d}${dots}</div>`;
    }
    h+='</div>';
    wrap.innerHTML=h;

    wrap.querySelectorAll('[data-day]').forEach(c=>{
      c.addEventListener('click',()=>showDayModal(+c.dataset.day));
    });
  }

  function showDayModal(day) {
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const txs=moTx.filter(t=>t.date?.slice(0,10)===ds);
    if(!txs.length) return;
    const rows=txs.map(t=>{
      const isInc=t.type==='income';
      const who=whoName(t.created_by);
      return `<div class="tx-row">
        <div class="tx-row-info">
          <span class="tx-cat">${esc(t.category||'Інше')}</span>
          ${t.description?`<span class="tx-desc">${esc(t.description)}</span>`:''}
          ${who?`<span class="tx-who">👤 ${esc(who)}</span>`:''}
        </div>
        <span class="tx-amt ${isInc?'tx-inc':'tx-exp'}">${isInc?'+':'-'}${fmtN(t.amount)}</span>
      </div>`;
    }).join('');
    openModal(`<h3>${day} ${MONTHS[mo]}</h3>${rows}`,'fin-day-modal');
  }

  // ── ЖУРНАЛ ──
  function renderJournal() {
    const wrap=el('fin-journal'); if(!wrap) return;
    if(!moTx.length){ wrap.innerHTML='<p class="empty-state">Записів немає.</p>'; return; }
    wrap.innerHTML='';
    moTx.forEach(t=>{
      const isInc=t.type==='income';
      const who=whoName(t.created_by);
      const d=t.date?.slice(5).replace('-','.');
      const row=document.createElement('div');
      row.className='tx-row';
      row.innerHTML=`
        <div class="tx-row-info">
          <span class="tx-cat">${esc(t.category||'Інше')}</span>
          ${t.description?`<span class="tx-desc">${esc(t.description)}</span>`:''}
          <span class="tx-who">${d}${who?' · 👤 '+esc(who):''}</span>
        </div>
        <span class="tx-amt ${isInc?'tx-inc':'tx-exp'}">${isInc?'+':'-'}${fmtN(t.amount)}</span>
        <button class="fin-del-btn" data-id="${t.id}">×</button>`;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('[data-id]').forEach(b=>
      b.addEventListener('click',()=>delTx(b.dataset.id)));
  }

  async function delTx(id){
    if(!confirm('Видалити?')) return;
    await supabase.from('transactions').delete().eq('id',id);
    refresh();
  }

  // ── ТУМБОЧКА ──
  function renderTumbochka() {
    // Рахуємо: income категорії Тумбочка − expense категорії Тумбочка
    const total=allTx
      .filter(t=>t.category==='Тумбочка')
      .reduce((s,t)=>s+(t.type==='income'?+t.amount:-t.amount),0);
    if(el('tumbo-balance')) el('tumbo-balance').textContent=fmtN(total);
  }

  function bindTumbochka() {
    // Поле 1: вже є в резерві (ручне поповнення)
    const manInp=el('tumbo-manual-inp');
    const manBtn=el('tumbo-manual-btn');
    if(manInp&&!manInp.dataset.bound){
      manInp.dataset.bound='1';
      const save=async()=>{
        const v=parseFloat(manInp.value);
        if(!v||v<=0){shake(manInp);return;}
        const user=Auth.getCurrentUser();
        await supabase.from('transactions').insert({
          amount:v,type:'income',category:'Тумбочка',
          date:today(),description:'Вже відкладено',created_by:user?.id||null
        });
        manInp.value='';
        refresh();
      };
      manBtn?.addEventListener('click',save);
      manInp.addEventListener('keydown',e=>e.key==='Enter'&&save());
    }

    // Поле 2: сума доходу → % в тумбочку
    const incInp=el('tumbo-income-inp');
    const incBtn=el('tumbo-income-btn');
    const optBtns=document.querySelectorAll('.tumbo-pct-btn');
    const calcEl=el('tumbo-calc');
    const confirmBtn=el('tumbo-confirm');
    const panel=el('tumbo-pct-panel');
    if(!incInp||incInp.dataset.bound) return;
    incInp.dataset.bound='1';

    let curAmt=0, curPct=15;
    const upd=()=>{ if(calcEl) calcEl.textContent=fmtN(Math.round(curAmt*curPct/100)); };

    const openPanel=()=>{
      const v=parseFloat(incInp.value);
      if(!v||v<=0){shake(incInp);return;}
      curAmt=v;
      if(el('tumbo-inc-display')) el('tumbo-inc-display').textContent=fmtN(v);
      optBtns.forEach(b=>b.classList.toggle('active',b.dataset.pct==='15'));
      curPct=15; upd();
      panel?.classList.add('visible');
    };
    incBtn?.addEventListener('click',openPanel);
    incInp.addEventListener('keydown',e=>e.key==='Enter'&&openPanel());

    optBtns.forEach(b=>b.addEventListener('click',()=>{
      curPct=parseInt(b.dataset.pct)||0;
      optBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); upd();
    }));

    confirmBtn&&!confirmBtn.dataset.bound&&(confirmBtn.dataset.bound='1',
    confirmBtn.addEventListener('click',async()=>{
      const user=Auth.getCurrentUser();
      const toSave=Math.round(curAmt*curPct/100);
      // зберігаємо дохід
      await supabase.from('transactions').insert({
        amount:curAmt,type:'income',category:'Зарплата',
        date:today(),description:null,created_by:user?.id||null
      });
      // зберігаємо в тумбочку
      if(toSave>0){
        await supabase.from('transactions').insert({
          amount:toSave,type:'expense',category:'Тумбочка',
          date:today(),description:'Відкладено з доходу',created_by:user?.id||null
        });
      }
      panel?.classList.remove('visible');
      incInp.value='';
      refresh();
    }));
  }

  // ── ЛІМІТ ВІЛЬНОГО РІШЕННЯ ──
  function renderFreeLimit() {
    const s=LS();
    const limit=s.freeLimit||0;
    const proposal=s.freeLimitProposal||null; // {value, proposedBy}
    const confirmed=s.freeLimitConfirmed||false;
    const user=Auth.getCurrentUser();

    // Слайдер
    const slider=el('free-limit-slider');
    const display=el('free-limit-display');
    if(slider&&!slider.dataset.bound){
      slider.dataset.bound='1';
      slider.value=limit||2000;
      if(display) display.textContent=fmtN(slider.value);
      slider.addEventListener('input',()=>{
        if(display) display.textContent=fmtN(slider.value);
      });
    }

    // Кнопка "Запропонувати"
    const propBtn=el('free-limit-propose');
    if(propBtn&&!propBtn.dataset.bound){
      propBtn.dataset.bound='1';
      propBtn.addEventListener('click',()=>{
        const v=parseInt(slider?.value||2000);
        SS({freeLimitProposal:{value:v,proposedBy:user?.name||'?'},freeLimitConfirmed:false});
        renderFreeLimit();
      });
    }

    // Панель підтвердження
    const propPanel=el('free-limit-proposal-panel');
    const propText=el('free-limit-proposal-text');
    const propConfirm=el('free-limit-proposal-confirm');
    const propReject=el('free-limit-proposal-reject');

    if(proposal&&!confirmed&&proposal.proposedBy!==user?.name){
      // Показуємо іншому юзеру
      if(propPanel) propPanel.classList.add('visible');
      if(propText) propText.textContent=`${proposal.proposedBy} пропонує ліміт: ${fmtN(proposal.value)}`;
      if(propConfirm&&!propConfirm.dataset.bound){
        propConfirm.dataset.bound='1';
        propConfirm.addEventListener('click',()=>{
          SS({freeLimit:proposal.value,freeLimitProposal:null,freeLimitConfirmed:true});
          renderFreeLimit(); renderPersonalWishes();
        });
      }
      if(propReject&&!propReject.dataset.bound){
        propReject.dataset.bound='1';
        propReject.addEventListener('click',()=>{
          SS({freeLimitProposal:null});
          renderFreeLimit();
        });
      }
    } else {
      if(propPanel) propPanel.classList.remove('visible');
    }

    // Прогрес-смужки (скільки вже витратили з особистого ліміту цього місяця)
    // Вважаємо витрати категорії 'Ліміт' або позначені як особисті
    const curLimit=s.freeLimit||0;
    const dimaSpent=moTx.filter(t=>t.type==='expense'&&t.category==='Особисті (Діма)').reduce((a,t)=>a+ +t.amount,0);
    const lenaSpent=moTx.filter(t=>t.type==='expense'&&t.category==='Особисті (Лєна)').reduce((a,t)=>a+ +t.amount,0);

    const pctD=curLimit>0?Math.min(100,Math.round(dimaSpent/curLimit*100)):0;
    const pctL=curLimit>0?Math.min(100,Math.round(lenaSpent/curLimit*100)):0;

    if(el('free-dima-bar'))  el('free-dima-bar').style.width=pctD+'%';
    if(el('free-lena-bar'))  el('free-lena-bar').style.width=pctL+'%';
    if(el('free-dima-used')) el('free-dima-used').textContent=`${fmtN(dimaSpent)} з ${fmtN(curLimit)}`;
    if(el('free-lena-used')) el('free-lena-used').textContent=`${fmtN(lenaSpent)} з ${fmtN(curLimit)}`;
    if(el('free-limit-current')) el('free-limit-current').textContent=curLimit>0?fmtN(curLimit):'не встановлено';
  }

  // ── ОСОБИСТІ БАЖАННЯ ──
  async function renderPersonalWishes() {
    const wrap=el('personal-wishes-list'); if(!wrap) return;
    const {data}=await supabase.from('personal_wishes')
      .select('id,name,price,url,owner').order('created_at',{ascending:false});
    if(!data?.length){wrap.innerHTML='<p class="empty-state">Поки нічого немає.</p>';return;}
    wrap.innerHTML='';
    data.forEach(w=>{
      const item=document.createElement('div');
      item.className='wish-row';
      item.innerHTML=`
        <div class="wish-row-info">
          <span class="wish-row-name">${esc(w.name)}</span>
          ${w.url?`<a class="wish-row-link" href="${esc(w.url)}" target="_blank" rel="noopener">🔗</a>`:''}
          <span class="wish-row-owner">${esc(w.owner||'')}</span>
        </div>
        <span class="wish-row-price">${fmtN(w.price||0)}</span>
        <button class="fin-del-btn" data-wish="${w.id}">×</button>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-wish]').forEach(b=>
      b.addEventListener('click',async()=>{
        if(!confirm('Видалити бажання?')) return;
        await supabase.from('personal_wishes').delete().eq('id',b.dataset.wish);
        renderPersonalWishes();
      }));
  }

  function bindAddWish() {
    const btn=el('add-wish-btn');
    if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const user=Auth.getCurrentUser();
      openModal(`
        <h3>Моє бажання</h3>
        <div class="form-field"><label>Назва</label><input id="mw-name" type="text" placeholder="Що хочу?"></div>
        <div class="form-field"><label>Ціна, ₴</label><input id="mw-price" type="number" min="0" step="10" placeholder="0"></div>
        <div class="form-field"><label>Посилання</label><input id="mw-url" type="url" placeholder="https://..."></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="mw-cancel">Скасувати</button>
          <button class="btn-primary" id="mw-save">Зберегти</button>
        </div>`,'mw-overlay');
      el('mw-cancel')?.addEventListener('click',closeModal);
      el('mw-save')?.addEventListener('click',async()=>{
        const name=el('mw-name').value.trim();
        const price=parseFloat(el('mw-price').value)||0;
        const url=el('mw-url').value.trim();
        if(!name){shake(el('mw-name'));return;}
        await supabase.from('personal_wishes').insert({
          name,price,url:url||null,owner:user?.name||null
        });
        closeModal();
        renderPersonalWishes();
      });
    });
  }

  // ── ГЛОБАЛЬНІ ЦІЛІ ──
  async function renderGlobalGoals() {
    const wrap=el('global-goals-list'); if(!wrap) return;
    const {data}=await supabase.from('savings_goals')
      .select('id,name,target_amount,url,description,status,proposed_by')
      .order('created_at',{ascending:false});
    if(!data?.length){wrap.innerHTML='<p class="empty-state">Спільних цілей ще немає.</p>';return;}
    wrap.innerHTML='';
    const user=Auth.getCurrentUser();
    data.forEach(g=>{
      const isPending=g.status==='pending';
      const canVote=isPending&&g.proposed_by!==user?.name;
      const item=document.createElement('div');
      item.className=`goal-row${isPending?' goal-pending':''}`;
      item.innerHTML=`
        <div class="goal-row-info">
          <span class="goal-row-name">${esc(g.name)}</span>
          ${g.description?`<span class="goal-row-desc">${esc(g.description)}</span>`:''}
          ${g.url?`<a class="wish-row-link" href="${esc(g.url)}" target="_blank" rel="noopener">🔗</a>`:''}
          ${isPending?`<span class="goal-status-badge">⏳ Очікує підтвердження від ${esc(g.proposed_by==='Діма'?'Лєни':'Діми')}</span>`:''}
          ${g.status==='confirmed'?'<span class="goal-status-badge goal-confirmed">✅ Підтверджено</span>':''}
        </div>
        <div class="goal-row-right">
          <span class="goal-row-price">${fmtN(g.target_amount||0)}</span>
          ${canVote?`
            <div class="goal-vote-btns">
              <button class="btn-primary" style="padding:6px 14px;font-size:12px" data-confirm="${g.id}">✓ Підтвердити</button>
              <button class="btn-secondary" style="padding:6px 14px;font-size:12px" data-reject="${g.id}">✕</button>
            </div>`:''}
          ${!isPending?`<button class="fin-del-btn" data-gid="${g.id}">×</button>`:''}
        </div>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',async()=>{
      await supabase.from('savings_goals').update({status:'confirmed'}).eq('id',b.dataset.confirm);
      renderGlobalGoals();
    }));
    wrap.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Відхилити ціль?')) return;
      await supabase.from('savings_goals').delete().eq('id',b.dataset.reject);
      renderGlobalGoals();
    }));
    wrap.querySelectorAll('[data-gid]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Видалити ціль?')) return;
      await supabase.from('savings_goals').delete().eq('id',b.dataset.gid);
      renderGlobalGoals();
    }));
  }

  function bindAddGoal() {
    const btn=el('add-goal-btn');
    if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const user=Auth.getCurrentUser();
      openModal(`
        <h3>Спільна ціль</h3>
        <div class="form-field"><label>Назва</label><input id="gg-name" type="text" placeholder="Що плануємо?"></div>
        <div class="form-field"><label>Для чого / опис</label><input id="gg-desc" type="text" placeholder="Навіщо нам це?"></div>
        <div class="form-field"><label>Вартість, ₴</label><input id="gg-price" type="number" min="0" step="100" placeholder="0"></div>
        <div class="form-field"><label>Посилання</label><input id="gg-url" type="url" placeholder="https://..."></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="gg-cancel">Скасувати</button>
          <button class="btn-primary" id="gg-save">Відправити на підтвердження</button>
        </div>`,'gg-overlay');
      el('gg-cancel')?.addEventListener('click',closeModal);
      el('gg-save')?.addEventListener('click',async()=>{
        const name=el('gg-name').value.trim();
        const desc=el('gg-desc').value.trim();
        const price=parseFloat(el('gg-price').value)||0;
        const url=el('gg-url').value.trim();
        if(!name){shake(el('gg-name'));return;}
        await supabase.from('savings_goals').insert({
          name,description:desc||null,target_amount:price,
          url:url||null,status:'pending',proposed_by:user?.name||null,saved_amount:0
        });
        closeModal();
        renderGlobalGoals();
      });
    });
  }

  // ── МІСЯЧНА НАВІГАЦІЯ ──
  function renderMonthNav() {
    if(el('fin-month-label'))
      el('fin-month-label').textContent=`${MONTHS[mo]} ${yr}`;
    const inc=moTx.filter(t=>t.type==='income').reduce((s,t)=>s+ +t.amount,0);
    const exp=moTx.filter(t=>t.type==='expense').reduce((s,t)=>s+ +t.amount,0);
    if(el('fin-month-inc')) el('fin-month-inc').textContent='+'+fmtN(inc);
    if(el('fin-month-exp')) el('fin-month-exp').textContent='-'+fmtN(exp);
  }

  function changeMonth(d){
    mo+=d;
    if(mo<0){mo=11;yr--;} if(mo>11){mo=0;yr++;}
    fetchMonth().then(()=>{ renderCalendar(); renderJournal(); renderMonthNav(); renderFreeLimit(); });
  }

  // ── ХЕЛПЕРИ ──
  function today(){ return new Date().toISOString().slice(0,10); }

  function openModal(html,id='fin-modal'){
    el('modal-root').innerHTML=`
      <div class="modal-overlay" id="${id}">
        <div class="modal-card">${html}</div>
      </div>`;
    el(id)?.addEventListener('click',e=>{ if(e.target.id===id) closeModal(); });
  }
  function closeModal(){ el('modal-root').innerHTML=''; }

  function shake(inp){
    if(!inp) return;
    inp.style.borderColor='var(--danger)';
    inp.classList.add('shake');
    setTimeout(()=>{ inp.style.borderColor=''; inp.classList.remove('shake'); },1000);
  }

  // ── ГОЛОВНИЙ РЕФРЕШ ──
  async function refresh(){
    await Promise.all([fetchAll(), fetchMonth()]);
    renderBalance();
    renderCalendar();
    renderJournal();
    renderMonthNav();
    renderTumbochka();
    renderFreeLimit();
    renderPersonalWishes();
    renderGlobalGoals();
    bindTumbochka();
    bindAddWish();
    bindAddGoal();
  }

  function init(){
    initDate();
    bindTabs();
    bindIncomeForm();
    bindExpenseForm();
    el('fin-prev-month')?.addEventListener('click',()=>changeMonth(-1));
    el('fin-next-month')?.addEventListener('click',()=>changeMonth(1));
    window.addEventListener('portal:view',e=>{ if(e.detail.view==='budget'){ bindTabs(); bindIncomeForm(); bindExpenseForm(); refresh(); } });
  }

  return { init, refresh, _calDay: d=>showDayModal(d) };
})();

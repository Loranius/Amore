// ============================================================
// FINANCE MODULE v5 — bottom sheets + акордеон
// ============================================================
const Budget = (() => {

  const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

  let yr, mo, allTx = [], moTx = [];
  const SK = 'amore_fin_v5';
  const LS  = () => { try { return JSON.parse(localStorage.getItem(SK)||'{}'); } catch { return {}; } };
  const SS  = o  => localStorage.setItem(SK, JSON.stringify(Object.assign(LS(),o)));
  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
  const fmtN = n => Math.round(Math.abs(n)).toLocaleString('uk-UA')+' ₴';
  const today = () => new Date().toISOString().slice(0,10);

  // ── ІНІТ ──
  function initDate() { const n=new Date(); yr=n.getFullYear(); mo=n.getMonth(); }

  function moRange() {
    return {
      s: new Date(yr,mo,1).toISOString().slice(0,10),
      e: new Date(yr,mo+1,1).toISOString().slice(0,10)
    };
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

  function whoName(uid) {
    if (!uid) return null;
    try { return (Auth._getUsers()||[]).find(u=>u.id===uid)?.name||null; } catch { return null; }
  }

  // ── БАЛАНС (без тумбочки) ──
  function renderBalance() {
    const bal = allTx
      .filter(t=>t.category!=='Тумбочка')
      .reduce((a,t)=>a+(t.type==='income'?+t.amount:-t.amount),0);
    if(el('balance-total')) el('balance-total').textContent = fmtN(bal);

    const inc = moTx.filter(t=>t.type==='income'&&t.category!=='Тумбочка').reduce((a,t)=>a+ +t.amount,0);
    const exp = moTx.filter(t=>t.type==='expense'&&t.category!=='Тумбочка').reduce((a,t)=>a+ +t.amount,0);
    if(el('fin-month-inc'))  el('fin-month-inc').textContent  = '+'+fmtN(inc);
    if(el('fin-month-exp'))  el('fin-month-exp').textContent  = '-'+fmtN(exp);
    const lbl = `${MONTHS[mo]} ${yr}`;
    if(el('fin-month-label'))     el('fin-month-label').textContent     = lbl;
    if(el('fin-month-label-cal')) el('fin-month-label-cal').textContent = lbl;
  }

  // ── КАЛЕНДАР ──
  function renderCalendar() {
    const wrap=el('fin-calendar'); if(!wrap) return;
    const now=new Date();
    const days=new Date(yr,mo+1,0).getDate();
    const first=(new Date(yr,mo,1).getDay()+6)%7;

    const byDay={};
    moTx.forEach(t=>{
      if(t.category==='Тумбочка') return;
      const d=+t.date.slice(8,10);
      if(!byDay[d]) byDay[d]={inc:0,exp:0};
      t.type==='income' ? byDay[d].inc+=+t.amount : byDay[d].exp+=+t.amount;
    });

    let h='<div class="fin-cal-grid">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(n=>h+=`<div class="fin-cal-head">${n}</div>`);
    for(let i=0;i<first;i++) h+='<div class="fin-cal-cell fin-cal-empty"></div>';
    for(let d=1;d<=days;d++){
      const isToday=d===now.getDate()&&mo===now.getMonth()&&yr===now.getFullYear();
      const data=byDay[d];
      let dots='';
      if(data?.inc) dots+=`<span class="fin-cal-dot fin-dot-in">+${data.inc>=1000?Math.round(data.inc/1000)+'k':Math.round(data.inc)}</span>`;
      if(data?.exp) dots+=`<span class="fin-cal-dot fin-dot-ex">-${data.exp>=1000?Math.round(data.exp/1000)+'k':Math.round(data.exp)}</span>`;
      h+=`<div class="fin-cal-cell${isToday?' fin-cal-today':''}" data-day="${d}">${d}${dots}</div>`;
    }
    h+='</div>';
    wrap.innerHTML=h;
    wrap.querySelectorAll('[data-day]').forEach(c=>
      c.addEventListener('click',()=>showDayModal(+c.dataset.day)));
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
    openModal(`<h3>${day} ${MONTHS[mo]}</h3>${rows}`);
  }

  // ── АКОРДЕОН ──
  function bindAccordion() {
    document.querySelectorAll('.fin-acc-head').forEach(btn=>{
      if(btn.dataset.bound) return;
      btn.dataset.bound='1';
      btn.addEventListener('click',()=>{
        const item=btn.closest('.fin-acc-item');
        const isOpen=item.classList.contains('open');
        // Закриваємо всі
        document.querySelectorAll('.fin-acc-item').forEach(i=>i.classList.remove('open'));
        if(!isOpen) {
          item.classList.add('open');
          // lazy render
          const key=btn.dataset.acc;
          if(key==='wishes')  renderPersonalWishes();
          if(key==='goals')   renderGlobalGoals();
          if(key==='journal') renderJournal();
          if(key==='limit')   renderFreeLimit();
        }
      });
    });
  }

  // ── BOTTOM SHEETS ──
  function bindSheetOverlays() {
    // Відкрити
    el('open-income-sheet')?.addEventListener('click',()=>openSheet('income'));
    el('open-expense-sheet')?.addEventListener('click',()=>openSheet('expense'));
    el('open-tumbo-sheet')?.addEventListener('click',()=>openSheet('tumbo'));

    // Закрити по фону
    ['income','expense','tumbo'].forEach(name=>{
      const ov=el(`${name}-sheet-overlay`);
      ov?.addEventListener('click',e=>{ if(e.target===ov) closeSheet(name); });
    });
  }

  function openSheet(name) {
    const ov=el(`${name}-sheet-overlay`);
    if(!ov) return;
    ov.classList.remove('hidden');
    requestAnimationFrame(()=>ov.classList.add('active'));
    // Ставимо сьогоднішню дату
    const dateInp=el(`${name==='tumbo'?'tumbo':name}-date`)||
                  (name==='income'?el('income-date'):el('expense-date'));
    if(dateInp&&!dateInp.value) dateInp.value=today();
  }

  function closeSheet(name) {
    const ov=el(`${name}-sheet-overlay`);
    if(!ov) return;
    ov.classList.remove('active');
    setTimeout(()=>ov.classList.add('hidden'),300);
  }

  // ── CHIPS (категорії) ──
  function bindChips() {
    document.querySelectorAll('.fin-cat-chips').forEach(wrap=>{
      if(wrap.dataset.bound) return;
      wrap.dataset.bound='1';
      wrap.querySelectorAll('.fin-chip').forEach(chip=>{
        chip.addEventListener('click',()=>{
          wrap.querySelectorAll('.fin-chip').forEach(c=>c.classList.remove('active'));
          chip.classList.add('active');
          // Своя категорія для витрати
          const custom=el('expense-cat-custom');
          if(custom) custom.classList.toggle('hidden', chip.dataset.cat!=='__custom__');
        });
      });
    });
  }

  function getSelectedChip(wrId) {
    const active=el(wrId)?.querySelector('.fin-chip.active');
    if(!active) return 'Інше';
    if(active.dataset.cat==='__custom__') return el('expense-cat-custom')?.value.trim()||'Інше';
    return active.dataset.cat;
  }

  // ── ФОРМА ДОХОДУ ──
  function bindIncomeForm() {
    const btn=el('income-save'); if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',async()=>{
      const amount=parseFloat(el('income-amount')?.value);
      const cat=getSelectedChip('income-cat-chips');
      const date=el('income-date')?.value||today();
      const desc=el('income-desc')?.value.trim();
      if(!amount||amount<=0){shake(el('income-amount'));return;}
      const user=Auth.getCurrentUser();
      await supabase.from('transactions').insert({
        amount,type:'income',category:cat,date,
        description:desc||null,created_by:user?.id||null
      });
      el('income-amount').value='';
      el('income-desc').value='';
      closeSheet('income');
      refresh();
    });
  }

  // ── ФОРМА ВИТРАТИ ──
  function bindExpenseForm() {
    const btn=el('expense-save'); if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',async()=>{
      const amount=parseFloat(el('expense-amount')?.value);
      const cat=getSelectedChip('expense-cat-chips');
      const date=el('expense-date')?.value||today();
      const desc=el('expense-desc')?.value.trim();
      if(!amount||amount<=0){shake(el('expense-amount'));return;}
      const user=Auth.getCurrentUser();
      await supabase.from('transactions').insert({
        amount,type:'expense',category:cat,date,
        description:desc||null,created_by:user?.id||null
      });
      el('expense-amount').value='';
      el('expense-desc')&&(el('expense-desc').value='');
      closeSheet('expense');
      refresh();
    });
  }

  // ── ТУМБОЧКА ──
  function renderTumbochka() {
    const total=allTx
      .filter(t=>t.category==='Тумбочка')
      .reduce((s,t)=>s+(t.type==='income'?+t.amount:-t.amount),0);
    if(el('tumbo-balance')) el('tumbo-balance').textContent=fmtN(total);
  }

  function bindTumbochka() {
    // Перемикач режимів
    document.querySelectorAll('.tumbo-mode-btn').forEach(btn=>{
      if(btn.dataset.bound) return;
      btn.dataset.bound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tumbo-mode-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.tumbo-mode-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        el('tumbo-panel-'+btn.dataset.mode)?.classList.add('active');
      });
    });

    // Режим 1: вже є кошти
    const manInp=el('tumbo-manual-inp'), manBtn=el('tumbo-manual-btn');
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
        closeSheet('tumbo');
        refresh();
      };
      manBtn?.addEventListener('click',save);
      manInp.addEventListener('keydown',e=>e.key==='Enter'&&save());
    }

    // Режим 2: з доходу
    const incInp=el('tumbo-income-inp');
    const optBtns=document.querySelectorAll('.tumbo-pct-btn');
    const calcEl=el('tumbo-calc');
    const restEl=el('tumbo-rest');
    if(!incInp||incInp.dataset.bound) return;
    incInp.dataset.bound='1';

    let curAmt=0, curPct=15;

    const upd=()=>{
      const save=Math.round(curAmt*curPct/100);
      const rest=curAmt-save;
      if(calcEl) calcEl.textContent=fmtN(save);
      if(restEl) restEl.textContent=fmtN(rest);
    };

    incInp.addEventListener('input',()=>{
      curAmt=parseFloat(incInp.value)||0;
      upd();
    });

    optBtns.forEach(b=>b.addEventListener('click',()=>{
      curPct=parseInt(b.dataset.pct)||0;
      optBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      upd();
    }));

    const conf=el('tumbo-confirm');
    if(conf&&!conf.dataset.bound){
      conf.dataset.bound='1';
      conf.addEventListener('click',async()=>{
        const v=parseFloat(incInp.value);
        if(!v||v<=0){shake(incInp);return;}
        const user=Auth.getCurrentUser();
        const toSave=Math.round(v*curPct/100);
        await supabase.from('transactions').insert({
          amount:v,type:'income',category:'Зарплата',
          date:today(),description:null,created_by:user?.id||null
        });
        if(toSave>0) await supabase.from('transactions').insert({
          amount:toSave,type:'expense',category:'Тумбочка',
          date:today(),description:'Відкладено з доходу',created_by:user?.id||null
        });
        incInp.value='';
        closeSheet('tumbo');
        refresh();
      });
    }
  }

  // ── ЛІМІТ ──
  async function renderFreeLimit() {
    const user=Auth.getCurrentUser();
    const {data:fl}=await supabase.from('free_limit').select('*').eq('id',1).single();
    const limit=fl?.limit_value||0;
    const proposal=fl?.proposal_value?{value:fl.proposal_value,proposedBy:fl.proposed_by}:null;

    const slider=el('free-limit-slider'),display=el('free-limit-display');
    if(slider&&!slider.dataset.bound){
      slider.dataset.bound='1';
      slider.value=limit||2000;
      if(display) display.textContent=fmtN(slider.value);
      slider.addEventListener('input',()=>{ if(display) display.textContent=fmtN(slider.value); });
    }

    const propBtn=el('free-limit-propose');
    if(propBtn&&!propBtn.dataset.bound){
      propBtn.dataset.bound='1';
      propBtn.addEventListener('click',async()=>{
        const v=parseInt(slider?.value||2000);
        await supabase.from('free_limit').update({
          proposal_value:v,proposed_by:user?.name||'?',
        }).eq('id',1);
        renderFreeLimit();
      });
    }

    const propPanel=el('free-limit-proposal-panel');
    const propText=el('free-limit-proposal-text');
    const propConf=el('free-limit-proposal-confirm');
    const propRej=el('free-limit-proposal-reject');

    if(proposal&&proposal.proposedBy!==user?.name){
      propPanel?.classList.add('visible');
      if(propText) propText.textContent=`${proposal.proposedBy} пропонує: ${fmtN(proposal.value)}`;
      if(propConf&&!propConf.dataset.bound){
        propConf.dataset.bound='1';
        propConf.addEventListener('click',async()=>{
          await supabase.from('free_limit').update({
            limit_value:proposal.value,proposal_value:null,proposed_by:null,
            tg_chat_id:null,tg_message_id:null,
          }).eq('id',1);
          renderFreeLimit();
        });
      }
      if(propRej&&!propRej.dataset.bound){
        propRej.dataset.bound='1';
        propRej.addEventListener('click',async()=>{
          await supabase.from('free_limit').update({
            proposal_value:null,proposed_by:null,tg_chat_id:null,tg_message_id:null,
          }).eq('id',1);
          renderFreeLimit();
        });
      }
    } else {
      propPanel?.classList.remove('visible');
    }

    if(el('free-limit-current'))
      el('free-limit-current').textContent=limit>0?fmtN(limit):'не встановлено';

    const curLimit=limit;
    const dimaSpent=moTx.filter(t=>t.type==='expense'&&t.category==='Особисті (Діма)').reduce((a,t)=>a+ +t.amount,0);
    const lenaSpent=moTx.filter(t=>t.type==='expense'&&t.category==='Особисті (Лєна)').reduce((a,t)=>a+ +t.amount,0);
    const pD=curLimit>0?Math.min(100,Math.round(dimaSpent/curLimit*100)):0;
    const pL=curLimit>0?Math.min(100,Math.round(lenaSpent/curLimit*100)):0;
    if(el('free-dima-bar'))  el('free-dima-bar').style.width=pD+'%';
    if(el('free-lena-bar'))  el('free-lena-bar').style.width=pL+'%';
    if(el('free-dima-used')) el('free-dima-used').textContent=`${fmtN(dimaSpent)} з ${fmtN(curLimit)}`;
    if(el('free-lena-used')) el('free-lena-used').textContent=`${fmtN(lenaSpent)} з ${fmtN(curLimit)}`;
  }

  // ── ЖУРНАЛ ──
  function renderJournal() {
    const wrap=el('fin-journal'); if(!wrap) return;
    if(!moTx.length){wrap.innerHTML='<p class="empty-state">Записів немає.</p>';return;}
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
      b.addEventListener('click',async()=>{
        if(!confirm('Видалити?')) return;
        await supabase.from('transactions').delete().eq('id',b.dataset.id);
        refresh();
      }));
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
          ${w.owner?`<span class="wish-row-owner">${esc(w.owner)}</span>`:''}
        </div>
        <span class="wish-row-price">${fmtN(w.price||0)}</span>
        <button class="fin-del-btn" data-wish="${w.id}">×</button>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-wish]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Видалити?')) return;
      await supabase.from('personal_wishes').delete().eq('id',b.dataset.wish);
      renderPersonalWishes();
    }));
  }

  function bindAddWish() {
    const btn=el('add-wish-btn'); if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const user=Auth.getCurrentUser();
      openModal(`
        <h3>Моє бажання</h3>
        <div class="form-field"><label>Назва</label><input id="mw-name" type="text" class="fin-inp" placeholder="Що хочу?"></div>
        <div class="form-field"><label>Ціна, ₴</label><input id="mw-price" type="number" class="fin-inp" min="0" placeholder="0"></div>
        <div class="form-field"><label>Посилання</label><input id="mw-url" type="url" class="fin-inp" placeholder="https://..."></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="mw-cancel">Скасувати</button>
          <button class="btn-primary" id="mw-save">Зберегти</button>
        </div>`);
      el('mw-cancel')?.addEventListener('click',closeModal);
      el('mw-save')?.addEventListener('click',async()=>{
        const name=el('mw-name').value.trim();
        if(!name){shake(el('mw-name'));return;}
        await supabase.from('personal_wishes').insert({
          name,price:parseFloat(el('mw-price').value)||0,
          url:el('mw-url').value.trim()||null,owner:user?.name||null
        });
        closeModal(); renderPersonalWishes();
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
          ${isPending?`<span class="goal-status-badge">⏳ Очікує ${esc(g.proposed_by==='Діма'?'Лєни':'Діми')}</span>`:''}
          ${g.status==='confirmed'?'<span class="goal-status-badge goal-confirmed">✅ Підтверджено</span>':''}
        </div>
        <div class="goal-row-right">
          <span class="goal-row-price">${fmtN(g.target_amount||0)}</span>
          ${canVote?`<div class="goal-vote-btns">
            <button class="btn-primary" style="padding:5px 12px;font-size:12px" data-confirm="${g.id}">✓</button>
            <button class="btn-secondary" style="padding:5px 12px;font-size:12px" data-reject="${g.id}">✕</button>
          </div>`:''}
          ${(!isPending || g.proposed_by===user?.name)?`<button class="fin-del-btn" data-gid="${g.id}">×</button>`:''}
        </div>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',async()=>{
      await supabase.from('savings_goals').update({status:'confirmed'}).eq('id',b.dataset.confirm);
      renderGlobalGoals();
    }));
    wrap.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Відхилити?')) return;
      await supabase.from('savings_goals').delete().eq('id',b.dataset.reject);
      renderGlobalGoals();
    }));
    wrap.querySelectorAll('[data-gid]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Видалити?')) return;
      await supabase.from('savings_goals').delete().eq('id',b.dataset.gid);
      renderGlobalGoals();
    }));
  }

  function bindAddGoal() {
    const btn=el('add-goal-btn'); if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const user=Auth.getCurrentUser();
      openModal(`
        <h3>Спільна ціль</h3>
        <div class="form-field"><label>Назва</label><input id="gg-name" type="text" class="fin-inp" placeholder="Що плануємо?"></div>
        <div class="form-field"><label>Навіщо</label><input id="gg-desc" type="text" class="fin-inp" placeholder="Опис"></div>
        <div class="form-field"><label>Вартість, ₴</label><input id="gg-price" type="number" class="fin-inp" min="0" placeholder="0"></div>
        <div class="form-field"><label>Посилання</label><input id="gg-url" type="url" class="fin-inp" placeholder="https://..."></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="gg-cancel">Скасувати</button>
          <button class="btn-primary" id="gg-save">Відправити →</button>
        </div>`);
      el('gg-cancel')?.addEventListener('click',closeModal);
      el('gg-save')?.addEventListener('click',async()=>{
        const name=el('gg-name').value.trim();
        if(!name){shake(el('gg-name'));return;}
        await supabase.from('savings_goals').insert({
          name,description:el('gg-desc').value.trim()||null,
          target_amount:parseFloat(el('gg-price').value)||0,
          url:el('gg-url').value.trim()||null,
          status:'pending',proposed_by:user?.name||null,saved_amount:0
        });
        closeModal(); renderGlobalGoals();
      });
    });
  }

  // ── МОДАЛКИ ──
  function openModal(html){
    el('modal-root').innerHTML=`
      <div class="modal-overlay" id="fin-modal-ov">
        <div class="modal-card">${html}</div>
      </div>`;
    el('fin-modal-ov')?.addEventListener('click',e=>{ if(e.target.id==='fin-modal-ov') closeModal(); });
  }
  function closeModal(){ el('modal-root').innerHTML=''; }

  function shake(inp){
    if(!inp) return;
    inp.style.borderColor='var(--danger)';
    inp.classList.add('shake');
    setTimeout(()=>{ inp.style.borderColor=''; inp.classList.remove('shake'); },900);
  }

  // ── МІСЯЦЬ ──
  function changeMonth(d){
    mo+=d; if(mo<0){mo=11;yr--;} if(mo>11){mo=0;yr++;}
    fetchMonth().then(()=>{ renderBalance(); renderCalendar(); renderJournal(); });
  }

  // ── РЕФРЕШ ──
  async function refresh(){
    await Promise.all([fetchAll(),fetchMonth()]);
    renderBalance();
    renderCalendar();
    renderTumbochka();
    bindTumbochka();
    // Якщо акордеон відкритий — оновлюємо вміст
    const openAcc=document.querySelector('.fin-acc-item.open .fin-acc-head');
    if(openAcc){
      const key=openAcc.dataset.acc;
      if(key==='journal') renderJournal();
      if(key==='limit')   renderFreeLimit();
      if(key==='wishes')  renderPersonalWishes();
      if(key==='goals')   renderGlobalGoals();
    }
  }

  function init(){
    initDate();
    bindSheetOverlays();
    bindChips();
    bindIncomeForm();
    bindExpenseForm();
    bindAccordion();
    bindAddWish();
    bindAddGoal();
    el('fin-prev-month')?.addEventListener('click',()=>changeMonth(-1));
    el('fin-next-month')?.addEventListener('click',()=>changeMonth(1));
    window.addEventListener('portal:view',e=>{
      if(e.detail.view==='budget'){
        bindChips(); bindIncomeForm(); bindExpenseForm();
        bindAccordion(); bindAddWish(); bindAddGoal();
        refresh();
      }
    });
  }

  return { init, refresh };
})();

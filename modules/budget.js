// ============================================================
// FINANCE MODULE v7 — Тумбочка · Ліміт · Спільні цілі
// ============================================================
const Budget = (() => {
  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };
  const fmtN = n => Math.round(Math.abs(n)).toLocaleString('uk-UA')+' ₴';
  const today = () => new Date().toISOString().slice(0,10);
  const fmtDate = s => {
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('uk-UA',{day:'numeric',month:'short',year:'numeric'});
  };

  // ── ТУМБОЧКА: баланс ──────────────────────────────────────
  async function fetchTumboBalance() {
    const {data} = await supabase.from('transactions')
      .select('amount,type').eq('category','Тумбочка');
    const total = (data||[]).reduce((s,t)=>s+(t.type==='income'?+t.amount:-+t.amount),0);
    if(el('tumbo-balance')) el('tumbo-balance').textContent = fmtN(total);
    return total;
  }

  // ── ТУМБОЧКА: модалка ─────────────────────────────────────
  function openTumboModal(balance) {
    openModal(`
      <div class="tumbo-modal-header">
        <div class="tumbo-modal-icon-wrap">🗄️</div>
        <div>
          <div class="tumbo-modal-label">Тумбочка</div>
          <div class="tumbo-modal-balance">${fmtN(balance)}</div>
        </div>
      </div>

      <div class="tumbo-mode-tabs" style="margin:16px 0 8px">
        <button class="tumbo-mode-btn active" data-mode="manual">Поповнити</button>
        <button class="tumbo-mode-btn" data-mode="income">З доходу</button>
        <button class="tumbo-mode-btn" data-mode="withdraw">Зняти</button>
        <button class="tumbo-mode-btn" data-mode="journal">📋</button>
      </div>

      <!-- Поповнити -->
      <div class="tumbo-mode-panel active" id="tumbo-panel-manual">
        <p class="tumbo-hint">Внесіть суму яка вже є у вас відкладена — вона просто додасться до тумбочки.</p>
        <input type="number" id="tumbo-manual-inp" class="fin-inp fin-inp-big"
               placeholder="0 ₴" min="0" inputmode="decimal" style="text-align:center">
        <input type="text" id="tumbo-manual-comment" class="fin-inp" style="margin-top:8px"
               placeholder="Коментар (необов'язково)">
        <button class="btn-primary" id="tumbo-manual-btn" style="width:100%;margin-top:14px">
          Додати до тумбочки
        </button>
      </div>

      <!-- З доходу -->
      <div class="tumbo-mode-panel" id="tumbo-panel-income">
        <p class="tumbo-hint">Введіть суму доходу — система відкладе вибраний % і запише решту як дохід.</p>
        <input type="number" id="tumbo-income-inp" class="fin-inp fin-inp-big"
               placeholder="0 ₴" min="0" inputmode="decimal" style="text-align:center">
        <div class="tumbo-pct-grid" style="margin-top:12px">
          <button class="tumbo-pct-btn" data-pct="10">10%</button>
          <button class="tumbo-pct-btn active" data-pct="15">15%</button>
          <button class="tumbo-pct-btn" data-pct="20">20%</button>
          <button class="tumbo-pct-btn" data-pct="50">50%</button>
        </div>
        <div class="tumbo-calc-preview" style="margin-top:14px">
          <span class="tumbo-calc-line"><span>В тумбочку</span><b id="tumbo-calc">0 ₴</b></span>
          <span class="tumbo-calc-line tumbo-calc-rest"><span>Залишок (дохід)</span><b id="tumbo-rest">0 ₴</b></span>
        </div>
        <button class="btn-primary" id="tumbo-confirm" style="width:100%;margin-top:14px">
          ✓ Підтвердити
        </button>
      </div>

      <!-- Зняти -->
      <div class="tumbo-mode-panel" id="tumbo-panel-withdraw">
        <p class="tumbo-hint">Вкажіть суму яку хочете зняти з тумбочки — баланс зменшиться.</p>
        <input type="number" id="tumbo-withdraw-inp" class="fin-inp fin-inp-big"
               placeholder="0 ₴" min="0" inputmode="decimal" style="text-align:center">
        <p class="tumbo-hint" style="margin-top:8px;color:var(--text-muted)">Доступно: <b>${fmtN(balance)}</b></p>
        <input type="text" id="tumbo-withdraw-comment" class="fin-inp" style="margin-top:8px"
               placeholder="Навіщо знімаємо? (необов'язково)">
        <button class="btn-secondary" id="tumbo-withdraw-btn"
                style="width:100%;margin-top:14px;background:#fce4ec;color:#c62828;border-color:#ef9a9a">
          Зняти з тумбочки
        </button>
      </div>

      <!-- Журнал -->
      <div class="tumbo-mode-panel tumbo-journal-panel" id="tumbo-panel-journal">
        <div id="tumbo-journal-list">
          <p class="tumbo-hint" style="text-align:center;padding:20px 0">Завантаження…</p>
        </div>
      </div>
    `);
    bindTumboModal();
  }

  function bindTumboModal() {
    // Перемикач вкладок
    document.querySelectorAll('.tumbo-mode-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tumbo-mode-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.tumbo-mode-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        el('tumbo-panel-'+btn.dataset.mode)?.classList.add('active');
        if(btn.dataset.mode==='journal') renderTumboJournal();
      });
    });

    // Режим 1: Поповнити
    const manInp     = el('tumbo-manual-inp');
    const manComment = el('tumbo-manual-comment');
    el('tumbo-manual-btn')?.addEventListener('click',async()=>{
      const v = parseFloat(manInp?.value);
      if(!v||v<=0){ shake(manInp); return; }
      const user    = Auth.getCurrentUser();
      const comment = manComment?.value.trim();
      await supabase.from('transactions').insert({
        amount:v, type:'income', category:'Тумбочка',
        date:today(), description:comment||'Поповнення', created_by:user?.id||null
      });
      closeModal(); fetchTumboBalance();
    });

    // Режим 2: З доходу
    const incInp = el('tumbo-income-inp');
    let curAmt=0, curPct=15;
    const upd = ()=>{
      const save = Math.round(curAmt*curPct/100);
      if(el('tumbo-calc')) el('tumbo-calc').textContent = fmtN(save);
      if(el('tumbo-rest')) el('tumbo-rest').textContent = fmtN(curAmt-save);
    };
    incInp?.addEventListener('input',()=>{ curAmt=parseFloat(incInp.value)||0; upd(); });
    document.querySelectorAll('.tumbo-pct-btn').forEach(b=>{
      b.addEventListener('click',()=>{
        curPct = parseInt(b.dataset.pct)||0;
        document.querySelectorAll('.tumbo-pct-btn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        upd();
      });
    });
    el('tumbo-confirm')?.addEventListener('click',async()=>{
      const v = parseFloat(incInp?.value);
      if(!v||v<=0){ shake(incInp); return; }
      const user    = Auth.getCurrentUser();
      const toSave  = Math.round(v*curPct/100);
      await supabase.from('transactions').insert({
        amount:v, type:'income', category:'Зарплата',
        date:today(), description:null, created_by:user?.id||null
      });
      if(toSave>0) await supabase.from('transactions').insert({
        amount:toSave, type:'expense', category:'Тумбочка',
        date:today(), description:'Відкладено з доходу', created_by:user?.id||null
      });
      closeModal(); fetchTumboBalance();
    });

    // Режим 3: Зняти
    const wdInp     = el('tumbo-withdraw-inp');
    const wdComment = el('tumbo-withdraw-comment');
    el('tumbo-withdraw-btn')?.addEventListener('click',async()=>{
      const v = parseFloat(wdInp?.value);
      if(!v||v<=0){ shake(wdInp); return; }
      const user    = Auth.getCurrentUser();
      const comment = wdComment?.value.trim();
      await supabase.from('transactions').insert({
        amount:v, type:'expense', category:'Тумбочка',
        date:today(), description:comment||'Зняття', created_by:user?.id||null
      });
      closeModal(); fetchTumboBalance();
    });
  }

  // ── ЖУРНАЛ ТУМБОЧКИ ───────────────────────────────────────
  async function renderTumboJournal() {
    const wrap = el('tumbo-journal-list'); if(!wrap) return;
    wrap.innerHTML = '<p class="tumbo-hint" style="text-align:center;padding:16px 0">Завантаження…</p>';

    const [{data:txs},{data:users}] = await Promise.all([
      supabase.from('transactions')
        .select('id,amount,type,date,description,created_by,created_at')
        .eq('category','Тумбочка')
        .order('created_at',{ascending:false})
        .limit(100),
      supabase.from('users').select('id,name')
    ]);

    if(!txs?.length){
      wrap.innerHTML='<p class="empty-state" style="padding:20px 0 8px">Журнал ще порожній</p>';
      return;
    }

    const userMap = (users||[]).reduce((m,u)=>{ m[u.id]=u.name; return m; },{});

    // Поточний баланс по рядках (починаємо з нуля, читаємо у зворотному порядку)
    const sorted = [...txs].reverse();
    const running = [];
    let acc = 0;
    sorted.forEach(t=>{
      acc += t.type==='income' ? +t.amount : -+t.amount;
      running.unshift(acc); // prepend, щоб відповідало порядку txs
    });

    wrap.innerHTML = txs.map((t,i)=>{
      const isIn  = t.type==='income';
      const emoji = isIn ? '📥' : '📤';
      const sign  = isIn ? '+' : '−';
      const amtCls= isIn ? 'pos' : 'neg';
      const bal   = running[i];

      // Тип операції — людська назва
      const desc = t.description||'';
      let label = isIn ? 'Поповнення' : 'Зняття';
      if(desc==='Відкладено з доходу') label='З доходу';

      // Коментар (те, що ввів юзер) — все крім системних фраз
      const SYSTEM = ['Поповнення','Зняття','Відкладено з доходу','Вже відкладено','Знято з тумбочки'];
      const comment = SYSTEM.includes(desc) ? '' : desc;

      const who  = userMap[t.created_by] ? ` · ${esc(userMap[t.created_by])}` : '';
      const date = fmtDate(t.date || t.created_at);

      return `
        <div class="tumbo-log-row">
          <div class="tumbo-log-icon">${emoji}</div>
          <div class="tumbo-log-info">
            <span class="tumbo-log-label">${label}${who}</span>
            ${comment?`<span class="tumbo-log-comment">${esc(comment)}</span>`:''}
            <span class="tumbo-log-date">${date}</span>
          </div>
          <div class="tumbo-log-right">
            <span class="tumbo-log-amount ${amtCls}">${sign}${fmtN(t.amount)}</span>
            <span class="tumbo-log-balance">${fmtN(bal)}</span>
          </div>
        </div>`;
    }).join('');
  }

  // ── ЛІМІТ ─────────────────────────────────────────────────
  async function renderFreeLimit() {
    const user = Auth.getCurrentUser();
    const {data:fl} = await supabase.from('free_limit').select('*').eq('id',1).single();
    const limit    = fl?.limit_value||0;
    const proposal = fl?.proposal_value
      ? {value:fl.proposal_value, proposedBy:fl.proposed_by} : null;

    if(el('free-limit-current'))
      el('free-limit-current').textContent = limit>0 ? fmtN(limit) : 'не встановлено';

    const slider=el('free-limit-slider'), display=el('free-limit-display');
    if(slider&&!slider.dataset.bound){
      slider.dataset.bound='1';
      slider.value = limit||2000;
      if(display) display.textContent = fmtN(slider.value);
      slider.addEventListener('input',()=>{ if(display) display.textContent=fmtN(slider.value); });
    }

    const propBtn = el('free-limit-propose');
    if(propBtn&&!propBtn.dataset.bound){
      propBtn.dataset.bound='1';
      propBtn.addEventListener('click',async()=>{
        const v = parseInt(slider?.value||2000);
        await supabase.from('free_limit').update({
          proposal_value:v, proposed_by:user?.name||'?'
        }).eq('id',1);
        renderFreeLimit();
      });
    }

    const propPanel = el('free-limit-proposal-panel');
    const propText  = el('free-limit-proposal-text');
    const propConf  = el('free-limit-proposal-confirm');
    const propRej   = el('free-limit-proposal-reject');

    if(proposal && proposal.proposedBy!==user?.name){
      propPanel?.classList.add('visible');
      if(propText) propText.textContent = `${proposal.proposedBy} пропонує: ${fmtN(proposal.value)}`;
      if(propConf&&!propConf.dataset.bound){
        propConf.dataset.bound='1';
        propConf.addEventListener('click',async()=>{
          await supabase.from('free_limit').update({
            limit_value:proposal.value, proposal_value:null, proposed_by:null,
            tg_chat_id:null, tg_message_id:null
          }).eq('id',1);
          renderFreeLimit();
        });
      }
      if(propRej&&!propRej.dataset.bound){
        propRej.dataset.bound='1';
        propRej.addEventListener('click',async()=>{
          await supabase.from('free_limit').update({
            proposal_value:null, proposed_by:null, tg_chat_id:null, tg_message_id:null
          }).eq('id',1);
          renderFreeLimit();
        });
      }
    } else {
      propPanel?.classList.remove('visible');
    }
  }

  // ── ГЛОБАЛЬНІ ЦІЛІ ────────────────────────────────────────
  async function renderGlobalGoals() {
    const wrap = el('global-goals-list'); if(!wrap) return;
    const {data} = await supabase.from('savings_goals')
      .select('id,name,target_amount,url,description,status,proposed_by')
      .order('created_at',{ascending:false});
    if(!data?.length){
      wrap.innerHTML='<p class="empty-state">Спільних цілей ще немає.</p>';
      return;
    }
    wrap.innerHTML='';
    const user = Auth.getCurrentUser();
    data.forEach(g=>{
      const isPending = g.status==='pending';
      const canVote   = isPending && g.proposed_by!==user?.name;
      const item = document.createElement('div');
      item.className = `goal-row${isPending?' goal-pending':''}`;
      item.innerHTML = `
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
          ${(!isPending||g.proposed_by===user?.name)?`<button class="fin-del-btn" data-gid="${g.id}">×</button>`:''}
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
    const btn = el('add-goal-btn'); if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const user = Auth.getCurrentUser();
      openModal(`
        <h3>Спільна ціль</h3>
        <div class="form-field"><label>Назва</label>
          <input id="gg-name" type="text" class="fin-inp" placeholder="Що плануємо?"></div>
        <div class="form-field"><label>Навіщо</label>
          <input id="gg-desc" type="text" class="fin-inp" placeholder="Опис"></div>
        <div class="form-field"><label>Вартість, ₴</label>
          <input id="gg-price" type="number" class="fin-inp" min="0" placeholder="0"></div>
        <div class="form-field"><label>Посилання</label>
          <input id="gg-url" type="url" class="fin-inp" placeholder="https://..."></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="gg-cancel">Скасувати</button>
          <button class="btn-primary"   id="gg-save">Відправити →</button>
        </div>`);
      el('gg-cancel')?.addEventListener('click',closeModal);
      el('gg-save')?.addEventListener('click',async()=>{
        const name = el('gg-name').value.trim();
        if(!name){ shake(el('gg-name')); return; }
        await supabase.from('savings_goals').insert({
          name,
          description: el('gg-desc').value.trim()||null,
          target_amount: parseFloat(el('gg-price').value)||0,
          url: el('gg-url').value.trim()||null,
          status:'pending', proposed_by:user?.name||null, saved_amount:0
        });
        closeModal(); renderGlobalGoals();
      });
    });
  }

  // ── МОДАЛКИ ───────────────────────────────────────────────
  function openModal(html){
    el('modal-root').innerHTML=`
      <div class="modal-overlay" id="fin-modal-ov">
        <div class="modal-card">${html}</div>
      </div>`;
    const ov = el('fin-modal-ov');
    ov?.addEventListener('click',e=>{ if(e.target.id==='fin-modal-ov') closeModal(); });
    if(window.visualViewport && ov){
      const sync = ()=>{
        const vv = window.visualViewport;
        ov.style.height  = vv.height+'px';
        ov.style.top     = vv.offsetTop+'px';
      };
      sync();
      window.visualViewport.addEventListener('resize',sync);
      window.visualViewport.addEventListener('scroll',sync);
      ov._syncVV = sync;
    }
  }
  function closeModal(){
    const ov = el('fin-modal-ov');
    if(window.visualViewport && ov?._syncVV){
      window.visualViewport.removeEventListener('resize',ov._syncVV);
      window.visualViewport.removeEventListener('scroll',ov._syncVV);
    }
    el('modal-root').innerHTML='';
  }

  function shake(inp){
    if(!inp) return;
    inp.style.borderColor='var(--danger)';
    inp.classList.add('shake');
    setTimeout(()=>{ inp.style.borderColor=''; inp.classList.remove('shake'); },900);
  }

  // ── РЕФРЕШ ────────────────────────────────────────────────
  async function refresh(){
    await fetchTumboBalance();
    renderFreeLimit();
    renderGlobalGoals();
  }

  // ── ІНІТ ──────────────────────────────────────────────────
  function init(){
    el('open-tumbo-modal')?.addEventListener('click',async()=>{
      const {data} = await supabase.from('transactions')
        .select('amount,type').eq('category','Тумбочка');
      const total = (data||[]).reduce((s,t)=>s+(t.type==='income'?+t.amount:-+t.amount),0);
      openTumboModal(total);
    });
    bindAddGoal();
    window.addEventListener('portal:view',e=>{
      if(e.detail.view==='budget'){ bindAddGoal(); refresh(); }
    });
  }

  return { init, refresh };
})();

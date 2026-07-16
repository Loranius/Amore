// ============================================================
// FINANCE MODULE v8 — Ліміт · Спільні цілі
// ============================================================
import { supabase } from '../lib/supabase.js';
import { DataCache } from '../lib/cache.js';
import { Auth } from './auth.js';
import { closeModalAnimated } from '../lib/modal.js';

/** @typedef {HTMLElement & {_syncVV?: () => void}} FinOverlay */

/** @param {string} id @returns {HTMLElement | null} */
const el  = id => document.getElementById(id);
/** @param {string} s @returns {string} */
const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
/** @param {number | string} n @returns {string} */
const fmtN = n => Math.round(Math.abs(Number(n))).toLocaleString('uk-UA')+' ₴';

// Актуальна пропозиція ліміту. Обробники кнопок ✓/✕ прив'язуються
// лише один раз (dataset.bound), тому читають значення звідси,
// а не з замикання першого рендеру — інакше підтвердження другої
// пропозиції записувало б суму з першої (старий баг).
/** @type {FreeLimitProposal | null} */
let currentProposal = null;

// ── ЛІМІТ ─────────────────────────────────────────────────
/** @returns {Promise<Partial<FreeLimitRow>>} */
async function fetchFreeLimit() {
  const {data} = /** @type {SupaResult<FreeLimitRow>} */ (await supabase.from('free_limit').select('limit_value,proposal_value,proposed_by').eq('id',1).single());
  return data || {};
}
function renderFreeLimit() {
  DataCache.swr('free_limit', fetchFreeLimit, paintFreeLimit);
}
/** @param {Partial<FreeLimitRow> | null} fl @returns {void} */
function paintFreeLimit(fl) {
  const user = Auth.getCurrentUser();
  const limit    = fl?.limit_value||0;
  const proposal = fl?.proposal_value
    ? {value:fl.proposal_value, proposedBy:fl.proposed_by ?? null} : null;
  currentProposal = proposal;

  const curEl = el('free-limit-current');
  if(curEl) curEl.textContent = limit>0 ? fmtN(limit) : 'не встановлено';

  const slider = /** @type {HTMLInputElement | null} */ (el('free-limit-slider')), display=el('free-limit-display');
  if(slider){
    // Значення слайдера оновлюємо при кожному рендері (ліміт міг змінитись),
    // але НЕ поки користувач його тягне — інакше realtime-подія від партнера
    // збила б позицію просто під пальцем.
    if(document.activeElement !== slider){
      slider.value = String(limit||2000);
      if(display) display.textContent = fmtN(slider.value);
    }
    // Обробник input прив'язуємо лише один раз
    if(!slider.dataset.bound){
      slider.dataset.bound='1';
      slider.addEventListener('input',()=>{ if(display) display.textContent=fmtN(slider.value); });
    }
  }

  const propBtn = el('free-limit-propose');
  if(propBtn&&!propBtn.dataset.bound){
    propBtn.dataset.bound='1';
    propBtn.addEventListener('click',async()=>{
      const v = parseInt(String(slider?.value||2000));
      await supabase.from('free_limit').update({
        proposal_value:v, proposed_by:user?.name||'?'
      }).eq('id',1);
      DataCache.invalidate('free_limit'); renderFreeLimit();
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
        if(!currentProposal) return;
        await supabase.from('free_limit').update({
          limit_value:currentProposal.value, proposal_value:null, proposed_by:null,
          tg_chat_id:null, tg_message_id:null
        }).eq('id',1);
        DataCache.invalidate('free_limit'); renderFreeLimit();
      });
    }
    if(propRej&&!propRej.dataset.bound){
      propRej.dataset.bound='1';
      propRej.addEventListener('click',async()=>{
        await supabase.from('free_limit').update({
          proposal_value:null, proposed_by:null, tg_chat_id:null, tg_message_id:null
        }).eq('id',1);
        DataCache.invalidate('free_limit'); renderFreeLimit();
      });
    }
  } else {
    propPanel?.classList.remove('visible');
  }
}

// ── ГЛОБАЛЬНІ ЦІЛІ ────────────────────────────────────────
/** @returns {Promise<SavingsGoal[]>} */
async function fetchGoals() {
  const {data} = /** @type {SupaResult<SavingsGoal[]>} */ (await supabase.from('savings_goals')
    .select('id,name,target_amount,url,description,status,proposed_by,saved_amount')
    .order('created_at',{ascending:false}));
  return data || [];
}
function renderGlobalGoals() {
  DataCache.swr('savings_goals', fetchGoals, paintGoals);
}
/** @param {SavingsGoal[] | null} data @returns {void} */
function paintGoals(data) {
  const wrap = el('global-goals-list'); if(!wrap) return;
  if(!data?.length){
    wrap.innerHTML='<p class="empty-state">Спільних цілей ще немає.</p>';
    return;
  }
  wrap.innerHTML='';
  const user = Auth.getCurrentUser();
  data.forEach(g=>{
    const isPending = g.status==='pending';
    const canVote   = isPending && g.proposed_by!==user?.name;
    const target    = g.target_amount||0;
    const saved     = Math.max(0, g.saved_amount||0);
    const pct       = target>0 ? Math.min(100, Math.round(saved/target*100)) : 0;
    const item = document.createElement('div');
    item.className = `goal-row${isPending?' goal-pending':''}`;
    item.innerHTML = `
      <div class="goal-row-info">
        <span class="goal-row-name">${esc(g.name)}</span>
        ${g.description?`<span class="goal-row-desc">${esc(g.description)}</span>`:''}
        ${g.url?`<a class="wish-row-link" href="${esc(g.url)}" target="_blank" rel="noopener">🔗</a>`:''}
        ${isPending?`<span class="goal-status-badge">⏳ Очікує ${esc(g.proposed_by==='Діма'?'Лєни':'Діми')}</span>`:''}
        ${g.status==='confirmed'?'<span class="goal-status-badge goal-confirmed">✅ Підтверджено</span>':''}
        ${g.status==='confirmed'?`
          <div class="goal-progress-wrap">
            <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
            <div class="goal-progress-meta">
              <span>${fmtN(saved)} / ${fmtN(target)}</span>
              <span class="goal-progress-pct">${pct}%</span>
            </div>
          </div>`:''}
      </div>
      <div class="goal-row-right">
        <span class="goal-row-price">${fmtN(target)}</span>
        ${canVote?`<div class="goal-vote-btns">
          <button class="btn-primary" style="padding:5px 12px;font-size:12px" data-confirm="${g.id}">✓</button>
          <button class="btn-secondary" style="padding:5px 12px;font-size:12px" data-reject="${g.id}">✕</button>
        </div>`:''}
        ${g.status==='confirmed'?`<button class="btn-secondary goal-add-funds-btn" style="padding:5px 12px;font-size:12px" data-addfunds="${g.id}">+ Внести</button>`:''}
        ${(!isPending||g.proposed_by===user?.name)?`<button class="fin-del-btn" data-gid="${g.id}">×</button>`:''}
      </div>`;
    wrap.appendChild(item);
  });
  wrap.querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',async()=>{
    const id = /** @type {HTMLElement} */ (b).dataset.confirm;
    await supabase.from('savings_goals').update({status:'confirmed'}).eq('id',id);
    DataCache.invalidate('savings_goals'); renderGlobalGoals();
  }));
  wrap.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Відхилити?')) return;
    const id = /** @type {HTMLElement} */ (b).dataset.reject;
    await supabase.from('savings_goals').delete().eq('id',id);
    DataCache.invalidate('savings_goals'); renderGlobalGoals();
  }));
  wrap.querySelectorAll('[data-gid]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Видалити?')) return;
    const id = /** @type {HTMLElement} */ (b).dataset.gid;
    await supabase.from('savings_goals').delete().eq('id',id);
    DataCache.invalidate('savings_goals'); renderGlobalGoals();
  }));
  wrap.querySelectorAll('[data-addfunds]').forEach(b=>b.addEventListener('click',()=>{
    const addFundsId = /** @type {HTMLElement} */ (b).dataset.addfunds;
    openAddFundsModal(addFundsId, data.find(g=>String(g.id)===String(addFundsId)));
  }));
}

/** @param {string | undefined} id @param {SavingsGoal | undefined} goal @returns {void} */
function openAddFundsModal(id, goal) {
  if(!goal) return;
  const saved  = Math.max(0, goal.saved_amount||0);
  const target = goal.target_amount||0;
  openModal(`
    <h3>Внесок у ціль</h3>
    <p class="tumbo-hint">«${esc(goal.name)}» — накопичено ${fmtN(saved)} з ${fmtN(target)}</p>
    <div class="form-field"><label>Сума внеску, ₴</label>
      <input id="gf-amount" type="number" class="fin-inp fin-inp-big" min="0" placeholder="0 ₴" style="text-align:center"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="gf-cancel">Скасувати</button>
      <button class="btn-primary" id="gf-save">Додати</button>
    </div>`);
  el('gf-cancel')?.addEventListener('click',closeModal);
  el('gf-save')?.addEventListener('click',async()=>{
    const amountEl = /** @type {HTMLInputElement | null} */ (el('gf-amount'));
    const v = parseFloat(amountEl?.value || '');
    if(!v||v<=0){ shake(amountEl); return; }
    await supabase.from('savings_goals').update({ saved_amount: saved + v }).eq('id', id);
    DataCache.invalidate('savings_goals'); closeModal(); renderGlobalGoals();
  });
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
      const nameEl  = /** @type {HTMLInputElement} */ (el('gg-name'));
      const descEl  = /** @type {HTMLInputElement} */ (el('gg-desc'));
      const priceEl = /** @type {HTMLInputElement} */ (el('gg-price'));
      const urlEl   = /** @type {HTMLInputElement} */ (el('gg-url'));
      const name = nameEl.value.trim();
      if(!name){ shake(nameEl); return; }
      await supabase.from('savings_goals').insert({
        name,
        description: descEl.value.trim()||null,
        target_amount: parseFloat(priceEl.value)||0,
        url: urlEl.value.trim()||null,
        status:'pending', proposed_by:user?.name||null, saved_amount:0
      });
      DataCache.invalidate('savings_goals'); closeModal(); renderGlobalGoals();
    });
  });
}

// ── МОДАЛКИ ───────────────────────────────────────────────
/** @param {string} html @returns {void} */
function openModal(html){
  /** @type {HTMLElement} */ (el('modal-root')).innerHTML=`
    <div class="modal-overlay" id="fin-modal-ov">
      <div class="modal-card">${html}</div>
    </div>`;
  const ov = /** @type {FinOverlay | null} */ (el('fin-modal-ov'));
  ov?.addEventListener('click',e=>{ if(/** @type {HTMLElement} */ (e.target).id==='fin-modal-ov') closeModal(); });
  if(window.visualViewport && ov){
    const vv = window.visualViewport;
    const sync = ()=>{
      ov.style.height  = vv.height+'px';
      ov.style.top     = vv.offsetTop+'px';
    };
    sync();
    vv.addEventListener('resize',sync);
    vv.addEventListener('scroll',sync);
    ov._syncVV = sync;
  }
}
function closeModal(){
  const ov = /** @type {FinOverlay | null} */ (el('fin-modal-ov'));
  if(window.visualViewport && ov?._syncVV){
    window.visualViewport.removeEventListener('resize',ov._syncVV);
    window.visualViewport.removeEventListener('scroll',ov._syncVV);
  }
  closeModalAnimated();
}

/** @param {HTMLElement | null} inp @returns {void} */
function shake(inp){
  if(!inp) return;
  inp.style.borderColor='var(--danger)';
  inp.classList.add('shake');
  setTimeout(()=>{ inp.style.borderColor=''; inp.classList.remove('shake'); },900);
}

// ── РЕФРЕШ ────────────────────────────────────────────────
function refresh(){
  renderFreeLimit();
  renderGlobalGoals();
}

// ── ІНІТ ──────────────────────────────────────────────────
function init(){
  bindAddGoal();
  window.addEventListener('portal:view',e=>{
    if(/** @type {any} */ (e).detail.view==='budget'){ bindAddGoal(); refresh(); }
  });
}

export const Budget = { init, refresh };

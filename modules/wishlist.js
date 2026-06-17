// ============================================================
// WISHLIST MODULE v2
// Вішлист Діми / Лєни + Картка розмірів
// ============================================================
const Wishlist = (() => {

  let allUsers = [];
  let activeOwnerId = null;
  let activeTab = 'dima'; // 'dima' | 'lena' | 'sizes'

  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  // ── ЮЗЕРИ ──
  async function loadUsers() {
    const {data} = await supabase.from('users').select('id,name').order('id',{ascending:true});
    return data||[];
  }

  // ── ITEMS ──
  async function loadItems(ownerId) {
    const {data} = await supabase.from('wishlist_items')
      .select('id,title,description,link,image_url,gift_date,owner,reserved,reserved_by')
      .eq('owner',ownerId).order('id',{ascending:false});
    return data||[];
  }

  // ── ВКЛАДКИ ──
  function renderTabs() {
    const current = Auth.getCurrentUser();
    document.querySelectorAll('.wl-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
    // Кнопка "+ Бажання" — тільки для свого списку
    const addBtn = el('add-wish-btn');
    if (addBtn) {
      const isOwnTab = allUsers.find(u => u.id===activeOwnerId && u.id===current?.id);
      addBtn.style.display = activeTab==='sizes' ? 'none' : 'flex';
    }
  }

  // ── СІТКА БАЖАНЬ ──
  async function renderGrid() {
    const wrap = el('wishlist-grid'); if(!wrap) return;
    if (activeTab==='sizes') { wrap.innerHTML=''; return; }

    const current = Auth.getCurrentUser();
    const items   = await loadItems(activeOwnerId);
    const isOwn   = current && activeOwnerId===current.id;

    if (!items.length) {
      wrap.innerHTML='<p class="empty-state">Тут ще порожньо ✨</p>';
      return;
    }

    wrap.innerHTML='';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className='wish-card-v2';

      // Дата подарунку
      let dateLabel='';
      if(item.gift_date) {
        const d=new Date(item.gift_date);
        dateLabel=`<span class="wish-date">🎁 ${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}</span>`;
      } else {
        dateLabel='<span class="wish-date wish-date-any">будь-коли</span>';
      }

      // Бронювання (приховано від власника)
      let reserveEl='';
      if(!isOwn) {
        if(item.reserved) {
          reserveEl='<span class="wish-reserved-badge">✓ Заброньовано</span>';
        } else {
          reserveEl=`<button class="wish-reserve-btn" data-res="${item.id}">Забронювати</button>`;
        }
      }

      // Фото
      const img = item.image_url
        ? `<div class="wish-img-wrap"><img class="wish-img" src="${esc(item.image_url)}" alt="" loading="lazy"></div>`
        : '';

      card.innerHTML=`
        ${img}
        <div class="wish-card-body">
          <div class="wish-card-top">
            <span class="wish-title-v2">${esc(item.title)}</span>
            ${isOwn ? `<button class="wish-del-btn" data-del="${item.id}">×</button>` : ''}
          </div>
          ${item.description ? `<p class="wish-desc-v2">${esc(item.description)}</p>` : ''}
          <div class="wish-card-footer">
            ${dateLabel}
            ${item.link ? `<a class="wish-link-v2" href="${esc(item.link)}" target="_blank" rel="noopener">🔗 Переглянути</a>` : ''}
          </div>
          ${reserveEl}
        </div>`;
      wrap.appendChild(card);
    });

    wrap.querySelectorAll('[data-res]').forEach(b=>b.addEventListener('click',()=>reserveItem(b.dataset.res)));
    wrap.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>deleteItem(b.dataset.del)));
  }

  async function deleteItem(id) {
    if(!confirm('Видалити бажання?')) return;
    await supabase.from('wishlist_items').delete().eq('id',id);
    renderGrid();
  }

  async function reserveItem(id) {
    const user=Auth.getCurrentUser(); if(!user) return;
    await supabase.from('wishlist_items').update({reserved:true,reserved_by:user.id}).eq('id',id);
    renderGrid();
  }

  // ── КАРТКА РОЗМІРІВ ──
  async function loadSizes(userId) {
    const {data} = await supabase.from('user_sizes').select('*').eq('user_id',userId).single();
    return data||{};
  }

  async function renderSizes() {
    const wrap=el('wishlist-grid'); if(!wrap) return;
    const current=Auth.getCurrentUser();

    // Дозволяємо переглядати розміри будь-кого
    const user = allUsers.find(u=>u.id===activeOwnerId);
    const sizes = await loadSizes(activeOwnerId);
    const isOwn = current?.id===activeOwnerId;
    const name  = user?.name||'';

    // SVG тіла
    const isFemale = name==='Лєна';
    const bodySvg  = isFemale ? femaleSvg() : maleSvg();

    wrap.innerHTML=`
      <div class="sizes-page">
        <div class="sizes-body-wrap">
          ${bodySvg}
          <div class="sizes-body-labels">
            ${sizes.chest    ? `<span class="sz-label sz-chest">👚 ${sizes.chest} см</span>`:''}
            ${sizes.waist    ? `<span class="sz-label sz-waist">📏 ${sizes.waist} см</span>`:''}
            ${sizes.hips     ? `<span class="sz-label sz-hips">👖 ${sizes.hips} см</span>`:''}
            ${sizes.height   ? `<span class="sz-label sz-height">📐 ${sizes.height} см</span>`:''}
          </div>
        </div>

        <div class="sizes-grid">
          <div class="sizes-group">
            <div class="sizes-group-title">📏 Базові габарити</div>
            <div class="sizes-row"><span>Зріст</span><b>${sizes.height||'—'} см</b></div>
            <div class="sizes-row"><span>Груди</span><b>${sizes.chest||'—'} см</b></div>
            <div class="sizes-row"><span>Талія</span><b>${sizes.waist||'—'} см</b></div>
            <div class="sizes-row"><span>Стегна</span><b>${sizes.hips||'—'} см</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👗 Одяг</div>
            <div class="sizes-row"><span>Міжнар.</span><b>${sizes.intl_size||'—'}</b></div>
            <div class="sizes-row"><span>EU</span><b>${sizes.eu_size||'—'}</b></div>
            <div class="sizes-row"><span>UA</span><b>${sizes.ua_size||'—'}</b></div>
          </div>
          <div class="sizes-group">
            <div class="sizes-group-title">👟 Взуття</div>
            <div class="sizes-row"><span>Устілка</span><b>${sizes.insole_cm||'—'} см</b></div>
            <div class="sizes-row"><span>EU</span><b>${sizes.shoe_eu||'—'}</b></div>
            <div class="sizes-row"><span>US</span><b>${sizes.shoe_us||'—'}</b></div>
          </div>
          ${isFemale ? `
          <div class="sizes-group">
            <div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="sizes-row"><span>Бюстгальтер</span><b>${sizes.bra||'—'}</b></div>
            <div class="sizes-row"><span>Труси</span><b>${sizes.underwear||'—'}</b></div>
          </div>` : ''}
          <div class="sizes-group">
            <div class="sizes-group-title">💍 Аксесуари</div>
            <div class="sizes-row"><span>Каблучка (безім.)</span><b>${sizes.ring_ring||'—'}</b></div>
            <div class="sizes-row"><span>Каблучка (вказ.)</span><b>${sizes.ring_index||'—'}</b></div>
          </div>
        </div>

        ${isOwn ? `<button class="btn-primary sizes-edit-btn" id="sizes-edit-btn" style="width:100%;margin-top:8px">✏️ Редагувати розміри</button>` : ''}
      </div>`;

    el('sizes-edit-btn')?.addEventListener('click',()=>openSizesModal(sizes,activeOwnerId));
  }

  function maleSvg() {
    return `<svg class="body-svg" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Голова -->
      <circle cx="60" cy="28" r="20" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Шия -->
      <rect x="53" y="46" width="14" height="12" rx="4" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Тулуб -->
      <path d="M32 58 Q28 80 30 120 H90 Q92 80 88 58 Q74 54 60 54 Q46 54 32 58Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Ліва рука -->
      <path d="M32 62 Q18 78 16 110 Q20 114 26 110 Q28 86 38 72Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Права рука -->
      <path d="M88 62 Q102 78 104 110 Q100 114 94 110 Q92 86 82 72Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Ліва нога -->
      <path d="M36 120 Q30 160 28 200 Q34 206 42 200 Q46 160 50 120Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Права нога -->
      <path d="M84 120 Q90 160 92 200 Q86 206 78 200 Q74 160 70 120Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Лінії тіла -->
      <line x1="40" y1="68" x2="80" y2="68" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="38" y1="88" x2="82" y2="88" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="36" y1="108" x2="84" y2="108" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
    </svg>`;
  }

  function femaleSvg() {
    return `<svg class="body-svg" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Голова -->
      <circle cx="60" cy="26" r="19" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Волосся -->
      <path d="M41 20 Q42 6 60 5 Q78 6 79 20 Q82 10 78 26 Q74 8 60 8 Q46 8 42 26 Q38 10 41 20Z" fill="#C45B79"/>
      <!-- Шия -->
      <rect x="54" y="44" width="12" height="11" rx="4" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Тулуб (жіночий силует) -->
      <path d="M34 55 Q26 72 30 88 Q28 100 36 110 Q44 118 60 118 Q76 118 84 110 Q92 100 90 88 Q94 72 86 55 Q72 50 60 50 Q48 50 34 55Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Груди -->
      <ellipse cx="48" cy="75" rx="10" ry="8" fill="#F6B9CC" opacity="0.6"/>
      <ellipse cx="72" cy="75" rx="10" ry="8" fill="#F6B9CC" opacity="0.6"/>
      <!-- Ліва рука -->
      <path d="M34 58 Q20 76 18 108 Q22 112 28 108 Q30 84 40 70Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Права рука -->
      <path d="M86 58 Q100 76 102 108 Q98 112 92 108 Q90 84 80 70Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Спідниця/стегна -->
      <path d="M36 110 Q32 128 34 140 H86 Q88 128 84 110Z" fill="#F4A6BE" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Ліва нога -->
      <path d="M38 140 Q32 172 30 204 Q36 210 44 204 Q48 172 52 140Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Права нога -->
      <path d="M82 140 Q88 172 90 204 Q84 210 76 204 Q72 172 68 140Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
      <!-- Лінії розмірів -->
      <line x1="38" y1="68" x2="82" y2="68" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="36" y1="90" x2="84" y2="90" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="36" y1="112" x2="84" y2="112" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
    </svg>`;
  }

  function openSizesModal(sizes, userId) {
    const root=el('modal-root');
    const isFemale=allUsers.find(u=>u.id===userId)?.name==='Лєна';
    root.innerHTML=`
      <div class="modal-overlay" id="sz-overlay">
        <div class="modal-card" style="max-height:90vh;overflow-y:auto">
          <h3>Мої розміри</h3>

          <div class="sizes-form-group"><div class="sizes-group-title">📏 Базові</div>
            <div class="form-field"><label>Зріст (см)</label><input class="fin-inp" id="sz-height" type="number" value="${sizes.height||''}"></div>
            <div class="form-field"><label>Обхват грудей (см)</label><input class="fin-inp" id="sz-chest" type="number" value="${sizes.chest||''}"></div>
            <div class="form-field"><label>Обхват талії (см)</label><input class="fin-inp" id="sz-waist" type="number" value="${sizes.waist||''}"></div>
            <div class="form-field"><label>Обхват стегон (см)</label><input class="fin-inp" id="sz-hips" type="number" value="${sizes.hips||''}"></div>
          </div>

          <div class="sizes-form-group"><div class="sizes-group-title">👗 Одяг</div>
            <div class="form-field"><label>Міжнародний (XS/S/M/L…)</label><input class="fin-inp" id="sz-intl" type="text" value="${sizes.intl_size||''}"></div>
            <div class="form-field"><label>EU (34/36/38…)</label><input class="fin-inp" id="sz-eu" type="text" value="${sizes.eu_size||''}"></div>
            <div class="form-field"><label>UA (42/44/46…)</label><input class="fin-inp" id="sz-ua" type="text" value="${sizes.ua_size||''}"></div>
          </div>

          <div class="sizes-form-group"><div class="sizes-group-title">👟 Взуття</div>
            <div class="form-field"><label>Довжина устілки (см)</label><input class="fin-inp" id="sz-insole" type="number" step="0.5" value="${sizes.insole_cm||''}"></div>
            <div class="form-field"><label>EU розмір</label><input class="fin-inp" id="sz-shoe-eu" type="text" value="${sizes.shoe_eu||''}"></div>
            <div class="form-field"><label>US розмір</label><input class="fin-inp" id="sz-shoe-us" type="text" value="${sizes.shoe_us||''}"></div>
          </div>

          ${isFemale ? `
          <div class="sizes-form-group"><div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="form-field"><label>Бюстгальтер (напр. 75B)</label><input class="fin-inp" id="sz-bra" type="text" value="${sizes.bra||''}"></div>
            <div class="form-field"><label>Труси (розмір)</label><input class="fin-inp" id="sz-underwear" type="text" value="${sizes.underwear||''}"></div>
          </div>` : ''}

          <div class="sizes-form-group"><div class="sizes-group-title">💍 Каблучки</div>
            <div class="form-field"><label>Безіменний палець</label><input class="fin-inp" id="sz-ring" type="text" placeholder="напр. 16.5 мм або 6.5 US" value="${sizes.ring_ring||''}"></div>
            <div class="form-field"><label>Вказівний палець</label><input class="fin-inp" id="sz-ring-idx" type="text" value="${sizes.ring_index||''}"></div>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" id="sz-cancel">Скасувати</button>
            <button class="btn-primary" id="sz-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    el('sz-cancel')?.addEventListener('click',()=>{ root.innerHTML=''; });
    el('sz-overlay')?.addEventListener('click',e=>{ if(e.target.id==='sz-overlay') root.innerHTML=''; });
    el('sz-save')?.addEventListener('click',async()=>{
      const payload={
        user_id:userId,
        height:   parseFloat(el('sz-height')?.value)||null,
        chest:    parseFloat(el('sz-chest')?.value)||null,
        waist:    parseFloat(el('sz-waist')?.value)||null,
        hips:     parseFloat(el('sz-hips')?.value)||null,
        intl_size:el('sz-intl')?.value.trim()||null,
        eu_size:  el('sz-eu')?.value.trim()||null,
        ua_size:  el('sz-ua')?.value.trim()||null,
        insole_cm:parseFloat(el('sz-insole')?.value)||null,
        shoe_eu:  el('sz-shoe-eu')?.value.trim()||null,
        shoe_us:  el('sz-shoe-us')?.value.trim()||null,
        bra:      el('sz-bra')?.value.trim()||null,
        underwear:el('sz-underwear')?.value.trim()||null,
        ring_ring: el('sz-ring')?.value.trim()||null,
        ring_index:el('sz-ring-idx')?.value.trim()||null,
      };
      await supabase.from('user_sizes').upsert(payload,{onConflict:'user_id'});
      root.innerHTML='';
      renderSizes();
    });
  }

  // ── МОДАЛКА БАЖАННЯ ──
  function openAddModal() {
    const root=el('modal-root');
    root.innerHTML=`
      <div class="modal-overlay" id="wish-overlay">
        <div class="modal-card">
          <h3>Нове бажання</h3>
          <div class="form-field">
            <label>Назва *</label>
            <input class="fin-inp" type="text" id="wf-title" placeholder="Що хочеш?">
          </div>
          <div class="form-field">
            <label>Посилання</label>
            <input class="fin-inp" type="url" id="wf-link" placeholder="https://...">
          </div>
          <div class="form-field">
            <label>Фото (URL)</label>
            <input class="fin-inp" type="url" id="wf-img" placeholder="https://... (посилання на фото)">
          </div>
          <div class="form-field">
            <label>Опис / деталі</label>
            <textarea class="fin-inp" id="wf-desc" rows="2" placeholder="Розмір, колір, деталі..." style="resize:vertical"></textarea>
          </div>
          <div class="form-field">
            <label>Дата подарунку (необов'язково)</label>
            <input class="fin-inp" type="date" id="wf-date">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="wf-cancel">Скасувати</button>
            <button class="btn-primary" id="wf-save">Зберегти</button>
          </div>
        </div>
      </div>`;
    el('wf-cancel')?.addEventListener('click',()=>root.innerHTML='');
    el('wish-overlay')?.addEventListener('click',e=>{ if(e.target.id==='wish-overlay') root.innerHTML=''; });
    el('wf-save')?.addEventListener('click',async()=>{
      const title=el('wf-title').value.trim();
      if(!title){ el('wf-title').style.borderColor='var(--danger)'; return; }
      const user=Auth.getCurrentUser();
      await supabase.from('wishlist_items').insert({
        title,
        link:       el('wf-link').value.trim()||null,
        image_url:  el('wf-img').value.trim()||null,
        description:el('wf-desc').value.trim()||null,
        gift_date:  el('wf-date').value||null,
        owner:      user.id,
        reserved:   false,
        reserved_by:null
      });
      root.innerHTML='';
      if(activeOwnerId===user.id) renderGrid();
    });
  }

  // ── SWITCH ──
  function switchTab(tab) {
    activeTab=tab;
    // Знаходимо відповідного юзера по таб-ключу
    if(tab==='sizes') {
      // Показуємо розміри поточного юзера за замовч.
      const current=Auth.getCurrentUser();
      if(current) activeOwnerId=current.id;
    } else {
      // Знаходимо юзера по порядку: dima=перший, lena=другий
      if(allUsers.length>=2) {
        activeOwnerId=tab==='dima' ? allUsers[0].id : allUsers[1].id;
      }
    }
    renderTabs();
    el('wishlist-grid').innerHTML='';
    el('sizes-panel').classList.toggle('hidden', tab!=='sizes');
    if(tab==='sizes') renderSizes();
    else renderGrid();
  }

  // ── ІНІТ ──
  async function refresh() {
    if(!allUsers.length) allUsers=await loadUsers();
    const current=Auth.getCurrentUser();
    if(!activeOwnerId && current) {
      activeOwnerId=current.id;
      // Визначаємо початковий таб
      const idx=allUsers.findIndex(u=>u.id===current.id);
      activeTab = idx===0 ? 'dima' : 'lena';
    }
    renderTabs();
    if(activeTab==='sizes') renderSizes();
    else renderGrid();
  }

  function init() {
    // Вкладки
    document.querySelectorAll('.wl-tab').forEach(btn=>{
      btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
    });

    // Кнопка додавання — тільки для свого списку
    el('add-wish-btn')?.addEventListener('click',()=>{
      const current=Auth.getCurrentUser();
      if(activeOwnerId!==current?.id) {
        alert('Можна додавати лише до власного вішлиста');
        return;
      }
      openAddModal();
    });

    // Таб розмірів — перемикаємо юзера
    const sizeUserBtns=document.querySelectorAll('.sz-user-btn');
    sizeUserBtns.forEach(btn=>{
      btn.addEventListener('click',()=>{
        sizeUserBtns.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        // Знаходимо юзера
        const idx=+btn.dataset.userIdx;
        if(allUsers[idx]) { activeOwnerId=allUsers[idx].id; renderSizes(); }
      });
    });

    window.addEventListener('portal:view',e=>{
      if(e.detail.view==='wishlist') refresh();
    });
  }

  return { init, refresh };
})();

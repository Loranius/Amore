// ============================================================
// WISHLIST MODULE v3 — Бажання + Розміри
// ============================================================
const Wishlist = (() => {

  let allUsers = [];
  let activeOwnerId = null;
  let activeTab = 'wishes'; // 'wishes' | 'sizes'
  let wishFilter = 'all';   // 'all' | userId

  const el  = id => document.getElementById(id);
  const esc = s  => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  async function loadUsers() {
    const {data} = await supabase.from('users').select('id,name').order('id',{ascending:true});
    return data||[];
  }

  async function loadItems(ownerId) {
    const {data} = await supabase.from('wishlist_items')
      .select('id,title,description,link,image_url,gift_date,owner,reserved,reserved_by')
      .eq('owner',ownerId).order('id',{ascending:false});
    return data||[];
  }

  async function loadSizes(userId) {
    const {data} = await supabase.from('user_sizes').select('*').eq('user_id',userId).single();
    return data||{};
  }

  // ── ВКЛАДКИ ──
  function renderTabs() {
    document.querySelectorAll('.wl-tab').forEach(btn=>
      btn.classList.toggle('active', btn.dataset.tab===activeTab));
    const addBtn=el('add-wish-btn');
    if(addBtn) addBtn.style.display = activeTab==='sizes' ? 'none' : 'flex';
  }

  // ── СІТКА БАЖАНЬ ──
  async function renderGrid() {
    const wrap=el('wishlist-grid'); if(!wrap) return;
    if(activeTab==='sizes'){ wrap.innerHTML=''; return; }

    const current=Auth.getCurrentUser();
    if(!allUsers.length) allUsers=await loadUsers();

    // Завантажуємо всі бажання
    const allItems=[];
    for(const u of allUsers){
      const items=await loadItems(u.id);
      items.forEach(i=>{i._ownerId=u.id; i._ownerName=u.name;});
      allItems.push(...items);
    }

    wrap.innerHTML='';

    // Кнопки фільтру
    // Якщо фільтр ще не встановлений — показуємо поточного юзера
    const current2=Auth.getCurrentUser();
    if(wishFilter==='all' && current2) wishFilter=current2.id;

    const bar=document.createElement('div');
    bar.className='wish-filter-bar';
    [
      {key:allUsers[0]?.id, label:'🧔 Для нього'},
      {key:allUsers[1]?.id, label:'👩 Для неї'},
    ].forEach(f=>{
      if(f.key===undefined) return;
      const btn=document.createElement('button');
      btn.className='wish-filter-btn'+(wishFilter===f.key?' active':'');
      btn.textContent=f.label;
      btn.addEventListener('click',()=>{ wishFilter=f.key; renderGrid(); });
      bar.appendChild(btn);
    });
    wrap.appendChild(bar);

    const usersToShow=allUsers.filter(u=>u.id===wishFilter);
    const visible=allItems.filter(i=>i._ownerId===wishFilter);
    if(!visible.length){
      const e=document.createElement('p'); e.className='empty-state';
      e.textContent='Тут ще порожньо ✨'; wrap.appendChild(e); return;
    }
    usersToShow.forEach(u=>{
      const items=allItems.filter(i=>i._ownerId===u.id);
      const isOwn=current?.id===u.id;

      const hdr=document.createElement('div');
      hdr.className='wish-section-header';
      hdr.textContent=(u.name==='Діма'?'🧔 ':'👩 ')+u.name;
      wrap.appendChild(hdr);

      if(!items.length){
        const e=document.createElement('p'); e.className='empty-state';
        e.style.marginBottom='12px'; e.textContent='Поки порожньо';
        wrap.appendChild(e); return;
      }

      items.forEach(item=>{
        const card=document.createElement('div');
        card.className='wish-card-v2';

        let dateLabel=item.gift_date
          ? `<span class="wish-date">🎁 ${new Date(item.gift_date).toLocaleDateString('uk-UA')}</span>`
          : '<span class="wish-date wish-date-any">будь-коли</span>';

        let reserveEl='';
        if(!isOwn) reserveEl=item.reserved
          ? '<span class="wish-reserved-badge">✓ Заброньовано</span>'
          : `<button class="wish-reserve-btn" data-res="${item.id}">Забронювати</button>`;

        const img=item.image_url
          ? `<div class="wish-img-wrap"><img class="wish-img" src="${esc(item.image_url)}" alt="" loading="lazy"></div>`
          : '';

        card.innerHTML=`${img}
          <div class="wish-card-body">
            <div class="wish-card-top">
              <span class="wish-title-v2">${esc(item.title)}</span>
              ${isOwn?`<button class="wish-del-btn" data-del="${item.id}">×</button>`:''}
            </div>
            ${item.description?`<p class="wish-desc-v2">${esc(item.description)}</p>`:''}
            <div class="wish-card-footer">
              ${dateLabel}
              ${item.link?`<a class="wish-link-v2" href="${esc(item.link)}" target="_blank" rel="noopener">🔗 Переглянути</a>`:''}
            </div>
            ${reserveEl}
          </div>`;
        wrap.appendChild(card);
      });
    });

    wrap.querySelectorAll('[data-res]').forEach(b=>b.addEventListener('click',()=>reserveItem(b.dataset.res)));
    wrap.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>deleteItem(b.dataset.del)));
  }

  async function deleteItem(id){
    if(!confirm('Видалити?')) return;
    await supabase.from('wishlist_items').delete().eq('id',id);
    renderGrid();
  }

  async function reserveItem(id){
    const user=Auth.getCurrentUser(); if(!user) return;
    await supabase.from('wishlist_items').update({reserved:true,reserved_by:user.id}).eq('id',id);
    renderGrid();
  }

  // ── РОЗМІРИ ──
  async function renderSizes() {
    const wrap=el('wishlist-grid'); if(!wrap) return;
    const current=Auth.getCurrentUser();
    if(!allUsers.length) allUsers=await loadUsers();
    if(!activeOwnerId && current) activeOwnerId=current.id;

    const user=allUsers.find(u=>u.id===activeOwnerId);
    const sizes=await loadSizes(activeOwnerId);
    const isFemale=user?.name==='Лєна';

    wrap.innerHTML=`
      <div class="sizes-page">
        <div class="sizes-body-wrap">${buildBodySvg(isFemale,sizes)}</div>

        <div class="sz-user-switcher">
          ${allUsers.map((u,i)=>`<button class="sz-user-btn${u.id===activeOwnerId?' active':''}" data-user-idx="${i}">${u.name==='Діма'?'🧔':'👩'} ${esc(u.name)}</button>`).join('')}
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
          ${isFemale?`
          <div class="sizes-group">
            <div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="sizes-row"><span>Бюстгальтер</span><b>${sizes.bra||'—'}</b></div>
            <div class="sizes-row"><span>Труси</span><b>${sizes.underwear||'—'}</b></div>
          </div>`:''}
          <div class="sizes-group">
            <div class="sizes-group-title">💍 Аксесуари</div>
            <div class="sizes-row"><span>Каблучка (безім.)</span><b>${sizes.ring_ring||'—'}</b></div>
            <div class="sizes-row"><span>Каблучка (вказ.)</span><b>${sizes.ring_index||'—'}</b></div>
          </div>
        </div>
        <button class="btn-primary" id="sizes-edit-btn" style="width:100%;margin-top:8px">✏️ Редагувати розміри</button>
      </div>`;

    el('sizes-edit-btn')?.addEventListener('click',()=>openSizesModal(sizes,activeOwnerId));

    wrap.querySelectorAll('.sz-user-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const idx=+btn.dataset.userIdx;
        if(allUsers[idx]){ activeOwnerId=allUsers[idx].id; renderSizes(); }
      });
    });
  }

  function buildBodySvg(isFemale, sizes) {
    const c  = sizes.chest  ? sizes.chest+' см'  : '';
    const w  = sizes.waist  ? sizes.waist+' см'  : '';
    const h  = sizes.hips   ? sizes.hips+' см'   : '';
    const ht = sizes.height ? sizes.height+' см' : '';

    if(isFemale){
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="130" cy="26" r="19" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M111 20 Q112 6 130 5 Q148 6 149 20 Q152 10 148 26 Q144 8 130 8 Q116 8 112 26 Q108 10 111 20Z" fill="#C45B79"/>
        <rect x="122" y="44" width="16" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M96 58 Q86 78 90 96 Q88 112 98 124 Q110 134 130 134 Q150 134 162 124 Q172 112 170 96 Q174 78 164 58 Q150 52 130 52 Q110 52 96 58Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <ellipse cx="116" cy="82" rx="12" ry="9" fill="#F6B9CC" opacity="0.55"/>
        <ellipse cx="144" cy="82" rx="12" ry="9" fill="#F6B9CC" opacity="0.55"/>
        <path d="M96 62 Q80 82 78 120 Q84 126 92 120 Q94 96 106 78Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M164 62 Q180 82 182 120 Q176 126 168 120 Q166 96 154 78Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M98 124 Q92 144 94 158 H166 Q168 144 162 124Z" fill="#F4A6BE" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M100 158 Q92 196 90 248 Q98 256 108 248 Q114 198 118 158Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M160 158 Q168 196 170 248 Q162 256 152 248 Q146 198 142 158Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        ${ht?`<line x1="64" y1="8" x2="64" y2="288" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
        <line x1="59" y1="8" x2="69" y2="8" stroke="#C45B79" stroke-width="1.5"/>
        <line x1="59" y1="288" x2="69" y2="288" stroke="#C45B79" stroke-width="1.5"/>
        <text x="58" y="150" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,58,150)">${ht}</text>`:''}
        ${c?`<line x1="90" y1="82" x2="170" y2="82" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="170" y1="78" x2="170" y2="86" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="176" y1="82" x2="198" y2="82" stroke="#E8829C" stroke-width="1"/>
        <rect x="198" y="72" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="225" y="86" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>`:''}
        ${w?`<line x1="92" y1="108" x2="168" y2="108" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="168" y1="104" x2="168" y2="112" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="174" y1="108" x2="196" y2="108" stroke="#E8829C" stroke-width="1"/>
        <rect x="196" y="98" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="224" y="112" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>`:''}
        ${h?`<line x1="94" y1="130" x2="166" y2="130" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="166" y1="126" x2="166" y2="134" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="172" y1="130" x2="194" y2="130" stroke="#E8829C" stroke-width="1"/>
        <rect x="194" y="120" width="58" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="223" y="134" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>`:''}
      </svg>`;
    } else {
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="130" cy="36" r="24" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <rect x="123" y="58" width="14" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M94 72 Q84 90 86 114 Q86 136 94 150 H166 Q174 136 174 114 Q176 90 166 72 Q152 66 130 66 Q108 66 94 72Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M94 76 Q76 96 74 142 Q80 148 88 142 Q90 110 102 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M166 76 Q184 96 186 142 Q180 148 172 142 Q170 110 158 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M100 150 Q92 196 90 268 Q98 276 108 268 Q114 198 120 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <path d="M160 150 Q168 196 170 268 Q162 276 152 268 Q146 198 140 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        ${ht?`<line x1="62" y1="12" x2="62" y2="298" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
        <line x1="57" y1="12" x2="67" y2="12" stroke="#C45B79" stroke-width="1.5"/>
        <line x1="57" y1="298" x2="67" y2="298" stroke="#C45B79" stroke-width="1.5"/>
        <text x="56" y="160" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,56,160)">${ht}</text>`:''}
        ${c?`<line x1="86" y1="98" x2="174" y2="98" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="174" y1="94" x2="174" y2="102" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="180" y1="98" x2="202" y2="98" stroke="#E8829C" stroke-width="1"/>
        <rect x="202" y="88" width="52" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="228" y="102" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>`:''}
        ${w?`<line x1="88" y1="126" x2="172" y2="126" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="172" y1="122" x2="172" y2="130" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="178" y1="126" x2="200" y2="126" stroke="#E8829C" stroke-width="1"/>
        <rect x="200" y="116" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="227" y="130" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>`:''}
        ${h?`<line x1="90" y1="152" x2="170" y2="152" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="170" y1="148" x2="170" y2="156" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="176" y1="152" x2="198" y2="152" stroke="#E8829C" stroke-width="1"/>
        <rect x="198" y="142" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="226" y="156" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>`:''}
      </svg>`;
    }
  }

  // ── МОДАЛКА РОЗМІРІВ ──
  function openSizesModal(sizes, userId) {
    const root=el('modal-root');
    const isFemale=allUsers.find(u=>u.id===userId)?.name==='Лєна';
    root.innerHTML=`
      <div class="modal-overlay" id="sz-overlay">
        <div class="modal-card" style="max-height:90vh;overflow-y:auto">
          <h3>Мої розміри</h3>
          <div class="sizes-form-group"><div class="sizes-group-title">📏 Базові</div>
            <div class="form-field"><label>Зріст (см)</label><input class="fin-inp" id="sz-height" type="number" value="${sizes.height||''}"></div>
            <div class="form-field"><label>Груди (см)</label><input class="fin-inp" id="sz-chest" type="number" value="${sizes.chest||''}"></div>
            <div class="form-field"><label>Талія (см)</label><input class="fin-inp" id="sz-waist" type="number" value="${sizes.waist||''}"></div>
            <div class="form-field"><label>Стегна (см)</label><input class="fin-inp" id="sz-hips" type="number" value="${sizes.hips||''}"></div>
          </div>
          <div class="sizes-form-group"><div class="sizes-group-title">👗 Одяг</div>
            <div class="form-field"><label>Міжнар. (XS/S/M/L)</label><input class="fin-inp" id="sz-intl" type="text" value="${sizes.intl_size||''}"></div>
            <div class="form-field"><label>EU (34/36/38…)</label><input class="fin-inp" id="sz-eu" type="text" value="${sizes.eu_size||''}"></div>
            <div class="form-field"><label>UA (42/44/46…)</label><input class="fin-inp" id="sz-ua" type="text" value="${sizes.ua_size||''}"></div>
          </div>
          <div class="sizes-form-group"><div class="sizes-group-title">👟 Взуття</div>
            <div class="form-field"><label>Устілка (см)</label><input class="fin-inp" id="sz-insole" type="number" step="0.5" value="${sizes.insole_cm||''}"></div>
            <div class="form-field"><label>EU</label><input class="fin-inp" id="sz-shoe-eu" type="text" value="${sizes.shoe_eu||''}"></div>
            <div class="form-field"><label>US</label><input class="fin-inp" id="sz-shoe-us" type="text" value="${sizes.shoe_us||''}"></div>
          </div>
          ${isFemale?`
          <div class="sizes-form-group"><div class="sizes-group-title">🩱 Нижня білизна</div>
            <div class="form-field"><label>Бюстгальтер (напр. 75B)</label><input class="fin-inp" id="sz-bra" type="text" value="${sizes.bra||''}"></div>
            <div class="form-field"><label>Труси</label><input class="fin-inp" id="sz-underwear" type="text" value="${sizes.underwear||''}"></div>
          </div>`:''}
          <div class="sizes-form-group"><div class="sizes-group-title">💍 Каблучки</div>
            <div class="form-field"><label>Безіменний</label><input class="fin-inp" id="sz-ring" type="text" value="${sizes.ring_ring||''}"></div>
            <div class="form-field"><label>Вказівний</label><input class="fin-inp" id="sz-ring-idx" type="text" value="${sizes.ring_index||''}"></div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="sz-cancel">Скасувати</button>
            <button class="btn-primary" id="sz-save">Зберегти</button>
          </div>
        </div>
      </div>`;
    el('sz-cancel')?.addEventListener('click',()=>root.innerHTML='');
    el('sz-overlay')?.addEventListener('click',e=>{ if(e.target.id==='sz-overlay') root.innerHTML=''; });
    el('sz-save')?.addEventListener('click',async()=>{
      await supabase.from('user_sizes').upsert({
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
      },{onConflict:'user_id'});
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
          <div class="form-field"><label>Назва *</label><input class="fin-inp" type="text" id="wf-title" placeholder="Що хочеш?"></div>
          <div class="form-field"><label>Посилання</label><input class="fin-inp" type="url" id="wf-link" placeholder="https://..."></div>
          <div class="form-field"><label>Фото (URL)</label><input class="fin-inp" type="url" id="wf-img" placeholder="https://..."></div>
          <div class="form-field"><label>Опис / деталі</label><textarea class="fin-inp" id="wf-desc" rows="2" placeholder="Розмір, колір..." style="resize:vertical"></textarea></div>
          <div class="form-field"><label>Дата подарунку (необов'язково)</label><input class="fin-inp" type="date" id="wf-date"></div>
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
      if(!user){ alert('Потрібно увійти'); return; }
      const saveBtn=el('wf-save');
      if(saveBtn) saveBtn.disabled=true;
      const payload = {
        title,
        link:        el('wf-link').value.trim()||null,
        image_url:   el('wf-img').value.trim()||null,
        description: el('wf-desc').value.trim()||null,
        gift_date:   el('wf-date').value||null,
        owner:       user.id,
        reserved:    false,
        reserved_by: null
      };
      console.log('Saving wish:', payload);
      const {data:saved, error} = await supabase.from('wishlist_items').insert(payload).select();
      console.log('Result:', saved, error);
      if(error){ alert('Помилка збереження: '+error.message); if(saveBtn) saveBtn.disabled=false; return; }
      root.innerHTML='';
      wishFilter=user.id;
      renderGrid();
    });
  }

  // ── SWITCH TAB ──
  function switchTab(tab) {
    activeTab=tab;
    renderTabs();
    el('wishlist-grid').innerHTML='';
    el('sizes-panel').classList.toggle('hidden', tab!=='sizes');
    if(tab==='sizes') renderSizes();
    else renderGrid();
  }

  // ── REFRESH ──
  async function refresh() {
    if(!allUsers.length) allUsers=await loadUsers();
    const current=Auth.getCurrentUser();
    if(!activeOwnerId && current) activeOwnerId=current.id;
    activeTab='wishes';
    renderTabs();
    renderGrid();
  }

  function init() {
    document.querySelectorAll('.wl-tab').forEach(btn=>
      btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

    el('add-wish-btn')?.addEventListener('click',()=>{
      const current=Auth.getCurrentUser();
      if(!current){ alert('Увійдіть спочатку'); return; }
      openAddModal();
    });

    window.addEventListener('portal:view',e=>{
      if(e.detail.view==='wishlist') refresh();
    });
  }

  return { init, refresh };
})();

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

    wrap.innerHTML=`
      <div class="sizes-page">
        <div class="sizes-body-wrap">
          ${buildBodySvg(isFemale, sizes)}
        </div>

        <div class="sz-user-switcher">
          <button class="sz-user-btn${activeOwnerId===allUsers[0]?.id?' active':''}" data-user-idx="0">🧔 Діма</button>
          <button class="sz-user-btn${activeOwnerId===allUsers[1]?.id?' active':''}" data-user-idx="1">👩 Лєна</button>
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

        <button class="btn-primary sizes-edit-btn" id="sizes-edit-btn" style="width:100%;margin-top:8px">✏️ Редагувати розміри</button>
      </div>`;

    el('sizes-edit-btn')?.addEventListener('click',()=>openSizesModal(sizes,activeOwnerId));

    // Bind перемикача Діма/Лєна (рендеруються динамічно)
    wrap.querySelectorAll('.sz-user-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const idx=+btn.dataset.userIdx;
        if(allUsers[idx]) { activeOwnerId=allUsers[idx].id; renderSizes(); }
      });
    });
  }

  // ── SVG тіло з вказівниками ──
  function buildBodySvg(isFemale, sizes) {
    const c  = sizes.chest  ? sizes.chest+' см'  : '';
    const w  = sizes.waist  ? sizes.waist+' см'  : '';
    const h  = sizes.hips   ? sizes.hips+' см'   : '';
    const ht = sizes.height ? sizes.height+' см' : '';

    // Позиції ліній на SVG (viewBox 200x340)
    // Ліва сторона — лейбли; права — лейбли
    // Горизонтальні лінії прив'язані до тіла

    if (isFemale) {
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Тіло -->
        <!-- Голова -->
        <circle cx="130" cy="36" r="26" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Волосся -->
        <path d="M104 28 Q106 8 130 6 Q154 8 156 28 Q160 14 155 34 Q150 10 130 10 Q110 10 105 34 Q100 14 104 28Z" fill="#C45B79"/>
        <!-- Шия -->
        <rect x="122" y="60" width="16" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Тулуб -->
        <path d="M96 74 Q86 96 90 116 Q88 132 98 144 Q110 152 130 152 Q150 152 162 144 Q172 132 170 116 Q174 96 164 74 Q150 68 130 68 Q110 68 96 74Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Груди -->
        <ellipse cx="116" cy="100" rx="13" ry="10" fill="#F6B9CC" opacity="0.55"/>
        <ellipse cx="144" cy="100" rx="13" ry="10" fill="#F6B9CC" opacity="0.55"/>
        <!-- Ліва рука -->
        <path d="M96 78 Q78 100 76 140 Q82 146 90 140 Q92 110 104 92Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Права рука -->
        <path d="M164 78 Q182 100 184 140 Q178 146 170 140 Q168 110 156 92Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Стегна -->
        <path d="M98 144 Q92 164 94 178 H166 Q168 164 162 144Z" fill="#F4A6BE" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Ліва нога -->
        <path d="M100 178 Q92 218 90 270 Q98 278 108 270 Q114 220 118 178Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Права нога -->
        <path d="M160 178 Q168 218 170 270 Q162 278 152 270 Q146 220 142 178Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>

        <!-- ── ВКАЗІВНИКИ ── -->
        <!-- Зріст — вертикальна лінія зліва -->
        ${ht ? `
        <line x1="62" y1="10" x2="62" y2="300" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
        <line x1="58" y1="10" x2="66" y2="10" stroke="#C45B79" stroke-width="1.5"/>
        <line x1="58" y1="300" x2="66" y2="300" stroke="#C45B79" stroke-width="1.5"/>
        <text x="56" y="160" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,56,160)">${ht}</text>
        ` : ''}

        <!-- Груди — горизонтальна лінія -->
        ${c ? `
        <line x1="90" y1="100" x2="170" y2="100" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="170" y1="96" x2="170" y2="104" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="176" y1="100" x2="200" y2="100" stroke="#E8829C" stroke-width="1"/>
        <rect x="200" y="90" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="227" y="104" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>
        ` : ''}

        <!-- Талія -->
        ${w ? `
        <line x1="92" y1="128" x2="168" y2="128" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="168" y1="124" x2="168" y2="132" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="174" y1="128" x2="198" y2="128" stroke="#E8829C" stroke-width="1"/>
        <rect x="198" y="118" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="226" y="132" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>
        ` : ''}

        <!-- Стегна -->
        ${h ? `
        <line x1="94" y1="162" x2="166" y2="162" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="166" y1="158" x2="166" y2="166" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="172" y1="162" x2="196" y2="162" stroke="#E8829C" stroke-width="1"/>
        <rect x="196" y="152" width="58" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="225" y="166" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>
        ` : ''}
      </svg>`;
    } else {
      return `<svg class="body-svg" viewBox="0 0 260 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Голова -->
        <circle cx="130" cy="36" r="24" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Шия -->
        <rect x="123" y="58" width="14" height="14" rx="5" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Тулуб (прямий чоловічий) -->
        <path d="M94 72 Q84 90 86 114 Q86 136 94 150 H166 Q174 136 174 114 Q176 90 166 72 Q152 66 130 66 Q108 66 94 72Z" fill="#F6D9E2" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Ліва рука -->
        <path d="M94 76 Q76 96 74 142 Q80 148 88 142 Q90 110 102 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Права рука -->
        <path d="M166 76 Q184 96 186 142 Q180 148 172 142 Q170 110 158 88Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Ліва нога -->
        <path d="M100 150 Q92 196 90 268 Q98 276 108 268 Q114 198 120 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>
        <!-- Права нога -->
        <path d="M160 150 Q168 196 170 268 Q162 276 152 268 Q146 198 140 150Z" fill="#F6B9CC" stroke="#E8829C" stroke-width="1.5"/>

        <!-- ── ВКАЗІВНИКИ ── -->
        <!-- Зріст -->
        ${ht ? `
        <line x1="62" y1="12" x2="62" y2="298" stroke="#C45B79" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
        <line x1="57" y1="12" x2="67" y2="12" stroke="#C45B79" stroke-width="1.5"/>
        <line x1="57" y1="298" x2="67" y2="298" stroke="#C45B79" stroke-width="1.5"/>
        <text x="56" y="160" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle" transform="rotate(-90,56,160)">${ht}</text>
        ` : ''}

        <!-- Груди -->
        ${c ? `
        <line x1="86" y1="98" x2="174" y2="98" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="174" y1="94" x2="174" y2="102" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="180" y1="98" x2="202" y2="98" stroke="#E8829C" stroke-width="1"/>
        <rect x="202" y="88" width="52" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="228" y="102" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Г: ${c}</text>
        ` : ''}

        <!-- Талія -->
        ${w ? `
        <line x1="88" y1="126" x2="172" y2="126" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="172" y1="122" x2="172" y2="130" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="178" y1="126" x2="200" y2="126" stroke="#E8829C" stroke-width="1"/>
        <rect x="200" y="116" width="54" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="227" y="130" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">Т: ${w}</text>
        ` : ''}

        <!-- Стегна -->
        ${h ? `
        <line x1="90" y1="152" x2="170" y2="152" stroke="#E8829C" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
        <line x1="170" y1="148" x2="170" y2="156" stroke="#E8829C" stroke-width="1.5"/>
        <line x1="176" y1="152" x2="198" y2="152" stroke="#E8829C" stroke-width="1"/>
        <rect x="198" y="142" width="56" height="20" rx="10" fill="#FFE8EF" stroke="#E8829C" stroke-width="1"/>
        <text x="226" y="156" font-size="10" fill="#C45B79" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">С: ${h}</text>
        ` : ''}
      </svg>`;
    }
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



    window.addEventListener('portal:view',e=>{
      if(e.detail.view==='wishlist') refresh();
    });
  }

  return { init, refresh };
})();

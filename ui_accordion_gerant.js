// ============================================================
//  UI — ACCORDÉON MODE GÉRANT
// ============================================================

// ============================================================
//  UI — ACCORDÉON MODE GÉRANT (VERSION COMPLÈTE + FIX BOUTON)
// ============================================================

function renderAccordionGerant() {
  const allProds = state.produits;
  const suppliers = [...new Set(allProds.map(p => p.fournisseur))].sort((a, b) =>
    a.localeCompare(b, 'fr')
  );

  if (!suppliers.length) {
    productList.innerHTML =
      '<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>';
    updateValidationButton();
    return;
  }

  let html = '';

  suppliers.forEach(sup => {
    const prods = allProds.filter(p => p.fournisseur === sup);
    const isOpen = state.openSupplier === sup;

    // Totaux A/B
    const orderedA = prods.filter(p => (state.quantities_a[productKey(p)] || 0) > 0);
    const orderedB = prods.filter(p => (state.quantities_b[productKey(p)] || 0) > 0);

    const totalA = orderedA.reduce(
      (s, p) => s + (state.quantities_a[productKey(p)] || 0) * getPrixColis(p),
      0
    );
    const totalB = orderedB.reduce(
      (s, p) => s + (state.quantities_b[productKey(p)] || 0) * getPrixColis(p),
      0
    );

    const badgeHtml =
      orderedA.length || orderedB.length
        ? `<span class="acc-badge">
             A:${orderedA.length} · ${fmtPrice(totalA)}<br>
             B:${orderedB.length} · ${fmtPrice(totalB)}
           </span>`
        : '';

    html += `
      <div class="accordion-block${isOpen ? ' is-open' : ''}" data-sup="${escHtml(sup)}">
        <button class="accordion-header" data-sup="${escHtml(sup)}">
          <div class="acc-left">
            <span class="acc-name">${escHtml(sup)}</span>
            ${badgeHtml}
          </div>
          <span class="acc-chevron">${isOpen ? '▾' : '▸'}</span>
        </button>

        ${isOpen ? renderSupplierBodyGerant(prods) : ''}
      </div>
    `;
  });

  productList.innerHTML = html;

  // Toggle accordéon + sélection fournisseur
  productList.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;

      if (state.openSupplier === sup) {
        // On referme → plus de fournisseur sélectionné
        state.openSupplier = null;
        state.selectedSupplier = null;
      } else {
        // On ouvre → fournisseur sélectionné
        state.openSupplier = sup;
        state.selectedSupplier = sup;
      }

      renderAccordionGerant();
      updateValidationButton();

      setTimeout(() => {
        const o = productList.querySelector('.accordion-block.is-open');
        if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    });
  });

  bindSteppersGerant();
  updateValidationButton(); // 🔥 toujours après le render
}
function updateValidationButton() {
  const btn = document.getElementById('btn-valider-commande');
  if (!btn) return;

  const visible =
    state.etab &&
    state.etab.id === 'gerant' &&
    state.selectedSupplier;

  btn.style.display = visible ? 'block' : 'none';
}

// ---- Corps fournisseur (gérant) ----------------------------
function renderSupplierBodyGerant(prods) {
  let html = '<div class="acc-body">';

  prods.forEach(p => {
    const key = productKey(p);
    const d = getProductData(p);

    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    const prixColis = getPrixColis(p);
    const totalA = qa * prixColis;
    const totalB = qb * prixColis;

    html += `
      <div class="product-card" data-key="${escHtml(key)}">
        <div class="product-info">
          <div class="product-nom-row">
            <span class="product-nom">${escHtml(p.nom_court)}</span>
          </div>

          <div class="product-meta">
            <span class="product-ref">${escHtml(d.reference)}</span>
            <span class="product-prix">${fmtPrice(prixColis)}/colis</span>
          </div>
        </div>

        <div class="qty-stepper qty-stepper-a">
          <span class="qty-label">A</span>
          <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="-1">−</button>
          <input class="qty-input-a" type="number" min="0" step="1" value="${qa}" data-key="${escHtml(key)}">
          <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="1">+</button>
          <span class="qty-total">${fmtPrice(totalA)}</span>
        </div>

        <div class="qty-stepper qty-stepper-b">
          <span class="qty-label">B</span>
          <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="-1">−</button>
          <input class="qty-input-b" type="number" min="0" step="1" value="${qb}" data-key="${escHtml(key)}">
          <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="1">+</button>
          <span class="qty-total">${fmtPrice(totalB)}</span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// ---- Steppers gérant ---------------------------------------
function bindSteppersGerant() {
  // A
  productList.querySelectorAll('.qty-btn-a').forEach(b =>
    b.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta);
      state.quantities_a[key] = Math.max(0, (state.quantities_a[key] || 0) + delta);
      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-a').forEach(i =>
    i.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value) || 0);
      state.quantities_a[key] = qty;
      renderAccordionGerant();
      scheduleSave();
    })
  );

  // B
  productList.querySelectorAll('.qty-btn-b').forEach(b =>
    b.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta);
      state.quantities_b[key] = Math.max(0, (state.quantities_b[key] || 0) + delta);
      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-b').forEach(i =>
    i.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value) || 0);
      state.quantities_b[key] = qty;
      renderAccordionGerant();
      scheduleSave();
    })
  );
}

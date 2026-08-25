// ============================================================
//  UI — ACCORDÉON MODE GÉRANT
// ============================================================
//
//  RÔLE DE CE FICHIER
//  ------------------
//  - afficher les fournisseurs en mode gérant
//  - ouvrir / fermer un fournisseur
//  - afficher les quantités A / B
//  - permettre la saisie via steppers
//  - afficher un bouton "Valider commande" pour le fournisseur ouvert
//
//  IMPORTANT
//  ---------
//  Ce fichier ne contient PAS la logique métier de validation.
//  Il appelle simplement : validateSupplier(sup)
//  La vraie logique de validation est maintenant dans validation.js
// ============================================================

function renderAccordionGerant() {
  const allProds = state.produits;

  const suppliers = [...new Set(allProds.map(p => p.fournisseur))].sort((a, b) => {
    const fa = allProds.find(p => p.fournisseur === a)?.ordre_fournisseur || 999;
    const fb = allProds.find(p => p.fournisseur === b)?.ordre_fournisseur || 999;
    return fa - fb;
  });

  if (!suppliers.length) {
    productList.innerHTML =
      '<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>';
    return;
  }

  let html = '';

  suppliers.forEach(sup => {
    let prods = allProds.filter(p => p.fournisseur === sup);

    // 1) Tri stable de base
    prods = triStableAccordion(prods, 'GERANT', state);

    // 2) Ordre affiché mémorisé pour ce fournisseur
    prods = getSupplierDisplayProducts(sup, prods);

    const isOpen = state.openSupplier === sup;

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

    const totalGlobal = totalA + totalB;
    const showBadge = orderedA.length || orderedB.length;

    const badgeHtml = `
      <span class="acc-badge${showBadge ? '' : ' acc-badge--empty'}">
        ${showBadge ? `Total : ${fmtPrice(totalGlobal)}` : ''}
      </span>
    `;

    html += `
      <div class="accordion-block${isOpen ? ' is-open' : ''}" data-sup="${escHtml(sup)}">

        <div class="accordion-header" data-sup="${escHtml(sup)}">
          <div class="acc-left">
            <span class="acc-name">${escHtml(sup)}</span>
            ${badgeHtml}

            ${isOpen ? `
              <button
                class="btn-valider-outline"
                data-sup="${escHtml(sup)}"
                type="button">
                Valider commande
              </button>
            ` : ''}
          </div>

          <span class="acc-chevron">${isOpen ? '▾' : '▸'}</span>
        </div>

        ${isOpen ? `
          <div class="acc-etabs">
            <span class="etab-badge etab-badge--a">
              <img src="main/Logo_Pizza-oleron.png" class="etab-logo">
              Pizza d'Oléron
            </span>

            <span class="etab-badge etab-badge--b">
              <img src="main/Logo-Vesuvio.png" class="etab-logo">
              Le Vesuvio
            </span>
          </div>
        ` : ''}

        ${isOpen ? renderSupplierBodyGerant(prods) : ''}

      </div>
    `;
  });

  productList.innerHTML = html;

  productList.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.btn-valider-outline')) return;

      const sup = header.dataset.sup;
      const wasOpen = state.openSupplier === sup;

      if (wasOpen) {
        state.openSupplier = null;
        renderAccordionGerant();
        return;
      }

      state.openSupplier = sup;

      const supplierProds = state.produits.filter(p => p.fournisseur === sup);
      const stableProds = triStableAccordion(supplierProds, 'GERANT', state);
      refreshSupplierDisplayOrder(sup, stableProds);

      renderAccordionGerant();
    });
  });

  productList.querySelectorAll('.btn-valider-outline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sup = btn.dataset.sup;
      validateSupplier(sup);
    });
  });

  bindSteppersGerant();
}

// ============================================================
//  CORPS DU FOURNISSEUR (MODE GÉRANT)
// ============================================================

function renderSupplierBodyGerant(prods) {
  let html = `<div class="acc-body">`;

  prods.forEach(p => {
    const key = productKey(p);

    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    const prixColis = getPrixColis(p);
    const totalA = qa * prixColis;
    const totalB = qb * prixColis;

    html += `
      <div class="Article_gerant" data-key="${escHtml(key)}">

        <div class="ligne1">
          <div class="bloc1-1">
            ${escHtml(p.nom_court || p.nom || '')}
          </div>
          <div class="bloc1-2">
            ${escHtml(p.designation || '')}
          </div>
        </div>

        <div class="ligne2">

          <div class="bloc2-1">
            Réf :<br>
            ${escHtml(p.reference || p.ref || '')}
          </div>

          <div class="bloc2-2">
            Colis :<br>
            ${fmtPrice(prixColis)}
          </div>

          <div class="bloc2-3">
            <div class="stepperA">
              <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="-1">−</button>
              <input
                class="qty-input-a"
                type="number"
                min="0"
                step="1"
                value="${qa}"
                data-key="${escHtml(key)}">
              <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="1">+</button>
              <span class="totalA">${fmtPriceNoEuro(totalA)}</span>
            </div>
          </div>

          <div class="bloc2-4">
            <div class="stepperB">
              <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="-1">−</button>
              <input
                class="qty-input-b"
                type="number"
                min="0"
                step="1"
                value="${qb}"
                data-key="${escHtml(key)}">
              <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="1">+</button>
              <span class="totalB">${fmtPriceNoEuro(totalB)}</span>
            </div>
          </div>

        </div>

      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ============================================================
//  BIND DES STEPPERS GÉRANT
// ============================================================

function bindSteppersGerant() {
  productList.querySelectorAll('.qty-btn-a').forEach(btn =>
    btn.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta, 10);

      state.quantities_a[key] = Math.max(0, (state.quantities_a[key] || 0) + delta);

      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-a').forEach(input =>
    input.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);

      state.quantities_a[key] = qty;

      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-btn-b').forEach(btn =>
    btn.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta, 10);

      state.quantities_b[key] = Math.max(0, (state.quantities_b[key] || 0) + delta);

      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-b').forEach(input =>
    input.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);

      state.quantities_b[key] = qty;

      renderAccordionGerant();
      scheduleSave();
    })
  );
}

// ============================================================
//  UI — ACCORDÉON MODE GÉRANT
// ============================================================

function renderAccordionGerant() {
  const allProds = state.produits;

  // 🔥 Fournisseurs triés par ordre_fournisseur (comme A/B)
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

    // 🔥 Tri global (ordre_fournisseur / ordre_categorie / nom_court / designation)
    // + tri dynamique (commandés en haut, regroupement nom court)
    prods = triPipeline(prods, 'GERANT', state);

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

    const badgeHtml =
      (orderedA.length || orderedB.length)
        ? `<span class="acc-badge">
             Total : ${fmtPrice(totalGlobal)}
           </span>`
        : '';

    html += `
      <div class="accordion-block${isOpen ? ' is-open' : ''}" data-sup="${escHtml(sup)}">

        <div class="accordion-header" data-sup="${escHtml(sup)}">
          <div class="acc-left">
            <span class="acc-name">${escHtml(sup)}</span>
            ${badgeHtml}
            ${isOpen ? `
              <button class="btn-valider-outline" data-sup="${escHtml(sup)}" type="button">
                Valider commande
              </button>
            ` : ''}
          </div>

          <span class="acc-chevron">${isOpen ? '▾' : '▸'}</span>
        </div>

        ${isOpen ? `
          <div class="acc-etabs">
            <span class="etab-badge">
              <img src="main/Logo_Pizza-oleron.png" class="etab-logo">
              Pizza d'Oléron
            </span>

            <span class="etab-badge">
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

  // Toggle accordéon + sélection fournisseur
  productList.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Si on clique sur le bouton Valider, on n'ouvre/ferme pas l'accordéon
      if (e.target.closest('.btn-valider-outline')) return;

      const sup = header.dataset.sup;

      if (state.openSupplier === sup) {
        state.openSupplier = null;
      } else {
        state.openSupplier = sup;
      }

      renderAccordionGerant();
    });
  });

  // Bouton de validation du fournisseur ouvert
  productList.querySelectorAll('.btn-valider-outline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sup = btn.dataset.sup;
      validateSupplier(sup);
    });
  });

  bindSteppersGerant();
}

// ---- Corps fournisseur (gérant) ----------------------------
// Version 100% alignée avec TON masque :
// Article_gerant → nom_prix + qte_article (2 colonnes)
// ------------------------------------------------------------

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
      <!-- ============================================================
           ARTICLE_GERANT : bloc principal pour 1 article
           Contient 2 grids internes :
             - nom_prix (1 colonne)
             - qte_article (2 colonnes)
      ============================================================ -->
      <div class="Article_gerant" data-key="${escHtml(key)}">

        <!-- ============================================================
             GRID 1 : nom_prix
             1 colonne : nom + prix
        ============================================================ -->
        <div class="nom_prix">
          <span class="nom_article">${escHtml(p.designation || p.nom || p.nom_court)}</span>
          <span class="prix_article">${fmtPrice(prixColis)}/colis</span>
        </div>

        <!-- ============================================================
             GRID 2 : qte_article
             2 colonnes fixes : stepper A | stepper B
        ============================================================ -->
        <div class="qte_article">

          <!-- Stepper A -->
          <div class="stepperA">
            <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="-1">−</button>
            <input class="qty-input-a" type="number" min="0" step="1"
                   value="${qa}" data-key="${escHtml(key)}">
            <button class="qty-btn-a" data-key="${escHtml(key)}" data-delta="1">+</button>
            <span class="totalA">${fmtPriceNoEuro(totalA)}</span>
          </div>

          <!-- Stepper B -->
          <div class="stepperB">
            <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="-1">−</button>
            <input class="qty-input-b" type="number" min="0" step="1"
                   value="${qb}" data-key="${escHtml(key)}">
            <button class="qty-btn-b" data-key="${escHtml(key)}" data-delta="1">+</button>
            <span class="totalB">${fmtPriceNoEuro(totalB)}</span>
          </div>

        </div>

      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ---- Steppers gérant ---------------------------------------
function bindSteppersGerant() {
  // A
  productList.querySelectorAll('.qty-btn-a').forEach(b =>
    b.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta, 10);
      state.quantities_a[key] = Math.max(0, (state.quantities_a[key] || 0) + delta);
      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-a').forEach(i =>
    i.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);
      state.quantities_a[key] = qty;
      renderAccordionGerant();
      scheduleSave();
    })
  );

  // B
  productList.querySelectorAll('.qty-btn-b').forEach(b =>
    b.addEventListener('click', e => {
      const key = e.currentTarget.dataset.key;
      const delta = parseInt(e.currentTarget.dataset.delta, 10);
      state.quantities_b[key] = Math.max(0, (state.quantities_b[key] || 0) + delta);
      renderAccordionGerant();
      scheduleSave();
    })
  );

  productList.querySelectorAll('.qty-input-b').forEach(i =>
    i.addEventListener('change', e => {
      const key = e.currentTarget.dataset.key;
      const qty = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);
      state.quantities_b[key] = qty;
      renderAccordionGerant();
      scheduleSave();
    })
  );
}

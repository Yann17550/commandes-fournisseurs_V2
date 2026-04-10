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

    html += renderFournisseurBlock(sup, prods, isOpen, state);

  });

  productList.innerHTML = html;

  // Toggle accordéon + sélection fournisseur
  productList.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;

      if (state.openSupplier === sup) {
        state.openSupplier = null;
      } else {
        state.openSupplier = sup;
      }
      renderAccordionGerant();
    });
  });

  bindSteppersGerant();

  // Bouton de validation dans chaque fournisseur ouvert
  productList.querySelectorAll('.btn-valider').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;
      console.log("Validation de la commande pour :", sup);
      // ici tu mettras ta logique
    });
  });

  // 🔥 Ajout du bouton de validation ici
  if (state.etab && state.etab.id === 'gerant') {
    const container = document.createElement('div');
    container.id = 'gerant-validation-container';
    container.style.textAlign = 'center';
    container.style.padding = '20px';

    const btn = document.createElement('button');
    btn.id = 'btn-valider-commande';
    btn.textContent = 'Valider la commande';
    btn.className = 'btn-valider';

    btn.style.display = state.openSupplier ? 'block' : 'none';

    btn.addEventListener('click', () => {
      console.log('Validation de la commande pour :', state.openSupplier);
    });

    container.appendChild(btn);
    productList.appendChild(container);
  }
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

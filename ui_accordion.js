// ============================================================
//  UI — ACCORDÉON (ÉTAB A / B)
// ============================================================
//
//  RÔLE DE CE FICHIER
//  ------------------
//  - gérer le rendu accordéon des établissements normaux (A / B)
//  - déléguer le mode gérant à renderAccordionGerant()
//  - afficher les fournisseurs, leurs produits, les steppers,
//    les boutons d'édition, et les badges fournisseur
//
//  IMPORTANT
//  ---------
//  Ce fichier ne gère PAS la validation fournisseur du mode gérant.
//  Cette logique est désormais séparée dans :
//  - ui_accordion_gerant.js
//  - validation.js
// ============================================================


// ============================================================
//  ACCORDÉON PRINCIPAL
// ============================================================
function renderAccordion() {
  // ----------------------------------------------------------
  // Si on est en mode gérant, on bascule vers le rendu dédié
  // ----------------------------------------------------------
  if (state.etab && state.etab.id === 'gerant') {
    renderAccordionGerant();
    return;
  }

  // ----------------------------------------------------------
  // Fournisseurs triés selon ordre_fournisseur
  // ----------------------------------------------------------
  const suppliers = getSuppliers().sort((a, b) => {
    const fa = state.produits.find(p => p.fournisseur === a)?.ordre_fournisseur || 999;
    const fb = state.produits.find(p => p.fournisseur === b)?.ordre_fournisseur || 999;
    return fa - fb;
  });

  const allProds = getProduitsForEtab();

  // ----------------------------------------------------------
  // Etat vide
  // ----------------------------------------------------------
  if (!suppliers.length) {
    productList.innerHTML =
      '<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>';
    return;
  }

  // ----------------------------------------------------------
  // Bouton flottant d'ajout produit
  // ----------------------------------------------------------
  let html = `
    <div class="fab-row">
      <button class="fab-add" id="fabAddBtn">+ Nouveau produit</button>
    </div>
  `;

  // ----------------------------------------------------------
  // Construction des blocs fournisseur
  // ----------------------------------------------------------
  suppliers.forEach(sup => {
    let prods = allProds.filter(p => p.fournisseur === sup);

    // --------------------------------------------------------
    // Tri global + tri dynamique
    // C'est le seul tri appliqué ici
    // --------------------------------------------------------
    prods = triPipeline(prods, state.etab.id, state);

    const isOpen = state.openSupplier === sup;

    // --------------------------------------------------------
    // Le rendu détaillé du fournisseur est externalisé dans
    // renderFournisseurBlock()
    // --------------------------------------------------------
    html += renderFournisseurBlock(sup, prods, isOpen, state);
  });

  // ----------------------------------------------------------
  // Injection HTML
  // ----------------------------------------------------------
  productList.innerHTML = html;

  // ----------------------------------------------------------
  // Bouton ajout produit
  // ----------------------------------------------------------
  const fab = $('fabAddBtn');
  if (fab) fab.addEventListener('click', openAddModal);

  // ----------------------------------------------------------
  // Toggle ouverture / fermeture accordéon
  // ----------------------------------------------------------
  productList.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;
      state.openSupplier = state.openSupplier === sup ? null : sup;

      renderAccordion();

      // ------------------------------------------------------
      // Petit scroll vers le bloc ouvert pour confort visuel
      // ------------------------------------------------------
      setTimeout(() => {
        const o = productList.querySelector('.accordion-block.is-open');
        if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    });
  });

  // ----------------------------------------------------------
  // Binding boutons quantité + édition
  // ----------------------------------------------------------
  bindSteppers();
}


// ============================================================
//  CORPS DU FOURNISSEUR
// ============================================================
//
//  Affiche les infos fournisseur + les produits regroupés
//  en distinguant les "habituels" et le reste du catalogue
// ============================================================
function renderSupplierBody(prods) {
  if (!prods.length) {
    return '<div class="acc-body"><div class="empty-state"><p>Aucun produit</p></div></div>';
  }

  const scores = getScores();
  const sorted = prods; // NE PAS re-trier ici

  const sup = prods[0].fournisseur;
  const fInfo = state.fournisseurs[sup] || {};

  let html = '<div class="acc-body">';

  // ----------------------------------------------------------
  // Barre d'infos fournisseur
  // ----------------------------------------------------------
  const infos = [];
  if (fInfo.contact) infos.push('👤 ' + escHtml(fInfo.contact));
  if (fInfo.telephone) infos.push('📱 ' + escHtml(fInfo.telephone));
  if (fInfo.notes) infos.push('⚠️ ' + escHtml(fInfo.notes));

  if (infos.length) {
    html += `<div class="acc-info-bar">${infos.join(' · ')}</div>`;
  }

  // ----------------------------------------------------------
  // Produits habituels / autres produits
  // ----------------------------------------------------------
  const habituels = sorted.filter(p => scores[productKey(p)] > 0);
  const autres = sorted.filter(p => !scores[productKey(p)]);

  if (habituels.length) {
    html += '<div class="section-label">⭐ Habituels</div>' + renderGrouped(habituels);

    if (autres.length) {
      html +=
        '<div class="section-label section-label--secondary">Catalogue complet</div>' +
        renderGrouped(autres);
    }
  } else {
    html += renderGrouped(sorted);
  }

  html += '</div>';
  return html;
}


// ============================================================
//  GROUPES PAR NOM COURT
// ============================================================
function getNomCourtsMultiples(fournisseur) {
  const prods = state.produits.filter(p => p.fournisseur === fournisseur);
  return nomsCourtsMultiples(prods);
}

function renderGrouped(prods) {
  if (!prods.length) return '';

  const fournisseur = prods[0].fournisseur;
  const multiNoms = getNomCourtsMultiples(fournisseur);
  const groups = regrouperParNomCourt(prods);

  return Object.entries(groups)
    .map(([nc, items]) => {
      const isMulti = multiNoms.has(nc);

      if (items.length === 1 && !isMulti) return renderRow(items[0], false);
      if (items.length === 1 && isMulti) return renderRow(items[0], true);

      return `
        <div class="nc-group">
          <div class="nc-header">${escHtml(nc)}</div>
          ${items.map(p => renderRow(p, true)).join('')}
        </div>
      `;
    })
    .join('');
}


// ============================================================
//  LIGNE PRODUIT
// ============================================================
function renderRow(p, isVariant) {
  return renderProduitAB(p, isVariant, state);
}


// ============================================================
//  BIND STEPPERS + EDITION
// ============================================================
function bindSteppers() {
  // ----------------------------------------------------------
  // Boutons + / -
  // ----------------------------------------------------------
  productList.querySelectorAll('.qty-btn').forEach(b =>
    b.addEventListener('click', onQtyBtn)
  );

  // ----------------------------------------------------------
  // Inputs quantité
  // ----------------------------------------------------------
  productList.querySelectorAll('.qty-input').forEach(i => {
    i.addEventListener('change', onQtyInput);
    i.addEventListener('focus', e => e.target.select());
  });

  // ----------------------------------------------------------
  // Boutons édition produit
  // ----------------------------------------------------------
  productList.querySelectorAll('.edit-btn').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(b.dataset.key);
    })
  );
}


// ============================================================
//  MISE A JOUR BADGE FOURNISSEUR
// ============================================================
//
//  Met à jour dynamiquement le badge d'un fournisseur
//  après changement de quantité
// ============================================================
function updateAccordionBadge(changedKey) {
  const p = state.produits.find(p => productKey(p) === changedKey);
  if (!p) return;

  const block = productList.querySelector(
    `.accordion-block[data-sup="${CSS.escape(p.fournisseur)}"]`
  );
  if (!block) return;

  const allP = getProduitsForEtab().filter(pr => pr.fournisseur === p.fournisseur);
  const ordered = allP.filter(pr => (state.quantities[productKey(pr)] || 0) > 0);

  const total = ordered.reduce(
    (s, pr) => s + (state.quantities[productKey(pr)] || 0) * getPrixColis(pr),
    0
  );

  const left = block.querySelector('.acc-left');
  const badge = left.querySelector('.acc-badge');

  if (ordered.length) {
    const h = `<span class="acc-badge">${ordered.length} art. · ${fmtPrice(total)}</span>`;

    if (badge) badge.outerHTML = h;
    else left.insertAdjacentHTML('beforeend', h);
  } else if (badge) {
    badge.remove();
  }
}

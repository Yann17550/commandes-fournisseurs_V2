// ============================================================
//  Fichier : ui_accordion.js
//  UI — ACCORDÉON (ÉTAB A / B)
// ============================================================

/**
 * Ce fichier gère :
 * - le rendu de l'accordéon fournisseur pour les établissements A/B ;
 * - l'ouverture / fermeture des blocs fournisseur ;
 * - le binding des steppers quantité ;
 * - le binding du bouton edit produit ;
 * - le bouton d'ajout de produit.
 *
 * Point important :
 * le bouton edit doit transmettre un objet produit complet
 * à openEditModal(...), et non une simple clé texte.
 */

// ---- Accordéon principal -----------------------------------
function renderAccordion() {
  if (state.etab && state.etab.id === 'gerant') {
    renderAccordionGerant();
    return;
  }

  // Tri des fournisseurs selon leur ordre
  const suppliers = getSuppliers().sort((a, b) => {
    const fa = state.produits.find((p) => p.fournisseur === a)?.ordre_fournisseur || 999;
    const fb = state.produits.find((p) => p.fournisseur === b)?.ordre_fournisseur || 999;
    return fa - fb;
  });

  const allProds = getProduitsForEtab();

  if (!suppliers.length) {
    productList.innerHTML =
      '<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>';
    return;
  }

  let html = `
    <div class="fab-row">
      <button class="fab-add" id="fabAddBtn">+ Nouveau produit</button>
    </div>
  `;

  suppliers.forEach((sup) => {
    let prods = allProds.filter((p) => p.fournisseur === sup);

    // Tri global pipeline
    prods = triPipeline(prods, state.etab.id, state);

    const isOpen = state.openSupplier === sup;

    const ordered = prods.filter((p) => (state.quantities[productKey(p)] || 0) > 0);
    const supTotal = ordered.reduce(
      (sum, p) => sum + (state.quantities[productKey(p)] || 0) * getPrixColis(p),
      0
    );

    const appel = getJourAppel(sup);
    const appelHtml = appel
      ? `<span class="acc-appel${appel.today ? ' acc-appel--today' : ''}">
           ${appel.today ? '📞 Auj.' : escHtml(appel.label)}
         </span>`
      : '';

    html += renderFournisseurBlock(sup, prods, isOpen, state);
  });

  productList.innerHTML = html;

  const fab = $('fabAddBtn');
  if (fab) {
    fab.addEventListener('click', openAddModal);
  }

  productList.querySelectorAll('.accordion-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;
      state.openSupplier = state.openSupplier === sup ? null : sup;
      renderAccordion();

      setTimeout(() => {
        const opened = productList.querySelector('.accordion-block.is-open');
        if (opened) {
          opened.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 40);
    });
  });

  bindSteppers();
}

// ---- Corps du fournisseur ----------------------------------
function renderSupplierBody(prods) {
  if (!prods.length) {
    return '<div class="acc-body"><div class="empty-state"><p>Aucun produit</p></div></div>';
  }

  const scores = getScores();
  const sorted = prods; // Ne pas retraiter ici

  const sup = prods[0].fournisseur;
  const fInfo = state.fournisseurs[sup] || {};

  let html = '<div class="acc-body">';

  const infos = [];
  if (fInfo.contact) infos.push('👤 ' + escHtml(fInfo.contact));
  if (fInfo.telephone) infos.push('📱 ' + escHtml(fInfo.telephone));
  if (fInfo.notes) infos.push('⚠️ ' + escHtml(fInfo.notes));

  if (infos.length) {
    html += `<div class="acc-info-bar">${infos.join(' · ')}</div>`;
  }

  const habituels = sorted.filter((p) => scores[productKey(p)] > 0);
  const autres = sorted.filter((p) => !scores[productKey(p)]);

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

// ---- Groupement par nom court ------------------------------
function getNomCourtsMultiples(fournisseur) {
  const prods = state.produits.filter((p) => p.fournisseur === fournisseur);
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
          ${items.map((p) => renderRow(p, true)).join('')}
        </div>
      `;
    })
    .join('');
}

// ---- Ligne produit -----------------------------------------
function renderRow(p, isVariant) {
  return renderProduitAB(p, isVariant, state);
}

// ---- Recherche produit pour édition ------------------------
/**
 * Retrouve le produit correspondant à une clé d'interface.
 * La clé attendue est celle produite par productKey(p).
 */
function findProduitByKey(key) {
  if (!key) {
    return null;
  }

  return (state.produits || []).find((p) => productKey(p) === key) || null;
}

// ---- Steppers + bouton edit -------------------------------
function bindSteppers() {
  productList.querySelectorAll('.qty-btn').forEach((btn) =>
    btn.addEventListener('click', onQtyBtn)
  );

  productList.querySelectorAll('.qty-input').forEach((input) => {
    input.addEventListener('change', onQtyInput);
    input.addEventListener('focus', (e) => e.target.select());
  });

  productList.querySelectorAll('.edit-btn').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const key = btn.dataset.key;
      const produit = findProduitByKey(key);

      if (!produit) {
        console.error('Produit introuvable pour édition.', { key, dataset: btn.dataset });
        showToast('❌ Impossible de retrouver ce produit pour édition');
        return;
      }

      openEditModal(produit);
    })
  );
}

// ---- Mise à jour badge fournisseur -------------------------
function updateAccordionBadge(changedKey) {
  const p = state.produits.find((prod) => productKey(prod) === changedKey);
  if (!p) return;

  const block = productList.querySelector(
    `.accordion-block[data-sup="${CSS.escape(p.fournisseur)}"]`
  );
  if (!block) return;

  const allP = getProduitsForEtab().filter((pr) => pr.fournisseur === p.fournisseur);
  const ordered = allP.filter((pr) => (state.quantities[productKey(pr)] || 0) > 0);

  const total = ordered.reduce(
    (sum, pr) => sum + (state.quantities[productKey(pr)] || 0) * getPrixColis(pr),
    0
  );

  const left = block.querySelector('.acc-left');
  const badge = left.querySelector('.acc-badge');

  if (ordered.length) {
    const html = `<span class="acc-badge">${ordered.length} art. · ${fmtPrice(total)}</span>`;
    if (badge) {
      badge.outerHTML = html;
    } else {
      left.insertAdjacentHTML('beforeend', html);
    }
  } else if (badge) {
    badge.remove();
  }
}

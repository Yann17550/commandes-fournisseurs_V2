// ============================================================
//  UI — ACCORDÉON (ÉTAB A / B)
// ============================================================

// ---- Accordéon principal -----------------------------------
function renderAccordion() {
  if (state.etab && state.etab.id === 'gerant') {
    // Le mode gérant est géré dans ui_accordion_gerant.js
    renderAccordionGerant();
    return;
  }

  const suppliers = getSuppliers();
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

  suppliers.forEach(sup => {
    const prods = allProds.filter(p => p.fournisseur === sup);
    const isOpen = state.openSupplier === sup;

    const ordered = prods.filter(p => (state.quantities[productKey(p)] || 0) > 0);
    const supTotal = ordered.reduce(
      (s, p) => s + (state.quantities[productKey(p)] || 0) * getPrixColis(p),
      0
    );

    const appel = getJourAppel(sup);
    const appelHtml = appel
      ? `<span class="acc-appel${appel.today ? ' acc-appel--today' : ''}">
           ${appel.today ? '📞 Auj.' : escHtml(appel.label)}
         </span>`
      : '';

    html += `
      <div class="accordion-block${isOpen ? ' is-open' : ''}" data-sup="${escHtml(sup)}">
        <button class="accordion-header" data-sup="${escHtml(sup)}">
          <div class="acc-left">
            <div class="acc-title-row">
              <span class="acc-name">${escHtml(sup)}</span>
              ${appelHtml}
            </div>
            ${
              ordered.length
                ? `<span class="acc-badge">${ordered.length} art. · ${fmtPrice(supTotal)}</span>`
                : ''
            }
          </div>
          <span class="acc-chevron">${isOpen ? '▾' : '▸'}</span>
        </button>

        ${isOpen ? renderSupplierBody(prods) : ''}
      </div>
    `;
  });

  productList.innerHTML = html;

  // FAB
  const fab = $('fabAddBtn');
  if (fab) fab.addEventListener('click', openAddModal);

  // Toggle accordéon
  productList.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;
      state.openSupplier = state.openSupplier === sup ? null : sup;
      renderAccordion();

      setTimeout(() => {
        const o = productList.querySelector('.accordion-block.is-open');
        if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    });
  });

  bindSteppers();
}

// ---- Corps du fournisseur ----------------------------------
function renderSupplierBody(prods) {
  if (!prods.length)
    return '<div class="acc-body"><div class="empty-state"><p>Aucun produit</p></div></div>';

  const scores = getScores();
  const sorted = sortProducts(prods);
  const sup = prods[0].fournisseur;
  const fInfo = state.fournisseurs[sup] || {};

  let html = '<div class="acc-body">';

  // Infos fournisseur
  const infos = [];
  if (fInfo.contact)   infos.push('👤 ' + escHtml(fInfo.contact));
  if (fInfo.telephone) infos.push('📱 ' + escHtml(fInfo.telephone));
  if (fInfo.notes)     infos.push('⚠️ ' + escHtml(fInfo.notes));

  if (infos.length)
    html += `<div class="acc-info-bar">${infos.join(' · ')}</div>`;

  // Habituels / autres
  const habituels = sorted.filter(p => scores[productKey(p)] > 0);
  const autres    = sorted.filter(p => !scores[productKey(p)]);

  if (habituels.length) {
    html += '<div class="section-label">⭐ Habituels</div>' + renderGrouped(habituels);

    if (autres.length)
      html += '<div class="section-label section-label--secondary">Catalogue complet</div>' +
              renderGrouped(autres);
  } else {
    html += renderGrouped(sorted);
  }

  html += '</div>';
  return html;
}

// ---- Groupement par nom court ------------------------------
function getNomCourtsMultiples(fournisseur) {
  const counts = {};
  state.produits
    .filter(p => p.fournisseur === fournisseur)
    .forEach(p => {
      counts[p.nom_court] = (counts[p.nom_court] || 0) + 1;
    });

  return new Set(
    Object.entries(counts)
      .filter(([, n]) => n > 1)
      .map(([k]) => k)
  );
}

function renderGrouped(prods) {
  if (!prods.length) return '';

  const fournisseur = prods[0].fournisseur;
  const multiNoms = getNomCourtsMultiples(fournisseur);

  const groups = {};
  prods.forEach(p => {
    if (!groups[p.nom_court]) groups[p.nom_court] = [];
    groups[p.nom_court].push(p);
  });

  return Object.entries(groups)
    .map(([nc, items]) => {
      const isMulti = multiNoms.has(nc);

      if (items.length === 1 && !isMulti) return renderRow(items[0], false);
      if (items.length === 1 && isMulti)  return renderRow(items[0], true);

      return `
        <div class="nc-group">
          <div class="nc-header">${escHtml(nc)}</div>
          ${items.map(p => renderRow(p, true)).join('')}
        </div>
      `;
    })
    .join('');
}

// ---- Ligne produit -----------------------------------------
function renderRow(p, isVariant) {
  const key = productKey(p);
  const d = getProductData(p);

  const qtyColis = state.quantities[key] || 0;
  const prixColis = getPrixColis(p);
  const nbUnites = getNbUnites(p, qtyColis);
  const totalLigne = qtyColis * prixColis;

  const hasAlcool = p.droit_alcool > 0 || p.taxe_secu > 0;
  const mainLabel = isVariant ? d.label : p.nom_court;
  const subLabel = !isVariant && d.label !== p.nom_court ? d.label : '';

  const lastQty = state.lastOrder[key] || 0;
  const hasOverride = !!state.overrides[key];

  const colissageInfo =
    d.colissage > 1
      ? `<span class="colissage-info">${fmtPrice(d.prix_ht)}/u · ${d.colissage}u/colis</span>`
      : '';

  const lastHtml =
    lastQty > 0 && !qtyColis
      ? `<div class="last-order" title="${escHtml(state.lastSemaine)}">
           ↩ ${lastQty} colis la derniere fois
         </div>`
      : '';

  return `
    <div class="product-card${qtyColis > 0 ? ' has-qty' : ''}${isVariant ? ' is-variant' : ''}${hasOverride ? ' has-override' : ''}" data-key="${escHtml(key)}">
      <div class="product-info">
        <div class="product-nom-row">
          <span class="product-nom">${escHtml(mainLabel)}</span>
          <button class="edit-btn" data-key="${escHtml(key)}" title="Modifier">✏️</button>
        </div>

        ${subLabel ? `<div class="product-sub">${escHtml(subLabel)}</div>` : ''}

        <div class="product-meta">
          <span class="product-ref${hasOverride ? ' ref-override' : ''}">${escHtml(d.reference)}</span>
          <span class="product-prix">${fmtPrice(prixColis)}/colis</span>
          ${colissageInfo}
          ${
            qtyColis > 0
              ? `<span class="product-prix-total">${nbUnites} u. = ${fmtPrice(totalLigne)}</span>`
              : ''
          }
          ${hasAlcool ? '<span class="badge-alcool">🍷</span>' : ''}
        </div>

        ${lastHtml}
      </div>

      <div class="qty-stepper">
        <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
        <input class="qty-input" type="number" min="0" step="1" value="${qtyColis}" data-key="${escHtml(key)}" inputmode="numeric">
        <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
      </div>
    </div>
  `;
}

// ---- Steppers ----------------------------------------------
function bindSteppers() {
  productList.querySelectorAll('.qty-btn').forEach(b =>
    b.addEventListener('click', onQtyBtn)
  );

  productList.querySelectorAll('.qty-input').forEach(i => {
    i.addEventListener('change', onQtyInput);
    i.addEventListener('focus', e => e.target.select());
  });

  productList.querySelectorAll('.edit-btn').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(b.dataset.key);
    })
  );
}

// ---- Mise à jour badge fournisseur -------------------------
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

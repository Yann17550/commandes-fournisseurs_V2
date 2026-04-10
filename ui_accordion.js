// ============================================================
//  UI — ACCORDÉON (ÉTAB A / B) 
// ============================================================

// ---- Accordéon principal -----------------------------------
function renderAccordion() {
  if (state.etab && state.etab.id === 'gerant') {
    renderAccordionGerant();
    return;
  }

  // 🟩 Tri des fournisseurs
  const suppliers = getSuppliers().sort((a, b) => {
    const fa = state.produits.find(p => p.fournisseur === a)?.ordre_fournisseur || 999;
    const fb = state.produits.find(p => p.fournisseur === b)?.ordre_fournisseur || 999;
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

  suppliers.forEach(sup => {
    let prods = allProds.filter(p => p.fournisseur === sup);

    // 🟩 Tri global + tri dynamique (LE SEUL TRI)
    prods = triPipeline(prods, state.etab.id, state);

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

  html += renderFournisseurBlock(sup, prods, isOpen, state);

  });

  productList.innerHTML = html;

  const fab = $('fabAddBtn');
  if (fab) fab.addEventListener('click', openAddModal);

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
  const sorted = prods; // 🟩 NE PAS RE-TRIER ICI

  const sup = prods[0].fournisseur;
  const fInfo = state.fournisseurs[sup] || {};

  let html = '<div class="acc-body">';

  const infos = [];
  if (fInfo.contact) infos.push('👤 ' + escHtml(fInfo.contact));
  if (fInfo.telephone) infos.push('📱 ' + escHtml(fInfo.telephone));
  if (fInfo.notes) infos.push('⚠️ ' + escHtml(fInfo.notes));

  if (infos.length)
    html += `<div class="acc-info-bar">${infos.join(' · ')}</div>`;

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
  return renderProduitAB(p, isVariant, state);
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

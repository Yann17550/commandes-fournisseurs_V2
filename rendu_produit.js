// ============================================================
//  RENDU PRODUIT — A/B
//  Extraction propre de renderRow() sans rien changer
// ============================================================

function renderProduitAB(p, isVariant, state) {
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

// ============================================================
//  RENDU PRODUIT — A/B
//  Version compacte inspirée du layout gérant
// ============================================================

function renderProduitAB(p, isVariant, state) {
  const key = productKey(p);
  const d = getProductData(p);

  const qtyColis = state.quantities[key] || 0;
  const prixColis = getPrixColis(p);
  const nbUnites = getNbUnites(p, qtyColis);
  const totalLigne = qtyColis * prixColis;

  const hasAlcool = p.droit_alcool > 0 || p.taxe_secu > 0;
  const hasOverride = !!state.overrides[key];

  // Libellé principal / secondaire
  const mainLabel = isVariant ? d.label : p.nom_court;
  const subLabel = !isVariant && d.label !== p.nom_court ? d.label : '';

  // Historique
  const lastQty = state.lastOrder[key] || 0;
  const lastHtml =
    lastQty > 0 && !qtyColis
      ? `<div class="last-order" title="${escHtml(state.lastSemaine)}">
           ↩ ${lastQty} colis la derniere fois
         </div>`
      : '';

  // Infos colissage
  const colissageInfo =
    d.colissage > 1
      ? `<span class="colissage-info">${fmtPrice(d.prix_ht)}/u · ${d.colissage}u/colis</span>`
      : '';

  return `
    <div class="Article_ab${qtyColis > 0 ? ' has-qty' : ''}${isVariant ? ' is-variant' : ''}${hasOverride ? ' has-override' : ''}" data-key="${escHtml(key)}">

      <!-- Ligne 1 : nom + prix + édition -->
      <div class="nom_prix_ab">
        <div class="nom_block_ab">
          <div class="product-nom-row">
            <span class="nom_article_ab">${escHtml(mainLabel)}</span>
            <button class="edit-btn" data-key="${escHtml(key)}" title="Modifier">✏️</button>
          </div>

          ${subLabel ? `<div class="product-sub">${escHtml(subLabel)}</div>` : ''}
        </div>

        <div class="prix_block_ab">
          <span class="prix_article_ab">${fmtPrice(prixColis)}/colis</span>
        </div>
      </div>

      <!-- Ligne 2 : meta + stepper -->
      <div class="qte_article_ab">
        <div class="meta_ab">
          <div class="product-meta">
            <span class="product-ref${hasOverride ? ' ref-override' : ''}">${escHtml(d.reference)}</span>
            ${colissageInfo}
            ${qtyColis > 0 ? `<span class="product-prix-total">${nbUnites} u. = ${fmtPrice(totalLigne)}</span>` : ''}
            ${hasAlcool ? '<span class="badge-alcool">🍷</span>' : ''}
          </div>
          ${lastHtml}
        </div>

        <div class="stepper-ab">
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
          <input
            class="qty-input"
            type="number"
            min="0"
            step="1"
            value="${qtyColis}"
            data-key="${escHtml(key)}"
            inputmode="numeric"
          >
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
          <span class="total_ab">${qtyColis > 0 ? fmtPriceNoEuro(totalLigne) : ''}</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
//  RENDU PRODUIT — A/B
//  Version compacte inspirée du layout gérant
// ============================================================

function renderProduitAB(p, isVariant, state) {
  const key = productKey(p);
  const d = getProductData(p);

  const qtyColis = state.quantities[key] || 0;
  const prixColis = getPrixColis(p);
  const totalLigne = qtyColis * prixColis;
  const hasOverride = !!state.overrides[key];

  const mainLabel = isVariant ? d.label : p.nom_court;
  const colissageInfo = d.colissage > 1 ? `${d.colissage}u/colis` : '1u/colis';

  return `
    <div class="Article_ab${qtyColis > 0 ? ' has-qty' : ''}${isVariant ? ' is-variant' : ''}${hasOverride ? ' has-override' : ''}" data-key="${escHtml(key)}">
      <div class="line1_ab">
        <span class="nom_article_ab">${escHtml(mainLabel)}</span>
        <span class="colissage_ab">${escHtml(colissageInfo)}</span>
      </div>

      <div class="line2_ab">
        <span class="reference_ab product-ref${hasOverride ? ' ref-override' : ''}">${escHtml(d.reference)}</span>

        <div class="stepper_ab">
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
          <input class="qty-input" type="number" min="0" step="1" value="${qtyColis}" data-key="${escHtml(key)}" inputmode="numeric">
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
          <button class="edit-btn" data-key="${escHtml(key)}" type="button" title="Modifier l'article">✏️</button>
          <span class="total_ab">${qtyColis > 0 ? fmtPriceNoEuro(totalLigne) : ''}</span>
        </div>
      </div>
    </div>
  `;
}

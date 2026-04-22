// ============================================================
//  RENDU PRODUIT — A/B
//  Version compacte inspirée du layout gérant
// ============================================================

function renderProduitAB(p, isVariant, state) {
  const key = productKey(p);
  const d = getProductData(p);

  const qtyColis = state.quantities[key] || 0;
  const hasOverride = !!state.overrides[key];

  const mainLabel = isVariant ? d.label : p.nom_court;

  const colissageInfo =
    d.colissage > 1
      ? `${d.colissage}u/colis`
      : '1u/colis';

  return `
    <div class="product-card product-card--compact${qtyColis > 0 ? ' has-qty' : ''}${isVariant ? ' is-variant' : ''}${hasOverride ? ' has-override' : ''}" data-key="${escHtml(key)}">
      
      <div class="product-line-1">
        <span class="product-nom">${escHtml(mainLabel)}</span>
        <span class="product-colissage">${escHtml(colissageInfo)}</span>
      </div>

      <div class="product-line-2">
        <span class="product-ref${hasOverride ? ' ref-override' : ''}">${escHtml(d.reference)}</span>

        <div class="qty-stepper qty-stepper--compact">
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
          <input class="qty-input" type="number" min="0" step="1" value="${qtyColis}" data-key="${escHtml(key)}" inputmode="numeric">
          <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
        </div>
      </div>
    </div>
  `;
}

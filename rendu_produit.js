// ============================================================
//  Fichier : rendu_produit.js
//  Bloc produit compact pour vue établissement simple
//
//  Structure validée :
//  - Ligne 1 : nom produit | designation | colissage
//  - Ligne 2 : référence | prix colis | edit | stepper
//
//  Priorités visuelles :
//  - nom produit
//  - stepper
// ============================================================

function renderProduitAB(p, isVariant, state) {
  const key = productKey(p);
  const d = getProductData(p);

  const qtyColis = state.quantities[key] || 0;
  const prixColis = getPrixColis(p);
  const totalLigne = qtyColis * prixColis;
  const hasOverride = !!state.overrides[key];

  const mainLabel = isVariant ? d.label : p.nom_court;
  const designation = p.designation || '';
  const colissageInfo = d.colissage > 1 ? `${d.colissage}u/colis` : '1u/colis';

  return `
    <div class="Article_ab${qtyColis > 0 ? ' has-qty' : ''}${isVariant ? ' is-variant' : ''}${hasOverride ? ' has-override' : ''}" data-key="${escHtml(key)}">

      <div class="line1_ab">
        <div class="bloc1-1_ab">
          ${escHtml(mainLabel || '')}
        </div>

        <div class="bloc1-2_ab">
          ${escHtml(designation)}
        </div>

        <div class="bloc1-3_ab">
          ${escHtml(colissageInfo)}
        </div>
      </div>

      <div class="line2_ab">
        <div class="bloc2-1_ab">
          <span class="reference_ab product-ref${hasOverride ? ' ref-override' : ''}">
            ${escHtml(d.reference || '')}
          </span>
        </div>

        <div class="bloc2-2_ab">
          <span class="prix-colis_ab">
            ${fmtPrice(prixColis)}
          </span>
        </div>

        <div class="bloc2-3_ab">
          <button
            class="edit-btn edit-btn-ab"
            data-key="${escHtml(key)}"
            type="button"
            title="Modifier l'article">
            edit
          </button>
        </div>

        <div class="bloc2-4_ab">
          <div class="stepper_ab">
            <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
            <input
              class="qty-input"
              type="number"
              min="0"
              step="1"
              value="${qtyColis}"
              data-key="${escHtml(key)}"
              inputmode="numeric">
            <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
            <span class="total_ab">${qtyColis > 0 ? fmtPriceNoEuro(totalLigne) : ''}</span>
          </div>
        </div>
      </div>

    </div>
  `;
}

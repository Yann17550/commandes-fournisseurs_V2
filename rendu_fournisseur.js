// ============================================================
//  RENDU FOURNISSEUR — A/B
//  Extraction propre de l'accordéon fournisseur
// ============================================================

function renderFournisseurBlock(sup, prods, isOpen, state) {
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

  return `
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
}

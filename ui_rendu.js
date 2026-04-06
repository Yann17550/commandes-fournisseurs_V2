// ============================================================
//  UI — RENDU GLOBAL (render, erreurs, total)
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["ui_rendu.js"] = "2026-04-06T18:31:00";

// ---- Rendu principal ---------------------------------------
function render() {
  loadingState.style.display = 'none';
  productList.style.display  = 'block';

  weekLabel.textContent = getWeekLabel();

  renderAccordion();
  updateTotal();
}

// ---- Rendu erreur ------------------------------------------
function renderError() {
  document.querySelectorAll('.error-banner').forEach(e => e.remove());

  const div = document.createElement('div');
  div.className = 'error-banner';
  div.innerHTML = '<strong>Erreur</strong><br>' + escHtml(state.error);

  mainContent.prepend(div);
}

// ---- Total bas de page -------------------------------------
function updateTotal() {
  // Mode gérant → on masque totalement la barre du bas
  if (state.etab && state.etab.id === 'gerant') {
    bottomBar.style.display = 'none';
    summaryBtn.style.display = 'none';
    totalAmount.textContent = fmtPrice(0);
    return;
  }

  // Mode A ou B
  let total = 0;
  let hasAny = false;

  getProduitsForEtab().forEach(p => {
    const qty = state.quantities[productKey(p)] || 0;
    if (qty > 0) {
      total += qty * getPrixColis(p);
      hasAny = true;
    }
  });

  totalAmount.textContent = fmtPrice(total);
  bottomBar.style.display = hasAny ? 'flex' : 'none';
  summaryBtn.style.display = hasAny ? 'flex' : 'none';
}

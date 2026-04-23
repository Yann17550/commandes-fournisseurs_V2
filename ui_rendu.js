// ============================================================
//  UI — RENDU GLOBAL (render, erreurs, total)
// ============================================================

// ---- Rendu principal ---------------------------------------
function render() {
  loadingState.style.display = 'none';
  productList.style.display  = 'block';

  weekLabel.textContent = getWeekLabel();

  renderAccordion();
}

// ---- Rendu erreur ------------------------------------------
function renderError() {
  document.querySelectorAll('.error-banner').forEach(e => e.remove());

  const div = document.createElement('div');
  div.className = 'error-banner';
  div.innerHTML = '<strong>Erreur</strong><br>' + escHtml(state.error);

  mainContent.prepend(div);
}

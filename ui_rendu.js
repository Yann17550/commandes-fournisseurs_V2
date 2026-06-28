// ============================================================
//  Fichier : ui_rendu.js
//  UI — RENDU GLOBAL (render, erreurs)
// ============================================================

/**
 * Ce fichier gère uniquement :
 * - le rendu global de l'écran principal ;
 * - l'affichage des erreurs.
 *
 * Les interactions produit (edit, stepper, ajout, accordéon)
 * sont gérées ailleurs, notamment dans ui_accordion.js.
 */

// ============================================================
//  RENDU PRINCIPAL
// ============================================================

/**
 * Rendu principal de l'écran applicatif.
 * - cache l'état de chargement ;
 * - affiche la liste ;
 * - met à jour le libellé de semaine ;
 * - délègue ensuite le rendu détaillé à l'accordéon.
 */
function render() {
  loadingState.style.display = 'none';
  productList.style.display = 'block';

  weekLabel.textContent = getWeekLabel();

  renderAccordion();
}

// ============================================================
//  RENDU ERREUR
// ============================================================

/**
 * Affiche une bannière d'erreur en haut du contenu principal.
 * Toute ancienne bannière est supprimée avant affichage.
 */
function renderError() {
  document.querySelectorAll('.error-banner').forEach((e) => e.remove());

  const div = document.createElement('div');
  div.className = 'error-banner';
  div.innerHTML = '<strong>Erreur</strong><br>' + escHtml(state.error);

  mainContent.prepend(div);
}

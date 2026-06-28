// ============================================================
//  Fichier:ui_rendu.js
//  UI — RENDU GLOBAL (render, erreurs, total, interactions)
// ============================================================

/**
 * Ce fichier gère :
 * - le rendu global de l'écran principal ;
 * - l'affichage des erreurs ;
 * - les interactions globales liées à la zone produit,
 *   notamment l'ouverture de la modale d'édition.
 *
 * Le rendu HTML détaillé des produits reste dans rendu_produit.js.
 * Ici, on se contente de brancher les comportements UI transverses.
 */

// ============================================================
//  ETAT LOCAL
// ============================================================

/**
 * Empêche de brancher plusieurs fois les écouteurs globaux
 * sur la zone de liste produits.
 */
let productListUiBound = false;

// ============================================================
//  OUTILS
// ============================================================

/**
 * Recherche un produit à partir de sa clé d'interface.
 * La clé attendue est celle produite par productKey(p).
 */
function findProduitByKey(key) {
  if (!key) {
    return null;
  }

  return (state.produits || []).find((p) => productKey(p) === key) || null;
}

/**
 * Retourne le bouton edit cliqué si le clic provient bien
 * d'un bouton d'édition ou d'un de ses descendants.
 */
function getEditButtonFromEvent(event) {
  if (!event || !event.target) {
    return null;
  }

  return event.target.closest('.edit-btn');
}

// ============================================================
//  INTERACTIONS LISTE PRODUITS
// ============================================================

/**
 * Gère les clics dans la liste produits.
 * Ici, on intercepte le bouton "edit" via délégation d'événements.
 */
function handleProductListClick(event) {
  const editBtn = getEditButtonFromEvent(event);

  if (!editBtn) {
    return;
  }

  const key = editBtn.dataset.key;
  const produit = findProduitByKey(key);

  if (!produit) {
    console.error('Produit introuvable pour ouverture de la modale d’édition.', key);
    return;
  }

  if (typeof openEditModal === 'function') {
    openEditModal(produit);
  }
}

/**
 * Branche les écouteurs globaux de la zone produit.
 * Cette fonction ne doit être appelée qu'une seule fois.
 */
function bindProductListUi() {
  if (productListUiBound) {
    return;
  }

  if (!productList) {
    console.error('productList introuvable : impossible de brancher les interactions UI.');
    return;
  }

  productList.addEventListener('click', handleProductListClick);
  productListUiBound = true;
}

// ============================================================
//  RENDU PRINCIPAL
// ============================================================

/**
 * Rendu principal de l'écran applicatif.
 * - cache l'état de chargement ;
 * - affiche la liste ;
 * - met à jour le libellé de semaine ;
 * - lance le rendu accordion ;
 * - s'assure que les interactions globales sont bien branchées.
 */
function render() {
  loadingState.style.display = 'none';
  productList.style.display = 'block';

  weekLabel.textContent = getWeekLabel();

  bindProductListUi();
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

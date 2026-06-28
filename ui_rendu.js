// ============================================================
//  Fichier : ui_rendu.js
//  UI — rendu global, erreurs, interactions globales
// ============================================================

/**
 * Ce fichier gère :
 * - le rendu global de l'écran principal ;
 * - l'affichage des erreurs ;
 * - les interactions globales liées à la zone produit ;
 * - notamment l'ouverture de la modale d'édition via le bouton edit.
 *
 * Le HTML détaillé des produits est généré dans rendu_produit.js.
 * Ici, on ne fait que brancher les comportements transverses.
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
 * Retourne le bouton edit si le clic provient bien d'un bouton
 * d'édition ou d'un de ses descendants.
 */
function getEditButtonFromEvent(event) {
  if (!event || !event.target) {
    return null;
  }

  return event.target.closest('.edit-btn');
}

/**
 * Retourne le bloc produit parent lié au bouton edit.
 * On s'appuie sur le conteneur .Article_ab qui porte aussi data-key.
 */
function getProductCardFromEditButton(editBtn) {
  if (!editBtn) {
    return null;
  }

  return editBtn.closest('.Article_ab');
}

/**
 * Retourne la clé produit la plus fiable possible.
 *
 * Priorité :
 * 1. data-key du conteneur produit ;
 * 2. data-key du bouton edit ;
 * 3. null si rien n'est disponible.
 */
function getProductKeyFromEditButton(editBtn) {
  const card = getProductCardFromEditButton(editBtn);

  const cardKey = card?.dataset?.key || '';
  if (cardKey) {
    return cardKey;
  }

  const buttonKey = editBtn?.dataset?.key || '';
  if (buttonKey) {
    return buttonKey;
  }

  return null;
}

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
 * Variante de secours :
 * si jamais la clé n'est pas exploitable, on tente une recherche
 * à partir de quelques informations visibles dans la carte produit.
 *
 * Cette fonction est volontairement secondaire.
 * Elle sert uniquement à éviter une panne totale si la clé échoue.
 */
function findProduitFromCardFallback(card) {
  if (!card) {
    return null;
  }

  const refText = card.querySelector('.product-ref')?.textContent?.trim() || '';
  if (!refText) {
    return null;
  }

  return (
    (state.produits || []).find((p) => {
      const ref = (getProductData(p).reference || '').trim();
      return ref && ref === refText;
    }) || null
  );
}

/**
 * Résout le produit à éditer à partir de l'événement click.
 * On utilise d'abord la clé, puis un fallback par référence si besoin.
 */
function resolveProduitFromEditClick(event) {
  const editBtn = getEditButtonFromEvent(event);

  if (!editBtn) {
    return null;
  }

  const key = getProductKeyFromEditButton(editBtn);
  let produit = findProduitByKey(key);

  if (produit) {
    return produit;
  }

  const card = getProductCardFromEditButton(editBtn);
  produit = findProduitFromCardFallback(card);

  if (produit) {
    return produit;
  }

  console.error('Produit introuvable pour ouverture de la modale d’édition.', {
    key,
    buttonDataset: editBtn.dataset,
    cardDataset: card ? card.dataset : null
  });

  return null;
}

// ============================================================
//  INTERACTIONS LISTE PRODUITS
// ============================================================

/**
 * Gère les clics dans la liste produits.
 * Ici, on intercepte le bouton edit via délégation d'événements.
 */
function handleProductListClick(event) {
  const editBtn = getEditButtonFromEvent(event);

  if (!editBtn) {
    return;
  }

  const produit = resolveProduitFromEditClick(event);

  if (!produit) {
    showToast('❌ Impossible de retrouver ce produit pour édition');
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
 * - branche les interactions globales ;
 * - lance le rendu accordion.
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

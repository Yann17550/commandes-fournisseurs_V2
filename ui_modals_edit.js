// ============================================================
//  UI_MODALS_EDIT.JS
//  Gestion du comportement de la modale d'édition produit
// ============================================================

/**
 * Ce fichier gère uniquement le comportement de la modale d'édition.
 *
 * Responsabilités :
 * - ouvrir la modale avec les bonnes données ;
 * - préremplir les champs ;
 * - fermer la modale ;
 * - valider les données saisies ;
 * - sauvegarder les modifications en base ;
 * - mettre à jour l'état local puis relancer le rendu.
 *
 * Ce fichier ne crée pas le HTML de la modale.
 * Le HTML est injecté par ui_modals_view.js.
 */

// ============================================================
//  ETAT LOCAL DE LA MODALE
// ============================================================

/**
 * Produit actuellement en cours d'édition.
 * Tant qu'il vaut null, aucune édition n'est active.
 */
let currentEditProduct = null;

/**
 * Indique si les écouteurs de la modale ont déjà été branchés.
 * Cela évite les doubles addEventListener si l'initialisation est rejouée.
 */
let editModalEventsBound = false;

// ============================================================
//  ACCES DOM
// ============================================================

/**
 * Retourne toutes les références utiles de la modale d'édition.
 * On passe par une fonction au lieu de stocker des const globales fixes,
 * car la modale est injectée dynamiquement dans le DOM.
 */
function getEditModalElements() {
  return {
    modal: $('editModal'),
    closeBtn: $('closeEditModal'),
    cancelBtn: $('cancelEditBtn'),
    saveBtn: $('saveEditBtn'),
    title: $('editModalTitle'),
    refLabel: $('editRefLabel'),
    designationInput: $('editDesignation'),
    prixInput: $('editPrix'),
    colissageInput: $('editColissage'),
  };
}

/**
 * Vérifie que tous les éléments critiques de la modale existent.
 * Cela permet de sécuriser l'initialisation.
 */
function hasEditModalRequiredElements(elements) {
  return Boolean(
    elements.modal &&
    elements.closeBtn &&
    elements.cancelBtn &&
    elements.saveBtn &&
    elements.refLabel &&
    elements.designationInput &&
    elements.prixInput &&
    elements.colissageInput
  );
}

// ============================================================
//  OUVERTURE / FERMETURE
// ============================================================

/**
 * Ouvre la modale d'édition avec un produit donné.
 *
 * Paramètre attendu :
 * - product : objet produit de state.produits
 *
 * Le module appelant peut lui passer directement le produit sélectionné.
 */
function openEditModal(product) {
  const elements = getEditModalElements();

  if (!hasEditModalRequiredElements(elements)) {
    console.error('Modale d’édition introuvable ou incomplète dans le DOM.');
    return;
  }

  if (!product || !product.id) {
    console.error('openEditModal: produit invalide.');
    return;
  }

  currentEditProduct = product;

  elements.refLabel.textContent = product.reference || '';
  elements.designationInput.value = product.designation_fournisseur || product.designation || '';
  elements.prixInput.value = normalizeNumberForInput(product.prix_ht);
  elements.colissageInput.value = normalizeIntegerForInput(product.colissage, 1);

  elements.modal.style.display = 'flex';
  elements.modal.setAttribute('aria-hidden', 'false');

  // On place le focus sur le premier champ éditable utile.
  elements.designationInput.focus();
  elements.designationInput.select();
}

/**
 * Ferme la modale d'édition et réinitialise son état local.
 */
function closeEditModal() {
  const elements = getEditModalElements();

  if (!elements.modal) {
    return;
  }

  elements.modal.style.display = 'none';
  elements.modal.setAttribute('aria-hidden', 'true');

  currentEditProduct = null;
}

/**
 * Ferme la modale si l'utilisateur clique sur l'overlay
 * et non sur le contenu interne.
 */
function handleEditModalOverlayClick(event) {
  const elements = getEditModalElements();

  if (!elements.modal) {
    return;
  }

  if (event.target === elements.modal) {
    closeEditModal();
  }
}

/**
 * Ferme la modale avec la touche Echap si elle est ouverte.
 */
function handleEditModalEscape(event) {
  const elements = getEditModalElements();

  if (!elements.modal) {
    return;
  }

  const isOpen = elements.modal.style.display === 'flex';
  if (event.key === 'Escape' && isOpen) {
    closeEditModal();
  }
}

// ============================================================
//  NORMALISATION / VALIDATION
// ============================================================

/**
 * Prépare une valeur numérique pour affichage dans un input.
 * Retourne une chaîne vide si la valeur n'est pas exploitable.
 */
function normalizeNumberForInput(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

/**
 * Prépare une valeur entière pour affichage dans un input.
 * Si la valeur est invalide, on utilise le fallback donné.
 */
function normalizeIntegerForInput(value, fallback = 1) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : String(fallback);
}

/**
 * Nettoie la désignation saisie.
 */
function sanitizeDesignation(value) {
  return String(value || '').trim();
}

/**
 * Convertit et valide le prix unitaire HT.
 * Retourne NaN si la valeur est invalide.
 */
function parsePrixInput(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * Convertit et valide le colisage.
 * Retourne NaN si la valeur est invalide.
 */
function parseColissageInput(value) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 1 ? n : NaN;
}

/**
 * Lit et valide les champs de la modale d'édition.
 * Retourne un objet prêt pour la sauvegarde si tout est correct.
 * Retourne null en cas d'erreur.
 */
function getValidatedEditPayload() {
  const elements = getEditModalElements();

  const designation_fournisseur = sanitizeDesignation(elements.designationInput.value);
  const prix_unitaire_ht = parsePrixInput(elements.prixInput.value);
  const colisage = parseColissageInput(elements.colissageInput.value);

  if (!designation_fournisseur) {
    showToast('❌ La désignation fournisseur est obligatoire');
    elements.designationInput.focus();
    return null;
  }

  if (!Number.isFinite(prix_unitaire_ht)) {
    showToast('❌ Prix unitaire HT invalide');
    elements.prixInput.focus();
    return null;
  }

  if (!Number.isFinite(colisage)) {
    showToast('❌ Colisage invalide');
    elements.colissageInput.focus();
    return null;
  }

  const prix_colis = roundTo2(prix_unitaire_ht * colisage);

  return {
    designation_fournisseur,
    prix_unitaire_ht,
    colisage,
    prix_colis,
  };
}

/**
 * Arrondit un nombre à 2 décimales.
 */
function roundTo2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// ============================================================
//  SYNCHRONISATION ETAT LOCAL
// ============================================================

/**
 * Répercute dans state.produits les nouvelles valeurs enregistrées.
 * Cela permet d'éviter un rechargement complet immédiat après édition.
 */
function patchProductInState(productId, updates) {
  const index = state.produits.findIndex((p) => p.id === productId);

  if (index === -1) {
    return;
  }

  const oldProduct = state.produits[index];

  state.produits[index] = {
    ...oldProduct,
    designation_fournisseur: updates.designation_fournisseur,
    designation: updates.designation_fournisseur || oldProduct.designation_produit || '',
    prix_ht: updates.prix_unitaire_ht,
    colissage: updates.colisage,
    prix_colis: updates.prix_colis,
  };
}

// ============================================================
//  SAUVEGARDE
// ============================================================

/**
 * Sauvegarde les modifications de la modale d'édition dans Supabase.
 * Le produit édité est identifié par son id.
 */
async function saveEditModal() {
  if (!currentEditProduct || !currentEditProduct.id) {
    showToast('❌ Aucun produit sélectionné');
    return;
  }

  const elements = getEditModalElements();
  const payload = getValidatedEditPayload();

  if (!payload) {
    return;
  }

  const saveBtnInitialText = elements.saveBtn.textContent;
  elements.saveBtn.disabled = true;
  elements.saveBtn.textContent = 'Sauvegarde...';

  try {
    const { data, error } = await supabaseClient
      .from('produits')
      .update({
        designation_fournisseur: payload.designation_fournisseur,
        prix_unitaire_ht: payload.prix_unitaire_ht,
        colisage: payload.colisage,
        prix_colis: payload.prix_colis,
      })
      .eq('id', currentEditProduct.id)
      .select(`
        id,
        designation_fournisseur,
        prix_unitaire_ht,
        colisage,
        prix_colis
      `)
      .single();

    if (error) {
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('Aucune ligne mise à jour dans Supabase');
    }

    patchProductInState(data.id, {
      designation_fournisseur: data.designation_fournisseur,
      prix_unitaire_ht: data.prix_unitaire_ht,
      colisage: data.colisage,
      prix_colis: data.prix_colis,
    });

    showToast('✅ Produit mis à jour');
    closeEditModal();

    if (typeof render === 'function') {
      render();
    }
  } catch (err) {
    console.error('saveEditModal error:', err);
    showToast(`❌ ${err.message || 'Erreur de sauvegarde'}`);
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = saveBtnInitialText;
  }
}

// ============================================================
//  EVENEMENTS
// ============================================================

/**
 * Branche tous les écouteurs de la modale d'édition.
 * Cette fonction ne doit être exécutée qu'une seule fois.
 */
function bindEditModalEvents() {
  if (editModalEventsBound) {
    return;
  }

  const elements = getEditModalElements();

  if (!hasEditModalRequiredElements(elements)) {
    console.error('Impossible d’initialiser ui_modals_edit.js : éléments manquants.');
    return;
  }

  elements.closeBtn.addEventListener('click', closeEditModal);
  elements.cancelBtn.addEventListener('click', closeEditModal);
  elements.saveBtn.addEventListener('click', saveEditModal);
  elements.modal.addEventListener('click', handleEditModalOverlayClick);
  document.addEventListener('keydown', handleEditModalEscape);

  editModalEventsBound = true;
}

/**
 * Point d'entrée public du module d'édition.
 * À appeler une fois après initModalsView().
 */
function initEditModal() {
  bindEditModalEvents();
}

// ============================================================
//  API GLOBALE
// ============================================================

/**
 * Exposition globale minimale pour l'architecture actuelle en scripts classiques.
 * - initEditModal() : branche les événements
 * - openEditModal(product) : ouvre la modale avec le produit fourni
 * - closeEditModal() : ferme la modale
 */
window.initEditModal = initEditModal;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;

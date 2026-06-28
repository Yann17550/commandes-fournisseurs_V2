// ============================================================
//  UI_MODALS_ADD.JS
//  Gestion du comportement de la modale d'ajout produit
// ============================================================

/**
 * Ce fichier gère uniquement le comportement de la modale d'ajout.
 *
 * Responsabilités :
 * - ouvrir la modale ;
 * - remplir la liste des fournisseurs ;
 * - réinitialiser les champs ;
 * - fermer la modale ;
 * - valider les données saisies ;
 * - créer le produit en base ;
 * - mettre à jour l'état local puis relancer le rendu.
 *
 * Ce fichier ne crée pas le HTML de la modale.
 * Le HTML est injecté par ui_modals_view.js.
 */

// ============================================================
//  ETAT LOCAL DE LA MODALE
// ============================================================

/**
 * Indique si les écouteurs de la modale ont déjà été branchés.
 * Cela évite les doubles addEventListener en cas de réinitialisation.
 */
let addModalEventsBound = false;

// ============================================================
//  ACCES DOM
// ============================================================

/**
 * Retourne toutes les références utiles de la modale d'ajout.
 * On récupère les éléments à la demande car ils sont injectés dynamiquement.
 */
function getAddModalElements() {
  return {
    modal: $('addModal'),
    closeBtn: $('closeAddModal'),
    cancelBtn: $('cancelAddBtn'),
    saveBtn: $('saveAddBtn'),
    fournisseurSelect: $('addFournisseur'),
    nomCourtInput: $('addNomCourt'),
    designationInput: $('addDesignation'),
    refInput: $('addRef'),
    categorieInput: $('addCategorie'),
    prixInput: $('addPrix'),
    colissageInput: $('addColissage'),
  };
}

/**
 * Vérifie que tous les éléments essentiels de la modale existent.
 */
function hasAddModalRequiredElements(elements) {
  return Boolean(
    elements.modal &&
    elements.closeBtn &&
    elements.cancelBtn &&
    elements.saveBtn &&
    elements.fournisseurSelect &&
    elements.nomCourtInput &&
    elements.designationInput &&
    elements.refInput &&
    elements.categorieInput &&
    elements.prixInput &&
    elements.colissageInput
  );
}

// ============================================================
//  OUVERTURE / FERMETURE / RESET
// ============================================================

/**
 * Réinitialise tous les champs de la modale d'ajout.
 */
function resetAddModalForm() {
  const elements = getAddModalElements();

  if (!hasAddModalRequiredElements(elements)) {
    return;
  }

  elements.fournisseurSelect.value = '';
  elements.nomCourtInput.value = '';
  elements.designationInput.value = '';
  elements.refInput.value = '';
  elements.categorieInput.value = '';
  elements.prixInput.value = '';
  elements.colissageInput.value = '1';
}

/**
 * Ouvre la modale d'ajout.
 * Avant affichage, on recharge la liste des fournisseurs et on remet le formulaire à zéro.
 */
function openAddModal() {
  const elements = getAddModalElements();

  if (!hasAddModalRequiredElements(elements)) {
    console.error('Modale d’ajout introuvable ou incomplète dans le DOM.');
    return;
  }

  populateAddFournisseurOptions();
  resetAddModalForm();

  elements.modal.style.display = 'flex';
  elements.modal.setAttribute('aria-hidden', 'false');

  elements.fournisseurSelect.focus();
}

/**
 * Ferme la modale d'ajout.
 */
function closeAddModal() {
  const elements = getAddModalElements();

  if (!elements.modal) {
    return;
  }

  elements.modal.style.display = 'none';
  elements.modal.setAttribute('aria-hidden', 'true');
}

/**
 * Ferme la modale si l'utilisateur clique sur l'overlay.
 */
function handleAddModalOverlayClick(event) {
  const elements = getAddModalElements();

  if (!elements.modal) {
    return;
  }

  if (event.target === elements.modal) {
    closeAddModal();
  }
}

/**
 * Ferme la modale avec la touche Echap si elle est ouverte.
 */
function handleAddModalEscape(event) {
  const elements = getAddModalElements();

  if (!elements.modal) {
    return;
  }

  const isOpen = elements.modal.style.display === 'flex';
  if (event.key === 'Escape' && isOpen) {
    closeAddModal();
  }
}

// ============================================================
//  FOURNISSEURS
// ============================================================

/**
 * Retourne la liste des fournisseurs actifs,
 * triés par ordre alphabétique à partir de state.fournisseurs.
 *
 * Note :
 * state.fournisseurs est ici un objet indexé par nom,
 * donc on reconstruit une liste à partir de ses clés.
 */
function getAvailableSupplierNamesForAdd() {
  return Object.keys(state.fournisseurs || {}).sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Remplit la liste déroulante des fournisseurs dans la modale d'ajout.
 */
function populateAddFournisseurOptions() {
  const elements = getAddModalElements();

  if (!elements.fournisseurSelect) {
    return;
  }

  const supplierNames = getAvailableSupplierNamesForAdd();

  elements.fournisseurSelect.innerHTML = `
    <option value="">Choisir un fournisseur</option>
    ${supplierNames
      .map((name) => `<option value="${escHtml(name)}">${escHtml(name)}</option>`)
      .join('')}
  `;
}

// ============================================================
//  NORMALISATION / VALIDATION
// ============================================================

/**
 * Nettoie une chaîne texte simple.
 */
function sanitizeAddText(value) {
  return String(value || '').trim();
}

/**
 * Parse un prix saisi dans l'interface.
 * Accepte la virgule ou le point comme séparateur décimal.
 */
function parseAddPrixInput(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * Parse un colisage saisi dans l'interface.
 * Doit être un entier >= 1.
 */
function parseAddColissageInput(value) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 1 ? n : NaN;
}

/**
 * Tente de retrouver l'identifiant fournisseur à partir de son nom.
 * La source disponible dans app.js ne stocke pas encore l'id fournisseur
 * dans state.fournisseurs, donc on recherche dans state.produits.
 *
 * Cette stratégie suppose qu'au moins un produit existe déjà pour ce fournisseur.
 * Si plus tard tu stockes directement l'id dans state.fournisseurs,
 * cette fonction pourra être simplifiée.
 */
function findFournisseurIdByName(fournisseurNom) {
  const found = (state.produits || []).find((p) => p.fournisseur === fournisseurNom);
  return found ? found.fournisseur_id : null;
}

/**
 * Lit et valide les champs du formulaire d'ajout.
 * Retourne un objet prêt pour insertion si tout est correct.
 * Retourne null en cas d'erreur.
 */
function getValidatedAddPayload() {
  const elements = getAddModalElements();

  const fournisseurNom = sanitizeAddText(elements.fournisseurSelect.value);
  const nomCourt = sanitizeAddText(elements.nomCourtInput.value);
  const designationProduit = sanitizeAddText(elements.designationInput.value);
  const reference = sanitizeAddText(elements.refInput.value);
  const categorie = sanitizeAddText(elements.categorieInput.value) || 'Divers';
  const prixUnitaireHt = parseAddPrixInput(elements.prixInput.value);
  const colisage = parseAddColissageInput(elements.colissageInput.value);

  if (!fournisseurNom) {
    showToast('❌ Le fournisseur est obligatoire');
    elements.fournisseurSelect.focus();
    return null;
  }

  const fournisseurId = findFournisseurIdByName(fournisseurNom);
  if (!fournisseurId) {
    showToast('❌ Fournisseur introuvable');
    elements.fournisseurSelect.focus();
    return null;
  }

  if (!designationProduit) {
    showToast('❌ La désignation est obligatoire');
    elements.designationInput.focus();
    return null;
  }

  if (!reference) {
    showToast('❌ La référence est obligatoire');
    elements.refInput.focus();
    return null;
  }

  if (!Number.isFinite(prixUnitaireHt)) {
    showToast('❌ Prix unitaire HT invalide');
    elements.prixInput.focus();
    return null;
  }

  if (!Number.isFinite(colisage)) {
    showToast('❌ Colisage invalide');
    elements.colissageInput.focus();
    return null;
  }

  const prixColis = roundAddTo2(prixUnitaireHt * colisage);

  return {
    fournisseurNom,
    fournisseurId,
    nomCourt: nomCourt || designationProduit,
    designationProduit,
    reference,
    categorie,
    prixUnitaireHt,
    colisage,
    prixColis,
  };
}

/**
 * Arrondit un nombre à 2 décimales.
 */
function roundAddTo2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// ============================================================
//  SYNCHRONISATION ETAT LOCAL
// ============================================================

/**
 * Ajoute localement le produit créé dans state.produits
 * afin d'éviter un rechargement complet immédiat.
 */
function appendProductToState(createdRow, fournisseurNom) {
  const designationProduit = (createdRow.designation_produit || '').trim();
  const designationFournisseur = (createdRow.designation_fournisseur || '').trim();
  const nomCourt =
    (createdRow.nom_court || '').trim() ||
    designationProduit ||
    ('REF ' + ((createdRow.reference || '').trim() || createdRow.id));

  state.produits.push({
    id: createdRow.id,
    fournisseur: fournisseurNom,
    fournisseur_id: createdRow.fournisseur_id || null,
    reference: (createdRow.reference || '').trim(),
    designation: (designationFournisseur || designationProduit).trim(),
    designation_produit: designationProduit,
    designation_fournisseur: designationFournisseur,
    label: cleanDesignation(designationProduit || nomCourt),
    tva: parseNum(createdRow.tva),
    prix_ht: parseNum(createdRow.prix_unitaire_ht),
    droit_alcool: parseNum(createdRow.droit_alcool),
    taxe_secu: parseNum(createdRow.taxe_securite_sociale),
    nom_court: nomCourt,
    categorie: (createdRow.categorie || 'Divers').trim(),
    colissage: parseNum(createdRow.colisage) || 1,
    prix_colis: parseNum(createdRow.prix_colis),
    etablissement: 'AB',
    actif: true,
    isTemp: false,
    ordre_fournisseur: 999,
    ordre_categorie: parseNum(createdRow.ordre_cat) || 999,
  });
}

// ============================================================
//  SAUVEGARDE
// ============================================================

/**
 * Sauvegarde le nouveau produit dans Supabase.
 */
async function saveAddModal() {
  const elements = getAddModalElements();
  const payload = getValidatedAddPayload();

  if (!payload) {
    return;
  }

  const saveBtnInitialText = elements.saveBtn.textContent;
  elements.saveBtn.disabled = true;
  elements.saveBtn.textContent = 'Ajout...';

  try {
    const insertPayload = {
      fournisseur_id: payload.fournisseurId,
      reference: payload.reference,
      designation_produit: payload.designationProduit,
      designation_fournisseur: payload.designationProduit,
      nom_court: payload.nomCourt,
      categorie: payload.categorie,
      prix_unitaire_ht: payload.prixUnitaireHt,
      colisage: payload.colisage,
      prix_colis: payload.prixColis,
      actif: true,
    };

    const { data, error } = await supabaseClient
      .from('produits')
      .insert(insertPayload)
      .select(`
        id,
        fournisseur_id,
        reference,
        designation_produit,
        designation_fournisseur,
        nom_court,
        categorie,
        ordre_cat,
        tva,
        prix_unitaire_ht,
        colisage,
        prix_colis,
        droit_alcool,
        taxe_securite_sociale,
        actif
      `)
      .single();

    if (error) {
      throw error;
    }

    appendProductToState(data, payload.fournisseurNom);

    showToast('✅ Produit ajouté');
    closeAddModal();

    if (typeof render === 'function') {
      render();
    }
  } catch (err) {
    console.error(err);
    showToast(`❌ ${err.message || 'Erreur lors de l’ajout'}`);
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = saveBtnInitialText;
  }
}

// ============================================================
//  EVENEMENTS
// ============================================================

/**
 * Branche tous les écouteurs de la modale d'ajout.
 * Cette fonction ne doit être exécutée qu'une seule fois.
 */
function bindAddModalEvents() {
  if (addModalEventsBound) {
    return;
  }

  const elements = getAddModalElements();

  if (!hasAddModalRequiredElements(elements)) {
    console.error('Impossible d’initialiser ui_modals_add.js : éléments manquants.');
    return;
  }

  elements.closeBtn.addEventListener('click', closeAddModal);
  elements.cancelBtn.addEventListener('click', closeAddModal);
  elements.saveBtn.addEventListener('click', saveAddModal);
  elements.modal.addEventListener('click', handleAddModalOverlayClick);
  document.addEventListener('keydown', handleAddModalEscape);

  addModalEventsBound = true;
}

/**
 * Point d'entrée public du module d'ajout.
 * À appeler une fois après initModalsView().
 */
function initAddModal() {
  bindAddModalEvents();
}

// ============================================================
//  API GLOBALE
// ============================================================

/**
 * Exposition globale minimale pour l'architecture actuelle en scripts classiques.
 * - initAddModal() : branche les événements
 * - openAddModal() : ouvre la modale d'ajout
 * - closeAddModal() : ferme la modale d'ajout
 */
window.initAddModal = initAddModal;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;

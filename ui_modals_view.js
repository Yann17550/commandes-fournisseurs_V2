/**
 * ui_modals_view.js
 * -----------------
 * Rôle :
 * - centraliser le HTML des modales de l'application ;
 * - injecter ces modales une seule fois dans le DOM ;
 * - fournir un point d'entrée unique pour les modules métier
 *   (édition produit, création produit, plus tard fournisseur).
 *
 * Ce fichier NE doit PAS :
 * - contenir de logique Supabase ;
 * - contenir de logique métier ;
 * - lancer de sauvegarde ;
 * - gérer les validations métier.
 *
 * Ces responsabilités resteront dans :
 * - ui_modals_edit.js
 * - ui_modals_add.js
 * - futurs modules fournisseur.
 */


/**
 * Construit le HTML de la modale d'édition produit.
 * Cette structure reste volontairement orientée "vue" :
 * le module métier pourra remplir les champs, les vider,
 * en afficher d'autres plus tard, ou ajuster les libellés si besoin.
 */
function getEditModalHtml() {
  return `
    <div class="modal-overlay" id="editModal" style="display:none" aria-hidden="true">
      <div class="modal modal--small" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
        <div class="modal-header">
          <h2 id="editModalTitle">Modifier le produit</h2>
          <button class="icon-btn" id="closeEditModal" type="button" aria-label="Fermer la modale d'édition">X</button>
        </div>

        <div class="modal-body">
          <label class="edit-label" for="editRefLabel">Référence</label>
          <div id="editRefLabel" class="edit-readonly"></div>

          <label class="edit-label" for="editDesignation">Désignation fournisseur</label>
          <input class="edit-input" type="text" id="editDesignation">

          <label class="edit-label" for="editPrix">Prix unitaire HT (EUR)</label>
          <input class="edit-input" type="number" id="editPrix" step="0.01" min="0">

          <label class="edit-label" for="editColissage">Colisage (unités par colis)</label>
          <input class="edit-input" type="number" id="editColissage" step="1" min="1">

          <p class="edit-note">
            Les règles de chargement, validation et sauvegarde sont gérées par le module d'édition.
          </p>
        </div>

        <div class="modal-footer">
          <button class="copy-btn" id="saveEditBtn" type="button">Sauvegarder</button>
          <button class="reset-btn" id="cancelEditBtn" type="button">Annuler</button>
        </div>
      </div>
    </div>
  `;
}


/**
 * Construit le HTML de la modale de création produit.
 * Même principe : ce fichier fournit seulement la structure,
 * le comportement restera dans ui_modals_add.js.
 */
function getAddModalHtml() {
  return `
    <div class="modal-overlay" id="addModal" style="display:none" aria-hidden="true">
      <div class="modal modal--small" role="dialog" aria-modal="true" aria-labelledby="addModalTitle">
        <div class="modal-header">
          <h2 id="addModalTitle">Nouveau produit</h2>
          <button class="icon-btn" id="closeAddModal" type="button" aria-label="Fermer la modale d'ajout">X</button>
        </div>

        <div class="modal-body">
          <label class="edit-label" for="addFournisseur">Fournisseur</label>
          <select class="edit-input" id="addFournisseur"></select>

          <label class="edit-label" for="addNomCourt">Nom court</label>
          <input class="edit-input" type="text" id="addNomCourt">

          <label class="edit-label" for="addDesignation">Désignation complète</label>
          <input class="edit-input" type="text" id="addDesignation">

          <label class="edit-label" for="addRef">Référence</label>
          <input class="edit-input" type="text" id="addRef">

          <label class="edit-label" for="addCategorie">Catégorie</label>
          <input class="edit-input" type="text" id="addCategorie">

          <label class="edit-label" for="addPrix">Prix unitaire HT (EUR)</label>
          <input class="edit-input" type="number" id="addPrix" step="0.01" min="0">

          <label class="edit-label" for="addColissage">Colisage</label>
          <input class="edit-input" type="number" id="addColissage" step="1" min="1" value="1">

          <p class="edit-note">
            Les règles de création, validation et sauvegarde sont gérées par le module d'ajout.
          </p>
        </div>

        <div class="modal-footer">
          <button class="copy-btn" id="saveAddBtn" type="button">Ajouter</button>
          <button class="reset-btn" id="cancelAddBtn" type="button">Annuler</button>
        </div>
      </div>
    </div>
  `;
}


/**
 * Réserve un espace pour les futures modales fournisseur.
 * On ne crée pas encore la modale fournisseur elle-même,
 * mais on garde un emplacement logique pour la suite.
 */
function getSupplierModalHostHtml() {
  return `
    <div id="supplierModalHost" data-modal-host="supplier" style="display:none"></div>
  `;
}


/**
 * Regroupe tout le HTML des modales gérées par la couche "view".
 */
function getAllModalsHtml() {
  return `
    ${getEditModalHtml()}
    ${getAddModalHtml()}
    ${getSupplierModalHostHtml()}
  `;
}


/**
 * Vérifie l'existence du conteneur racine de modales.
 * S'il n'existe pas, il est créé puis ajouté à la fin du body.
 */
function ensureModalsRoot() {
  let root = document.getElementById("modalsRoot");

  if (root) {
    return root;
  }

  root = document.createElement("div");
  root.id = "modalsRoot";
  root.setAttribute("data-ui", "modals-root");
  document.body.appendChild(root);

  return root;
}


/**
 * Injecte les modales une seule fois.
 * Si l'initialisation est relancée, on évite toute double injection.
 */
function injectModalsView() {
  const root = ensureModalsRoot();

  if (root.dataset.injected === "true") {
    return root;
  }

  root.innerHTML = getAllModalsHtml();
  root.dataset.injected = "true";

  return root;
}


/**
 * Point d'entrée public du fichier.
 * Cette fonction devra être appelée tôt au démarrage de l'application,
 * avant les modules qui cherchent les éléments de modale dans le DOM.
 */
function initModalsView() {
  return injectModalsView();
}


/**
 * Exposition globale minimale pour rester compatible
 * avec le chargement actuel en scripts classiques.
 */
window.initModalsView = initModalsView;

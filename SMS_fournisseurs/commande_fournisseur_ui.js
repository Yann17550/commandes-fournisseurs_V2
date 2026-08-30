// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_UI
//  ------------------------------------------------------------
//  Ce fichier pilote l'écran "Commandes fournisseurs".
//
//  Responsabilités :
//  - demander un snapshot brut Supabase ;
//  - demander la construction du modèle métier fournisseur ;
//  - afficher la liste des fournisseurs avec commande active ;
//  - ouvrir la vue SMS du fournisseur cliqué.
//
//  Ce fichier ne doit jamais :
//  - interroger Supabase directement ;
//  - calculer les montants métier lui-même ;
//  - envoyer un SMS lui-même.
// ============================================================

(function attachCommandeFournisseurUiModule(global) {
  'use strict';

  // ----------------------------------------------------------
  //  Store local du module
  //  On garde ici l'état nécessaire uniquement à cet écran.
  // ----------------------------------------------------------
  const cfUiStore = {
    loading: false,
    snapshot: null,
    model: null,
    selectedSupplierName: '',
    lastError: null
  };

  /**
   * Accès DOM aligné sur ton code existant.
   *
   * Dans le projet, le helper "$" est déclaré globalement
   * dans un autre script via :
   *   const $ = id => document.getElementById(id);
   *
   * On l'utilise s'il existe. Sinon, on fallback proprement
   * sur document.getElementById().
   */
  function cfUiGetEl(id) {
    if (typeof $ === 'function') return $(id);
    return document.getElementById(id);
  }

  /**
   * Élément racine de la zone d'affichage Commandes fournisseurs.
   */
  function cfUiGetListRoot() {
    return cfUiGetEl('supplierOrdersList');
  }

  /**
   * Vérifie uniquement les dépendances réellement indispensables
   * au fonctionnement de ce module.
   *
   * IMPORTANT :
   * On ne suppose plus l'existence de window.$.
   */
  function cfUiMustHaveDependencies() {
    if (typeof global.sbSnapshotLoadNowStrict !== 'function') {
      throw new Error('sbSnapshotLoadNowStrict est introuvable');
    }

    if (typeof global.cfBuildSupplierDataModel !== 'function') {
      throw new Error('cfBuildSupplierDataModel est introuvable');
    }
  }

  /**
   * Echappement HTML.
   * On réutilise escHtml si disponible dans l'application,
   * sinon on applique un fallback sûr.
   */
  function cfUiEsc(value) {
    if (typeof escHtml === 'function') {
      return escHtml(value);
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formatage prix.
   * Même logique : réutiliser l'existant si disponible.
   */
  function cfUiFmtPrice(value) {
    if (typeof fmtPrice === 'function') {
      return fmtPrice(value);
    }

    return Number(value || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  /**
   * Affiche un toast si la fonction existe déjà dans l'application.
   */
  function cfUiShowToast(message) {
    if (typeof showToast === 'function') {
      showToast(message);
    }
  }

  /**
   * Remise à zéro du store local du module.
   */
  function cfUiResetStore() {
    cfUiStore.loading = false;
    cfUiStore.snapshot = null;
    cfUiStore.model = null;
    cfUiStore.selectedSupplierName = '';
    cfUiStore.lastError = null;
  }

  // ----------------------------------------------------------
  //  États d'affichage
  // ----------------------------------------------------------

  /**
   * Affichage de chargement pendant la lecture du snapshot.
   */
  function cfUiRenderLoading() {
    const root = cfUiGetListRoot();
    if (!root) return;

    root.innerHTML = `
      <div class="supplier-orders-state supplier-orders-state--loading">
        <p class="etab-sub">Chargement des données Supabase...</p>
      </div>
    `;
  }

  /**
   * Affichage vide lorsqu'aucun fournisseur n'a de commande active.
   */
  function cfUiRenderEmpty() {
    const root = cfUiGetListRoot();
    if (!root) return;

    root.innerHTML = `
      <div class="supplier-orders-state supplier-orders-state--empty">
        <p class="etab-sub">Aucune commande fournisseur pour le moment.</p>
      </div>
    `;
  }

  /**
   * Affichage d'erreur lisible à l'écran.
   */
  function cfUiRenderError(error) {
    const root = cfUiGetListRoot();
    if (!root) return;

    const msg = error && error.message
      ? error.message
      : 'Erreur inconnue';

    root.innerHTML = `
      <div class="supplier-orders-state supplier-orders-state--error">
        <p class="etab-sub">Erreur de chargement.</p>
        <pre class="supplier-orders-error">${cfUiEsc(msg)}</pre>
      </div>
    `;
  }

  // ----------------------------------------------------------
  //  Rendu de la liste fournisseurs
  // ----------------------------------------------------------

  /**
   * Affiche la liste des fournisseurs préparée par le modèle métier.
   */
  function cfUiRenderSupplierList(model) {
    const root = cfUiGetListRoot();
    if (!root) return;

    const rows = Array.isArray(model?.suppliers) ? model.suppliers : [];

    if (!rows.length) {
      cfUiRenderEmpty();
      return;
    }

    root.innerHTML = `
      <div class="supplier-orders-list">
        ${rows.map(row => `
          <button
            type="button"
            class="supplier-order-row"
            data-supplier="${cfUiEsc(row.nom)}"
          >
            <span class="supplier-order-name">${cfUiEsc(row.nom)}</span>
            <span class="supplier-order-amount">${cfUiFmtPrice(row.montant)}</span>
          </button>
        `).join('')}
      </div>
    `;

    root.querySelectorAll('.supplier-order-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const supplierName = String(btn.dataset.supplier || '').trim();
        if (!supplierName) return;

        cfUiStore.selectedSupplierName = supplierName;
        cfOpenSupplierSmsView(supplierName);
      });
    });
  }

  // ----------------------------------------------------------
  //  Flux principal de l'écran
  // ----------------------------------------------------------

  /**
   * Point d'entrée principal appelé par ui_ecran.js.
   *
   * Étapes :
   * 1. Afficher "chargement"
   * 2. Lire le snapshot brut Supabase
   * 3. Construire le modèle métier fournisseur
   * 4. Afficher la liste
   */
  async function cfRenderSupplierOrdersHome() {
    cfUiMustHaveDependencies();

    const root = cfUiGetListRoot();
    if (!root) return;

    cfUiStore.loading = true;
    cfUiStore.lastError = null;

    cfUiRenderLoading();

    try {
      const snapshot = await global.sbSnapshotLoadNowStrict();
      const model = global.cfBuildSupplierDataModel(snapshot);

      cfUiStore.snapshot = snapshot;
      cfUiStore.model = model;
      cfUiStore.loading = false;

      cfUiRenderSupplierList(model);
    } catch (error) {
      cfUiStore.loading = false;
      cfUiStore.lastError = error || null;

      console.error('cfRenderSupplierOrdersHome', error);
      cfUiRenderError(error);
    }
  }

  /**
   * Ouvre la vue SMS pour un fournisseur donné.
   * Le module SMS reçoit :
   * - le nom fournisseur ;
   * - le snapshot brut ;
   * - le modèle métier déjà préparé ;
   * - la fonction de retour vers la liste.
   */
  function cfOpenSupplierSmsView(supplierName) {
    if (typeof global.cfRenderSupplierSmsView !== 'function') {
      throw new Error('cfRenderSupplierSmsView est introuvable');
    }

    if (!cfUiStore.snapshot || !cfUiStore.model) {
      throw new Error('Aucune donnée fournisseur disponible en mémoire');
    }

    global.cfRenderSupplierSmsView({
      supplierName,
      snapshot: cfUiStore.snapshot,
      model: cfUiStore.model,
      onBack: cfRenderSupplierOrdersHome
    });
  }

  // ----------------------------------------------------------
  //  Outils de debug / inspection
  // ----------------------------------------------------------

  /**
   * Renvoie l'état interne du module pour inspection console.
   */
  function cfGetSupplierUiStore() {
    return {
      loading: cfUiStore.loading,
      snapshot: cfUiStore.snapshot,
      model: cfUiStore.model,
      selectedSupplierName: cfUiStore.selectedSupplierName,
      lastError: cfUiStore.lastError
    };
  }

  /**
   * Recharge explicitement l'écran fournisseur.
   */
  function cfReloadSupplierOrdersHome() {
    return cfRenderSupplierOrdersHome();
  }

  /**
   * Vide le store local du module.
   * Utile si tu veux forcer un cycle propre de test.
   */
  function cfClearSupplierUiStore() {
    cfUiResetStore();
    cfUiShowToast('🧹 Cache Commandes fournisseurs vidé');
  }

  // ----------------------------------------------------------
  //  API globale du module
  // ----------------------------------------------------------
  global.cfRenderSupplierOrdersHome = cfRenderSupplierOrdersHome;
  global.cfReloadSupplierOrdersHome = cfReloadSupplierOrdersHome;
  global.cfGetSupplierUiStore = cfGetSupplierUiStore;
  global.cfClearSupplierUiStore = cfClearSupplierUiStore;

})(window);

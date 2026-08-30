// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_UI
//  ------------------------------------------------------------
//  Rôle de ce fichier :
//  - piloter l'écran "Commandes fournisseurs" ;
//  - demander un snapshot brut à l'instant T ;
//  - demander la construction du modèle métier ;
//  - afficher la liste des fournisseurs ayant une commande active ;
//  - transmettre le fournisseur cliqué au module SMS.
//
//  IMPORTANT
//  - Aucun accès direct à Supabase ici.
//  - Aucun calcul métier lourd ici.
//  - Aucun envoi SMS ici.
//  - Aucun couplage avec loadData() / loadDataCore() ici.
//
//  Dépendances attendues :
//  - window.sbSnapshotLoadNowStrict
//  - window.cfBuildSupplierDataModel
//  - window.cfBuildSupplierSmsPayload (plus tard, via le module SMS)
//  - helpers globaux UI : $, escHtml, fmtPrice, showToast
// ============================================================

(function attachCommandeFournisseurUiModule(global) {
  'use strict';

  // ------------------------------------------------------------
  //  Store local du module UI
  // ------------------------------------------------------------
  const cfUiStore = {
    loading: false,
    snapshot: null,
    model: null,
    selectedSupplierName: '',
    lastError: null
  };

  // ------------------------------------------------------------
  //  Helpers internes
  // ------------------------------------------------------------
  function cfUiGetListRoot() {
    return global.$ ? global.$('supplierOrdersList') : null;
  }

  function cfUiMustHaveDependencies() {
    if (typeof global.sbSnapshotLoadNowStrict !== 'function') {
      throw new Error('sbSnapshotLoadNowStrict est introuvable');
    }

    if (typeof global.cfBuildSupplierDataModel !== 'function') {
      throw new Error('cfBuildSupplierDataModel est introuvable');
    }

    if (typeof global.$ !== 'function') {
      throw new Error('Helper DOM $ introuvable');
    }
  }

  function cfUiEsc(value) {
    if (typeof global.escHtml === 'function') {
      return global.escHtml(value);
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cfUiFmtPrice(value) {
    if (typeof global.fmtPrice === 'function') {
      return global.fmtPrice(value);
    }

    return Number(value || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  function cfUiShowToast(message) {
    if (typeof global.showToast === 'function') {
      global.showToast(message);
    }
  }

  function cfUiResetStore() {
    cfUiStore.loading = false;
    cfUiStore.snapshot = null;
    cfUiStore.model = null;
    cfUiStore.selectedSupplierName = '';
    cfUiStore.lastError = null;
  }

  // ------------------------------------------------------------
  //  États visuels simples
  // ------------------------------------------------------------
  function cfUiRenderLoading() {
    const root = cfUiGetListRoot();
    if (!root) return;

    root.innerHTML = `
      <div class="supplier-orders-state supplier-orders-state--loading">
        <p class="etab-sub">Chargement des données Supabase...</p>
      </div>
    `;
  }

  function cfUiRenderEmpty() {
    const root = cfUiGetListRoot();
    if (!root) return;

    root.innerHTML = `
      <div class="supplier-orders-state supplier-orders-state--empty">
        <p class="etab-sub">Aucune commande fournisseur pour le moment.</p>
      </div>
    `;
  }

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

  // ------------------------------------------------------------
  //  Rendu liste fournisseurs
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  //  Chargement complet de l'écran fournisseur
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  //  Pont vers le module SMS
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  //  Outils publics de debug / accès
  // ------------------------------------------------------------
  function cfGetSupplierUiStore() {
    return {
      loading: cfUiStore.loading,
      snapshot: cfUiStore.snapshot,
      model: cfUiStore.model,
      selectedSupplierName: cfUiStore.selectedSupplierName,
      lastError: cfUiStore.lastError
    };
  }

  function cfReloadSupplierOrdersHome() {
    return cfRenderSupplierOrdersHome();
  }

  function cfClearSupplierUiStore() {
    cfUiResetStore();
    cfUiShowToast('🧹 Cache Commandes fournisseurs vidé');
  }

  // ------------------------------------------------------------
  //  Exposition globale
  // ------------------------------------------------------------
  global.cfRenderSupplierOrdersHome = cfRenderSupplierOrdersHome;
  global.cfReloadSupplierOrdersHome = cfReloadSupplierOrdersHome;
  global.cfGetSupplierUiStore = cfGetSupplierUiStore;
  global.cfClearSupplierUiStore = cfClearSupplierUiStore;

})(window);

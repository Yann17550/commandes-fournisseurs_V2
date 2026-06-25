// ---- Versioning & cache -----------------------------------
// Simplifié : on ne met plus en cache le catalogue produits/fournisseurs
// car la source de vérité est désormais Supabase.

async function loadData() {
  loadingState.style.display = 'flex';
  productList.style.display  = 'none';
  state.error = null;

  try {
    await loadDataCore();
  } catch (err) {
    console.error('[VERSIONING] Erreur loadData()', err);
    state.error = err.message || 'Erreur de chargement';
    loadingState.style.display = 'none';
    renderError();
  }
}

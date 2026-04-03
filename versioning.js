// ---- Versioning & cache -----------------------------------

const LS_VERSION_META = 'cf_v3_version_meta';
const LS_CACHE_DATA   = 'cf_v3_cache_data';

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_DATA);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache() {
  try {
    const payload = {
      produits:     state.produits,
      fournisseurs: state.fournisseurs,
      overrides:    state.overrides,
      lastOrder:    state.lastOrder,
      lastSemaine:  state.lastSemaine,
      // si tu veux ajouter d’autres choses plus tard, c’est ici
    };
    localStorage.setItem(LS_CACHE_DATA, JSON.stringify(payload));
  } catch (e) {
    console.warn('[CACHE] Impossible de sauvegarder le cache', e);
  }
}

function loadVersionMeta() {
  try {
    const raw = localStorage.getItem(LS_VERSION_META);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveVersionMeta(version) {
  try {
    localStorage.setItem(LS_VERSION_META, JSON.stringify({
      version,
      ts: Date.now(),
    }));
  } catch {}
}

async function fetchRemoteVersion() {
  if (!CONFIG.APPS_SCRIPT_URL) return null;
  try {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=version', { cache: 'no-store' });
    if (!r.ok) return null;
    const txt = await r.text();
    return (txt || '').trim();
  } catch {
    return null;
  }
}

// Cette fonction remplace le loadData() global
async function loadData() {
  loadingState.style.display = 'flex';
  productList.style.display  = 'none';
  state.error = null;

  try {
    const remoteVersion = await fetchRemoteVersion();
    const meta          = loadVersionMeta();
    const cache         = loadCache();

    const canUseCache =
      remoteVersion &&
      meta &&
      meta.version === remoteVersion &&
      cache &&
      Array.isArray(cache.produits) &&
      cache.produits.length > 0;

    if (canUseCache) {
      console.log('[VERSIONING] Cache valide, chargement localStorage');

      state.produits     = cache.produits     || [];
      state.fournisseurs = cache.fournisseurs || {};
      state.overrides    = cache.overrides    || {};
      state.lastOrder    = cache.lastOrder    || {};
      state.lastSemaine  = cache.lastSemaine  || '';
      state.loaded       = true;

      // Gestion des commandes distantes comme avant
      if (state.etab && state.etab.id === 'gerant') {
        const savedA = await loadCommandeRemoteById('a');
        const savedB = await loadCommandeRemoteById('b');
        state.quantities_a = savedA || {};
        state.quantities_b = savedB || {};
      } else {
        const saved = await loadCommandeRemote();
        const histo = await loadHistoRemote();
        if (saved && Object.keys(saved).length > 0) {
          state.quantities = saved;
        }
        if (histo && histo.quantities) {
          state.lastOrder   = histo.quantities;
          state.lastSemaine = histo.semaine || state.lastSemaine;
        }
      }

      render();
      return;
    }

    console.log('[VERSIONING] Pas de cache valide → chargement complet distant');
    // On appelle ton ancienne logique
    await loadDataCore();

    // Si on a une version distante, on met à jour le cache
    if (remoteVersion) {
      saveCache();
      saveVersionMeta(remoteVersion);
    }

  } catch (err) {
    console.error('[VERSIONING] Erreur loadData()', err);
    // Fallback : on tente au moins ton ancien comportement
    try {
      await loadDataCore();
    } catch (e2) {
      state.error = err.message || 'Erreur de chargement';
      loadingState.style.display = 'none';
      renderError();
    }
  }
}

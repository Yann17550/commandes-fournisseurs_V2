// ============================================================
//  DATA MODULE — Chargement / Sauvegarde / Historique
// ============================================================

// ---- Sauvegarde distante ----------------------------------
let saveTimer = null;

function scheduleSave() {
  if (!state.etab) return;
  clearTimeout(saveTimer);
  showSaveStatus('...');
  saveTimer = setTimeout(doSaveDataModule, 4000);
}

async function doSaveDataModule() {
  if (!state.etab) return;

  try {
    if (state.etab.id === 'gerant') {
      await Promise.all([
        fetchSaveDataModule('A', state.quantities_a),
        fetchSaveDataModule('B', state.quantities_b),
      ]);
    } else {
      const etabId = state.etab.id === 'a' ? 'A' : 'B';
      await fetchSaveDataModule(etabId, state.quantities);
    }

    showSaveStatus('💾 OK');
  } catch (e) {
    console.error('[TRACE] ERREUR doSaveDataModule()', e);
    showSaveStatus('⚠️ Erreur');
  }
}

async function fetchSaveDataModule(etabId, quantities) {
  const etab = String(etabId || '').trim().toUpperCase();
  const source = quantities || {};

  const positiveEntries = Object.entries(source).filter(([, v]) => Number(v) > 0);
  const zeroEntries = Object.entries(source).filter(([, v]) => !Number(v));

  for (const [key, qty] of positiveEntries) {
    const produit = state.produits.find(p => productKey(p) === key);
    if (!produit) {
      console.warn('[TRACE] Produit introuvable pour sauvegarde :', key);
      continue;
    }

    const ok = await saveCommandeRemote(produit, Number(qty) || 0, etab);
    if (!ok) {
      throw new Error('Erreur saveCommandeRemote sur ' + key);
    }
  }

  for (const [key] of zeroEntries) {
    const produit = state.produits.find(p => productKey(p) === key);
    if (!produit) continue;

    const ok = await saveCommandeRemote(produit, 0, etab);
    if (!ok) {
      throw new Error('Erreur saveCommandeRemote(0) sur ' + key);
    }
  }
}

// ---- Chargement distant -----------------------------------
async function loadCommandeRemote() {
  if (!state.etab || state.etab.id === 'gerant') return {};

  const etabId = state.etab.id === 'a' ? 'A' : 'B';
  console.log('[TRACE] loadCommandeRemote() via Supabase avec', etabId);

  try {
    return await loadCommandeRemoteByIdSupabaseProxy(etabId);
  } catch (e) {
    console.error('[TRACE] ERREUR loadCommandeRemote()', e);
    return {};
  }
}

async function loadCommandeRemoteById(etabId) {
  console.log('[TRACE] loadCommandeRemoteById() appelé avec etabId =', etabId);

  try {
    return await loadCommandeRemoteByIdSupabaseProxy(etabId);
  } catch (e) {
    console.error('[TRACE] ERREUR loadCommandeRemoteById', e);
    return {};
  }
}

async function loadCommandeRemoteByIdSupabaseProxy(etabId) {
  if (typeof window.loadCommandeRemoteById !== 'function') {
    console.error('[TRACE] Fonction Supabase loadCommandeRemoteById introuvable');
    return {};
  }

  return await window.loadCommandeRemoteById(etabId);
}

async function loadHistoRemote() {
  console.log('[TRACE] loadHistoRemote() appelé');

  if (!state.etab) return {};
  if (state.etab.id === 'gerant') return {};

  try {
    if (typeof window.loadHistoRemote !== 'function') {
      console.error('[TRACE] Fonction Supabase loadHistoRemote introuvable');
      return {};
    }

    const json = await window.loadHistoRemote();
    console.log('[TRACE] JSON reçu loadHistoRemote :', json);
    return json || {};
  } catch (e) {
    console.error('[TRACE] ERREUR loadHistoRemote', e);
    return {};
  }
}

// ---- Archive ----------------------------------------------
async function archiveCommandeDataModule() {
  console.log('[TRACE] archiveCommande() appelé');

  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    if (typeof window.archiveCommande !== 'function') {
      console.error('[TRACE] Fonction Supabase archiveCommande introuvable');
      return;
    }

    return await window.archiveCommande();
  } catch (e) {
    console.error('[TRACE] ERREUR archiveCommande()', e);
  }
}

// ---- Nettoyage distant -------------------------------------
async function clearCommandeRemoteDataModule() {
  console.log('[TRACE] clearCommandeRemote() appelé');

  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    if (typeof window.clearCommandeRemote !== 'function') {
      console.error('[TRACE] Fonction Supabase clearCommandeRemote introuvable');
      return;
    }

    return await window.clearCommandeRemote();
  } catch (e) {
    console.error('[TRACE] ERREUR clearCommandeRemote()', e);
  }
}

// ---- Compatibilité avec le reste de l'app ------------------
async function doSave() {
  return doSaveDataModule();
}

async function fetchSave(etabId, quantities) {
  return fetchSaveDataModule(etabId, quantities);
}

async function archiveCommande() {
  return archiveCommandeDataModule();
}

async function clearCommandeRemote() {
  return clearCommandeRemoteDataModule();
}

// ---- Statut de sauvegarde ---------------------------------
function showSaveStatus(msg) {
  if (!saveStatusEl) return;

  saveStatusEl.textContent = msg;
  saveStatusEl.style.opacity = '1';

  const body = document.body;

  if (body) {
    if (msg === '...') {
      body.classList.add('save-pending');
      body.classList.remove('save-error');
    } else if (msg.includes('OK')) {
      body.classList.remove('save-pending', 'save-error');
    } else if (msg.includes('Erreur')) {
      body.classList.remove('save-pending');
      body.classList.add('save-error');
    }
  }

  clearTimeout(saveStatusEl._t);
  if (msg.includes('OK')) {
    saveStatusEl._t = setTimeout(() => {
      saveStatusEl.style.opacity = '0';
    }, 2500);
  }
}

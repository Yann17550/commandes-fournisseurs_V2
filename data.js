// ============================================================
//  DATA MODULE — Chargement / Sauvegarde / Historique
// ============================================================

// ---- Sauvegarde distante ----------------------------------
let saveTimer = null;

function scheduleSave() {
  if (!state.etab) return;
  clearTimeout(saveTimer);
  showSaveStatus('...');
  saveTimer = setTimeout(doSave, 4000);
}

async function doSave() {
  if (!state.etab) return;

  try {
    if (state.etab.id === 'gerant') {
      await Promise.all([
        fetchSave('A', state.quantities_a),
        fetchSave('B', state.quantities_b),
      ]);
    } else {
      const etabId = state.etab.id === 'a' ? 'A' : 'B';
      await fetchSave(etabId, state.quantities);
    }

    showSaveStatus('💾 OK');
  } catch (e) {
    console.error('[TRACE] ERREUR doSave()', e);
    showSaveStatus('⚠️ Erreur');
  }
}

async function fetchSave(etabId, quantities) {
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

    const ok = await sbSaveCommandeRemote(produit, Number(qty) || 0, etab);
    if (!ok) {
      throw new Error('Erreur sbSaveCommandeRemote sur ' + key);
    }
  }

  for (const [key] of zeroEntries) {
    const produit = state.produits.find(p => productKey(p) === key);
    if (!produit) continue;

    const ok = await sbSaveCommandeRemote(produit, 0, etab);
    if (!ok) {
      throw new Error('Erreur sbSaveCommandeRemote(0) sur ' + key);
    }
  }
}

// ---- Chargement distant -----------------------------------
async function loadCommandeRemote() {
  if (!state.etab || state.etab.id === 'gerant') return {};

  const etabId = state.etab.id === 'a' ? 'A' : 'B';
  console.log('[TRACE] loadCommandeRemote() via Supabase avec', etabId);

  try {
    return await sbLoadCommandeRemoteById(etabId);
  } catch (e) {
    console.error('[TRACE] ERREUR loadCommandeRemote()', e);
    return {};
  }
}

async function loadCommandeRemoteById(etabId) {
  console.log('[TRACE] loadCommandeRemoteById() appelé avec etabId =', etabId);

  try {
    return await sbLoadCommandeRemoteById(etabId);
  } catch (e) {
    console.error('[TRACE] ERREUR loadCommandeRemoteById', e);
    return {};
  }
}

async function loadHistoRemote() {
  console.log('[TRACE] loadHistoRemote() appelé');

  if (!state.etab) return {};
  if (state.etab.id === 'gerant') return {};

  try {
    const json = await sbLoadHistoRemote();
    console.log('[TRACE] JSON reçu loadHistoRemote :', json);
    return json || {};
  } catch (e) {
    console.error('[TRACE] ERREUR loadHistoRemote', e);
    return {};
  }
}

// ---- Archive ----------------------------------------------
async function archiveCommande() {
  console.log('[TRACE] archiveCommande() appelé');

  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    return await sbArchiveCommande();
  } catch (e) {
    console.error('[TRACE] ERREUR archiveCommande()', e);
  }
}

// ---- Nettoyage distant -------------------------------------
async function clearCommandeRemote() {
  console.log('[TRACE] clearCommandeRemote() appelé');

  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    return await sbClearCommandeRemote();
  } catch (e) {
    console.error('[TRACE] ERREUR clearCommandeRemote()', e);
  }
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

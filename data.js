// ============================================================
//  DATA MODULE — Chargement / Sauvegarde / Historique
// ============================================================

// ---- Sauvegarde distante ----------------------------------
let saveTimer = null;

/**
 * Programme une sauvegarde différée pour éviter
 * trop d'écritures rapprochées.
 */
function scheduleSave() {
  if (!state.etab) return;

  clearTimeout(saveTimer);
  showSaveStatus('...');
  saveTimer = setTimeout(doSave, 4000);
}

/**
 * Sauvegarde la commande de l'établissement courant.
 * En mode gérant, sauvegarde A et B.
 */
async function doSave() {
  if (!state.etab) return;

  try {
    if (state.etab.id === 'gerant') {
      await Promise.all([
        fetchSave('A', state.quantities_a),
        fetchSave('B', state.quantities_b)
      ]);
    } else {
      const etabId = state.etab.id === 'a' ? 'A' : 'B';
      await fetchSave(etabId, state.quantities);
    }

    showSaveStatus('💾 OK');
  } catch (error) {
    console.error('Erreur sauvegarde commande', error);
    showSaveStatus('⚠️ Erreur');
  }
}

/**
 * Sauvegarde toutes les quantités d'un établissement :
 * - quantités > 0 : insertion / mise à jour
 * - quantités = 0 : remise à zéro côté base
 */
async function fetchSave(etabId, quantities) {
  const etab = String(etabId || '').trim().toUpperCase();
  const source = quantities || {};

  const positiveEntries = Object.entries(source).filter(([, value]) => Number(value) > 0);
  const zeroEntries = Object.entries(source).filter(([, value]) => !Number(value));

  for (const [key, qty] of positiveEntries) {
    const produit = state.produits.find(p => productKey(p) === key);
    if (!produit) continue;

    const ok = await sbSaveCommandeRemote(produit, Number(qty) || 0, etab);
    if (!ok) {
      throw new Error('Erreur de sauvegarde sur ' + key);
    }
  }

  for (const [key] of zeroEntries) {
    const produit = state.produits.find(p => productKey(p) === key);
    if (!produit) continue;

    const ok = await sbSaveCommandeRemote(produit, 0, etab);
    if (!ok) {
      throw new Error('Erreur de remise à zéro sur ' + key);
    }
  }
}

// ---- Chargement distant -----------------------------------

/**
 * Charge la commande de l'établissement courant.
 */
async function loadCommandeRemote() {
  if (!state.etab || state.etab.id === 'gerant') return {};

  const etabId = state.etab.id === 'a' ? 'A' : 'B';

  try {
    return await sbLoadCommandeRemoteById(etabId);
  } catch (error) {
    console.error('Erreur chargement commande', error);
    return {};
  }
}

/**
 * Charge la commande d'un établissement donné.
 */
async function loadCommandeRemoteById(etabId) {
  try {
    return await sbLoadCommandeRemoteById(etabId);
  } catch (error) {
    console.error('Erreur chargement commande établissement', error);
    return {};
  }
}

/**
 * Charge le dernier historique utile pour l'établissement courant.
 */
async function loadHistoRemote() {
  if (!state.etab) return {};
  if (state.etab.id === 'gerant') return {};

  try {
    return await sbLoadHistoRemote() || {};
  } catch (error) {
    console.error('Erreur chargement historique', error);
    return {};
  }
}

// ---- Archive ----------------------------------------------

/**
 * Archive la commande courante.
 */
async function archiveCommande() {
  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    return await sbArchiveCommande();
  } catch (error) {
    console.error('Erreur archivage commande', error);
  }
}

// ---- Nettoyage distant ------------------------------------

/**
 * Supprime la commande courante en base.
 */
async function clearCommandeRemote() {
  if (!state.etab || state.etab.id === 'gerant') return;

  try {
    return await sbClearCommandeRemote();
  } catch (error) {
    console.error('Erreur suppression commande', error);
  }
}

// ---- Statut de sauvegarde ---------------------------------

/**
 * Affiche l'état visuel de la sauvegarde.
 */
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

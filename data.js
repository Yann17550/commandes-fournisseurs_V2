// ============================================================
//  DATA MODULE — Chargement / Sauvegarde / Historique
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["data.js"] = "2026-04-06T18:31:00";

// ---- Sauvegarde distante ----------------------------------
let saveTimer = null;

function scheduleSave() {
  if (!CONFIG.APPS_SCRIPT_URL) return;
  clearTimeout(saveTimer);
  showSaveStatus('...');
  saveTimer = setTimeout(doSave, 1500);
}

async function doSave() {
  if (!CONFIG.APPS_SCRIPT_URL || !state.etab) return;

  try {
    if (state.etab.id === 'gerant') {
      await Promise.all([
        fetchSave('a', state.quantities_a),
        fetchSave('b', state.quantities_b),
      ]);
    } else {
      await fetchSave(state.etab.id, state.quantities);
    }
    showSaveStatus('💾 OK');
  } catch {
    showSaveStatus('⚠️ Erreur');
  }
}

function fetchSave(etabId, quantities) {
  const body = JSON.stringify(
    Object.fromEntries(
      Object.entries(quantities).filter(([, v]) => v > 0)
    )
  );

  return fetch(CONFIG.APPS_SCRIPT_URL + '?action=write&etab=' + etabId, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
}

// ---- Chargement distant -----------------------------------
async function loadCommandeRemote() {
  if (!CONFIG.APPS_SCRIPT_URL || !state.etab || state.etab.id === 'gerant') return {};
  return loadCommandeRemoteById(state.etab.id);
}

async function loadCommandeRemoteById(etabId) {
  console.log("[TRACE] loadCommandeRemoteById() appelé avec etabId =", etabId);

  if (!CONFIG.APPS_SCRIPT_URL) {
    console.warn("[TRACE] PAS D’URL APPS SCRIPT dans CONFIG");
    return {};
  }

  const url = CONFIG.APPS_SCRIPT_URL + '?action=read&etab=' + etabId;
  console.log("[TRACE] FETCH →", url);

  try {
    const r = await fetch(url);
    console.log("[TRACE] Réponse brute loadCommandeRemoteById :", r);

    const json = await r.json().catch(e => {
      console.error("[TRACE] JSON ERROR loadCommandeRemoteById", e);
      return null;
    });

    console.log("[TRACE] JSON reçu loadCommandeRemoteById :", json);
    return json || {};

  } catch (e) {
    console.error("[TRACE] ERREUR loadCommandeRemoteById", e);
    return {};
  }
}

async function loadHistoRemote() {
  console.log("[TRACE] loadHistoRemote() appelé");

  if (!CONFIG.APPS_SCRIPT_URL) return {};
  if (!state.etab) return {};
  if (state.etab.id === 'gerant') return {};

  const url = CONFIG.APPS_SCRIPT_URL + '?action=histo&etab=' + state.etab.id;
  console.log("[TRACE] FETCH →", url);

  try {
    const r = await fetch(url);
    console.log("[TRACE] Réponse brute loadHistoRemote :", r);

    const json = await r.json().catch(e => {
      console.error("[TRACE] JSON ERROR loadHistoRemote", e);
      return null;
    });

    console.log("[TRACE] JSON reçu loadHistoRemote :", json);
    return json || {};

  } catch (e) {
    console.error("[TRACE] ERREUR loadHistoRemote", e);
    return {};
  }
}

// ---- Archive ----------------------------------------------
async function archiveCommande() {
  console.log("[TRACE] archiveCommande() appelé");

  if (!CONFIG.APPS_SCRIPT_URL || !state.etab || state.etab.id === 'gerant') return;

  const items = [];
  state.produits.forEach(p => {
    const qty = state.quantities[productKey(p)] || 0;
    if (!qty) return;

    const d = getProductData(p);
    items.push({
      key: productKey(p),
      nomCourt: p.nom_court,
      ref: d.reference,
      qty,
      prixHt: d.prix_ht,
      total: qty * getPrixColis(p)
    });
  });

  if (!items.length) return;

  const url = CONFIG.APPS_SCRIPT_URL + '?action=archive&etab=' + state.etab.id;
  console.log("[TRACE] FETCH POST →", url);

  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      semaine: getWeekId(),
      etabLabel: state.etab.label,
      items
    }),
  }).catch(e => console.error("[TRACE] ERREUR archiveCommande()", e));
}

// ---- Nettoyage distant -------------------------------------
async function clearCommandeRemote() {
  console.log("[TRACE] clearCommandeRemote() appelé");

  if (!CONFIG.APPS_SCRIPT_URL || !state.etab || state.etab.id === 'gerant') return;

  const url = CONFIG.APPS_SCRIPT_URL + '?action=clear&etab=' + state.etab.id;
  console.log("[TRACE] FETCH POST →", url);

  fetch(url, { method: 'POST', mode: 'no-cors' })
    .catch(e => console.error("[TRACE] ERREUR clearCommandeRemote()", e));
}

// ---- Statut de sauvegarde ---------------------------------
function showSaveStatus(msg) {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = msg;
  saveStatusEl.style.opacity = '1';

  clearTimeout(saveStatusEl._t);
  if (msg.includes('OK')) {
    saveStatusEl._t = setTimeout(() => {
      saveStatusEl.style.opacity = '0';
    }, 2500);
  }
}

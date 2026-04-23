// ============================================================
//  COPIE / ARCHIVAGE / RESET
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["copy.js"] = "2026-04-06T18:31:00";

async function copySummary(mode) {
  let text = '';
  const isGerant = state.etab && state.etab.id === 'gerant';

  if (isGerant) {
    if (mode === 'a' || mode === 'b') {
      text = buildCopyTextGerant(mode);
    } else {
      text = buildCopyTextGerant('all');
    }
  } else {
    text = buildCopyTextNormal();
  }

  await navigator.clipboard.writeText(text);
  showToast('📋 Copié');

  if (!isGerant) archiveCommande();
}

function buildCopyTextNormal() {
  let out = `Commande ${state.etab.label} — ${getWeekLabel()}\n\n`;
  const suppliers = getSuppliers();

  suppliers.forEach(sup => {
    const items = state.produits.filter(p => p.fournisseur === sup);
    let block = '';
    items.forEach(p => {
      const key = productKey(p);
      const qty = state.quantities[key] || 0;
      if (!qty) return;
      block += `${qty} × ${p.nom_court} (${p.reference})\n`;
    });
    if (block) out += `--- ${sup} ---\n${block}\n`;
  });

  return out.trim();
}

function buildCopyTextGerant(mode) {
  let out = `Commandes Gérant — ${getWeekLabel()}\n\n`;

  state.produits.forEach(p => {
    const key = productKey(p);
    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    if (mode === 'a' && !qa) return;
    if (mode === 'b' && !qb) return;
    if (mode === 'all' && !qa && !qb) return;

    out += `${p.nom_court} (${p.reference}) — A:${qa}  B:${qb}\n`;
  });

  return out.trim();
}

function resetCommande() {
  if (!confirm("Vider la commande ?")) return;

  if (state.etab.id === 'gerant') {
    state.quantities_a = {};
    state.quantities_b = {};
  } else {
    state.quantities = {};
  }

  clearCommandeRemote();
  closeSummary();
  render();
  showToast('🗑 Commande vidée');
}

// ============================================================
// VALIDATION FOURNISSEUR — APPS SCRIPT
// ============================================================
async function validateSupplier(sup) {
  if (!CONFIG.APPS_SCRIPT_URL) {
    showToast("⚠️ URL Apps Script absente");
    return;
  }

  if (!sup) {
    showToast("⚠️ Fournisseur manquant");
    return;
  }

  const isGerant = state.etab && state.etab.id === 'gerant';

  // En mode gérant, on peut valider le fournisseur pour A, pour B, ou les deux.
  // Ici on propose une confirmation simple, puis on traite séparément A et B
  // s'il existe des quantités pour ce fournisseur.
  if (isGerant) {
    const hasA = state.produits.some(p =>
      p.fournisseur === sup && (state.quantities_a[productKey(p)] || 0) > 0
    );
    const hasB = state.produits.some(p =>
      p.fournisseur === sup && (state.quantities_b[productKey(p)] || 0) > 0
    );

    if (!hasA && !hasB) {
      showToast("ℹ️ Aucune quantité à valider pour " + sup);
      return;
    }

    const ok = confirm(
      "Valider la commande du fournisseur " + sup + " ?\n\n" +
      (hasA ? "• Établissement A concerné\n" : "") +
      (hasB ? "• Établissement B concerné\n" : "") +
      "\nLes lignes validées seront archivées puis retirées de la commande en cours."
    );
    if (!ok) return;

    try {
      if (hasA) {
        const resA = await fetch(
          CONFIG.APPS_SCRIPT_URL +
          '?action=validateSupplier&etab=a&fournisseur=' + encodeURIComponent(sup),
          { method: 'POST' }
        );
        const jsonA = await resA.json();
        if (!jsonA.ok) throw new Error(jsonA.error || jsonA.message || "Erreur validation A");
      }

      if (hasB) {
        const resB = await fetch(
          CONFIG.APPS_SCRIPT_URL +
          '?action=validateSupplier&etab=b&fournisseur=' + encodeURIComponent(sup),
          { method: 'POST' }
        );
        const jsonB = await resB.json();
        if (!jsonB.ok) throw new Error(jsonB.error || jsonB.message || "Erreur validation B");
      }

      await loadData();
      render();
      showToast("✅ Fournisseur validé : " + sup);

    } catch (err) {
      console.error(err);
      showToast("⚠️ " + err.message);
    }

    return;
  }

  // Mode établissement simple : validation uniquement sur l'établissement courant
  const etabId = state.etab && state.etab.id;
  if (!etabId || !['a', 'b'].includes(etabId)) {
    showToast("⚠️ Établissement invalide");
    return;
  }

  const hasQty = state.produits.some(p =>
    p.fournisseur === sup && (state.quantities[productKey(p)] || 0) > 0
  );

  if (!hasQty) {
    showToast("ℹ️ Aucune quantité à valider pour " + sup);
    return;
  }

  const ok = confirm(
    "Valider la commande du fournisseur " + sup + " ?\n\n" +
    "Les lignes validées seront archivées puis retirées de la commande en cours."
  );
  if (!ok) return;

  try {
    const res = await fetch(
      CONFIG.APPS_SCRIPT_URL +
      '?action=validateSupplier&etab=' + etabId + '&fournisseur=' + encodeURIComponent(sup),
      { method: 'POST' }
    );

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || json.message || "Erreur de validation");
    }

    await loadData();
    render();
    closeSummary();
    showToast("✅ Fournisseur validé : " + sup);

  } catch (err) {
    console.error(err);
    showToast("⚠️ " + err.message);
  }
}

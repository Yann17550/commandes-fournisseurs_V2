// ============================================================
//  VALIDATION FOURNISSEUR
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["validation.js"] = "2026-04-23T11:15:00";

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

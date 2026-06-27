// ============================================================
// validation.js
// Validation fournisseur et archivage partiel par établissement
// ============================================================

/**
 * Lance la validation d'un fournisseur.
 * En mode gérant, la validation peut concerner A, B ou les deux.
 * En mode établissement, elle ne concerne que l'établissement courant.
 */
async function validateSupplier(sup) {
  if (!sup) {
    showToast("⚠️ Fournisseur manquant");
    return;
  }

  const isGerant = state.etab && state.etab.id === 'gerant';

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
      if (hasA) await validateSupplierForEtab('A', sup, state.quantities_a);
      if (hasB) await validateSupplierForEtab('B', sup, state.quantities_b);

      await loadData();
      render();
      showToast("✅ Fournisseur validé : " + sup);
    } catch (err) {
      console.error(err);
      showToast("⚠️ " + (err.message || err));
    }

    return;
  }

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
    await validateSupplierForEtab(etabId.toUpperCase(), sup, state.quantities);

    await loadData();
    render();
    closeSummary();
    showToast("✅ Fournisseur validé : " + sup);
  } catch (err) {
    console.error(err);
    showToast("⚠️ " + (err.message || err));
  }
}

/**
 * Valide un fournisseur pour un établissement donné.
 * On archive puis on supprime uniquement les lignes du fournisseur concerné.
 */
async function validateSupplierForEtab(etabId, sup, quantitiesMap) {
  const E = String(etabId || '').trim().toUpperCase();

  const supplierProducts = state.produits.filter(p =>
    p.fournisseur === sup && (quantitiesMap[productKey(p)] || 0) > 0
  );

  if (!supplierProducts.length) {
    return true;
  }

  const references = supplierProducts
    .map(p => (p.reference || '').trim())
    .filter(Boolean);

  const fournisseurId = supplierProducts[0]?.fournisseur_id || null;

  await sbArchiveCommandeRows(
    E,
    {
      fournisseur_id: fournisseurId,
      references
    },
    {
      note: '',
      deleteSource: true
    }
  );

  return true;
}

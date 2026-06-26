// ============================================================
//  VALIDATION FOURNISSEUR
// ============================================================


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
      if (hasA) {
        await validateSupplierForEtab('A', sup, state.quantities_a);
      }

      if (hasB) {
        await validateSupplierForEtab('B', sup, state.quantities_b);
      }

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

async function validateSupplierForEtab(etabId, sup, quantitiesMap) {
  const E = String(etabId || '').trim().toUpperCase();

  const supplierProducts = state.produits.filter(p =>
    p.fournisseur === sup && (quantitiesMap[productKey(p)] || 0) > 0
  );

  if (!supplierProducts.length) {
    return true;
  }

  const snapshot = lignes.map(l => ({
    etablissement: E,
    produit_id: l.produit_id || null,
    fournisseur_id: l.fournisseur_id || null,
    fournisseur_nom: l.fournisseur_nom || null,
    reference: (l.reference || '').trim(),
    quantite: Number(l.quantite) || 0,
    semaine,
    note,
    archive_at
  }));

  const { data: lignes, error: errLecture } = await supabaseClient
    .from('commandes')
    .select(`
      etablissement,
      produit_id,
      fournisseur_id,
      fournisseur_nom,
      reference,
      quantite
    `)

  const references = supplierProducts.map(p => (p.reference || '').trim()).filter(Boolean);
  const fournisseurId = supplierProducts[0]?.fournisseur_id || null;

  let deleteQuery = supabaseClient
    .from('commandes')
    .delete()
    .eq('etablissement', E)
    .eq('fournisseur_id', fournisseurId)
    .in('reference', references);

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw new Error(deleteError.message || "Erreur suppression Supabase");
  }

  return true;
}

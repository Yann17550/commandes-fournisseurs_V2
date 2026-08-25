// ============================================================
//  TRI PIPELINE — Unification des tris A/B, Gérant, Résumé
// ============================================================

// 1) Tri fournisseurs (ordre_fournisseur)
function triFournisseurs(prods) {
  return [...prods].sort((a, b) =>
    (a.ordre_fournisseur || 999) - (b.ordre_fournisseur || 999)
  );
}

// 2) Tri catégories (ordre_categorie)
function triCategories(prods) {
  return [...prods].sort((a, b) =>
    (a.ordre_categorie || 999) - (b.ordre_categorie || 999)
  );
}

// 3) Tri historique (scores)
function triHistorique(prods) {
  const scores = getScores();

  return [...prods].sort((a, b) =>
    (scores[productKey(b)] || 0) - (scores[productKey(a)] || 0)
  );
}

// 4) Tri dynamique (commandés en haut + regroupement nom court)
function triDynamique(prods, state) {
  return sortForDisplay(prods, state);
}

// ============================================================
//  TRI STABLE ACCORDÉON
//  Utilisé pour afficher l'ordre de base sans remontée immédiate
// ============================================================
function triStableAccordion(prods, mode, state) {
  let out = [...prods];

  out = triFournisseurs(out);
  out = triCategories(out);
  out = triHistorique(out);

  return out;
}

// ============================================================
//  PIPELINE FINAL
//  Garde le comportement complet pour les autres usages
// ============================================================
function triPipeline(prods, mode, state) {
  let out = triStableAccordion(prods, mode, state);
  out = triDynamique(out, state);
  return out;
}

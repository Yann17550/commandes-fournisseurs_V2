// ============================================================
//  tri.js
//  Module centralisé pour les tris de l'application
// ============================================================

// ------------------------------------------------------------
// 1) Tri fournisseurs (ordre_fournisseur)
// ------------------------------------------------------------
function triFournisseurs(prods) {
  return [...prods].sort((a, b) =>
    (a.ordre_fournisseur || 999) - (b.ordre_fournisseur || 999)
  );
}

// ------------------------------------------------------------
// 2) Tri catégories (ordre_categorie)
// ------------------------------------------------------------
function triCategories(prods) {
  return [...prods].sort((a, b) =>
    (a.ordre_categorie || 999) - (b.ordre_categorie || 999)
  );
}

// ------------------------------------------------------------
// 3) Tri historique (scores)
// ------------------------------------------------------------
function triHistorique(prods) {
  const scores = getScores();

  return [...prods].sort((a, b) =>
    (scores[productKey(b)] || 0) - (scores[productKey(a)] || 0)
  );
}

// ------------------------------------------------------------
// 4) Tri dynamique (commandés en haut / non commandés regroupés)
// ------------------------------------------------------------
function triDynamique(prods, state) {
  return sortForDisplay(prods, state);
}

// ------------------------------------------------------------
// 5) Tri stable de base pour l'accordéon
//    = fournisseur → catégorie → historique
// ------------------------------------------------------------
function triStableAccordion(prods, mode, state) {
  let out = [...prods];

  out = triFournisseurs(out);
  out = triCategories(out);
  out = triHistorique(out);

  return out;
}

// ------------------------------------------------------------
// 6) Pipeline complet
//    Utilisé quand on veut encore le tri dynamique immédiatement
// ------------------------------------------------------------
function triPipeline(prods, mode, state) {
  let out = triStableAccordion(prods, mode, state);
  out = triDynamique(out, state);
  return out;
}

// ------------------------------------------------------------
// 7) Tri global : fournisseur → catégorie → nom court → article
//    Utilitaire générique conservé
// ------------------------------------------------------------
function sortProducts(prods) {
  return [...prods].sort((a, b) => {
    if ((a.ordre_fournisseur || 999) !== (b.ordre_fournisseur || 999)) {
      return (a.ordre_fournisseur || 999) - (b.ordre_fournisseur || 999);
    }

    if ((a.ordre_categorie || 999) !== (b.ordre_categorie || 999)) {
      return (a.ordre_categorie || 999) - (b.ordre_categorie || 999);
    }

    const nc = (a.nom_court || '').localeCompare(b.nom_court || '', 'fr');
    if (nc !== 0) return nc;

    return (a.designation || '').localeCompare(b.designation || '', 'fr');
  });
}

// ------------------------------------------------------------
// 8) Tri dynamique d'affichage
//    = commandés en haut, autres regroupés par nom court
// ------------------------------------------------------------
function sortForDisplay(prods, state) {
  const ordered = [];
  const notOrdered = [];

  const isGerant = state.etab && state.etab.id === 'gerant';

  prods.forEach(p => {
    const key = productKey(p);
    let qty = 0;

    if (isGerant) {
      const qa = (state.quantities_a && state.quantities_a[key]) || 0;
      const qb = (state.quantities_b && state.quantities_b[key]) || 0;
      qty = qa + qb;
    } else {
      qty = (state.quantities && state.quantities[key]) || 0;
    }

    if (qty > 0) {
      ordered.push(p);
    } else {
      notOrdered.push(p);
    }
  });

  const groups = {};
  notOrdered.forEach(p => {
    const g = (p.nom_court || '').toLowerCase().trim();
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  const notOrderedFinal = [];
  notOrdered.forEach(p => {
    const g = (p.nom_court || '').toLowerCase().trim();
    if (groups[g]) {
      notOrderedFinal.push(...groups[g]);
      delete groups[g];
    }
  });

  return [...ordered, ...notOrderedFinal];
}

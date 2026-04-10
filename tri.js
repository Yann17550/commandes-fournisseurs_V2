// tri.js
// Module centralisé pour tous les tris de l'application

// ------------------------------------------------------------
// 1) Tri global : fournisseur → catégorie → nom court → article
// ------------------------------------------------------------
function sortProducts(prods) {
  return prods.sort((a, b) => {
    // 1) Fournisseur (ordre_fournisseur)
    if (a.ordre_fournisseur !== b.ordre_fournisseur) {
      return a.ordre_fournisseur - b.ordre_fournisseur;
    }

    // 2) Catégorie (ordre_categorie)
    if (a.ordre_categorie !== b.ordre_categorie) {
      return a.ordre_categorie - b.ordre_categorie;
    }

    // 3) Nom court (alpha)
    const nc = a.nom_court.localeCompare(b.nom_court, 'fr');
    if (nc !== 0) return nc;

    // 4) Désignation (alpha)
    return a.designation.localeCompare(b.designation, 'fr');
  });
}


// ------------------------------------------------------------
// 2) Tri dynamique : commandés en haut / non commandés regroupés
// ------------------------------------------------------------
function sortForDisplay(prods, state) {
  const ordered = [];
  const notOrdered = [];

  // Séparation commandés / non commandés
  prods.forEach(p => {
    const key = productKey(p);
    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    if (qa > 0 || qb > 0) {
      ordered.push(p);
    } else {
      notOrdered.push(p);
    }
  });

  // 🟩 IMPORTANT :
  // On conserve l'ordre global (déjà trié par sortProducts)
  // donc on NE RE-TRIE PAS par nom court ici.

  // Regroupement des non commandés par nom court
  const groups = {};
  notOrdered.forEach(p => {
    const g = p.nom_court.toLowerCase().trim();
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  // 🟩 On respecte l'ordre global : on parcourt notOrdered dans l'ordre existant
  const notOrderedFinal = [];
  notOrdered.forEach(p => {
    const g = p.nom_court.toLowerCase().trim();
    if (groups[g]) {
      notOrderedFinal.push(...groups[g]);
      delete groups[g];
    }
  });

  return [...ordered, ...notOrderedFinal];
}

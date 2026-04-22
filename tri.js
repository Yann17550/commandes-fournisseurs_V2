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

  // Détecte si on est en mode gérant
  const isGerant = state.etab && state.etab.id === 'gerant';

  // Séparation commandés / non commandés
  prods.forEach(p => {
    const key = productKey(p);

    let qty = 0;

    // En mode gérant :
    // un produit est considéré "commandé" s'il existe dans A ou dans B
    if (isGerant) {
      const qa = state.quantities_a[key] || 0;
      const qb = state.quantities_b[key] || 0;
      qty = qa + qb;
    }

    // En mode établissement A ou B :
    // on utilise la commande courante de l'établissement affiché
    else {
      qty = state.quantities[key] || 0;
    }

    // Les produits commandés remontent en haut
    if (qty > 0) {
      ordered.push(p);
    } else {
      notOrdered.push(p);
    }
  });

  // IMPORTANT :
  // On conserve l'ordre global déjà obtenu avant
  // (fournisseur / catégorie / historique / etc.)
  // donc on ne retrie pas ici.

  // Regroupement des non commandés par nom court
  const groups = {};
  notOrdered.forEach(p => {
    const g = p.nom_court.toLowerCase().trim();
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  // Reconstruction des non commandés
  // en respectant l'ordre d'origine
  const notOrderedFinal = [];
  notOrdered.forEach(p => {
    const g = p.nom_court.toLowerCase().trim();
    if (groups[g]) {
      notOrderedFinal.push(...groups[g]);
      delete groups[g];
    }
  });

  // Résultat final :
  // d'abord les commandés, puis les autres regroupés
  return [...ordered, ...notOrderedFinal];
}

// ============================================================
//  REGROUPEMENT — Nom court / Variantes
// ============================================================

// Retourne un dictionnaire : { nom_court : [produits...] }
function regrouperParNomCourt(prods) {
  const groups = {};
  prods.forEach(p => {
    const nc = p.nom_court;
    if (!groups[nc]) groups[nc] = [];
    groups[nc].push(p);
  });
  return groups;
}

// Retourne un Set des nom_court qui apparaissent plusieurs fois
function nomsCourtsMultiples(prods) {
  const counts = {};
  prods.forEach(p => {
    counts[p.nom_court] = (counts[p.nom_court] || 0) + 1;
  });
  return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k));
}

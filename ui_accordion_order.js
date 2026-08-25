// ============================================================
//  UI — ORDRE AFFICHÉ DE L’ACCORDÉON FOURNISSEUR
//  ui_accordion_order.js
// ============================================================

// Stocke l'ordre affiché courant par fournisseur.
// Format :
// state.accordionDisplayOrder = {
//   "Metro": ["key1", "key2", "key3"]
// }
function ensureAccordionDisplayOrderState() {
  console.log('[accordion-order] ensure state', {
    exists: !!state.accordionDisplayOrder,
    current: state.accordionDisplayOrder
  });

  if (!state.accordionDisplayOrder) {
    state.accordionDisplayOrder = {};
  }
}

function getSupplierDisplayProducts(supplier, prods) {
  console.log('[accordion-order] get display products', {
    supplier,
    keysBefore: prods.map(p => productKey(p)),
    stored: state.accordionDisplayOrder?.[supplier]
  });

  const result = ensureSupplierDisplayOrder(supplier, prods);

  console.log('[accordion-order] result', {
    supplier,
    keysAfter: result.map(p => productKey(p))
  });

  return result;
}

function refreshSupplierDisplayOrder(supplier, prods) {
  console.log('[accordion-order] REFRESH', {
    supplier,
    keysBefore: prods.map(p => productKey(p)),
    quantitiesA: state.quantities_a,
    quantitiesB: state.quantities_b,
    quantities: state.quantities
  });

  ensureAccordionDisplayOrderState();

  const refreshed = sortForDisplay([...prods], state);
  state.accordionDisplayOrder[supplier] = getProductKeysInOrder(refreshed);

  console.log('[accordion-order] refreshed result', {
    supplier,
    keysAfter: state.accordionDisplayOrder[supplier]
  });

  return refreshed;
}

// Retourne les clés produit dans l'ordre actuel d'un tableau.
function getProductKeysInOrder(prods) {
  return prods.map(p => productKey(p));
}

// Réapplique un ordre mémorisé sur une liste de produits déjà triée.
// Si de nouveaux produits apparaissent, ils sont ajoutés à la fin
// dans leur ordre d'entrée.
function applyStoredOrderToProducts(prods, storedKeys) {
  if (!Array.isArray(storedKeys) || !storedKeys.length) {
    return [...prods];
  }

  const byKey = new Map();
  prods.forEach(p => {
    byKey.set(productKey(p), p);
  });

  const ordered = [];

  storedKeys.forEach(key => {
    const p = byKey.get(key);
    if (p) {
      ordered.push(p);
      byKey.delete(key);
    }
  });

  byKey.forEach(p => {
    ordered.push(p);
  });

  return ordered;
}

// Initialise l'ordre affiché d'un fournisseur si absent.
// On part du tri déjà fourni en entrée, sans recalcul dynamique.
function ensureSupplierDisplayOrder(supplier, prods) {
  ensureAccordionDisplayOrderState();

  if (!state.accordionDisplayOrder[supplier]) {
    state.accordionDisplayOrder[supplier] = getProductKeysInOrder(prods);
  }

  return applyStoredOrderToProducts(
    prods,
    state.accordionDisplayOrder[supplier]
  );
}

// Recalcule l'ordre affiché d'un fournisseur à partir du tri dynamique.
// À appeler uniquement quand on veut "rafraîchir" l'ordre visuel,
// par exemple à la réouverture de l'accordéon.
function refreshSupplierDisplayOrder(supplier, prods) {
  ensureAccordionDisplayOrderState();

  const refreshed = sortForDisplay([...prods], state);
  state.accordionDisplayOrder[supplier] = getProductKeysInOrder(refreshed);

  return refreshed;
}

// Retourne les produits dans l'ordre affiché courant.
// Si aucun ordre n'existe encore, on l'initialise à partir du tri reçu.
function getSupplierDisplayProducts(supplier, prods) {
  return ensureSupplierDisplayOrder(supplier, prods);
}

// Permet de supprimer un ordre mémorisé si besoin futur
// (ex: reload complet, changement de dataset, etc.)
function clearSupplierDisplayOrder(supplier) {
  ensureAccordionDisplayOrderState();
  delete state.accordionDisplayOrder[supplier];
}

// Reset global si besoin futur
function clearAllAccordionDisplayOrders() {
  state.accordionDisplayOrder = {};
}

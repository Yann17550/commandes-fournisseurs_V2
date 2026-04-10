// ============================================================
//  UI — GESTION DES QUANTITÉS (ÉTAB A / B)
// ============================================================

// Bouton + / -
function onQtyBtn(e) {
  const key = e.currentTarget.dataset.key;
  const delta = parseInt(e.currentTarget.dataset.delta);
  const newQty = Math.max(0, (state.quantities[key] || 0) + delta);
  setQty(key, newQty);
}

// Saisie directe dans l’input
function onQtyInput(e) {
  const key = e.currentTarget.dataset.key;
  const qty = Math.max(0, parseInt(e.currentTarget.value) || 0);
  setQty(key, qty);
}

// Mise à jour d’une quantité
function setQty(key, qty) {
  state.quantities[key] = qty;

  // Mise à jour de la ligne
  const card = productList.querySelector(`.product-card[data-key="${CSS.escape(key)}"]`);
  if (card) {
    const p = state.produits.find(p => productKey(p) === key);
    if (p) {
      const isVariant = card.classList.contains('is-variant');
      const tmp = document.createElement('div');
      tmp.innerHTML = renderProduitAB(p, isVariant, state);
      const newCard = tmp.firstElementChild;
      card.replaceWith(newCard);

      // Rebind steppers
      newCard.querySelectorAll('.qty-btn').forEach(b =>
        b.addEventListener('click', onQtyBtn)
      );
      newCard.querySelectorAll('.qty-input').forEach(i => {
        i.addEventListener('change', onQtyInput);
        i.addEventListener('focus', e => e.target.select());
      });
      newCard.querySelectorAll('.edit-btn').forEach(b =>
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          openEditModal(b.dataset.key);
        })
      );
    }
  }

  updateAccordionBadge(key);
  scheduleSave();
}

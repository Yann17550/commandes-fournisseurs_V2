// ============================================================
//  Fichier : ui_qty.js
//  UI — GESTION DES QUANTITÉS (ÉTAB A / B)
// ============================================================

// Bouton + / -
function onQtyBtn(e) {
  const key = e.currentTarget.dataset.key;
  const delta = parseInt(e.currentTarget.dataset.delta, 10);
  const newQty = Math.max(0, (state.quantities[key] || 0) + delta);
  setQty(key, newQty);
}

// Saisie directe dans l’input
function onQtyInput(e) {
  const key = e.currentTarget.dataset.key;
  const qty = Math.max(0, parseInt(e.currentTarget.value, 10) || 0);
  setQty(key, qty);
}

// Recherche produit par clé interface
function findProduitByKey(key) {
  if (!key) {
    return null;
  }

  return (state.produits || []).find((p) => productKey(p) === key) || null;
}

// Mise à jour d’une quantité
function setQty(key, qty) {
  state.quantities[key] = qty;

  // Mise à jour de la ligne
  const card = productList.querySelector(`.Article_ab[data-key="${CSS.escape(key)}"]`);
  if (card) {
    const p = findProduitByKey(key);

    if (p) {
      const isVariant = card.classList.contains('is-variant');
      const tmp = document.createElement('div');
      tmp.innerHTML = renderProduitAB(p, isVariant, state);

      const newCard = tmp.firstElementChild;
      card.replaceWith(newCard);

      // Rebind steppers
      newCard.querySelectorAll('.qty-btn').forEach((btn) =>
        btn.addEventListener('click', onQtyBtn)
      );

      newCard.querySelectorAll('.qty-input').forEach((input) => {
        input.addEventListener('change', onQtyInput);
        input.addEventListener('focus', (e) => e.target.select());
      });

      newCard.querySelectorAll('.edit-btn').forEach((btn) =>
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();

          const produit = findProduitByKey(btn.dataset.key);
          if (!produit) {
            console.error('Produit introuvable pour édition après rerender quantité.', {
              key: btn.dataset.key,
              dataset: btn.dataset
            });
            showToast('❌ Impossible de retrouver ce produit pour édition');
            return;
          }

          openEditModal(produit);
        })
      );
    }
  }

  updateAccordionBadge(key);
  scheduleSave();
}

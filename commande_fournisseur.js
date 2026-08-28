// ============================================================
//  COMMANDE FOURNISSEUR
// ============================================================

async function renderSupplierOrdersHome() {
  const supplierOrdersList = $('supplierOrdersList');
  if (!supplierOrdersList) return;

  supplierOrdersList.innerHTML = `<p class="etab-sub">Chargement...</p>`;

  try {
    const savedA = await loadCommandeRemoteById('a');
    const savedB = await loadCommandeRemoteById('b');

    const rows = getSupplierRows(savedA || {}, savedB || {});

    if (!rows.length) {
      supplierOrdersList.innerHTML = `
        <p class="etab-sub">Aucune commande fournisseur pour le moment.</p>
      `;
      return;
    }

    supplierOrdersList.innerHTML = `
      <div class="supplier-orders-list">
        ${rows.map(row => `
          <button type="button" class="supplier-order-row">
            <span class="supplier-order-name">${escHtml(row.nom)}</span>
            <span class="supplier-order-amount">${fmtPrice(row.montant)}</span>
          </button>
        `).join('')}
      </div>
    `;
  } catch (err) {
    supplierOrdersList.innerHTML = `
      <p class="etab-sub">Erreur de chargement.</p>
    `;
    console.error('renderSupplierOrdersHome', err);
  }
}

function getSupplierRows(savedA, savedB) {
  const map = new Map();

  state.produits.forEach(p => {
    const key = productKey(p);
    const qa = Number(savedA[key] || 0);
    const qb = Number(savedB[key] || 0);
    const totalQty = qa + qb;

    if (totalQty <= 0) return;

    const nom = String(p.fournisseur || '').trim();
    if (!nom) return;

    const montantLigne = totalQty * getPrixColisTTC(p);
    if (montantLigne <= 0) return;

    if (!map.has(nom)) {
      map.set(nom, {
        nom,
        ordre: Number(p.ordre_fournisseur || 999),
        montant: 0
      });
    }

    const row = map.get(nom);
    row.ordre = Math.min(row.ordre, Number(p.ordre_fournisseur || 999));
    row.montant += montantLigne;
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
  });
}

function getPrixColisTTC(p) {
  const prixColisHt = Number(p.prix_colis || 0);
  const prixHt = Number(p.prix_ht || 0);
  const colisage = Number(p.colissage || 1);
  const tva = Number(p.tva || 0);
  const droitAlcool = Number(p.droit_alcool || 0);
  const taxeSecu = Number(p.taxe_secu || 0);

  const baseHt = prixColisHt > 0 ? prixColisHt : (prixHt * colisage);
  const baseTtc = baseHt * (1 + tva / 100);

  return baseTtc + droitAlcool + taxeSecu;
}

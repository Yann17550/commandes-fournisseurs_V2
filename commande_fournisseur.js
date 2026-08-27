// ============================================================
//  COMMANDE FOURNISSEUR — Agrégation A + B
// ============================================================

async function loadSupplierOrdersScreen() {
  try {
    if (!state.produits || !state.produits.length) {
      await loadData();
    }

    const [quantitiesA, quantitiesB] = await Promise.all([
      loadCommandeRemoteById('A'),
      loadCommandeRemoteById('B')
    ]);

    const rows = getSupplierOrdersList(quantitiesA || {}, quantitiesB || {});
    renderSupplierOrdersList(rows);
  } catch (error) {
    console.error('Erreur écran commandes fournisseurs', error);
    renderSupplierOrdersError(error);
  }
}

function getSupplierOrdersList(quantitiesA, quantitiesB) {
  const map = new Map();

  state.produits.forEach(p => {
    const key = productKey(p);
    const qtyA = Number((quantitiesA || {})[key] || 0);
    const qtyB = Number((quantitiesB || {})[key] || 0);
    const qtyTotal = qtyA + qtyB;

    if (qtyTotal <= 0) return;

    const unitPrice = getProduitUnitTtc(p);
    const lineTotal = qtyTotal * unitPrice;

    if (lineTotal <= 0) return;

    const supplierName = String(p.fournisseur || '').trim();
    if (!supplierName) return;

    if (!map.has(supplierName)) {
      map.set(supplierName, {
        fournisseur: supplierName,
        montant: 0,
        ordre: Number(p.ordre_fournisseur || 999),
      });
    }

    const row = map.get(supplierName);
    row.montant += lineTotal;
    row.ordre = Math.min(row.ordre, Number(p.ordre_fournisseur || 999));
  });

  return Array.from(map.values())
    .filter(row => row.montant > 0)
    .sort((a, b) => {
      if (a.ordre !== b.ordre) return a.ordre - b.ordre;
      return a.fournisseur.localeCompare(b.fournisseur, 'fr', { sensitivity: 'base' });
    });
}

function getProduitUnitTtc(p) {
  const prixHt = Number(p.prix_ht || 0);
  const tvaPct = Number(p.tva || 0);
  const droitAlcool = Number(p.droit_alcool || 0);
  const taxeSecu = Number(p.taxe_secu || 0);

  return prixHt * (1 + tvaPct / 100) + droitAlcool + taxeSecu;
}

function renderSupplierOrdersList(rows) {
  const container = $('supplierOrdersList');
  if (!container) return;

  if (!rows || !rows.length) {
    container.innerHTML = `
      <div class="supplier-orders-empty">
        <p>Aucune commande fournisseur pour le moment.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="supplier-orders-list">
      ${rows.map(row => `
        <button
          type="button"
          class="supplier-order-row"
          data-supplier="${escHtml(row.fournisseur)}"
        >
          <span class="supplier-order-name">${escHtml(row.fournisseur)}</span>
          <span class="supplier-order-amount">${fmtPrice(row.montant)}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.supplier-order-row').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('Écran détail fournisseur à venir');
    });
  });
}

function renderSupplierOrdersError(error) {
  const container = $('supplierOrdersList');
  if (!container) return;

  container.innerHTML = `
    <div class="supplier-orders-error">
      <p>Impossible de charger les commandes fournisseurs.</p>
    </div>
  `;
}

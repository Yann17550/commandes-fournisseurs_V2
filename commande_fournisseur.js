// ============================================================
//  COMMANDE FOURNISSEUR
// ============================================================

function renderSupplierOrdersHome() {
  const supplierOrdersList = $('supplierOrdersList');
  if (!supplierOrdersList) return;

  const rows = [
    { nom: 'Transgourmet', montant: '124,80 €' },
    { nom: 'Metro', montant: '89,40 €' },
    { nom: 'Pomona', montant: '212,00 €' }
  ];

  supplierOrdersList.innerHTML = `
    <div class="supplier-orders-list">
      ${rows.map(row => `
        <button type="button" class="supplier-order-row">
          <span class="supplier-order-name">${escHtml(row.nom)}</span>
          <span class="supplier-order-amount">${row.montant}</span>
        </button>
      `).join('')}
    </div>
  `;
}

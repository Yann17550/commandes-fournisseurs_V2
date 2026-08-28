// ============================================================
//  COMMANDE FOURNISSEUR
// ============================================================

function renderSupplierOrdersHome() {
  const supplierOrdersList = $('supplierOrdersList');
  if (!supplierOrdersList) return;

  supplierOrdersList.innerHTML = `
    <p class="etab-sub">Commande fournisseur : branchement JS OK.</p>
  `;
}

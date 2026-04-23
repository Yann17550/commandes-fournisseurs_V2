// ============================================================
//  COPIE / ARCHIVAGE / RESET
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["copy.js"] = "2026-04-23T11:21:00";

async function copySummary(mode) {
  let text = '';
  const isGerant = state.etab && state.etab.id === 'gerant';

  if (isGerant) {
    if (mode === 'a' || mode === 'b') {
      text = buildCopyTextGerant(mode);
    } else {
      text = buildCopyTextGerant('all');
    }
  } else {
    text = buildCopyTextNormal();
  }

  await navigator.clipboard.writeText(text);
  showToast('📋 Copié');

  if (!isGerant) archiveCommande();
}

function buildCopyTextNormal() {
  let out = `Commande ${state.etab.label} — ${getWeekLabel()}\n\n`;
  const suppliers = getSuppliers();

  suppliers.forEach(sup => {
    const items = state.produits.filter(p => p.fournisseur === sup);
    let block = '';
    items.forEach(p => {
      const key = productKey(p);
      const qty = state.quantities[key] || 0;
      if (!qty) return;
      block += `${qty} × ${p.nom_court} (${p.reference})\n`;
    });
    if (block) out += `--- ${sup} ---\n${block}\n`;
  });

  return out.trim();
}

function buildCopyTextGerant(mode) {
  let out = `Commandes Gérant — ${getWeekLabel()}\n\n`;

  state.produits.forEach(p => {
    const key = productKey(p);
    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    if (mode === 'a' && !qa) return;
    if (mode === 'b' && !qb) return;
    if (mode === 'all' && !qa && !qb) return;

    out += `${p.nom_court} (${p.reference}) — A:${qa}  B:${qb}\n`;
  });

  return out.trim();
}

function resetCommande() {
  if (!confirm("Vider la commande ?")) return;

  if (state.etab.id === 'gerant') {
    state.quantities_a = {};
    state.quantities_b = {};
  } else {
    state.quantities = {};
  }

  clearCommandeRemote();
  closeSummary();
  render();
  showToast('🗑 Commande vidée');
}

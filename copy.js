// ============================================================
//  COPIE / ARCHIVAGE / RESET
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["copy.js"] = "2026-04-06T18:31:00";

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

// ============================================================
//  ARCHIVAGE ET RESET QTé GÉRANT ET ETAB A & B
// ============================================================
async function validateSupplier(sup) {
  if (!confirm("Valider la commande du fournisseur " + sup + " ?")) return;

  // 1. Archivage A et B pour CE fournisseur
  const itemsA = [];
  const itemsB = [];

  state.produits
    .filter(p => p.fournisseur === sup)
    .forEach(p => {
      const key = productKey(p);
      const prix = getPrixColis(p);

      const qa = state.quantities_a[key] || 0;
      const qb = state.quantities_b[key] || 0;

      if (qa > 0) {
        itemsA.push({
          key,
          nomCourt: p.nom_court,
          ref: p.reference,
          qty: qa,
          prixHt: p.prix_ht,
          total: qa * prix
        });
      }

      if (qb > 0) {
        itemsB.push({
          key,
          nomCourt: p.nom_court,
          ref: p.reference,
          qty: qb,
          prixHt: p.prix_ht,
          total: qb * prix
        });
      }
    });

  // Envoi archive A
  if (itemsA.length && CONFIG.APPS_SCRIPT_URL) {
    fetch(CONFIG.APPS_SCRIPT_URL + '?action=archive&etab=a', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        semaine: getWeekId(),
        etabLabel: "Établissement A",
        items: itemsA
      })
    });
  }

  // Envoi archive B
  if (itemsB.length && CONFIG.APPS_SCRIPT_URL) {
    fetch(CONFIG.APPS_SCRIPT_URL + '?action=archive&etab=b', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        semaine: getWeekId(),
        etabLabel: "Établissement B",
        items: itemsB
      })
    });
  }

  // 2. Reset des quantités A/B pour CE fournisseur
  state.produits
    .filter(p => p.fournisseur === sup)
    .forEach(p => {
      const key = productKey(p);
      delete state.quantities_a[key];
      delete state.quantities_b[key];
    });

  // 3. Sauvegarde distante
  scheduleSave();

  // 4. Re-render
  renderAccordionGerant();

  // 5. Met à jour le total
  if (typeof updateTotal === 'function') {
    updateTotal();
  }

  // 6. Toast
  showToast("📦 Commande validée pour " + sup);
}

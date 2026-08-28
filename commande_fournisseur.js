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
          <button
            type="button"
            class="supplier-order-row"
            data-supplier="${escHtml(row.nom)}"
          >
            <span class="supplier-order-name">${escHtml(row.nom)}</span>
            <span class="supplier-order-amount">${fmtPrice(row.montant)}</span>
          </button>
        `).join('')}
      </div>
    `;

    supplierOrdersList.querySelectorAll('.supplier-order-row').forEach(btn => {
      btn.addEventListener('click', () => {
        renderSupplierSmsView(btn.dataset.supplier, savedA || {}, savedB || {});
      });
    });

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

    const prixColis = Number(p.prix_colis || 0);
    const montantLigne = totalQty * prixColis;

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

function renderSupplierSmsView(supplierName, savedA, savedB) {
  const supplierOrdersList = $('supplierOrdersList');
  if (!supplierOrdersList) return;

  const sms = buildSupplierSmsText(supplierName, savedA, savedB);
  const tel = getSupplierPhone(supplierName);

  supplierOrdersList.innerHTML = `
    <div class="supplier-order-detail">
      <button type="button" class="etab-back-btn" id="backToSupplierOrdersListBtn">← Retour à la liste</button>
      <h2 class="etab-title">${escHtml(supplierName)}</h2>

      <div class="supplier-sms-actions">
        <button type="button" class="copy-btn" id="copySupplierSmsBtn">Copier</button>
        <button type="button" class="copy-btn" id="sendSupplierSmsBtn">SMS</button>
      </div>

      <pre class="supplier-sms-preview">${escHtml(sms)}</pre>
    </div>
  `;

  $('backToSupplierOrdersListBtn').addEventListener('click', () => {
    renderSupplierOrdersHome();
  });

  $('copySupplierSmsBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(sms);
    showToast('📋 Copié');
  });

  $('sendSupplierSmsBtn').addEventListener('click', () => {
    const url = tel
      ? `sms:${encodeURIComponent(tel)}?body=${encodeURIComponent(sms)}`
      : `sms:?body=${encodeURIComponent(sms)}`;

    window.location.href = url;
  });
}

function buildSupplierSmsText(supplierName, savedA, savedB) {
  const contact = getSupplierContactName(supplierName);
  const linesA = getSupplierSmsLinesForEtab(supplierName, savedA);
  const linesB = getSupplierSmsLinesForEtab(supplierName, savedB);

  let out = `Bonjour ${contact},\nVoici ma commande :\n`;

  if (linesA.length) {
    out += `\nPizza d'Oléron\n`;
    out += linesA.join('\n') + '\n';
  }

  if (linesB.length) {
    out += `\nLe Vesuvio\n`;
    out += linesB.join('\n') + '\n';
  }

  out += `\nMerci et bonne journée.`;

  return out.trim();
}

function getSupplierSmsLinesForEtab(supplierName, quantities) {
  const rows = [];

  state.produits.forEach(p => {
    if (String(p.fournisseur || '').trim() !== supplierName) return;

    const key = productKey(p);
    const qty = Number((quantities || {})[key] || 0);
    if (qty <= 0) return;

    const typeUnite = String(p.type_unite || '').trim();
    const typePart = typeUnite ? ` ${typeUnite}` : '';

    rows.push(
      `${qty}${typePart} ${p.nom_court} - Réf : ${p.reference}`
    );
  });

  return rows;
}

function getSupplierContactName(supplierName) {
  const f = (state.fournisseurs || {})[supplierName];
  const contact = f && f.contact ? String(f.contact).trim() : '';

  if (!contact) return '';

  return contact.split(/\s+/)[0];
}

function getSupplierPhone(supplierName) {
  const f = (state.fournisseurs || {})[supplierName];
  return f && f.telephone ? String(f.telephone).trim() : '';
}

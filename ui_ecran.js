// ============================================================
//  UI — GESTION DES ÉCRANS (choix établissement / écran app)
// ============================================================

// ---- Écran de sélection d'établissement --------------------
function renderEtabScreen() {
  etabCards.innerHTML = `
    ${CONFIG.ETABS.map(e => `
      <button class="etab-card" data-etab="${e.id}">
        <img src="${e.icon}" alt="${escHtml(e.label)}" class="etab-logo">
        <span class="etab-card-label">${escHtml(e.label)}</span>
      </button>
    `).join('')}

    <button class="etab-switch-link etab-switch-link--suppliers" id="openSuppliersOrdersBtn" type="button">
      Commandes fournisseurs
    </button>
  `;

  etabCards.querySelectorAll('.etab-card').forEach(btn => {
    btn.addEventListener('click', () => selectEtab(btn.dataset.etab));
  });

  const openSuppliersOrdersBtn = $('openSuppliersOrdersBtn');
  if (openSuppliersOrdersBtn) {
    openSuppliersOrdersBtn.addEventListener('click', async () => {
      screenEtab.style.display = 'none';
      screenApp.style.display = 'none';
      screenSupplierOrders.style.display = 'flex';

      await renderSupplierOrdersHome();
    });
  }

  screenEtab.style.display = 'flex';
  screenSupplierOrders.style.display = 'none';
  screenApp.style.display = 'none';
}

// ---- Sélection d'un établissement --------------------------
async function selectEtab(id) {
  const etab = CONFIG.ETABS.find(e => e.id === id);
  if (!etab) return;

  const prevId = state.etab ? state.etab.id : null;
  state.etab = etab;

  document.body.classList.toggle('etab-gerant', id === 'gerant');
  saveEtabLocal(id);

  etabPill.innerHTML = `
    <img src="${etab.icon}" class="etab-logo-pill">
    <span>${escHtml(etab.label)}</span>
  `;

  $('summaryTitle').textContent = 'Commande — ' + etab.label;

  screenEtab.style.display = 'none';
  screenSupplierOrders.style.display = 'none';
  screenApp.style.display = 'flex';

  // Premier chargement
  if (!state.loaded) {
    await loadData();
    return;
  }

  // Changement d'établissement
  if (prevId !== id) {
    loadingState.style.display = 'flex';
    productList.style.display = 'none';

    if (id === 'gerant') {
      const savedA = await loadCommandeRemoteById('a');
      const savedB = await loadCommandeRemoteById('b');
      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};
    } else {
      const saved = await loadCommandeRemoteById(id);
      const histo = await loadHistoRemote();
      state.quantities = saved || {};

      if (histo && histo.quantities) {
        state.lastOrder = histo.quantities;
        state.lastSemaine = histo.semaine || '';
      }
    }

    state.openSupplier = null;
    render();
    return;
  }

  // Même établissement → juste re-render
  render();
}

// ---- Retour à l'écran de choix ------------------------------
etabPill.addEventListener('click', () => {
  screenApp.style.display = 'none';
  screenSupplierOrders.style.display = 'none';
  renderEtabScreen();
});

$('backToHomeFromSuppliersBtn').addEventListener('click', () => {
  screenSupplierOrders.style.display = 'none';
  renderEtabScreen();
});

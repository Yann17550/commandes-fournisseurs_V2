// ============================================================
//  UI — MODALE D'AJOUT PRODUIT
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["ui_modals_add.js"] = "2026-04-06T18:31:00";

// Ouvrir la modale d'ajout
function openAddModal() {
  const sel = $('addFournisseur');
  sel.innerHTML = getSuppliers()
    .map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`)
    .join('');

  ['addNomCourt', 'addDesignation', 'addRef', 'addCategorie', 'addPrix']
    .forEach(id => $(id).value = '');

  $('addColissage').value = '1';

  addModal.style.display = 'flex';
}

// Fermer la modale
function closeAddModal() {
  addModal.style.display = 'none';
}

// Sauvegarde du nouveau produit
$('saveAddBtn').addEventListener('click', async () => {
  const fournisseur = $('addFournisseur').value.trim();
  const nom_court   = $('addNomCourt').value.trim();

  if (!fournisseur || !nom_court) {
    showToast('⚠️ Fournisseur et nom court obligatoires');
    return;
  }

  const designation  = $('addDesignation').value.trim() || nom_court;
  const reference    = $('addRef').value.trim() || 'NEW-' + Date.now();
  const categorie    = $('addCategorie').value.trim() || 'Divers';
  const prix_ht      = parseFloat($('addPrix').value) || 0;
  const colissage    = parseInt($('addColissage').value) || 1;

  const etablissement = (state.etab && state.etab.id !== 'gerant')
    ? state.etab.id.toUpperCase()
    : 'AB';

  const newProd = {
    fournisseur,
    reference,
    designation,
    label: cleanDesignation(designation),
    tva: 5.5,
    prix_ht,
    droit_alcool: 0,
    taxe_secu: 0,
    nom_court,
    categorie,
    colissage,
    prix_colis: 0,
    etablissement,
    actif: true,
    isTemp: !CONFIG.APPS_SCRIPT_URL,
  };

  // Insertion locale dans state.produits
  const lastIdx = state.produits.reduce(
    (acc, p, i) => (p.fournisseur === fournisseur ? i : acc),
    -1
  );

  if (lastIdx >= 0) state.produits.splice(lastIdx + 1, 0, newProd);
  else state.produits.push(newProd);

  closeAddModal();
  renderAccordion();

  // Sauvegarde Apps Script
  if (CONFIG.APPS_SCRIPT_URL) {
    showToast('⏳ Sauvegarde dans le Sheet...');

    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=addProduct', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          fournisseur,
          reference,
          designation,
          nom_court,
          categorie,
          tva: 5.5,
          prix_ht,
          droit_alcool: 0,
          taxe_secu: 0,
          etablissement,
          colissage
        })
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erreur inconnue");

      showToast("✅ Produit ajouté dans le Sheet");

    } catch (err) {
      showToast("⚠️ Échec : " + err.message);
    }
  }
});

// Fermeture modale
$('closeAddModal').addEventListener('click', closeAddModal);
$('cancelAddBtn').addEventListener('click', closeAddModal);

addModal.addEventListener('click', e => {
  if (e.target === addModal) closeAddModal();
});

async function applyEdit() {
  const key = state.editKey;
  if (!key) return;

  const p = state.produits.find(p => productKey(p) === key);
  if (!p) return;

  const d = getProductData(p);

  const newRef       = $('editRef').value.trim();
  const newPrix      = parseFloat($('editPrix').value) || 0;
  const newColissage = parseInt($('editColissage').value) || 1;

  if (!CONFIG.APPS_SCRIPT_URL) {
    showToast('⚠️ Apps Script non configuré dans config.js');
    return;
  }

  const btn = $('saveEditBtn');
  btn.disabled = true;
  btn.textContent = 'Sauvegarde...';

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        fournisseur:  p.fournisseur,
        oldReference: d.reference,
        nomCourt:     p.nom_court,
        reference:    newRef,
        prix_ht:      newPrix,
        colissage:    newColissage,
      }),
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Erreur inconnue');

    closeEditModal();

    // 🔥 Recharge propre des données
    await loadDataCore();

    // 🔥 Re-render complet
    render();

    showToast('✅ Mis à jour dans le Sheet');

  } catch (err) {
    showToast('⚠️ Échec : ' + err.message);

  } finally {
    btn.disabled = false;
    btn.textContent = 'Sauvegarder';
  }
}

// ============================================================
//  UI — MODALE D'ÉDITION PRODUIT
// ============================================================

// Ouvrir la modale
function openEditModal(key) {
  const p = state.produits.find(p => productKey(p) === key);
  if (!p) return;

  const d = getProductData(p);
  state.editKey = key;

  $('editModalTitle').textContent = 'Modifier : ' + p.nom_court;
  $('editRef').value = d.reference;
  $('editPrix').value = d.prix_ht;
  $('editColissage').value = d.colissage;

  editModal.style.display = 'flex';
}

// Fermer la modale
function closeEditModal() {
  editModal.style.display = 'none';
  state.editKey = null;
}

// Appliquer les modifications
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
    // 🔥 On attend la réponse AVANT de recharger
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
    console.log("FETCH OK");
    if (!json.ok) throw new Error(json.error || 'Erreur inconnue');

    closeEditModal();
    showToast('✅ Mis à jour dans le Sheet');

    // 🔥 Recharge APRÈS la fin du fetch
    setTimeout(() => location.reload(), 600);

  } catch (err) {
    console.error(err);
    showToast('⚠️ Échec : ' + err.message);

  } finally {
    btn.disabled = false;
    btn.textContent = 'Sauvegarder';
  }
}

// ---- Listeners modale --------------------------------------
$('saveEditBtn').addEventListener('click', applyEdit);
$('closeEditModal').addEventListener('click', closeEditModal);
$('cancelEditBtn').addEventListener('click', closeEditModal);

editModal.addEventListener('click', e => {
  if (e.target === editModal) closeEditModal();
});

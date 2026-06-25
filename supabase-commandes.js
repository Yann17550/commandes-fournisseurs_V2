// ─── Remplace loadCommandeRemote() ───────────────────────────────────────────
async function loadCommandeRemote() {
  return loadCommandeRemoteById(state.etablissement); // 'A' ou 'B'
}

// ─── Remplace loadCommandeRemoteById(etabId) ─────────────────────────────────
async function loadCommandeRemoteById(etabId) {
  const { data, error } = await supabase
    .from('commandes')
    .select('reference, quantite, produit_id, fournisseur_id')
    .eq('etablissement', etabId);

  if (error) { console.error('loadCommandeRemoteById', error); return {}; }

  // Reconstruit state.quantities sous la même forme qu'avant
  const quantities = {};
  for (const row of data) {
    const key = row.reference
      ? (row.fournisseur_id + '|' + row.reference)  // productKey(p)
      : null;
    if (key) quantities[key] = row.quantite;
  }
  return quantities;
}

// ─── Remplace doSave() / fetchSave() ─────────────────────────────────────────
// Appelé à chaque changement de quantité
async function saveQuantity(produit, quantite, etabId = state.etablissement) {
  const key = productKey(produit); // fournisseur_id + '|' + reference
  const { error } = await supabase
    .from('commandes')
    .upsert({
      etablissement:  etabId,
      produit_id:     produit.id,
      fournisseur_id: produit.fournisseur_id,
      reference:      produit.reference,
      quantite:       quantite,
      updated_at:     new Date().toISOString()
    }, { onConflict: 'etablissement,produit_id' });

  if (error) console.error('saveQuantity', error);
}

// ─── Remplace loadHistoRemote() ──────────────────────────────────────────────
async function loadHistoRemote(semaine = null) {
  let query = supabase
    .from('commandes_historique')
    .select('*')
    .order('archive_at', { ascending: false });

  if (semaine) query = query.eq('semaine', semaine);

  const { data, error } = await query;
  if (error) { console.error('loadHistoRemote', error); return []; }
  return data;
}

// ─── Remplace archiveCommande() ──────────────────────────────────────────────
async function archiveCommande(etabId = state.etablissement, note = '') {
  // 1. Lire toutes les lignes non-nulles de la commande courante
  const { data: lignes, error: errLecture } = await supabase
    .from('commandes')
    .select('*')
    .eq('etablissement', etabId)
    .gt('quantite', 0);

  if (errLecture) { console.error('archiveCommande lecture', errLecture); return false; }
  if (!lignes.length) return false;

  // 2. Calculer la semaine ISO courante
  const semaine = getISOWeek(); // voir helper ci-dessous

  // 3. Insérer dans l'historique
  const snapshot = lignes.map(l => ({
    etablissement:  l.etablissement,
    fournisseur_id: l.fournisseur_id,
    produit_id:     l.produit_id,
    reference:      l.reference,
    quantite:       l.quantite,
    semaine,
    note,
    archive_at:     new Date().toISOString()
  }));

  const { error: errArchive } = await supabase
    .from('commandes_historique')
    .insert(snapshot);

  if (errArchive) { console.error('archiveCommande insert', errArchive); return false; }
  return true;
}

// ─── Remplace clearCommandeRemote() ──────────────────────────────────────────
async function clearCommandeRemote(etabId = state.etablissement) {
  const { error } = await supabase
    .from('commandes')
    .delete()
    .eq('etablissement', etabId);

  if (error) { console.error('clearCommandeRemote', error); return false; }
  return true;
}

// ─── Helper semaine ISO ───────────────────────────────────────────────────────
function getISOWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ============================================================
// supabase-commandes.js
// Backend Supabase pour les commandes et l'historique
// Dépend de : window.supabaseClient, state, productKey(p)
// ============================================================

/**
 * Normalise l'identifiant établissement.
 * Exemples : "a" -> "A", " b " -> "B"
 */
function sbNormalizeEtabId(etabId) {
  return String(etabId || '').trim().toUpperCase();
}

/**
 * Reconstruit la clé utilisée dans le front :
 * "Nom fournisseur|Reference"
 */
function sbBuildCommandeKey(row) {
  const fournisseurNom = (
    row.fournisseurs?.nom ||
    row.fournisseur_nom ||
    row.fournisseur ||
    ''
  ).trim();

  const reference = (row.reference || '').trim();

  if (!fournisseurNom || !reference) return null;
  return fournisseurNom + '|' + reference;
}

/**
 * Renvoie la semaine ISO courante.
 * Exemple : 2026-W26
 */
function sbGetISOWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Charge la commande de l'établissement courant.
 */
async function sbLoadCommandeRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';
  return sbLoadCommandeRemoteById(etabId);
}

/**
 * Charge les lignes de commande en cours pour un établissement
 * et reconstruit l'objet quantities attendu par le front.
 */
async function sbLoadCommandeRemoteById(etabId) {
  const E = sbNormalizeEtabId(etabId);

  const { data, error } = await supabaseClient
    .from('commandes')
    .select(`
      etablissement,
      produit_id,
      reference,
      quantite,
      fournisseur_id,
      fournisseur_nom
    `)
    .eq('etablissement', E)
    .gt('quantite', 0);

  if (error) {
    console.error('[CMD] Erreur chargement commande', error);
    return {};
  }

  const quantities = {};

  for (const row of data || []) {
    const key = sbBuildCommandeKey(row);
    if (!key) continue;
    quantities[key] = Number(row.quantite) || 0;
  }

  return quantities;
}

/**
 * Charge la dernière commande archivée de l'établissement courant.
 * On ne conserve que la dernière semaine trouvée.
 */
async function sbLoadHistoRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';
  const E = sbNormalizeEtabId(etabId);

  const { data, error } = await supabaseClient
    .from('commandes_historique')
    .select(`
      id,
      etablissement,
      produit_id,
      fournisseur_id,
      reference,
      quantite,
      semaine,
      note,
      archive_at,
      fournisseur_nom
    `)
    .eq('etablissement', E)
    .order('archive_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('[CMD] Erreur chargement historique', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const semaine = data[0].semaine || '';
  const quantities = {};

  for (const row of data) {
    if ((row.semaine || '') !== semaine) break;

    const key = sbBuildCommandeKey(row);
    if (!key) continue;

    quantities[key] = Number(row.quantite) || 0;
  }

  return {
    semaine,
    quantities,
    rows: data
  };
}

/**
 * Sauvegarde une ligne de commande dans la table "commandes".
 * La ligne est mise à jour si elle existe déjà pour le même produit.
 */
async function sbSaveCommandeRemote(produit, quantite, etabId = null) {
  const E = sbNormalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  const payload = {
    etablissement: E,
    produit_id: produit?.id || null,
    fournisseur_id: produit?.fournisseur_id || null,
    fournisseur_nom: produit?.fournisseur || null,
    reference: (produit?.reference || '').trim(),
    quantite: Number(quantite) || 0,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('commandes')
    .upsert(payload, { onConflict: 'etablissement,reference,fournisseur_id' });

  if (error) {
    console.error('[CMD] Erreur sauvegarde commande', error);
    return false;
  }

  return true;
}

/**
 * Archive toute la commande active d'un établissement.
 * Cette fonction reste utile pour une archive globale éventuelle.
 */
async function sbArchiveCommande(etabId = null, note = '') {
  const E = sbNormalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  const { data: lignes, error: errLecture } = await supabaseClient
    .from('commandes')
    .select(`
      etablissement,
      produit_id,
      fournisseur_id,
      fournisseur_nom,
      reference,
      quantite
    `)
    .eq('etablissement', E)
    .gt('quantite', 0);

  if (errLecture) {
    console.error('[CMD] Erreur lecture archive commande', errLecture);
    return false;
  }

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return true;
  }

  const semaine = sbGetISOWeek();
  const archive_at = new Date().toISOString();

  const snapshot = lignes.map(row => ({
    etablissement: E,
    produit_id: row.produit_id || null,
    fournisseur_id: row.fournisseur_id || null,
    fournisseur_nom: row.fournisseur_nom || null,
    reference: (row.reference || '').trim(),
    quantite: Number(row.quantite) || 0,
    semaine,
    note,
    archive_at
  }));

  const { error: errArchive } = await supabaseClient
    .from('commandes_historique')
    .insert(snapshot);

  if (errArchive) {
    console.error('[CMD] Erreur insertion historique', errArchive);
    return false;
  }

  return true;
}

/**
 * Supprime toutes les lignes de commande en cours pour un établissement.
 */
async function sbClearCommandeRemote(etabId = null) {
  const E = sbNormalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  const { error } = await supabaseClient
    .from('commandes')
    .delete()
    .eq('etablissement', E);

  if (error) {
    console.error('[CMD] Erreur suppression commande', error);
    return false;
  }

  return true;
}

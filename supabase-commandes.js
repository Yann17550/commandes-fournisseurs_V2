// supabase-commandes.js
// Backend commandes Supabase
// Dépend de : window.supabaseClient, state, productKey(p)

function normalizeEtabId(etabId) {
  return String(etabId || '').trim().toUpperCase();
}

function buildCommandeKey(row) {
  const fournisseurNom = (row.fournisseurs?.nom || row.fournisseur_nom || row.fournisseur || '').trim();
  const reference = (row.reference || '').trim();
  if (!fournisseurNom || !reference) return null;
  return fournisseurNom + '|' + reference;
}

function getISOWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function loadCommandeRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';
  return loadCommandeRemoteById(etabId);
}

async function loadCommandeRemoteById(etabId) {
  const E = normalizeEtabId(etabId);

  const { data, error } = await supabaseClient
    .from('commandes')
    .select(`
      etablissement,
      reference,
      quantite,
      fournisseur_id,
      fournisseur_nom,
      fournisseurs (
        nom
      )
    `)
    .eq('etablissement', E)
    .gt('quantite', 0);

  if (error) {
    console.error('loadCommandeRemoteById', error);
    return {};
  }

  const quantities = {};
  for (const row of data || []) {
    const key = buildCommandeKey(row);
    if (!key) continue;
    quantities[key] = Number(row.quantite) || 0;
  }
  return quantities;
}

async function loadHistoRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';

  const { data, error } = await supabaseClient
    .from('commandes_historique')
    .select(`
      etablissement,
      fournisseur_id,
      reference,
      quantite,
      semaine,
      note,
      archive_at,
      fournisseurs (
        nom
      )
    `)
    .eq('etablissement', normalizeEtabId(etabId))
    .order('archive_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('loadHistoRemote', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const semaine = data[0].semaine || '';
  const quantities = {};

  for (const row of data) {
    if ((row.semaine || '') !== semaine) break;
    const key = buildCommandeKey(row);
    if (!key) continue;
    quantities[key] = Number(row.quantite) || 0;
  }

  return {
    semaine,
    quantities,
    rows: data
  };
}

async function saveCommandeRemote(produit, quantite, etabId = null) {
  const E = normalizeEtabId(etabId || (state?.etab?.id === 'a' ? 'A' : 'B'));
  const q = Number(quantite) || 0;

  const payload = {
    etablissement: E,
    fournisseur_id: produit.fournisseur_id || null,
    fournisseur_nom: produit.fournisseur || null,
    reference: (produit.reference || '').trim(),
    quantite: q,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('commandes')
    .upsert(payload, { onConflict: 'etablissement,reference,fournisseur_id' });

  if (error) {
    console.error('saveCommandeRemote', error);
    return false;
  }

  return true;
}

async function fetchSave(produit, quantite, etabId = null) {
  return saveCommandeRemote(produit, quantite, etabId);
}

async function doSave(produit, quantite, etabId = null) {
  return saveCommandeRemote(produit, quantite, etabId);
}

async function archiveCommande(etabId = null, note = '') {
  const E = normalizeEtabId(etabId || (state?.etab?.id === 'a' ? 'A' : 'B'));

  const { data: lignes, error: errLecture } = await supabaseClient
    .from('commandes')
    .select(`
      etablissement,
      fournisseur_id,
      fournisseur_nom,
      reference,
      quantite,
      fournisseurs (
        nom
      )
    `)
    .eq('etablissement', E)
    .gt('quantite', 0);

  if (errLecture) {
    console.error('archiveCommande lecture', errLecture);
    return false;
  }

  if (!lignes || lignes.length === 0) return true;

  const semaine = getISOWeek();
  const archive_at = new Date().toISOString();

  const snapshot = lignes.map(l => ({
    etablissement: E,
    fournisseur_id: l.fournisseur_id || null,
    fournisseur_nom: l.fournisseur_nom || l.fournisseurs?.nom || null,
    reference: (l.reference || '').trim(),
    quantite: Number(l.quantite) || 0,
    semaine,
    note,
    archive_at
  }));

  const { error: errArchive } = await supabaseClient
    .from('commandes_historique')
    .insert(snapshot);

  if (errArchive) {
    console.error('archiveCommande insert', errArchive);
    return false;
  }

  return true;
}

async function clearCommandeRemote(etabId = null) {
  const E = normalizeEtabId(etabId || (state?.etab?.id === 'a' ? 'A' : 'B'));

  const { error } = await supabaseClient
    .from('commandes')
    .delete()
    .eq('etablissement', E);

  if (error) {
    console.error('clearCommandeRemote', error);
    return false;
  }

  return true;
}

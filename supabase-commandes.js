// ============================================================
// supabase-commandes.js
// Backend commandes Supabase
// Dépend de : window.supabaseClient, state, productKey(p)
// ============================================================


// ------------------------------------------------------------
// Normalise l'identifiant établissement
// Exemple : "a" -> "A", " b " -> "B"
// ------------------------------------------------------------
function normalizeEtabId(etabId) {
  return String(etabId || '').trim().toUpperCase();
}


// ------------------------------------------------------------
// Reconstruit la clé produit utilisée dans le front
// Format attendu : "Nom fournisseur|Reference"
// Cette clé doit correspondre à productKey(p)
// ------------------------------------------------------------
function buildCommandeKey(row) {
  const fournisseurNom = (
    row.fournisseurs?.nom ||
    row.fournisseur_nom ||
    row.fournisseur ||
    ''
  ).trim();

  const reference = (row.reference || '').trim();

  if (!fournisseurNom || !reference) {
    console.warn('[CMD] buildCommandeKey impossible', {
      row,
      fournisseurNom,
      reference
    });
    return null;
  }

  return fournisseurNom + '|' + reference;
}


// ------------------------------------------------------------
// Renvoie la semaine ISO courante
// Exemple : 2026-W26
// Utilisé pour l'historique
// ------------------------------------------------------------
function getISOWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}


// ------------------------------------------------------------
// Charge la commande de l'établissement courant
// Vue simple A/B uniquement
// ------------------------------------------------------------
async function loadCommandeRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';

  console.log('[CMD] loadCommandeRemote()');
  console.log('[CMD] etab courant =', state?.etab);
  console.log('[CMD] etab resolu =', etabId);

  return loadCommandeRemoteById(etabId);
}


// ------------------------------------------------------------
// Charge les lignes de commande en cours pour un établissement
// Lit la table "commandes"
// Retourne un objet quantities : { "Fournisseur|Reference": quantite }
// ------------------------------------------------------------
async function loadCommandeRemoteById(etabId) {
  const E = normalizeEtabId(etabId);

  console.log('[CMD] loadCommandeRemoteById() START');
  console.log('[CMD] etabId brut =', etabId);
  console.log('[CMD] etabId normalisé =', E);

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

  console.log('[CMD] loadCommandeRemoteById() RESULT');
  console.log('[CMD] error =', error);
  console.log('[CMD] data =', data);

  if (error) {
    console.error('[CMD] loadCommandeRemoteById ERROR', error);
    return {};
  }

  const quantities = {};

  for (const row of data || []) {
    const key = buildCommandeKey(row);
    if (!key) continue;
    quantities[key] = Number(row.quantite) || 0;
  }

  console.log('[CMD] loadCommandeRemoteById() quantities =', quantities);

  return quantities;
}


// ------------------------------------------------------------
// Charge l'historique de commande de l'établissement courant
// Lit la table "commandes_historique"
// Retourne uniquement la dernière semaine trouvée
// ------------------------------------------------------------
async function loadHistoRemote() {
  const etabId = state?.etab?.id === 'a' ? 'A' : 'B';
  const E = normalizeEtabId(etabId);

  console.log('[CMD] loadHistoRemote() START');
  console.log('[CMD] etab courant =', state?.etab);
  console.log('[CMD] etabId normalisé =', E);

  const { data, error } = await supabaseClient
    .from('commandes_historique')
    .select(`
      id,
      etablissement,
      fournisseur_id,
      reference,
      quantite,
      semaine,
      note,
      archive_at,
      fournisseur_nom,
      fournisseurs (
        nom
      )
    `)
    .eq('etablissement', E)
    .order('archive_at', { ascending: false })
    .order('id', { ascending: false });

  console.log('[CMD] loadHistoRemote() RESULT');
  console.log('[CMD] error =', error);
  console.log('[CMD] data =', data);

  if (error) {
    console.error('[CMD] loadHistoRemote ERROR', error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('[CMD] loadHistoRemote() aucune ligne');
    return null;
  }

  const semaine = data[0].semaine || '';
  const quantities = {};

  for (const row of data) {
    if ((row.semaine || '') !== semaine) break;

    const key = buildCommandeKey(row);
    if (!key) continue;

    quantities[key] = Number(row.quantite) || 0;
  }

  const result = {
    semaine,
    quantities,
    rows: data
  };

  console.log('[CMD] loadHistoRemote() result =', result);

  return result;
}


// ------------------------------------------------------------
// Sauvegarde UNE ligne de commande dans la table "commandes"
// Utilise upsert sur : etablissement, reference, fournisseur_id
// ------------------------------------------------------------
async function saveCommandeRemote(produit, quantite, etabId = null) {
  const E = normalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  const q = Number(quantite) || 0;

  const payload = {
    etablissement: E,
    fournisseur_id: produit.fournisseur_id || null,
    fournisseur_nom: produit.fournisseur || null,
    reference: (produit.reference || '').trim(),
    quantite: q,
    updated_at: new Date().toISOString()
  };

  console.log('[CMD] saveCommandeRemote() START');
  console.log('[CMD] produit =', produit);
  console.log('[CMD] quantite demandée =', quantite);
  console.log('[CMD] etabId brut =', etabId);
  console.log('[CMD] etab normalisé =', E);
  console.log('[CMD] payload =', payload);

  const { data, error } = await supabaseClient
    .from('commandes')
    .upsert(payload, { onConflict: 'etablissement,reference,fournisseur_id' })
    .select();

  console.log('[CMD] saveCommandeRemote() RESULT');
  console.log('[CMD] error =', error);
  console.log('[CMD] data =', data);

  if (error) {
    console.error('[CMD] saveCommandeRemote ERROR', error);
    return false;
  }

  console.log('[CMD] saveCommandeRemote() SUCCESS');
  return true;
}


// ------------------------------------------------------------
// Alias de compatibilité
// Ancien nom gardé pour éviter de casser le reste du code
// ------------------------------------------------------------
async function fetchSave(produit, quantite, etabId = null) {
  console.log('[CMD] fetchSave()');
  return saveCommandeRemote(produit, quantite, etabId);
}


// ------------------------------------------------------------
// Alias de compatibilité
// Ancien nom gardé pour éviter de casser le reste du code
// ------------------------------------------------------------
async function doSave(produit, quantite, etabId = null) {
  console.log('[CMD] doSave()');
  return saveCommandeRemote(produit, quantite, etabId);
}


// ------------------------------------------------------------
// Archive la commande courante dans "commandes_historique"
// Lit les lignes actives de "commandes", puis insère un snapshot
// ------------------------------------------------------------
async function archiveCommande(etabId = null, note = '') {
  const E = normalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  console.log('[CMD] archiveCommande() START');
  console.log('[CMD] etab =', E);
  console.log('[CMD] note =', note);

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

  console.log('[CMD] archiveCommande() LECTURE');
  console.log('[CMD] errLecture =', errLecture);
  console.log('[CMD] lignes =', lignes);

  if (errLecture) {
    console.error('[CMD] archiveCommande lecture ERROR', errLecture);
    return false;
  }

  if (!lignes || lignes.length === 0) {
    console.log('[CMD] archiveCommande() aucune ligne à archiver');
    return true;
  }

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

  console.log('[CMD] archiveCommande() snapshot =', snapshot);

  const { data: archiveData, error: errArchive } = await supabaseClient
    .from('commandes_historique')
    .insert(snapshot)
    .select();

  console.log('[CMD] archiveCommande() INSERT RESULT');
  console.log('[CMD] errArchive =', errArchive);
  console.log('[CMD] archiveData =', archiveData);

  if (errArchive) {
    console.error('[CMD] archiveCommande insert ERROR', errArchive);
    return false;
  }

  console.log('[CMD] archiveCommande() SUCCESS');
  return true;
}


// ------------------------------------------------------------
// Supprime toutes les lignes de commande en cours
// pour un établissement donné
// ------------------------------------------------------------
async function clearCommandeRemote(etabId = null) {
  const E = normalizeEtabId(
    etabId || (state?.etab?.id === 'a' ? 'A' : 'B')
  );

  console.log('[CMD] clearCommandeRemote() START');
  console.log('[CMD] etab =', E);

  const { data, error } = await supabaseClient
    .from('commandes')
    .delete()
    .eq('etablissement', E)
    .select();

  console.log('[CMD] clearCommandeRemote() RESULT');
  console.log('[CMD] error =', error);
  console.log('[CMD] data =', data);

  if (error) {
    console.error('[CMD] clearCommandeRemote ERROR', error);
    return false;
  }

  console.log('[CMD] clearCommandeRemote() SUCCESS');
  return true;
}

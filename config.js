// ============================================================
//  CONFIG
// ============================================================

const SUPABASE_URL = 'https://qpbpuadlowlxehzowqfs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mlIAvYSjfX6ggcgt1StNEw_wIkUfh0X';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const CONFIG = {
  // ---- Établissements -------------------------------------
  ETABS: [
    { id: 'a', label: "Pizza d'Oléron", icon: 'Logo_Pizza-oleron.png' },
    { id: 'b', label: 'Le Vesuvio', icon: 'Logo-Vesuvio.png' },
    { id: 'gerant', label: 'Gérant', icon: 'assets/icons/icone-gerant.png' }
  ],

  // ---- Colonnes conservées pour compatibilité front -------
  COLS: {
    fournisseur: 'Fournisseur',
    ordre_fournisseur: 'ordre_fournisseur',
    reference: 'Référence',
    designation: 'Désignation Produit',
    tva: 'TVA (%)',
    prix_ht: 'P.U. HT',
    droit_alcool: 'DROIT ALCOOL',
    taxe_secu: 'TAXE SECURITE SOCIALE',
    nom_court: 'Nom Court',
    categorie: 'Catégorie',
    ordre_categorie: 'ordre_categorie',
    colissage: 'colissage',
    prix_colis: 'prix_colis',
    actif: 'actif',
    etablissement: 'etablissement'
  },

  // ---- Colonnes fournisseurs conservées -------------------
  COLS_F: {
    nom: 'nom',
    telephone: 'telephone',
    contact: 'contact',
    jour_saison: 'jour_appel saison',
    jour_hors_saison: 'jour_appel hors saison',
    notes: 'notes'
  },

  // ---- Saison (mois 1=jan … 12=dec) -----------------------
  MOIS_SAISON: [4, 5, 6, 7, 8, 9, 10]
};

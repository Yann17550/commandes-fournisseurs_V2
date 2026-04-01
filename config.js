// ============================================================
//  CONFIG — à modifier selon vos besoins
// ============================================================
const CONFIG = {

  // ---- Établissements -------------------------------------
  ETABS: [
    { id: 'a', label: "Pizza d'Oléron",  icon: '🍕' },
    { id: 'b', label: 'Le Vesuvio',      icon: '🌋' },
    { id: 'gerant', label: 'Gérant',     icon: '👔' },
  ],

  // ---- Google Sheets (URLs publiées en TSV) ---------------
  SHEETS: {
    produits:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5BG2CIzft1vqqSf01koQxj9rvGsyfckUmV-BH9HE5lAwprxS8V_uPQyKdG7DJYEiazvNs5NQRmNZa/pub?gid=0&single=true&output=tsv',
    fournisseurs: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5BG2CIzft1vqqSf01koQxj9rvGsyfckUmV-BH9HE5lAwprxS8V_uPQyKdG7DJYEiazvNs5NQRmNZa/pub?gid=1147908682&single=true&output=tsv',
  },

  // ---- Apps Script (après déploiement) --------------------
  // Laissez '' tant que vous n'avez pas déployé le script
  APPS_SCRIPT_URL: '',

  // ---- Colonnes feuille produits --------------------------
  COLS: {
    fournisseur:    'Fournisseur',
    reference:      'Référence',
    designation:    'Désignation Produit',
    tva:            'TVA (%)',
    prix_ht:        'P.U. HT',
    droit_alcool:   'DROIT ALCOOL',
    taxe_secu:      'TAXE SECURITE SOCIALE',
    nom_court:      'Nom Court',
    categorie:      'Catégorie',
    colissage:      'colissage',
    prix_colis:     'prix_colis',
    actif:          'actif',
    etablissement:  'etablissement',   // 'A', 'B', 'AB' ou vide = les deux
  },

  // ---- Colonnes feuille fournisseurs ----------------------
  COLS_F: {
    nom:              'nom',
    telephone:        'telephone',
    contact:          'contact',
    jour_saison:      'jour_appel saison',
    jour_hors_saison: 'jour_appel hors saison',
    notes:            'notes',
  },

  // ---- Saison (mois 1=jan … 12=dec) ----------------------
  MOIS_SAISON: [4, 5, 6, 7, 8, 9, 10],
};

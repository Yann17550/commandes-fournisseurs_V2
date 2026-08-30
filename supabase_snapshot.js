// ============================================================
//  SUPABASE SNAPSHOT
//  Lecture brute de l'état Supabase à l'instant T
//  ------------------------------------------------------------
//  Rôle de ce fichier :
//  - interroger directement Supabase ;
//  - lire les tables nécessaires à l'application ;
//  - retourner un objet snapshot brut, sans traitement métier ;
//  - ne pas dépendre de state, de render, ni d'autres modules UI.
//
//  IMPORTANT
//  - Aucun calcul métier ici.
//  - Aucun regroupement fournisseur ici.
//  - Aucun filtrage de type "quantite > 0" ici.
//  - Aucune normalisation "front" ici.
//  - Aucune mise à jour de state ici.
//
//  Dépendance attendue : window.supabaseClient
// ============================================================

(function attachSupabaseSnapshotModule(global) {
  'use strict';

  /**
   * Vérifie la disponibilité du client Supabase global.
   */
  function sbSnapshotGetClient() {
    const client = global.supabaseClient;

    if (!client) {
      throw new Error('window.supabaseClient est introuvable');
    }

    return client;
  }

  /**
   * Horodatage ISO du snapshot.
   */
  function sbSnapshotNowIso() {
    return new Date().toISOString();
  }

  /**
   * Exécute une lecture brute de table Supabase.
   *
   * @param {object} query - Requête Supabase déjà construite.
   * @returns {Promise<{ data: any[]|null, error: object|null }>}
   */
  async function sbSnapshotRun(query) {
    const { data, error } = await query;
    return {
      data: data || null,
      error: error || null
    };
  }

  /**
   * Lit la table produits avec la relation fournisseurs.
   *
   * IMPORTANT :
   * - aucune transformation ;
   * - on récupère brut ce que Supabase renvoie ;
   * - pas de mapping vers la structure front.
   */
  async function sbSnapshotFetchProduits() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('produits')
        .select(`
          id,
          reference,
          designation_produit,
          designation_fournisseur,
          nom_court,
          categorie,
          ordre_cat,
          tva,
          prix_unitaire_ht,
          colisage,
          prix_colis,
          droit_alcool,
          taxe_securite_sociale,
          actif,
          fournisseurs (
            id,
            nom,
            telephone,
            contact,
            jour_appel_saison,
            jour_appel_hors_saison,
            notes,
            ordre,
            actif
          )
        `)
    );
  }

  /**
   * Lit la table fournisseurs.
   *
   * On récupère toutes les colonnes actuellement utiles au périmètre connu.
   * Aucun tri métier n'est appliqué ici.
   */
  async function sbSnapshotFetchFournisseurs() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('fournisseurs')
        .select(`
          id,
          nom,
          telephone,
          contact,
          jour_appel_saison,
          jour_appel_hors_saison,
          notes,
          ordre,
          actif
        `)
    );
  }

  /**
   * Lit la table commandes sans filtrage métier.
   *
   * On remonte l'état brut des commandes à l'instant T :
   * - y compris les quantités nulles si elles existent en base ;
   * - tous les établissements présents ;
   * - sans réduction, sans agrégation.
   */
  async function sbSnapshotFetchCommandes() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('commandes')
        .select(`
          id,
          etablissement,
          produit_id,
          fournisseur_id,
          fournisseur_nom,
          reference,
          quantite,
          updated_at
        `)
    );
  }

  /**
   * Lit la table commandes_historique sans filtrage métier.
   *
   * Cette lecture brute permet une réutilisation future pour
   * d'autres écrans ou traitements sans devoir refaire le backend.
   */
  async function sbSnapshotFetchCommandesHistorique() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('commandes_historique')
        .select(`
          id,
          etablissement,
          produit_id,
          fournisseur_id,
          fournisseur_nom,
          reference,
          quantite,
          semaine,
          note,
          archive_at
        `)
    );
  }

  /**
   * Construit le snapshot brut global.
   *
   * Structure :
   * - fetched_at : date/heure de la capture ;
   * - ok : booléen global ;
   * - tables : résultats bruts par table ;
   * - errors : erreurs brutes par table ;
   *
   * Aucun traitement métier n'est appliqué.
   */
  async function sbSnapshotLoadNow() {
    const fetched_at = sbSnapshotNowIso();

    const [
      produitsResult,
      fournisseursResult,
      commandesResult,
      commandesHistoriqueResult
    ] = await Promise.all([
      sbSnapshotFetchProduits(),
      sbSnapshotFetchFournisseurs(),
      sbSnapshotFetchCommandes(),
      sbSnapshotFetchCommandesHistorique()
    ]);

    const snapshot = {
      fetched_at,
      ok: !(
        produitsResult.error ||
        fournisseursResult.error ||
        commandesResult.error ||
        commandesHistoriqueResult.error
      ),
      tables: {
        produits: produitsResult.data,
        fournisseurs: fournisseursResult.data,
        commandes: commandesResult.data,
        commandes_historique: commandesHistoriqueResult.data
      },
      errors: {
        produits: produitsResult.error,
        fournisseurs: fournisseursResult.error,
        commandes: commandesResult.error,
        commandes_historique: commandesHistoriqueResult.error
      }
    };

    return snapshot;
  }

  /**
   * Version stricte :
   * lève une erreur si au moins une lecture Supabase échoue.
   *
   * Utile si l'écran appelant veut stopper immédiatement le flux.
   */
  async function sbSnapshotLoadNowStrict() {
    const snapshot = await sbSnapshotLoadNow();

    if (!snapshot.ok) {
      const parts = [];

      if (snapshot.errors.produits) {
        parts.push('produits: ' + (snapshot.errors.produits.message || 'erreur inconnue'));
      }

      if (snapshot.errors.fournisseurs) {
        parts.push('fournisseurs: ' + (snapshot.errors.fournisseurs.message || 'erreur inconnue'));
      }

      if (snapshot.errors.commandes) {
        parts.push('commandes: ' + (snapshot.errors.commandes.message || 'erreur inconnue'));
      }

      if (snapshot.errors.commandes_historique) {
        parts.push(
          'commandes_historique: ' +
          (snapshot.errors.commandes_historique.message || 'erreur inconnue')
        );
      }

      throw new Error('Erreur snapshot Supabase — ' + parts.join(' | '));
    }

    return snapshot;
  }

  /**
   * Exposition globale volontairement simple.
   *
   * Exemple d'usage futur :
   *   const snapshot = await window.sbSnapshotLoadNowStrict();
   */
  global.sbSnapshotLoadNow = sbSnapshotLoadNow;
  global.sbSnapshotLoadNowStrict = sbSnapshotLoadNowStrict;

})(window);

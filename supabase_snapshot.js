// ============================================================
//  SUPABASE SNAPSHOT
//  ------------------------------------------------------------
//  Ce fichier a une seule responsabilité :
//  récupérer l'état brut de Supabase à l'instant T.
//
//  Il ne doit jamais :
//  - filtrer les commandes ;
//  - calculer des montants ;
//  - regrouper par fournisseur ;
//  - transformer les lignes pour le front ;
//  - écrire dans state ;
//  - appeler render().
//
//  Il est volontairement réutilisable par d'autres fonctionnalités
//  de l'application, au-delà de "Commandes fournisseurs".
// ============================================================

(function attachSupabaseSnapshotModule(global) {
  'use strict';

  function sbSnapshotGetClient() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      throw new Error('supabaseClient est introuvable');
    }

    return supabaseClient;
  }

  function sbSnapshotNowIso() {
    return new Date().toISOString();
  }

  async function sbSnapshotRun(query) {
    const { data, error } = await query;

    return {
      data: data || null,
      error: error || null
    };
  }

  async function sbSnapshotFetchProduits() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('produits')
        .select(`
          id,
          fournisseur_id,
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
          created_at,
          updated_at,
          type_unite,
          fournisseurs (
            id,
            nom,
            telephone,
            contact,
            jour_appel_saison,
            jour_appel_hors_saison,
            notes,
            ordre,
            actif,
            created_at
          )
        `)
    );
  }

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
          actif,
          created_at
        `)
    );
  }

  async function sbSnapshotFetchCommandes() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('commandes')
        .select(`
          id,
          etablissement,
          fournisseur_id,
          produit_id,
          reference,
          quantite,
          updated_at,
          fournisseur_nom
        `)
    );
  }

  async function sbSnapshotFetchCommandesHistorique() {
    const client = sbSnapshotGetClient();

    return sbSnapshotRun(
      client
        .from('commandes_historique')
        .select(`
          id,
          etablissement,
          fournisseur_id,
          produit_id,
          reference,
          quantite,
          archive_at,
          semaine,
          note,
          fournisseur_nom
        `)
    );
  }

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

    return {
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
  }

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

  global.sbSnapshotLoadNow = sbSnapshotLoadNow;
  global.sbSnapshotLoadNowStrict = sbSnapshotLoadNowStrict;

})(window);

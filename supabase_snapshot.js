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

  /**
   * Retourne le client Supabase déjà déclaré dans config.js.
   *
   * IMPORTANT :
   * Dans ce projet, le client est défini ainsi :
   *   const supabaseClient = window.supabase.createClient(...)
   *
   * On utilise donc directement l'identifiant global "supabaseClient",
   * sans supposer qu'il existe sous "window.supabaseClient".
   */
  function sbSnapshotGetClient() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      throw new Error('supabaseClient est introuvable');
    }

    return supabaseClient;
  }

  /**
   * Renvoie l'horodatage ISO du snapshot.
   * Cet horodatage représente le moment exact de la lecture.
   */
  function sbSnapshotNowIso() {
    return new Date().toISOString();
  }

  /**
   * Exécute une requête Supabase et retourne un objet normalisé
   * minimal contenant seulement :
   * - data
   * - error
   *
   * IMPORTANT :
   * Ce n'est pas un traitement métier.
   * C'est seulement un emballage technique minimal pour homogénéiser
   * les retours de lecture.
   */
  async function sbSnapshotRun(query) {
    const { data, error } = await query;

    return {
      data: data || null,
      error: error || null
    };
  }

  /**
   * Lit la table "produits" avec sa relation "fournisseurs".
   *
   * Aucune transformation n'est faite ici :
   * on récupère seulement les colonnes brutes nécessaires à l'application.
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
   * Lit la table "fournisseurs".
   *
   * Même si certaines colonnes existent déjà via la relation imbriquée
   * de "produits", on garde cette lecture brute séparée pour avoir
   * une image complète et indépendante de la table.
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
   * Lit la table "commandes" telle qu'elle existe au moment de la lecture.
   *
   * IMPORTANT :
   * - aucune exclusion des quantités nulles ;
   * - aucun filtrage par établissement ;
   * - aucun filtrage fonctionnel.
   *
   * On retourne la photographie brute de l'état courant.
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
   * Lit la table "commandes_historique" sans filtre.
   *
   * Cette table n'est peut-être pas utilisée immédiatement par le module
   * SMS fournisseurs, mais elle fait partie du snapshot global voulu,
   * justement pour une réutilisation future.
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
   * Exécute toutes les lectures Supabase en parallèle et retourne
   * un snapshot global brut.
   *
   * Structure retournée :
   * {
   *   fetched_at,
   *   ok,
   *   tables: {
   *     produits,
   *     fournisseurs,
   *     commandes,
   *     commandes_historique
   *   },
   *   errors: {
   *     produits,
   *     fournisseurs,
   *     commandes,
   *     commandes_historique
   *   }
   * }
   *
   * IMPORTANT :
   * "ok" indique seulement si toutes les lectures se sont bien passées.
   * Ce n'est pas une validation métier.
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

  /**
   * Variante stricte du snapshot.
   *
   * Si au moins une lecture échoue, on lève une erreur explicite.
   * C'est utile pour les écrans qui doivent s'arrêter immédiatement
   * en cas de lecture incomplète.
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

  // ----------------------------------------------------------
  //  API globale exposée au reste de l'application
  // ----------------------------------------------------------
  global.sbSnapshotLoadNow = sbSnapshotLoadNow;
  global.sbSnapshotLoadNowStrict = sbSnapshotLoadNowStrict;

})(window);

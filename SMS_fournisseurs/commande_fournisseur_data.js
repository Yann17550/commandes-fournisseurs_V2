// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_DATA
//  ------------------------------------------------------------
//  Rôle de ce fichier :
//  - consommer un snapshot Supabase brut ;
//  - reconstruire des index de travail minimaux ;
//  - trouver les fournisseurs ayant des commandes non nulles ;
//  - calculer leur montant global à l'instant T.
//
//  IMPORTANT
//  - Ce fichier ne lit pas Supabase directement.
//  - Ce fichier ne gère pas le rendu HTML.
//  - Ce fichier ne construit pas le SMS.
//  - Ce fichier ne déclenche pas l'envoi.
//
//  Entrée attendue : snapshot brut renvoyé par sbSnapshotLoadNow()
// ============================================================

(function attachCommandeFournisseurDataModule(global) {
  'use strict';

  /**
   * Vérifie la structure minimale du snapshot brut.
   */
  function cfDataAssertSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Snapshot invalide : objet attendu');
    }

    if (!snapshot.tables || typeof snapshot.tables !== 'object') {
      throw new Error('Snapshot invalide : tables absentes');
    }
  }

  /**
   * Sécurise un tableau issu du snapshot.
   */
  function cfDataArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * Convertit une valeur en nombre.
   */
  function cfDataNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Nettoie une chaîne.
   */
  function cfDataStr(value) {
    return String(value || '').trim();
  }

  /**
   * Construit la clé fonctionnelle utilisée pour rapprocher
   * commandes et produits : "Nom fournisseur|Reference"
   *
   * Cette clé est calculée ici parce qu'on est maintenant
   * dans le fichier de traitement métier, pas dans le snapshot.
   */
  function cfBuildCommandeKeyFromProduitRow(produitRow) {
    const fournisseurNom = cfDataStr(
      produitRow?.fournisseurs?.nom ||
      produitRow?.fournisseur_nom ||
      produitRow?.fournisseur
    );

    const reference = cfDataStr(produitRow?.reference);

    if (!fournisseurNom || !reference) return null;
    return fournisseurNom + '|' + reference;
  }

  /**
   * Construit la clé fonctionnelle à partir d'une ligne commande brute.
   */
  function cfBuildCommandeKeyFromCommandeRow(commandeRow) {
    const fournisseurNom = cfDataStr(commandeRow?.fournisseur_nom);
    const reference = cfDataStr(commandeRow?.reference);

    if (!fournisseurNom || !reference) return null;
    return fournisseurNom + '|' + reference;
  }

  /**
   * Indexe les produits par clé fournisseur|référence.
   *
   * On garde ici la ligne produit brute complète pour permettre
   * d'autres traitements ultérieurs dans les autres modules.
   */
  function cfBuildProduitsIndex(snapshot) {
    cfDataAssertSnapshot(snapshot);

    const produits = cfDataArray(snapshot.tables.produits);
    const map = new Map();

    produits.forEach(row => {
      const key = cfBuildCommandeKeyFromProduitRow(row);
      if (!key) return;
      map.set(key, row);
    });

    return map;
  }

  /**
   * Retourne uniquement les lignes de commandes ayant une quantité non nulle.
   *
   * Règle métier ici :
   * - quantité > 0 retenue ;
   * - quantité <= 0 ignorée.
   *
   * Le snapshot, lui, n'applique aucun filtre.
   */
  function cfGetActiveCommandeRows(snapshot) {
    cfDataAssertSnapshot(snapshot);

    const commandes = cfDataArray(snapshot.tables.commandes);

    return commandes.filter(row => cfDataNum(row?.quantite) > 0);
  }

  /**
   * Retourne les commandes actives d'un établissement donné.
   *
   * etablissement attendu : "A", "B", etc.
   */
  function cfGetActiveCommandeRowsByEtab(snapshot, etablissement) {
    const wanted = cfDataStr(etablissement).toUpperCase();

    return cfGetActiveCommandeRows(snapshot).filter(row => {
      return cfDataStr(row?.etablissement).toUpperCase() === wanted;
    });
  }

  /**
   * Construit une map clé -> quantité pour un établissement donné.
   *
   * Si plusieurs lignes existent pour la même clé, on additionne.
   */
  function cfBuildQuantitiesMapForEtab(snapshot, etablissement) {
    const rows = cfGetActiveCommandeRowsByEtab(snapshot, etablissement);
    const map = new Map();

    rows.forEach(row => {
      const key = cfBuildCommandeKeyFromCommandeRow(row);
      if (!key) return;

      const qty = cfDataNum(row?.quantite);
      const prev = map.get(key) || 0;

      map.set(key, prev + qty);
    });

    return map;
  }

  /**
   * Détermine le prix colis à utiliser pour un produit brut.
   *
   * Priorité métier actuelle :
   * - prix_colis si renseigné et > 0
   * - sinon prix_unitaire_ht * colisage
   */
  function cfGetPrixColisFromProduitRow(produitRow) {
    const prixColis = cfDataNum(produitRow?.prix_colis);
    if (prixColis > 0) return prixColis;

    const prixUnitaire = cfDataNum(produitRow?.prix_unitaire_ht);
    const colisage = cfDataNum(produitRow?.colisage) || 1;

    return prixUnitaire * colisage;
  }

  /**
   * Calcule la liste des fournisseurs ayant un total non nul.
   *
   * Sortie :
   * [
   *   {
   *     nom,
   *     fournisseur_id,
   *     ordre,
   *     montant,
   *     total_quantite,
   *     nb_lignes,
   *     telephones,
   *     contacts
   *   }
   * ]
   */
  function cfBuildSupplierRows(snapshot) {
    cfDataAssertSnapshot(snapshot);

    const produitsIndex = cfBuildProduitsIndex(snapshot);
    const quantitiesA = cfBuildQuantitiesMapForEtab(snapshot, 'A');
    const quantitiesB = cfBuildQuantitiesMapForEtab(snapshot, 'B');

    const supplierMap = new Map();

    const allKeys = new Set([
      ...quantitiesA.keys(),
      ...quantitiesB.keys()
    ]);

    allKeys.forEach(key => {
      const produitRow = produitsIndex.get(key);
      if (!produitRow) return;

      const qa = quantitiesA.get(key) || 0;
      const qb = quantitiesB.get(key) || 0;
      const totalQty = qa + qb;

      if (totalQty <= 0) return;

      const fournisseurNom = cfDataStr(
        produitRow?.fournisseurs?.nom ||
        produitRow?.fournisseur_nom ||
        produitRow?.fournisseur
      );

      if (!fournisseurNom) return;

      const fournisseurId = produitRow?.fournisseurs?.id ?? null;
      const ordre = cfDataNum(produitRow?.fournisseurs?.ordre) || 999;
      const prixColis = cfGetPrixColisFromProduitRow(produitRow);
      const montantLigne = totalQty * prixColis;

      if (montantLigne <= 0) return;

      if (!supplierMap.has(fournisseurNom)) {
        supplierMap.set(fournisseurNom, {
          nom: fournisseurNom,
          fournisseur_id: fournisseurId,
          ordre,
          montant: 0,
          total_quantite: 0,
          nb_lignes: 0,
          telephones: new Set(),
          contacts: new Set()
        });
      }

      const supplier = supplierMap.get(fournisseurNom);

      supplier.ordre = Math.min(supplier.ordre, ordre);
      supplier.montant += montantLigne;
      supplier.total_quantite += totalQty;
      supplier.nb_lignes += 1;

      const tel = cfDataStr(produitRow?.fournisseurs?.telephone);
      const contact = cfDataStr(produitRow?.fournisseurs?.contact);

      if (tel) supplier.telephones.add(tel);
      if (contact) supplier.contacts.add(contact);
    });

    return Array.from(supplierMap.values())
      .map(row => ({
        nom: row.nom,
        fournisseur_id: row.fournisseur_id,
        ordre: row.ordre,
        montant: row.montant,
        total_quantite: row.total_quantite,
        nb_lignes: row.nb_lignes,
        telephones: Array.from(row.telephones),
        contacts: Array.from(row.contacts)
      }))
      .sort((a, b) => {
        if (a.ordre !== b.ordre) return a.ordre - b.ordre;
        return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      });
  }

  /**
   * Retourne une structure complète de travail pour l'écran
   * "Commandes fournisseurs".
   *
   * Cette fonction prépare :
   * - les index produits ;
   * - les quantités A/B ;
   * - la liste fournisseurs.
   *
   * Elle ne fait toujours ni HTML, ni SMS, ni navigation.
   */
  function cfBuildSupplierDataModel(snapshot) {
    cfDataAssertSnapshot(snapshot);

    return {
      fetched_at: snapshot.fetched_at || null,
      produits_index: cfBuildProduitsIndex(snapshot),
      quantities_a: cfBuildQuantitiesMapForEtab(snapshot, 'A'),
      quantities_b: cfBuildQuantitiesMapForEtab(snapshot, 'B'),
      suppliers: cfBuildSupplierRows(snapshot)
    };
  }

  // ------------------------------------------------------------
  // Exposition globale
  // ------------------------------------------------------------
  global.cfGetActiveCommandeRows = cfGetActiveCommandeRows;
  global.cfGetActiveCommandeRowsByEtab = cfGetActiveCommandeRowsByEtab;
  global.cfBuildQuantitiesMapForEtab = cfBuildQuantitiesMapForEtab;
  global.cfBuildSupplierRows = cfBuildSupplierRows;
  global.cfBuildSupplierDataModel = cfBuildSupplierDataModel;

})(window);

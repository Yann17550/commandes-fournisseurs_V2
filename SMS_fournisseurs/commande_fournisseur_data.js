// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_DATA
//  ------------------------------------------------------------
//  Ce fichier construit le modèle métier à partir du snapshot
//  brut Supabase.
//
//  Responsabilités :
//  - indexer les produits ;
//  - indexer les fournisseurs ;
//  - construire les maps de quantités par établissement ;
//  - calculer les montants par fournisseur ;
//  - ne jamais interroger Supabase directement.
// ============================================================

(function attachCommandeFournisseurDataModule(global) {
  'use strict';

  function cfDataStr(value) {
    return String(value || '').trim();
  }

  function cfDataNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function cfDataBuildProduitsIndex(produitsRows) {
    const index = new Map();

    if (!Array.isArray(produitsRows)) {
      return index;
    }

    produitsRows.forEach(row => {
      const ref = cfDataStr(row.reference);
      if (!ref) return;

      const nomCourt = cfDataStr(row.nom_court || '');
      const designation = cfDataStr(row.designation_produit || '');
      const categorie = cfDataStr(row.categorie || '');
      const typeUnite = cfDataStr(row.type_unite || '');
      const colisage = cfDataNum(row.colisage);
      const prixUnitaire = cfDataNum(row.prix_unitaire_ht);
      const prixColis = cfDataNum(row.prix_colis);
      const actif = !!row.actif;

      const fournisseurRow = row.fournisseurs;
      const fournisseurNom = cfDataStr(
        fournisseurRow?.nom || row.fournisseur_nom || ''
      );

      index.set(ref, {
        reference: ref,
        nom_court: nomCourt,
        designation_produit: designation,
        categorie: categorie,
        type_unite: typeUnite,
        colisage: colisage,
        prix_unitaire_ht: prixUnitaire,
        prix_colis: prixColis,
        actif: actif,
        fournisseur_nom: fournisseurNom,
        fournisseurs: fournisseurRow || null
      });
    });

    return index;
  }

  function cfDataBuildFournisseursIndex(fournisseursRows) {
    const index = new Map();

    if (!Array.isArray(fournisseursRows)) {
      return index;
    }

    fournisseursRows.forEach(row => {
      const nom = cfDataStr(row.nom);
      if (!nom) return;

      const telephone = cfDataStr(row.telephone || '');
      const contact = cfDataStr(row.contact || '');
      const jourSaison = cfDataStr(row.jour_appel_saison || '');
      const jourHorsSaison = cfDataStr(row.jour_appel_hors_saison || '');
      const notes = cfDataStr(row.notes || '');
      const ordre = cfDataNum(row.ordre);
      const actif = !!row.actif;

      index.set(nom, {
        nom: nom,
        telephone: telephone,
        contact: contact,
        jour_appel_saison: jourSaison,
        jour_appel_hors_saison: jourHorsSaison,
        notes: notes,
        ordre: ordre,
        actif: actif
      });
    });

    return index;
  }

  function cfDataBuildQuantitiesMap(commandesRows, etab, produitsIndex) {
    const map = new Map();

    if (!Array.isArray(commandesRows)) {
      return map;
    }

    commandesRows.forEach(row => {
      const etabRow = cfDataStr(row.etablissement);
      const ref = cfDataStr(row.reference);
      const qty = cfDataNum(row.quantite);

      if (etabRow !== etab) return;
      if (!ref) return;

      const produit = produitsIndex.get(ref);
      if (!produit) return;

      map.set(ref, (map.get(ref) || 0) + qty);
    });

    return map;
  }

  function cfDataBuildSupplierDataModel(snapshot) {
    const produitsRows = snapshot?.tables?.produits || [];
    const fournisseursRows = snapshot?.tables?.fournisseurs || [];
    const commandesRows = snapshot?.tables?.commandes || [];

    const produitsIndex = cfDataBuildProduitsIndex(produitsRows);
    const fournisseursIndex = cfDataBuildFournisseursIndex(fournisseursRows);

    const quantitiesA = cfDataBuildQuantitiesMap(commandesRows, 'A', produitsIndex);
    const quantitiesB = cfDataBuildQuantitiesMap(commandesRows, 'B', produitsIndex);

    const supplierAmounts = new Map();

    quantitiesA.forEach((qty, ref) => {
      const produit = produitsIndex.get(ref);
      if (!produit) return;

      const supplierName = produit.fournisseur_nom;
      if (!supplierName) return;

      const prixColis = produit.prix_colis || 0;
      const amount = prixColis * qty;

      supplierAmounts.set(
        supplierName,
        (supplierAmounts.get(supplierName) || 0) + amount
      );
    });

    quantitiesB.forEach((qty, ref) => {
      const produit = produitsIndex.get(ref);
      if (!produit) return;

      const supplierName = produit.fournisseur_nom;
      if (!supplierName) return;

      const prixColis = produit.prix_colis || 0;
      const amount = prixColis * qty;

      supplierAmounts.set(
        supplierName,
        (supplierAmounts.get(supplierName) || 0) + amount
      );
    });

    const suppliers = Array.from(fournisseursIndex.values())
      .filter(s => supplierAmounts.has(s.nom))
      .map(s => ({
        ...s,
        montant: supplierAmounts.get(s.nom)
      }))
      .sort((a, b) => {
        if (a.ordre !== b.ordre) return a.ordre - b.ordre;
        return a.nom.localeCompare(b.nom);
      });

    return {
      produits_index: produitsIndex,
      fournisseurs_index: fournisseursIndex,
      quantities_a: quantitiesA,
      quantities_b: quantitiesB,
      suppliers: suppliers
    };
  }

  global.cfBuildSupplierDataModel = cfDataBuildSupplierDataModel;

})(window);

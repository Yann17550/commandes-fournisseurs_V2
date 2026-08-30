// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_SEND
//  ------------------------------------------------------------
//  Rôle de ce fichier :
//  - préparer l'envoi d'un SMS pour un fournisseur donné ;
//  - ouvrir l'application SMS du téléphone avec le message
//    pré-rempli (numéro + corps) ;
//  - ne jamais envoyer automatiquement le SMS côté serveur.
//
//  IMPORTANT
//  - Aucun envoi automatique ici.
//  - Aucun appel API SMS / backend ici.
//  - L'utilisateur garde toujours la dernière action :
//    il valide lui-même l'envoi dans son appli SMS.
//
//  Entrée attendue :
//  {
//    supplierName,
//    smsText,
//    tel
//  }
// ============================================================

(function attachCommandeFournisseurSendModule(global) {
  'use strict';

  // ------------------------------------------------------------
  //  Helpers internes
  // ------------------------------------------------------------
  function cfSendStr(value) {
    return String(value || '').trim();
  }

  function cfSendNormalizePhone(phoneRaw) {
    const phone = cfSendStr(phoneRaw);
    if (!phone) return '';

    return phone.replace(/[^\d+]/g, '');
  }

  // ------------------------------------------------------------
  //  Action d'envoi (via appli SMS native)
  // ------------------------------------------------------------
  function cfSendSupplierSms(payload) {
    const {
      supplierName,
      smsText,
      tel
    } = payload || {};

    const normalizedTel = cfSendNormalizePhone(tel);
    const body = cfSendStr(smsText);

    if (!body) {
      console.warn('cfSendSupplierSms: corps du message vide');
      return;
    }

    let url;

    if (normalizedTel) {
      url = `sms:${encodeURIComponent(normalizedTel)}?body=${encodeURIComponent(body)}`;
    } else {
      url = `sms:?body=${encodeURIComponent(body)}`;
    }

    // Ouverture de l'application SMS native.
    // L'utilisateur doit valider lui-même l'envoi.
    global.location.href = url;
  }

  // ------------------------------------------------------------
  //  Exposition globale
  // ------------------------------------------------------------
  global.cfSendSupplierSms = cfSendSupplierSms;

})(window);

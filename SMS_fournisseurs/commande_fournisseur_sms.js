// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_SMS
//  ------------------------------------------------------------
//  Rôle de ce fichier :
//  - construire le texte SMS pour un fournisseur donné ;
//  - afficher l'écran de détail SMS (boutons Copier / SMS) ;
//  - transmettre les données au module d'envoi.
//
//  IMPORTANT
//  - Aucun accès direct à Supabase ici.
//  - Aucun envoi SMS ici.
//  - Aucun couplage avec loadData() / loadDataCore() ici.
//
//  Format SMS attendu (métier) :
//  - destinataire : prénom du contact (fournisseur.contact) ;
//  - date de livraison prévue ;
//  - lignes par établissement :
//      quantité + type_unite + nom_court + " - Ref: " + reference
//  - fin : remerciement et salutation.
//
//  Entrée attendue :
//  {
//    supplierName,
//    snapshot,
//    model,
//    onBack
//  }
// ============================================================

(function attachCommandeFournisseurSmsModule(global) {
  'use strict';

  // ------------------------------------------------------------
  //  Helpers internes
  // ------------------------------------------------------------
  function cfSmsGetListRoot() {
    return global.$ ? global.$('supplierOrdersList') : null;
  }

  function cfSmsMustHaveDependencies() {
    if (typeof global.$ !== 'function') {
      throw new Error('Helper DOM $ introuvable');
    }
  }

  function cfSmsEsc(value) {
    if (typeof global.escHtml === 'function') {
      return global.escHtml(value);
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cfSmsShowToast(message) {
    if (typeof global.showToast === 'function') {
      global.showToast(message);
    }
  }

  function cfSmsStr(value) {
    return String(value || '').trim();
  }

  function cfSmsNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // ------------------------------------------------------------
  //  Construction du message SMS
  // ------------------------------------------------------------
  function cfSmsGetContactFirstName(contactRaw) {
    const contact = cfSmsStr(contactRaw);
    if (!contact) return '';

    const parts = contact.split(/\s+/);
    return parts[0] || '';
  }

  function cfSmsGetExpectedDeliveryDate() {
    const now = new Date();

    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    };

    return now.toLocaleDateString('fr-FR', options);
  }

  function cfSmsBuildLinesForEtab(supplierName, quantitiesMap, produitsIndex, etabLabel) {
    const lines = [];

    quantitiesMap.forEach((qty, key) => {
      if (qty <= 0) return;

      const produitRow = produitsIndex.get(key);
      if (!produitRow) return;

      const fournisseurNom = cfSmsStr(
        produitRow?.fournisseurs?.nom ||
        produitRow?.fournisseur_nom ||
        produitRow?.fournisseur
      );

      if (fournisseurNom !== supplierName) return;

      const typeUnite = cfSmsStr(produitRow?.type_unite || '');
      const nomCourt = cfSmsStr(produitRow?.nom_court || '');
      const reference = cfSmsStr(produitRow?.reference || '');

      const typePart = typeUnite ? ` ${typeUnite}` : '';

      lines.push(
        `${qty}${typePart} ${nomCourt} - Ref: ${reference}`
      );
    });

    return lines;
  }

  function cfSmsBuildSmsText(supplierName, model) {
    const produitsIndex = model?.produits_index || new Map();
    const quantitiesA = model?.quantities_a || new Map();
    const quantitiesB = model?.quantities_b || new Map();

    const supplierRow = (model?.suppliers || []).find(
      s => s.nom === supplierName
    );

    const contact = supplierRow?.contacts?.[0] || '';
    const firstName = cfSmsGetContactFirstName(contact);
    const deliveryDate = cfSmsGetExpectedDeliveryDate();

    const linesA = cfSmsBuildLinesForEtab(supplierName, quantitiesA, produitsIndex, 'A');
    const linesB = cfSmsBuildLinesForEtab(supplierName, quantitiesB, produitsIndex, 'B');

    let out = `Bonjour ${firstName},\n`;

    if (deliveryDate) {
      out += `Livraison prévue le ${deliveryDate}.\n`;
    }

    out += `Voici ma commande :\n`;

    if (linesA.length) {
      out += `\nPizza d'Oléron\n`;
      out += linesA.join('\n') + '\n';
    }

    if (linesB.length) {
      out += `\nLe Vesuvio\n`;
      out += linesB.join('\n') + '\n';
    }

    out += `\nMerci et bonne journée.`;

    return out.trim();
  }

  function cfSmsGetSupplierPhone(supplierName, model) {
    const supplierRow = (model?.suppliers || []).find(
      s => s.nom === supplierName
    );

    const tel = supplierRow?.telephones?.[0] || '';
    return cfSmsStr(tel);
  }

  // ------------------------------------------------------------
  //  Rendu écran SMS
  // ------------------------------------------------------------
  function cfRenderSupplierSmsView(payload) {
    cfSmsMustHaveDependencies();

    const {
      supplierName,
      snapshot,
      model,
      onBack
    } = payload || {};

    if (!supplierName || !snapshot || !model) {
      throw new Error('Paramètres invalides pour cfRenderSupplierSmsView');
    }

    const root = cfSmsGetListRoot();
    if (!root) return;

    const smsText = cfSmsBuildSmsText(supplierName, model);
    const tel = cfSmsGetSupplierPhone(supplierName, model);

    root.innerHTML = `
      <div class="supplier-order-detail">
        <button type="button" class="etab-back-btn" id="backToSupplierOrdersListBtn">← Retour à la liste</button>
        <h2 class="etab-title">${cfSmsEsc(supplierName)}</h2>

        <div class="supplier-sms-actions">
          <button type="button" class="copy-btn" id="copySupplierSmsBtn">Copier</button>
          <button type="button" class="copy-btn" id="sendSupplierSmsBtn">SMS</button>
        </div>

        <pre class="supplier-sms-preview">${cfSmsEsc(smsText)}</pre>
      </div>
    `;

    const backBtn = global.$('backToSupplierOrdersListBtn');
    const copyBtn = global.$('copySupplierSmsBtn');
    const sendBtn = global.$('sendSupplierSmsBtn');

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (typeof onBack === 'function') {
          onBack();
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(smsText);
          cfSmsShowToast('📋 Copié');
        } catch (err) {
          console.error('copySupplierSmsBtn', err);
          cfSmsShowToast('Erreur copie');
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (typeof global.cfSendSupplierSms === 'function') {
          global.cfSendSupplierSms({
            supplierName,
            smsText,
            tel
          });
        } else {
          const url = tel
            ? `sms:${encodeURIComponent(tel)}?body=${encodeURIComponent(smsText)}`
            : `sms:?body=${encodeURIComponent(smsText)}`;

          global.location.href = url;
        }
      });
    }
  }

  // ------------------------------------------------------------
  //  Exposition globale
  // ------------------------------------------------------------
  global.cfRenderSupplierSmsView = cfRenderSupplierSmsView;

})(window);

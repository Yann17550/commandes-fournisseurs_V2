// ============================================================
//  SMS_FOURNISSEURS / COMMANDE_FOURNISSEUR_SMS
//  ------------------------------------------------------------
//  Ce fichier gère la construction et l'affichage du SMS
//  pour le fournisseur sélectionné.
//
//  Responsabilités :
//  - construire le texte du SMS ;
//  - afficher la vue détail du fournisseur ;
//  - proposer les actions Copier / SMS ;
//  - déléguer l'ouverture de l'application SMS au module send.
//
//  Ce fichier ne doit jamais :
//  - interroger Supabase directement ;
//  - recalculer toute la liste fournisseur ;
//  - envoyer automatiquement le SMS.
// ============================================================

(function attachCommandeFournisseurSmsModule(global) {
  'use strict';

  // ----------------------------------------------------------
  //  Helpers DOM alignés sur le projet existant
  // ----------------------------------------------------------

  function cfSmsGetEl(id) {
    if (typeof $ === 'function') return $(id);
    return document.getElementById(id);
  }

  function cfSmsGetListRoot() {
    return cfSmsGetEl('supplierOrdersList');
  }

  function cfSmsMustHaveDependencies() {
  }

  // ----------------------------------------------------------
  //  Helpers utilitaires
  // ----------------------------------------------------------

  function cfSmsEsc(value) {
    if (typeof escHtml === 'function') {
      return escHtml(value);
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cfSmsShowToast(message) {
    if (typeof showToast === 'function') {
      showToast(message);
    }
  }

  function cfSmsStr(value) {
    return String(value || '').trim();
  }

  function cfSmsGetContactFirstName(contactRaw) {
    const contact = cfSmsStr(contactRaw);
    if (!contact) return '';
    const parts = contact.split(/\s+/);
    return parts[0] || '';
  }

  // ----------------------------------------------------------
  //  Construction des lignes SMS
  // ----------------------------------------------------------

  function cfSmsBuildLinesForEtab(supplierName, quantitiesMap, produitsIndex) {
    const rows = [];

    quantitiesMap.forEach((qty, key) => {
      if (Number(qty) <= 0) return;

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

      rows.push(`${qty}${typePart} ${nomCourt} - Ref: ${reference}`);
    });

    return rows;
  }

  // ----------------------------------------------------------
  //  Construction du texte complet du SMS
  // ----------------------------------------------------------

  function cfSmsBuildSmsText(supplierName, model) {
    const produitsIndex = model?.produits_index || new Map();
    const quantitiesA = model?.quantities_a || new Map();
    const quantitiesB = model?.quantities_b || new Map();

    const supplierRow = (model?.suppliers || []).find(s => s.nom === supplierName);

    const contact = supplierRow?.contacts?.[0] || '';
    const firstName = cfSmsGetContactFirstName(contact);

    const linesA = cfSmsBuildLinesForEtab(supplierName, quantitiesA, produitsIndex);
    const linesB = cfSmsBuildLinesForEtab(supplierName, quantitiesB, produitsIndex);

    let out = `Bonjour ${firstName},\n`;
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

  // ----------------------------------------------------------
  //  Téléphone du fournisseur
  // ----------------------------------------------------------

  function cfSmsGetSupplierPhone(supplierName, model) {
    const supplierRow = (model?.suppliers || []).find(s => s.nom === supplierName);
    return cfSmsStr(supplierRow?.telephones?.[0] || '');
  }

  // ----------------------------------------------------------
  //  Rendu de la vue SMS
  // ----------------------------------------------------------

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
        <h2 class="etab-title">${cfSmsEsc(supplierName)}</h2>

        <pre class="supplier-sms-preview">${cfSmsEsc(smsText)}</pre>

        <div class="supplier-sms-actions">
          <button type="button" class="copy-btn" id="copySupplierSmsBtn">Copier</button>
          <button type="button" class="copy-btn" id="sendSupplierSmsBtn">SMS</button>
        </div>
      </div>
    `;

    const copyBtn = cfSmsGetEl('copySupplierSmsBtn');
    const sendBtn = cfSmsGetEl('sendSupplierSmsBtn');

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

  // ----------------------------------------------------------
  //  API globale du module
  // ----------------------------------------------------------
  global.cfRenderSupplierSmsView = cfRenderSupplierSmsView;

})(window);

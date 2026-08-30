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

  /**
   * Accès DOM aligné sur le fonctionnement actuel du projet.
   */
  function cfSmsGetEl(id) {
    if (typeof $ === 'function') return $(id);
    return document.getElementById(id);
  }

  /**
   * Racine de rendu de l'écran fournisseur.
   */
  function cfSmsGetListRoot() {
    return cfSmsGetEl('supplierOrdersList');
  }

  /**
   * Dépendances minimales.
   * Ici, pas besoin de window.$ obligatoire.
   */
  function cfSmsMustHaveDependencies() {
    // Pas de dépendance bloquante supplémentaire ici.
  }

  /**
   * Echappement HTML.
   */
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

  /**
   * Affichage toast si disponible.
   */
  function cfSmsShowToast(message) {
    if (typeof showToast === 'function') {
      showToast(message);
    }
  }

  /**
   * Nettoyage chaîne.
   */
  function cfSmsStr(value) {
    return String(value || '').trim();
  }

  /**
   * Extrait le prénom du contact fournisseur.
   * Exemple :
   *   "Jean Dupont" -> "Jean"
   */
  function cfSmsGetContactFirstName(contactRaw) {
    const contact = cfSmsStr(contactRaw);
    if (!contact) return '';

    const parts = contact.split(/\s+/);
    return parts[0] || '';
  }

  /**
   * Construit une date de livraison lisible en français.
   *
   * IMPORTANT :
   * Ici, on reste volontairement simple tant qu'aucune règle métier
   * plus précise n'a été fixée pour la livraison.
   */
  function cfSmsGetExpectedDeliveryDate() {
    const now = new Date();

    return now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  /**
   * Construit les lignes SMS d'un établissement à partir :
   * - du fournisseur ciblé ;
   * - d'une map quantités ;
   * - de l'index produits.
   *
   * Format ligne :
   *   quantité + type_unite + nom_court + " - Ref: " + reference
   */
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

  /**
   * Construit le texte complet du SMS pour le fournisseur demandé.
   */
  function cfSmsBuildSmsText(supplierName, model) {
    const produitsIndex = model?.produits_index || new Map();
    const quantitiesA = model?.quantities_a || new Map();
    const quantitiesB = model?.quantities_b || new Map();

    const supplierRow = (model?.suppliers || []).find(s => s.nom === supplierName);

    const contact = supplierRow?.contacts?.[0] || '';
    const firstName = cfSmsGetContactFirstName(contact);
    const deliveryDate = cfSmsGetExpectedDeliveryDate();

    const linesA = cfSmsBuildLinesForEtab(supplierName, quantitiesA, produitsIndex);
    const linesB = cfSmsBuildLinesForEtab(supplierName, quantitiesB, produitsIndex);

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

  /**
   * Renvoie le premier téléphone connu du fournisseur.
   */
  function cfSmsGetSupplierPhone(supplierName, model) {
    const supplierRow = (model?.suppliers || []).find(s => s.nom === supplierName);
    return cfSmsStr(supplierRow?.telephones?.[0] || '');
  }

  /**
   * Rend la vue SMS du fournisseur sélectionné.
   *
   * Payload attendu :
   * {
   *   supplierName,
   *   snapshot,
   *   model,
   *   onBack
   * }
   */
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

    const backBtn = cfSmsGetEl('backToSupplierOrdersListBtn');
    const copyBtn = cfSmsGetEl('copySupplierSmsBtn');
    const sendBtn = cfSmsGetEl('sendSupplierSmsBtn');

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

  // ----------------------------------------------------------
  //  API globale du module
  // ----------------------------------------------------------
  global.cfRenderSupplierSmsView = cfRenderSupplierSmsView;

})(window);

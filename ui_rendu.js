// ============================================================
//  RENDU FOURNISSEUR — A / B
//  Extraction propre de l'accordéon fournisseur
// ============================================================
//
//  RÔLE DE CE FICHIER
//  ------------------
//  Cette fonction construit le HTML complet d'un bloc fournisseur
//  dans le mode établissement normal (A ou B).
//
//  Elle gère :
//  - le nom du fournisseur
//  - le badge "jour d'appel" si disponible
//  - le badge quantité / total si au moins un article est commandé
//  - l'ouverture / fermeture du bloc accordéon
//  - l'affichage du corps fournisseur si le bloc est ouvert
//
//  IMPORTANT
//  ---------
//  - Cette fonction est appelée par renderAccordion() dans ui_accordion.js
//  - Elle ne gère PAS les événements click elle-même
//  - Elle ne gère PAS le mode gérant
// ============================================================

function renderFournisseurBlock(sup, prods, isOpen, state) {
  // ----------------------------------------------------------
  // Liste des produits réellement commandés chez ce fournisseur
  // pour l'établissement courant
  // ----------------------------------------------------------
  const ordered = prods.filter(p => (state.quantities[productKey(p)] || 0) > 0);

  // ----------------------------------------------------------
  // Total fournisseur = somme des quantités commandées
  // multipliées par le prix colis
  // ----------------------------------------------------------
  const supTotal = ordered.reduce(
    (s, p) => s + (state.quantities[productKey(p)] || 0) * getPrixColis(p),
    0
  );

  // ----------------------------------------------------------
  // Jour d'appel fournisseur
  // Peut afficher par exemple :
  // - "📞 Auj." si aujourd'hui
  // - ou le libellé classique (lun, mar, etc.)
  // ----------------------------------------------------------
  const appel = getJourAppel(sup);

  const appelHtml = appel
    ? `<span class="acc-appel${appel.today ? ' acc-appel--today' : ''}">
         ${appel.today ? '📞 Auj.' : escHtml(appel.label)}
       </span>`
    : '';

  // ----------------------------------------------------------
  // Construction du bloc accordéon fournisseur
  //
  // Structure :
  // - bouton header cliquable
  // - partie gauche : nom + jour d'appel + badge quantité/total
  // - partie droite : chevron
  // - corps détaillé si le fournisseur est ouvert
  // ----------------------------------------------------------
  return `
    <div class="accordion-block${isOpen ? ' is-open' : ''}" data-sup="${escHtml(sup)}">

      <button class="accordion-header" data-sup="${escHtml(sup)}">
        <div class="acc-left">

          <div class="acc-title-row">
            <span class="acc-name">${escHtml(sup)}</span>
            ${appelHtml}
          </div>

          ${
            ordered.length
              ? `<span class="acc-badge">${ordered.length} art. · ${fmtPrice(supTotal)}</span>`
              : ''
          }
        </div>

        <span class="acc-chevron">${isOpen ? '▾' : '▸'}</span>
      </button>

      ${isOpen ? renderSupplierBody(prods) : ''}
    </div>
  `;
}

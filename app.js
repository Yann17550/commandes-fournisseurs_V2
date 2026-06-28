// ============================================================
//  APP.JS — Commandes Fournisseurs v3
//  Multi-etablissement, colissage, historique, edition inline
// ============================================================

// ============================================================
//  APPRENTISSAGE
// ============================================================

/**
 * Clé localStorage utilisée pour mémoriser les habitudes de commande.
 * Le but est d'aider certains tris ou affichages à partir des commandes passées.
 */
const LEARN_KEY = 'cmd_scores';

/**
 * Lit les scores d'apprentissage depuis le localStorage.
 * En cas d'absence, de JSON invalide ou d'erreur d'accès,
 * on renvoie simplement un objet vide.
 */
function getScores() {
  try {
    return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Sauvegarde les scores d'apprentissage dans le localStorage.
 * Les erreurs sont volontairement silencieuses pour ne pas bloquer l'application.
 */
function saveScores(s) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(s));
  } catch {}
}

/**
 * Enregistre une commande dans les scores d'apprentissage.
 * Chaque produit commandé au moins une fois voit son score augmenter.
 */
function recordOrder(quantities) {
  const scores = getScores();

  Object.entries(quantities).forEach(([k, q]) => {
    if (q > 0) {
      scores[k] = (scores[k] || 0) + 1;
    }
  });

  saveScores(scores);
}

// ============================================================
//  ETABLISSEMENT
// ============================================================

/**
 * Clé localStorage utilisée pour mémoriser l'établissement courant.
 */
const ETAB_KEY = 'cmd_etab';

/**
 * Récupère l'établissement sauvegardé localement.
 */
function getSavedEtab() {
  return localStorage.getItem(ETAB_KEY) || null;
}

/**
 * Sauvegarde l'identifiant d'établissement courant.
 */
function saveEtabLocal(id) {
  localStorage.setItem(ETAB_KEY, id);
}

// ============================================================
//  DOM
// ============================================================

/**
 * Références DOM statiques.
 * Ces éléments existent directement dans index.html.
 */
const screenEtab = $('screenEtab');
const screenApp = $('screenApp');

const etabCards = $('etabCards');
const etabPill = $('etabPill');
const switchEtabBtn = $('switchEtabBtn');

const weekLabel = $('weekLabel');
const mainContent = $('mainContent');

const productList = $('productList');
const loadingState = $('loadingState');

const summaryBtn = $('summaryBtn');
const refreshBtn = $('refreshBtn');
const summaryModal = $('summaryModal');
const summaryContent = $('summaryContent');

const searchInput = $('searchInput');
const saveStatusEl = $('saveStatus');

/**
 * Références DOM dynamiques.
 * Ces modales ne sont plus présentes en dur dans index.html :
 * elles sont injectées par ui_modals_view.js au démarrage.
 *
 * On les déclare donc en let, puis on les initialise après appel à initModalsView().
 */
let editModal = null;
let addModal = null;

/**
 * Met à jour les références DOM dynamiques une fois les modales injectées.
 * Cette fonction doit être appelée après initModalsView().
 */
function bindDynamicModalElements() {
  editModal = $('editModal');
  addModal = $('addModal');
}

// ============================================================
//  FILTRAGE ETABLISSEMENT
// ============================================================

/**
 * Retourne la liste des produits visibles pour l'établissement courant.
 * - gérant : tous les produits
 * - établissement A : produits A et AB
 * - établissement B : produits B et AB
 */
function getProduitsForEtab() {
  if (!state.etab || state.etab.id === 'gerant') {
    return state.produits;
  }

  const up = state.etab.id === 'a' ? 'A' : 'B';

  return state.produits.filter((p) => {
    const e = (p.etablissement || 'AB').toUpperCase();
    return e === 'AB' || e === '' || e === up;
  });
}

// ============================================================
//  OVERRIDES ET COLISSAGE
// ============================================================

/**
 * Retourne les données produit en tenant compte des éventuels overrides locaux.
 * Cela permet de travailler avec une vue cohérente du produit
 * même si certaines valeurs ont été ajustées côté interface.
 */
function getProductData(p) {
  const ov = state.overrides[productKey(p)] || {};

  return {
    ...p,
    reference: ov.reference !== undefined ? ov.reference : p.reference,
    prix_ht: ov.prix_ht !== undefined ? ov.prix_ht : p.prix_ht,
    colissage: ov.colissage !== undefined ? ov.colissage : p.colissage,
  };
}

/**
 * Calcule le prix colis d'un produit.
 * Si un prix colis explicite existe et est valide, il est utilisé ;
 * sinon on le recalcule à partir du prix unitaire HT et du colisage.
 */
function getPrixColis(p) {
  const d = getProductData(p);
  return d.prix_colis > 0 ? d.prix_colis : d.prix_ht * d.colissage;
}

/**
 * Convertit une quantité de colis en nombre d'unités.
 */
function getNbUnites(p, qtyColis) {
  return qtyColis * getProductData(p).colissage;
}

// ============================================================
//  CHARGEMENT
// ============================================================

/**
 * Charge les données produits et fournisseurs depuis Supabase,
 * puis recharge les commandes sauvegardées et l'historique éventuel.
 */
async function loadDataCore() {
  loadingState.style.display = 'flex';
  productList.style.display = 'none';
  state.error = null;

  try {
    const [
      { data: produitsData, error: produitsError },
      { data: fournisseursData, error: fournisseursError }
    ] = await Promise.all([
      supabaseClient
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
            ordre,
            actif
          )
        `)
        .eq('actif', true),

      supabaseClient
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
        .eq('actif', true)
        .order('ordre', { ascending: true })
        .order('nom', { ascending: true })
    ]);

    if (produitsError) throw produitsError;
    if (fournisseursError) throw fournisseursError;

    state.produits = (produitsData || [])
      .map((r) => {
        const fournisseurNom = (r.fournisseurs?.nom || '').trim();
        const designation = (r.designation_produit || '').trim();
        const nomCourt =
          (r.nom_court || '').trim() ||
          designation ||
          ('REF ' + ((r.reference || '').trim() || r.id));

        return {
          id: r.id,
          fournisseur: fournisseurNom,
          fournisseur_id: r.fournisseurs?.id || null,
          reference: (r.reference || '').trim(),
          designation: (r.designation_fournisseur || r.designation_produit || '').trim(),
          designation_produit: (r.designation_produit || '').trim(),
          designation_fournisseur: (r.designation_fournisseur || '').trim(),
          label: cleanDesignation(designation || nomCourt),
          tva: parseNum(r.tva),
          prix_ht: parseNum(r.prix_unitaire_ht),
          droit_alcool: parseNum(r.droit_alcool),
          taxe_secu: parseNum(r.taxe_securite_sociale),
          nom_court: nomCourt,
          categorie: (r.categorie || 'Divers').trim(),
          colissage: parseNum(r.colisage) || 1,
          prix_colis: parseNum(r.prix_colis),
          etablissement: 'AB',
          actif: true,
          isTemp: false,
          ordre_fournisseur: parseNum(r.fournisseurs?.ordre) || 999,
          ordre_categorie: parseNum(r.ordre_cat) || 999,
        };
      })
      .filter((p) => p.fournisseur);

    state.fournisseurs = {};
    (fournisseursData || []).forEach((r) => {
      const nom = (r.nom || '').trim();
      if (!nom) return;

      state.fournisseurs[nom] = {
        telephone: (r.telephone || '').trim(),
        contact: (r.contact || '').trim(),
        jour_saison: (r.jour_appel_saison || '').trim(),
        jour_hors_saison: (r.jour_appel_hors_saison || '').trim(),
        notes: (r.notes || '').trim(),
      };
    });

    state.loaded = true;

    if (state.etab && state.etab.id === 'gerant') {
      const [savedA, savedB] = await Promise.all([
        loadCommandeRemoteById('A'),
        loadCommandeRemoteById('B')
      ]);

      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};

      if (
        Object.keys(state.quantities_a).length > 0 ||
        Object.keys(state.quantities_b).length > 0
      ) {
        showToast('📂 Commandes restaurées');
      }
    } else {
      const [saved, histo] = await Promise.all([
        loadCommandeRemote(),
        loadHistoRemote()
      ]);

      if (Object.keys(saved || {}).length > 0) {
        state.quantities = saved;
        showToast('📂 Commande restaurée');
      } else {
        state.quantities = {};
      }

      if (histo && histo.quantities) {
        state.lastOrder = histo.quantities;
        state.lastSemaine = histo.semaine || '';
      } else {
        state.lastOrder = {};
        state.lastSemaine = '';
      }
    }

    render();
  } catch (err) {
    console.error(err);
    state.error = err.message;
    loadingState.style.display = 'none';
    renderError();
  }
}

// ============================================================
//  FOURNISSEURS
// ============================================================

/**
 * Retourne la liste des fournisseurs visibles pour l'établissement courant.
 */
function getSuppliers() {
  const p = getProduitsForEtab();
  return [...new Set(p.map((x) => x.fournisseur))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Retourne les jours d'appel du fournisseur courant,
 * avec indication sur le fait que ce soit aujourd'hui ou non.
 */
function getJourAppel(nom) {
  const f = state.fournisseurs[nom];
  if (!f) return null;

  const jours = isSaison() ? f.jour_saison : f.jour_hors_saison;
  if (!jours) return null;

  const today = new Date().getDay();
  const MAP = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 0 };
  const low = jours.toLowerCase();

  if (low.includes('tlj')) {
    return { label: jours, today: true };
  }

  const parts = low.split(/[\\/,; ]+/).map((s) => s.trim().slice(0, 3));
  const nums = parts.map((p) => MAP[p]).filter((n) => n !== undefined);

  return { label: jours, today: nums.includes(today) };
}

/**
 * Trie les produits d'un fournisseur.
 * La logique privilégie :
 * - les produits déjà commandés ;
 * - puis les habitudes enregistrées ;
 * - puis l'ordre alphabétique du nom court.
 */
function sortProducts(prods) {
  const scores = getScores();

  return [...prods].sort((a, b) => {
    const qa = state.quantities[productKey(a)] || 0;
    const qb = state.quantities[productKey(b)] || 0;

    if (qb > 0 && qa === 0) return 1;
    if (qa > 0 && qb === 0) return -1;

    const sa = scores[productKey(a)] || 0;
    const sb = scores[productKey(b)] || 0;

    if (sb !== sa) return sb - sa;

    return a.nom_court.localeCompare(b.nom_court, 'fr');
  });
}

// ============================================================
//  RECAPITULATIF
// ============================================================

/**
 * Branche les événements de la modale de récapitulatif.
 * Cette modale reste encore définie dans index.html.
 */
summaryBtn.addEventListener('click', openSummary);
$('closeModal').addEventListener('click', closeSummary);
$('resetBtn').addEventListener('click', resetCommande);
$('copyBtn').addEventListener('click', () => copySummary('all'));
$('copyBtnA').addEventListener('click', () => copySummary('a'));
$('copyBtnB').addEventListener('click', () => copySummary('b'));

/**
 * Ouvre la modale de récapitulatif après avoir recalculé son contenu.
 */
function openSummary() {
  renderSummary();
  summaryModal.style.display = 'flex';
}

/**
 * Ferme la modale de récapitulatif.
 */
function closeSummary() {
  summaryModal.style.display = 'none';
}

/**
 * Rend le contenu HTML du récapitulatif.
 * Il existe deux modes :
 * - mode gérant avec colonnes A/B ;
 * - mode établissement simple avec total unique.
 */
function renderSummary() {
  const isGerant = state.etab && state.etab.id === 'gerant';
  let html = '';
  let grandTotal = 0;

  const produits = triPipeline(state.produits, 'SUMMARY', state);

  if (isGerant) {
    const suppliers = [...new Set(produits.map((p) => p.fournisseur))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    );

    suppliers.forEach((sup) => {
      const items = produits.filter((p) => p.fournisseur === sup);
      let totalA = 0;
      let totalB = 0;

      let block = `<div class="summary-supplier">
        <div class="summary-supplier-name">${escHtml(sup)}</div>`;

      items.forEach((p) => {
        const key = productKey(p);
        const qa = state.quantities_a[key] || 0;
        const qb = state.quantities_b[key] || 0;
        if (!qa && !qb) return;

        const prix = getPrixColis(p);
        const lineA = qa ? qa * prix : 0;
        const lineB = qb ? qb * prix : 0;

        totalA += lineA;
        totalB += lineB;

        block += `
          <div class="summary-line--gerant">
            <div class="summary-line-name">${escHtml(p.nom_court)}</div>
            <div class="summary-line-ref">${escHtml(p.reference)}</div>
            <div class="summary-gcells">
              <div class="summary-gcell summary-gcell--a">${qa || ''}</div>
              <div class="summary-gcell summary-gcell--b">${qb || ''}</div>
            </div>
          </div>`;
      });

      if (totalA || totalB) {
        const total = totalA + totalB;
        grandTotal += total;

        block += `
          <div class="summary-gerant-subtotals">
            <span>${fmtPrice(totalA)}</span>
            <span>${fmtPrice(totalB)}</span>
            <span class="summary-sup-total">${fmtPrice(total)}</span>
          </div>
        </div>`;

        html += block;
      }
    });

    html += `
      <div class="summary-grand-total summary-grand-total--gerant">
        <div><span>Total A</span><span>${fmtPrice(
          Object.entries(state.quantities_a).reduce((s, [key, q]) => {
            const p = produits.find((p) => productKey(p) === key);
            return s + (q || 0) * getPrixColis(p);
          }, 0)
        )}</span></div>

        <div><span>Total B</span><span>${fmtPrice(
          Object.entries(state.quantities_b).reduce((s, [key, q]) => {
            const p = produits.find((p) => productKey(p) === key);
            return s + (q || 0) * getPrixColis(p);
          }, 0)
        )}</span></div>

        <div class="sgt-total"><span>Total</span><span>${fmtPrice(grandTotal)}</span></div>
      </div>`;

    $('copyBtnA').style.display = 'block';
    $('copyBtnB').style.display = 'block';
  } else {
    const suppliers = getSuppliers();

    suppliers.forEach((sup) => {
      const items = produits.filter((p) => p.fournisseur === sup);
      let total = 0;

      let block = `<div class="summary-supplier">
        <div class="summary-supplier-name">${escHtml(sup)}</div>`;

      items.forEach((p) => {
        const key = productKey(p);
        const qty = state.quantities[key] || 0;
        if (!qty) return;

        const prix = getPrixColis(p);
        const line = qty * prix;
        total += line;
        grandTotal += line;

        block += `
          <div class="summary-line">
            <span class="summary-line-qty">${qty}</span>
            <span class="summary-line-name">${escHtml(p.nom_court)}</span>
            <span class="summary-line-ref">${escHtml(p.reference)}</span>
            <span class="summary-line-price">${fmtPrice(line)}</span>
          </div>`;
      });

      if (total > 0) {
        block += `<div class="summary-supplier-total">${fmtPrice(total)}</div></div>`;
        html += block;
      }
    });

    html += `
      <div class="summary-grand-total">
        <span>Total</span>
        <span>${fmtPrice(grandTotal)}</span>
      </div>`;

    $('copyBtnA').style.display = 'none';
    $('copyBtnB').style.display = 'none';
  }

  summaryContent.innerHTML = html;
}

// ============================================================
//  DEMARRAGE APPLICATION
// ============================================================

/**
 * Point d'entrée principal de l'application.
 *
 * Ordre important :
 * 1. le DOM HTML principal doit être prêt ;
 * 2. les modales dynamiques doivent être injectées ;
 * 3. les références DOM dynamiques doivent être reliées ;
 * 4. ensuite seulement, le reste de l'application peut démarrer.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initModalsView === 'function') {
    initModalsView();
  }

  bindDynamicModalElements();
  renderEtabScreen();
});

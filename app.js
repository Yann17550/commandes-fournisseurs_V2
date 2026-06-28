// ============================================================
//  APP.JS — Commandes Fournisseurs v3
//  Multi-etablissement, colissage, historique, edition inline
// ============================================================

// ============================================================
//  APPRENTISSAGE
// ============================================================

/**
 * Clé localStorage utilisée pour mémoriser les habitudes de commande.
 * Ces scores servent ensuite à favoriser certains produits dans le tri.
 */
const LEARN_KEY = 'cmd_scores';

/**
 * Lit les scores d'apprentissage depuis le localStorage.
 * Si la donnée n'existe pas ou est invalide, on renvoie un objet vide.
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
 * Les erreurs sont silencieuses pour ne pas bloquer l'application.
 */
function saveScores(scores) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(scores));
  } catch {}
}

/**
 * Enregistre une commande terminée dans les scores d'apprentissage.
 * Chaque produit commandé au moins une fois voit son score augmenter.
 */
function recordOrder(quantities) {
  const scores = getScores();

  Object.entries(quantities).forEach(([key, qty]) => {
    if (qty > 0) {
      scores[key] = (scores[key] || 0) + 1;
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
 * Retourne l'établissement sauvegardé localement.
 */
function getSavedEtab() {
  return localStorage.getItem(ETAB_KEY) || null;
}

/**
 * Sauvegarde l'établissement courant localement.
 */
function saveEtabLocal(id) {
  localStorage.setItem(ETAB_KEY, id);
}

// ============================================================
//  DOM
// ============================================================

/**
 * Références DOM présentes directement dans index.html.
 * Ces éléments existent dès le chargement initial de la page.
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
 * Références DOM injectées dynamiquement.
 * Ces modales ne sont plus écrites en dur dans index.html :
 * elles sont créées par ui_modals_view.js au démarrage.
 *
 * On les déclare en let, puis on les relie après injection.
 */
let editModal = null;
let addModal = null;

/**
 * Relie les références DOM des modales injectées.
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
 * Retourne les produits visibles selon l'établissement courant.
 * - gérant : tous les produits
 * - A : produits A et AB
 * - B : produits B et AB
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
 * Retourne les données d'un produit en tenant compte
 * des overrides éventuels présents dans state.overrides.
 */
function getProductData(p) {
  const ov = state.overrides[productKey(p)] || {};

  return {
    ...p,
    reference: ov.reference !== undefined ? ov.reference : p.reference,
    prix_ht: ov.prix_ht !== undefined ? ov.prix_ht : p.prix_ht,
    colissage: ov.colissage !== undefined ? ov.colissage : p.colissage,
    prix_colis: ov.prix_colis !== undefined ? ov.prix_colis : p.prix_colis,
  };
}

/**
 * Retourne le prix colis d'un produit.
 * Si un prix colis explicite existe, il est prioritaire ;
 * sinon on le calcule à partir du prix HT unitaire et du colisage.
 */
function getPrixColis(p) {
  const d = getProductData(p);
  return d.prix_colis > 0 ? d.prix_colis : d.prix_ht * d.colissage;
}

/**
 * Convertit un nombre de colis en nombre d'unités.
 */
function getNbUnites(p, qtyColis) {
  return qtyColis * getProductData(p).colissage;
}

// ============================================================
//  CHARGEMENT
// ============================================================

/**
 * Charge les produits et les fournisseurs depuis Supabase,
 * puis recharge les commandes sauvegardées et l'historique.
 *
 * Cette fonction prépare aussi state.fournisseurs avec une structure
 * plus riche afin d'alimenter proprement les futurs modules UI.
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
        const designationProduit = (r.designation_produit || '').trim();
        const designationFournisseur = (r.designation_fournisseur || '').trim();

        const nomCourt =
          (r.nom_court || '').trim() ||
          designationProduit ||
          ('REF ' + ((r.reference || '').trim() || r.id));

        return {
          id: r.id,
          fournisseur: fournisseurNom,
          fournisseur_id: r.fournisseurs?.id || null,
          reference: (r.reference || '').trim(),
          designation: (designationFournisseur || designationProduit).trim(),
          designation_produit: designationProduit,
          designation_fournisseur: designationFournisseur,
          label: cleanDesignation(designationProduit || nomCourt),
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

    /**
     * Structure enrichie des fournisseurs.
     * On garde maintenant aussi l'id, l'ordre et l'état actif,
     * ce qui évite aux autres modules de reconstituer ces infos ailleurs.
     */
    state.fournisseurs = {};
    (fournisseursData || []).forEach((r) => {
      const nom = (r.nom || '').trim();
      if (!nom) return;

      state.fournisseurs[nom] = {
        id: r.id || null,
        nom,
        telephone: (r.telephone || '').trim(),
        contact: (r.contact || '').trim(),
        jour_saison: (r.jour_appel_saison || '').trim(),
        jour_hors_saison: (r.jour_appel_hors_saison || '').trim(),
        notes: (r.notes || '').trim(),
        ordre: parseNum(r.ordre) || 999,
        actif: Boolean(r.actif),
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
  const produits = getProduitsForEtab();

  return [...new Set(produits.map((x) => x.fournisseur))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Retourne les informations de jour d'appel d'un fournisseur.
 * Le retour précise aussi si aujourd'hui correspond à un jour d'appel.
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
 * Priorités :
 * 1. produits déjà commandés ;
 * 2. produits les plus souvent commandés historiquement ;
 * 3. ordre alphabétique sur le nom court.
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
 * Branchement des actions de la modale récapitulative.
 * Cette modale reste pour l'instant dans index.html.
 */
summaryBtn.addEventListener('click', openSummary);
$('closeModal').addEventListener('click', closeSummary);
$('resetBtn').addEventListener('click', resetCommande);
$('copyBtn').addEventListener('click', () => copySummary('all'));
$('copyBtnA').addEventListener('click', () => copySummary('a'));
$('copyBtnB').addEventListener('click', () => copySummary('b'));

/**
 * Ouvre la modale de récapitulatif.
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
 * Génère le contenu HTML du récapitulatif.
 * Deux cas :
 * - mode gérant avec double colonne A/B ;
 * - mode simple avec total unique.
 */
function renderSummary() {
  const isGerant = state.etab && state.etab.id === 'gerant';
  let html = '';
  let grandTotal = 0;

  const produits = triPipeline(state.produits, 'SUMMARY', state);

  if (isGerant) {
    const suppliers = [...new Set(produits.map((p) => p.fournisseur))]
      .sort((a, b) => a.localeCompare(b, 'fr'));

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
          Object.entries(state.quantities_a).reduce((sum, [key, qty]) => {
            const p = produits.find((prod) => productKey(prod) === key);
            return sum + (qty || 0) * getPrixColis(p);
          }, 0)
        )}</span></div>

        <div><span>Total B</span><span>${fmtPrice(
          Object.entries(state.quantities_b).reduce((sum, [key, qty]) => {
            const p = produits.find((prod) => productKey(prod) === key);
            return sum + (qty || 0) * getPrixColis(p);
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
//  INITIALISATION
// ============================================================

/**
 * Initialise toute la couche UI dépendante des modales injectées.
 * L'ordre est important :
 * 1. injection du HTML des modales ;
 * 2. reliure des références DOM dynamiques ;
 * 3. branchement des comportements edit/add.
 */
function initDynamicUi() {
  if (typeof initModalsView === 'function') {
    initModalsView();
  }

  bindDynamicModalElements();

  if (typeof initEditModal === 'function') {
    initEditModal();
  }

  if (typeof initAddModal === 'function') {
    initAddModal();
  }
}

/**
 * Point d'entrée principal de l'application.
 * Comme les scripts sont chargés en bas du body, l'initialisation
 * peut être faite lorsque le DOM est prêt, ce qui garantit que
 * les éléments manipulés existent bien. [web:51][web:24]
 */
document.addEventListener('DOMContentLoaded', () => {
  initDynamicUi();
  renderEtabScreen();
});

// ============================================================
//  APP.JS — Commandes Fournisseurs v3
//  Multi-etablissement, colissage, historique, edition inline
// ============================================================


// ---- Apprentissage ----------------------------------------
const LEARN_KEY = 'cmd_scores';
function getScores() { try { return JSON.parse(localStorage.getItem(LEARN_KEY)||'{}'); } catch { return {}; } }
function saveScores(s) { try { localStorage.setItem(LEARN_KEY, JSON.stringify(s)); } catch {} }
function recordOrder(quantities) {
  const scores = getScores();
  Object.entries(quantities).forEach(([k,q]) => { if(q>0) scores[k] = (scores[k]||0)+1; });
  saveScores(scores);
}

// ---- Etablissement (localStorage ok pour identite) --------
const ETAB_KEY = 'cmd_etab';
function getSavedEtab() { return localStorage.getItem(ETAB_KEY)||null; }
function saveEtabLocal(id) { localStorage.setItem(ETAB_KEY, id); }

// ---- State ------------------------------------------------

// ---- DOM --------------------------------------------------
const screenEtab = $('screenEtab'), screenApp = $('screenApp');
const etabCards = $('etabCards'), etabPill = $('etabPill');
const switchEtabBtn = $('switchEtabBtn');
const weekLabel = $('weekLabel'), mainContent = $('mainContent');
const productList = $('productList'), loadingState = $('loadingState');
const bottomBar = $('bottomBar'), totalAmount = $('totalAmount');
const validateBtn = $('validateBtn'), summaryBtn = $('summaryBtn');
const refreshBtn = $('refreshBtn'), summaryModal = $('summaryModal');
const summaryContent = $('summaryContent'), searchInput = $('searchInput');
const saveStatusEl = $('saveStatus');
const editModal = $('editModal'), addModal = $('addModal');



// ---- Utils ------------------------------------------------

// ---- Nettoyage designation --------------------------------

// ---- Parsing ----------------------------------------------

// ---- Filtrage etablissement -------------------------------
function getProduitsForEtab() {
  if(!state.etab||state.etab.id==='gerant') return state.produits;
  const up = state.etab.id==='a' ? 'A' : 'B';
  return state.produits.filter(p=>{
    const e = (p.etablissement||'AB').toUpperCase();
    return e==='AB'||e===''||e===up;
  });
}
// ---- Overrides et colissage -------------------------------
function getProductData(p) {
  const ov = state.overrides[productKey(p)]||{};
  return { ...p,
    reference: ov.reference!==undefined ? ov.reference : p.reference,
    prix_ht:   ov.prix_ht!==undefined   ? ov.prix_ht   : p.prix_ht,
    colissage: ov.colissage!==undefined ? ov.colissage  : p.colissage,
  };
}
function getPrixColis(p) {
  const d = getProductData(p);
  return d.prix_colis>0 ? d.prix_colis : d.prix_ht * d.colissage;
}
function getNbUnites(p, qtyColis) { return qtyColis * getProductData(p).colissage; }

// ---- Sauvegarde distante ----------------------------------

// ---- Écran établissement ----------------------------------

// ---- Chargement -------------------------------------------
async function loadDataCore() {
  loadingState.style.display = 'flex';
  productList.style.display  = 'none';
  state.error = null;

  try {
    const tsvP = await fetch(CONFIG.SHEETS.produits, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });

    const tsvF = await fetch(CONFIG.SHEETS.fournisseurs, { cache: 'no-store' })
      .then(r => r.text())
      .catch(() => '');

    state.produits     = parseProduits(tsvP);
    state.fournisseurs = parseFournisseurs(tsvF);
    state.loaded       = true;

    if (state.etab && state.etab.id === 'gerant') {
      const savedA = await loadCommandeRemoteById('a');
      const savedB = await loadCommandeRemoteById('b');
      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};
      if (Object.keys(state.quantities_a).length > 0 || Object.keys(state.quantities_b).length > 0) {
        showToast('📂 Commandes restaurées');
      }
    } else {
      const saved = await loadCommandeRemote();
      const histo = await loadHistoRemote();

      if (Object.keys(saved).length > 0) {
        state.quantities = saved;
        showToast('📂 Commande restaurée');
      }

      if (histo && histo.quantities) {
        state.lastOrder   = histo.quantities;
        state.lastSemaine = histo.semaine || '';
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

// ---- Fournisseurs -----------------------------------------
function getSuppliers() {
  const p = getProduitsForEtab();
  return [...new Set(p.map(x=>x.fournisseur))].sort((a,b)=>a.localeCompare(b,'fr'));
}

function getJourAppel(nom) {
  const f = state.fournisseurs[nom]; if(!f) return null;
  const jours = isSaison() ? f.jour_saison : f.jour_hors_saison; if(!jours) return null;
  const today = new Date().getDay();
  const MAP = {lun:1,mar:2,mer:3,jeu:4,ven:5,sam:6,dim:0};
  const low = jours.toLowerCase();
  if(low.includes('tlj')) return {label:jours,today:true};
  const parts = low.split(/[\/,; ]+/).map(s=>s.trim().slice(0,3));
  const nums = parts.map(p=>MAP[p]).filter(n=>n!==undefined);
  return {label:jours, today:nums.includes(today)};
}

function sortProducts(prods) {
  const scores = getScores();
  return [...prods].sort((a,b)=>{
    const qa=state.quantities[productKey(a)]||0, qb=state.quantities[productKey(b)]||0;
    if(qb>0&&qa===0) return 1; if(qa>0&&qb===0) return -1;
    const sa=scores[productKey(a)]||0, sb=scores[productKey(b)]||0;
    if(sb!==sa) return sb-sa;
    return a.nom_court.localeCompare(b.nom_court,'fr');
  });
}

// ---- Rendu ------------------------------------------------

// ---- Accordeon --------------------------------------------

// ---- Qty --------------------------------------------------

// ---- Modal edition ----------------------------------------

// ---- Modal ajout ------------------------------------------


// ============================================================
//  RÉCAPITULATIF
// ============================================================
summaryBtn.addEventListener('click', openSummary);
validateBtn.addEventListener('click', openSummary);
$('closeModal').addEventListener('click', closeSummary);
$('resetBtn').addEventListener('click', resetCommande);
$('copyBtn').addEventListener('click', () => copySummary('all'));
$('copyBtnA').addEventListener('click', () => copySummary('a'));
$('copyBtnB').addEventListener('click', () => copySummary('b'));

function openSummary() {
  renderSummary();
  summaryModal.style.display = 'flex';
}

function closeSummary() {
  summaryModal.style.display = 'none';
}

function renderSummary() {
  const isGerant = state.etab && state.etab.id === 'gerant';
  let html = '';
  let grandTotal = 0;

  const produits = state.produits;

  if (isGerant) {
    // --- Mode gérant ---
    const suppliers = [...new Set(produits.map(p => p.fournisseur))].sort((a, b) => a.localeCompare(b, 'fr'));

    suppliers.forEach(sup => {
      const items = produits.filter(p => p.fournisseur === sup);
      let totalA = 0, totalB = 0;

      let block = `<div class="summary-supplier">
        <div class="summary-supplier-name">${escHtml(sup)}</div>`;

      items.forEach(p => {
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
            const p = produits.find(p => productKey(p) === key);
            return s + (q || 0) * getPrixColis(p);
          }, 0)
        )}</span></div>

        <div><span>Total B</span><span>${fmtPrice(
          Object.entries(state.quantities_b).reduce((s, [key, q]) => {
            const p = produits.find(p => productKey(p) === key);
            return s + (q || 0) * getPrixColis(p);
          }, 0)
        )}</span></div>

        <div class="sgt-total"><span>Total</span><span>${fmtPrice(grandTotal)}</span></div>
      </div>`;

    $('copyBtnA').style.display = 'block';
    $('copyBtnB').style.display = 'block';

  } else {
    // --- Mode normal ---
    const suppliers = getSuppliers();

    suppliers.forEach(sup => {
      const items = produits.filter(p => p.fournisseur === sup);
      let total = 0;
      let block = `<div class="summary-supplier">
        <div class="summary-supplier-name">${escHtml(sup)}</div>`;

      items.forEach(p => {
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
//  COPIE / ARCHIVAGE / RESET
// ============================================================

// ============================================================
//  ARCHIVAGE ET RESET QTé GÉRANT ET ETAB A & B
// ============================================================


// ============================================================
//  RENDER ACCORDION GÉRANT
// ============================================================


function bindGerantSteppers() {
  document.querySelectorAll('.qty-btn-g').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const etab = btn.dataset.etab;
      const delta = parseInt(btn.dataset.delta, 10);

      if (etab === 'a') {
        state.quantities_a[key] = Math.max(0, (state.quantities_a[key] || 0) + delta);
      } else {
        state.quantities_b[key] = Math.max(0, (state.quantities_b[key] || 0) + delta);
      }

      scheduleSave();
      renderAccordionGerant(); // 🔥 Re-render pour mettre à jour totaux A/B + steppers
    });
  });

  document.querySelectorAll('.qty-input-g').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.key;
      const etab = input.dataset.etab;
      const val = Math.max(0, parseInt(input.value, 10) || 0);

      if (etab === 'a') {
        state.quantities_a[key] = val;
      } else {
        state.quantities_b[key] = val;
      }

      scheduleSave();
      renderAccordionGerant(); // 🔥 Mise à jour instantanée
    });
  });
}

// ---- Démarrage de l'application ----
console.log("[TRACE] Initialisation de l'application");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[TRACE] DOMContentLoaded → lancement renderEtabScreen()");
  renderEtabScreen();
});

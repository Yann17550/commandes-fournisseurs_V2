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
let state = {
  etab: null,
  produits: [], fournisseurs: {},
  quantities:   {},  // commande de l'etab courant (A ou B)
  quantities_a: {},  // commande Pizza d'Oleron  (vue gerant)
  quantities_b: {},  // commande Le Vesuvio       (vue gerant)
  lastOrder: {}, lastSemaine: '',
  overrides: {},
  openSupplier: null, loaded: false, error: null, editKey: null,
};

// ---- DOM --------------------------------------------------
const $ = id => document.getElementById(id);
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
function getWeekLabel() {
  const now = new Date(), start = new Date(now.getFullYear(),0,1);
  const w = Math.ceil(((now-start)/86400000+start.getDay()+1)/7);
  return 'S'+w+' \u2014 '+now.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
}
function getWeekId() {
  const now = new Date(), start = new Date(now.getFullYear(),0,1);
  const w = Math.ceil(((now-start)/86400000+start.getDay()+1)/7);
  return now.getFullYear()+'-S'+String(w).padStart(2,'0');
}
function parseNum(s) {
  if(!s||!s.toString().trim()) return 0;
  return parseFloat(s.toString().replace(',','.'))||0;
}
function fmtPrice(n) {
  return n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' \u20ac';
}
function productKey(p) { return p.fournisseur+'||'+p.reference+'||'+p.nom_court; }
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2500);
}
function isSaison() { return (CONFIG.MOIS_SAISON||[]).includes(new Date().getMonth()+1); }

// ---- Nettoyage designation --------------------------------
function cleanDesignation(s) {
  s = (s||'');
  [/\s*-\s*DROIT ALCOOL.*/i, /\s*-\s*droit sur alcool.*/i,
   /\s*\+\s*TAXE SECURITE SOCIALE.*/i, /\s*-\s*TAXE.*/i,
   /\s*\(pack x\d+\)/i].forEach(re => { s = s.replace(re,''); });
  s = s.trim();
  if(s===s.toUpperCase()) s = s.toLowerCase().replace(/(?:^|\s)\S/g,c=>c.toUpperCase());
  return s.trim();
}

// ---- Parsing ----------------------------------------------
function parseTSV(tsv) {
  const lines = tsv.trim().split('\n').map(l=>l.split('\t').map(c=>c.trim()));
  if(lines.length<2) return [];
  const h = lines[0];
  return lines.slice(1).filter(r=>r.some(c=>c!=='')).map(row=>{
    const o={}; h.forEach((k,i)=>o[k]=row[i]??''); return o;
  });
}

function parseProduits(tsv) {
  const C = CONFIG.COLS;
  return parseTSV(tsv)
    .filter(r=>{ const a=(r[C.actif]||'').toUpperCase(); return a===''||a==='TRUE'; })
    .filter(r=>(r[C.nom_court]||'').trim()&&(r[C.fournisseur]||'').trim())
    .map(r=>{
      const nom_court = (r[C.nom_court]||'').trim();
      const designation = (r[C.designation]||'').trim();
      const etabVal = (r[C.etablissement]||'').trim().toUpperCase();
      return {
        fournisseur:  (r[C.fournisseur]||'').trim(),
        reference:    (r[C.reference]||'').trim(),
        designation, label: cleanDesignation(designation),
        tva:          parseNum(r[C.tva]),
        prix_ht:      parseNum(r[C.prix_ht]),
        droit_alcool: parseNum(r[C.droit_alcool]),
        taxe_secu:    parseNum(r[C.taxe_secu]),
        nom_court, categorie: (r[C.categorie]||'Divers').trim(),
        colissage:    parseNum(r[C.colissage])||1,
        prix_colis:   parseNum(r[C.prix_colis]),
        etablissement: etabVal||'AB',
        actif: true, isTemp: false,
      };
    });
}

function parseFournisseurs(tsv) {
  if(!tsv) return {};
  const CF = CONFIG.COLS_F, map = {};
  parseTSV(tsv).forEach(r=>{
    const nom = (r[CF.nom]||'').trim(); if(!nom) return;
    map[nom] = {
      telephone: (r[CF.telephone]||'').trim(), contact: (r[CF.contact]||'').trim(),
      jour_saison: (r[CF.jour_saison]||'').trim(),
      jour_hors_saison: (r[CF.jour_hors_saison]||'').trim(),
      notes: (r[CF.notes]||'').trim(),
    };
  });
  return map;
}

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
let saveTimer = null;
function scheduleSave() {
  if(!CONFIG.APPS_SCRIPT_URL) return;
  clearTimeout(saveTimer);
  showSaveStatus('...');
  saveTimer = setTimeout(doSave, 1500);
}
async function doSave() {
  if(!CONFIG.APPS_SCRIPT_URL||!state.etab) return;
  try {
    if(state.etab.id === 'gerant') {
      // Sauvegarde les deux étabs
      await Promise.all([
        fetchSave('a', state.quantities_a),
        fetchSave('b', state.quantities_b),
      ]);
    } else {
      await fetchSave(state.etab.id, state.quantities);
    }
    showSaveStatus('💾 OK');
  } catch { showSaveStatus('⚠️ Erreur'); }
}
function fetchSave(etabId, quantities) {
  const body = JSON.stringify(Object.fromEntries(Object.entries(quantities).filter(([,v])=>v>0)));
  return fetch(CONFIG.APPS_SCRIPT_URL+'?action=write&etab='+etabId,{
    method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body,
  });
}
async function loadCommandeRemote() {
  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') return {};
  return loadCommandeRemoteById(state.etab.id);
}
async function loadCommandeRemoteById(etabId) {
  console.log("[TRACE] loadCommandeRemoteById() appelé avec etabId =", etabId);

  if(!CONFIG.APPS_SCRIPT_URL) {
    console.warn("[TRACE] PAS D’URL APPS SCRIPT dans CONFIG");
    return {};
  }

  const url = CONFIG.APPS_SCRIPT_URL+'?action=read&etab='+etabId;
  console.log("[TRACE] FETCH →", url);

  try {
    const r = await fetch(url);
    console.log("[TRACE] Réponse brute loadCommandeRemoteById :", r);

    const json = await r.json().catch(e => {
      console.error("[TRACE] JSON ERROR loadCommandeRemoteById", e);
      return null;
    });

    console.log("[TRACE] JSON reçu loadCommandeRemoteById :", json);
    return json || {};

  } catch(e) {
    console.error("[TRACE] ERREUR loadCommandeRemoteById", e);
    return {};
  }
}

async function loadHistoRemote() {
  console.log("[TRACE] loadHistoRemote() appelé");

  if(!CONFIG.APPS_SCRIPT_URL) {
    console.warn("[TRACE] PAS D’URL APPS SCRIPT dans CONFIG");
    return {};
  }
  if(!state.etab) {
    console.warn("[TRACE] PAS DE state.etab");
    return {};
  }
  if(state.etab.id === 'gerant') {
    console.warn("[TRACE] etab = gerant → pas d’historique");
    return {};
  }

  const url = CONFIG.APPS_SCRIPT_URL+'?action=histo&etab='+state.etab.id;
  console.log("[TRACE] FETCH →", url);

  try {
    const r = await fetch(url);
    console.log("[TRACE] Réponse brute loadHistoRemote :", r);

    const json = await r.json().catch(e => {
      console.error("[TRACE] JSON ERROR loadHistoRemote", e);
      return null;
    });

    console.log("[TRACE] JSON reçu loadHistoRemote :", json);
    return json || {};

  } catch(e) {
    console.error("[TRACE] ERREUR loadHistoRemote", e);
    return {};
  }
}

async function archiveCommande() {
  console.log("[TRACE] archiveCommande() appelé");

  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') {
    console.warn("[TRACE] archiveCommande() → conditions non remplies");
    return;
  }

  const items = [];
  state.produits.forEach(p=>{
    const qty = state.quantities[productKey(p)]||0; 
    if(!qty) return;
    const d = getProductData(p);
    items.push({
      key:productKey(p), 
      nomCourt:p.nom_court, 
      ref:d.reference,
      qty, 
      prixHt:d.prix_ht, 
      total:qty*getPrixColis(p)
    });
  });

  if(!items.length) {
    console.warn("[TRACE] archiveCommande() → aucun item à archiver");
    return;
  }

  const url = CONFIG.APPS_SCRIPT_URL+'?action=archive&etab='+state.etab.id;
  console.log("[TRACE] FETCH POST →", url);
  console.log("[TRACE] Payload archive :", {semaine:getWeekId(), etabLabel:state.etab.label, items});

  fetch(url,{
    method:'POST', 
    mode:'no-cors', 
    headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({semaine:getWeekId(), etabLabel:state.etab.label, items}),
  }).catch(e=>{
    console.error("[TRACE] ERREUR archiveCommande()", e);
  });
}

async function clearCommandeRemote() {
  console.log("[TRACE] clearCommandeRemote() appelé");

  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') {
    console.warn("[TRACE] clearCommandeRemote() → conditions non remplies");
    return;
  }

  const url = CONFIG.APPS_SCRIPT_URL+'?action=clear&etab='+state.etab.id;
  console.log("[TRACE] FETCH POST →", url);

  fetch(url,{method:'POST',mode:'no-cors'})
    .catch(e => console.error("[TRACE] ERREUR clearCommandeRemote()", e));
}

function showSaveStatus(msg) {
  if(!saveStatusEl) return;
  saveStatusEl.textContent=msg; saveStatusEl.style.opacity='1';
  clearTimeout(saveStatusEl._t);
  if(msg.includes('OK')) saveStatusEl._t=setTimeout(()=>{ saveStatusEl.style.opacity='0'; },2500);
}

// ---- Écran établissement ----------------------------------
function renderEtabScreen() {
  etabCards.innerHTML = CONFIG.ETABS.map(e => `
    <button class="etab-card" data-etab="${e.id}">
      <img src="${e.icon}" alt="${escHtml(e.label)}" class="etab-logo">
      <span class="etab-card-label">${escHtml(e.label)}</span>
    </button>`).join('');

  etabCards.querySelectorAll('.etab-card').forEach(btn => {
    btn.addEventListener('click', () => selectEtab(btn.dataset.etab));
  });

  screenEtab.style.display = 'flex';
  screenApp.style.display  = 'none';
}

async function selectEtab(id) {
  const etab = CONFIG.ETABS.find(e => e.id === id);
  if (!etab) return;

  const prevId = state.etab ? state.etab.id : null;
  state.etab = etab;
  document.body.classList.toggle('etab-gerant', id === 'gerant');
  saveEtabLocal(id);

 etabPill.innerHTML = `
  <img src="${etab.icon}" class="etab-logo-pill">
  <span>${escHtml(etab.label)}</span>
`;

  $('summaryTitle').textContent = 'Commande — ' + etab.label;

  screenEtab.style.display = 'none';
  screenApp.style.display  = 'flex';
  switchEtabBtn.style.display = 'block';

  if (!state.loaded) {
    await loadData();
    return;
  }

  if (prevId !== id) {
    loadingState.style.display = 'flex';
    productList.style.display  = 'none';

    if (id === 'gerant') {
      const savedA = await loadCommandeRemoteById('a');
      const savedB = await loadCommandeRemoteById('b');
      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};
    } else {
      const saved = await loadCommandeRemoteById(id);
      const histo = await loadHistoRemote();
      state.quantities = saved || {};
      if (histo && histo.quantities) {
        state.lastOrder   = histo.quantities;
        state.lastSemaine = histo.semaine || '';
      }
    }

    state.openSupplier = null;
    render();
    return;
  }

  render();
}

switchEtabBtn.addEventListener('click', () => {
  screenApp.style.display = 'none';
  renderEtabScreen();
});

etabPill.addEventListener('click', () => {
  screenApp.style.display = 'none';
  renderEtabScreen();
});

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
function render() {
  loadingState.style.display='none'; productList.style.display='block';
  weekLabel.textContent=getWeekLabel();
  renderAccordion(); updateTotal();
}

function renderError() {
  document.querySelectorAll('.error-banner').forEach(e=>e.remove());
  const div=document.createElement('div'); div.className='error-banner';
  div.innerHTML='<strong>Erreur</strong><br>'+escHtml(state.error);
  mainContent.prepend(div);
}

// ---- Accordeon --------------------------------------------
function renderAccordion() {
  if (state.etab && state.etab.id === 'gerant') {
    renderAccordionGerant();
    return;
  }

  const suppliers = getSuppliers();
  const allProds = getProduitsForEtab();

  if (!suppliers.length) {
    productList.innerHTML =
      '<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>';
    return;
  }

  let html = '<div class="fab-row"><button class="fab-add" id="fabAddBtn">+ Nouveau produit</button></div>';

  suppliers.forEach(sup => {

    // Produits du fournisseur
    const prods = allProds.filter(p => p.fournisseur === sup);

    const isOpen = state.openSupplier === sup;
    const ordered = prods.filter(p => (state.quantities[productKey(p)] || 0) > 0);
    const supTotal = ordered.reduce((s, p) =>
      s + (state.quantities[productKey(p)] || 0) * getPrixColis(p), 0);

    const appel = getJourAppel(sup);
    const appelHtml = appel
      ? `<span class="acc-appel${appel.today ? ' acc-appel--today' : ''}">${
          appel.today ? '📞 Auj.' : escHtml(appel.label)
        }</span>`
      : '';

    html += `
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
      </div>`;
  });

  productList.innerHTML = html;

  const fab = $('fabAddBtn');
  if (fab) fab.addEventListener('click', openAddModal);

  productList.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const sup = btn.dataset.sup;
      state.openSupplier = state.openSupplier === sup ? null : sup;
      renderAccordion();
      setTimeout(() => {
        const o = productList.querySelector('.accordion-block.is-open');
        if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    });
  });

  bindSteppers();
}

function renderSupplierBody(prods) {
  if (!prods.length)
    return '<div class="acc-body"><div class="empty-state"><p>Aucun produit</p></div></div>';

  const scores = getScores();
  const sorted = sortProducts(prods);
  const sup = prods[0].fournisseur;
  const fInfo = state.fournisseurs[sup] || {};

  let html = '<div class="acc-body">';

  // Infos fournisseur
  const infos = [];
  if (fInfo.contact)   infos.push('👤 ' + escHtml(fInfo.contact));
  if (fInfo.telephone) infos.push('📱 ' + escHtml(fInfo.telephone));
  if (fInfo.notes)     infos.push('⚠️ ' + escHtml(fInfo.notes));
  if (infos.length) html += `<div class="acc-info-bar">${infos.join(' · ')}</div>`;

  // Habituels / autres
  const habituels = sorted.filter(p => scores[productKey(p)] > 0);
  const autres    = sorted.filter(p => !scores[productKey(p)]);

  if (habituels.length) {
    html += '<div class="section-label">⭐ Habituels</div>' + renderGrouped(habituels);
    if (autres.length)
      html += '<div class="section-label section-label--secondary">Catalogue complet</div>' + renderGrouped(autres);
  } else {
    html += renderGrouped(sorted);
  }

  html += '</div>';
  return html;
}

// Precalcule les nom_court qui ont plusieurs produits dans le catalogue complet
function getNomCourtsMultiples(fournisseur) {
  const counts={};
  state.produits.filter(p=>p.fournisseur===fournisseur).forEach(p=>{
    counts[p.nom_court]=(counts[p.nom_court]||0)+1;
  });
  return new Set(Object.entries(counts).filter(([,n])=>n>1).map(([k])=>k));
}

function renderGrouped(prods) {
  if(!prods.length) return '';
  const fournisseur=prods[0].fournisseur;
  const multiNoms=getNomCourtsMultiples(fournisseur);
  const groups={};
  prods.forEach(p=>{ if(!groups[p.nom_court]) groups[p.nom_court]=[]; groups[p.nom_court].push(p); });
  return Object.entries(groups).map(([nc,items])=>{
    const isMulti=multiNoms.has(nc);
    if(items.length===1 && !isMulti) return renderRow(items[0],false);
    if(items.length===1 && isMulti)  return renderRow(items[0],true);
    return '<div class="nc-group"><div class="nc-header">'+escHtml(nc)+'</div>'+items.map(p=>renderRow(p,true)).join('')+'</div>';
  }).join('');
}

function renderRow(p,isVariant) {
  const key=productKey(p), d=getProductData(p);
  const qtyColis=state.quantities[key]||0;
  const prixColis=getPrixColis(p);
  const nbUnites=getNbUnites(p,qtyColis);
  const totalLigne=qtyColis*prixColis;
  const hasAlcool=p.droit_alcool>0||p.taxe_secu>0;
  const mainLabel=isVariant?d.label:p.nom_court;
  const subLabel=!isVariant&&d.label!==p.nom_court?d.label:'';
  const lastQty=state.lastOrder[key]||0;
  const hasOverride=!!state.overrides[key];

  const colissageInfo=d.colissage>1
    ? `<span class="colissage-info">${fmtPrice(d.prix_ht)}/u · ${d.colissage}u/colis</span>` : '';

  const lastHtml=lastQty>0&&!qtyColis
    ? `<div class="last-order" title="${escHtml(state.lastSemaine)}">↩ ${lastQty} colis la derniere fois</div>` : '';

  return `<div class="product-card${qtyColis>0?' has-qty':''}${isVariant?' is-variant':''}${hasOverride?' has-override':''}" data-key="${escHtml(key)}">
    <div class="product-info">
      <div class="product-nom-row">
        <span class="product-nom">${escHtml(mainLabel)}</span>
        <button class="edit-btn" data-key="${escHtml(key)}" title="Modifier">✏️</button>
      </div>
      ${subLabel?`<div class="product-sub">${escHtml(subLabel)}</div>`:''}
      <div class="product-meta">
        <span class="product-ref${hasOverride?' ref-override':''}">${escHtml(d.reference)}</span>
        <span class="product-prix">${fmtPrice(prixColis)}/colis</span>
        ${colissageInfo}
        ${qtyColis>0?`<span class="product-prix-total">${nbUnites} u. = ${fmtPrice(totalLigne)}</span>`:''}
        ${hasAlcool?'<span class="badge-alcool">🍷</span>':''}
      </div>
      ${lastHtml}
    </div>
    <div class="qty-stepper">
      <button class="qty-btn" data-key="${escHtml(key)}" data-delta="-1">−</button>
      <input class="qty-input" type="number" min="0" step="1" value="${qtyColis}" data-key="${escHtml(key)}" inputmode="numeric">
      <button class="qty-btn" data-key="${escHtml(key)}" data-delta="1">+</button>
    </div>
  </div>`;
}
function bindSteppers() {
  productList.querySelectorAll('.qty-btn').forEach(b=>b.addEventListener('click',onQtyBtn));
  productList.querySelectorAll('.qty-input').forEach(i=>{
    i.addEventListener('change',onQtyInput); i.addEventListener('focus',e=>e.target.select());
  });
  productList.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation(); openEditModal(b.dataset.key);
  }));
}

// ---- Qty --------------------------------------------------
function onQtyBtn(e) {
  const key=e.currentTarget.dataset.key;
  setQty(key,Math.max(0,(state.quantities[key]||0)+parseInt(e.currentTarget.dataset.delta)));
}
function onQtyInput(e) { setQty(e.currentTarget.dataset.key,Math.max(0,parseInt(e.currentTarget.value)||0)); }

function setQty(key,qty) {
  state.quantities[key]=qty;
  const card=productList.querySelector(`.product-card[data-key="${CSS.escape(key)}"]`);
  if(card){
    const p=state.produits.find(p=>productKey(p)===key);
    if(p){
      const isV=card.classList.contains('is-variant');
      const tmp=document.createElement('div'); tmp.innerHTML=renderRow(p,isV);
      const nc=tmp.firstElementChild; card.replaceWith(nc);
      nc.querySelectorAll('.qty-btn').forEach(b=>b.addEventListener('click',onQtyBtn));
      nc.querySelectorAll('.qty-input').forEach(i=>{ i.addEventListener('change',onQtyInput); i.addEventListener('focus',e=>e.target.select()); });
      nc.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',ev=>{ ev.stopPropagation(); openEditModal(b.dataset.key); }));
    }
  }
  updateAccordionBadge(key); updateTotal(); scheduleSave();
}

function updateAccordionBadge(changedKey) {
  const p=state.produits.find(p=>productKey(p)===changedKey); if(!p) return;
  const block=productList.querySelector(`.accordion-block[data-sup="${CSS.escape(p.fournisseur)}"]`); if(!block) return;
  const allP=getProduitsForEtab().filter(pr=>pr.fournisseur===p.fournisseur);
  const ordered=allP.filter(pr=>(state.quantities[productKey(pr)]||0)>0);
  const total=ordered.reduce((s,pr)=>s+(state.quantities[productKey(pr)]||0)*getPrixColis(pr),0);
  const left=block.querySelector('.acc-left'), badge=left.querySelector('.acc-badge');
  if(ordered.length){
    const h=`<span class="acc-badge">${ordered.length} art. · ${fmtPrice(total)}</span>`;
    if(badge) badge.outerHTML=h; else left.insertAdjacentHTML('beforeend',h);
  } else if(badge) badge.remove();
}

function updateTotal() {
  // Si on est en mode gérant → on masque totalement la barre du bas
  if (state.etab && state.etab.id === 'gerant') {
    bottomBar.style.display = 'none';
    summaryBtn.style.display = 'none';
    totalAmount.textContent = fmtPrice(0);
    return;
  }

  // Mode A ou B (inchangé)
  let total = 0, hasAny = false;

  getProduitsForEtab().forEach(p => {
    const qty = state.quantities[productKey(p)] || 0;
    if (qty > 0) {
      total += qty * getPrixColis(p);
      hasAny = true;
    }
  });

  totalAmount.textContent = fmtPrice(total);
  bottomBar.style.display = hasAny ? 'flex' : 'none';
  summaryBtn.style.display = hasAny ? 'flex' : 'none';
}


// ---- Modal edition ----------------------------------------
function openEditModal(key) {
  const p=state.produits.find(p=>productKey(p)===key); if(!p) return;
  const d=getProductData(p);
  state.editKey=key;
  $('editModalTitle').textContent='Modifier : '+p.nom_court;
  $('editRef').value=d.reference;
  $('editPrix').value=d.prix_ht;
  $('editColissage').value=d.colissage;
  editModal.style.display='flex';
}
function closeEditModal() { editModal.style.display='none'; state.editKey=null; }

async function applyEdit() {
  const key = state.editKey; if(!key) return;
  const p   = state.produits.find(p=>productKey(p)===key); if(!p) return;
  const d   = getProductData(p);
  const newRef       = $('editRef').value.trim();
  const newPrix      = parseFloat($('editPrix').value) || 0;
  const newColissage = parseInt($('editColissage').value) || 1;

  if(!CONFIG.APPS_SCRIPT_URL) {
    showToast('⚠️ Apps Script non configure dans config.js');
    return;
  }

  const btn = $('saveEditBtn');
  btn.disabled = true;
  btn.textContent = 'Sauvegarde...';

  try {
    const res  = await fetch(CONFIG.APPS_SCRIPT_URL+'?action=updateProduct', {
      method:  'POST',
      headers: {'Content-Type':'text/plain'},
      body:    JSON.stringify({
        fournisseur:  p.fournisseur,
        oldReference: d.reference,
        nomCourt:     p.nom_court,
        reference:    newRef,
        prix_ht:      newPrix,
        colissage:    newColissage,
      }),
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'Erreur inconnue');

    p.reference = newRef;
    p.prix_ht   = newPrix;
    p.colissage = newColissage;
    delete state.overrides[key];
    closeEditModal();
    renderAccordion();
    showToast('✅ Mis à jour dans le Sheet');
  } catch(err) {
    showToast('⚠️ Echec : ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Sauvegarder';
  }
}

$('saveEditBtn').addEventListener('click', applyEdit);
$('closeEditModal').addEventListener('click',closeEditModal);
$('cancelEditBtn').addEventListener('click',closeEditModal);
editModal.addEventListener('click',e=>{ if(e.target===editModal) closeEditModal(); });

// ---- Modal ajout ------------------------------------------
function openAddModal() {
  const sel=$('addFournisseur');
  sel.innerHTML=getSuppliers().map(s=>`<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
  ['addNomCourt','addDesignation','addRef','addCategorie','addPrix'].forEach(id=>$(id).value='');
  $('addColissage').value='1';
  addModal.style.display='flex';
}
function closeAddModal() { addModal.style.display='none'; }

$('saveAddBtn').addEventListener('click', async ()=>{
  const fournisseur = $('addFournisseur').value.trim();
  const nom_court   = $('addNomCourt').value.trim();
  if(!fournisseur||!nom_court){ showToast('⚠️ Fournisseur et nom court obligatoires'); return; }

  const designation  = $('addDesignation').value.trim() || nom_court;
  const reference    = $('addRef').value.trim() || 'NEW-'+Date.now();
  const categorie    = $('addCategorie').value.trim() || 'Divers';
  const prix_ht      = parseFloat($('addPrix').value) || 0;
  const colissage    = parseInt($('addColissage').value) || 1;
  const etablissement= state.etab && state.etab.id !== 'gerant'
                       ? state.etab.id.toUpperCase() : 'AB';

  const newProd = {
    fournisseur, reference, designation, label: cleanDesignation(designation),
    tva: 5.5, prix_ht, droit_alcool: 0, taxe_secu: 0,
    nom_court, categorie, colissage, prix_colis: 0,
    etablissement, actif: true, isTemp: !CONFIG.APPS_SCRIPT_URL,
  };

  const lastIdx = state.produits.reduce((acc, p, i) => p.fournisseur === fournisseur ? i : acc, -1);
  if(lastIdx >= 0) state.produits.splice(lastIdx + 1, 0, newProd);
  else state.produits.push(newProd);

  closeAddModal();
  renderAccordion();

  if(CONFIG.APPS_SCRIPT_URL) {
    showToast('⏳ Sauvegarde dans le Sheet...');
    try {
      const res  = await fetch(CONFIG.APPS_SCRIPT_URL+'?action=addProduct', {
        method: 'POST',
        headers: {'Content-Type':'text/plain'},
        body: JSON.stringify({ fournisseur, reference, designation, nom_court,
                               categorie, tva: 5.5, prix_ht, droit_alcool: 0,
                               taxe_secu: 0, etablissement, colissage })
      });
      const json = await res.json();
      if(!json.ok) throw new Error(json.error || "Erreur inconnue");
      showToast("✅ Produit ajouté dans le Sheet");
    } catch(err) {
      showToast("⚠️ Échec : " + err.message);
    }
  }
});
$('closeAddModal').addEventListener('click', closeAddModal);
$('cancelAddBtn').addEventListener('click', closeAddModal);
addModal.addEventListener('click', e => { if (e.target === addModal) closeAddModal(); });
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
async function copySummary(mode) {
  let text = '';
  const isGerant = state.etab && state.etab.id === 'gerant';

  if (isGerant) {
    if (mode === 'a' || mode === 'b') {
      text = buildCopyTextGerant(mode);
    } else {
      text = buildCopyTextGerant('all');
    }
  } else {
    text = buildCopyTextNormal();
  }

  await navigator.clipboard.writeText(text);
  showToast('📋 Copié');

  if (!isGerant) archiveCommande();
}

function buildCopyTextNormal() {
  let out = `Commande ${state.etab.label} — ${getWeekLabel()}\n\n`;
  const suppliers = getSuppliers();

  suppliers.forEach(sup => {
    const items = state.produits.filter(p => p.fournisseur === sup);
    let block = '';
    items.forEach(p => {
      const key = productKey(p);
      const qty = state.quantities[key] || 0;
      if (!qty) return;
      block += `${qty} × ${p.nom_court} (${p.reference})\n`;
    });
    if (block) out += `--- ${sup} ---\n${block}\n`;
  });

  return out.trim();
}

function buildCopyTextGerant(mode) {
  let out = `Commandes Gérant — ${getWeekLabel()}\n\n`;

  state.produits.forEach(p => {
    const key = productKey(p);
    const qa = state.quantities_a[key] || 0;
    const qb = state.quantities_b[key] || 0;

    if (mode === 'a' && !qa) return;
    if (mode === 'b' && !qb) return;
    if (mode === 'all' && !qa && !qb) return;

    out += `${p.nom_court} (${p.reference}) — A:${qa}  B:${qb}\n`;
  });

  return out.trim();
}

function resetCommande() {
  if (!confirm("Vider la commande ?")) return;

  if (state.etab.id === 'gerant') {
    state.quantities_a = {};
    state.quantities_b = {};
  } else {
    state.quantities = {};
  }

  clearCommandeRemote();
  closeSummary();
  render();
  showToast('🗑 Commande vidée');
}

// ============================================================
//  ARCHIVAGE ET RESET QTé GÉRANT ET ETAB A & B
// ============================================================
async function validateSupplier(sup) {
  if (!confirm("Valider la commande du fournisseur " + sup + " ?")) return;

  // 1. Archivage A et B pour CE fournisseur
  const itemsA = [];
  const itemsB = [];

  state.produits
    .filter(p => p.fournisseur === sup)
    .forEach(p => {
      const key = productKey(p);
      const prix = getPrixColis(p);

      const qa = state.quantities_a[key] || 0;
      const qb = state.quantities_b[key] || 0;

      if (qa > 0) {
        itemsA.push({
          key,
          nomCourt: p.nom_court,
          ref: p.reference,
          qty: qa,
          prixHt: p.prix_ht,
          total: qa * prix
        });
      }

      if (qb > 0) {
        itemsB.push({
          key,
          nomCourt: p.nom_court,
          ref: p.reference,
          qty: qb,
          prixHt: p.prix_ht,
          total: qb * prix
        });
      }
    });

  // Envoi archive A
  if (itemsA.length && CONFIG.APPS_SCRIPT_URL) {
    fetch(CONFIG.APPS_SCRIPT_URL + '?action=archive&etab=a', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        semaine: getWeekId(),
        etabLabel: "Établissement A",
        items: itemsA
      })
    });
  }

  // Envoi archive B
  if (itemsB.length && CONFIG.APPS_SCRIPT_URL) {
    fetch(CONFIG.APPS_SCRIPT_URL + '?action=archive&etab=b', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        semaine: getWeekId(),
        etabLabel: "Établissement B",
        items: itemsB
      })
    });
  }

  // 2. Reset des quantités A/B pour CE fournisseur
  state.produits
    .filter(p => p.fournisseur === sup)
    .forEach(p => {
      const key = productKey(p);
      delete state.quantities_a[key];
      delete state.quantities_b[key];
    });

  // 3. Sauvegarde distante (efface aussi côté A/B)
  scheduleSave();

  // 4. Re-render
  renderAccordionGerant();

  // 5. Met à jour le total dans la barre du bas ("Voir la commande")
  if (typeof updateTotal === 'function') {
    updateTotal();
  }

  // 6. Toast
  showToast("📦 Commande validée pour " + sup);
}


// ============================================================
//  RENDER ACCORDION GÉRANT
// ============================================================

function renderAccordionGerant() {
  const produits = state.produits;

  // Liste brute des fournisseurs
  const suppliers = [...new Set(produits.map(p => p.fournisseur))];

  // --- 1) Calcul des totaux par fournisseur ---
  const supplierTotals = suppliers.map(sup => {
    const items = produits.filter(p => p.fournisseur === sup);
    let totalA = 0, totalB = 0;

    items.forEach(p => {
      const key = productKey(p);
      const prix = getPrixColis(p);
      totalA += (state.quantities_a[key] || 0) * prix;
      totalB += (state.quantities_b[key] || 0) * prix;
    });

    return {
      sup,
      totalA,
      totalB,
      totalGlobal: totalA + totalB
    };
  });

  // --- 2) Tri : fournisseurs avec commande en premier ---
  supplierTotals.sort((a, b) => {
    if (b.totalGlobal !== a.totalGlobal) {
      return b.totalGlobal - a.totalGlobal; // commandes en haut
    }
    return a.sup.localeCompare(b.sup, 'fr'); // tri alpha
  });

  const logoA = CONFIG.ETABS.find(e => e.id === 'a').icon;
  const logoB = CONFIG.ETABS.find(e => e.id === 'b').icon;

  let html = '';

  // --- 3) Construction de l'accordéon ---
  supplierTotals.forEach(({ sup, totalA, totalB, totalGlobal }) => {
    const items = produits.filter(p => p.fournisseur === sup);
    const isOpen = state.openSupplier === sup;

    html += `
      <div class="accordion-block ${isOpen ? 'is-open' : ''} ${ (totalA+totalB)>0 ? 'has-order' : ''}">
        <div class="accordion-header" data-supplier="${sup}">
          <div class="acc-left">
            <span class="acc-name">${escHtml(sup)}</span>
            <span class="acc-total">${fmtPrice(totalGlobal)}</span>
          </div>
          <button class="validate-supplier-btn" data-supplier="${sup}">
            Valider
          </button>
        </div>
    `;

    if (isOpen) {
      html += `
        <table class="gerant-table">
          <thead>
            <tr>
              <th rowspan="2">Produit</th>
              <th><img src="${logoA}" class="etab-logo-head"></th>
              <th><img src="${logoB}" class="etab-logo-head"></th>
            </tr>
            <tr>
              <th>${fmtPrice(totalA)}</th>
              <th>${fmtPrice(totalB)}</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Tri des produits : ceux commandés en premier
      const sorted = [...items].sort((a, b) => {
        const ka = productKey(a), kb = productKey(b);
        const ta = (state.quantities_a[ka] || 0) + (state.quantities_b[ka] || 0);
        const tb = (state.quantities_a[kb] || 0) + (state.quantities_b[kb] || 0);
        return tb - ta;
      });

      sorted.forEach(p => {
        const key = productKey(p);
        const qa = state.quantities_a[key] || 0;
        const qb = state.quantities_b[key] || 0;

        html += `
          <tr data-key="${escHtml(key)}">
            <td>${escHtml(p.designation)}</td>

            <td>
              <div class="qty-cell">
                <button class="qty-btn-g" data-key="${key}" data-etab="a" data-delta="-1">−</button>
                <input class="qty-input-g" type="number" value="${qa}" min="0" data-key="${key}" data-etab="a">
                <button class="qty-btn-g" data-key="${key}" data-etab="a" data-delta="1">+</button>
              </div>
            </td>

            <td>
              <div class="qty-cell">
                <button class="qty-btn-g" data-key="${key}" data-etab="b" data-delta="-1">−</button>
                <input class="qty-input-g" type="number" value="${qb}" min="0" data-key="${key}" data-etab="b">
                <button class="qty-btn-g" data-key="${key}" data-etab="b" data-delta="1">+</button>
              </div>
            </td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    html += `</div>`;
  });

  productList.innerHTML = html;

  // --- 4) Gestion ouverture accordéon ---
  document.querySelectorAll('.accordion-header').forEach(h => {
    h.addEventListener('click', e => {
      if (e.target.classList.contains('validate-supplier-btn')) return;
      const sup = h.dataset.supplier;
      state.openSupplier = (state.openSupplier === sup ? null : sup);
      renderAccordionGerant();
    });
  });

  // --- 5) Bouton valider ---
  document.querySelectorAll('.validate-supplier-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      validateSupplier(btn.dataset.supplier);
    });
  });

  // --- 6) Steppers ---
  bindGerantSteppers();
}

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

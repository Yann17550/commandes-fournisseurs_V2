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
  openSupplier: null, search: '', loaded: false, error: null, editKey: null,
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
  if(!CONFIG.APPS_SCRIPT_URL) return {};
  try {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL+'?action=read&etab='+etabId);
    return r.ok ? (await r.json())||{} : {};
  } catch { return {}; }
}
async function loadHistoRemote() {
  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') return {};
  try {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL+'?action=histo&etab='+state.etab.id);
    return r.ok ? (await r.json())||{} : {};
  } catch { return {}; }
}
async function archiveCommande() {
  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') return;
  const items = [];
  state.produits.forEach(p=>{
    const qty = state.quantities[productKey(p)]||0; if(!qty) return;
    const d = getProductData(p);
    items.push({key:productKey(p), nomCourt:p.nom_court, ref:d.reference,
                qty, prixHt:d.prix_ht, total:qty*getPrixColis(p)});
  });
  if(!items.length) return;
  fetch(CONFIG.APPS_SCRIPT_URL+'?action=archive&etab='+state.etab.id,{
    method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({semaine:getWeekId(), etabLabel:state.etab.label, items}),
  }).catch(()=>{});
}
async function clearCommandeRemote() {
  if(!CONFIG.APPS_SCRIPT_URL||!state.etab||state.etab.id==='gerant') return;
  fetch(CONFIG.APPS_SCRIPT_URL+'?action=clear&etab='+state.etab.id,{method:'POST',mode:'no-cors'}).catch(()=>{});
}
function showSaveStatus(msg) {
  if(!saveStatusEl) return;
  saveStatusEl.textContent=msg; saveStatusEl.style.opacity='1';
  clearTimeout(saveStatusEl._t);
  if(msg.includes('OK')) saveStatusEl._t=setTimeout(()=>{ saveStatusEl.style.opacity='0'; },2500);
}

// ---- Ecran etablissement ----------------------------------
function renderEtabScreen() {
  etabCards.innerHTML = CONFIG.ETABS.map(e=>`
    <button class="etab-card" data-etab="${e.id}">
      <span class="etab-card-icon">${e.icon}</span>
      <span class="etab-card-label">${escHtml(e.label)}</span>
    </button>`).join('');
  etabCards.querySelectorAll('.etab-card').forEach(btn=>{
    btn.addEventListener('click',()=>selectEtab(btn.dataset.etab));
  });
  screenEtab.style.display='flex';
  screenApp.style.display='none';
}

async function selectEtab(id) {
  const etab = CONFIG.ETABS.find(e=>e.id===id); if(!etab) return;
  const prevId = state.etab ? state.etab.id : null;
  state.etab = etab; saveEtabLocal(id);
  etabPill.textContent = etab.icon+' '+etab.label;
  $('summaryTitle').textContent = 'Commande \u2014 '+etab.label;
  screenEtab.style.display='none';
  screenApp.style.display='flex';
  switchEtabBtn.style.display='block';

  if(!state.loaded) {
    loadData();
  } else if(prevId !== id) {
    // Changement d'etab : garde les produits, recharge juste la commande
    loadingState.style.display='flex';
    productList.style.display='none';
    if(id === 'gerant') {
      const [savedA, savedB] = await Promise.all([
        loadCommandeRemoteById('a'),
        loadCommandeRemoteById('b'),
      ]);
      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};
    } else {
      const [saved, histo] = await Promise.all([
        loadCommandeRemoteById(id),
        loadHistoRemote(),
      ]);
      state.quantities = saved || {};
      if(histo && histo.quantities){ state.lastOrder=histo.quantities||{}; state.lastSemaine=histo.semaine||''; }
    }
    state.openSupplier = null;
    render();
  } else {
    render();
  }
}

switchEtabBtn.addEventListener('click',()=>{
  screenApp.style.display='none'; renderEtabScreen();
});
etabPill.addEventListener('click',()=>{
  screenApp.style.display='none'; renderEtabScreen();
});

// ---- Chargement -------------------------------------------
async function loadData() {
  loadingState.style.display='flex'; productList.style.display='none'; state.error=null;
  try {
    const [tsvP,tsvF] = await Promise.all([
      fetch(CONFIG.SHEETS.produits,{cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }),
      fetch(CONFIG.SHEETS.fournisseurs,{cache:'no-store'}).then(r=>r.text()).catch(()=>''),

    ]);
    state.produits = parseProduits(tsvP);
    state.fournisseurs = parseFournisseurs(tsvF);
    state.loaded = true;
    const sups = getSuppliers(); void sups;

    if(state.etab && state.etab.id === 'gerant') {
      const [savedA, savedB] = await Promise.all([
        loadCommandeRemoteById('a'),
        loadCommandeRemoteById('b'),
      ]);
      state.quantities_a = savedA || {};
      state.quantities_b = savedB || {};
      if(Object.keys(state.quantities_a).length>0 || Object.keys(state.quantities_b).length>0)
        showToast('📂 Commandes restaurées');
    } else {
      const [saved, histo] = await Promise.all([loadCommandeRemote(), loadHistoRemote()]);
      if(Object.keys(saved).length>0){ state.quantities=saved; showToast('📂 Commande restauree'); }
      if(histo&&histo.quantities){ state.lastOrder=histo.quantities||{}; state.lastSemaine=histo.semaine||''; }
    }
    render();
  } catch(err) {
    console.error(err); state.error=err.message;
    loadingState.style.display='none'; renderError();
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
  if(state.etab && state.etab.id === 'gerant') { renderAccordionGerant(); return; }
  const suppliers=getSuppliers(), search=state.search.toLowerCase();
  const allProds=getProduitsForEtab();
  if(!suppliers.length){
    productList.innerHTML='<div class="empty-state"><div class="emoji">📭</div><p>Aucun produit</p></div>'; return;
  }

  let html='<div class="fab-row"><button class="fab-add" id="fabAddBtn">+ Nouveau produit</button></div>';

  suppliers.forEach(sup=>{
    const prods=allProds.filter(p=>{
      if(p.fournisseur!==sup) return false;
      if(!search) return true;
      return p.nom_court.toLowerCase().includes(search)
          ||p.designation.toLowerCase().includes(search)
          ||p.reference.toLowerCase().includes(search);
    });
    if(search&&prods.length===0) return;
    const isOpen=state.openSupplier===sup;
    const ordered=prods.filter(p=>(state.quantities[productKey(p)]||0)>0);
    const supTotal=ordered.reduce((s,p)=>s+(state.quantities[productKey(p)]||0)*getPrixColis(p),0);
    const appel=getJourAppel(sup);
    const appelHtml=appel
      ? '<span class="acc-appel'+(appel.today?' acc-appel--today':'')+'">'+
        (appel.today?'📞 Auj.':escHtml(appel.label))+'</span>'
      : '';

    html+=`<div class="accordion-block${isOpen?' is-open':''}" data-sup="${escHtml(sup)}">
      <button class="accordion-header" data-sup="${escHtml(sup)}">
        <div class="acc-left">
          <div class="acc-title-row">
            <span class="acc-name">${escHtml(sup)}</span>
            ${appelHtml}
          </div>
          ${ordered.length?`<span class="acc-badge">${ordered.length} art. · ${fmtPrice(supTotal)}</span>`:''}
        </div>
        <span class="acc-chevron">${isOpen?'▾':'▸'}</span>
      </button>
      ${isOpen?renderSupplierBody(prods,search):''}
    </div>`;
  });

  productList.innerHTML=html||'<div class="empty-state"><div class="emoji">🔍</div><p>Aucun resultat</p></div>';
  const fab=$('fabAddBtn'); if(fab) fab.addEventListener('click',openAddModal);
  productList.querySelectorAll('.accordion-header').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const sup=btn.dataset.sup;
      state.openSupplier=state.openSupplier===sup?null:sup;
      renderAccordion();
      setTimeout(()=>{ const o=productList.querySelector('.accordion-block.is-open'); if(o) o.scrollIntoView({behavior:'smooth',block:'start'}); },40);
    });
  });
  bindSteppers();
}

function renderSupplierBody(prods,search) {
  if(!prods.length) return '<div class="acc-body"><div class="empty-state"><p>Aucun produit</p></div></div>';
  const scores=getScores(), sorted=sortProducts(prods);
  const sup=prods[0].fournisseur, fInfo=state.fournisseurs[sup]||{};
  let html='<div class="acc-body">';
  const infos=[];
  if(fInfo.contact)   infos.push('👤 '+escHtml(fInfo.contact));
  if(fInfo.telephone) infos.push('📱 '+escHtml(fInfo.telephone));
  if(fInfo.notes)     infos.push('⚠️ '+escHtml(fInfo.notes));
  if(infos.length) html+=`<div class="acc-info-bar">${infos.join(' · ')}</div>`;
  if(search) {
    html+=renderGrouped(sorted);
  } else {
    const habituels=sorted.filter(p=>scores[productKey(p)]>0);
    const autres=sorted.filter(p=>!scores[productKey(p)]);
    if(habituels.length){
      html+='<div class="section-label">⭐ Habituels</div>'+renderGrouped(habituels);
      if(autres.length) html+='<div class="section-label section-label--secondary">Catalogue complet</div>'+renderGrouped(autres);
    } else {
      html+=renderGrouped(sorted);
    }
  }
  html+='</div>'; return html;
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
  let total=0, hasAny=false;
  if(state.etab && state.etab.id==='gerant') {
    state.produits.forEach(p=>{
      const key=productKey(p);
      const qa=(state.quantities_a[key]||0), qb=(state.quantities_b[key]||0);
      const qt=qa+qb;
      if(qt>0){ total+=qt*getPrixColis(p); hasAny=true; }
    });
  } else {
    getProduitsForEtab().forEach(p=>{
      const qty=state.quantities[productKey(p)]||0;
      if(qty>0){ total+=qty*getPrixColis(p); hasAny=true; }
    });
  }
  totalAmount.textContent=fmtPrice(total);
  bottomBar.style.display=hasAny?'flex':'none';
  summaryBtn.style.display=hasAny?'flex':'none';
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
//  RENDER ACCORDION GÉRANT
// ============================================================
function renderAccordionGerant() {
  const produits = state.produits;
  const suppliers = [...new Set(produits.map(p => p.fournisseur))].sort((a, b) => a.localeCompare(b, 'fr'));

  let html = '';

  suppliers.forEach(sup => {
    const items = produits.filter(p => p.fournisseur === sup);
    const totalA = items.reduce((s, p) => s + (state.quantities_a[productKey(p)] || 0) * getPrixColis(p), 0);
    const totalB = items.reduce((s, p) => s + (state.quantities_b[productKey(p)] || 0) * getPrixColis(p), 0);
    const total = totalA + totalB;

    html += `
      <div class="accordion-block is-open">
        <div class="accordion-header">
          <div class="acc-left">
            <span class="acc-name">${escHtml(sup)}</span>
            <span class="gerant-badge">
              <span class="gb-a">${fmtPrice(totalA)}</span>
              <span class="gb-sep">/</span>
              <span class="gb-b">${fmtPrice(totalB)}</span>
              <span class="gb-total">${fmtPrice(total)}</span>
            </span>
          </div>
        </div>
        <div class="acc-body">
          ${items.map(renderGerantRow).join('')}
        </div>
      </div>`;
  });

  productList.innerHTML = html;
  bindGerantSteppers();
}

function renderGerantRow(p) {
  const key = productKey(p);
  const qa = state.quantities_a[key] || 0;
  const qb = state.quantities_b[key] || 0;
  const prix = getPrixColis(p);

  const totalA = qa * prix;
  const totalB = qb * prix;

  return `
    <div class="gerant-row ${qa || qb ? 'gerant-row--active' : ''}" data-key="${escHtml(key)}">
      <div class="gr-header">
        <div class="gr-info">
          <div class="product-nom">${escHtml(p.nom_court)}</div>
          <div class="gr-ref">${escHtml(p.reference)}</div>
        </div>
        <button class="edit-btn" data-key="${escHtml(key)}">✏️</button>
      </div>

      <div class="gr-steppers">
        <div class="gr-etab-row gr-etab-row--a">
          <span class="gr-etab-icon">🍕</span>
          <div class="qty-stepper--sm">
            <button class="qty-btn-g" data-key="${escHtml(key)}" data-etab="a" data-delta="-1">−</button>
            <input class="qty-input-g" type="number" value="${qa}" min="0" data-key="${escHtml(key)}" data-etab="a">
            <button class="qty-btn-g" data-key="${escHtml(key)}" data-etab="a" data-delta="1">+</button>
          </div>
          <span class="gr-line-total ${totalA ? 'gr-line-total--active' : ''}">${totalA ? fmtPrice(totalA) : ''}</span>
        </div>

        <div class="gr-etab-row gr-etab-row--b">
          <span class="gr-etab-icon">🌋</span>
          <div class="qty-stepper--sm">
            <button class="qty-btn-g" data-key="${escHtml(key)}" data-etab="b" data-delta="-1">−</button>
            <input class="qty-input-g" type="number" value="${qb}" min="0" data-key="${escHtml(key)}" data-etab="b">
            <button class="qty-btn-g" data-key="${escHtml(key)}" data-etab="b" data-delta="1">+</button>
          </div>
          <span class="gr-line-total ${totalB ? 'gr-line-total--active' : ''}">${totalB ? fmtPrice(totalB) : ''}</span>
        </div>
      </div>
    </div>`;
}

function bindGerantSteppers() {
  productList.querySelectorAll('.qty-btn-g').forEach(b => b.addEventListener('click', onGerantQtyBtn));
  productList.querySelectorAll('.qty-input-g').forEach(i => {
    i.addEventListener('change', onGerantQtyInput);
    i.addEventListener('focus', e => e.target.select());
  });
  productList.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    openEditModal(b.dataset.key);
  }));
}

function onGerantQtyBtn(e) {
  const key = e.currentTarget.dataset.key;
  const etab = e.currentTarget.dataset.etab;
  const delta = parseInt(e.currentTarget.dataset.delta);

  const obj = etab === 'a' ? state.quantities_a : state.quantities_b;
  obj[key] = Math.max(0, (obj[key] || 0) + delta);

  renderAccordionGerant();
  updateTotal();
  scheduleSave();
}

function onGerantQtyInput(e) {
  const key = e.currentTarget.dataset.key;
  const etab = e.currentTarget.dataset.etab;
  const val = Math.max(0, parseInt(e.currentTarget.value) || 0);

  const obj = etab === 'a' ? state.quantities_a : state.quantities_b;
  obj[key] = val;

  renderAccordionGerant();
  updateTotal();
  scheduleSave();
}

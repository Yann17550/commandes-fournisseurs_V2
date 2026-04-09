// ============================================================
//  STATE GLOBAL + UTILITAIRES GÉNÉRAUX
// ============================================================

window.__FILE_VERSIONS__ = window.__FILE_VERSIONS__ || {};
window.__FILE_VERSIONS__["state.js"] = "2026-04-06T18:31:00";

// ---- State --------------------------------------------------
let state = {
  etab: null,
  produits: [],
  fournisseurs: {},
  quantities:   {},   // commande de l'etab courant (A ou B)
  quantities_a: {},   // commande Pizza d'Oleron  (vue gérant)
  quantities_b: {},   // commande Le Vesuvio       (vue gérant)
  lastOrder: {},
  lastSemaine: '',
  overrides: {},
  openSupplier: null,
  loaded: false,
  error: null,
  editKey: null,
};

// ---- DOM Helpers -------------------------------------------
const $ = id => document.getElementById(id);

// ---- Utils --------------------------------------------------
function getWeekLabel() {
  const now = new Date(), start = new Date(now.getFullYear(),0,1);
  const w = Math.ceil(((now-start)/86400000+start.getDay()+1)/7);
  return 'S'+w+' — '+now.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
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
  return n.toLocaleString('fr-FR',{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  })+' €';
}

function fmtPriceNoEuro(v) {
  return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
}

function productKey(p) {
  return p.fournisseur+'||'+p.reference+'||'+p.nom_court;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2500);
}

function isSaison() {
  return (CONFIG.MOIS_SAISON||[]).includes(new Date().getMonth()+1);
}

// ---- Nettoyage designation --------------------------------
function cleanDesignation(s) {
  s = (s||'');
  [
    /\s*-\s*DROIT ALCOOL.*/i,
    /\s*-\s*droit sur alcool.*/i,
    /\s*\+\s*TAXE SECURITE SOCIALE.*/i,
    /\s*-\s*TAXE.*/i,
    /\s*\(pack x\d+\)/i
  ].forEach(re => { s = s.replace(re,''); });

  s = s.trim();
  if(s===s.toUpperCase()) {
    s = s.toLowerCase().replace(/(?:^|\s)\S/g,c=>c.toUpperCase());
  }
  return s.trim();
}

// ---- Parsing TSV ------------------------------------------
function parseTSV(tsv) {
  const lines = tsv.trim().split('\n').map(l=>l.split('\t').map(c=>c.trim()));
  if(lines.length<2) return [];
  const h = lines[0];
  return lines.slice(1)
    .filter(r=>r.some(c=>c!==''))
    .map(row=>{
      const o={};
      h.forEach((k,i)=>o[k]=row[i]??'');
      return o;
    });
}

function parseProduits(tsv) {
  const C = CONFIG.COLS;
  return parseTSV(tsv)
    .filter(r=>{
      const a=(r[C.actif]||'').toUpperCase();
      return a===''||a==='TRUE';
    })
    .filter(r=>(r[C.nom_court]||'').trim()&&(r[C.fournisseur]||'').trim())
    .map(r=>{
      const nom_court = (r[C.nom_court]||'').trim();
      const designation = (r[C.designation]||'').trim();
      const etabVal = (r[C.etablissement]||'').trim().toUpperCase();
      return {
        fournisseur:  (r[C.fournisseur]||'').trim(),
        reference:    (r[C.reference]||'').trim(),
        designation,
        label: cleanDesignation(designation),
        tva:          parseNum(r[C.tva]),
        prix_ht:      parseNum(r[C.prix_ht]),
        droit_alcool: parseNum(r[C.droit_alcool]),
        taxe_secu:    parseNum(r[C.taxe_secu]),
        nom_court,
        categorie:    (r[C.categorie]||'Divers').trim(),
        colissage:    parseNum(r[C.colissage])||1,
        prix_colis:   parseNum(r[C.prix_colis]),
        etablissement: etabVal||'AB',
        actif: true,
        isTemp: false,
      };
    });
}

function parseFournisseurs(tsv) {
  if(!tsv) return {};
  const CF = CONFIG.COLS_F, map = {};
  parseTSV(tsv).forEach(r=>{
    const nom = (r[CF.nom]||'').trim();
    if(!nom) return;
    map[nom] = {
      telephone: (r[CF.telephone]||'').trim(),
      contact: (r[CF.contact]||'').trim(),
      jour_saison: (r[CF.jour_saison]||'').trim(),
      jour_hors_saison: (r[CF.jour_hors_saison]||'').trim(),
      notes: (r[CF.notes]||'').trim(),
    };
  });
  return map;
}

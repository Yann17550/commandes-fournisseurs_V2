// ============================================================
//  UNSAVED_CHANGES.JS — Gestion des modifications non enregistrées
//  Flag global + dialogue + beforeunload (version simple « tout ou rien »)
// ============================================================

let hasPendingChanges = false;

// Callback optionnels fournis par l'app principale
let onSaveAllCallback = null;    // fonction async ou sync
let onRevertAllCallback = null;  // fonction async ou sync

// ------------------------------------------------------------
// Initialisation — à appeler depuis app.js (ou autre)
// en lui passant comment sauvegarder / annuler TOUT
// ------------------------------------------------------------
function initUnsavedChangesManager({ onSaveAll, onRevertAll }) {
  onSaveAllCallback = typeof onSaveAll === 'function' ? onSaveAll : null;
  onRevertAllCallback = typeof onRevertAll === 'function' ? onRevertAll : null;

  // Gestion de la sortie de page (fermeture onglet, reload, changement d'URL)
  window.addEventListener('beforeunload', (event) => {
    if (!hasPendingChanges) return;

    // Demander au navigateur d'afficher l'alerte générique
    event.preventDefault();
    event.returnValue = '';
  });
}

// ------------------------------------------------------------
// Marquer qu'il y a des changements non enregistrés
// ------------------------------------------------------------
function markPendingChanges() {
  hasPendingChanges = true;
}

// ------------------------------------------------------------
// Effacer le flag (après enregistrement ou annulation globale)
// ------------------------------------------------------------
function clearPendingChanges() {
  hasPendingChanges = false;
}

// ------------------------------------------------------------
// Savoir s'il y a des changements en attente
// ------------------------------------------------------------
function hasPending() {
  return hasPendingChanges;
}

// ------------------------------------------------------------
// Dialogue global à 3 choix, synchrone, qui renvoie:
//  'save'   → enregistrer tout
//  'discard'→ annuler tout
//  'keep'   → garder sans enregistrer
//
// Ici on utilise confirm() pour rester simple :
// - confirm() == true  → 'save'
// - confirm() == false → on redemande pour distinguer 'discard' vs 'keep'
// ------------------------------------------------------------
function askUnsavedChangesAction() {
  // 1er niveau : veux-tu enregistrer maintenant ?
  const wantsSave = window.confirm(
    "Tu as des modifications non enregistrées.\n\n" +
    "OK = Enregistrer maintenant\n" +
    "Annuler = Autre choix"
  );

  if (wantsSave) {
    return 'save';
  }

  // 2e niveau : tu ne veux pas enregistrer tout de suite.
  // On te demande : annuler ou garder ?
  const wantsDiscard = window.confirm(
    "Que veux-tu faire ?\n\n" +
    "OK = Annuler les modifications (revenir au dernier état enregistré)\n" +
    "Annuler = Garder les modifications sans enregistrer"
  );

  if (wantsDiscard) {
    return 'discard';
  }

  return 'keep';
}

// ------------------------------------------------------------
// Fonction utilitaire : à appeler quand on s'apprête
// à QUITTER une vue (changement de fournisseur, etc.)
//
// Elle applique la logique « tout ou rien » :
//  - 'save'   → onSaveAllCallback() puis clearPendingChanges()
//  - 'discard'→ onRevertAllCallback() puis clearPendingChanges()
//  - 'keep'   → ne fait rien (hasPendingChanges reste true)
// ------------------------------------------------------------
async function handleUnsavedChangesIfNeeded() {
  if (!hasPendingChanges) {
    return true; // rien à faire, on peut continuer
  }

  const action = askUnsavedChangesAction();

  if (action === 'save') {
    if (onSaveAllCallback) {
      await onSaveAllCallback();
    }
    clearPendingChanges();
    return true;
  }

  if (action === 'discard') {
    if (onRevertAllCallback) {
      await onRevertAllCallback();
    }
    clearPendingChanges();
    return true;
  }

  // 'keep' → on ne sauve pas, on ne revert pas, on garde le flag à true
  return true;
}

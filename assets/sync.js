/* ------------------------------------------------------------------
   Couche de synchronisation.

   TRANCHE 1 (actuelle) : implémentation locale. Chaque appareil ne voit
   que lui-même — suffisant pour dérouler le parcours et répéter, pas
   pour l'atelier réel.

   TRANCHE 2 : cette implémentation est remplacée par Firebase Realtime
   Database. L'interface ci-dessous ne bouge pas, rien d'autre n'est à
   modifier dans app.js ni dans ecran.js.

     Sync.init(surChangement)     écoute l'état de la session
     Sync.reserver(n)             réserve le numéro de groupe n
     Sync.envoyer(n, {ia, final}) publie la trace du groupe n
     Sync.etat()                  dernier état connu
     Sync.reset()                 vide la session (pilotage écran)
   ------------------------------------------------------------------ */

const Sync = (() => {
  const SESSION = "oareil-2026-09-11";
  let etat = { groupes: {} };
  let abonnes = [];

  function notifier() {
    abonnes.forEach(f => f(etat));
  }

  /* --- tranche 1 : mémoire de l'onglet, + BroadcastChannel pour tester
         écran et téléphone dans deux onglets du même navigateur --- */
  let canal = null;
  try {
    canal = new BroadcastChannel("oareil-" + SESSION);
    canal.onmessage = e => { etat = e.data; notifier(); };
  } catch (_) { /* navigateur sans BroadcastChannel : sans effet */ }

  function diffuser() {
    if (canal) { try { canal.postMessage(etat); } catch (_) {} }
    notifier();
  }

  return {
    session: SESSION,

    init(surChangement) {
      abonnes.push(surChangement);
      surChangement(etat);
    },

    reserver(n) {
      if (etat.groupes[n]) return false;
      etat.groupes[n] = { pris: true, statut: "installe" };
      diffuser();
      return true;
    },

    statut(n, statut) {
      etat.groupes[n] = Object.assign({ pris: true }, etat.groupes[n], { statut });
      diffuser();
    },

    envoyer(n, trace) {
      etat.groupes[n] = Object.assign({ pris: true }, etat.groupes[n], {
        statut: "envoye",
        ia: trace.ia,
        final: trace.final,
        heure: Date.now()
      });
      diffuser();
      return Promise.resolve();
    },

    etat() { return etat; },

    reset() {
      etat = { groupes: {} };
      diffuser();
    }
  };
})();

/* ------------------------------------------------------------------
   Couche de synchronisation — Firebase Realtime Database.

   UNE SEULE CHOSE À FAIRE ICI : coller les quatre valeurs de ton
   projet Firebase dans CONFIG ci-dessous. Rien d'autre.

   Ces valeurs sont publiques par construction : ce sont les règles de
   la base qui protègent, pas leur secret.

   Si le SDK Firebase ne se charge pas (CDN bloqué, réseau coupé), le
   module bascule tout seul sur une implémentation locale : chaque
   appareil ne voit plus que lui-même, mais rien ne plante et le
   parcours reste utilisable.
   ------------------------------------------------------------------ */

const Sync = (() => {

  const CONFIG = {
    apiKey:      "AIzaSyAfly6DF2_0-Z3K7PIM95x3hLVo8tQ0PoQ",
    authDomain:  "oareil.firebaseapp.com",
    databaseURL: "https://oareil-default-rtdb.europe-west1.firebasedatabase.app",   // indispensable, doit contenir "firebasedatabase.app"
    projectId:   "oareil"
  };

  const SESSION = "oareil-2026-09-11";
  const GROUPES = [1, 2, 3];

  let etat = { groupes: {} };
  const abonnes = [];
  let racine = null;
  let distant = false;

  function notifier() { abonnes.forEach(f => f(etat)); }

  /* ---------- branchement Firebase ---------- */
  try {
    if (typeof firebase === "undefined") throw new Error("SDK absent");
    if (CONFIG.apiKey === "A_COLLER") throw new Error("config non renseignee");

    firebase.initializeApp(CONFIG);
    racine = firebase.database().ref("sessions/" + SESSION + "/groupes");
    distant = true;

    racine.on("value", snap => {
      etat = { groupes: snap.val() || {} };
      notifier();
    }, err => {
      console.warn("[sync] lecture refusee :", err && err.message);
    });

    console.info("[sync] Firebase actif — session", SESSION);
  } catch (e) {
    console.warn("[sync] mode local :", e.message,
      "— le telephone et l'ecran ne se parleront pas entre appareils.");
  }

  /* ---------- repli local (mode degrade) ---------- */
  let canal = null;
  if (!distant) {
    try {
      canal = new BroadcastChannel("oareil-" + SESSION);
      canal.onmessage = e => { etat = e.data; notifier(); };
    } catch (_) {}
  }
  function diffuserLocal() {
    if (canal) { try { canal.postMessage(etat); } catch (_) {} }
    notifier();
  }

  /* ---------- interface ---------- */
  return {
    session: SESSION,
    distant: () => distant,

    init(surChangement) {
      abonnes.push(surChangement);
      surChangement(etat);
    },

    /* Reservation atomique : si deux telephones tapent le meme numero
       a la meme seconde, un seul l'obtient. C'est la transaction qui
       le garantit, pas le bouton grise. */
    reserver(n) {
      if (!distant) {
        if (etat.groupes[n] && etat.groupes[n].pris) return Promise.resolve(false);
        etat.groupes[n] = { pris: true, statut: "installe" };
        diffuserLocal();
        return Promise.resolve(true);
      }
      return racine.child(String(n))
        .transaction(actuel => {
          if (actuel && actuel.pris) return undefined;     // deja pris : on abandonne
          return { pris: true, statut: "installe" };
        })
        .then(r => !!(r && r.committed))
        .catch(err => {
          console.warn("[sync] reservation impossible :", err && err.message);
          return false;
        });
    },

    statut(n, statut) {
      if (!distant) {
        etat.groupes[n] = Object.assign({ pris: true }, etat.groupes[n], { statut });
        diffuserLocal();
        return Promise.resolve();
      }
      return racine.child(String(n)).update({ statut }).catch(() => {});
    },

    envoyer(n, trace) {
      const charge = {
        pris: true,
        statut: "envoye",
        ia: String(trace.ia).slice(0, 3000),
        final: String(trace.final).slice(0, 3000),
        heure: Date.now()
      };
      if (!distant) {
        etat.groupes[n] = Object.assign({}, etat.groupes[n], charge);
        diffuserLocal();
        return Promise.resolve();
      }
      return racine.child(String(n)).update(charge);
    },

    etat() { return etat; },

    /* Effacement groupe par groupe : les regles n'autorisent l'ecriture
       que sur les noeuds 1, 2 et 3, jamais sur leur parent. */
    reset() {
      if (!distant) { etat = { groupes: {} }; diffuserLocal(); return Promise.resolve(); }
      return Promise.all(GROUPES.map(n => racine.child(String(n)).remove()))
        .catch(err => console.warn("[sync] reset partiel :", err && err.message));
    }
  };
})();

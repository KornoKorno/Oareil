/* ------------------------------------------------------------------
   L'écran témoin, projeté au mur.
   Pilotage entièrement au clavier : rien ne doit être cliqué devant
   la salle.

     T   traces complètes          A   seulement les ajouts
     Q   voile QR / adresse        ?   aide des raccourcis
     R   réinitialiser (double)    1 2 3   injecter une trace (répétition)
   ------------------------------------------------------------------ */

let MODE = "traces";      // "traces" | "ajouts"
let confirmeReset = false;

const $ = id => document.getElementById(id);

/* ---------- rendu ---------- */

function colonne(cas, donnees) {
  if (!donnees || !donnees.final) {
    return `<div class="col vide">
      <div class="num">Groupe ${cas.n}</div>
      <div class="cas">${echapper(cas.titre)}</div>
      <div class="vide-corps">
        <div class="points"><i></i><i></i><i></i></div>
        <p>${donnees && donnees.pris ? "En travail autour de la table." : "En attente."}</p>
      </div>
    </div>`;
  }
  const html = ajouts(donnees.ia, donnees.final).map(p => {
    if (p.neuf) return `<ins>${echapper(p.t)}</ins>`;
    return MODE === "ajouts" ? `<span class="eteint">${echapper(p.t)}</span>` : echapper(p.t);
  }).join("");
  return `<div class="col">
    <div class="num">Groupe ${cas.n}</div>
    <div class="cas">${echapper(cas.titre)}</div>
    <div class="trace">${html}</div>
  </div>`;
}

function rendre(etat) {
  $("colonnes").innerHTML = CAS.map(c => colonne(c, etat.groupes[c.n])).join("");
  const n = CAS.filter(c => etat.groupes[c.n] && etat.groupes[c.n].final).length;
  $("compteur").textContent = `${n} / 3 groupes`;
  $("sous").textContent =
    n === 0 ? "Atelier en cours" :
    n < 3   ? "Les traces arrivent" :
              "Les trois traces sont là";
  $("mode").innerHTML = MODE === "traces"
    ? "Mode <b>traces complètes</b>"
    : "Mode <b>seulement les ajouts</b>";
}

function rafraichir() { rendre(Sync.etat()); }

/* ---------- pilotage ---------- */

function basculer(m) { MODE = m; rafraichir(); }

function voile(afficher) {
  const v = $("voile");
  if (afficher === undefined) afficher = v.hidden;
  v.hidden = !afficher;
}

function injecter(i) {
  const c = CAS[i];
  Sync.reserver(c.n);
  Sync.envoyer(c.n, { ia: c.repli, final: c.exemple });
}

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k !== "r") confirmeReset = false;

  if (k === "t") basculer("traces");
  else if (k === "a") basculer("ajouts");
  else if (k === "q") voile();
  else if (k === "?" || k === "h") $("raccourcis").hidden = !$("raccourcis").hidden;
  else if (k === "escape") { $("raccourcis").hidden = true; voile(false); }
  else if (k === "1") injecter(0);
  else if (k === "2") injecter(1);
  else if (k === "3") injecter(2);
  else if (k === "r") {
    if (confirmeReset) { Sync.reset(); MODE = "traces"; confirmeReset = false; }
    else { confirmeReset = true; }
  }
});

/* ---------- adresse et QR ---------- */

(function adresse() {
  const url = location.origin + "/";
  const lisible = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  $("adresse").textContent = lisible;

  // QR via CDN si disponible ; l'adresse en gros caractères reste
  // le repli fiable et sert de toute façon à ceux qui ne scannent pas.
  const cible = $("qr");
  if (window.QRCode) {
    try { new QRCode(cible, { text: url, width: 256, height: 256,
      colorDark: "#08201F", colorLight: "#ffffff" }); return; } catch (_) {}
  }
  cible.innerHTML = '<span style="color:#63807C;font-size:14px;text-align:center">'
    + "Tapez l'adresse ci-dessous</span>";
})();

Sync.init(rendre);

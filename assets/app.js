/* ------------------------------------------------------------------
   Le téléphone du groupe — parcours en cinq étapes.
   Tranche 1 : la génération sert le texte de repli après un court
   délai. Tranche 3 : APPEL_API passe à true et /api/generer prend le
   relais, le repli restant le filet en cas d'échec ou de lenteur.
   ------------------------------------------------------------------ */

const APPEL_API = true;       // appel réel à l'API
const DELAI_MAX = 25000;      // au-delà, on sert le repli sans rien dire
const MAX_CAR   = 280;        // plafond de la SAISIE du groupe, jamais de la sortie
const MIN_CAR   = 70;         // en deçà, l'IA n'a rien à traiter et invente tout

/* Le bouton « Exemple » ne doit exister qu'en répétition : le jour J,
   un groupe pressé pourrait s'en servir et afficher à l'écran une
   contribution qui n'est pas la sienne. Il n'apparaît donc que si
   l'adresse porte ?repet=1 — par exemple oareil.vercel.app/?repet=1 */
const REPETITION = new URLSearchParams(location.search).has("repet");

/* Un texte utilisable se termine par une ponctuation de fin. Sinon
   c'est une génération coupée : on sert le repli, personne ne le voit. */
function texteUtilisable(t) {
  if (typeof t !== "string") return false;
  const x = t.trim();
  return x.length >= 200 && /[.!?…»]$/.test(x);
}

const S = {
  etape: 0,        // 0 accueil · 1 consigne · 1.5 attente · 2 lecture · 3 critique · 5 trace
  groupe: null,    // index dans CAS
  formulation: "",
  ia: "",
  travail: "",
  envoye: false
};

const $ = id => document.getElementById(id);

/* Aux étapes 2 et 3, le cas et la demande du groupe restent sous les yeux :
   sans eux, le texte généré arrive sans antécédent et le lien se perd. */
function rappel(c) {
  return `<div class="cas" style="margin-bottom:15px">
    <div class="lg">Votre cas · groupe ${c.n}</div>
    <div class="tx">${echapper(c.consigne)}</div>
    <div class="lg" style="margin-top:11px">Ce que vous avez demandé</div>
    <div class="tx">${echapper(S.formulation)}</div>
  </div>`;
}
const vue = () => $("vue");

/* ---------- rendu ---------- */

function jauge(n, crit) {
  return `<div class="jauge">${[1,2,3,4,5].map(i =>
    `<i class="${i <= n ? "on" : ""} ${(i === 3 && crit) ? "crit" : ""}"></i>`).join("")}</div>`;
}

function rendre() {
  const c = S.groupe !== null ? CAS[S.groupe] : null;

  if (S.etape === 0) {
    const etat = Sync.etat();
    vue().innerHTML = `
      <div class="corps">
        <div class="etape">Oareil · Atelier</div>
        <h1 class="titre">Mise en situation, en direct</h1>
        <p class="chapo">Rien à installer, rien à créer. Choisissez votre groupe pour commencer.</p>
        <div class="choix">
          ${CAS.map((k, i) => {
            const pris = etat.groupes[k.n] && etat.groupes[k.n].pris;
            return `<button class="opt" ${pris ? "disabled" : ""} onclick="choisir(${i})">
              <span class="n">Groupe ${k.n}</span>
              <span class="t">${k.titre}</span>
            </button>`;
          }).join("")}
        </div>
      </div>
      <div class="pied">
        <p class="micro">Rien n'est enregistré au-delà de cette session.</p>
      </div>`;
    return;
  }

  if (S.etape === 1) {
    const n = S.formulation.length;
    vue().innerHTML = `
      ${jauge(1)}
      <div class="corps">
        <div class="etape">Étape 1 · Consigne</div>
        <h1 class="titre">Votre demande à l'IA</h1>
        <p class="chapo">À partir de vos post-it : sur quoi voulez-vous que la mise en situation insiste, et qu'est-ce qu'elle doit éviter ? Vous décrivez une commande, pas une réponse.</p>
        <div class="cas">
          <div class="lg">Votre cas</div>
          <div class="tx">${echapper(c.consigne)}</div>
        </div>
        <label class="lbl" for="saisie">Votre demande</label>
        <textarea id="saisie" rows="5" maxlength="${MAX_CAR + 40}"
          placeholder="Ex. : montrer le moment du refus et l'hésitation du professionnel, sans qu'il trouve la solution…"
          oninput="majSaisie(this.value)">${echapper(S.formulation)}</textarea>
        <div class="compteur ${n > MAX_CAR ? "trop" : ""}" id="cpt">${n} / ${MAX_CAR}</div>
      </div>
      <div class="pied">
        <button class="act plein" id="btn" ${n < MIN_CAR || n > MAX_CAR ? "disabled" : ""}
          onclick="generer()">Générer une proposition</button>
        <p class="micro">Un seul appel, pour tout le groupe.</p>
      </div>`;
    return;
  }

  if (S.etape === 1.5) {
    vue().innerHTML = `
      ${jauge(2)}
      <div class="attente">
        <div class="pouls"></div>
        <p>L'IA rédige sa proposition…</p>
      </div>`;
    return;
  }

  if (S.etape === 2) {
    vue().innerHTML = `
      ${jauge(2)}
      <div class="corps">
        <div class="etape">Étape 2 · Génération</div>
        <h1 class="titre">Une proposition à discuter</h1>
        <p class="chapo">Lisez-la ensemble avant de la juger.</p>
        ${rappel(c)}
        <div class="carte">
          <span class="tag">Proposition de l'IA</span>
          <div class="texte">${echapper(S.ia)}</div>
        </div>
      </div>
      <div class="pied">
        <button class="act plein" onclick="aller(3)">Passer au regard critique</button>
      </div>`;
    return;
  }

  if (S.etape === 3) {
    vue().innerHTML = `
      ${jauge(3, true)}
      <div class="corps">
        <div class="etape crit">Étape 3 · Regard critique</div>
        <h1 class="titre">À vous de jouer</h1>
        <p class="chapo">Chacun répond d'abord sur post-it. Le scribe modifie ensuite le texte.</p>
        ${rappel(c)}
        <label class="lbl" for="travail">Texte modifiable</label>
        <textarea id="travail" class="crit" rows="9"
          oninput="S.travail = this.value">${echapper(S.travail)}</textarea>
        <div class="questions">
          <div class="lg">Les trois questions</div>
          ${QUESTIONS.map(q => `<p>${q}</p>`).join("")}
        </div>
      </div>
      <div class="pied">
        ${REPETITION ? `
        <div class="rang">
          <button class="act creux" onclick="exemple()">Exemple</button>
          <button class="act plein crit" onclick="aller(5)">Valider ce texte</button>
        </div>
        <p class="micro">« Exemple » remplit le champ — répétition seulement.</p>`
        : `
        <button class="act plein crit" onclick="aller(5)">Valider ce texte</button>
        <p class="micro">Ce que vous ajoutez ici apparaîtra à l'écran de la salle.</p>`}
      </div>`;
    return;
  }

  if (S.etape === 5) {
    const html = ajouts(S.ia, S.travail)
      .map(p => p.neuf ? `<b>${echapper(p.t)}</b>` : echapper(p.t)).join("");
    vue().innerHTML = `
      ${jauge(5)}
      <div class="corps">
        <div class="etape">Étape 5 · Trace de session</div>
        <h1 class="titre">Ce que vous emportez</h1>
        <p class="chapo">En orange, ce que le groupe a apporté.</p>
        <div class="carte">
          <span class="tag o">Version du groupe ${c.n}</span>
          <div class="texte">${html}</div>
        </div>
      </div>
      <div class="pied">
        <div class="rang" style="margin-bottom:9px;">
          <button class="act creux" onclick="copier()">Copier</button>
          <button class="act creux" onclick="telecharger()">Télécharger</button>
        </div>
        <button class="act ${S.envoye ? "fait" : "plein"}" ${S.envoye ? "disabled" : ""}
          onclick="versEcran()">${S.envoye ? "Envoyé à l'écran ✓" : "Envoyer vers l'écran"}</button>
        <p class="micro">${S.envoye
          ? "Votre trace est affichée dans la salle. Vous pouvez fermer."
          : "Point de départ, pas résultat figé."}</p>
      </div>`;
    return;
  }
}

/* ---------- actions ---------- */

function majSaisie(v) {
  S.formulation = v;
  const n = v.length;
  const cpt = $("cpt");
  if (cpt) { cpt.textContent = `${n} / ${MAX_CAR}`; cpt.classList.toggle("trop", n > MAX_CAR); }
  const b = $("btn");
  if (b) b.disabled = (n < MIN_CAR || n > MAX_CAR);
}

let reservationEnCours = false;

async function choisir(i) {
  if (reservationEnCours) return;
  reservationEnCours = true;
  document.querySelectorAll(".opt").forEach(b => b.disabled = true);

  const ok = await Sync.reserver(CAS[i].n);
  reservationEnCours = false;

  if (!ok) { rendre(); return; }   // pris entre-temps : la liste se remet à jour
  S.groupe = i;
  S.etape = 1;
  rendre();
}

function aller(n) { S.etape = n; rendre(); }

async function generer() {
  S.etape = 1.5;
  rendre();
  Sync.statut(CAS[S.groupe].n, "genere");

  let texte = null;
  if (APPEL_API) {
    try {
      const ctrl = new AbortController();
      const minuteur = setTimeout(() => ctrl.abort(), DELAI_MAX);
      const r = await fetch("/api/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cas: CAS[S.groupe].n, formulation: S.formulation.slice(0, MAX_CAR) }),
        signal: ctrl.signal
      });
      clearTimeout(minuteur);
      if (r.ok) {
        const d = await r.json();
        if (d && texteUtilisable(d.texte)) texte = d.texte;
      }
    } catch (_) { /* silence : le repli prend la main */ }
  } else {
    await new Promise(r => setTimeout(r, 1700));
  }

  if (REPETITION && !texte) console.warn("[repet] repli servi — l'API n'a pas répondu");

  S.ia = texte || CAS[S.groupe].repli;
  S.travail = S.ia;
  S.etape = 2;
  rendre();
}

function exemple() { S.travail = CAS[S.groupe].exemple; rendre(); }

function copier() {
  navigator.clipboard && navigator.clipboard.writeText(S.travail);
}

function telecharger() {
  const b = new Blob([S.travail], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `atelier-groupe-${CAS[S.groupe].n}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function versEcran() {
  try {
    await Sync.envoyer(CAS[S.groupe].n, { ia: S.ia, final: S.travail });
    S.envoye = true;
  } catch (e) {
    console.warn("[app] envoi refusé :", e && e.message);
    alert("L'envoi vers l'écran n'a pas fonctionné. Réessayez, ou montrez ce texte à l'animateur.");
  }
  rendre();
}

/* ---------- démarrage ---------- */
Sync.init(() => { if (S.etape === 0) rendre(); });
rendre();

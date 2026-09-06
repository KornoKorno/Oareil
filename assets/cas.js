/* ------------------------------------------------------------------
   Les trois cas de l'atelier.
   `repli`   : le texte servi si l'API ne répond pas (tranche 3).
               Écrit comme le modèle l'écrirait : correct et générique.
   `exemple` : version enrichie, utilisée par le bouton « Exemple »
               en répétition et par la démo de l'écran témoin.
   ------------------------------------------------------------------ */

const CAS = [
  {
    n: 1,
    titre: "Autonomie et lecture clinique",
    consigne:
      "Une personne âgée refuse l'aide à la toilette proposée par l'auxiliaire de vie.",
    repli:
      "Mme R., 84 ans, refuse l'aide à la toilette que lui propose son auxiliaire de vie. Le professionnel prend le temps de reformuler la proposition sans insister, rappelle que le choix appartient à la personne, et propose de revenir plus tard dans la matinée. Il note le refus dans le dossier de suivi et en informe l'équipe lors de la transmission.",
    exemple:
      "Mme R., 84 ans, refuse l'aide à la toilette que lui propose son auxiliaire de vie. Depuis le décès de son mari, elle répète que c'est la dernière chose qu'elle fait encore seule. Le professionnel prend le temps de reformuler la proposition sans insister, rappelle que le choix appartient à la personne, et propose de revenir plus tard dans la matinée. Il s'interroge sur ce que ce refus protège chez elle plutôt que sur la manière de le lever. Il note le refus dans le dossier de suivi et en informe l'équipe lors de la transmission."
  },
  {
    n: 2,
    titre: "Secret professionnel et consentement altéré",
    consigne:
      "La fille d'un résident appelle pour connaître l'état de santé de son père. Celui-ci présente des troubles cognitifs et n'a jamais exprimé de position sur ce qu'il souhaite voir partagé avec sa famille.",
    repli:
      "La fille de M. T. téléphone à l'établissement pour obtenir des informations sur l'état de santé de son père, dont les troubles cognitifs se sont accentués ces derniers mois. Le professionnel vérifie si une personne de confiance a été désignée et si une mesure de protection est en place. Il rappelle qu'aucune information ne peut être transmise en dehors d'un cadre établi, propose de porter la demande à l'équipe pluridisciplinaire, et convient de rappeler la famille une fois la situation clarifiée.",
    exemple:
      "La fille de M. T. téléphone à l'établissement pour obtenir des informations sur l'état de santé de son père, dont les troubles cognitifs se sont accentués ces derniers mois. Le professionnel vérifie si une personne de confiance a été désignée et si une mesure de protection est en place. Avant de répondre sur le cadre, il cherche ce que M. T. laisse entendre aujourd'hui : ce qu'il dit de sa fille quand elle n'est pas là, ce qu'il montre quand elle vient. Il sait que la procédure dira qui peut décider, pas ce que lui aurait voulu. Il rappelle qu'aucune information ne peut être transmise en dehors d'un cadre établi, propose de porter la demande à l'équipe pluridisciplinaire, et convient de rappeler la famille une fois la situation clarifiée."
  },
  {
    n: 3,
    titre: "Fin de vie et place du professionnel",
    consigne:
      "Un professionnel accompagne depuis plusieurs mois un résident aujourd'hui en fin de vie, et se demande quelle place il peut prendre auprès de la famille dans les derniers jours.",
    repli:
      "Le professionnel accompagne M. L. depuis plusieurs mois. Alors que son état se dégrade, il s'interroge sur la place qu'il peut occuper auprès de la famille. Il veille à maintenir une juste distance professionnelle, se rend disponible sans s'imposer, et oriente les proches vers les dispositifs de soutien existants. Il échange régulièrement avec l'équipe sur la conduite à tenir.",
    exemple:
      "Le professionnel accompagne M. L. depuis plusieurs mois. Alors que son état se dégrade, il s'interroge sur la place qu'il peut occuper auprès de la famille. Le fils vient chaque soir après son service et reste debout dans le couloir, sans entrer. Certains soirs, le professionnel s'assoit à côté de lui et ne dit rien. Il ne sait pas si c'est sa place ; il sait que c'est ce qui aide. Il échange régulièrement avec l'équipe sur la conduite à tenir."
  }
];

/* Les trois questions du regard critique — affichées, jamais saisies. */
const QUESTIONS = [
  "Qu'est-ce qui manque de spécifique à votre terrain ?",
  "Qu'est-ce qui sonnerait faux face à un vrai bénéficiaire ?",
  "Y a-t-il une information sensible à retirer ?"
];

/* ------------------------------------------------------------------
   Diff par phrase. Une phrase modifiée s'allume en entier : à cinq
   mètres, un surlignage émietté au mot est illisible.
   ------------------------------------------------------------------ */
/* Le point d'une abréviation ou d'une initiale ("M. T.", "Dr L.") n'est
   pas une fin de phrase : on le masque le temps du découpage, sinon la
   surbrillance se casse en morceaux au milieu d'un nom. */
const SCEAU = "\u0001";
function decouper(s) {
  const masque = s.replace(/\b(M|Mme|Mlle|Dr|Pr|[A-ZÀ-Ý])\./g, "$1" + SCEAU);
  const bouts = masque.match(/[^.!?]+[.!?]*\s*/g) || (masque ? [masque] : []);
  return bouts.map(b => b.split(SCEAU).join("."));
}
function normaliser(s) {
  return s.trim().replace(/\s+/g, " ");
}
function ajouts(avant, apres) {
  const a = decouper(avant), b = decouper(apres);
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      L[i][j] = normaliser(a[i]) === normaliser(b[j])
        ? L[i + 1][j + 1] + 1
        : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0;
  const out = [];
  while (i < m && j < n) {
    if (normaliser(a[i]) === normaliser(b[j])) { out.push({ t: b[j], neuf: false }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else { out.push({ t: b[j], neuf: true }); j++; }
  }
  while (j < n) { out.push({ t: b[j], neuf: true }); j++; }
  return out;
}

function echapper(s) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

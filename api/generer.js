/* ------------------------------------------------------------------
   /api/generer — proxy vers l'API Anthropic.

   La clé vit dans les variables d'environnement Vercel, jamais dans
   le dépôt. L'endpoint est volontairement étroit : trois cas connus,
   280 caractères de texte libre en entrée. Il ne peut rien produire
   d'autre qu'une mise en situation pédagogique — ce qui rend tout
   détournement sans intérêt.

   Variables d'environnement attendues :
     ANTHROPIC_API_KEY   la clé
     ATELIER_OUVERT      "true" pour autoriser les appels (coupe-circuit)
   ------------------------------------------------------------------ */

const CAS_CONNUS = [1, 2, 3];

/* La situation de départ vit ici, côté serveur : c'est elle qui ancre
   la génération. Sans elle, le modèle ne recevait que les 280 caractères
   du groupe et inventait toute la scène autour — c'était le défaut. */
const SITUATIONS = {
  1: "Une personne âgée accompagnée à domicile refuse l'aide à la toilette.",
  2: "La fille d'un résident téléphone à l'établissement pour avoir des nouvelles de son père. Le père présente des troubles cognitifs et n'a jamais dit ce qu'il souhaitait que l'on partage avec sa famille.",
  3: "Un résident accompagné depuis plusieurs mois est dans ses derniers jours. Sa famille est présente, et le professionnel doit trouver la place qu'il prend auprès d'elle."
};
const MAX_CAR = 280;      // plafond de la SAISIE du groupe, jamais de la sortie

/* Le modèle raisonne avant de répondre, et ce raisonnement consomme le
   même quota de jetons que la réponse. Sonnet 5 utilise un nouveau
   tokenizer plus dense et un raisonnement adaptatif activé par défaut :
   1500 ne laissait plus de place pour terminer la phrase, le texte
   arrivait tronqué. 4000 couvre largement raisonnement + texte. */
const MAX_JETONS = 4000;

const SYSTEME = `Tu aides un formateur du secteur médico-social à préparer un support pédagogique.

À partir de la situation qu'il te donne, rédige une mise en situation de 90 à 120 mots, destinée à être discutée en groupe par des professionnels de l'accompagnement.

Tu reçois une situation de départ, puis ce que le groupe de formateurs a retenu et souhaite voir traité. La situation de départ commande : ne change ni son sujet ni son cadre. Ce que le groupe a retenu indique l'angle — insiste dessus.

Plante la scène, puis arrête-toi au moment où le professionnel doit agir. Ne raconte pas comment il s'en sort, ne donne ni solution ni morale. Reste au présent, dans un registre professionnel sobre. Va à l'essentiel : pas de décor inutile.

Anonymat : désigne les personnes accompagnées par une civilité suivie d'une initiale — Mme R., M. T. — et jamais par un prénom. Les professionnels sont désignés par leur fonction : l'aide-soignante, le professionnel, l'infirmière. Les âges peuvent être précisés. La situation est fictive.

Ne termine pas par des questions ni par des pistes de débat. Réponds uniquement par le texte de la mise en situation, sans introduction ni commentaire, et termine ta dernière phrase.`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erreur: "methode" });
  }
  if (process.env.ATELIER_OUVERT !== "true") {
    return res.status(503).json({ erreur: "ferme" });
  }

  const { cas, formulation } = req.body || {};

  if (!CAS_CONNUS.includes(Number(cas))) {
    return res.status(400).json({ erreur: "cas" });
  }
  if (typeof formulation !== "string" || formulation.trim().length < 15) {
    return res.status(400).json({ erreur: "formulation" });
  }

  const texte = formulation.trim().slice(0, MAX_CAR);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: MAX_JETONS,
        system: SYSTEME,
        messages: [{ role: "user", content:
          `Situation de départ :\n${SITUATIONS[Number(cas)]}\n\n` +
          `Ce que le groupe a retenu et souhaite voir traité :\n${texte}` }]
      })
    });

    if (!r.ok) {
      return res.status(502).json({ erreur: "amont" });
    }

    const d = await r.json();
    const sortie = (d.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    if (!sortie) return res.status(502).json({ erreur: "vide" });

    /* Si le modèle a malgré tout été coupé, on le dit au client : il
       servira le texte de repli plutôt qu'une phrase inachevée. */
    if (d.stop_reason === "max_tokens") {
      return res.status(502).json({ erreur: "tronque" });
    }

    return res.status(200).json({ texte: sortie });
  } catch (e) {
    return res.status(502).json({ erreur: "reseau" });
  }
}

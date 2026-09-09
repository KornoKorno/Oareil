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
const MAX_CAR = 280;      // plafond de la SAISIE du groupe, jamais de la sortie

/* Le modèle raisonne avant de répondre, et ce raisonnement consomme le
   même quota de jetons que la réponse. Avec 400, il ne restait plus de
   quoi terminer la phrase : le texte arrivait coupé en plein mot.
   1500 laisse largement la place au raisonnement et au texte. */
const MAX_JETONS = 1500;

const SYSTEME = `Tu aides un formateur du secteur médico-social à préparer un support pédagogique.

À partir de la situation qu'il te donne, rédige une mise en situation de 90 à 120 mots, destinée à être discutée en groupe par des professionnels de l'accompagnement.

Décris la scène et la conduite du professionnel, sans donner de solution ni de morale. Reste au présent, dans un registre professionnel sobre.

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
        messages: [{ role: "user", content: texte }]
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

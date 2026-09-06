/* ------------------------------------------------------------------
   /api/generer — proxy vers l'API Anthropic.

   La clé vit dans les variables d'environnement Vercel, jamais dans
   le dépôt. L'endpoint est volontairement étroit : trois cas connus,
   280 caractères de texte libre, sortie plafonnée. Il ne peut rien
   produire d'autre qu'une mise en situation pédagogique — ce qui rend
   tout détournement sans intérêt.

   Variables d'environnement attendues :
     ANTHROPIC_API_KEY   la clé
     ATELIER_OUVERT      "true" pour autoriser les appels (coupe-circuit)
   ------------------------------------------------------------------ */

const CAS_CONNUS = [1, 2, 3];
const MAX_CAR = 280;

const SYSTEME = `Tu aides un formateur du secteur médico-social à préparer un support pédagogique.

À partir de la situation qu'il te donne, rédige une mise en situation de 90 à 120 mots, destinée à être discutée en groupe par des professionnels de l'accompagnement.

Décris la scène et la conduite du professionnel, sans donner de solution ni de morale. Reste au présent, dans un registre professionnel sobre. Invente les prénoms et les âges nécessaires : la situation est fictive.

Ne termine pas par des questions ni par des pistes de débat. Réponds uniquement par le texte de la mise en situation, sans introduction ni commentaire.`;

export const config = { maxDuration: 15 };

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
        model: "claude-sonnet-4-5",
        max_tokens: 400,
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

    return res.status(200).json({ texte: sortie });
  } catch (e) {
    return res.status(502).json({ erreur: "reseau" });
  }
}

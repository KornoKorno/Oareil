# Atelier Oareil — 11 septembre 2026

Outil de l'atelier « Mise en situation, en direct ».
Deux surfaces : le téléphone du groupe et l'écran témoin projeté.

---

## Déployer

```bash
git init
git add .
git commit -m "Tranche 1 : socle"
git remote add origin <ton-dépôt>
git push -u origin main
```

Puis sur Vercel : **Add New → Project**, importer le dépôt, déployer.
Aucun framework à sélectionner, aucune commande de build — c'est du statique
plus une fonction serverless.

Deux adresses une fois déployé :

| Surface | Adresse |
|---|---|
| Téléphone du groupe | `/` |
| Écran témoin | `/ecran.html` |

---

## Variables d'environnement

À renseigner dans **Settings → Environment Variables** sur Vercel.
Nécessaires seulement à partir de la tranche 3.

| Nom | Valeur | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | la clé | jamais dans le dépôt |
| `ATELIER_OUVERT` | `true` / `false` | coupe-circuit, modifiable sans redéployer |

Générer une clé dédiée à ce projet, et la révoquer le 11 au soir.

---

## Où en est le chantier

### Tranche 1 — livrée

- Parcours complet en cinq étapes sur le téléphone
- Cas attribué automatiquement selon le groupe choisi
- Numéro de groupe verrouillé une fois pris
- Textes de repli des trois cas, servis sans appel réseau
- Écran témoin, surbrillance par phrase, deux modes, pilotage clavier
- Fonction `/api/generer` écrite mais pas encore appelée

**Ce qui ne marche pas encore** : la synchronisation entre appareils.
Le téléphone et l'écran ne se parlent que dans deux onglets d'un même
navigateur. C'est l'objet de la tranche 2.

### Tranche 2 — Firebase

Remplacer l'implémentation de `assets/sync.js`. L'interface publique
(`init`, `reserver`, `statut`, `envoyer`, `etat`, `reset`) ne bouge pas :
rien d'autre n'est à toucher.

Test de recette : trois appareils différents envoient en même temps, les
trois colonnes se remplissent, aucune n'écrase l'autre.

### Tranche 3 — appel réel à l'API

Passer `APPEL_API` à `true` en tête de `assets/app.js`, renseigner les
deux variables d'environnement.

Le repli reste le filet : si l'appel échoue ou dépasse dix secondes, le
texte pré-écrit du cas est servi sans que personne ne s'en aperçoive.

### Tranche 4 — pilotage et répétition

Refermer les règles Firebase sur la seule session du jour, répétition
complète à trois téléphones, coupure réseau volontaire, gel du code.

---

## Écran témoin — raccourcis

| Touche | Effet |
|---|---|
| `T` | traces complètes |
| `A` | seulement les ajouts — le moment de 15h10 |
| `Q` | voile QR / adresse |
| `1` `2` `3` | injecter une trace — répétition uniquement |
| `R` puis `R` | réinitialiser la session |
| `?` | aide des raccourcis |
| `Esc` | tout refermer |

Rien n'est cliquable sur cet écran : il est projeté, il se pilote au clavier.

---

## Structure

```
index.html          téléphone du groupe
ecran.html          écran témoin projeté
assets/
  cas.js            les trois cas, textes de repli, diff par phrase
  sync.js           couche de synchronisation (à remplacer en tranche 2)
  app.js            parcours en cinq étapes
  ecran.js          rendu des colonnes et pilotage clavier
  style.css         les deux surfaces
api/
  generer.js        proxy Anthropic — clé côté serveur
vercel.json         en-têtes
```

---

## Notes

**L'endpoint est volontairement étroit.** Trois cas connus, 280 caractères
de texte libre, sortie plafonnée à 400 jetons. Il ne peut produire qu'une
mise en situation pédagogique, ce qui rend tout détournement sans intérêt.

**Rien n'est conservé côté client.** Aucun compte, aucune identification,
aucun stockage local. La session vit le temps de l'atelier.

**Le plan B ne dépend pas de ce dépôt.** Les post-it précèdent l'écran à
chaque étape. Si le réseau tombe, l'atelier se mène au papier — voir le
conducteur d'animation.

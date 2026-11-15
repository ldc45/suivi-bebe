---
name: suivi-bebe-style
description: Règles d'interface et d'expérience de l'appli Suivi bébé (PWA React pour téléphone). À lire avant toute modification visible de l'interface (écran, composant, style, texte affiché, animation) et avant d'utiliser impeccable, unslop ou les skills d'Emil Kowalski sur ce projet. Ces règles l'emportent sur celles des autres skills.
---

# Suivi bébé : règles d'interface

Suivi bébé sert à noter le quotidien d'un nouveau-né (repas, sommeil, couches, soins), souvent **d'une main, la nuit, à moitié réveillé**, par deux parents qui ne se lèvent pas en même temps. Chaque décision part de cette scène.

## Priorité

1. La demande explicite de l'utilisateur.
2. Ce fichier.
3. Les skills externes (`impeccable`, `unslop`, `emil-design-eng` et les autres skills d'Emil Kowalski). Ils sont des outils de revue et de finition, pas une invitation à refaire l'identité. Sur ce projet, c'est le mode « Operate » d'impeccable : précision et retenue, pas de refonte.

Ne jamais lancer `scripts/impeccable`, `npx impeccable` ni aucun installateur de ces skills : ils n'ont pas été copiés volontairement (voir `.claude/skills/README.md`). Utiliser le mode « Launcher unavailable » d'impeccable.

## Identité (à conserver)

- Thèmes dans `src/styles/base.css`, par variables CSS : clair (lilas), sombre (nuit), et **mode nuit** (filtre ambré très faible, `data-night`). Toute couleur nouvelle passe par ces variables ou par `ENTRY_META` / `entries/look.ts`.
- Typographies : Fraunces (chiffres, titres) et Figtree (texte). Pas de nouvelle police.
- Couleurs des activités : `ENTRY_META` dans `src/entries/types.ts`. Couches : pipi `PEE_COLOR` (jaune, goutte), caca `POO_COLOR` (marron), pipi et caca en pastille moitié-moitié (`lookOf`, `lookBackground`).
- Le cadran de l'accueil (trois anneaux : sommeil, repas, soins) est l'élément signature : le faire évoluer, ne pas le remplacer sans accord.

## Téléphone d'abord

- Zones à toucher d'au moins 44 px. Les actions de nuit (boutons rapides, biberon préparé, Réveil) restent atteignables d'un pouce.
- Textes : au moins 0,75 rem pour les plus petits ; gris secondaire suffisamment contrasté dans les trois thèmes.
- Tester à 360 px de large et en mode nuit. En mode nuit, les couleurs sont faussées : toute information portée par une couleur (couleur des selles) doit aussi être écrite.
- Les fenêtres (feuilles) se ferment par le geste retour et en glissant vers le bas : passer par `useSheet()` (`ui/Overlay.tsx`), jamais un `history.back()` à la main ; pour naviguer après fermeture, `sheet.close(() => navigate(...))`.
- Hors ligne : toute saisie passe par `useEntryMutations` (mise à jour immédiate, envoi différé). Ne pas attendre le serveur pour fermer une fenêtre.

## Textes

- Français, simple, phrase complète, à la voix active. Le bouton dit ce qu'il fait ; le message de confirmation reprend le même mot.
- Accorder selon le sexe du bébé : `agree()` et `subject()` (`babies/types.ts`), le prénom si le sexe n'est pas renseigné.
- Pas d'icônes ni d'emoji dans les textes, pas de tirets cadratins. Espaces insécables dans les durées (`dur()`).
- Les repères santé sont indicatifs : jamais de diagnostic ; renvoyer vers le médecin, le 15 ou le 112 en cas d'urgence.

## Mouvement

Sobre : une animation n'existe que pour répondre à un geste (ouvrir, confirmer, glisser) ou signaler un changement. Respecter `prefers-reduced-motion`. Les skills d'Emil Kowalski servent à juger et régler ces mouvements, pas à en ajouter partout.

## Vérifier avant de livrer

`npm run typecheck`, `npm test`, `npm run build`, puis un rendu réel au format téléphone (clair, sombre, nuit) avec des données réalistes.

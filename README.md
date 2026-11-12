# Suivi bébé

Application de suivi du quotidien d’un nourrisson (repas, sommeil, couches, traitements, croissance), partagée en temps réel entre les parents.

**Stack** : Vite, React 18, TypeScript, TanStack Query, Supabase (Postgres, authentification par code e-mail, temps réel), Chart.js, PWA. Déploiement sur Netlify.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env.local      # puis renseigner l’URL et la clé anon Supabase
npm run dev                     # http://localhost:5173
```

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` (lancé par Netlify) |
| `npm run preview` | Sert le build localement |
| `npm run typecheck` | Vérification TypeScript complète |
| `npm test` | Tests unitaires (Vitest) des règles métier |
| `npm run db:types` | Génère les types de la base (nécessite la CLI Supabase liée au projet) |

> Le projet a été généré sans pouvoir lancer `npm install` dans l’environnement de génération. Le code a été vérifié avec le compilateur TypeScript et testé dans un navigateur, mais contre des versions simplifiées des bibliothèques. Lancez `npm run typecheck` et `npm test` après la première installation : les éventuels écarts de typage avec les versions réelles se corrigent rapidement.

---

## Mise en place

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com), région Europe.
2. **Schéma** : dans *SQL Editor*, exécutez `supabase/migrations/20261111000000_init.sql`.
   Avec la CLI : `supabase link --project-ref <ref>` puis `supabase db push`.
3. **Données de départ** : exécutez `supabase/seed/lei.sql` (fourni à part, jamais versionné) après y avoir remplacé les deux adresses e-mail.
4. **Connexion par code** : *Authentication > Emails*, modèles **Magic Link** et **Confirm signup**. Remplacez le corps par :

   ```html
   <h2>Votre code Suivi bébé</h2>
   <p>Code de connexion : <strong>{{ .Token }}</strong></p>
   ```

   Le code à 6 chiffres fonctionne aussi dans l’appli installée sur l’écran d’accueil, contrairement à un lien magique qui s’ouvrirait dans le navigateur.
5. Récupérez **Project URL** et la clé **anon public** (*Project Settings > API*).

### 2. Icônes

Les icônes de l’écran d’accueil sont dans `public/icons` : `icon.svg` est le modèle, `icon-180.png` (iPhone), `icon-192.png` et `icon-512.png` (Android) en sont tirées. Pour changer l’icône, modifiez le SVG puis régénérez les trois PNG aux mêmes dimensions.

### 3. Netlify

1. *Add new site > Import an existing project > GitHub*, choisissez ce dépôt.
2. Les réglages de build sont lus dans `netlify.toml` (`npm run build`, dossier `dist`).
3. *Site configuration > Environment variables* : ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis relancez un déploiement.

Chaque `git push` sur `main` redéploie automatiquement.

### 4. Téléphones

Ouvrez l’adresse Netlify, connectez-vous avec votre e-mail, puis *Partager > Sur l’écran d’accueil* (iPhone) ou *Ajouter à l’écran d’accueil* (Android).

---

## Architecture

```
src/
  app/            App (garde d’authentification), AppContext (enfant et jour affichés), Shell (en-tête, routes, barre)
  babies/         Profils et traitements : types, accès aux données, formulaire, sélecteur d’enfant
  entries/        Saisies : types du domaine, description, accès aux données, fenêtre de saisie, bouton +
  features/       Un dossier par écran : accueil, repas, sommeil, couches, mesures, tummy, journal, reglages, auth
    evolution/    Graphiques par type d’activité, réutilisés dans chaque onglet
  lib/            Fonctions pures et services : dates, règles métier (alertes, repères), normes OMS, Supabase, temps réel
  ui/             Composants partagés : feuilles, messages, contrôles, navigation par jour, frise, icônes
  styles/         base (thème, navigation), screens (écrans), forms (saisie, réglages), data (graphiques, journal)
supabase/
  migrations/     Schéma versionné et règles d’accès (RLS)
  seed/           Données initiales locales (non versionnées)
```

### Données

| Table | Contenu |
|---|---|
| `households`, `household_members` | Foyer et adresses e-mail autorisées |
| `babies` | Profil, réglages (`settings` en JSON : types masqués, repères, options) |
| `medications` | Traitements, fréquence, heure de prise |
| `entries` | Toutes les saisies : `type`, `started_at`, `ended_at`, `in_progress`, détails propres au type dans `data` (JSON) |

Les règles RLS limitent chaque table aux membres du foyer, identifiés par l’e-mail de leur session. Ajouter un parent revient à insérer une ligne dans `household_members`.

### Flux de données

- `useEntries` charge les saisies des 180 derniers jours de l’enfant affiché, en une seule requête partagée par tous les écrans.
- Les mutations (`useEntryMutations`) sont **optimistes** : l’écran se met à jour avant la réponse du serveur, et revient en arrière en cas d’échec. Les identifiants sont générés côté client, ce qui rend l’annulation triviale.
- `useRealtime` écoute Supabase et **invalide** les requêtes concernées quand l’autre parent enregistre quelque chose.
- Les règles métier (`lib/rules.ts`) sont des fonctions pures, testées dans `lib/rules.test.ts`.

### Ajouter un type d’activité

1. Ajouter la valeur à l’enum `entry_type` (nouvelle migration).
2. Déclarer sa forme dans `DataMap` et ses métadonnées dans `ENTRY_META` (`entries/types.ts`).
3. Gérer son résumé dans `describe` et son formulaire dans `EntrySheet`.
4. Ajouter son pictogramme dans `ui/icons.ts`, et si besoin un graphique dans `features/evolution`.

---

## Pistes

- Persistance du cache TanStack Query pour un mode hors ligne complet.
- Notifications pour les traitements (Web Push).
- Export PDF pour les rendez-vous chez le pédiatre.
- Pagination du journal au-delà de 180 jours.

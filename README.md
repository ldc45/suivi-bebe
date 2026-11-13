# Suivi bébé

Application de suivi du quotidien d’un nourrisson (repas, sommeil, couches, traitements, croissance), partagée en temps réel entre les parents.

**Stack** : Vite, React 18, TypeScript, TanStack Query, Supabase (Postgres, authentification par e-mail et mot de passe, temps réel), Chart.js, PWA hors ligne. Déploiement sur Netlify.

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

---

## Mise en place

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com), région Europe.
2. **Schéma** : dans *SQL Editor*, exécutez `supabase/migrations/20261111000000_init.sql`.
   Avec la CLI : `supabase link --project-ref <ref>` puis `supabase db push`.
3. **Données de départ** : exécutez `supabase/seed/lei.sql` (fourni à part, jamais versionné) après y avoir remplacé les deux adresses e-mail.
4. **Connexion** : *Authentication > Sign In / Providers > Email*, option **Confirm email** désactivée (la version gratuite ne permet plus de personnaliser les e-mails sans serveur d’envoi). Chaque parent crée son mot de passe à la première connexion. Une fois les comptes créés, désactivez **Allow new users to sign up** : plus personne ne peut créer de compte depuis l’appli.
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
  entries/        Saisies : types du domaine, apparence (couleurs, pictogrammes), description, accès aux données
                  (envoi hors ligne), fenêtres de saisie, biberon préparé, bouton +
  features/       Un dossier par écran : accueil, repas, sommeil, couches, mesures, tummy, journal, reglages, auth
    evolution/    Graphiques par type d’activité, réutilisés dans chaque onglet
  lib/            Fonctions pures et services : dates, règles métier (alertes, repères, prochain repas, biberon préparé),
                  normes OMS, affichage (thème, mode nuit), messages d’envoi, Supabase, temps réel
  ui/             Composants partagés : feuilles (geste retour, glisser pour fermer), messages, état hors ligne,
                  contrôles, navigation par jour, frise, icônes
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

- `useEntries` charge les saisies des 180 derniers jours de l’enfant affiché (plus tout l’historique des pesées et des repas solides), en une seule requête partagée par tous les écrans.
- Un biberon **préparé** est une saisie `bottle` avec `in_progress = true` : `AppContext` le tient à part (`prepared`), il n’est compté nulle part avant d’être donné.
- Les mutations (`useEntryMutations`) sont **optimistes** : l’écran se met à jour avant la réponse du serveur, et revient en arrière si le serveur refuse. Les identifiants sont générés côté client, ce qui rend l’annulation triviale.
- **Hors ligne** : le cache et les saisies en attente sont gardés sur le téléphone (`PersistQueryClientProvider`, `main.tsx`). Les fonctions d’envoi sont enregistrées une fois (`registerEntryMutations`) pour reprendre après un redémarrage ; les envois passent un par un, dans l’ordre.
- `useRealtime` écoute Supabase et **invalide** les requêtes concernées quand l’autre parent enregistre quelque chose.
- Les règles métier (`lib/rules.ts`) sont des fonctions pures, testées dans `lib/rules.test.ts`.

### Ajouter un type d’activité

1. Ajouter la valeur à l’enum `entry_type` (nouvelle migration).
2. Déclarer sa forme dans `DataMap` et ses métadonnées dans `ENTRY_META` (`entries/types.ts`).
3. Gérer son résumé dans `describe` et son formulaire dans `EntrySheet`.
4. Ajouter son pictogramme dans `ui/icons.ts`, et si besoin un graphique dans `features/evolution`.

---

## Pistes

- Résumé « Pendant votre absence » pour le parent qui se lève.
- Notifications entre parents et rappels de traitements (Web Push, Edge Function Supabase).
- Chrono de tétée avec bascule gauche / droite.
- Export PDF pour les rendez-vous chez le pédiatre.
- Pagination du journal au-delà de 180 jours.

# Notifications : installation (une seule fois)

Environ 15 minutes, tout se passe dans Supabase (supabase.com, votre projet). Rien à faire sur Netlify.
Les noms de menus peuvent légèrement varier selon la version de l'interface.

## 1. Base de données (SQL Editor)

Dans **SQL Editor**, puis **New query**, collez et lancez (**Run**) chacun de ces fichiers du dépôt, dans l'ordre :

1. `supabase/migrations/20261117000000_entries_author.sql` (si ce n'est pas déjà fait) ;
2. `supabase/migrations/20261118000000_notifications.sql`.

Chacun doit afficher « Success ». Ils ne modifient aucune saisie et peuvent être relancés sans risque.

## 2. La fonction « notifier » (Edge Functions)

1. Menu **Edge Functions**, puis **Deploy a new function**, puis **Via Editor**.
2. Nom de la fonction : `notifier`.
3. Remplacez le contenu du fichier `index.ts` par celui de `supabase/functions/notifier/index.ts`.
4. Ajoutez un second fichier nommé `notify.ts` avec le contenu de `supabase/functions/notifier/notify.ts`.
5. **Deploy**. Laissez la vérification JWT (« Verify JWT ») **activée**.

Avec la CLI Supabase, l'équivalent est : `supabase functions deploy notifier`.

## 3. Prévenir à chaque saisie (Database Webhooks)

1. Menu **Database**, puis **Webhooks** (ou **Integrations**, puis **Database Webhooks**), puis **Create a new hook**.
2. Nom : `notifier-saisies`. Table : `entries`. Événements : **Insert** et **Update**.
3. Type : **Supabase Edge Functions**, fonction `notifier`, méthode **POST**.
4. En-têtes HTTP : cliquez sur **Add auth header with service key** (cela ajoute `Authorization: Bearer …`).
5. **Create webhook**.

## 4. Rappels des biberons préparés (Cron)

1. Menu **Integrations**, puis **Cron** (activez l'extension si Supabase le propose), puis **Create job**.
2. Nom : `notifier-biberons`. Planification : `* * * * *` (chaque minute).
3. Type : **Supabase Edge Function**, fonction `notifier`, méthode **POST**, corps : `{"kind":"tick"}`.
4. En-têtes : **Add auth header with service key**.
5. **Create**.

Un appel par minute représente environ 45 000 appels par mois, loin de la limite de l'offre gratuite.

## 5. Sur chaque téléphone

1. Ouvrez l'appli (après la mise à jour), **Réglages**, section **Notifications**.
2. Saisissez votre **prénom**, puis **Enregistrer**.
3. **Activer les notifications sur ce téléphone**, puis acceptez la demande du téléphone.

Sur iPhone : l'appli doit être installée sur l'écran d'accueil (Partager, puis Sur l'écran d'accueil), iOS 16.4 ou plus récent.

## En cas de souci

- « Les notifications ne sont pas encore installées côté serveur » : l'étape 2 n'est pas faite, ou la fonction ne s'appelle pas exactement `notifier`.
- Rien n'arrive après une saisie de l'autre parent : vérifiez l'étape 3, puis **Edge Functions**, `notifier`, **Logs**.
- Si les en-têtes d'authentification posent problème, une alternative : dans **Edge Functions**, **Secrets**, ajoutez `NOTIFIER_SECRET` avec une valeur de votre choix, et mettez l'en-tête `x-notifier-secret` avec cette même valeur dans le webhook et le cron.

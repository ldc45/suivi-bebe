# Notifications

## Côté serveur (Supabase) : déjà installé

Tout est dans le dépôt et a été appliqué au projet Supabase :

- `supabase/migrations/20261117000000_entries_author.sql` : la base inscrit elle-même l'auteur de chaque saisie.
- `supabase/migrations/20261118000000_notifications.sql` : prénoms des parents, abonnements des téléphones.
- `supabase/migrations/20261118000001_notifier_hooks.sql` : la base appelle la fonction `notifier` à chaque saisie, et chaque minute tant qu'un biberon préparé est en attente. Les appels portent un secret tiré au hasard par la base (table `notifier_settings`, invisible depuis l'appli).
- `supabase/functions/notifier` : la fonction qui envoie les notifications (déployée avec « Verify JWT » désactivé, car elle vérifie elle-même ce secret).

Pour un autre projet Supabase : lancer les migrations dans l'ordre (SQL Editor), en remplaçant l'adresse de la fonction dans `20261118000001_notifier_hooks.sql`, puis déployer la fonction (`supabase functions deploy notifier --no-verify-jwt`).

## Sur chaque téléphone

1. Ouvrez l'appli, **Réglages**, section **Notifications**.
2. Saisissez votre **prénom**, puis **Enregistrer**.
3. **Activer les notifications sur ce téléphone**, puis acceptez la demande du téléphone.

Sur iPhone : l'appli doit être installée sur l'écran d'accueil (Partager, puis Sur l'écran d'accueil), iOS 16.4 ou plus récent.

## En cas de souci

- Rien n'arrive après une saisie de l'autre parent : vérifiez que les deux téléphones ont activé les notifications, puis dans Supabase, **Edge Functions**, `notifier`, **Logs**.
- On ne reçoit jamais de notification pour ses propres saisies : c'est voulu.
- La nuit (21 h à 7 h), les notifications arrivent sans son, sauf fièvre, selles à signaler et biberon à jeter.

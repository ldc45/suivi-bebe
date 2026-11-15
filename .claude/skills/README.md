# Skills du projet

Skills chargés par Claude Code quand il travaille sur ce dépôt.

## Propre au projet

| Skill | Rôle |
|---|---|
| `suivi-bebe-style` | Règles d'interface de Suivi bébé. **Prioritaire** sur tous les skills ci-dessous. |

## Skills externes (copie partielle, texte seulement)

Seuls les fichiers texte (`SKILL.md` et fiches de référence) ont été copiés, après relecture : ni scripts, ni binaires, ni images, ni automatismes (hooks).

| Skill | Source | Version copiée | Licence |
|---|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `2b86d9c` | Apache 2.0 |
| `emil-design-eng`, `animate`, `animation-performance`, `break-ui`, `gestures`, `improve-animations`, `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills), par Emil Kowalski | `0f2e23b` | MIT |
| `unslop` | [heydamir/unslop](https://github.com/heydamir/unslop), par Damir | `620163e` | CC BY 4.0 |

Chaque dossier contient la licence d'origine.

### Écarts volontaires

- **impeccable** : le lanceur `scripts/impeccable` n'est pas inclus. Il télécharge et exécute un binaire au premier lancement. Le skill prévoit ce cas (« Launcher unavailable ») et lit alors directement le contexte du projet.
- **unslop** : les scripts de capture (`snapshot.mjs`) et de vidéo (`story.mjs`) ainsi que les images d'exemple ne sont pas inclus.
- **emilkowalski/skills** : seuls les skills utiles à une appli web sont repris (pas Swift, Expo, Sonner, choix de bibliothèque, prototypage).
- **taste-skill** ([Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)) n'est pas inclus : il vise les sites vitrines (grandes images, effets 3D), installe un automatisme qui exécute des scripts et pèse 36 Mo d'images.

Pour mettre à jour un skill externe : recopier les mêmes fichiers depuis la nouvelle version, les relire, et mettre à jour ce tableau.

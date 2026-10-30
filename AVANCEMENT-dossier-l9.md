# Avancement · ligne dossier-l9 (Sage L9 · fonctions 95, 96, 100, 101, 102)

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Branche de sauvegarde `travail/dossier-l9`, partie de `origin/main`
(`c942b8605`). Rien n'est intégré sur `main` par cette ligne.

## Fait

### 102 · Échange d'écritures (Fichier > Échanger des écritures)

- `src/modules/exports/echange/` · règles pures (`echange-ecritures.ts`),
  service, contrôleur `/echanges-ecritures`, spec.
- Tables `receptions_echange` et `ecritures_recues`
  (migration `20270220000100_echange_ecritures`).
- Le dossier qui reçoit relit l'export des modifications d'un AUTRE dossier ·
  chaque écriture par son identifiant d'origine · jamais reçue, elle naît au
  brouillard ; changée, elle est remplacée EN PLACE au brouillard (même
  numéro, `modifierPieceDuModule`), ou retirée puis recréée si elle change
  d'exercice, de journal ou de mois d'un journal mensuel ; retirée chez
  l'expéditeur, retirée ici. Jamais deux fois · registre unique par
  identifiant, empreinte du fichier unique, envoi plus ancien sans effet.
- Jugée par les règles de l'import des écritures (`controlesDEntree`,
  ventilation non exigée, comptes et journaux du dossier, exercice ouvert qui
  couvre la date).
- Tant qu'elle est TENUE, l'écriture reçue est RETENUE (`detenteurs-ecriture.ts`,
  `DETENTEUR_ECHANGE`) · « Détacher » la reprend au compte du dossier.
- Une écriture reçue ne repart pas par l'export des modifications du dossier
  qui la reçoit (anti-jointure sur `ecritures_recues`).
- Écran `EchangeEcrituresPage` (aperçu puis réception, écritures reçues par
  état, réceptions).
- Rejeu sur vraie base · `scripts/rejouer-echange-ecritures.cjs`, deux
  dossiers SYSCOHADA, quatre envois, clôture de 2026 chez celui qui reçoit ·
  conforme.

## Décisions et fondement

- 102 · AUDCIF art. 22, 7° (ce qui entre par transmission s'appuie sur une
  pièce probante · l'envoi, cité par son numéro et l'empreinte de son
  fichier) ; art. 22, 2° (rien n'entre au livre-journal sans le dossier qui
  reçoit · tout naît au brouillard ; une écriture validée ici ne se remplace
  plus) ; art. 20, al. 2 (la correction d'une validée passe par une
  inscription en négatif).

## Reste

- 95 utilisateurs connectés et messagerie interne.
- 100 préférences d'affichage, notifications, aide à la formule des états
  personnalisés.
- 96 langue de l'interface (infrastructure, anglais du cadre commun).
- 101 organisation du cabinet en niveaux.
- Relecture adverse (deux tours), bloc § 3, rejeux.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
DATABASE_URL=postgresql://postgres@localhost:5432/<base jetable migrée> node scripts/rejouer-echange-ecritures.cjs
```

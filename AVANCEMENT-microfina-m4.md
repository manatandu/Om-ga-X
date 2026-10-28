# Avancement · ligne Microfina M4 (détenteur d'un bien)

Branche de sauvegarde `travail/microfina-m4`, copie `/home/user/wt-microfina-m4`.
Plan · `docs/comparaison-microfina/plan-reproduction-microfina.md`, ligne M4
(idée 4 · affectation à un salarié, transfert, libération, reçu signé, suivi
sur une période).

## Fait

- Schéma · `DetentionBien`, `RecuDetentionBien`, `NatureRecuDetention` ;
  migration écrite à la main `20270198000100_detentions_biens` (au-dessus
  de main, M2 et M3), clés RESTRICT, index qui commencent par `tenantId`,
  `prisma migrate diff` sans différence sur base jetable.
- Règles pures `immobilisations/detention-bien.ts`, service, contrôleur,
  DTO. Aucune écriture comptable.
- Registres · journal d'audit (`MODELES_AUDITES`), cloisonnement, libellés,
  usages de la fiche (retiennent la suppression, jamais la modification),
  libellés de `common/suppression/references.ts`, suppression d'un lieu
  (refus nommé au lieu d'un 500), maintenance du registre (biens sortis
  encore détenus).
- Écran · volet « Détenteur » de la fiche du bien, onglet « Détenteurs »
  (suivi sur une période), masqués aux deux rôles cantonnés.
- Tests · `detention-bien.spec.ts` (serveur), `lib/detention-bien.spec.ts`
  (client), `e2e/tests/microfina-m4-detenteur.e2e.ts`.

## Décisions (aucun texte ne régit la détention · conventions d'OmegaX)

- Droits · lire · administrateur, comptable, lecture seule ; écrire ·
  administrateur, comptable. Aide-comptable ET gestionnaire de paie refusés
  en entier (le détenteur est un salarié nommé, le personnel est fermé à
  l'aide ; le gestionnaire n'a pas le registre des immobilisations).
- Une détention à la fois par bien, dans l'ordre des dates (jamais
  antidatée sous la dernière ; le jour même de la fin admis), jamais dans le
  futur (jour de Kinshasa), jamais avant l'acquisition ou l'entrée dans le
  groupe, jamais sur un bien sorti ; contrat en cours à la date exigé.
- Un bien sorti pendant sa détention se libère encore (sinon enfermé),
  signalé au suivi, à la fiche et à la maintenance.
- Reçu · suite continue par dossier sous verrou consultatif, clé unique
  (dossier, numéro), texte figé, mention « document interne, ne vaut que par
  ses signatures » ; signature DÉCLARÉE une fois (qui, quel jour), 409 sinon.
- Le lieu donné à la remise devient le lieu du bien.
- Une fiche qui porte des détentions ne se supprime plus.

## Relecture indépendante (2026-10-28), corrigée

- B1 · ANNULATION du dernier acte vivant, à rebours (`POST
  /immobilisations/detentions/:id/annuler`, `recuId` montré + motif,
  administrateur et comptable, sous `FOR UPDATE` de la fiche, mises à jour
  unitaires au journal d'audit). Détention MARQUÉE (`annuleeLe`), reçu
  marqué (`annuleLe`), numéro gardé ; transfert annulé rouvre la précédente,
  libération annulée rouvre la sienne. Annulées hors du suivi, de l'ordre des
  dates, de la suppression et du décompte du transfert dans le groupe ;
  détachées (`immobilisationId` nul, `bienDecrit` figé) quand la fiche part
  (`detentions-de-la-fiche.ts`). Le lieu donné à la remise n'est pas rendu
  (aucun ancien lieu gardé), dit dans la bulle.
- m1 · acquisition datée après la première remise vivante refusée
  (modification de la fiche ; l'entrée dans le groupe naît sur une fiche
  neuve, sans détention).
- m2 · CHOIX · une sortie datée avant la remise n'est PAS refusée (acte
  comptable daté par sa pièce, huit chemins de sortie) · NOMMÉE au volet,
  au suivi (compteur et ligne) et à la maintenance (compteur).
- m3 · détenteur sans contrat en cours aujourd'hui · compteur au suivi
  (avec la ligne) et à la maintenance (nombre seul).
- m4 · index unique partiel `detentions_biens_ouverte_vivante_key`, relu
  par `detention-bien.spec.ts`, éprouvé en base au rejeu.
- m5 à m11 · salarié vidé hors liste, lieu remis à zéro, historique relu
  après un refus, réponse de signature rattachée au reçu, `nonEnregistre`
  pour la fermeture gardée, e2e daté au plus petit du début d'exercice et
  du jour (et annulation au navigateur), commentaire remis à sa place.
- Maintenance · l'écran ne montrait pas les biens sortis encore détenus ·
  servis avec les deux compteurs.

## Reste

- Rejeu sur vraie base FAIT · `scripts/rejouer-detentions-biens.cjs`, tout vert (PostgreSQL 16 jetable),
  y compris l'annulation à travers la clôture de 2025 et les deux impasses
  (doublon supprimé après annulation ; transfert dans le groupe annulé après
  l'annulation de la détention chez la cellule).
- Gestionnaire de paie · choix gardé (aucun accès), à soumettre à Manasse.
- Relecture « échecs silencieux » FAITE (relecture propre, sans agent) ·
  liste des lieux en échec dite au lieu d'une liste vide ; boucle de rendu
  du volet (rappel instable en dépendance d'effet) corrigée et gelée.
- Test navigateur `microfina-m4-detenteur.e2e.ts` vert sous Chromium en
  local, avec `immobilisations.e2e.ts` et `sage-l4-annulation.e2e.ts`.
- À faire à l'intégration · deux tours de relecture (comptable,
  typescript-reviewer, react-reviewer), tests navigateur WebKit au CI.

## Commandes

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

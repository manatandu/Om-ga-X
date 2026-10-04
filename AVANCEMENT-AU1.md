# AVANCEMENT · ligne AU1 (audit · AU1 et AU2)

Branche de sauvegarde `travail/au1`, partie de `main` d32e22a. Fiche retirée à l'intégration.

## Fait

- AU1 reproduit sur vraie base (SYSCOHADA, serveur compilé, port 8116) · lettrage manuel d'une ligne
  d'à-nouveau PROVISOIRE de N+1 (201), clôture de période de N+1 au 31/01 (201), clôture de N refusée
  (« délettrez-les »), délettrage refusé (ligne figée) · N enfermé.
- AU2 reproduit sur vraie base · bilan d'ouverture importé et validé dans N+1, clôture de N · deux
  à-nouveaux, client 600 000 au lieu de 300 000, banque 400 000, résultat 1 000 000.

- AU1 corrigé · lettrage d'une ligne d'à-nouveau provisoire refusé par tous les chemins (`verifierLignes` ·
  manuel, complément, pré-lettrage confirmé, module ; l'automatique et le pré-lettrage ne le proposaient
  déjà pas, le Règlement des tiers le refusait, le pointage écarte tout à-nouveau). Dossiers hérités · la
  clôture reporte lettrage et pointage sur la ligne qui remplace (`apparierTenues`), groupe figé sans
  équivalent laissé partiel et dit, pointée sans équivalent refusée (dépointer).
- AU2 corrigé · `issueDeLOuverture` (clôture) · brouillard refusé (valider), concordant rien ajouté, N sans
  écriture l'import fait foi, divergent déclaration RECTIFIER (négatif + report exact) ou CONSERVER (motif sur
  `Exercice.motifOuvertureSuivanteConservee`, migration 20270141000000). Provisoire · rien quand une ouverture
  existe. Aperçu `GET /exercices/:id/ouverture-suivante`, déclaration à l'écran Fin d'exercice.
- Tests · `cloture-annuelle.spec.ts` (AU1, AU2), `report-a-nouveau.spec.ts` (fonctions pures),
  `lettrage.service.spec.ts` (AU1), e2e `ouverture-suivante.e2e.ts` (3 parcours, verts en local).
- Bloc § 3 passé · tsc et jest serveur (752 suites, 10 721 tests), build ; client tsc, vitest (1 804), build ;
  `prisma migrate diff` sans différence.
- Vraie base, deux référentiels, à travers N, N+1 et N+2 · AU2 (egal, ecart → RECTIFIER, conserver, vide,
  brouillard puis valider), AU1 (hérité apparié, hérité orphelin figé), provisoire avec import.

## Reste

- Intégration sur `main` (appelant), relecture `silent-failure-hunter`, `typescript-reviewer`,
  `react-reviewer`.

## Décisions prises

- AU1 · AUDCIF art. 22, 2° · l'à-nouveau provisoire n'est jamais validé, donc jamais au livre-journal · il
  ne se lettre pas (même parti qu'A6 bis au Règlement des tiers). Art. 22, 3° · la clôture de période n'est
  jamais refusée ; l'issue des dossiers hérités est le report du lettrage sur la ligne qui remplace.
- AU2 · AUDCIF art. 34 / SYCEBNL art. 16, 4) · une seule ouverture ; AUDCIF art. 20, al. 2 · la correction
  d'un import faux passe par l'inscription en négatif puis l'enregistrement exact, jamais par un écart en
  une ligne, jamais par le retrait d'une écriture validée (art. 22, 2°). Lequel des deux bilans est faux
  est un FAIT que le texte ne tranche pas · le cabinet le déclare (RECTIFIER ou CONSERVER, motif).

## Vérification

- scénarios `au1b.mjs`, `au2.mjs`, `au2p.mjs` (scratchpad de la session), grappe jetable 55439, bases `au1_*`.
- `npx jest src/modules/exercice src/modules/lettrage` ; e2e `tests/ouverture-suivante.e2e.ts`.

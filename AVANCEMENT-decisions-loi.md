# Avancement · ligne decisions-loi

Branche de sauvegarde · `travail/decisions-loi`. Source des décisions ·
`docs/decisions-par-la-loi-2026-10-04.md` (six décisions et la décision de
Manasse du 2026-10-04 sur le samedi).

## Fait

- **F8-D1 · samedi d'un pur paiement** · `retenues/jour-ouvrable.ts`
  (`NatureEcheance`, `estJourOuvrable` et `reporterAuJourOuvrable` qualifiés,
  DÉCLARATION par défaut), `natureEcheance: 'PAIEMENT'` sur les trois acomptes
  de l'art. 57 bis (`correspondance-retenues.ts`), câblé dans
  `prochaineEcheanceDeclarative`. Réserve (5) réécrite. Tests ·
  `report-jour-ouvrable.spec.ts`, `echeances-impot-societes.spec.ts` (le
  25 juillet 2026 reste le 25), `passes-f11-f8-d3.spec.ts`.

- **R2-A3 / R2-B6 · cases ZN à ZS** · `Exercice` porte
  `nombreEtablissementsPays`, `nombreEtablissementsHorsPays`,
  `premiereAnneeExercicePays`, `controleEntreprise` (enum `ControleEntreprise`),
  migration `20270147000000_fiche_r2_exercice`, route
  `POST /exercices/:id/fiche-r2` (`@ReferentielsAutorises(SYSCOHADA)`),
  feuille « Fiche R2 » de la liasse (« Non renseignée » à défaut, « X » sur la
  case du contrôle, deux ZQ), écran `FicheR2Exercice` dans Exercices. Tests ·
  `exercice/fiche-r2.spec.ts`, `liasse-syscohada.spec.ts`.

- **F14-D1 · entreprise du portefeuille de l'État** · `Tenant.entreprisePortefeuilleEtat`
  (oui, non, pas encore dit ; « oui » refusé hors SYSCOHADA), `Exercice.dateAssembleeGenerale`
  et `dateDepotEtatsPortefeuille` (migration `20270148000000_portefeuille_etat`, route
  `POST /exercices/:id/dates-portefeuille`, SYSCOHADA), `exercice/portefeuille-etat.ts`
  appliqué au planning (31 mars au lieu de six mois pour les étapes 21 et 23 d'un exercice
  clos au 31 décembre, étape 17 à 45 jours avant l'assemblée, PV à l'Administration des
  recettes non fiscales à +10 jours de l'assemblée déclarée, affectation à +60 jours du
  dépôt déclaré, `echeance: null` « Non calculée » sinon ; autre clôture dite). Écrans ·
  Paramètres du dossier (select), Exercices (`DatesPortefeuilleExercice`). Tests ·
  `portefeuille-etat.spec.ts`, `identifiants-referentiel.spec.ts`.

- **20B / 29B à seize colonnes** · `notes-annexes/effectifs-seize-colonnes.ts`
  (`colonnesEffectifsSycebnl`, zones du texte SYCEBNL, M/F), migration
  `20270149000000_effectifs_seize_colonnes` (ancien rang k au rang 100 + k, rien
  supprimé, jamais scindé), `chargerSaisies` les écarte des cellules et les sert en
  `saisiesFormatAnterieur`, bloc « Saisie antérieure à reporter » à l'écran. Gel
  de `rubriques-en-saisie.spec.ts` passé à 16. Tests · `effectifs-seize-colonnes.spec.ts`.

- **R2-B5 · lignes répétables** · `SaisieNote.rang` (migration
  `20270150000000_saisies_notes_rang`, unicité recréée, existant au rang 0),
  `RubriqueNote.repetable` (note 4 filiales, note 13 apporteurs, nouvelles
  occurrences « Produit » en 32 et « Matière ou produit » en 33 avant NON
  VENTILÉ(S) et TOTAL), moteur `etendues` (une ligne par rang), rang refusé
  hors répétable, `confronteSaisiesDe` · TOTAL de la note 13 contre la somme
  des « Montant total » saisis, en `informations` (jamais un refus). Écran ·
  `lib/lignes-repetables.ts`, bouton « Ajouter une ligne ». Tests ·
  `note-annexe.service.spec.ts`, `liasse-syscohada.spec.ts` (trois apporteurs
  sortent trois), `lignes-repetables.spec.ts`.

- **O1a-D2 · liquidation d'une société** · `Tenant.dateNominationLiquidateur`,
  `regimeLiquidation` (enum `RegimeLiquidation`), `associeUniquePersonneMorale`
  (migration `20270151000000_liquidation_societe`), refus art. 201 al. 4 et
  nomination avant dissolution (art. 204), `exercice/liquidation-societe.ts`
  (étape 27 · bilan avant liquidation, publication à un mois, clôture à trois
  ans, situation provisoire au 31 décembre hors art. 223 ; rapport à six mois,
  états à trois mois, assemblée à six mois de chaque clôture dans les cas de
  l'art. 223 ; procédure collective dite, rien calculé). Écran · Paramètres du
  dossier. Tests · `liquidation-societe.spec.ts`, `mentions-dossier.spec.ts`.

- **Relecture adverse** · dépôt au RCCM d'une entreprise du portefeuille ramené
  à un mois après l'assemblée (AUSCGIE art. 269, lu) ; note 20B / 29B portant
  sa seule saisie à huit colonnes tenue applicable et dite dans la liasse
  (sinon « NEANT » imprimé sur des effectifs déclarés).
- **Scénario sur base jetable** (PostgreSQL 16 local, serveur compilé, API) ·
  SARL SYSCOHADA N et N+1 avec clôture annuelle de N · samedi 25 juillet 2026,
  fiche R2 (liasse relue), portefeuille (31 mars, PV, affectation), liquidation
  art. 223 1° (N puis N+1), trois apporteurs (liasse relue), N+1 vierge ; ASBL ·
  migration 20B / 29B rejouée sur une saisie posée en base, liasse relue,
  refus SYCEBNL (portefeuille 400, fiche R2 403). 41 vérifications, 0 échec.
  Script · scratchpad de la session (non versionné).

## Relecture 1 (2026-10-07, sur eeb9e98, migrations 20270147 à 20270152)

- **B1 · retrait de la saisie au format antérieur** · `POST
  /notes-annexes/saisies/format-anterieur/retirer` (mêmes `@Roles` que la saisie),
  motif 3 à 500, `SaisieNote.motifRetrait` posé par `update` unitaire puis `delete`
  par identifiant, dans `transactionJournalisee` (migration `20270152000000`) ;
  exercice clos admis comme la saisie ; note forcée applicable tant qu'il en
  reste ; rattachement par jeu, code et sous-tableau, rubrique disparue nommée ;
  nature (effectif, masse salariale) servie. Écran · motif et bouton sous
  `peutEcrire`. Docs · `restitution-du-dossier.md` dit que la migration 20270149
  déplace hors du journal d'audit.
- **M10 · `rang: null`** refusé en 400 nommé (`@FacultatifNonNul`).
- **M12 · grille** · `gabaritGrilleNote` (`minmax(108px, 1fr)`) pour l'en-tête et
  les lignes, champs `w-full min-w-0`, `aria-label` et `title` « ligne · colonne »
  (« · ligne k » sur une liste).
- Mineurs faits avec · confrontation de la note 13 servie en nombres
  (`confrontations`, lue par `nombreSaisi`, mise en forme par `montant()` et à la
  liasse), jetons des relectures des deux pages de notes, lignes demandées
  mémorisées PAR RANG pour le tableau (plus d'effet sur `note`), bouton « Ajouter
  une ligne » au `mousedown` retenu, `aria-label` par rubrique, bulle (vider une
  ligne la retire), commentaires de types réalignés, tests de la migration 20270149
  par propriété (une seule instruction UPDATE, liste exacte des clés).
- **Serveur, majeurs 3 à 9 et 13** (migration `20270153000000`,
  `Exercice.dateTransmissionPvPortefeuille`) ·
  - M3 · bilan avant liquidation et situation annuelle provisoire sans échéance
    (`sansDelai`, « aucun délai au texte »), date dans `debut`, jamais en retard ;
  - M4 · 1384 servi, le « 1374 » du ch. 40 signalé sur place (compétence
    `syscohada` : « le guide définit 1374 mais utilise 1384 ») ; décision corrigée ;
  - M5 · portefeuille de l'État refusé hors des cinq sociétés commerciales
    (`FORMES_SOCIETES_COMMERCIALES`, aussi dans `liquidation-societe.ts`) ;
  - M6 · assemblée déclarée au plus tard le 31 mars · étapes 21 et 23 satisfaites ;
    PV (transmission déclarée) et affectation (décision d'affectation) levables ;
  - M7 · étapes 17 et 18 à l'assemblée moins 45 jours, 13 et 16 bornées à cette
    date, débuts recalculés (17, 21, 23, 24) ;
  - M8 · PV DGI (LPF art. 13 bis) compté depuis l'assemblée déclarée, reporté au
    jour ouvrable ;
  - M9 · dates de faits par `jourSaisiOuEffacement` (jour écrit en tête, refus du
    jour absent du calendrier), nomination et dissolution aussi, comparées à
    `jourDeKinshasa` ;
  - M13 · régime non déclaré · jalon « Régime de la liquidation à déclarer », rien
    d'autre ; associé unique personne morale · dissolution ADMISE, nomination et
    régime refusés (art. 201 al. 4), une ligne satisfaite au planning, aucune
    mention de l'art. 204 ; contrôles bornés aux sociétés commerciales.
  - Mineurs · fiche R2 refusée au S.M.T, rôles des deux routes alignés sur
    `dateArreteComptes` (administrateur) ; sanctions 902 1° à 3° et 903 1° et 2°
    (judiciaire seule) ; PV DGRAD sans assemblée au 31 mars plus 10 jours « au plus
    tard » ; portefeuille « pas encore dit » dit aux étapes 21 et 23 ; seconde
    quotité en PAIEMENT ; `prochaineEcheanceDeclarative` compare la date reportée
    (30 avril 2028 → 2 mai) ; réserve du samedi « décision de l'éditeur » ; tests
    en `Date.UTC`.
- **Écran, majeurs 2, 5 et 11, mineurs** ·
  - M2 · `lib/jalons-planning.ts` sépare les trois sens d'une échéance nulle
    (non calculée, aucun délai au texte, levée) ; l'accueil ne passe jamais au vert
    tant qu'un jalon est non calculé et le dit (« Non calculée · libellé ») ; le
    planning compte les non calculés dans son en-tête ;
  - M5 · « Portefeuille de l'État » proposé et envoyé aux cinq sociétés seules ;
  - M11 · choix du régime sans article visible (infobulle), second cas du 1°
    (convention appliquant les art. 224 à 241), `option` relu par
    `titres-formels-pages-m-z.spec.ts` ;
  - fiche R2 masquée au S.M.T, les deux formulaires réservés à l'administrateur
    (droit lu dans la session), réponses périmées jetées (numéro d'envoi, jeton de
    `charger`), « Non renseignée » en lecture, message de succès des dates ;
    l'assemblée se déclare pour toute société commerciale (PV DGI), dépôt et
    procès-verbal pour le seul portefeuille.

## Reste

- Intégration sur `main` (non faite, à la demande).

## Décisions prises

- F8-D1 · LPF art. 110 bis al. 2 (dimanche, fériés reportés pour tout
  paiement) ; samedi ouvrable pour un pur paiement, décision de Manasse du
  2026-10-04. Seuls les acomptes de l'art. 57 bis sont qualifiés de pur
  paiement · les reversements de retenues se déclarent au guichet avec le
  paiement, laissés en DÉCLARATION faute de texte qui les dise « sans dépôt ».

- R2 · par EXERCICE (la décision le permet). ZP postérieure à l'année de
  clôture refusée (lecture d'OmegaX). Le nombre de cellules du groupe n'est
  PAS montré à côté de ZN/ZO (« peut être », facultatif).

- F14-D1 · point 5 (dividende prioritaire minier, 15 mai) NON codé · la décision le dit
  « à confirmer sur le texte même de la LF 2026 », que le corpus ne donne qu'en résumé
  sous deux numéros. Le lien « entreprise publique » et case ZQ public n'est pas proposé
  (facultatif). Jours calendaires (O.-L. n° 13/003 sans règle d'ouvrable).

- 20B / 29B · personnel extérieur et bénévole laissé à sa colonne unique (texte
  muet, à lire au J.O. OHADA). Contrôle Total = somme des zones NON codé (« peut »).
  Les saisies antérieures sont DITES à l'écran ET dans la liasse (commentaire de la
  note), et se RETIRENT par « Retirer la saisie au format antérieur » (relecture 1).

- O1a-D2 · la dissolution vivait déjà sur le DOSSIER (`Tenant.dateDissolution`,
  « un seul fait, une seule place ») · nomination et régime l'y rejoignent, au lieu
  de l'exercice que la décision évoquait ; le drapeau est la date de dissolution.
  Non tranché (corpus muet) · sort de la période du 1er janvier à la dissolution ;
  liquidation d'une association ou ONG (non servie) ; date de publication de la
  clôture (radiation art. 220 non calculée, non stockée).

## Vérification

Dernier passage (2026-10-07, relecture 1) · serveur `tsc` propre, jest 766 suites,
10 927 tests (un dépassement de 5 s sous charge dans
`groupe/operations-reciproques-agregat.spec.ts`, vert relancé seul), `nest build`
propre ; client `tsc` propre, vitest 228 fichiers, 1 842 tests, `vite build`
propre ; `prisma migrate diff` sans différence (migrations jusqu'à 20270153).

Scénario sur base jetable (PostgreSQL 16 local), serveur compilé, 56 vérifications,
0 échec (`scenario-r1.mjs` du bloc-notes) · SARL du portefeuille en liquidation à
travers la clôture de 2026 vers 2027 (« 2027-02-30 » et « 2026-02-30 » refusées,
heure à fuseau qui garde le jour, AG du 20 mars qui satisfait 21 et 23, étape 17 au
3 février, PV DGRAD au 30 mars, PV DGI au 30 mars depuis l'AG, bilan avant
liquidation sans échéance, 1384) ; SA de 2025 aux échéances passées, rouges puis
levées par l'AG et la transmission déclarées, gardées après clôture ; SA à associé
unique personne morale (dissolution admise, une ligne satisfaite, nomination et
régime refusés) ; entreprenant refusé au portefeuille ; association · saisie 29B au
format antérieur retirée sur exercice CLOS, motif court refusé, ligne supprimée,
deux maillons au journal d'audit, `rang: null` refusé en 400 nommé.

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <base jetable> --exit-code
```


```bash
npx tsc --noEmit
npx jest src/modules/retenues
```

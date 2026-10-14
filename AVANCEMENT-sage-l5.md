# Avancement · ligne sage-l5 « paie »

Reproduction des fonctions de Sage cochées par Manasse le 2026-10-14
(`docs/comparaison-sage/reproduction/`), ligne L5 · copie
`/home/user/wt-sage-l5`, branche `travail/sage-l5`. Fonctions, dans l'ordre ·
79 (congés acquis chaque mois), 78 (temps, absences, arrêts), 75 (banques du
salarié et paiement des salaires), 88 (ventilation analytique de la paie),
85 (questionnaire société et salarié).

## Fait

- **79 · congés acquis chaque mois** · fait (commits `ec51871` serveur,
  `3026d91` écran, puis le parcours navigateur).
  - Serveur · moteur pur `personnel/conges-acquis.ts` (compteur par période
    annuelle de date à date, mois de service acquis sur bulletin émis,
    tranche d'ancienneté de `decompte-final.ts`, reprise déclarée, signal de
    l'art. 140 al. 4), `allocationDeConge` et `trancheDAnciennete` extraits de
    `decompte-final.ts` (un seul moteur pour l'indemnité compensatoire et
    l'allocation du bulletin), `conges.service.ts` et `conges.controller.ts`,
    tables `RepriseCongesSalarie` et `CongeSalarie` (migration
    `20270175000100_conges_acquis`), allocation portée au bulletin
    (`allocationsConge` de la saisie, rejouée au serveur, liée à l'émission).
  - Écran · onglet Congés de la fenêtre Personnel (`components/paie/CongesPaie.tsx`,
    modale commune `components/paie/ModalePaie.tsx`), bloc « Allocations de
    congé du mois » de l'onglet Simulation (`lib/conges-paie.ts`).
  - Parcours navigateur `e2e/tests/sage-l5-conges.e2e.ts` (reprise déclarée à
    l'écran, compteur, refus au-delà du solde, congé posé à l'écran, allocation
    portée au bulletin d'août, 1 040 000 + 480 000, congé porté non annulable,
    bulletin annulé qui le libère). Aucune écriture n'est passée par la
    fonction · pas de scénario de clôture à jouer.

- **78 · temps, absences, arrêts** · en cours, par étapes.
  - Étape 1, absences · faite. Moteur pur `personnel/absences.ts` (treize
    causes du Code, leur régime de rémunération et leur effet sur le compteur
    des congés, jours ouvrables et demi-journées, refus bornés par le texte),
    table `AbsenceSalarie` (migration `20270175000200_absences_salaries`),
    `absences.service.ts`, `absences.controller.ts`, lecteur unique
    `absences-lecture.ts` branché sur le compteur des congés (fonction 79) et
    sur l'émission d'un bulletin qui porte une allocation de congé ;
    `service-du-salarie.ts` (la continuité du service, un seul calcul). Écran
    · onglet Absences, bloc « Absences du mois » de l'onglet Simulation
    (proposition du salaire des jours dus et de l'indemnité d'incapacité,
    reprise au clic). Parcours `e2e/tests/sage-l5-absences.e2e.ts`. Aucune
    écriture · pas de scénario de clôture.
  - Étape 2, heures effectuées et heures supplémentaires · à faire.
  - Étape 3, arrêts et indemnités journalières de la CNSS · à faire.

## Reste

- 78 étapes 2 et 3, 75, 88, 85.
- 79 · le décompte final ne relit pas encore le compteur pour proposer les
  mois non couverts par un congé (saisis à la main, comme avant) ; un congé
  porté au bulletin et une indemnité compensatoire au décompte du même mois
  sont refusés ensemble par la garde du double compte (A8, m).

## Décisions prises par la loi

- **D9-a · le mois de service se compte de date à date** depuis l'entrée en
  service, comme l'année de l'art. 140, al. 3 (« une année de services
  comptée de date à date »). Le mois civil ferait perdre un jour à tout
  salarié entré un 15. Un mois de service est acquis quand il est révolu,
  couvert en entier par le contrat, que chaque mois civil qu'il touche porte
  un bulletin émis, et qu'aucun de ses jours n'est hors service.
- **D9-b · les droits NAISSENT à l'expiration de l'année** (art. 140, al. 3) ·
  le solde que l'on peut prendre est fait des seuls droits nés ; les jours de
  la période en cours sont « en cours d'acquisition ». Un congé posé au-delà
  du solde n'est pas refusé, il se DIT (case et motif), consigne de la ligne.
- **D9-c · la tranche d'ancienneté** est due entière à la période qui compte
  au moins un mois entier (décision T6, art. 141 et 144), à l'ancienneté
  atteinte au terme de la période révolue, à celle atteinte à la date de
  lecture pour la période en cours (`trancheDAnciennete`, un seul calcul).
- **D9-d · l'allocation de l'art. 142** = jours × (taux journalier + moyenne
  mensuelle des douze mois ÷ 26), le moteur du décompte final
  (`allocationDeConge`, `REGLE_MOYENNE_AU_JOUR`). Taux journalier PROPOSÉ
  depuis le contrat (décret n° 25/22, art. 7, par analogie), moyenne
  PROPOSÉE sur douze bulletins émis seulement (art. 142, al. 2), jamais
  substitués ; absents, l'allocation vaut `null` et le bulletin refuse de la
  porter.
- **D9-e · jours du congé** · jours ouvrables du Code (art. 7, point 9 ;
  `jours-du-code-du-travail.ts`), moins les jours de voyage déclarés
  (art. 141, al. 3) et les jours de maladie (al. 4) ; paiement au plus tard
  le dernier jour ouvrable avant le départ (art. 145), dit.
- **D9-g · aucun bulletin avant 2026** · l'impôt n'est calculé qu'à partir du
  1er janvier 2026 (loi n° 23/053, `LOI_IRPP.entreeEnVigueur`), donc aucun
  bulletin antérieur ne s'émet · les mois de service d'avant se DÉCLARENT par
  la reprise, avec leur source, jamais présumés.
- **D9-f · continuité du service** · contrats renouvelés ou qui se suivent
  sans un jour d'écart · convention d'OmegaX, dite (le Code ne définit pas la
  continuité, l'« employeur substitué » ne se lit sur aucun contrat).

- **D8-a · ce que l'employeur doit pour les jours d'une absence**, nature par
  nature, au texte · deux tiers pour la maladie (art. 105), l'accident du
  travail les six premiers mois (art. 106) et la maternité (art. 130) ;
  congé de circonstance payé jusqu'à quinze jours ouvrables par an, aux jours
  de l'événement, sans fractionnement (art. 146) ; absence non autorisée non
  payée, empêchement du fait de l'employeur payé (art. 93) ; force majeure
  non due (art. 59) ; mise à pied, obligations militaires, réquisition,
  mandat public, grève, incarcération · droits fixés par l'arrêté de
  l'art. 58, absent du corpus · rien n'est chiffré, et c'est dit.
- **D8-b · la proposition du mois** · vingt-six jours payés par mois
  (décret n° 25/22, art. 7, par analogie, comme le mois entamé du préavis),
  un jour ouvrable non payé ou payé aux deux tiers retranchant 1/26 ; les
  jours fériés compris dans une absence restent payés à plein (art. 93),
  lecture protectrice ; l'indemnité d'incapacité se calcule sur le salaire
  et la moyenne des douze mois de l'art. 66 (art. 105, al. 3), DÉCLARÉE,
  jamais présumée nulle. Proposée, reprise au clic, jamais substituée.
- **D8-c · l'absence et le compteur des congés** (art. 141, al. 2 et 4) ·
  l'incapacité (maladie, maternité · l'art. 57, 1° range la grossesse parmi
  les incapacités) compte comme service jusqu'à six mois par année de
  service, mesurés de date à date depuis son premier jour (convention dite) ;
  l'accident du travail sans limite ; le congé de circonstance et
  l'empêchement du fait de l'employeur comptent ; les autres causes sont hors
  service. Les jours de maladie pendant un congé ne comptent pas comme congé.
- **D8-d · mise à pied** · « jusqu'à concurrence de deux fois quinze jours
  par an » (art. 57, 5°) lu comme deux mesures d'au plus quinze jours de
  calendrier par année civile ; au-delà, refus nommé.

## Questions pour Manasse

- **Q2 · la maternité, deux textes** · le Code (art. 130, art. 59) fait
  devoir à l'employeur les deux tiers de la rémunération pendant quatorze
  semaines ; l'arrêté n° 146/2018 (art. 63) fait payer par la Caisse une
  indemnité journalière égale à l'intégralité de la rémunération journalière
  moyenne des trois derniers mois, et subroge l'employeur qui paie toute la
  rémunération (art. 139). Le corpus ne dit pas comment les deux se
  combinent (cumul, imputation) · OmegaX propose les deux tiers du Code et
  nomme l'indemnité de la Caisse (étape 3).
- **Q1 · un jour hors service rend-il le mois non entier ?** L'art. 141, al. 2
  énumère les services pris en considération (prestation, repos hebdomadaire,
  congé payé, fériés, incapacité jusqu'à six mois par an). Lecture retenue,
  littérale · un mois qui contient un jour de mise à pied ou d'absence non
  rémunérée n'est pas un « mois entier de service » et n'acquiert rien. Le
  texte ne dit pas s'il faut plutôt compter les jours de service et les
  convertir. Le mois est nommé à l'écran avec le jour en cause.

## Vérification

```bash
npx jest --maxWorkers=1 src/modules/personnel/conges-acquis.spec.ts src/modules/personnel/conges-bulletin.spec.ts
npx jest --maxWorkers=1 src/modules/personnel/absences.spec.ts
(cd client && npx vitest run src/lib/conges-paie.spec.ts src/lib/absences-paie.spec.ts)
# montage local (CLAUDE.md § 10), ports 8085 et 4185, puis
(cd e2e && OMEGAX_APP=http://localhost:4185 OMEGAX_API=http://localhost:4185/api \
  PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/sage-l5-conges.e2e.ts tests/sage-l5-absences.e2e.ts)
DATABASE_URL=postgresql://jetable:jetable@localhost:5432/omegax_sage_l5 npx prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://jetable:jetable@localhost:5432/omegax_sage_l5_ombre --exit-code
```

## Pour CLAUDE.md

(à écrire à la fin de la ligne)

## Pour build-log.md

(à écrire à la fin de la ligne)

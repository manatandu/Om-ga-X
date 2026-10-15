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
  - Étape 2, heures majorées · faite. Moteur `personnel/heures-majorees.ts`
    (heure supplémentaire entière et majorée, nuit, samedi, dimanche et
    férié au seul supplément), table `MajorationHeures` (migration
    `20270175000300_majorations_heures`), taux DÉCLARÉS par le cabinet avec
    leur source (aucun au corpus), désactivés jamais supprimés ; les heures
    du bulletin (`heuresMajorees` de la saisie) rejouées au serveur en
    prestation supplémentaire. Écran · section « Majorations des heures » de
    l'onglet Barèmes, bloc « Heures majorées du mois » de l'onglet
    Simulation. Parcours `e2e/tests/sage-l5-heures.e2e.ts`. Non repris ·
    compteurs libres d'heures effectuées et feuilles de temps de Sage
    (aucun texte ne les régit ; le contrôle des 45 heures par semaine
    suppose un relevé hebdomadaire que la paie mensuelle n'a pas).
  - Étape 3, arrêts et indemnités journalières de la Caisse · faite. Table
    `IndemniteCaisseAbsence` (migration
    `20270175000400_indemnites_caisse_absences`), une indemnité par arrêt et
    par mois, déclarée avec sa PIÈCE de la Caisse, annulée avec motif,
    jamais supprimée ; trois traitements, chacun son texte
    (`motifRefusIndemniteCaisse`) · DÉDUITE de l'indemnité de l'employeur
    (accident du travail, Code du travail art. 106, al. 2, bornée à la part
    de l'indemnité qui revient à SON arrêt), SUBROGATION pour la
    rémunération entière (art. 139, al. 2 et 146, al. 3 de l'arrêté
    n° 146/2018 · les jours se paient à plein, la somme est à recevoir de la
    Caisse), SUBROGATION PARTIELLE dans la limite des deux tiers versés
    (maternité, art. 139, al. 3). La maladie ordinaire n'ouvre aucune
    indemnité de la Caisse (arrêté art. 63 et 87, refus nommé). Informations
    d'un arrêt qui dure (art. 60, a · art. 106 et arrêté art. 87, 88, 166),
    jamais un refus. Écran · bouton « Indemnité de la Caisse » sur les
    arrêts qui en ouvrent une, indemnités sous la ligne avec leur
    annulation, déduction et somme à recevoir dites dans « Absences du
    mois ». Parcours `e2e/tests/sage-l5-arrets.e2e.ts`. Aucune écriture ·
    pas de scénario de clôture.

- **75 · banques du salarié et paiement des salaires** · fait.
  - Serveur · `Salarie.modePaiement` (virement, chèque, espèces, `null` =
    pas encore dit), `RibSalarie` (structure, administrateur seul, journal
    d'audit, numéros masqués), `PaiementSalaires` et `LignePaiementSalaire`
    (migration `20270175000500_paiement_salaires`), moteur pur
    `personnel/paiement-salaires.ts` (journal selon le mode, billetage par
    les plus grosses coupures d'abord, échéance de l'art. 99, reste à payer
    après un bulletin annulé déjà payé, numéros de chèque),
    `ribs-salaries.service.ts`, `paiement-salaires.service.ts`,
    `paiement-salaires.controller.ts`. L'ordre de virement passe par le
    module existant (`OrdresVirementService.preparerSalaries`, `creerDans`,
    `annulerDans` · une ligne d'ordre paie un tiers OU un salarié, contrainte
    de la base), et les ordres de salaires sont refusés à l'aide-comptable
    (liste, décomptes, détail, impression, annulation). Écriture D 422 / C
    trésorerie AGRÉGÉE au brouillard, retenue par le paiement
    (`detenteurs-ecriture.ts`), annulée avec motif (brouillard retiré,
    validée en négatif, ordre annulé avec elle).
  - Écran · section « Paiement du salaire » du registre
    (`components/paie/PaiementDuSalarie.tsx`), bloc « Paiement des salaires
    du mois » de l'onglet Bulletins (`components/paie/PaiementSalaires.tsx`),
    `useEnvoiPaie` et `BoutonsPaie` partagés (`ModalePaie.tsx`).
  - Parcours `e2e/tests/sage-l5-paiement.e2e.ts`, SUR VRAIE BASE À TRAVERS
    UNE CLÔTURE · décembre 2026 passé au journal, 2026 clôturé, le 422
    ouvert en 2027 au crédit des deux nets (2 × 649 300), payés le 5 janvier
    2027 par virement (ordre n° 1, KASONGO à son RIB) et en espèces
    (billetage), validés · 422 soldé, caisse à − 649 300 ; espèces annulées
    en négatif · 422 à − 649 300, caisse à zéro, bulletin de nouveau à
    payer ; virement annulé avec son ordre. SYCEBNL · paiement au brouillard
    annulé, pièce retirée, puis bulletin annulé et réémis plus haut qui ne
    paie que la différence.

- **88 · ventilation analytique de la paie** · fait.
  - Serveur · `RepartitionAnalytiquePaie` et `LigneRepartitionAnalytiquePaie`
    (migration `20270175000600_repartition_analytique_paie`, une version par
    salarié, plan et mois d'effet, retirée avec motif, index unique NULLS
    NOT DISTINCT), moteur pur `personnel/ventilation-analytique-paie.ts`
    (`motifRefusRepartition`, `versionDuMois`, `partsDesBulletins`,
    `ventilerLaPaie`), `repartitions-analytiques-paie.service.ts` et
    `.controller.ts` (mêmes droits que le registre). La passation du mois
    (`comptabilisation-paie.service.ts`) lit les versions en vigueur au MOIS
    DE PAIE et pose les ventilations sur les lignes de l'écriture ; un plan
    à ventilation obligatoire refuse d'avance, en nommant les salariés.
  - Écran · section « Répartition analytique » du registre
    (`components/paie/RepartitionAnalytique.tsx`, `lib/repartition-analytique.ts`),
    colonne « Analytique » de la paie du mois (`pages/PaieDuMois.tsx`).
  - Parcours `e2e/tests/sage-l5-ventilation.e2e.ts`, SUR VRAIE BASE À
    TRAVERS UNE CLÔTURE · décembre 2026 ventilé 30 / 70 (66110000 ·
    P1 468 000, P2 1 092 000), contrôle des cumuls à zéro, 2026 clôturé,
    janvier 2027 à 50 / 50 sous la nouvelle version, décembre inchangé ; le
    bulletin de décembre annulé et réémis repassé dans 2027 suit la version
    de DÉCEMBRE (P1 480 000, P2 320 000), sa reprise en négatif part sans
    ventilation, comptée exactement par le contrôle des cumuls.

- **85 · questionnaire société et salarié** · fait.
  - Serveur · lecture seule, `questionnaire-paie.service.ts` et
    `.controller.ts` (`GET /personnel/questionnaire-paie`, mêmes droits de
    lecture que le registre, le gestionnaire de paie compris) · paramètres
    du dossier tels quels, salarié et contrat qui couvre le mois, aucun repli.
  - Écran · assistant « Questionnaire de paie… » de l'onglet Simulation
    (`components/paie/QuestionnairePaie.tsx`, `lib/questionnaire-paie.ts`) ·
    dix questions, une par page, « pas encore dit » à chacune, propositions au
    seul clic (effectif du registre, effectif permanent, classe du contrat),
    récapitulatif qui dit où chaque réponse s'écrira, puis chaque écriture par
    SA route · `PATCH /dossier/regime` (administrateur), mode de paiement,
    monnaie du contrat (complétée une fois), champs de la simulation.
  - Parcours `e2e/tests/sage-l5-questionnaire.e2e.ts`. Aucune écriture
    comptable · pas de scénario de clôture.

## Relecture, premier tour (2026-10-14) · un BLOQUANT, cinq MAJEURS, sept MINEURS, corrigés

- **B1 · les jours de congé payés deux fois** (commit `408fc06`) · le
  bulletin d'août versait le salaire mensuel ET l'allocation de douze jours
  (1 520 000 pour un mois de 1 040 000). La proposition du mois
  (« Absences et congés du mois ») retranche les jours de congé du mois
  (`congesDuMois`, congé à cheval compris, quel que soit le bulletin qui
  porte l'allocation), et l'émission du bulletin comme du décompte final
  refuse un salaire au-delà des jours hors congé
  (`motifRefusSalairePleinPendantLeConge`). Le parcours verse 1 040 000.
- **M1 · les six mois de l'arrêt** (commit `bfc8954`) · courent du premier
  jour de la SUSPENSION (`debutsDesSuspensions`), fiches contiguës de même
  nature comprises ; l'information de l'art. 60, a) s'allume.
- **M2 · un congé sur une absence** (commit `ab41348`) · refusé, sauf la
  maladie (art. 141, al. 4), jumeau du refus des absences.
- **M3 · la reprise en négatif sous un plan obligatoire** (commit
  `b51d2b5`) · elle se ventile comme la pièce d'origine · recopiée (EXACTE),
  ou, rejouée, par les répartitions des bulletins de la pièce refaites au
  centime ; pièce non ventilée ou qui ne se refait pas · cause nommée et
  issue qui lève le refus (`issueDeLaCause`), servie à l'écran.
- **M4 · un salaire payé hors du module** · la proposition confronte au
  solde créditeur du 422 ce qu'elle offre sur des bulletins passés au
  journal, et avertit (`confrontation422`).
- **M5 · un bulletin payé puis annulé** · nommé à la proposition
  (`versementsSansBulletin`) et sur le bulletin relu (« payé, pièce … »),
  avec ses deux issues (réémettre, annuler le paiement).
- **Mineurs** · (1) mois entier d'absence sur ses jours payables, jamais
  au-delà des deux tiers (`baseDuMois`) ; (2) subrogation partielle bornée à
  la partie versée (art. 139, al. 3) ; (3) index unique (arrêt, mois,
  annulation) NULLS NOT DISTINCT, migration `20270175000700` ; (4) nature de
  l'absence, montant et pièce de l'indemnité de la Caisse masqués au journal
  d'audit (commit `677dd27` pour 1 à 4) ; (5) un congé posé avant un congé
  déjà posé se juge sur sa marge ; (6) les versements du mois se somment en
  base (`groupBy`), sans borne muette ; (7) compteur au jour de Kinshasa, et
  ordre de virement en francs refusé vers un RIB de salarié en devise.

## Relecture, second tour (2026-10-15) · un BLOQUANT et quatre points, corrigés

- **B1 · le congé posé après le bulletin émis d'un mois qu'il touche**
  (commit `e6502fe`) · la garde du premier tour ne jugeait que le bulletin
  qu'on émettait · septembre émis à 1 040 000, puis un congé de septembre
  posé avec son allocation au bulletin d'octobre, payait ces jours deux
  fois en silence ; et, dans l'autre sens, un congé annulé après qu'un
  bulletin a retranché ses jours laissait ce mois amputé. Une règle, trois
  portes (`salaire-pendant-le-conge.ts`) · à la POSE du congé, chaque
  bulletin déjà émis d'un mois qu'il touche est relu sur sa saisie FIGÉE et
  son contrat (`confronterLesBulletinsEmis`), refus nommé avec l'issue
  (annuler le bulletin n° X, poser le congé, réémettre) ; au REPORT de
  l'allocation sur un bulletin (`allocationsAPorter`), les autres mois du
  congé, de même ; à l'ANNULATION du congé, refus tant qu'un bulletin émis
  d'un mois touché a retranché ses jours (`bulletinsQuiRetranchentLeConge`,
  salaire au plus le plafond calculé avec eux), issue nommée (annuler le
  bulletin, puis le congé, réémettre). Gelé par
  `salaire-pendant-le-conge.spec.ts` (doublure qui honore la requête) et
  par le parcours `sage-l5-conges` (refus à l'écran dans la modale, issue
  suivie, sens inverse refusé puis levé).
- **Point 1 · la référence** · la plus grande du salaire mensuel du contrat
  et de la rémunération journalière déclarée au congé × 26 (art. 142,
  « la rémunération dont il jouit au moment du départ ») ; quand c'est le
  contrat, le refus nomme l'issue « saisissez d'abord le contrat en
  vigueur ».
- **Point 2 · la garde muette se dit** · hors salaire au mois, sans
  rémunération ou sans monnaie au contrat, ou dans une autre monnaie que le
  bulletin, rien ne se compare · l'émission (bulletin, décompte final hors
  du document remis), la pose et l'annulation du congé le DISENT
  (`raisonDeLaGardeMuette`, `avertissementGardeMuette`), servis à l'écran
  (Personnel, onglet Congés).
- **Point 3 · même base des deux côtés** · la garde prend la base de la
  proposition (`baseDuMois` · absences et congés qui couvrent tous les jours
  ouvrables du mois, base de ses jours payables) · décembre 2026 entier en
  congé, la proposition de 1 040 000 ÷ 27 passe, un centime de plus non.
- **Point 5 · le 422 de la passation** (commits `3fb9f53`, `afd49d4`) · lu
  depuis l'exercice de l'écriture de paie, puis chaque exercice suivant
  sans sa position d'ouverture (`filtreOuverturePasseeAuPremierJour`) ·
  plus de faux « payé hors de ce module » chaque janvier, et le paiement
  saisi dans N+1 est vu. Gelé par le test du service et par le parcours
  `sage-l5-paiement` à travers la clôture 2026 / 2027.

## Reste

- Rien des cinq fonctions. Les questions Q1 à Q3 restent à Manasse.
- AU SUIVI (second tour, non bloquants) · (4) le congé À CHEVAL qui porte
  des jours de voyage · aucune date ne dit le mois de ces jours (art. 141,
  al. 3), la proposition s'abstient et la garde n'oppose que le certain ;
  la règle de placement reste à trancher. (6) La reconstitution d'une
  reprise rejouée (M3) par les répartitions des salariés de la pièce
  d'origine · elle refuse quand la pièce ne se refait pas au centime ; ses
  cas limites (répartition déclarée après coup, salarié sorti du plan)
  restent à relire.

## Bloc du § 3, passé au 2026-10-15 (après le commit `4f85ef0`, relecture du premier tour)

- Serveur · `npx tsc --noEmit` sans erreur ; `npx jest` en six tranches
  (`--maxWorkers=1 --workerIdleMemoryLimit=800MB`) · 858 suites, 12 516
  tests, tous verts (143/1 731, 143/2 013, 143/1 958, 143/2 547, 143/1 909,
  143/2 358) ; `npm run build` sans erreur ; dérive des migrations nulle
  (`prisma migrate diff --exit-code`, migration `20270175000700` comprise).
- Client · `npx tsc --noEmit` sans erreur ; `npm test` · 259 fichiers,
  2 040 tests, tous verts ; `npm run build` sans erreur.
- Navigateur (Chromium, montage local, base jetable) · les huit parcours
  `sage-l5-*` verts (congés, absences, arrêts et ventilation rejoués après la
  relecture), plus `ecrans`, `parcours` et `cloture`.
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
- **D8-e · heures majorées** · aucun taux au corpus (les arrêtés des
  art. 120, e) et 124 n'y sont pas) · le taux se déclare avec sa source ;
  l'heure supplémentaire se paie entière et majorée (art. 93 et 119), l'heure
  de nuit, du samedi, du dimanche ou d'un férié faite dans l'horaire normal
  au seul supplément (le salaire la paie déjà ; art. 124, « sans préjudice »
  des heures supplémentaires) ; le taux horaire se déclare (45 heures par
  semaine et 8 par jour donnent deux conversions, et le décret n° 25/22 n'en
  écrit aucune) ; aucun plafond d'heures (art. 120, b), arrêté absent).
- **D8-f · l'indemnité de la Caisse sur un arrêt** · l'employeur doit les
  deux tiers (Code, art. 105, 106, 130) et la Caisse sert ses indemnités
  journalières (arrêté n° 146/2018, art. 62, 63, 87) · elles ne se confondent
  que par un texte · la DÉDUCTION de l'art. 106, al. 2 (accident du travail
  seul, « l'employeur peut déduire »), la SUBROGATION de l'employeur qui paie
  toute la rémunération (arrêté art. 139, al. 2 ; art. 146, al. 3) et celle,
  partielle, de l'employeur qui verse une partie (art. 139, al. 3, maternité).
  Rien n'est présumé · chaque indemnité se DÉCLARE avec sa pièce, au mois de
  son versement ; sans déclaration, les deux tiers du Code restent proposés.
- **D75-a · le mode de paiement se convient et se déclare** · art. 98, al. 2
  (« au temps et au lieu convenus ») · par salarié, sans défaut, « pas
  encore dit » tant qu'il ne l'est pas, et alors le salarié n'entre dans
  aucun paiement. Virement et chèque paient « en espèces » au sens de
  l'art. 98, al. 1, qui oppose la monnaie à la NATURE (même opposition à
  l'art. 105) · lecture d'OmegaX, dite dans le schéma et la bulle.
- **D75-b · l'écriture** · fiche du compte 42 des deux plans (AUDCIF,
  Titre VII ; SYCEBNL, Partie 2 ch. 3) · « Débité […] des rémunérations
  versées au personnel, par le crédit des comptes de trésorerie », le 422
  lu par `compteDuRole('REMUNERATIONS_DUES')`. La trésorerie suit le mode ·
  une caisse (fiche du compte 57, « paiement effectué en espèces ») pour
  les espèces, un autre compte de trésorerie pour le virement et le chèque.
  Une banque en devise est refusée (les nets figés sont en francs, F49).
  L'écriture est AGRÉGÉE (un D 422, un C trésorerie) · le journal se lit par
  l'aide-comptable, à qui le personnel est fermé ; le détail est sur la
  fiche et sur l'ordre, qu'il ne lit pas.
- **D75-c · le chèque porte son numéro** (AUDCIF art. 17, 3° et 5°, que
  l'art. 3 du SYCEBNL n'écarte pas) · un par salarié, jamais deux fois le
  même.
- **D75-d · un salaire ne se paie pas deux fois** · un bulletin payé ne se
  repaie pas (index unique sur les lignes non annulées) ; un bulletin annulé
  déjà payé et réémis ne paie que la différence, un trop-perçu se dit sans
  se compenser (fiche du compte 42, aucune compensation entre ce qui est dû
  au personnel et ce qu'il doit).
- **D75-e · l'échéance** · art. 99, al. 2, « dans les six jours suivant la
  période » · six jours de CALENDRIER (l'art. 100, au même chapitre, dit
  « jours ouvrables » quand il les veut), affichée, jamais un refus ; les
  deux jours ouvrables de l'art. 100 pour le décompte final sont dits dans
  la bulle, non calculés.
- **D75-f · le billetage** · aucun texte ne l'exige, ajout de l'éditeur
  comme la ventilation par coupure du procès-verbal de caisse · coupures
  DÉCLARÉES (aucune liste de billets au corpus), proposées depuis le dernier
  paiement en espèces, plus grosses d'abord, reste dit, figé avec le
  paiement.
- **D88-a · aucun texte ne régit la répartition** · la comptabilité
  analytique est de libre usage (classes 92 à 99 des deux plans, « libre
  usage »). Répartition par salarié, pourcentages à deux décimales qui font
  exactement 100, version par mois de paie, arrondi au plus fort reste ·
  conventions d'OmegaX, dites dans la bulle. Ce qui ne se discute pas vient
  des règles existantes · sections Détail actives du plan, plan qui ventile
  la classe (`motifRefusClasseVentilee`, la classe 6 exigée à la
  déclaration), une ligne ventilée en totalité sur un plan ou pas du tout.
- **D88-b · le mois de paie décide de la version**, jamais la date de la
  passation · un bulletin de décembre repassé en janvier suit la
  répartition de décembre.
- **D88-c · rien n'est réparti au prorata des autres** · un salarié sans
  répartition, une répartition vide, une section passée en sommeil, une
  ligne qui mêle une reprise en négatif · la ligne part sans ventilation sur
  ce plan, nommée avec sa cause (audit final F141 · porter sur une section
  une dépense qu'elle n'a pas). La reprise en négatif se ventile à la main
  (Ventilation d'une ligne), sur la pièce d'origine.
- **D85-a · le questionnaire n'écrit que des champs qui existent**, sans
  règle ni valeur par défaut (consigne de la ligne) · paramètres du dossier,
  fiche du salarié, contrat, champs de la simulation du mois. Une question
  sans réponse reste « pas encore dit » ; une proposition ne s'écrit qu'au
  clic (« l'effectif est proposé, jamais substitué »).
- **D85-b · une valeur enregistrée ne s'efface pas par le questionnaire** ·
  l'effectif permanent n'admet pas `null` (zéro est une réponse), la monnaie
  du contrat se complète une fois et ne se change plus (audit final F226) ;
  laissée sans réponse, la valeur est GARDÉE et le récapitulatif le dit. Les
  champs de la simulation, saisie du mois, se vident.
- **D8-d · mise à pied** · « jusqu'à concurrence de deux fois quinze jours
  par an » (art. 57, 5°) lu comme deux mesures d'au plus quinze jours de
  calendrier par année civile ; au-delà, refus nommé.

- **R1 · l'allocation remplace le salaire des jours de congé** (B1 de la
  relecture) · Code du travail, art. 142 (« une allocation égale à la
  rémunération dont il jouit au moment du départ en congé »), art. 93 ;
  livre de paie, arrêté du 8 août 2008, mentions 6 (jours payés à 100 %),
  14 (jours de congés payés), 17 (jours aux deux tiers), 28 (= 6 + 14 + 17) ·
  un jour ne figure qu'une fois. Jours comptés comme l'allocation les compte
  (ouvrables du Code, maladie retranchée, art. 141, al. 4) ; les jours de
  voyage (al. 3) restent au salaire, lecture protectrice ; un congé à cheval
  qui porte des jours de voyage ne se propose pas (leur mois n'est écrit
  nulle part), l'émission n'opposant que le certain.
- **R2 · la suspension continue** (M1) · art. 106 (« six premiers mois de
  la suspension du contrat »), art. 60, a) (« six mois ininterrompus ») ·
  deux fiches de même nature font une suspension quand aucun jour ouvrable
  du Code ne les sépare et qu'aucune demi-journée ne marque la jointure ·
  lecture d'OmegaX, dite (le Code ne définit pas la contiguïté de deux
  certificats).
- **R3 · le mois entier d'absence** (mineur 1) · forfait de vingt-six jours
  (décret n° 25/22, art. 7, par analogie) remplacé, quand l'absence couvre
  tous les jours ouvrables du mois, par les jours payables du mois (lundi au
  samedi, fériés compris, art. 93) · un février d'incapacité rend les deux
  tiers, pas plus.
- **R4 · la subrogation partielle** (mineur 2) · arrêté n° 146/2018,
  art. 139, al. 3, « à la limite de la partie versée » · la part des deux
  tiers du mois qui revient à l'arrêt ; le surplus est dit au travailleur.
- **R5 · la reprise en négatif se ventile comme ce qu'elle annule** (M3) ·
  AUDCIF art. 20, al. 2 · jamais au prorata d'une ligne d'origine qui porte
  d'autres salariés.
- **R6 · un jour se paie une fois, quel que soit l'ordre de saisie** (B1,
  second tour) · Code du travail, art. 142 ; arrêté du 8 août 2008,
  mentions 6, 14 et 28 · la garde juge aussi les bulletins DÉJÀ émis des
  mois que touche le congé, sur leur saisie figée, à la pose et au report
  de l'allocation ; un bulletin a « retranché » un congé quand son salaire
  ne dépasse pas le plafond calculé avec ses jours, et le congé ne s'annule
  pas tant qu'il tient (sans quoi ces jours n'auraient ni salaire ni
  allocation). Un bulletin émis au salaire plein d'avant la règle n'a rien
  retranché · l'annulation passe.
- **R7 · la référence du salaire** (point 1) · art. 142, « la rémunération
  dont il jouit au moment du départ en congé » · la plus grande du contrat
  et de la rémunération journalière déclarée au congé × 26 (décret
  n° 25/22, art. 7, par analogie), dans la monnaie du bulletin.
- **R8 · le 422 se lit tel que les livres le portent** (point 5) · fiche du
  compte 42 des deux plans · depuis l'exercice de la passation, les
  exercices suivants sans leur position d'ouverture, qui ne fait que
  reporter (AUDCIF art. 34 ; SYCEBNL art. 16, 4)).

## Questions pour Manasse

- **Q3 · la nature de l'employeur pour l'INPP, le régime de la retenue, la
  classe et les personnes à charge se ressaisissent chaque mois** · ce sont
  des champs de la simulation (le bulletin émis les fige), et la consigne de
  la fonction 85 interdisait d'en créer · le questionnaire les remplit pour
  la simulation en cours. Aucun texte ne règle où les tenir · faut-il les
  garder au dossier (nature INPP) et au salarié (régime, personnes à charge)
  pour qu'ils se proposent d'un mois à l'autre ? Choix d'organisation, à
  Manasse.

- **Q2 · la maternité, deux textes** · le Code (art. 130, art. 59) fait
  devoir à l'employeur les deux tiers de la rémunération pendant quatorze
  semaines ; l'arrêté n° 146/2018 (art. 63) fait payer par la Caisse une
  indemnité journalière égale à l'intégralité de la rémunération journalière
  moyenne des trois derniers mois, et subroge l'employeur qui paie toute la
  rémunération (art. 139, al. 2) ou, à la limite de la partie versée,
  celui qui en paie une partie (al. 3). Ces deux cas sont servis (D8-f).
  Reste NON TRANCHÉ · la Caisse paie la salariée directement, sans
  subrogation · l'employeur doit-il encore les deux tiers du Code, en plus
  de l'indemnité intégrale de la Caisse ? Aucun texte lu ne dit le cumul ni
  l'imputation (l'art. 106, al. 2, qui permet de déduire, ne vise que
  l'accident du travail). OmegaX propose les deux tiers et ne déduit rien.
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
npx jest --maxWorkers=1 src/modules/personnel/absences.spec.ts src/modules/personnel/heures-majorees.spec.ts
npx jest --maxWorkers=1 src/modules/personnel/paiement-salaires.spec.ts src/modules/reglements/ordres-virement-paie.spec.ts
npx jest --maxWorkers=1 src/modules/personnel/ventilation-analytique-paie.spec.ts src/modules/personnel/comptabilisation-paie.service.spec.ts
npx jest --maxWorkers=1 src/modules/personnel/questionnaire-paie.spec.ts src/modules/analytique/suppression-et-exercice-clos.spec.ts
npx jest --maxWorkers=1 src/modules/personnel/conge-et-salaire.spec.ts src/modules/personnel/conges-service.spec.ts \
  src/modules/personnel/absences-service.spec.ts src/modules/personnel/paiement-salaires-service.spec.ts src/common/audit/liste-exclusion-fermee.spec.ts \
  src/modules/personnel/salaire-pendant-le-conge.spec.ts
(cd client && npx vitest run src/lib/conges-paie.spec.ts src/lib/absences-paie.spec.ts src/lib/heures-majorees.spec.ts src/lib/paiement-salaires.spec.ts src/lib/repartition-analytique.spec.ts src/lib/questionnaire-paie.spec.ts)
# montage local (CLAUDE.md § 10), ports 8085 et 4185, puis
(cd e2e && OMEGAX_APP=http://localhost:4185 OMEGAX_API=http://localhost:4185/api \
  PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/sage-l5-conges.e2e.ts tests/sage-l5-absences.e2e.ts tests/sage-l5-heures.e2e.ts \
  tests/sage-l5-arrets.e2e.ts tests/sage-l5-paiement.e2e.ts tests/sage-l5-ventilation.e2e.ts tests/sage-l5-questionnaire.e2e.ts)
DATABASE_URL=postgresql://jetable:jetable@localhost:5432/omegax_sage_l5 npx prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://jetable:jetable@localhost:5432/omegax_sage_l5_ombre --exit-code
```

## Pour CLAUDE.md

À insérer au § 6, après **P9 · PAIE DU MOIS AU JOURNAL** (ligne sage-l5,
fonctions de Sage cochées le 2026-10-14) ·

**Ligne sage-l5 · la paie de Sage (2026-10-14).** CONGÉS ACQUIS (fonction 79,
`conges-acquis.ts`) · compteur par période annuelle de DATE À DATE, mois de
service acquis sur bulletin émis, droits nés à l'expiration de l'année
(art. 140, al. 3), tranche d'ancienneté et allocation de l'art. 142 par le
moteur du décompte final (`allocationDeConge`), reprise DÉCLARÉE avec sa
source, congé au-delà du solde dit, jamais refusé ; l'allocation REMPLACE
le salaire des jours de congé (art. 142 ; livre de paie, mentions 6, 14 et
28), l'émission refusant le salaire plein, dans les DEUX ordres de saisie ·
le congé posé ou porté après le bulletin émis d'un mois qu'il touche relit
ce bulletin sur sa saisie figée, et un congé dont un bulletin émis a
retranché les jours ne s'annule pas seul (`salaire-pendant-le-conge.ts`) ;
référence au plus grand du contrat et du taux déclaré au congé × 26, même
base que la proposition, garde muette DITE ; un congé ne se pose pas sur une
absence, sauf la maladie (art. 141, al. 4). ABSENCES (fonction 78,
`absences.ts`) · treize causes du Code, chacune son régime (deux tiers des
art. 105, 106, 130 ; circonstance art. 146 ; art. 93 ; art. 59), proposées au
bulletin, jamais substituées ; heures majorées à taux DÉCLARÉ avec sa source
(aucun au corpus) ; indemnité de la Caisse sur un arrêt DÉCLARÉE avec sa
pièce · déduite (accident du travail, art. 106, al. 2) ou subrogée (arrêté
n° 146/2018, art. 139, al. 2 et 3), la maladie ordinaire n'en ouvre aucune.
PAIEMENT DES SALAIRES (fonction 75) · mode CONVENU (art. 98, al. 2), RIB du
salarié = structure (administrateur, journal d'audit, numéros masqués) ;
écriture AGRÉGÉE D 422 / C trésorerie au brouillard (fiche du compte 42),
ordre de virement par le module existant (une ligne paie un tiers OU un
salarié, contrainte de la base ; ordres de salaires refusés à
l'aide-comptable), billetage déclaré, un bulletin payé une fois (NULLS NOT
DISTINCT), annulation motivée en négatif ; le 422 confronté à ce qui se
propose, lu depuis l'exercice de la passation, les suivants sans leur
ouverture. VENTILATION ANALYTIQUE (fonction 88,
`ventilation-analytique-paie.ts`) · répartition par salarié et par plan,
versions par MOIS DE PAIE, pourcentages qui font 100, sections Détail
actives d'un plan qui ventile la classe 6 ; la passation pose la part de
chaque bulletin au centime (plus fort reste) ; rien n'est réparti au prorata
des autres, la ligne part non ventilée et la cause est dite, avec son
issue ; la reprise en négatif se ventile comme la pièce d'origine (recopiée,
ou refaite par les répartitions au centime, jamais au prorata). QUESTIONNAIRE (fonction 85) · lit, puis écrit
les seuls champs qui existent par leurs routes, « pas encore dit » à chaque
question, une valeur enregistrée jamais effacée.

## Pour build-log.md

- 2026-10-14 · ligne sage-l5 « paie » · fonctions 79 (congés acquis), 78
  (absences, heures majorées, arrêts et indemnités de la Caisse), 75
  (banques du salarié, paiement des salaires), 88 (ventilation analytique de
  la paie), 85 (questionnaire société et salarié) · migrations
  `20270175000100` à `20270175000700`, parcours navigateur
  `e2e/tests/sage-l5-*.e2e.ts`, scénarios sur vraie base à travers la
  clôture 2026 / 2027 pour 75 et 88.

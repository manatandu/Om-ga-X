# Ligne sage-l3 · banque et trésorerie

Copie `/home/user/wt-sage-l3`, branche de sauvegarde `travail/sage-l3`.
Migrations `20270190000100_…` et suivantes, bases jetables `l3_ombre`
(ombre), `l3_e2e` (tests navigateur), `l3_scenario` (scénario sur vraie
base) ; serveur 8303, client 4303, tests navigateur `e2e/tests/sage-l3-*.e2e.ts`.

Fonctions (numéros de `docs/comparaison-sage/15-absents-a-trier.md`), dans
l'ordre · #37 virement depuis un compte en devise, #40 remises de chèques et
de cartes, #39 effets de commerce (circuit comptable seul, décision D11),
#45 édition chaînée des extraits, #46 conditions bancaires par RIB,
autorisations de financement, unions de comptes, #47 taux de référence,
financements, placements.

## Fait

- #37 · serveur (15ff6c1) · `deviseDuDonneur`, `motifRefusLignesHorsDeviseDonneur`
  (`tiers/ribs-tiers.ts`), `donneurDuJournal` rend la devise du RIB,
  `refuserLignesHorsDevise` avant la première pièce, `OrdreVirement.devise`,
  `totalDevise`, `LigneOrdreVirement.montantDevise` (migration
  `20270190000100_ordre_de_virement_en_devise`), la devise de chaque ligne posée
  aux trois points de `reglements.service.ts`, avis de règlement en devise avec
  sa contrevaleur ; les salaires restent en francs.
- #37 · écran de l'ordre (liste en devise, colonnes « Montant USD » et
  « Contrevaleur CDF », mention imprimée), test navigateur
  `e2e/tests/sage-l3-virement-devise.e2e.ts` PASSÉ sur vraie base le
  2026-10-22 (Postgres jetable 55803, serveur 8303, client 4303) · refus sans
  devise au RIB, ordre de 1 000 USD pour 1 680 000 CDF, refus d'une facture en
  francs sur un RIB en USD, clôture de N, second ordre de N+1 numéroté à la
  suite, avis « 500,00 USD (contrevaleur comptable 840 000,00 CDF) ».
- #37 · docs · `features.csv` (37 en yes), tables 05 (M5-42) et 13 (M13-72),
  `build-log.md`, `test-plan.md` (F37-H1, N1, N2, N3), CLAUDE.md § 6 règle (3)
  des ordres de virement réécrite.
- Bloc § 3 du 2026-10-22 · serveur tsc, Jest 950 suites et 13 829 tests, build ;
  client tsc, 2 408 tests, build.
- #37 · premier tour de relecture (silent-failure-hunter, typescript-reviewer,
  react-reviewer) · aucun BLOQUANT ni MAJEUR, sept MINEURS corrigés · l'avis
  d'un ordre en devise refuse une ligne sans montant en devise au lieu
  d'imprimer la contrevaleur ; l'avis servi porte `montantDevise` et la devise
  de l'ordre, la carte de l'écran les affiche avec l'unité ; le libellé du
  refus sans devise au RIB couvre « CDF » écrit en toutes lettres ; la devise
  d'une ligne se lit comme celle du RIB (majuscules, franc = aucune) ; le
  refus de garde de `creerDans` nomme le bénéficiaire ; `totalDevise` somme
  les lignes ARRONDIES (deux demi-centimes, cas gelé) ; la liste montre
  « · USD » quand le total en devise manque, jamais la contrevaleur sans
  unité. Non repris · la ligne de la liste ouverte à la souris seule
  (préexistant, relevé en attente), le RIB lu deux fois (refus nommé dans les
  deux sens, pas une faute).
- #37 · second tour de relecture (mêmes trois agents) · aucun BLOQUANT, un
  MAJEUR et quatre MINEURS corrigés · `creerDans` lisait la devise deux fois
  (porte puis garde) et pouvait admettre une ligne sans montant en devise ·
  une seule lecture (`deviseDuDonneur`), chaque ligne d'un ordre en devise
  doit porter un montant en devise fini, sinon refus nommé avant toute
  pièce ; le total en francs est la somme des lignes ARRONDIES comme
  `totalDevise` ; l'avis d'un ordre en devise lève un 409 nommé sur une
  ligne sans montant en devise (jamais une contrevaleur muette) ; le code
  d'une devise est trois LETTRES à la porte (`CreerDeviseDto`, `@Matches`,
  « US » suivi d'un blanc passait la longueur) et le service le range
  débarrassé des blancs ; spec `code-devise-dto.spec.ts`. Rejoué · tsc,
  specs des règlements, des RIB et des devises (507 tests), test navigateur
  sur vraie base.

- #40 · serveur · module `src/modules/remises/` · `remise-en-banque.ts`
  (règles pures · comptes du 51 par nature, 513 chèques, 514 transit,
  515 cartes jusqu'à l'avis de crédit, commission 6315, impayé au 413 de la
  fiche du 41 par référentiel, modèle de bordereau à jetons, lignes des
  quatre écritures, refus nommés), `remises.service.ts` (types, réception
  lettrée avec les lignes ouvertes du tiers, bordereau numéroté sous verrou,
  impression comptée, avis de crédit D 52 / D 6315 / C 514 ou 515 dans
  l'exercice de SA date, impayé D 413 / C 514, 515 ou 52, annulations au
  brouillard supprimées et validées en négatif, écritures retenues),
  contrôleur, DTO, module ; schéma `TypeRemise`, `ValeurRecue`,
  `RemiseEnBanque` (migration `20270190000200_remises_en_banque`, dérive
  nulle contre `l3_ombre`) ; listes de structure (modèles audités et
  cloisonnés, huit colonnes qui retiennent, libellés d'audit, bornes de la
  restitution, lectures hors situation, fonctions métier, listes de
  comptes). Specs `remise-en-banque.spec.ts`, `remises.service.spec.ts`
  (le total du bordereau est la somme des lignes ARRONDIES, comme
  l'écriture · 20,01 contre 20,02 trouvé par le spec).
- #40 · écran `client/src/pages/RemisesPage.tsx` (Traitement > Tiers et
  trésorerie > Remises en banque · valeurs reçues, bordereaux, et
  Structure > Paramètres de saisie > Types de remise), `AppShell.tsx`,
  `registre-fenetres.tsx`, décomptes de `chrome-etroit.spec.ts` (20 et 23).
- #40 · test navigateur `e2e/tests/sage-l3-remises.e2e.ts` PASSÉ sur vraie
  base le 2026-10-22 · type CHQ, refus d'un transit sur les cartes, deux
  chèques reçus (l'un lettré avec sa facture), 513 à 1 660 000, bordereau
  n° 1 imprimé, avis avec commission de 5 000 (514 soldé, 6315 à 5 000, 52
  à 1 655 000), annulation du bordereau refusée après l'avis, chèque de
  décembre remis en N et crédité en JANVIER de N+1 à travers la clôture
  (514 reporté 300 000 puis soldé), impayé au 41310000 et son annulation.
  Trouvé sur vraie base · les champs `unknown` des DTO tombaient sous le
  pipe global (« property montant should not exist ») · `@Allow()`.

## Reste

- #37 · parité recomptée à l'intégration (les deux tours de relecture sont
  faits).
- #40 · deux tours de relecture, docs (`features.csv` 40, tables 05 et 13,
  `build-log.md`, `test-plan.md`, `architecture.md` D12), CLAUDE.md § 6.
- #39 · module `effets/` (portefeuille, remise à l'encaissement ou à
  l'escompte, échéance, impayé, bon à payer) · lire la fiche du 67 (675) et
  le décret n° 011/42, art. 57 al. 2, avant de coder.
- #45 · liste et édition chaînée des extraits (`rapprochement/`).
- #46 · conditions bancaires par RIB, autorisations de financement, unions
  de comptes (`banques/`).
- #47 · taux de référence, financements, placements (`tresorerie/`) ; les
  OPCVM se tranchent par la loi avant de coder.
- Docs · `features.csv` (colonne clone des lignes 37, 39, 40, 45, 46, 47),
  `build-log.md`, `test-plan.md`, `parity.md`, tables 05, 13, 14, 06 de la
  comparaison ; paragraphe de la ligne au § 6 de CLAUDE.md.
- Bloc du § 3 complet des deux côtés, tests navigateur, deux tours de
  relecture, intégration sur `main`, déploiement relu, fiche retirée.

## Décisions par la loi

- **D1 (architecture.md) · le virement part d'un compte en devise.** Loi
  n° 23/053, art. 141, 1° · « Cette comptabilité est exprimée en Franc
  congolais » · le texte vise la comptabilité, pas la monnaie du compte
  bancaire. Les pièces de règlement restent en francs ; l'ordre porte, en
  plus, le montant en devise de chaque ligne (F49, `ligne-en-devise.ts`),
  et ce montant est celui que la banque exécute. Une ligne réglée en francs
  ou dans une autre devise que celle du RIB est refusée avant la première
  pièce, en nommant la ligne et l'issue (régler dans la devise du RIB, ou
  choisir un journal dont le RIB est tenu dans la monnaie du règlement).
- **D12 (architecture.md) · remises de chèques et de cartes par le 51,
  impayé au 413.** Fiche du compte 51 des deux plans (AUDCIF Titre VII ;
  SYCEBNL Partie 2 ch. 3) · 513 « chèques à encaisser » reçus non remis,
  514 « chèques à l'encaissement » remis non crédités, 515 cartes
  « jusqu'à l'avis de crédit », « débité lors de la réception, par le crédit
  des comptes de tiers concernés », « crédité pour solde, par le débit des
  comptes de trésorerie concernés » ; « en cours d'exercice, les entités ne
  sont pas tenues d'utiliser le compte 51 », obligatoire à la clôture · le
  module le tient toujours, jamais un repli. Les cartes n'ont aucun transit
  (515 jusqu'à l'avis), un type de carte à compte de transit est refusé.
  Commission « en services bancaires » · fiche du 63, 6315 « commissions sur
  cartes de crédit », 63150000 semé aux deux. Impayé · fiche du 41 des deux
  plans, « les chèques, effets à payer et autres valeurs revenus impayés
  doivent être enregistrés au compte 413 » · un numéro, deux sens · au
  SYSCOHADA par NATURE (4131 chèques, 4133 cartes), au SYCEBNL par DÉBITEUR
  et nature (4131 adhérents chèques, 4132 clients-usagers chèques, 4133
  adhérents autres valeurs, 4138 clients-usagers autres valeurs), racine
  déduite du compte du tiers (`racineImpaye`), tout autre compte refusé.
- **D11 (architecture.md)** · LCR, BOR, CFONB, ETEBAC, SEPA non reproduits.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
# test navigateur sur vraie base · script du bac à sable l3-e2e.sh (Postgres 55803, serveur 8303, client 4303)
cd e2e && npx tsc --noEmit -p . && npx playwright test tests/sage-l3-virement-devise.e2e.ts tests/sage-l3-remises.e2e.ts
```

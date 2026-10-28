# AVANCEMENT · ligne microfina-m1 (circuit d'approbation et concordance)

Branche de sauvegarde `travail/microfina-m1`, partie de `origin/main` au
commit `1274d93`. Plan · `docs/comparaison-microfina/plan-reproduction-microfina.md`,
idées 1 et 12 du tableau de `audit-manuel-microfina-306-pages.md` (partie A,
idées 1 et 5 du § 4).

## Fait

1. Idée 1 · circuit de visa. Schéma (`Tenant.circuitVisa`, `Ecriture.contenuPar`,
   `contenuLe`, `viseePar`, `viseeLe`, `viseeEmpreinte`, `Facture.saisiePar`,
   `viseePar`, `viseeLe`), migration `20270191100100_circuit_visa` (dérive
   vérifiée, aucune différence). Règles pures `comptabilite/circuit-visa.ts`,
   lecture `circuit-visa-lecture.ts`, service et contrôleur `circuit-visa.*`
   (`POST /circuit-visa/ecritures`, `POST /circuit-visa/ecritures/retrait`,
   `POST /circuit-visa/factures/:id`, `GET /circuit-visa/ecritures/:id/fiche`),
   option `PATCH /dossier/circuit-visa` (administrateur). L'auteur du DERNIER
   contenu est posé par `modifier`, `reimputer` (brouillard),
   `transfererDansUnJournalOrdinaire`, `modifierPieceDuModule` et la
   déclaration d'un à-nouveau en devise complété en place ; la validation relit
   auteur et visa SOUS VERROU (`FOR UPDATE`) et écarte sans jeter
   (`partitionnerLaValidation`) ; le contrôle 26 lit l'auteur du dernier
   contenu ; la comptabilisation d'une facture non visée est refusée sous le
   circuit. Écrans · Brouillard (filtre par nature, Viser, Retirer le visa,
   état du visa, fiche), Journal (fiche d'imputation par la pièce),
   Facturation (Viser), Paramètres du dossier (option), fiche imprimable
   `components/FicheImputation.tsx`.
2. Idée 12 · concordance des modules (`src/modules/concordance/`,
   `GET /concordance?exerciceId`, lecture seule), écran
   `pages/ConcordancePage.tsx`, menu État > Contrôle et révision.

3. Scénario sur vraie base (2026-10-25) · serveur compilé, PostgreSQL 16
   jetable, dossier SYSCOHADA, un administrateur A et deux comptables B et C,
   double regard et circuit activés, à travers la clôture de 2026 et dans 2027.
   Trente-deux constats au vert, dont · B saisit, C réécrit puis ne vise ni
   ne valide (faille fermée) ; le visa retiré par la modification, une
   empreinte périmée refusée ; la réimputation par C fait de C l'auteur ; le
   retrait du visa par son seul auteur ; la facture non visée refusée à la
   comptabilisation, visée par C puis passée. Soldes lus contre le calcul à la
   main · banque 2026, 1 200 000 − 350 000 = 850 000 ; report 2027, 850 000 au
   521 et 850 000 au 131 ; banque 2027, 850 000 − 100 000 − 40 000 = 710 000 ;
   charge 100 000, charge réimputée 40 000, vente 0. Concordance · analytique en
   écart (lignes de classe ventilée sans répartition, comme le module le dit),
   stocks et paie non calculés, le reste sans objet ; exercice étranger 404.
   Journal du serveur sans erreur.

4. Bloc du § 3 (2026-10-25) · serveur `tsc` 0 erreur, `jest` 974 suites ·
   943 vertes au premier passage (13 644 tests), 2 tests rouges corrigés
   (`comptes-proposes.spec.ts` · fiche d'imputation rangée ;
   `fonctions-metier.spec.ts` · CircuitVisaController sous Validation) et 29
   suites tuées par le manque de mémoire de la machine (SIGTERM, SIGKILL),
   les 31 rejouées vertes (614 tests) ; `npm run build` vert. Client `tsc`
   0 erreur, `npm test` 307 fichiers, 2 487 tests verts, `npm run build` vert.

5. Relecture du circuit et de la concordance (2026-10-28), constats vérifiés
   dans le code puis corrigés, chacun avec son test ·
   - M1 · la réimputation relit le statut DANS sa transaction (lignes filtrées
     sur l'écriture non validée, nombre exigé, sinon 409 nommé ; tête de même).
   - M2 · ventiler ou effacer la ventilation d'une ligne au brouillard pose
     l'auteur du dernier contenu, sous `FOR UPDATE` de la tête
     (`poserAuteurDeLaVentilation`), l'utilisateur passé par le contrôleur.
   - M3 · la retouche d'une fiche d'immobilisation passe `userId` à
     `modifierPieceDuModule` ; tout appel de ce chemin nomme son auteur (spec
     de structure) ; la dérogation nominative (nom et motif du second regard)
     part enfin de l'écran Brouillard, offerte après un refus du double regard.
   - M4 · le registre des provisions nomme le solde de ses comptes (natures
     et court terme du module) qu'aucune ligne ne porte (`horsRegistre`), le
     module des créances douteuses celui des 416 et 491 qu'aucune créance ne
     porte (`solde416SansCreance`, `solde491SansCreance`) · la concordance les
     confronte à zéro, jamais « concorde » ni « sans objet ».
   - M5 · validation par tranches de 500 (`LOT_ECRITURES`), une transaction
     par tranche, têtes `FOR UPDATE` et exercices `FOR SHARE`, équilibre,
     exercice, auteur et visa relus dedans, contenu visé lu sous le circuit
     seul ; l'échec d'une tranche nomme ce que les précédentes ont validé
     (`echecDUneTranche`) ; la pièce retirée entre deux lectures est comptée à
     part (`retireesEntreTemps`), jamais « déjà validée ».
   - Mineurs · lot de visas et de retraits · tout refus HTTP et toute panne
     rangés dans `refusees` ; facture d'abonnement émise par le logiciel ·
     motif propre (`emiseParLeLogiciel`, lu sur `factureAbonnement`) ;
     concordance des banques bornée au dernier relevé daté au plus tard de la
     clôture, rapprochement en cours dit.

6. Rejeu sur vraie base de M1 et M5 (2026-10-28,
   `scripts/rejouer-circuit-visa.cjs`) · PostgreSQL 16 jetable, serveur
   compilé, dossier SYSCOHADA, A administrateur, B et C comptables, double
   regard et circuit actifs. Janvier 2026 · 1 200 pièces saisies par A, visées
   par B, validées par C en une validation par période (trois tranches, 0,5 s,
   1 200 en base) ; A, auteur, écarté par le double regard. Quatorze courses
   (huit en 2026, six en 2027 après la clôture) · C réimpute 60 lignes au
   brouillard pendant que B valide les mêmes pièces · onze refus en 409 nommé
   « validées pendant la réimputation » (la fenêtre de la course atteinte,
   que le code d'avant laissait déplacer en place), trois réimputations par
   inscription en négatif ; aucune ligne d'une pièce validée déplacée en
   place. Soldes · 6052 + 6053 = 1 445 000, 521 en 2026 = 48 555 000, report
   2027 48 555 000, mouvements 2027 − 240 000, fin 2027 48 315 000. Clôture de
   2026 passée. Journal du serveur sans erreur. La base est montée hors du
   scratchpad (`/var/tmp`) · les droits du scratchpad se refermaient sous
   PostgreSQL en cours de route.

## Reste

1. Relectures (silent-failure-hunter, typescript-reviewer, react-reviewer) ·
   aucun outil de lancement d'agent n'est servi à cette session · relecture
   faite à la main dans leur esprit (correction de la réimputation en une
   requête, commit 0c884fe), relecture par les agents à faire.

## Constat de l'audit de sécurité, vérifié dans le code (2026-10-25)

IL TIENT. `EcritureService.valider` compare `createdBy` seul au validateur
(`soumises.filter((e) => e.createdBy === valideeBy)`), et rien n'enregistre qui
réécrit un brouillard · `modifier` (PATCH /ecritures/:id) ne reçoit pas
l'utilisateur, `reimputer` déplace les lignes du brouillard par un
`updateMany` sans toucher la tête, `transfererDansUnJournalOrdinaire` non
plus. Le contrôle `VALIDATION_PAR_SON_AUTEUR` (controles.service.ts) lit le
même `createdBy`. Un comptable B qui réécrit le brouillard de A puis le valide
passe le double regard, et le contrôle ne le voit pas.

## Décisions par la loi

- D1 · LE CIRCUIT EST UNE OPTION DU DOSSIER, défaut faux (`Tenant.circuitVisa`).
  AUDCIF art. 22, 2° impose la validation et ne nomme personne ; l'art. 69
  laisse à l'entité « les procédures nécessaires » (SYSCOHADA) ; SYCEBNL
  art. 16, 2) demande « la mise en place de procédures nécessaires à une
  organisation comptable permettant un contrôle interne fiable », l'art. 69
  lui étant exclu par son art. 3. Aucun texte n'impose un visa · même parti
  que le double regard (CLAUDE.md § 10 ter) et le visa des RIB.
- D2 · LE VISA PORTE SUR CE QUI ENTRE AU LIVRE-JOURNAL · l'écriture
  (saisie, OD, règlement, écriture d'une facture). AUDCIF art. 22, 1°
  (origine, contenu, imputation) et 2° (validation, puis irréversibilité) ·
  c'est l'écriture qui franchit, c'est donc elle que le visa précède. La
  doctrine CPCC (organisation-comptable-cpcc, ch. 2, § 2.6.1) décrit la même
  division du travail · « le chef comptable peut se limiter à vérifier la
  conformité de l'imputation », et sa fiche d'imputation type porte
  « paraphe, visa du chef comptable ».
- D3 · LA FACTURE A SON PROPRE VISA, AVANT SA COMPTABILISATION · CPCC ch. 3,
  § 3.1.1 · le bureau fournisseurs « envoie les factures à l'approbation des
  services bénéficiaires ; suit l'approbation des factures […] et réceptionne
  celles approuvées », avant de valider les imputations. Une facture n'a pas
  de chemin de modification dans OmegaX (enregistrée, elle se supprime ou
  s'annule par une note de crédit), son visa ne tombe donc jamais.
- D4 · LE VISA TOMBE QUAND LE CONTENU CHANGE, ET CE QUI COMPTE EST L'AUTEUR DU
  DERNIER CONTENU · AUDCIF art. 22, 1° (le contenu et l'imputation sont ce
  qui est saisi). Le modèle est celui du visa d'un RIB (règle 2) · toute
  saisie fait tomber le visa et nomme son auteur.

## Conventions d'OmegaX

- C1 · le visa est porté par un administrateur ou un comptable
  (`@ReserveAuComptable`), jamais par l'auteur du dernier contenu, jamais
  par l'aide-comptable.
- C2 · l'empreinte du contenu visé (date, date de valeur, journal, pièce,
  référence, libellé, lignes · compte, libellé, montants, devise, cours,
  échéance, taux de taxe, mode de règlement, ventilations analytiques).
  Le budget fait partie de ce que le responsable approuve d'une dépense
  (Microfina++ M p. 129, 135) · une ventilation changée fait tomber le visa.

- C3 · concordance · l'écart est COMPTABILITÉ MOINS MODULE, au centime ;
  une famille dont une ligne manque est NON CALCULÉE, jamais concordante ;
  un refus du module (exception HTTP) rend son motif, une panne imprévue est
  consignée au journal du serveur ; au plus cinquante banques, dépassement
  dit. Familles servies · registre des biens (brut et amortissements, par
  `MaintenanceImmobilisationsService`), provisions (rapprochement du
  registre), créances douteuses (416 et 491 du module), analytique (contrôle
  des cumuls), banques (dernier relevé face au solde pointé). Stocks et paie ·
  aucun module ne tient de confrontation, NON CALCULÉ avec le motif ; tiers ·
  sans objet (le collectif se fond par lien, il n'y a rien à confronter).

## Décision par la loi · idée 12

- D5 · aucun texte n'impose l'écran · il sert le contrôle interne que l'AUDCIF
  art. 69 laisse à l'entité (SYSCOHADA) et que le SYCEBNL demande par son
  art. 16, 2), et l'inventaire de l'AUDCIF art. 42 (recensement et évaluation
  des biens, créances et dettes), que l'art. 3 du SYCEBNL n'écarte pas ·
  lecture seule, aucune correction, la forme est une convention d'OmegaX.

## Limites écrites

- (levées le 2026-10-28) la ventilation analytique nomme son auteur ; la
  fiche d'immobilisation aussi ; l'auteur INCONNU ne reste qu'aux chemins qui
  n'en ont pas, et sa dérogation nominative part de l'écran Brouillard.
- La commande (M2) n'a que son point d'entrée (`ObjetDuCircuit` 'COMMANDE').

## Questions pour Manasse

1. Le règlement d'une facture NON visée n'est pas refusé (seule sa
   comptabilisation l'est) · faut-il aussi bloquer le règlement ?
2. Une facture visée dont l'écriture passe au brouillard est visée deux fois
   (la facture, puis l'écriture) · garder les deux visas, ou tenir l'écriture
   d'une facture visée pour visée ?
3. (tranchée par la relecture M2, convention C2) la ventilation analytique
   compte comme un changement de contenu pour le double regard aussi.

## Commandes de vérification

```bash
cd /home/user/wt-m1
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

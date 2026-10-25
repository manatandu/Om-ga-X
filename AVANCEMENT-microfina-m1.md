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

## Reste

1. Scénario sur vraie base à travers une clôture, relectures.

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

- La ventilation analytique d'une ligne au brouillard ne nomme pas son auteur
  (route d'analytique, hors de cette ligne) · elle fait tomber le VISA par
  l'empreinte, mais ne change pas l'auteur du dernier contenu pour le double
  regard.
- `FicheImmobilisationService` (immobilisations, ligne partiels-sage) appelle
  `modifierPieceDuModule` sans auteur · le contenu est dit d'auteur INCONNU, et
  le double regard demande alors le nom et le motif du second regard porté hors
  du logiciel (dérogation existante), jamais une présomption.
- La commande (M2) n'a que son point d'entrée (`ObjetDuCircuit` 'COMMANDE').

## Questions pour Manasse

1. Le règlement d'une facture NON visée n'est pas refusé (seule sa
   comptabilisation l'est) · faut-il aussi bloquer le règlement ?
2. Une facture visée dont l'écriture passe au brouillard est visée deux fois
   (la facture, puis l'écriture) · garder les deux visas, ou tenir l'écriture
   d'une facture visée pour visée ?
3. La ventilation analytique doit-elle compter comme un changement de contenu
   pour le double regard (pas seulement pour le visa) ?

## Commandes de vérification

```bash
cd /home/user/wt-microfina-m1
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

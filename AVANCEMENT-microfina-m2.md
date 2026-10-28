# AVANCEMENT · ligne microfina-m2 (achats et trésorerie)

Branche de sauvegarde `travail/microfina-m2`, partie de `origin/main` (1274d93).
Décision de Manasse du 2026-10-25 · les douze idées Microfina++ levées du gel
(`docs/comparaison-microfina/plan-reproduction-microfina.md`).

## Idées de la ligne

| Idée | Objet | État |
|---|---|---|
| 2 | Bon de commande fournisseur qui crée l'engagement, exécuté par la facture d'achat | serveur, écran et tests écrits · bloc § 3 et scénario sur vraie base passés |
| 5 | Arrêté de caisse par coupures, plafond d'encaisse qui avertit | serveur, écran et tests écrits · bloc § 3 et scénario sur vraie base passés |
| 9 | Registre des chèques émis (chéquier par RIB, émis, annulé, encaissé lu au rapprochement) | serveur, écran et tests écrits · bloc § 3 et scénario sur vraie base passés |

## Décisions par la loi

### Idée 2 · bon de commande fournisseur

- **Ce que le bon engage.** SYCEBNL, Guide d'application, ch. 7, Application 22,
  règle (d) · « bons de commande de biens et services remis aux fournisseurs au
  cours de l'exercice budgétaire, non exécutés ». Le bon N'ENGAGE qu'à sa REMISE
  (date de remise exigée, dans l'exercice) ; un brouillon n'engage rien.
- **Aucune écriture à la commande.** Le bon remis ne débite ni ne crédite rien
  (même règle, l'engagement est un terme NON comptable ; fiche du compte 40 ·
  le 40 n'est crédité que « du montant des factures »).
- **Base TTC prévue.** Le terme 1 de la règle (d) est le solde créditeur du 40,
  que la fiche du compte 40 crédite « du montant des factures » (classe 6 HT
  récupérable, 445) · la facture qui exécute fait passer la même somme du
  terme 2 au terme 1. Le bon engage donc HT plus taxe prévue, ligne par ligne.
- **Une ligne budgétaire par ligne du bon.** Règle (a) · « suivant la
  nomenclature budgétaire du projet », un plan analytique qui gère les budgets
  dans OmegaX (comme le registre existant). Le bon fait naître UN engagement par
  section, nature BON_DE_COMMANDE, rattaché au bon.
- **L'exécution par la facture.** Seule une facture d'ACHAT du MÊME fournisseur,
  passée au journal et VALIDÉE, exécute (même règle que le registre, F140 · le
  tableau ne lit que le livre-journal). La part de chaque ligne budgétaire est
  DÉCLARÉE, jamais répartie au prorata ; au-delà du reste à facturer, refus
  (comme le registre · « refusé plutôt que rogné »).
- **Exercice suivant.** Une facture d'un exercice POSTÉRIEUR réduit le reste à
  facturer du bon (document) sans exécuter l'engagement de N · le tableau de N
  est établi exercice par exercice et le bon y était non exécuté à la clôture.
- **Cloisonnement.** SYCEBNL seul, comme le registre des engagements (la
  colonne Engagement n'existe que dans le jeu des projets de développement ;
  `@ReferentielsAutorises(SYCEBNL)` et `referentielsApplicables`).
- **Pièce justificative.** CPCC, ch. 1 § 1.1.1 · « bons de commande adressés aux
  fournisseurs » sont des pièces d'origine interne ; § 1.2 · « le bon de
  commande, la facture et le bon de réception n'acquièrent de force probante
  que réunis ». AUDCIF art. 17, 3° (pièces datées, conservées) · le bon remis
  reçoit un numéro continu par dossier et ne se supprime plus.

### Idée 5 · arrêté de caisse et plafond d'encaisse

- **Ce que l'arrêté compare.** Fiche du compte 57 des deux plans · « le solde
  du compte caisse doit toujours correspondre exactement à la somme disponible
  réellement » ; éléments de contrôle · « procès-verbaux de caisse ; états de
  reddition de la caisse ; bordereaux de situation journalière ». L'arrêté
  compte la caisse AU JOUR, contre le solde de tout ce qui est saisi à la fin
  de ce jour, BROUILLARD COMPRIS (la validation est mensuelle, AUDCIF art. 22,
  2° · le jour, la caisse réelle est celle du brouillard), situation et
  à-nouveau provisoire exclus, date inscrite (art. 22, 4°). Même lecture que
  le refus de la caisse créditrice (`soldeDeCaisseAuJour`, ajouté à
  `comptabilite/caisse-provisionnee.ts`, lecture seule), le nombre d'écritures
  au brouillard dit.
- **Deux référentiels.** La fiche du 57 est la même aux deux plans · aucun
  `@ReferentielsAutorises`.
- **Aucune écriture.** Un écart se DIT (« excédent » ou « manquant »), rien
  n'est passé · aucune source lue ne dit quoi créditer d'un excédent de caisse
  (CLAUDE.md, « l'art. 43 ne régit pas la caisse »). Solde créditeur ·
  « présomption d'irrégularité », dit.
- **Exercice clôturé · refusé.** La caisse comptée pour la clôture relève du
  procès-verbal de comptage de l'inventaire (AUDCIF art. 42 ; CPCC § VI).
- **Plafond d'encaisse · convention du dossier.** Aucun texte lu n'en fixe ·
  il AVERTIT (situation des caisses, arrêté), il ne refuse rien ; posé par
  l'administrateur avec la décision qui le fixe, versionné par date d'effet ;
  comparé dans SON unité, jamais converti.

### Idée 9 · registre des chèques émis

- **Pièce justificative.** CPCC, ch. 1 § 1.1.1 · « souches ou talons de
  chéquiers » ; ch. 3 · « coupon de chèque » au paiement d'une dette
  fournisseur. Le carnet qui a servi ne se retire plus.
- **Enregistré dès l'émission.** Guide SYSCOHADA, Partie 1 ch. 4 § 2.2 ·
  le débiteur enregistre le chèque « dès l'émission » (prudence) ; tolérance
  à l'avis de débit, la régularisation de fin de période devant « tenir
  compte des chèques en circulation » · le registre rend le total EN
  CIRCULATION sur tout le registre ; une pièce datée autrement que
  l'émission est AVERTIE.
- **Encaissé se LIT.** Jamais saisi · toutes les lignes de la pièce au compte
  de la banque pointées au rapprochement (fiche du compte 52, éléments de
  contrôle · relevés et états de rapprochement).
- **Lien avec le règlement des tiers et l'ordre de virement.** Le chèque se
  relie à la pièce du JOURNAL DE LA BANQUE du carnet qui crédite son compte du
  montant exact ; une pièce payée par un ordre de virement (`LigneOrdreVirement`)
  ou dont la ligne de banque porte un mode de règlement autre que le chèque
  est refusée (un virement n'est pas un chèque). Aucune retouche de
  `reglements/` · la pièce du règlement se choisit dans le registre.
- **Annulation.** Refusée une fois encaissé ; délie la pièce, qui reste au
  journal (à retirer au brouillard ou à inscrire en négatif, AUDCIF art. 20,
  al. 2), et le dit. Un numéro jamais émis s'annule aussi (feuillet gâché).

## Conventions d'OmegaX

- Numéro du bon · continu par dossier, posé à la remise (un brouillon se
  supprime sans laisser de trou).
- Un bon remis se CLÔT avec un motif (commande annulée ou soldée en moins),
  ses engagements avec lui ; il ne se supprime pas.
- Arrêté · un seul non annulé par caisse et par jour ; les coupures FONT les
  espèces (calculées par le serveur) ; heure facultative ; un arrêté s'annule
  avec son motif, jamais ne se retouche.
- Chéquier · plage croissante, largeur imprimée de 1 à 12 chiffres, aucun
  chevauchement sur le même compte ; un numéro sert une fois ; le chèque se
  date au plus tard aujourd'hui et pas avant la réception du carnet.
- Bornes des corps · 100 lignes de bon, 60 coupures ; listes bornées dites
  (`total`, `tronque`).

## Questions pour Manasse

1. Bon de commande en SYSCOHADA · aucun engagement budgétaire n'y existe ;
   faut-il ouvrir le bon de commande comme simple pièce d'achat (reste à
   facturer) aux sociétés ? Fermé pour l'instant, comme le registre.
2. Un bon remis en N non facturé à la clôture · la règle (d) ne le fait peser
   que sur le tableau de N (« au cours de l'exercice budgétaire »). Faut-il le
   faire peser aussi sur N+1 ? Lecture littérale retenue, dite à l'écran.

3. Plafond d'encaisse · aucun texte lu ne le fixe (ni AUDCIF, ni SYCEBNL, ni
   CPCC). Faut-il AUSSI avertir à la saisie d'une entrée de caisse qui le
   dépasse ? Non fait (la saisie est dans `comptabilite/`, ligne M1) ; il
   avertit à l'arrêté et dans la situation des caisses.
4. Bon de commande · un « bon de réception » (CPCC § 1.2, force probante
   réunie) n'est pas tenu · à ouvrir plus tard ?

## Relecture (faite, un tour)

Aucun outil de lancement d'agent n'était offert à cette session · la
relecture a été conduite à la main sur la grille de `silent-failure-hunter`,
`typescript-reviewer` et `react-reviewer` (`.claude/agents/`). Corrigé ·
(1) route `numeros/annulation` masquée par `:id/annulation` (trouvé par le
scénario, gelé) ; (2) pièce d'un chèque retirée du journal (SET NULL) qui
restait affichée comme la pièce qui paie · `pieceRetiree` servi et dit ;
(3) une requête par chèque et une par carnet au registre · une lecture
groupée pour la tranche, une somme par compte de banque ; (4) réponses
périmées (autre caisse, autre carnet) jetées par jeton à l'écran, et un
registre illisible n'affiche plus l'ancien. Restent dits, non corrigés ·
le décompte « au brouillard » de l'arrêté ne compte que l'exercice du jour
(le solde, lui, remonte l'exercice précédent non clos).

## Scénario sur vraie base (fait)

Script hors dépôt (`scenario-m2.cjs` du bloc-notes de la session), base
PostgreSQL jetable, serveur compilé, dossier SYCEBNL « projets » · N = 2025,
N+1 = 2026, clôture de N traversée. 35 constats, 0 écart · engagements de la
remise (A1 116 000, B2 50 000), exécution par la facture validée (A1 0),
B2 facturé en N+1 (reste du bon 0, tableau de N à 50 000), chèques (en
circulation 146 000 puis 30 000 après le rapprochement, 80 000 en N+1),
caisse (solde théorique 255 000 brouillard compris, manquant 5 000, plafond
dépassé dit, à-nouveau 255 000 en N+1, arrêté refusé dans N clos). Il a
trouvé un défaut · `POST /cheques/numeros/annulation` était pris par
`:id/annulation` (ordre des routes), corrigé et gelé par `cheques.spec.ts`.

## Seconde relecture (2026-10-28, faite)

Fusion de `origin/main` (sans conflit). Chaque constat vérifié dans le code
avant correction · tous confirmés.

- **M1** · facture d'un bon barrée · VOIE RETENUE, le refus · la note de
  crédit d'une facture qui exécute un bon est refusée tant que la part se
  retire, issue nommée (« retirez-la du bon d'abord »), sous le verrou des
  bons (`issueNoteDeCreditSurFactureDUnBon`) ; seule la part qui pèse sur un
  exercice clôturé passe (le bon ne peut plus la rendre), dite, et la facture
  barrée est nommée sur le bon (`barreePar`). Écarter en lecture aurait laissé
  au registre un rattachement sans valeur, sommé partout.
- **M2** · carnet refusé sur un compte en devise (RIB en devise, racine « en
  devises », ligne en devise au compte), à la création, à l'émission et au
  rattachement · motif nommé. Porter la devise du chèque reste au suivi.
- **M3** · pièce corrigée par son négatif lié · état « pièce annulée au
  journal », jamais encaissé, hors du total en circulation, annulation
  ouverte ; la pièce corrigée reste liée au chèque annulé (contrainte
  `cheques_emis_etat` assouplie dans la migration de la ligne, non encore sur
  `main` · trouvé sur vraie base, 500 sur 23514).
- **M4** · pièce du brouillard rejugée à chaque lecture (journal, crédit au
  centime), écart dit (`ecartDeLaPiece`).
- **M5** · clore un bon exécuté par une facture d'un exercice postérieur est
  refusé tant que l'exercice du bon est ouvert (un engagement ne se clôt pas
  en partie) · après sa clôture, le bon se clôt seul.
- **m1** `jourValide` (`common/echeance.ts`) partout · « 2026-02-31 » et
  « 2026-13-45 » en 400 ; **m2** brouillon figé dans un exercice clôturé ;
  **m3** fournisseur relu actif à la création et à la remise ; **m4** le
  brouillard des exercices antérieurs que le solde remonte compté et dit
  (`brouillardExercicesAnterieurs`, colonne ajoutée à la migration de la
  ligne) ; **m5** le plafond se compare au SOLDE partout (fiche du compte 57,
  le solde est la somme disponible réellement ; l'écart aux espèces est dit à
  part) ; **m6** annulation d'arrêté sous le verrou de la caisse, refusée en
  exercice clôturé ; **m7** plafond en double en 409 nommé (P2002 traduit),
  retrait sous verrou en 409 ; **m8** plafonds et derniers arrêtés lus
  groupés, le solde reste lu caisse par caisse (même lecture que le refus de
  la caisse créditrice, une version groupée divergerait) ; **m9** `au` sur
  `GET /cheques` · émis au plus tard ce jour, ni annulé ni encaissé (date du
  relevé du rapprochement qui pointe) ni corrigé avant sa fin ; **m10** le
  RIB retenu par un carnet servi ne promet plus de retrait, nomme le journal
  en sommeil ; **m11** listes illisibles à `null` (fournisseurs, sections,
  factures du bon, chéquiers, banques, pièces, situation) ; **m12**
  `e2e/tests/microfina-m2-cheques.e2e.ts` (émis, pointé, encaissé après la
  clôture, total à une date d'arrêté).

Rejeu sur vraie base (PostgreSQL 16 jetable, serveur compilé, SYCEBNL
projets, N = 2025, N+1 = 2026, clôture de N traversée) · 28 constats, 0
écart, script hors dépôt `scenario-m2-relecture.cjs`. Le chemin API du test
navigateur rejoué de même sur SYSCOHADA · 5 constats, 0 écart (Playwright non
lancé ici, aucun navigateur installé).

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

# Paquet 1, ligne B · avancement

Branche de sauvegarde `travail/paquet1-b`, partie de `main` e31f4de. Fiche
retirée à l'intégration (CLAUDE.md § 5).

Méthode · chaque point est reproduit sur vraie base AVANT correction (copie
`main` de `/home/user/Comptaflow`, base `p1b_avant`, port 8771), corrigé, puis
rejoué APRÈS sur le serveur compilé de cette copie (base `p1b_apres`).
Scénario · `/home/user/wt-passe/scripts/passe-v1/scenario-paquet1-b.mjs`
(non committé, hors dépôt), points choisis par `PAQUET1_B_POINTS`.

## Fait

### B10 · la campagne de caisse seule ne se clôt pas

- AVANT (p1b_avant) · campagne d'une association SYCEBNL, caisse 57100000 à
  1 300 000, PV de caisse sans écart et PV de campagne établis · `POST
  /inventaire/:id/clore` rend 403 « Cette campagne est au statut RECENSEMENT ·
  l'opération demandée n'est possible qu'en ARBITRAGE. » ; `rapprocher`
  refuse « Aucune fiche à rapprocher. » · la campagne n'a aucune issue. Le
  refus d'une campagne au manquant de caisse (PV 1 295 000, écart −5 000) ne
  nommait pas la voie d'arbitrage.
- Correction · `InventaireService.clore` admet le RECENSEMENT pour une
  campagne de caisses seules (`verifierCampagneDeCaissesSeules`) · aucune
  fiche, au moins un PV, aucun PV à écart ; puis les refus déjà en place
  (écarts sans décision, caisses non comptées). Le refus de `rapprocher` sans
  fiche nomme ce chemin. Écran · `peutCloreLaCampagne`
  (`client/src/lib/cloture-campagne.ts`) montre « Clore la campagne » à
  l'arbitrage ou au recensement d'une campagne de caisses seules.
- Refus voulus gardés · campagne avec fiches (rapprochement d'abord), rien de
  compté (AUDCIF art. 42), PV à écart (CPCC, étape 5 · « les écarts négatifs
  sont à la charge de l'entreprise, et la sous-commission doit déterminer le
  responsable de chaque type d'écart »), caisse non comptée, préparation.
- Tests · `pv-comptage-caisse.spec.ts` (six cas, doublure de
  `ficheInventaire.count` qui honore dossier et campagne),
  `client/src/lib/cloture-campagne.spec.ts` (six cas).
- APRÈS · à rejouer avec les autres points (voir « Reste »).

### B1 · `CHARGE_SANS_TIERS` sur le redressement d'un manquant de caisse

- AVANT (p1b_avant) · caisse 57100000 à 1 000 000, fiche de caisse à 995 000,
  rapprochement (écart −5 000), arbitrage « à redresser », écriture
  D 65800000 / C 57100000 de 5 000 « Manquant de caisse constaté à
  l'inventaire » rattachée à l'écart · le contrôle la signale (lu true). La
  dépense de caisse sans tiers du même dossier (« Fournitures de bureau
  payées comptant ») reste signalée (concorde).
- Correction · `controles.service.ts` lit la liaison
  (`ecartsInventaire` dans `SELECT_ECRITURE_CONTROLEE`) et retire de la
  lecture la SEULE ligne que le rattachement justifie (compte inventorié,
  crédit au centime du manquant, une par écart lié,
  `lignesHorsRedressementInventaire`) · une autre dépense de trésorerie de
  la même pièce reste signalée ; une pièce de même libellé sans liaison
  aussi.
- Tests · `charge-sans-tiers.spec.ts`, quatre cas (B1).

### B2 · `CHARGE_SANS_TIERS` sur les intérêts prélevés par la banque

- AVANT (p1b_avant) · D 67120000 / C 52110000 « Intérêts emprunt BCDC S1 »,
  dans un dossier SYSCOHADA et dans un dossier SYCEBNL · signalé (concorde)
  mais jamais nommé (lu false aux deux) ; loyer prélevé et pièce mêlée
  intérêts et loyer, signalés et non nommés (concorde).
- Correction · l'occurrence d'une pièce dont TOUTES les charges sont au 67
  (hors 679) dit le cas que la fiche du compte 67 admet et sa pièce
  (`chargesToutesAu67HorsDotations`) ; le signal et sa gravité
  (AVERTISSEMENT) restent ; loyer, pièce mêlée et 679 ne sont pas nommés.
- Tests · `charge-sans-tiers.spec.ts`, quatre cas (B2).

### B9 · `GET /rapprochements/:id/propositions` sans `fenetreJours`

- AVANT (p1b_avant) · 52110000, relevé d'une ligne · sans paramètre, 400
  « Validation failed (numeric string is expected) », aucune proposition,
  fenêtre non servie ; avec `fenetreJours=15`, 200 et une proposition
  (concorde) ; `abc`, 400 qui ne nomme pas la fenêtre.
- Cause · le ValidationPipe global (`transform: true`) convertissait le
  paramètre absent en NaN AVANT `ParseIntPipe({ optional: true })`.
- Correction · `PropositionsRapprochementDto` (requête entière, `enEntier`
  désormais exporté de `filtre-journal-audit.dto.ts`, une seule règle de
  lecture d'un entier) · absente, la fenêtre prend le défaut du service
  (`FENETRE_JOURS_DEFAUT`, 15, convention d'OmegaX écrite au commentaire) ;
  illisible ou hors de la plage de l'écran (0 à 120, `FENETRE_JOURS_MAX`),
  400 qui nomme la fenêtre. La borne haute ferme aussi le 500 d'une fenêtre
  énorme (date sortie du calendrier), relevé voisin d'avant.
- Tests · `fenetre-propositions.spec.ts` (le DTO sous le pipe global de
  production, et la route qui ne porte plus de `ParseIntPipe`).

### B3 · balance âgée · la ligne au solde nul sous « Soldes en sens inverse »

- AVANT (p1b_avant) · CLIENTS_41 au 31/12/2026 · C3, facture de 1 000 000 du
  10/03 et règlement de 1 000 000 du 10/10 non lettrés ; C3B, facture de
  500 000 · C3 sortait parmi les soldes en sens inverse (lu true), aucune
  section à part (`soldesNuls` absent).
- Correction · `EcritureService.balanceAgee` rend les lignes au solde nul à
  part (`soldesNuls`, sans tranches, solde 0), jamais en sens inverse ; les
  totaux et le net n'en bougent pas. Le classeur exporté les écrit sous
  « SOLDES NULS · pièces ouvertes qui se compensent, à lettrer », sans total
  ni place dans le net ; l'écran aussi, solde écrit « 0,00 », bulle d'aide
  complétée.
- Tests · `balance-agee-tranches.spec.ts` (deux cas, clients puis « 40 et
  41 » et fournisseurs), `balance-agee-export.spec.ts` (un cas, classeur
  relu).

### B7 · un groupe d'à-nouveaux lettré à la main, sans groupe de N reconduit

- AVANT (p1b_avant) · SARL SYSCOHADA, 2026 clôturé. C7 · F1 du 01/03/2026
  (échéance 31/03) et F2 du 01/09/2026 (échéance 30/09), 1 000 000 chacune,
  reportées au détail ; règlement de 1 000 000 le 15/02/2027, lettré à la main
  en partiel avec les deux à-nouveaux. Relance au 15/03/2027 · dû 1 000 000
  (concorde) mais deux lignes de 500 000 (prorata), échéance la plus ancienne
  31/03/2026 et 349 jours de retard. C7B · même libellé et même montant
  (600 000, février et août) · deux lignes de 300 000, échéance 28/02/2026,
  380 jours.
- Cause · `poidsDesLignesLues` ne relisait l'origine que des groupes
  RECONDUITS (`originesDesLignes`) ; un groupe posé en N+1 lisait ses
  à-nouveaux au 1er janvier, et l'imputation de l'art. 154 tombait au prorata.
- Correction · `originesDesANouveaux` (`reste-des-lignes-ouvertes.ts`)
  retrouve la pièce d'origine de chaque ligne d'à-nouveau d'un groupe qu'aucune
  reconduction ne date, par la clé du report au détail
  (`originesDesReports`, extrait de `datesOrigineDesReports` des relances, de
  proche en proche). La clé porte désormais l'ÉCHÉANCE (le report la
  recopie) et le libellé de l'écriture quand la ligne n'en a pas (celui que
  le report recopie, `lireComptesDuReport`). TOUT OU RIEN par groupe · une
  origine manquante laisse toutes les lignes d'à-nouveau du groupe à la date
  du report, et le groupe à plusieurs factures est consigné au journal du
  serveur. Les lignes relues sont filtrées en mémoire (identifiant demandé,
  écriture d'à-nouveau). La date imprimée par les relances (même lecture)
  retrouve aussi l'origine d'une ligne sans libellé propre, et une origine à
  échéance ne se confond plus avec un report sans échéance.
- APRÈS (p1b_apres, port 8772) · C7 · une ligne de 1 000 000, échéance
  30/09/2026, 166 jours ; C7B · une ligne de 600 000, échéance 31/08/2026,
  196 jours ; soldes de la balance 2027 inchangés (concorde).
- Tests · `reste-des-lignes-ouvertes.spec.ts` (cinq cas, doublure complétée
  qui honore l'identifiant, le drapeau d'à-nouveau, l'exercice, le compte et
  le lettrage ; quatre tombent sur le code d'avant, celui de l'échéance tombe
  si on la retire de la clé), `date-origine-des-reports.spec.ts` (cinq cas).

### B6 · relance d'une facture soldée dans sa devise, écart réalisé non passé

- AVANT (p1b_avant) · SARL SYSCOHADA, 2026 clôturé. C6 · facture de
  1 000 USD à 2 800 (2 800 000) du 01/03/2026, reportée au détail ; règlement
  de 1 000 USD à 2 900 (2 900 000) le 10/02/2027 lettré en partiel avec
  l'à-nouveau (gain réalisé de 100 000 non passé) ; facture en francs de
  500 000. Relance au 15/03/2027 · dû 400 000, trois lignes (2 800 000,
  500 000, − 2 900 000), aucun écart nommé. C6B · réglé à 2 700 (perte de
  100 000), facture en francs de 300 000 · dû 400 000, la PERTE DE CHANGE
  réclamée au client.
- Correction · `groupes-soldes-en-devise.ts` (relances) · un groupe lu en
  entier (nombre de ses lignes en base égal aux lignes lues), toutes ses
  lignes dans une seule devise, soldé dans cette devise et non en francs, ne
  se réclame ni ne se retranche ; l'écart (signé comme `ecartDuGroupe`) est
  nommé sur la position (`ecartsChangeNonPasses`), jamais imprimé dans la
  lettre. Écran Rappel et relevé · « écart de change à passer » sur la ligne
  du compte, le libellé au détail.
- APRÈS (p1b_apres) · C6 · dû 500 000, une ligne, gain de 100 000 nommé ;
  C6B · dû 300 000, une ligne, perte de 100 000 nommée ; soldes de la balance
  2027 inchangés (400 000 chacun, l'écart non passé compris).
- Tests · `groupes-soldes-en-devise.spec.ts` (onze cas · la règle, lu en
  entier, cloisonnement, et les positions de relance ; deux tombent si la
  règle est retirée du service).
- Limites écrites · un compte qui ne doit rien d'autre n'a pas de position,
  l'écart y reste nommé au lettrage et refusé à la clôture (D3 d'A6) ; un
  groupe qui porte aussi une ligne en francs seuls garde la règle commune
  (lu ligne à ligne, B5).

### B5 · les groupes lus ligne à ligne, servis et dits

- AVANT (p1b_avant) · C5 doit 1 000 USD inscrits à 2 800 000, réglés de
  600 USD à 3 000 (1 800 000), lettrés en partiel · le reste au coût
  historique (1 120 000) ne rend pas le solde en francs (1 000 000), le
  groupe est lu ligne à ligne. Note par échéance, balance âgée, échéancier,
  relance d'une SARL, NOTE 3 des SMT SYSCOHADA et SYCEBNL · aucun ne le sert
  (`groupesLusLigneALigne` absent, lu null aux six) ; six lignes « WARN » au
  journal du serveur seulement. Totaux exacts (net et dû 1 000 000, concorde).
- Correction · `groupesLusLigneALigne` et `groupesLusLigneALigneParCompte`
  (`reste-des-lignes-ouvertes.ts`) · total, vingt premiers groupes par compte
  puis code, `tronque`, lus par tranches, bornés au dossier. Servis par
  `notesDuJeu` (via `chargerEcheances`), `balanceAgee`, `echeancier`, la
  NOTE 3 des deux SMT (via `ecartsDesGroupesParEcheance`, qui rend
  `nonRepartis`) et chaque position de relance (hors des groupes soldés dans
  leur devise, nommés par B6). Écran · une ligne (`GroupesLusLigneALigne`,
  la raison en infobulle) sur les sept fenêtres · notes annexes (deux),
  balance âgée, échéancier, rappel et relevé (et « lu ligne à ligne » sur la
  ligne du compte), états des deux SMT. Rien quand `total` vaut 0 ou que le
  serveur ne le sert pas.
- APRÈS (p1b_apres) · les six lectures servent `{ total: 1, groupes: [C5] }`,
  totaux inchangés (concorde).
- Tests · `reste-des-lignes-ouvertes.spec.ts` (neuf cas · le service borné,
  par compte, cloisonné ; balance âgée, relance et notes sur le groupe de
  C5 ; câblage des lecteurs), `groupes-soldes-en-devise.spec.ts` (un groupe
  soldé en devise n'est pas nommé deux fois), client
  `lib/groupes-lus-ligne-a-ligne.spec.ts` (texte et câblage des sept écrans)
  et `components/GroupesLusLigneALigne.spec.tsx` (rendu).

### B4 · la grille de la balance âgée sans rôles de tableau

- AVANT (copie `main`) · `client/src/pages/BalanceAgeePage.tsx` ne porte
  aucun `role=` ni `aria-` (0 et 0) · la grille CSS se lit, à l'aide
  technique, comme une suite de textes sans en-têtes.
- Correction · le tableau sort de la page dans
  `client/src/components/TableauBalanceAgee.tsx` (mêmes classes, même rendu)
  et porte le motif « table » de WAI-ARIA · `table` nommé (`aria-label`,
  `aria-colcount`), deux `rowgroup`, deux rangées d'en-têtes de colonne (âge,
  puis tiers, périodes, solde), une rangée par tiers dont le libellé est
  l'en-tête de rangée, totaux et solde net en rangées, intercalaires et
  message « aucune échéance » en rangées d'une cellule (`aria-colspan`).
- Tests · `client/src/components/TableauBalanceAgee.spec.tsx` (huit cas ·
  rendu statique relu en arbre, chaque rangée dans un groupe, chaque cellule
  dans une rangée, largeur de chaque rangée égale au nombre de colonnes,
  en-têtes de colonne et de rangée, intercalaires, tableau vide) ; retirer
  le rôle d'une rangée de tiers fait tomber trois cas.
- Pas de rejeu sur base · point d'écran, sans montant (le serveur et ses
  réponses ne bougent pas).

### B8 · doublures de la note par échéance et de la NOTE 3 des SMT

- Point de TESTS · les doublures de `reste-des-lignes-ouvertes.spec.ts`
  (note par échéance, NOTE 3 des SMT) rendaient un `groupBy` constant et
  toutes les lignes à `findMany`, celles des deux services SMT ignoraient le
  statut de l'écriture · un état qui aurait lu le brouillard passait au vert.
- Vérifié quand même sur vraie base (p1b_avant, `main`) · C8, facture de
  1 000 000 (échéance 28/02/2027), règlement validé de 300 000, règlement de
  200 000 resté au brouillard, les trois lettrés en partiel · NOTE 7 de la
  SARL (« à un an au plus » 700 000, rien de non ventilé) et NOTE 3 des deux
  SMT (solde, non échu 700 000, non ventilé 0) · concorde avant correction,
  le code de production filtrait déjà le livre-journal.
- Correction (tests seuls) · `baseQuiHonore` évalue le filtre comme la base
  (ET, OU, écriture · dossier, exercice, statut, date, drapeaux d'à-nouveau ;
  lettrage, lettre, identifiant, compte) et tombe sur toute clé inconnue ;
  un règlement au brouillard dans le groupe de chaque cas. Les doublures des
  deux services SMT honorent le statut, un cas de brouillard chacune.
- Preuve · retirer `statut: 'VALIDEE'` de `chargerEcheances`, ou le filtre de
  l'appelant de `ecartsDesGroupesParEcheance`, fait tomber les deux cas de
  `reste-des-lignes-ouvertes.spec.ts` ; retirer le statut des deux
  `partsParEcheance` fait tomber trois cas des specs des services SMT.

## Premier tour de relecture (échecs silencieux) · deux majeurs, sept mineurs, un voisin

Chaque constat vérifié dans le code, reproduit sur vraie base contre `main`
(base `p1b_avant`, port 8771) et contre cette copie AVANT correction, corrigé
avec son test, rejoué APRÈS (base `p1b_apres`, port 8772). Points du
scénario · `M1`, `M1B`, `M2`, `MIN2`, `MIN4`, `MIN5`, `MIN6`, `VOISIN`
(`/tmp/claude-0/sim/p1b-relecture-avant.json` contre `main`,
`p1b-relecture-branche.json` contre la copie avant correction).

### Spec cassé par B4 (trouvé en relançant les specs voisins)

- `balance-agee-modele.spec.ts` relisait la seule page · depuis B4 la grille
  vit dans `TableauBalanceAgee` · cinq tests tombaient. Le spec relit page ET
  composant, et vérifie que la page rend ce composant. Commit 8e1604b.

### Mineur 7 · le motif de chaque groupe nommé

- Vérifié · l'infobulle disait « écart de change non passé » pour tout
  groupe ; une facture en devise réglée en PARTIE n'a aucun écart à passer
  (AUDCIF art. 55 ; ligne A6, l'écart au groupe soldé).
- AVANT · `main` ne sert rien (lu `[null, null]`) ; la copie sert le groupe
  sans motif (lu `[1, null]`).
- Correction · `MotifGroupeNomme` servi par groupe (négatif sans origine,
  imputation déclarée illisible, soldé en devise avec écart non passé, réglé
  en partie en devise, reste non réparti) ; l'écran nomme le motif court et
  l'infobulle la raison de chaque motif présent. Commit cbe6c63.
- APRÈS · voir le rejeu final.

### M1 · le premier exercice tenu, ouvert par un bilan importé

- Vérifié · l'import d'une balance ne porte que compte, montants et devise
  (ni date de pièce, ni libellé de ligne, ni échéance) ; la chaîne d'un
  report s'arrêtait sur la ligne importée (`if (!precedent) break`), ni
  origine ni introuvable · le groupe tombait au prorata, et seul un `warn`
  le disait, aussi à tort dans le premier exercice.
- AVANT (main et copie) · C11 réclamé `[500 000, 500 000]`, échéance la plus
  ancienne 30/11/2025, retard 470 jours, au lieu d'une ligne de 1 000 000
  (F1), 31/03/2026, 349 jours. Le groupe sans origine de C21 (dossier gardant
  2025) n'était servi nulle part (`main` · null ; copie · total 0).
- Décision · la ligne d'à-nouveau d'un exercice SANS exercice précédent EST
  l'origine, à la date de son écriture · la date la plus tardive que ses
  pièces puissent porter (un bilan d'ouverture reprend la clôture d'avant) ;
  rangée à cette date elle passe avant toute pièce de l'exercice (Code civil,
  Livre III, art. 154, « sur la plus ancienne ») ; deux lignes d'ouverture de
  même date au prorata (« toutes choses égales »). L'échéance ne date pas la
  dette, elle dit si elle est échue. Un exercice qui a un précédent cherche
  toujours dans ce précédent ; introuvable, le groupe est NOMMÉ
  (`A_NOUVEAU_SANS_ORIGINE`), servi comme ceux de B5.
- APRÈS · M1 (8 contrôles) et la part M1 de M1B concordent.

### Mineur 1 · le tout ou rien vise toutes les lignes d'à-nouveau du groupe

- Vérifié · `originesDesANouveaux` ne cherchait que les lignes sans origine
  de reconduction, et le tout ou rien ne retirait que celles-là · un groupe
  reconduit complété à la main par un autre à-nouveau mêlait les ordres.
- AVANT (main et copie) · M1B, C22 · `[1 000 000]` réclamés sur le report de
  l'import (F, datée de mars par la reconduction, éteinte seule) au lieu de
  `[500 000, 500 000]`.
- Correction · toutes les lignes du groupe relues, le tout ou rien retire
  aussi les origines de la reconduction ; prorata à date égale (Code civil,
  Livre III, art. 154, « toutes choses égales »), groupe nommé.
- APRÈS · M1, M1B et B7 · 27 contrôles, 27 concordances.

### Mineur 2 · les origines se cherchent par le filtre du report

- Vérifié · les candidates étaient lues par `lettre: null` seulement, quand
  `lireComptesDuReport` reporte aussi `lettre: ''` et les lignes d'un groupe
  à cheval, et l'à-nouveau PROVISOIRE ne lit que le livre-journal.
- AVANT (main et copie) · MIN2, C31 · facture validée et doublon au
  brouillard, 2027 ouvert par les à-nouveaux provisoires · ligne datée
  `2027-01-01`, 45 jours, au lieu de `2026-03-01`, 351 jours (deux
  candidates pour un report, aucune origine).
- Correction · une seule définition (`exercice/lignes-reportees-au-detail.ts`),
  lue par le report et par la recherche des origines ; un report provisoire
  ne s'apparie qu'aux lignes validées. Un test de source gèle les deux appels.
- APRÈS · MIN2, M1, B7 · 19 contrôles, 19 concordances.

### Voisin · les relances de N comptent en N+1

- Vérifié · `positions` ne lisait l'origine que des reports SANS échéance ·
  un report avec échéance se datait du 1er janvier, borne des relances qui
  comptent (audit final F169).
- AVANT (main et copie) · VOISIN, C41 · ligne datée `2027-01-01`, dernière
  relance `[null, null]` au lieu de `[3, 2026-06-30]`, niveau 3 resuggéré
  (la mise en demeure de 2026 renvoyée).
- Correction · tout report cherche sa pièce (clé avec l'échéance recopiée) ;
  la date de la pièce borne les relances et s'imprime.
- APRÈS · VOISIN, B7, B6, MIN2, M1 · 33 contrôles, 33 concordances.

### M2 · un groupe qui ne se répartit pas se réclame pour son net

- Vérifié · `positions` filtrait chaque ligne d'un groupe `nonRepartis` par
  l'état pour elle-même · la facture en devise réglée en partie passait en
  préventif entière, et son règlement se retranchait en rappel d'une AUTRE
  facture échue. Les textes « le dû reste exact » et « le total est exact »
  ne disaient pas ce que la relance faisait.
- AVANT (main et copie) · M2, C51, au 01/03/2027 · préventif 2 800 000
  (une ligne 2 800 000) au lieu de 1 000 000 ; rappel · compte absent des
  positions (dû −300 000) au lieu de 1 500 000 sur F0.
- Correction · `PoidsDesLignes.enBloc` porte pour chaque groupe non réparti
  son net et sa facture encore ouverte la plus ancienne
  (`factureOuverteLaPlusAncienne` · les restes de l'imputation légale quand
  ils existent, Code civil, Livre III, art. 154, sinon les factures les plus
  récentes qui couvrent le net) ; la relance réclame le net sur cette seule
  ligne, à son échéance. Textes · « Le dû est exact ; l'échéance réclamée de
  ces groupes n'est pas sûre », et dans la relance la conséquence de chaque
  motif dit « se réclame pour son net », jamais « lu ligne à ligne ».
- APRÈS · M2, B5, B6 · 25 contrôles, 25 concordances (le motif du mineur 7
  compris).

## Décisions, avec leur source

- B10 · la décision sur un écart de caisse passe par la fiche de la caisse,
  rapprochée puis arbitrée, comme tout compte · CPCC, étapes 4 et 5
  (`audcif-acte-uniforme/references/pratique-organisation-travaux-inventaire-cpcc.md`,
  § V) ; une campagne sans comptage ne se clôt pas · AUDCIF art. 42
  (« procéder au recensement et à l'évaluation de ses biens, créances et
  dettes »).

- B1 · le redressement d'un manquant arbitré « à la charge de
  l'entreprise » n'a pas de tiers · CPCC, étapes 5 et 6 ; il se reconnaît à
  sa liaison (`EcartInventaire.ecritureId`), jamais au libellé (même parti
  que les écritures de réévaluation et de créance douteuse du contrôle).

- B2 · fiche du compte 67 des deux plans, lue dans les compétences
  (`audcif-acte-uniforme/references/titre-7-comptes-classe-6.md` ;
  `sycebnl/references/partie2-ch3-classe6-comptes60-69.md`) · « Le compte 67
  (sauf 679) est débité des frais dus et des pertes financières constatées,
  par le crédit des comptes de tiers concernés ou des comptes de
  trésorerie » ; éléments de contrôle « Relevés de banque ; décomptes
  d'intérêt ». Le texte ADMET la trésorerie, il n'en fait pas la règle · le
  signal reste, nommé. Le 52 est « Banques » et le 67 « Frais financiers et
  charges assimilées » aux deux semis (`compte-seed.ts`,
  `compte-seed-syscohada.ts`).

- B7 · Code civil, Livre III, art. 154, lu dans la compétence
  (`code-civil-livre-iii-rdc/references/titre-01-des-contrats-ou-des-obligations-conven.md`)
  · « sinon sur la dette échue, quoique moins onéreuse que celles qui ne le
  sont point. Si les dettes sont d'égale nature, l'imputation se fait sur la
  plus ancienne: toutes choses égales, elle se fait proportionnellement »
  (décision par la loi du 2026-10-07, point 4, déjà codée par
  `imputerPaiements`) · la plus
  ancienne se lit à la date de la PIÈCE, jamais à celle du report qui la
  recopie. Une origine incertaine ne se devine pas (même règle que
  `apparierAuReport` et `datesOrigineDesReports`).

- B6 · AUDCIF art. 55 (`audcif-acte-uniforme/references/titre-1-ch4-evaluation-resultat.md`)
  · « À la date de règlement des créances et dettes, les pertes et gains de
  change à cette date sont constatés par rapport à leur coût historique » ·
  l'écart d'un groupe soldé dans sa devise est un gain ou une perte de
  l'entité, pas une créance sur le client ; le geste qui le passe est celui
  de la ligne A6 (« Passer l'écart », `POST /reglements/ecart-change`).

- B5 · aucun texte · l'état reste exact, c'est une règle de restitution
  (AUDCIF art. 22, 1°, lu dans `audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md` ·
  les données « puissent être restituées sur papier ou sous une forme
  directement intelligible ») ; plafond de vingt groupes
  nommés, convention d'OmegaX, le total toujours dit (§ 8 bis).

- B4 · aucun texte du corpus · référence technique WAI-ARIA 1.2 (motif
  « table » · `table`, `rowgroup`, `row`, `columnheader`, `rowheader`,
  `cell`, `aria-colspan`, `aria-colcount`), choisie plutôt qu'un `<table>`
  pour garder le rendu de la grille à l'identique.

- B9 · aucune source ne fixe la fenêtre de dates d'un rapprochement · le
  défaut (15) et la borne (120) sont des conventions d'OmegaX, celles que
  l'écran porte déjà (`RapprochementDetailPage`, champ de 0 à 120).

## Relevés voisins (hors périmètre, non corrigés)

- Inventaire · une campagne MIXTE (fiches d'autres comptes et PV de caisse à
  écart, sans fiche de la caisse) passe à l'arbitrage sans écart de caisse, et
  se clôt avec le manquant du PV jamais décidé.
- Contrôles · la fiche des comptes 62 et 63 admet aussi « le crédit d'un
  compte de tiers ou de trésorerie » ; les frais bancaires (631) prélevés sur
  relevé ne sont pas nommés par CHARGE_SANS_TIERS, alors que la garde des
  modèles de saisie les nomme comme cas légitime. Non touché (B2 vise les
  intérêts).

- Exports · le classeur de la balance âgée et la liasse des notes ne disent
  pas les groupes lus ligne à ligne (B5 ne vise que les écrans).

## Rejeu d'ensemble (vraie base, scénario `scenario-paquet1-b.mjs`)

- AVANT · `main` (/home/user/Comptaflow), base `p1b_avant`, port 8771 ·
  70 contrôles, 43 concordances, 27 écarts, 0 erreur HTTP
  (`/tmp/claude-0/sim/p1b-avant-tout.json`) · B10 (2), B1 (1), B2 (2), B9
  (4), B3 (2), B7 (4), B6 (6), B5 (6) ; B8 concorde (point de tests).
- APRÈS · cette copie compilée, base `p1b_apres`, port 8772 · 70 contrôles,
  70 concordances, 0 écart, 0 erreur HTTP (`/tmp/claude-0/sim/p1b-apres.json`).
- B4 n'a pas de contrôle sur base (écran seul, sans montant).

## Reste

Intégration (hors de cette ligne) · relectures (comptable, échecs
silencieux, TypeScript, React), bloc du § 3 complet des deux côtés, tests
navigateur, puis retrait de cette fiche.

## Commandes de vérification

```bash
npx tsc --noEmit
npx jest src/modules/inventaire src/modules/controles/charge-sans-tiers src/modules/rapprochement src/modules/comptabilite/balance-agee src/modules/exports/balance-agee-export src/modules/lettrage/reste-des-lignes-ouvertes src/modules/relances src/modules/etats-financiers/etats-financiers-smt.service src/modules/etats-financiers-syscohada/etats-financiers-smt-syscohada.service
cd client && npx tsc --noEmit && npx vitest run src/lib/cloture-campagne.spec.ts src/lib/groupes-lus-ligne-a-ligne.spec.ts src/components/GroupesLusLigneALigne.spec.tsx src/components/TableauBalanceAgee.spec.tsx src/pages
```

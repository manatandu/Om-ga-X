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

## Reste

B3, B7, B6, B5, B4, B8 ; puis rejeu APRÈS de tous les points
(`npm run build`, `cd client && npm run build`, puis
`/tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1b p1b_apres 8772 paquet1-b /tmp/claude-0/sim/p1b-apres.json`).

## Commandes de vérification

```bash
npx tsc --noEmit
npx jest src/modules/inventaire src/modules/controles/charge-sans-tiers src/modules/rapprochement
cd client && npx tsc --noEmit && npx vitest run src/lib/cloture-campagne.spec.ts
```

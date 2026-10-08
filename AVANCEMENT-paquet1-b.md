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

## Relevés voisins (hors périmètre, non corrigés)

- Inventaire · une campagne MIXTE (fiches d'autres comptes et PV de caisse à
  écart, sans fiche de la caisse) passe à l'arbitrage sans écart de caisse, et
  se clôt avec le manquant du PV jamais décidé.
- Rapprochement bancaire · une `fenetreJours` énorme (au-delà de ce qu'une
  date peut porter) produit une date invalide et un 500.

## Reste

B2, B9, B3, B7, B6, B5, B4, B8 ; puis rejeu APRÈS de tous les points
(`npm run build`, `cd client && npm run build`, puis
`/tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1b p1b_apres 8772 paquet1-b /tmp/claude-0/sim/p1b-apres.json`).

## Commandes de vérification

```bash
npx tsc --noEmit
npx jest src/modules/inventaire src/modules/controles/charge-sans-tiers
cd client && npx tsc --noEmit && npx vitest run src/lib/cloture-campagne.spec.ts
```

# AVANCEMENT · ligne tva-decisions

Branche de sauvegarde `travail/tva-decisions` (jamais `main`). Fiche retirée à
l'intégration.

## Fait

- (C) Délai de la récupération de TVA d'une créance irrécouvrable · décision
  par la loi du 2026-10-08 (`creances-douteuses/recuperation-tva.ts`,
  `derniereDateEcriture`, refus et message, proposition servie à l'écran).
  Paragraphe A7 bis partie 2 de CLAUDE.md NON retouché (consigne du
  coordinateur · il sera réécrit avec D) · la phrase « après le 31 décembre de
  l'année qui suit » y est à remplacer par la règle ci-dessous à l'intégration.
- (A) Négatif d'une facture (vente et achat) lu au signe près, à la date de la
  facture corrigée ; reprise une fois au premier jour non liquidé, nommée
  (`negatifsDeFactures`) ; liquidation à collecte négative ; facture lettrée
  avec son propre négatif jamais « encaissée » (`datesDuGroupeDeMain`).
- (B) Ligne validée après la liquidation qui devait la lire · rattachée au
  premier jour non liquidé (`rattachementTardif`, `recuperationTardive`),
  nommée (`rattachementsTardifs`). Spec
  `tva/tva-negatifs-et-rattachements-tardifs.spec.ts` (14 cas). Paragraphe
  nouveau de CLAUDE.md après « TVA · le livre-journal seul ».

## Reste

- (D) EN ATTENTE · Manasse a refusé le montant négatif au 651 ; rien codé,
  récupération identique à `main`, paragraphe A7 bis partie 2 intact.
- (E) Liquidation · trop-payé de la première cotisation au débit du 441 par le
  crédit du 8994 (décision de Manasse du 2026-10-08).
- Bloc du § 3 des deux côtés ; scénario sur vraie base.

## Décisions prises, avec leurs articles

### (C) Délai de l'art. 37, al. 2, par le renvoi de l'art. 126

- Le délai COURT de la constatation du non-paiement (décret n° 011/42,
  art. 126, « constatation [...] de non-paiement »), qui tient la place de
  l'exigibilité de l'art. 37, al. 1 (« dans les conditions prévues pour
  exercer le droit à déduction »). OmegaX la constate par la perte validée
  (D 651 / C 416) ; la DERNIÈRE, la récupération ne s'ouvrant qu'à la créance
  éteinte (O.-L. n° 10/001, art. 52, al. 3, « définitivement »). Ni l'envoi du
  duplicata (forme de la rectification, art. 52 al. 3, décret art. 127 al. 2,
  comme la facture de l'art. 38 dont la réception ne déplace pas le délai,
  lecture d'A21), ni l'irrécouvrabilité comme fait distinct.
- Le délai SE JUGE à la déclaration qui inscrit la récupération (art. 37,
  al. 2, « exercé » ; art. 126, « inscrite dans les déductions afférentes à la
  déclaration ») · déclaration mensuelle (décret art. 102), période lue comme
  pour la déchéance de la déduction (`limiteDecheance`). OmegaX l'inscrit au
  mois qui suit son écriture · l'écriture se date au plus tard le 30 novembre
  de l'année qui suit la constatation. La date du geste n'entre pas en compte.

### (A) Négatif d'une facture

- La taxe se déclare pour la période où elle est exigible (O.-L. n° 10/001,
  art. 25) · une vente annulée par inscription en négatif (AUDCIF art. 20,
  al. 2) n'a pas de taxe à porter · le négatif se lit à la date de la facture
  corrigée, dans sa période tant qu'elle n'est pas liquidée.
- Période liquidée · la taxe déclarée se récupère par imputation (art. 52,
  al. 1 ; décret n° 011/42, art. 126, « inscrite dans les déductions »), une
  fois, au premier jour non liquidé à partir du négatif (AUDCIF art. 22, 4°).
  Pour un achat, reprise de la déduction (décret, art. 127). Note de crédit
  (art. 52, al. 2) dite, non exigée (OmegaX ne la voit pas sur un négatif).
- À l'encaissement (art. 25, 2°) · rien n'était exigible, le négatif retire
  de l'attente.

### (B) Ligne validée après une liquidation

- La taxe exigible reste due (art. 25), la déduction s'exerce jusqu'au
  31 décembre de l'année qui suit (art. 37, al. 2), l'avoir s'inscrit dans
  « la déclaration du ou des mois suivants » (décret, art. 126) · rien ne
  tombe parce qu'une déclaration est passée ; une période liquidée ne se
  redéclare pas · rattachement au premier jour non liquidé (AUDCIF art. 22,
  4°), nommé avec la date d'origine. Une liquidation postérieure à la
  validation a vu la ligne · rien ne bouge.

## Commandes de vérification

```bash
npx jest src/modules/creances-douteuses/recuperation-tva.spec.ts
npx jest src/modules/tva
```

## Relevés non bloquants

- Le négatif d'une facture À L'ENCAISSEMENT déjà en partie encaissée · la
  taxe des règlements reste déclarée (figée) ; la restitution au client
  relève de la note de crédit (art. 52, al. 2), non chiffrée.
- Les compteurs descriptifs (biens datés à la facture, services aux débits,
  acomptes imputés) restent lus à la date d'écriture · une ligne rattachée
  tard y figure dans sa période d'origine, pas dans celle qui la déclare.

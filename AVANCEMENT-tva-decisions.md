# AVANCEMENT · ligne tva-decisions

Branche de sauvegarde `travail/tva-decisions` (jamais `main`). Fiche retirée à
l'intégration.

## Fait

- (C) Délai de la récupération de TVA d'une créance irrécouvrable · décision
  par la loi du 2026-10-08 (`creances-douteuses/recuperation-tva.ts`,
  `derniereDateEcriture`, refus et message, proposition servie à l'écran).

## Reste

- (A) Négatif d'une vente (crédit négatif du 443 à taux) lu par la déclaration.
- (B) Facture validée après la liquidation d'une période ultérieure.
- (D) Récupération · D 443 +X / D 651 −X (décision de Manasse du 2026-10-08).
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

## Commandes de vérification

```bash
npx jest src/modules/creances-douteuses/recuperation-tva.spec.ts
```

## Relevés non bloquants

(à compléter)

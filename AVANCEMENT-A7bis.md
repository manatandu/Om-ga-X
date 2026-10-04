# AVANCEMENT · ligne A7 bis, partie 1 (défauts du moteur de TVA)

Branche de sauvegarde · `travail/a7bis`. Partie 2 (récupération de l'art. 52
sur créance irrécouvrable) hors de cette passe.

## Textes lus (compétence fiscalite-rdc, code-general-2026)

- O.-L. n° 10/001, art. 25, 2° · exigibilité « au moment de l'encaissement du
  prix, des acomptes ou avances, pour les prestations de services et les
  travaux immobiliers ».
- O.-L. n° 10/001, art. 26 al. 1 et 3 ; décret n° 011/42, art. 61 et 62 ·
  régime des débits, inchangé.
- O.-L. n° 10/001, art. 37 al. 1 ; décret n° 011/42, art. 96 · la déduction
  naît à l'exigibilité chez le fournisseur.
- Décret n° 011/42, art. 52 (troisième tiret, même règle) et art. 57
  (« l'encaissement s'entend de la perception des sommes [...] notamment
  avances, acomptes et règlement pour solde »).

## Fait

- (1) `exigibilite` · une créance (ou dette) non lettrée n'est plus un
  comptant ; part réglée dans l'écriture (classe 5) ou imputée sur 419 / 409
  exigible à sa date, le reste en attente. Symétrique côté déduction.
- (2) une tranche par règlement dans un groupe à une seule facture (B-2).
- Créance de N réglée en N+1 par sa ligne d'à-nouveau (`relierAuxANouveaux`).
- Mémoire · `LiquidationTva.tvaEncaissementFigee` (migration
  20270136000000, diff vide), `repartirEncaissement` (période liquidée =
  son figé ; report une fois au premier jour libre ; trop-déclaré absorbé).
- TRANSITION (décision écrite) · figé `null` = ancien moteur · ligne non
  lettrée à l'instant de la liquidation réputée déclarée EN ENTIER à la
  facture ; sinon aux dates de ses règlements.
- Tests · `tva-encaissement-a7bis.spec.ts` (20 cas chiffrés),
  `tva-exigibilite.spec.ts` adapté (deux acomptes), mocks complétés ;
  `e2e/tests/tva-encaissement.e2e.ts`.
- Vraie base `a7bis_1`, serveur compilé, clôture 2026 traversée · tous les
  montants attendus retrouvés (voir rapport).

## Reste (hors partie 1)

- Partie 2 · art. 52 sur créance irrécouvrable ; TVA du recouvrement d'une
  créance reclassée (D trésorerie / C 416, lettré à aucune facture, reste
  en attente) ; groupes facture-reclassement déjà posés (le reclassement y
  est lu comme un règlement).
- Limites dites · compte au mode SOLDE réglé après la clôture (aucun lien
  facture / à-nouveau) ; groupe défait puis refait après une liquidation
  de l'ancien moteur ; ligne ajoutée par « compléter » à un groupe né avant
  une liquidation de l'ancien moteur.

## Vérification

```
npx tsc --noEmit && npx jest --maxWorkers=2 src/modules/tva
```

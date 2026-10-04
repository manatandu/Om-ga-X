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

(à remplir au fil des étapes)

## Reste

- (1) prestation non lettrée = comptant · à corriger.
- (2) acomptes à la fraction cumulée · à corriger (B-2 seule).
- Transition des liquidations antérieures.
- Rejeu sur vraie base à travers une clôture.

## Vérification

```
npx tsc --noEmit && npx jest --maxWorkers=2 src/modules/tva
```

# AVANCEMENT · ligne A5 ter

Branche de sauvegarde `travail/a5ter`, partie de `main` 7e4aaa4. Fiche retirée
à l'intégration.

## Périmètre

Ligne A5 ter de `docs/suivi-immobilisations-verrouille.md`, plus les relevés
d'A5 bis renvoyés vers elle.

1. SYCEBNL · risque de change à moins d'un an hors du 194.
2. Titres de placement (50) et titres immobilisés (274) hors réévaluation.
3. Subdivisions 478 / 479 au SYCEBNL.
4. Le 54 en 4786 / 4797.
5. Message d'annulation dont l'issue ne lève rien.
6. Relevés d'A5 bis · (a) L1 et la contre-passation déjà juste ; (b) L1
   borné à l'exercice cible ; (c) contre-passation déclarée et
   `reevaluation-et-ecart-realise.ts` ; (d) contrôle 32 et OD déclarée qui
   inverse la banque ; (e) contre-passation sans à-nouveau qui fait foi.

## Fait

(rempli au fil des commits)

## Décisions, avec leur article

(rempli au fil des commits)

## Reste

Tout.

## Vérification

```bash
npx tsc --noEmit
npx jest src/modules/devises src/modules/controles
cd client && npx tsc --noEmit && npx vitest run
```

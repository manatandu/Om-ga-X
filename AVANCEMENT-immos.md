# Avancement · ligne immos

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4) ·
fonctions 65, 69, 70, 71, 72 du tri (`docs/comparaison-sage/15-absents-a-trier.md`).
Branche de sauvegarde `travail/immos`, partie de `origin/main`.

## Fait

- **71 · numéro de série** · `Immobilisation.numeroSerie` et
  `FicheInventaire.numeroSerie` (migration `20270210000100_numero_serie_biens`) ;
  champ libre de la fiche (modifiable à tout moment, bien sorti compris), jamais
  repris par la duplication ni par la création enchaînée de l'assistant ; recopié
  sur la fiche de comptage engendrée, complété sur une fiche ancienne qui n'en
  porte pas, jamais sur une saisie (même règle que le lieu).
- **72 · simulation des dotations** · `simulation-dotations.ts`,
  `ImmobilisationService.simulerDotations`, `GET /immobilisations/simulation-dotations`,
  écran `SimulationDotations` (onglet Opérations). Même moteur que la dotation
  (`calculerDotation`, mêmes arguments) ; dotation déjà passée lue au journal ;
  unités d'œuvre sans relevé · annuité `null`, jamais zéro, comptée au total.

## Reste

- 70 · analytique des biens (section sur la fiche ou la famille, dotation ventilée).
- 69 · sortie globale de plusieurs biens.
- 65 · quantité d'un bien, cession d'une partie des unités.
- Rejeu sur vraie base à travers une clôture ; relecture adverse.

## Décisions et fondements

- 71 · information de fiche, sans effet comptable (AUDCIF art. 42, recensement ;
  fiche d'inventaire du CPCC, étape 1). Codes-barres et étiquettes écartés (plan).
- 72 · aucun texte ne régit une prévision · seule règle, le moteur du plan
  (sinon une annuité annoncée que la dotation ne passerait pas). Périodes · les
  exercices du dossier qui s'enchaînent, puis des années fictives de douze mois
  (AUDCIF art. 7). Un à quinze exercices, cinq par défaut (convention d'OmegaX).

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

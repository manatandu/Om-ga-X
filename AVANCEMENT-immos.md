# Avancement · ligne immos

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4) ·
fonctions 65, 69, 70, 71, 72 du tri (`docs/comparaison-sage/15-absents-a-trier.md`).
Branche de sauvegarde `travail/immos`, partie de `origin/main`.

## Fait

- **71 · numéro de série** · `Immobilisation.numeroSerie`, `FicheInventaire.numeroSerie`
  (migration `20270210000100`) ; champ libre ; jamais repris par la duplication ni par
  la création enchaînée ; recopié sur la fiche de comptage, complété sur une fiche
  ancienne, jamais sur une saisie.
- **72 · simulation des dotations** · `simulation-dotations.ts`,
  `GET /immobilisations/simulation-dotations` · même moteur que la dotation ; dotation
  passée lue au journal ; années fictives de douze mois ; unités d'œuvre sans relevé
  non calculées (`null`), comptées au total.
- **70 · analytique des biens** · section sur la fiche ou la famille (migration
  `20270210000200`, `analytique-des-biens.ts`) ; la fiche prime ; dotation et complément
  de sortie ventilés ; section devenue impropre · dotation non ventilée, dite.
- **69 · sortie globale** · `sortie-globale.ts`, `POST /immobilisations/sortie-globale` ·
  chaque bien jugé par la sortie simulée avant le premier geste (`simulerSortie`), une
  écriture par bien sous la pièce commune, tout ou rien.
- **65 · quantité et sortie d'une partie des unités** · `Immobilisation.quantite`,
  `fractionDeId`, `NatureMouvementDepreciation.CESSION_PARTIELLE` (migration
  `20270210000300`), `cession-partielle.ts`, `POST /immobilisations/:id/sortie-partielle`.
- Rejeu sur vraie base à travers la clôture de 2025 · `scripts/rejouer-immos.cjs`, vert.

## Décisions et fondements

- 71 · information de fiche (AUDCIF art. 42, recensement). Codes-barres et étiquettes
  écartés (plan).
- 72 · aucun texte ne régit une prévision · seule règle, le moteur du plan. Un à quinze
  exercices, cinq par défaut (convention d'OmegaX).
- 70 · « l'usage des comptes 92 à 99 est laissé à l'initiative des entités » (AUDCIF
  Titre VII ; SYCEBNL Partie 2 ch. 3, classe 9) · une option de travail. Une section par
  bien ; une répartition entre projets reste à la main. Section de famille · geste nommé,
  administrateur (la famille ne se saisit plus, décision du 2026-10-01).
- 69 · une pièce justificative pour le lot (fiche du compte 81, éléments de contrôle ;
  AUDCIF art. 17, 3° et 5°), une écriture par bien (`ecritureSortieId` unique). Prix de
  cession par bien, aucune clé devinée. Le matériel récupéré sort bien par bien.
- 65 · lecture d'OmegaX · des unités IDENTIQUES ont chacune 1/n de la valeur d'entrée,
  des amortissements et de la dépréciation (fiche du compte 81 · « éléments sortis »).
  Fractionnement puis sortie ordinaire des unités ; complément = part du complément du
  LOT (imposé) ; dépréciation de la part reprise sur le lot (D 29 / C 79), qui ré-étale
  le lot dès l'exercice ; le lot garde la différence exacte (dernière unité). Refus nommés ·
  composant, unités d'œuvre, dérogatoire, fonds ou subvention, réévaluation, location-
  acquisition, prix aléatoire, démantèlement, dotation de l'exercice déjà passée,
  exercice antérieur ouvert non doté, seconde reprise de dépréciation dans l'exercice.

## Reste

- Quantité sur la fiche de comptage de l'inventaire physique · non servie.
- Une sortie partielle ne s'annule pas (comme toute sortie dans OmegaX).
- Les cas refusés de la sortie partielle se passent à la main.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
DATABASE_URL=postgresql://…locale… node scripts/rejouer-immos.cjs   # base jetable migrée
```

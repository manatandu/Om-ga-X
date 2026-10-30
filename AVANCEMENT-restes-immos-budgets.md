# Avancement · ligne restes-immos-budgets

Gel levé expressément par Manasse le 2026-10-30 pour ces restes (CLAUDE.md § 5).
Branche de sauvegarde `travail/restes-immos-budgets`, partie de `origin/main`.

## Fait

1. **Report des budgets par compte** (`analytique/budget-compte.ts`,
   `planDuReportBudgetsComptes` ; `BudgetsComptesService.reporter` ;
   `GET` et `POST /analytique/budgets-comptes/report?exerciceId=` ; écran
   Budgets des comptes, onglet Dotation). Convention d'OmegaX, au modèle du
   report des budgets des sections (Sage i7) · un compte déjà doté en N+1
   n'est jamais écrasé ni complété (jugé ENTIER) ; rien n'est proratisé, deux
   exercices aux mois différents ne se reportent pas (AUDCIF art. 7) ; compte
   en sommeil ou subdivisé nommé et sauté (`motifCompteHorsSaisie`) ;
   exercice suivant contigu (AUDCIF art. 34 ; SYCEBNL art. 16, 4°) et ouvert.
   Rejoué sur vraie base à travers la clôture de 2025.

2. **Quantité du bien sur la fiche de comptage** (`FicheInventaire.quantiteAttendue`,
   migration `20270241000000` ; `inventaire/ecart-en-unites.ts`). Recopiée du
   registre (`Immobilisation.quantite`) quand les fiches s'engendrent, comme le
   numéro de série, et sur une fiche ancienne NON comptée seulement ; écart en
   unités servi par `GET /inventaire/:id` (manquant, conforme, excédent), une
   fraction d'unité refusée ; aucun excédent créé (AUDCIF art. 43, la valeur
   d'entrée maintenue), aucun manquant passé d'office (CPCC, étapes 4 et 5).

3. **Annulation d'une sortie, entière ou partielle** (`immobilisations/annulation-sortie.ts`,
   `AnnulationSortieService`, `GET :id/annulation-sortie`, `POST :id/annuler-sortie`,
   migration `20270242000000`). AUDCIF art. 20, al. 2 et 3 ; art. 22, 2° et 4° ·
   brouillard retiré, validé inscrit en négatif, jamais dans un exercice clos ;
   fiche rendue (lot rendu au centime pour une partielle, fiche des unités
   retirée) ; refus nommés (transfert, échange, renouvellement, lettrée ou
   pointée, détenteur tiers, acte postérieur, sortie ancienne indistincte).
   L'onglet Traitements renvoie désormais à « Annuler la sortie ». Rejoué sur
   vraie base · brouillard puis validée, entière puis partielle, à travers la
   clôture de 2025.

4. **Cas refusés de la sortie partielle, tranchés par la loi** (`cession-partielle.ts`,
   en tête, chaque décision avec son article ; migration `20270243000000`).
   Servis · composant en lot (AUDCIF Titre VIII ch. 4 § 3.1.4), seconde reprise
   de dépréciation du même exercice (fiche du compte 81, exclusions). Gardés ·
   principal à composants en service (ch. 4 § 1), unités d'œuvre (art. 45),
   dégressif et dérogatoire (loi n° 23/053, art. 31 à 35), fonds ou subvention
   (ch. 17), réévaluation (ch. 28 § 6), location-acquisition, prix aléatoire,
   démantèlement, dotation de l'exercice déjà passée (fiche du compte 81),
   exercice antérieur ouvert non doté. Rejoué sur vraie base.

Relecture adverse, deux tours · la fiche de comptage relit la quantité d'un
lot réduit depuis tant qu'elle n'est pas comptée ; l'annulation d'une sortie
partielle ferme la fiche des unités, qui n'existe plus ; la défaite d'une
sortie lâche les liaisons de la fiche AVANT de retirer ses écritures (RESTRICT).

Relecture indépendante (2026-10-30) · l'annulation d'une sortie refuse
désormais un bien dont l'option de location-acquisition est déclarée (voie
sûre · la déclaration, faite une fois, n'est pas remise à nul, § 2.1.9), un
composant dont le principal est sorti, une réévaluation de l'exercice datée au
plus tôt de la sortie, un matériel récupéré consommé depuis (388 ou 378) ; la
lecture juge ce que le geste opposait seul (fiche des unités encore visée,
reprise du lot introuvable, écriture déjà corrigée), les détenteurs lus par la
transaction ; l'issue dite est celle de l'acte postérieur le plus récent ; la
fiche comptée dit que le registre a changé depuis ; le report des budgets ne
relit que les comptes verrouillés.

## Reste

Intégration sur `main` (non faite, à la demande). Limites écrites · l'édition
du procès-verbal d'inventaire ne porte pas encore la quantité attendue ; une
sortie ENTIÈRE ne refuse pas un exercice antérieur ouvert non doté (la partielle
le refuse), relevé pour le suivi.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
DATABASE_URL=postgresql://<base jetable> node scripts/rejouer-restes-immos-budgets.cjs
```

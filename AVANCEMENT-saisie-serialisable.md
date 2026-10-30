# Avancement · ligne saisie-serialisable

Demande de Manasse du 2026-10-30 · traiter les conflits de sérialisation
résiduels de la saisie (test de charge § 4.4). Branche de sauvegarde
`travail/saisie-serialisable`, partie de `origin/main` (`4bfee8e42`).

## Mesure avant correction

`scripts/rejouer-saisie-concurrente.cjs`, serveur compilé bridé (un cœur,
460 Mio, pool de 10), PostgreSQL 16 local, base jetable neuve, deux lancements.

| | lancement 1 | lancement 2 |
|---|---|---|
| 1. vingt dossiers saisissent ensemble, 15 pièces chacun une à une | 296 × 201, **4 × 409** | 293 × 201, **7 × 409** |
| échecs de sérialisation vus par PostgreSQL (rejeux du serveur) | 282 | 275 |
| p95 | 2,5 s | 2,9 s |
| 2. même dossier, même journal, 30 au même instant | 29 × 201, 1 × 409 | 30 × 201 |
| 3. même dossier, cinq journaux, 30 au même instant | 30 × 201 | 30 × 201 |
| 4. modifications, vingt dossiers | 100 × 200 (55 rejeux) | 100 × 200 (22 rejeux) |
| 5xx, doublon ou trou de numéro | 0, 0, 0 | 0, 0, 0 |

Chaque 409 de la mesure 1 oppose des dossiers SANS RAPPORT · chacun saisit ses
pièces une à une, aucun dossier n'a deux saisies en vol.

## Classement · MAJEUR

Un geste juste (une pièce saisie seule dans son dossier) est refusé à cause
d'un AUTRE dossier, de 1,3 à 2,3 % des fois après les huit tentatives du
serveur, avec près d'un rejeu par saisie et un p95 de trois secondes. L'issue
existe (409 `CONFLIT_SERIALISATION`, rejoué par l'interface), d'où MAJEUR et
non BLOQUANT · aucun montant faussé, aucune séquence rompue.

## Correction (faite, commit `cd695d303` et suivants)

- `common/transaction-de-saisie.ts` · READ COMMITTED, verrou du dossier pris en
  PREMIER, lignes des exercices ouverts réécrites aussitôt (les transactions
  restées sérialisables · clôture, à-nouveaux, dissolution · tombent en 40001
  sur une saisie validée après leur image). Employée par `creerPlusieursAvec`
  (donc `creer`, `creerAvec`), `modifier`, `transfererDansUnJournalOrdinaire`,
  `reimputer`, `corrigerParInscriptionEnNegatif`, et les cinq gestes des titres
  et opérations de trésorerie (qui suivaient l'isolation de `creerAvec`).
- `numerotation-piece.ts` · le numéro se lit sous le verrou du dossier et la
  ligne de son exercice, quelle que soit l'isolation de l'appelant (imports,
  Groupe, devises, en lecture validée depuis toujours, compris).
- Caisse provisionnée jugée DANS la transaction (création, modification).
- Clôture · le brouillard relu DANS sa transaction (trouvé par la mesure 6 · la
  reprise après 40001 clôturait avec dix pièces au brouillard).

## Mesure après correction

| | vingt dossiers (deux lancements) | soixante dossiers |
|---|---|---|
| 1. entre dossiers | 300 × 201 / 300, 0 rejeu | 900 × 201 / 900, 0 rejeu |
| 2. même journal, rafale | 30 × 201 | 60 × 201 |
| 3. cinq journaux, rafale | 30 × 201 | 60 × 201 |
| 4. modifications | 100 × 200 | 300 × 200 |
| 6. clôture et vingt saisies ensemble | clôture refusée (brouillard), aucune pièce au brouillard dans un exercice clos | idem |
| 5xx, doublon, trou | 0, 0, 0 | 0, 0, 0 |

`scripts/rejouer-cloture-contre-lettrage.cjs` · la marque fait toujours tomber
la clôture sérialisable en 40001 (PREUVE VERTE).

## Relecture indépendante (2026-10-30) · quatre majeurs, cinq mineurs

Fusion d'`origin/main` (`c6215eb46`), puis commit `3645563e0` et suivants.

1. Un seul ordre de verrous · le dossier puis les lignes (validation par
   période, visa, pièces jointes, ventilation) · `prendreLeVerrouDuDossierBorne`.
2. Retraits de brouillard des modules au filtre des lignes libres (onze
   sites), pointage, confirmation, dissociation, annulation d'un rapprochement
   et délettrage d'héritage sous le verrou.
3. Clôture, à-nouveaux provisoires, dissolution, rapprochement · lecture
   validée sous le verrou du dossier. Mesure 7 · avant, 409 après huit
   reprises ; après, 201 en 375 à 464 ms. Plus aucune transaction sérialisable,
   plus de marque des exercices.
4. Le numéro relit l'exercice ouvert sous le verrou dans tous les modes,
   MANUELLE comprise, lot d'import compris.
5. Liasse du groupe · numéro et pièces dans une transaction.
6. Correction en négatif relue sous le verrou, P2002 rendu en 409 (mesure 8).
7. Clôture de période relue dans la transaction de saisie (mesure 9).
8. `lock_timeout` borné au seul verrou du dossier ; message `DOSSIER_OCCUPE`
   qui nomme la validation par période et l'import.
9. Commentaire de `lignes-libres.ts` remis au vrai.

Comparaison locale `main` / branche, 20 dossiers × 20 pièces · p50 762 à 869
contre 846 à 865 ms, p95 2,2 à 2,3 s contre 1,1 s, 5 et 6 refus contre 0.

## Reste

- Banc `charge-k6.yml` à relancer sur la branche corrigée.
- Intégration sur `main` non faite (demande).

## Commandes de vérification

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/<base jetable> node scripts/rejouer-saisie-concurrente.cjs
DIST=<build de main> ... node scripts/rejouer-saisie-concurrente.cjs   # comparaison
```

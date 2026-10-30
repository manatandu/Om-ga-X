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

## Correction (en cours)

- `common/transaction-de-saisie.ts` · READ COMMITTED, verrou du dossier pris en
  PREMIER, lignes des exercices ouverts réécrites aussitôt (les transactions
  restées sérialisables · clôture, à-nouveaux, dissolution · tombent en 40001
  sur une saisie validée après leur image).
- `numerotation-piece.ts` · le numéro se lit sous le verrou du dossier et la
  ligne de son exercice, quelle que soit l'isolation de l'appelant.

## Commandes de vérification

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/<base jetable> node scripts/rejouer-saisie-concurrente.cjs
```

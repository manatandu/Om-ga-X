# Requêtes de production du paquet 1

Ce document rassemble les requêtes que le paquet 1 laisse à jouer sur la base de
production. Aucune session ne les joue · la production n'est touchée que par
Manasse (CLAUDE.md, § 5). Chaque requête a d'abord été éprouvée sur une base
jetable, à travers une clôture (CLAUDE.md, § 10).

Toutes se jouent sur l'endpoint DIRECT (`API_DATABASE_URL`), jamais sur
l'endpoint poolé, et la chaîne de connexion ne s'affiche ni ne se recopie
nulle part (CLAUDE.md, § 4).

## R1 · provisions rattachées à l'exercice d'un autre dossier (ligne C)

Avant le paquet 1, une provision pour risques et charges pouvait être créée
avec l'exercice d'un autre dossier, la route ne jugeant pas l'appartenance de
l'`exerciceId` reçu. La porte est fermée (porteurs injectables, 404 nommé avant
toute lecture). Restent les lignes déjà écrites, s'il y en a.

1. Compter. Si le résultat est zéro, il n'y a rien à faire.

   ```sql
   SELECT count(*)
   FROM provisions_risques_charges p
   JOIN exercices e ON e.id = p."exerciceId"
   WHERE e."tenantId" <> p."tenantId";
   ```

2. Lire les lignes et en garder une copie avant tout changement. Une ligne qui
   porte un travail réel (montants non nuls, statut `COMPTABILISEE`) est
   montrée à Manasse avant la purge.

   ```sql
   SELECT p.id, p."tenantId", p."exerciceId", e."tenantId" AS "tenantIdDeLExercice",
          p.objet, p.nature, p.statut, p."compteId", p."montantOuverture",
          p."dotationsExercice", p."createdAt", p."createdBy"
   FROM provisions_risques_charges p
   JOIN exercices e ON e.id = p."exerciceId"
   WHERE e."tenantId" <> p."tenantId";
   ```

3. Purger dans une transaction, relire, puis valider ou défaire.

   ```sql
   BEGIN;
   DELETE FROM provisions_risques_charges p
   USING exercices e
   WHERE e.id = p."exerciceId" AND e."tenantId" <> p."tenantId";
   -- La requête 1, rejouée ici, doit rendre 0.
   ```

   `COMMIT` si le nombre de lignes supprimées est celui de l'étape 2, sinon
   `ROLLBACK`.

4. Le journal d'audit n'est pas retouché · la purge est consignée au suivi,
   avec la copie de l'étape 2.

Éprouvée sur la base jetable du banc (scénario S6, `PURGE_R1`).

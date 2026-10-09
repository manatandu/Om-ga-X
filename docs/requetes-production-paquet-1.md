# Requêtes de production du paquet 1

Ce document rassemble les requêtes que le paquet 1 laisse à jouer sur la base de
production. Aucune session ne les joue · la production n'est touchée que par
Manasse (CLAUDE.md, § 5). Chaque requête a d'abord été éprouvée sur une base
jetable, à travers une clôture (CLAUDE.md, § 10).

AUCUNE NE MONTRE UNE DONNÉE D'UN CLIENT (décision de Manasse du 2026-10-09 ·
« VMG ne doit pas voir les informations du client, c'est confidentiel et non
discutable »). Elles rendent des IDENTIFIANTS, des dates et des NOMBRES · ni
montant, ni compte, ni objet, ni motif, ni nom de dossier. Ce qui doit être
gardé avant une purge est copié DANS la base, sans être lu à l'écran. La
correction d'un dossier se fait par le CLIENT, dans son dossier, à qui l'on
transmet l'identifiant de la pièce concernée.

Toutes se jouent sur l'endpoint DIRECT (`API_DATABASE_URL`), jamais sur
l'endpoint poolé, et la chaîne de connexion ne s'affiche ni ne se recopie
nulle part (CLAUDE.md, § 4).

LES LECTURES SE LANCENT DEPUIS GITHUB (décision de Manasse du 2026-10-09) ·
le workflow `requetes-production.yml`, à la main seulement, joue les blocs
marqués `requete-r1-lecture`, `requete-m5` et `requete-m5-conserver` de ce
document, tels quels, sur une session ouverte en LECTURE SEULE
(`default_transaction_read_only`), après avoir refusé tout bloc qui ne
s'ouvre pas en lecture seule ou qui nomme un ordre d'écriture. La purge de R1
(étapes 2 et 3) reste un geste de Manasse, après lecture du décompte.

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

   Le workflow manuel `requetes-production.yml` joue ce décompte, et celui de
   l'étape 2 par dossier, sans la copie, en lecture seule · le bloc ci-dessous,
   tel quel.

<!-- requete-r1-lecture · le workflow requetes-production.yml exécute ce bloc tel quel -->
```sql
-- R1 · LECTURE SEULE · provisions rattachées à l'exercice d'un autre dossier,
-- le total puis le décompte par dossier (étapes 1 et 2, sans la copie).
-- Identifiants et nombres seulement. Transaction en lecture seule, annulée.
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS lignes_rattachees_a_un_autre_dossier
FROM provisions_risques_charges p
JOIN exercices e ON e.id = p."exerciceId"
WHERE e."tenantId" <> p."tenantId";
SELECT p."tenantId" AS dossier_id,
       count(*) AS lignes,
       count(*) FILTER (WHERE p.statut = 'COMPTABILISEE'
                         OR p."montantOuverture" <> 0 OR p."dotationsExercice" <> 0) AS lignes_avec_travail
FROM provisions_risques_charges p
JOIN exercices e ON e.id = p."exerciceId"
WHERE e."tenantId" <> p."tenantId"
GROUP BY p."tenantId"
ORDER BY dossier_id;
ROLLBACK;
```

2. Garder une copie DANS la base, sans la lire, puis compter par dossier. La
   copie permet de rendre une ligne si un client la réclame ; elle se
   supprime une fois la purge consignée. Le décompte dit seulement combien de
   lignes portent un travail (un montant non nul ou le statut
   `COMPTABILISEE`), jamais lequel.

   ```sql
   CREATE TABLE copie_r1_provisions AS
   SELECT p.*
   FROM provisions_risques_charges p
   JOIN exercices e ON e.id = p."exerciceId"
   WHERE e."tenantId" <> p."tenantId";

   SELECT "tenantId" AS dossier_id,
          count(*) AS lignes,
          count(*) FILTER (WHERE statut = 'COMPTABILISEE'
                            OR "montantOuverture" <> 0 OR "dotationsExercice" <> 0) AS lignes_avec_travail
   FROM copie_r1_provisions
   GROUP BY "tenantId";
   ```

   Un dossier qui a des lignes avec travail est prévenu par son identifiant ·
   c'est son administrateur qui ressaisit la provision dans son exercice.

3. Purger dans une transaction, relire, puis valider ou défaire.

   ```sql
   BEGIN;
   DELETE FROM provisions_risques_charges p
   USING exercices e
   WHERE e.id = p."exerciceId" AND e."tenantId" <> p."tenantId";
   -- La requête 1, rejouée ici, doit rendre 0.
   ```

   `COMMIT` si le nombre de lignes supprimées est celui de la copie de
   l'étape 2, sinon `ROLLBACK`.

4. Le journal d'audit n'est pas retouché · la purge est consignée au suivi,
   par le décompte de l'étape 2, jamais par le contenu des lignes.

Éprouvée sur la base jetable du banc (scénario S6, `PURGE_R1`).

## R2 · dossiers clôturés sur l'ancien code par « Rectifier » ou « Conserver » sur une contre-passation (ligne A, m5)

Avant le paquet 1, la clôture de N lisait la contre-passation d'une
réévaluation des devises passée au premier jour de N+1 (celle du module, ou
une OD faite à la main et déclarée) comme une ouverture divergente, et
n'ouvrait que deux issues. « Rectifier » l'inscrivait en négatif dans le
report de N+1 · l'écart latent revenait au 478 ou au 479 et le tiers à la
valeur réévaluée, balance bouclée. « Conserver » ne passait aucun report ·
si la contre-passation était la seule écriture du premier jour, N+1 s'est
ouvert sans bilan d'ouverture. La source est fermée (ligne A, A8 et m4) ;
reste le stock des clôtures déjà passées. Les deux requêtes ci-dessous ne
modifient rien · elles tournent dans une transaction en LECTURE SEULE,
annulée à la fin (une écriture y est refusée par la base).

1. « Rectifier ». Une ligne par dossier · l'exercice N+1 rectifié, la pièce du
   report, la voie (MODULE, DECLAREE, ou DECLAREE (retirée)) et le NOMBRE de
   lignes de la contre-passation annulées, sans leurs comptes ni leurs
   montants. Limite · une ligne d'import de même compte et de même montant
   qu'une ligne de la contre-passation la ferait sortir aussi ; c'est le
   client qui relit le report dans son dossier.

<!-- requete-m5 · le scénario du banc (point m5) exécute ce bloc tel quel -->
```sql
-- m5 · LECTURE SEULE · reports de clôture rectifiés qui ont inscrit en négatif
-- une contre-passation de réévaluation (module, déclarée, ou déclarée puis
-- retirée). Une ligne par report et par réévaluation. Transaction en lecture
-- seule, annulée à la fin · rien ne peut s'écrire.
BEGIN TRANSACTION READ ONLY;
WITH negatifs AS (
  SELECT rep.id AS report_id, rep."tenantId" AS tenant_id, rep."exerciceId" AS exercice_id,
         l.id AS ligne_id, l."compteId" AS compte_id, l.debit, l.credit
  FROM ecritures rep
  JOIN lignes_ecriture l ON l."ecritureId" = rep.id
  WHERE rep."estGenereeParCloture" = true
    AND rep."estSoldeDesComptesDeGestion" = false
    AND rep."motifCorrection" IS NOT NULL
    AND (l.debit < 0 OR l.credit < 0)
),
contre_passations AS (
  SELECT r.id AS reevaluation_id, r."tenantId" AS tenant_id, 'MODULE' AS voie,
         x.id AS ecriture_id, x."exerciceId" AS exercice_id,
         lx."compteId" AS compte_id, lx.debit, lx.credit
  FROM reevaluations r
  JOIN ecritures x ON x.id = r."ecritureExtourneId"
  JOIN lignes_ecriture lx ON lx."ecritureId" = x.id
  WHERE r."annuleeLe" IS NULL
  UNION ALL
  SELECT r.id, r."tenantId", 'DECLAREE',
         x.id, x."exerciceId",
         lx."compteId", lx.debit, lx.credit
  FROM reevaluations r
  JOIN ecritures x ON x.id = r."contrePassationDeclareeId"
  JOIN lignes_ecriture lx ON lx."ecritureId" = x.id
  JOIN comptes cx ON cx.id = lx."compteId"
  WHERE r."annuleeLe" IS NULL
    AND cx.numero !~ '^(52|53|55|57|58)'
    AND EXISTS (SELECT 1 FROM lignes_ecriture le
                WHERE le."ecritureId" = r."ecritureEcartsId" AND le."compteId" = lx."compteId")
  UNION ALL
  -- La déclaration RETIRÉE après la clôture (quatrième tour, m3) · la trace
  -- garde l'écriture (`retraitsContrePassationDeclaree`), qui reste au journal.
  SELECT r.id, r."tenantId", 'DECLAREE (retirée)',
         x.id, x."exerciceId",
         lx."compteId", lx.debit, lx.credit
  FROM reevaluations r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r."retraitsContrePassationDeclaree") = 'array'
         THEN r."retraitsContrePassationDeclaree" ELSE '[]'::jsonb END) AS tr(e)
  JOIN ecritures x ON x.id = tr.e->>'ecritureId'
  JOIN lignes_ecriture lx ON lx."ecritureId" = x.id
  JOIN comptes cx ON cx.id = lx."compteId"
  WHERE r."annuleeLe" IS NULL
    AND x.id IS DISTINCT FROM r."contrePassationDeclareeId"
    AND cx.numero !~ '^(52|53|55|57|58)'
    AND EXISTS (SELECT 1 FROM lignes_ecriture le
                WHERE le."ecritureId" = r."ecritureEcartsId" AND le."compteId" = lx."compteId")
)
SELECT n.tenant_id AS dossier_id,
       ex."dateDebut"::date AS exercice_ouvert_le,
       rep.id AS report,
       rep."numeroPiece" AS piece_du_report,
       cp.voie,
       cp.reevaluation_id,
       cp.ecriture_id AS contre_passation,
       count(DISTINCT n.ligne_id) AS lignes_inscrites_en_negatif
FROM negatifs n
JOIN contre_passations cp
  ON cp.tenant_id = n.tenant_id AND cp.exercice_id = n.exercice_id AND cp.compte_id = n.compte_id
 AND cp.debit = -n.debit AND cp.credit = -n.credit
JOIN ecritures rep ON rep.id = n.report_id
JOIN exercices ex ON ex.id = n.exercice_id
GROUP BY n.tenant_id, ex."dateDebut", rep.id, rep."numeroPiece", cp.voie, cp.reevaluation_id, cp.ecriture_id
ORDER BY dossier_id, exercice_ouvert_le;
ROLLBACK;
```

2. « Conserver ». Ne rend que la contre-passation datée ou valorisée au premier
   jour et SEULE ce jour-là.

<!-- requete-m5-conserver · le scénario du banc (point m5) exécute ce bloc tel quel -->
```sql
-- m5, jumeau · LECTURE SEULE · exercices dont la clôture a CONSERVÉ une
-- ouverture du suivant qui n'était QUE la contre-passation de leur
-- réévaluation (module, déclarée, ou déclarée puis retirée), datée ou
-- valorisée au premier jour, sans aucune autre écriture d'ouverture ce
-- jour-là (même périmètre que la clôture sur `main` · à-nouveau ou opérations
-- diverses, hors report provisoire, hors solde des comptes de gestion, sans
-- compte de gestion). Une autre écriture d'ouverture au premier jour, la
-- conservation a pu viser l'écart de celle-ci · écartée, sans quoi un import
-- conservé à bon droit sortirait. Transaction en lecture seule, annulée.
BEGIN TRANSACTION READ ONLY;
WITH contre_passations AS (
  SELECT r.id AS reevaluation_id, r."tenantId" AS tenant_id, r."exerciceId" AS exercice_id,
         'MODULE' AS voie, r."ecritureExtourneId" AS ecriture_id
  FROM reevaluations r
  WHERE r."annuleeLe" IS NULL AND r."ecritureExtourneId" IS NOT NULL
  UNION ALL
  SELECT r.id, r."tenantId", r."exerciceId", 'DECLAREE', r."contrePassationDeclareeId"
  FROM reevaluations r
  WHERE r."annuleeLe" IS NULL AND r."contrePassationDeclareeId" IS NOT NULL
  UNION ALL
  SELECT r.id, r."tenantId", r."exerciceId", 'DECLAREE (retirée)', tr.e->>'ecritureId'
  FROM reevaluations r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r."retraitsContrePassationDeclaree") = 'array'
         THEN r."retraitsContrePassationDeclaree" ELSE '[]'::jsonb END) AS tr(e)
  WHERE r."annuleeLe" IS NULL
    AND (tr.e->>'ecritureId') IS DISTINCT FROM r."contrePassationDeclareeId"
)
SELECT DISTINCT
       cp.tenant_id AS dossier_id,
       n."dateFin"::date AS exercice_clos_le,
       cp.reevaluation_id,
       cp.voie,
       x.id AS contre_passation
FROM contre_passations cp
JOIN exercices n ON n.id = cp.exercice_id
JOIN ecritures x ON x.id = cp.ecriture_id
JOIN exercices n1 ON n1.id = x."exerciceId" AND n1."dateDebut" > n."dateFin"
WHERE n."motifOuvertureSuivanteConservee" IS NOT NULL
  AND (x.date = n1."dateDebut" OR x."dateValeur" = n1."dateDebut")
  AND NOT EXISTS (
    SELECT 1
    FROM ecritures o
    JOIN journaux j ON j.id = o."journalId"
    WHERE o."exerciceId" = n1.id
      AND o.id <> x.id
      AND (o.date = n1."dateDebut" OR o."dateValeur" = n1."dateDebut")
      AND o."estANouveauProvisoire" = false
      AND o."estSoldeDesComptesDeGestion" = false
      AND (o."estGenereeParCloture" = true OR j.type = 'GENERAL')
      AND NOT EXISTS (SELECT 1 FROM lignes_ecriture lo JOIN comptes co ON co.id = lo."compteId"
                      WHERE lo."ecritureId" = o.id AND co.classe IN ('CLASSE_6', 'CLASSE_7', 'CLASSE_8'))
  )
ORDER BY dossier_id, exercice_clos_le;
ROLLBACK;
```

3. Vides, rien à faire. Sinon, chaque dossier se corrige dans l'exercice où
   l'erreur est découverte · N+1 encore ouvert, une OD qui repasse les lignes
   de la contre-passation (AUDCIF art. 20, al. 2 ; le report, validé par la
   clôture, ne se retouche pas, art. 22, 2°) ; N+1 déjà clos, dans
   l'exercice en cours avec la mention aux Notes annexes (art. 20, al. 4).
   L'écriture est passée par le CLIENT, dans son dossier · VMG lui transmet
   l'identifiant de la contre-passation, et rien de ses comptes.

Éprouvées sur la base jetable du banc (point m5 du scénario de la ligne A,
94 contrôles sur 94).

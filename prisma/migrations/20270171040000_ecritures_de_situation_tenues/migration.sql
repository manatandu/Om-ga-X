-- LES ÉCRITURES QUE LA REPRISE NE DEVAIT PAS FAIRE SORTIR DES LECTURES (ligne
-- sage-l1, fonction 12, relecture du premier tour, M3).
--
-- La reprise `20270171000001_ecritures_de_situation_reprises` a passé en
-- SITUATION tout le brouillard des journaux de situation. Or une écriture de
-- situation sort de toutes les lectures du dossier · celle dont une ligne est
-- LETTRÉE avec une facture réelle laissait la facture dite payée (relances,
-- TVA à l'encaissement, balance âgée) par une ligne que plus rien ne lit ;
-- celle dont une ligne est POINTÉE laissait sa somme au rapprochement ; celle
-- qu'un module RETIENT (facture, mouvement de stock, consignation, écart
-- d'inventaire, don du registre...) devenait la pièce d'un acte réel sans être
-- lue nulle part. Cette migration NE RETOUCHE PAS la reprise, déjà appliquée
-- (Prisma en vérifie l'empreinte) · elle la complète.
--
-- DÉCISION PAR LA LOI · ces écritures REVIENNENT AU BROUILLARD, état qu'elles
-- avaient avant la règle, et le contrôle `JOURNAL_DE_SITUATION_AU_BROUILLARD`
-- les nomme avec leurs issues, comme la clôture qui les refuse.
--  · Une écriture au brouillard n'est pas au livre-journal, c'est la
--    validation qui l'y fait entrer (AUDCIF art. 22, 2°) · la laisser au
--    brouillard ne change RIEN aux livres ni aux états par rapport à ce qui
--    était lu avant la règle.
--  · Le logiciel ne sait pas si elle enregistre une opération (art. 22, 1° ·
--    « les données relatives à toute opération donnant lieu à
--    enregistrement ») · saisie dans un journal que le type Situation ne
--    régissait pas encore, elle peut être réelle. En faire une simulation la
--    retirerait des états le jour où elle aurait dû y entrer.
--  · Délettrer et dépointer d'office défairait des gestes du cabinet que
--    l'art. 20 ne vise pas (il régit la correction des ÉCRITURES, par
--    inscription en négatif) et qu'aucun texte n'autorise le logiciel à
--    défaire seul ; le précédent AU1 ne le fait qu'à la clôture, faute de
--    ligne qui remplace, et l'écrit sur l'exercice · ici rien ne remplace
--    rien.
-- L'issue reste au cabinet · défaire ce qui la tient (délettrer, dépointer,
-- détacher du module) puis la supprimer, et la ressaisir dans un journal
-- ordinaire si elle enregistre une opération.
--
-- « RETENUE » SE LIT SUR TOUTES LES CLÉS ÉTRANGÈRES VERS LES ÉCRITURES (hors
-- leurs propres lignes), lues dans le catalogue de la base · plus large que la
-- liste des détenteurs (`detenteurs-ecriture.ts`), du côté qui ne fait rien
-- disparaître. Une écriture de situation que rien ne tient reste une
-- simulation.
DO $$
DECLARE
  fk RECORD;
  tenues text[] := ARRAY[]::text[];
  lues text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT e."id"), ARRAY[]::text[])
    INTO lues
    FROM "ecritures" e
    JOIN "journaux" j ON j."id" = e."journalId"
    JOIN "lignes_ecriture" l ON l."ecritureId" = e."id"
   WHERE j."type" = 'SITUATION'
     AND e."statut" = 'SITUATION'
     AND (l."lettrageId" IS NOT NULL OR l."lettre" IS NOT NULL OR l."rapprochementId" IS NOT NULL);
  tenues := tenues || lues;

  FOR fk IN
    SELECT kcu.table_name AS t, kcu.column_name AS c
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = current_schema()
       AND ccu.table_name = 'ecritures'
       AND ccu.column_name = 'id'
       AND kcu.table_name <> 'lignes_ecriture'
  LOOP
    EXECUTE format(
      'SELECT coalesce(array_agg(DISTINCT e."id"), ARRAY[]::text[]) FROM %I r ' ||
      'JOIN "ecritures" e ON e."id" = r.%I JOIN "journaux" j ON j."id" = e."journalId" ' ||
      'WHERE j."type" = %L AND e."statut" = %L',
      fk.t, fk.c, 'SITUATION', 'SITUATION'
    ) INTO lues;
    tenues := tenues || lues;
  END LOOP;

  UPDATE "ecritures" SET "statut" = 'BROUILLARD' WHERE "id" = ANY (tenues);
END $$;

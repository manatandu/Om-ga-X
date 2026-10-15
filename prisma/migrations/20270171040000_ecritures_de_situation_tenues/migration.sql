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
-- L'issue reste au cabinet · la TRANSFÉRER dans un journal ordinaire, où elle
-- se valide comme toute pièce, ses lignes, lettrage, pointage et liens aux
-- modules gardés (second tour, BLOQUANT · `ecritures-de-situation.ts`) ;
-- délettrer ou dépointer, souvent impossible une fois une période close,
-- n'est plus le seul chemin.
--
-- « RETENUE » SE LIT SUR TOUTES LES CLÉS ÉTRANGÈRES VERS LES ÉCRITURES (hors
-- leurs propres lignes), lues dans le catalogue de la base · plus large que la
-- liste des détenteurs (`detenteurs-ecriture.ts`), du côté qui ne fait rien
-- disparaître. Une écriture de situation que rien ne tient reste une
-- simulation.
--
-- LE CATALOGUE EST `pg_constraint`, ET UNE LECTURE VIDE ARRÊTE TOUT (second
-- tour, f) · lues par `information_schema`, les clés ne se voient que des
-- tables dont le rôle de migration est PROPRIÉTAIRE ou détient un droit ; un
-- rôle qui n'en verrait aucune laissait passer en simulation des écritures
-- que des modules tiennent, sans un mot. `pg_constraint` ne filtre pas par
-- les droits, et zéro clé lue (il y en a des dizaines) n'est pas une base
-- sans détenteur, c'est une lecture fausse · la migration lève, rien n'est
-- touché.
DO $$
DECLARE
  fk RECORD;
  tenues text[] := ARRAY[]::text[];
  lues text[];
  cles integer := 0;
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
    SELECT c.conrelid::regclass AS t, a.attname AS c
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid = '"ecritures"'::regclass
       AND c.conrelid <> '"lignes_ecriture"'::regclass
  LOOP
    cles := cles + 1;
    EXECUTE format(
      'SELECT coalesce(array_agg(DISTINCT e."id"), ARRAY[]::text[]) FROM %s r ' ||
      'JOIN "ecritures" e ON e."id" = r.%I JOIN "journaux" j ON j."id" = e."journalId" ' ||
      'WHERE j."type" = %L AND e."statut" = %L',
      fk.t, fk.c, 'SITUATION', 'SITUATION'
    ) INTO lues;
    tenues := tenues || lues;
  END LOOP;

  IF cles = 0 THEN
    RAISE EXCEPTION 'Aucune clé étrangère vers les écritures n''a été lue dans le catalogue · la reprise des écritures tenues ne peut pas juger ce que les modules retiennent, rien n''est touché.';
  END IF;

  UPDATE "ecritures" SET "statut" = 'BROUILLARD' WHERE "id" = ANY (tenues);
END $$;

-- REPRISE DES ÉCRITURES DÉJÀ SAISIES DANS UN JOURNAL DE SITUATION (ligne
-- sage-l1, fonction 12). Le type Situation existait sans règle, et le schéma le
-- décrivait déjà comme celui des « écritures provisoires/simulation ».
--
-- AU BROUILLARD, elles n'étaient au livre-journal à aucun titre · elles
-- deviennent écritures de situation, visibles dans leur journal comme avant,
-- et cessent d'arrêter la clôture annuelle (qui refuse tout brouillard).
--
-- VALIDÉES, ELLES NE SONT PAS TOUCHÉES · la validation les a fait entrer au
-- livre-journal, et l'art. 22, 2° de l'AUDCIF interdit « toute suppression,
-- addition ou modification ultérieure ». Elles restent aux livres et aux états,
-- et le contrôle JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL les nomme ; seule une
-- inscription en négatif les corrige (art. 20, al. 2).
UPDATE "ecritures" e
SET "statut" = 'SITUATION'
FROM "journaux" j
WHERE e."journalId" = j."id"
  AND j."type" = 'SITUATION'
  AND e."statut" = 'BROUILLARD';

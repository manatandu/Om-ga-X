-- DEUX OPÉRATIONS, DEUX PIÈCES (demande de Manasse du 2026-10-16). Un virement
-- de fonds passe deux écritures, la SORTIE au journal d'origine et l'ENTRÉE à
-- celui de destination, et chacune s'appuie sur sa pièce justificative
-- (AUDCIF art. 17, 3° et 5° ; art. 22, 7°), datée par elle (art. 16, al. 2).
-- Les colonnes existantes portent la pièce de la sortie ; l'entrée reçoit les
-- siennes.

CREATE TYPE "OperationVirementFonds" AS ENUM ('SORTIE', 'ENTREE');

ALTER TABLE "virements_fonds"
  ADD COLUMN "naturePieceEntree" "NaturePieceVirement",
  ADD COLUMN "referencePieceEntree" VARCHAR(100),
  ADD COLUMN "datePieceEntree" DATE;

-- UN VIREMENT PASSÉ AVANT LA SÉPARATION a déclaré une pièce unique pour le
-- virement entier · elle est recopiée à l'entrée, telle quelle, jamais
-- devinée. La date de son écriture d'entrée ne change pas.
UPDATE "virements_fonds"
SET "naturePieceEntree" = "naturePiece",
    "referencePieceEntree" = "referencePiece",
    "datePieceEntree" = "datePiece";

ALTER TABLE "virements_fonds"
  ALTER COLUMN "naturePieceEntree" SET NOT NULL,
  ALTER COLUMN "referencePieceEntree" SET NOT NULL,
  ALTER COLUMN "datePieceEntree" SET NOT NULL;

-- UN SCAN JUSTIFIE UNE OPÉRATION · nul pour un scan déposé avant, qui valait
-- pour le virement entier. Le même document peut appuyer les deux côtés.
ALTER TABLE "pieces_virement_fonds" ADD COLUMN "operation" "OperationVirementFonds";

DROP INDEX "pieces_virement_fonds_virementId_empreinte_key";
CREATE UNIQUE INDEX "pieces_virement_fonds_virementId_operation_empreinte_key" ON "pieces_virement_fonds"("virementId", "operation", "empreinte");

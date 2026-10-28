-- LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du groupe,
-- SYSCOHADA seul (AUDCIF, Titre VII, fiche du compte 18 ; art. 35 et 36). Une
-- ligne par côté, liées par transfertId, sans clé étrangère vers l'autre
-- dossier ; chaque côté retient sa pièce et son négatif. Le bien entré par
-- transfert porte la date de son entrée (dateEntreeGroupe), d'où la dotation
-- de l'exercice d'entrée part du mois qui suit. La dépréciation qui suit le
-- bien a sa nature de mouvement (TRANSFERT_GROUPE).

-- CreateEnum
CREATE TYPE "SensTransfertGroupe" AS ENUM ('SORTIE', 'ENTREE');

-- AlterEnum
ALTER TYPE "NatureMouvementDepreciation" ADD VALUE 'TRANSFERT_GROUPE';

-- AlterTable
ALTER TABLE "immobilisations" ADD COLUMN     "dateEntreeGroupe" DATE;

-- CreateTable
CREATE TABLE "transferts_immobilisations_groupe" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transfertId" TEXT NOT NULL,
    "sens" "SensTransfertGroupe" NOT NULL,
    "dossierContrepartieId" TEXT NOT NULL,
    "immobilisationId" TEXT,
    "designation" VARCHAR(300) NOT NULL,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "compteLiaisonId" TEXT NOT NULL,
    "dateTransfert" DATE NOT NULL,
    "referencePiece" VARCHAR(60) NOT NULL,
    "datePiece" DATE NOT NULL,
    "valeurOrigine" DECIMAL(18,2) NOT NULL,
    "amortissements" DECIMAL(18,2) NOT NULL,
    "complementDotation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciations" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valeurNette" DECIMAL(18,2) NOT NULL,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferts_immobilisations_groupe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transferts_immobilisations_groupe_ecritureId_key" ON "transferts_immobilisations_groupe"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "transferts_immobilisations_groupe_ecritureNegatifId_key" ON "transferts_immobilisations_groupe"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "transferts_immobilisations_groupe_tenantId_immobilisationId_idx" ON "transferts_immobilisations_groupe"("tenantId", "immobilisationId");

-- CreateIndex
CREATE UNIQUE INDEX "transferts_immobilisations_groupe_tenantId_transfertId_key" ON "transferts_immobilisations_groupe"("tenantId", "transfertId");

-- AddForeignKey
ALTER TABLE "transferts_immobilisations_groupe" ADD CONSTRAINT "transferts_immobilisations_groupe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_immobilisations_groupe" ADD CONSTRAINT "transferts_immobilisations_groupe_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_immobilisations_groupe" ADD CONSTRAINT "transferts_immobilisations_groupe_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_immobilisations_groupe" ADD CONSTRAINT "transferts_immobilisations_groupe_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_immobilisations_groupe" ADD CONSTRAINT "transferts_immobilisations_groupe_compteLiaisonId_fkey" FOREIGN KEY ("compteLiaisonId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


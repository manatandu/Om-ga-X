-- LIGNE MICROFINA M4 · le détenteur d'un bien (idée 4 de la comparaison avec
-- Microfina++) · affectation à un salarié, transfert, libération, reçu
-- numéroté par dossier dont la signature se déclare. Aucun texte ne l'impose,
-- aucune écriture n'en naît · convention d'OmegaX. Toutes les clés sont
-- RESTRICT · une détention ne se perd jamais avec son bien, son salarié, son
-- lieu ou son reçu.

-- CreateEnum
CREATE TYPE "NatureRecuDetention" AS ENUM ('AFFECTATION', 'TRANSFERT', 'LIBERATION');

-- CreateTable
CREATE TABLE "recus_detention_biens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nature" "NatureRecuDetention" NOT NULL,
    "dateActe" DATE NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "etabliLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etabliPar" TEXT NOT NULL,
    "signataires" VARCHAR(300),
    "dateSignature" DATE,
    "signatureDeclareeLe" TIMESTAMP(3),
    "signatureDeclareePar" TEXT,

    CONSTRAINT "recus_detention_biens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detentions_biens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "lieuId" TEXT,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE,
    "observation" VARCHAR(300),
    "recuDebutId" TEXT NOT NULL,
    "recuFinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "detentions_biens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recus_detention_biens_tenantId_numero_key" ON "recus_detention_biens"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "recus_detention_biens_tenantId_immobilisationId_idx" ON "recus_detention_biens"("tenantId", "immobilisationId");

-- CreateIndex
CREATE UNIQUE INDEX "detentions_biens_recuDebutId_key" ON "detentions_biens"("recuDebutId");

-- CreateIndex
CREATE UNIQUE INDEX "detentions_biens_recuFinId_key" ON "detentions_biens"("recuFinId");

-- CreateIndex
CREATE INDEX "detentions_biens_tenantId_immobilisationId_dateDebut_idx" ON "detentions_biens"("tenantId", "immobilisationId", "dateDebut");

-- CreateIndex
CREATE INDEX "detentions_biens_tenantId_salarieId_idx" ON "detentions_biens"("tenantId", "salarieId");

-- CreateIndex
CREATE INDEX "detentions_biens_tenantId_dateDebut_idx" ON "detentions_biens"("tenantId", "dateDebut");

-- AddForeignKey
ALTER TABLE "recus_detention_biens" ADD CONSTRAINT "recus_detention_biens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recus_detention_biens" ADD CONSTRAINT "recus_detention_biens_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_lieuId_fkey" FOREIGN KEY ("lieuId") REFERENCES "lieux_biens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_recuDebutId_fkey" FOREIGN KEY ("recuDebutId") REFERENCES "recus_detention_biens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detentions_biens" ADD CONSTRAINT "detentions_biens_recuFinId_fkey" FOREIGN KEY ("recuFinId") REFERENCES "recus_detention_biens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

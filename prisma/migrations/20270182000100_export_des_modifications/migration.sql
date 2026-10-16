-- Ligne sage-l7, fonction 99 · l'export des seules modifications.
--
-- L'export des écritures, numéroté et daté, son fichier gardé (AUDCIF
-- art. 22, 7° · états fournis numérotés et datés, donnée transmise à un autre
-- système appuyée d'une pièce probante), et le registre de ce qui est parti,
-- une ligne par écriture envoyée, SANS clé étrangère vers l'écriture · une
-- écriture du brouillard retirée y laisse sa trace, dite à l'export suivant.

-- CreateEnum
CREATE TYPE "ModeExportEcritures" AS ENUM ('MODIFICATIONS', 'COMPLET');

-- CreateTable
CREATE TABLE "exports_ecritures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "mode" "ModeExportEcritures" NOT NULL,
    "inclureBrouillard" BOOLEAN NOT NULL,
    "produitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produitPar" TEXT NOT NULL,
    "nombreEcritures" INTEGER NOT NULL,
    "nombreNouvelles" INTEGER NOT NULL,
    "nombreModifiees" INTEGER NOT NULL,
    "nombreSupprimees" INTEGER NOT NULL,
    "nombreLignes" INTEGER NOT NULL,
    "nombreEnAttente" INTEGER NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "contenu" BYTEA NOT NULL,

    CONSTRAINT "exports_ecritures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecritures_exportees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ecritureId" TEXT NOT NULL,
    "numeroExport" INTEGER NOT NULL,
    "statutExporte" "StatutEcriture" NOT NULL,
    "empreinte" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journalCode" TEXT NOT NULL,
    "piece" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "supprimeeAuNumero" INTEGER,

    CONSTRAINT "ecritures_exportees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exports_ecritures_tenantId_numero_key" ON "exports_ecritures"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "ecritures_exportees_tenantId_supprimeeAuNumero_statutExport_idx" ON "ecritures_exportees"("tenantId", "supprimeeAuNumero", "statutExporte");

-- CreateIndex
CREATE UNIQUE INDEX "ecritures_exportees_tenantId_ecritureId_key" ON "ecritures_exportees"("tenantId", "ecritureId");

-- AddForeignKey
ALTER TABLE "exports_ecritures" ADD CONSTRAINT "exports_ecritures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_exportees" ADD CONSTRAINT "ecritures_exportees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


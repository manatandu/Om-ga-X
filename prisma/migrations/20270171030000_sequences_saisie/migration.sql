-- Ligne sage-l1, fonction 19 · séquences de saisie.
--
-- Au plus dix séquences nommées par dossier (Sage, table P_SEQUENCE), et la
-- séquence de chaque modèle de saisie (N_Sequence), nulle à défaut.

-- CreateTable
CREATE TABLE "sequences_saisie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "intitule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "sequences_saisie_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "modeles_saisie" ADD COLUMN "sequenceSaisieId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sequences_saisie_tenantId_numero_key" ON "sequences_saisie"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_saisie_tenantId_intitule_key" ON "sequences_saisie"("tenantId", "intitule");

-- AddForeignKey
ALTER TABLE "sequences_saisie" ADD CONSTRAINT "sequences_saisie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_saisie" ADD CONSTRAINT "modeles_saisie_sequenceSaisieId_fkey" FOREIGN KEY ("sequenceSaisieId") REFERENCES "sequences_saisie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

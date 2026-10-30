-- Ligne dossier-l9, fonction 102 · l'échange d'écritures entre dossiers OmegaX.
-- Les envois reçus (l'export des modifications d'un autre dossier, numéroté et
-- daté chez lui, AUDCIF art. 22, 7°) et le registre de ce qui est reçu, par
-- l'identifiant d'origine de chaque écriture · jamais deux fois la même.
-- Tant qu'elle est TENUE, l'écriture reçue est retenue (RESTRICT).

-- CreateEnum
CREATE TYPE "EtatReceptionEchange" AS ENUM ('EN_COURS', 'TERMINEE');

-- CreateEnum
CREATE TYPE "EtatEcritureRecue" AS ENUM ('TENUE', 'DETACHEE', 'RETIREE_PAR_LA_SOURCE');

-- CreateTable
CREATE TABLE "receptions_echange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "etat" "EtatReceptionEchange" NOT NULL DEFAULT 'EN_COURS',
    "dossierSource" TEXT NOT NULL,
    "numeroExportSource" INTEGER NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "empreinteFichier" TEXT NOT NULL,
    "recuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recuPar" TEXT NOT NULL,
    "termineeLe" TIMESTAMP(3),
    "nombreCreees" INTEGER NOT NULL DEFAULT 0,
    "nombreModifiees" INTEGER NOT NULL DEFAULT 0,
    "nombreRetirees" INTEGER NOT NULL DEFAULT 0,
    "nombreIgnorees" INTEGER NOT NULL DEFAULT 0,
    "nombreRefusees" INTEGER NOT NULL DEFAULT 0,
    "compteRendu" JSONB,

    CONSTRAINT "receptions_echange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecritures_recues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identifiantSource" TEXT NOT NULL,
    "etat" "EtatEcritureRecue" NOT NULL DEFAULT 'TENUE',
    "ecritureId" TEXT,
    "ecritureDetacheeId" TEXT,
    "detacheeLe" TIMESTAMP(3),
    "detacheePar" TEXT,
    "empreinteSource" TEXT NOT NULL,
    "numeroExportSource" INTEGER NOT NULL,
    "premiereReceptionId" TEXT NOT NULL,
    "derniereReceptionId" TEXT NOT NULL,
    "recueLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecritures_recues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receptions_echange_tenantId_recuLe_idx" ON "receptions_echange"("tenantId", "recuLe");

-- CreateIndex
CREATE UNIQUE INDEX "receptions_echange_tenantId_empreinteFichier_key" ON "receptions_echange"("tenantId", "empreinteFichier");

-- CreateIndex
CREATE UNIQUE INDEX "ecritures_recues_ecritureId_key" ON "ecritures_recues"("ecritureId");

-- CreateIndex
CREATE INDEX "ecritures_recues_tenantId_ecritureDetacheeId_idx" ON "ecritures_recues"("tenantId", "ecritureDetacheeId");

-- CreateIndex
CREATE UNIQUE INDEX "ecritures_recues_tenantId_identifiantSource_key" ON "ecritures_recues"("tenantId", "identifiantSource");

-- AddForeignKey
ALTER TABLE "receptions_echange" ADD CONSTRAINT "receptions_echange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_recues" ADD CONSTRAINT "ecritures_recues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_recues" ADD CONSTRAINT "ecritures_recues_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_recues" ADD CONSTRAINT "ecritures_recues_premiereReceptionId_fkey" FOREIGN KEY ("premiereReceptionId") REFERENCES "receptions_echange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecritures_recues" ADD CONSTRAINT "ecritures_recues_derniereReceptionId_fkey" FOREIGN KEY ("derniereReceptionId") REFERENCES "receptions_echange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


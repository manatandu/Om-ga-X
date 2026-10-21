-- Suppression des dossiers d'essai échus (décision de Manasse du 2026-10-17) ·
-- conservés cent quatre-vingts jours après leur terme, rappel par courriel au
-- moins trente jours avant, suppression faite par l'opérateur depuis la console.
-- Deux tables de l'ÉDITEUR, hors dossier : le rappel (un par dossier et par
-- terme d'essai, qui part avec lui) et la trace de la suppression (sans clé
-- étrangère, aucune donnée du client, des dates et des nombres).

-- CreateTable
CREATE TABLE "rappels_suppression_essai" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "termeLe" DATE NOT NULL,
    "messageId" TEXT NOT NULL,
    "misEnFileLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeLe" TIMESTAMP(3),
    "supprimableLe" DATE NOT NULL,
    "parOperateur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rappels_suppression_essai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers_essai_supprimes" (
    "id" TEXT NOT NULL,
    "ancienTenantId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL,
    "termeLe" DATE NOT NULL,
    "rappelEnvoyeLe" TIMESTAMP(3) NOT NULL,
    "supprimeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parOperateur" TEXT NOT NULL,
    "nombreUtilisateurs" INTEGER NOT NULL,
    "nombreExercices" INTEGER NOT NULL,
    "nombreEcritures" INTEGER NOT NULL,
    "nombreLignesSupprimees" INTEGER NOT NULL,

    CONSTRAINT "dossiers_essai_supprimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rappels_suppression_essai_cabinetId_termeLe_key" ON "rappels_suppression_essai"("cabinetId", "termeLe");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_essai_supprimes_ancienTenantId_key" ON "dossiers_essai_supprimes"("ancienTenantId");

-- AddForeignKey
ALTER TABLE "rappels_suppression_essai" ADD CONSTRAINT "rappels_suppression_essai_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

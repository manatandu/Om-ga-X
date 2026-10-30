-- Ligne commercial-l8, fonctions 25 et 30 · la devise habituelle du tiers,
-- proposée à la saisie de ses comptes, et l'encours maximum du client, averti
-- à la vente. Rien n'est rempli d'office · un tiers existant n'a ni devise ni
-- encours tant que le cabinet ne les déclare pas.

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "deviseId" TEXT,
ADD COLUMN     "encoursMaximum" DECIMAL(18,2);

-- CreateIndex
CREATE INDEX "tiers_deviseId_idx" ON "tiers"("deviseId");

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_deviseId_fkey" FOREIGN KEY ("deviseId") REFERENCES "devises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


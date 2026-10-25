-- Ligne microfina-m2, idée 2 · le bon de commande fournisseur qui FAIT NAÎTRE
-- l'engagement de dépense à sa remise (SYCEBNL, Guide d'application, ch. 7,
-- Application 22, règle (d) · « bons de commande de biens et services remis
-- aux fournisseurs au cours de l'exercice budgétaire, non exécutés »), et la
-- facture d'achat qui l'EXÉCUTE, part par ligne budgétaire. Aucune écriture.

-- CreateEnum
CREATE TYPE "StatutBonCommande" AS ENUM ('BROUILLON', 'REMIS', 'CLOS');

-- AlterTable
ALTER TABLE "engagements_depense" ADD COLUMN     "bonCommandeId" TEXT;

-- CreateTable
CREATE TABLE "bons_commande_fournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "tiersId" TEXT NOT NULL,
    "fournisseurNom" TEXT,
    "numero" INTEGER,
    "objet" TEXT NOT NULL,
    "dateRemise" DATE,
    "statut" "StatutBonCommande" NOT NULL DEFAULT 'BROUILLON',
    "remisLe" TIMESTAMP(3),
    "remisPar" TEXT,
    "motifCloture" TEXT,
    "closLe" TIMESTAMP(3),
    "closPar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bons_commande_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_bon_commande" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(18,4) NOT NULL,
    "prixUnitaire" DECIMAL(18,2) NOT NULL,
    "montantHT" DECIMAL(18,2) NOT NULL,
    "montantTva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "lignes_bon_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions_bon_commande" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "executionEngagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "executions_bon_commande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bons_commande_fournisseur_tenantId_exerciceId_idx" ON "bons_commande_fournisseur"("tenantId", "exerciceId");

-- CreateIndex
CREATE INDEX "bons_commande_fournisseur_tiersId_idx" ON "bons_commande_fournisseur"("tiersId");

-- CreateIndex
CREATE UNIQUE INDEX "bons_commande_fournisseur_tenantId_numero_key" ON "bons_commande_fournisseur"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "lignes_bon_commande_tenantId_bonId_idx" ON "lignes_bon_commande"("tenantId", "bonId");

-- CreateIndex
CREATE INDEX "lignes_bon_commande_sectionId_idx" ON "lignes_bon_commande"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "lignes_bon_commande_bonId_ordre_key" ON "lignes_bon_commande"("bonId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "executions_bon_commande_executionEngagementId_key" ON "executions_bon_commande"("executionEngagementId");

-- CreateIndex
CREATE INDEX "executions_bon_commande_tenantId_bonId_idx" ON "executions_bon_commande"("tenantId", "bonId");

-- CreateIndex
CREATE INDEX "executions_bon_commande_factureId_idx" ON "executions_bon_commande"("factureId");

-- CreateIndex
CREATE INDEX "executions_bon_commande_sectionId_idx" ON "executions_bon_commande"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "executions_bon_commande_bonId_factureId_sectionId_key" ON "executions_bon_commande"("bonId", "factureId", "sectionId");

-- CreateIndex
CREATE INDEX "engagements_depense_bonCommandeId_idx" ON "engagements_depense"("bonCommandeId");

-- AddForeignKey
ALTER TABLE "engagements_depense" ADD CONSTRAINT "engagements_depense_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande_fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_fournisseur" ADD CONSTRAINT "bons_commande_fournisseur_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_fournisseur" ADD CONSTRAINT "bons_commande_fournisseur_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_fournisseur" ADD CONSTRAINT "bons_commande_fournisseur_tiersId_fkey" FOREIGN KEY ("tiersId") REFERENCES "tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "bons_commande_fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "bons_commande_fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_executionEngagementId_fkey" FOREIGN KEY ("executionEngagementId") REFERENCES "executions_engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- LA BASE TIENT CE QUE LE SERVICE DIT · un brouillon n'a pas de numéro, un bon
-- remis ou clos en a un et porte sa date de remise ; un bon clos porte son
-- motif. Sans ces gardes, un geste interrompu laisserait un bon « remis » sans
-- numéro, qui engagerait le budget sans pièce identifiable.
ALTER TABLE "bons_commande_fournisseur" ADD CONSTRAINT "bons_commande_numero_si_remis"
  CHECK (("statut" = 'BROUILLON') = ("numero" IS NULL) AND ("statut" = 'BROUILLON' OR "dateRemise" IS NOT NULL));
ALTER TABLE "bons_commande_fournisseur" ADD CONSTRAINT "bons_commande_motif_si_clos"
  CHECK ("statut" <> 'CLOS' OR ("motifCloture" IS NOT NULL AND length(btrim("motifCloture")) > 0));
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_montants"
  CHECK ("quantite" > 0 AND "prixUnitaire" >= 0 AND "montantHT" >= 0 AND "montantTva" >= 0);
ALTER TABLE "executions_bon_commande" ADD CONSTRAINT "executions_bon_commande_montant_positif"
  CHECK ("montant" > 0);

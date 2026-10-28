-- Ligne microfina-m2, idée 5 · l'arrêté de caisse quotidien par coupures et le
-- plafond d'encaisse. Fiche du compte 57 des deux plans · « le solde du compte
-- caisse doit toujours correspondre exactement à la somme disponible
-- réellement » ; éléments de contrôle · « procès-verbaux de caisse ; états de
-- reddition de la caisse ; bordereaux de situation journalière ». Le plafond
-- est une CONVENTION DU DOSSIER, aucun texte lu n'en fixe · il avertit.

-- CreateTable
CREATE TABLE "arretes_caisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "heure" VARCHAR(5),
    "deviseId" TEXT,
    "soldeTheorique" DECIMAL(18,2) NOT NULL,
    "ecrituresAuBrouillard" INTEGER NOT NULL,
    "brouillardExercicesAnterieurs" INTEGER NOT NULL DEFAULT 0,
    "especesComptees" DECIMAL(18,2) NOT NULL,
    "ecart" DECIMAL(18,2) NOT NULL,
    "plafondFige" DECIMAL(18,2),
    "plafondNonCompare" VARCHAR(300),
    "caissier" VARCHAR(100) NOT NULL,
    "controlePar" VARCHAR(100),
    "observations" VARCHAR(1000),
    "etabliLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etabliPar" TEXT NOT NULL,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),

    CONSTRAINT "arretes_caisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupures_arrete_caisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "arreteId" TEXT NOT NULL,
    "valeurUnitaire" DECIMAL(18,2) NOT NULL,
    "nombre" INTEGER NOT NULL,

    CONSTRAINT "coupures_arrete_caisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plafonds_encaisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "dateEffet" DATE NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "deviseId" TEXT,
    "motif" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "plafonds_encaisse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arretes_caisse_tenantId_jour_idx" ON "arretes_caisse"("tenantId", "jour");

-- CreateIndex
CREATE INDEX "arretes_caisse_tenantId_compteId_idx" ON "arretes_caisse"("tenantId", "compteId");

-- CreateIndex
CREATE INDEX "arretes_caisse_deviseId_idx" ON "arretes_caisse"("deviseId");

-- CreateIndex
-- UN SEUL ARRÊTÉ NON ANNULÉ PAR CAISSE ET PAR JOUR · NULLS NOT DISTINCT, sans
-- quoi deux arrêtés à `annuleLe` nul ne se gêneraient pas (Postgres tient deux
-- NULL pour distincts), et deux comptages contradictoires du même jour
-- coexisteraient. Les annulés gardent chacun leur instant.
CREATE UNIQUE INDEX "arretes_caisse_compteId_jour_annuleLe_key" ON "arretes_caisse"("compteId", "jour", "annuleLe") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "coupures_arrete_caisse_tenantId_arreteId_idx" ON "coupures_arrete_caisse"("tenantId", "arreteId");

-- CreateIndex
CREATE INDEX "plafonds_encaisse_tenantId_compteId_idx" ON "plafonds_encaisse"("tenantId", "compteId");

-- CreateIndex
CREATE INDEX "plafonds_encaisse_deviseId_idx" ON "plafonds_encaisse"("deviseId");

-- CreateIndex
CREATE UNIQUE INDEX "plafonds_encaisse_compteId_dateEffet_key" ON "plafonds_encaisse"("compteId", "dateEffet");

-- AddForeignKey
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_deviseId_fkey" FOREIGN KEY ("deviseId") REFERENCES "devises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupures_arrete_caisse" ADD CONSTRAINT "coupures_arrete_caisse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupures_arrete_caisse" ADD CONSTRAINT "coupures_arrete_caisse_arreteId_fkey" FOREIGN KEY ("arreteId") REFERENCES "arretes_caisse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plafonds_encaisse" ADD CONSTRAINT "plafonds_encaisse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plafonds_encaisse" ADD CONSTRAINT "plafonds_encaisse_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plafonds_encaisse" ADD CONSTRAINT "plafonds_encaisse_deviseId_fkey" FOREIGN KEY ("deviseId") REFERENCES "devises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_motif_si_annule"
  CHECK ("annuleLe" IS NULL OR ("motifAnnulation" IS NOT NULL AND length(btrim("motifAnnulation")) > 0));
ALTER TABLE "arretes_caisse" ADD CONSTRAINT "arretes_caisse_brouillard_positif"
  CHECK ("ecrituresAuBrouillard" >= 0 AND "brouillardExercicesAnterieurs" >= 0 AND "brouillardExercicesAnterieurs" <= "ecrituresAuBrouillard" AND "especesComptees" >= 0);
ALTER TABLE "coupures_arrete_caisse" ADD CONSTRAINT "coupures_arrete_caisse_valeurs"
  CHECK ("valeurUnitaire" > 0 AND "nombre" >= 0);
ALTER TABLE "plafonds_encaisse" ADD CONSTRAINT "plafonds_encaisse_montant_positif"
  CHECK ("montant" > 0);

-- LIGNE SAGE-L5, FONCTION 78, RESTE · les feuilles de temps et les compteurs
-- libres d'heures. Aucun texte ne régit la feuille (choix d'organisation) ; ce
-- qu'elle fait des heures se lit au Code du travail, art. 119, 121 et 124,
-- dans personnel/feuilles-temps.ts. Les heures se saisissent, jamais un
-- montant · le taux de majoration reste déclaré avec sa source
-- (majorations_heures). Tables d'acte au journal d'audit, rien ne se supprime.

-- CreateTable
CREATE TABLE "feuilles_temps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "du" DATE NOT NULL,
    "au" DATE NOT NULL,
    "observation" VARCHAR(500),
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feuilles_temps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jours_feuilles_temps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feuilleId" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "heures" DECIMAL(5,2) NOT NULL,
    "heuresNuit" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "modifiePar" TEXT NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jours_feuilles_temps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteurs_heures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "libelle" VARCHAR(60) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "desactiveLe" TIMESTAMP(3),
    "desactivePar" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compteurs_heures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heures_compteurs_jours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jourId" TEXT NOT NULL,
    "compteurId" TEXT NOT NULL,
    "heures" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "heures_compteurs_jours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feuilles_temps_tenantId_salarieId_du_idx" ON "feuilles_temps"("tenantId", "salarieId", "du");

-- CreateIndex
CREATE INDEX "jours_feuilles_temps_tenantId_feuilleId_idx" ON "jours_feuilles_temps"("tenantId", "feuilleId");

-- CreateIndex
CREATE UNIQUE INDEX "jours_feuilles_temps_feuilleId_jour_key" ON "jours_feuilles_temps"("feuilleId", "jour");

-- CreateIndex
CREATE UNIQUE INDEX "compteurs_heures_tenantId_code_key" ON "compteurs_heures"("tenantId", "code");

-- CreateIndex
CREATE INDEX "heures_compteurs_jours_tenantId_compteurId_idx" ON "heures_compteurs_jours"("tenantId", "compteurId");

-- CreateIndex
CREATE UNIQUE INDEX "heures_compteurs_jours_jourId_compteurId_key" ON "heures_compteurs_jours"("jourId", "compteurId");

-- AddForeignKey
ALTER TABLE "feuilles_temps" ADD CONSTRAINT "feuilles_temps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feuilles_temps" ADD CONSTRAINT "feuilles_temps_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jours_feuilles_temps" ADD CONSTRAINT "jours_feuilles_temps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jours_feuilles_temps" ADD CONSTRAINT "jours_feuilles_temps_feuilleId_fkey" FOREIGN KEY ("feuilleId") REFERENCES "feuilles_temps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteurs_heures" ADD CONSTRAINT "compteurs_heures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heures_compteurs_jours" ADD CONSTRAINT "heures_compteurs_jours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heures_compteurs_jours" ADD CONSTRAINT "heures_compteurs_jours_jourId_fkey" FOREIGN KEY ("jourId") REFERENCES "jours_feuilles_temps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heures_compteurs_jours" ADD CONSTRAINT "heures_compteurs_jours_compteurId_fkey" FOREIGN KEY ("compteurId") REFERENCES "compteurs_heures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

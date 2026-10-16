-- Ligne sage-l6, fonction n° 22 · les pièces jointes aux écritures, aux
-- sections analytiques, aux biens et aux salariés. Une table par objet, le
-- mécanisme écrit une fois (`src/common/pieces-jointes/`).
--
-- La pièce d'une écriture ne la retient pas · une écriture retirée au
-- brouillard laisse sa pièce DÉTACHÉE (ON DELETE SET NULL), jamais perdue
-- (AUDCIF art. 24) ; `ecritureDecrite` dit ce qu'elle justifiait. Les trois
-- autres retiennent leur objet (RESTRICT) · une section, une fiche ou un
-- salarié qui porte un document ne se supprime pas sans le dire.
--
-- Aucune donnée existante n'est reprise · les documents des tiers et les
-- pièces des virements de fonds gardent leurs tables.

-- CreateTable
CREATE TABLE "pieces_jointes_ecritures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ecritureId" TEXT,
    "ecritureDecrite" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "commentaire" VARCHAR(69),
    "contenu" BYTEA NOT NULL,
    "deposePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_ecritures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes_sections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "commentaire" VARCHAR(69),
    "contenu" BYTEA NOT NULL,
    "deposePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes_immobilisations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "commentaire" VARCHAR(69),
    "contenu" BYTEA NOT NULL,
    "deposePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_immobilisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes_salaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "commentaire" VARCHAR(69),
    "contenu" BYTEA NOT NULL,
    "deposePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pieces_jointes_ecritures_tenantId_ecritureId_idx" ON "pieces_jointes_ecritures"("tenantId", "ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_ecritures_ecritureId_empreinte_key" ON "pieces_jointes_ecritures"("ecritureId", "empreinte");

-- CreateIndex
CREATE INDEX "pieces_jointes_sections_tenantId_sectionId_idx" ON "pieces_jointes_sections"("tenantId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_sections_sectionId_empreinte_key" ON "pieces_jointes_sections"("sectionId", "empreinte");

-- CreateIndex
CREATE INDEX "pieces_jointes_immobilisations_tenantId_immobilisationId_idx" ON "pieces_jointes_immobilisations"("tenantId", "immobilisationId");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_immobilisations_immobilisationId_empreinte_key" ON "pieces_jointes_immobilisations"("immobilisationId", "empreinte");

-- CreateIndex
CREATE INDEX "pieces_jointes_salaries_tenantId_salarieId_idx" ON "pieces_jointes_salaries"("tenantId", "salarieId");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_salaries_salarieId_empreinte_key" ON "pieces_jointes_salaries"("salarieId", "empreinte");

-- AddForeignKey
ALTER TABLE "pieces_jointes_ecritures" ADD CONSTRAINT "pieces_jointes_ecritures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_ecritures" ADD CONSTRAINT "pieces_jointes_ecritures_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_sections" ADD CONSTRAINT "pieces_jointes_sections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_sections" ADD CONSTRAINT "pieces_jointes_sections_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_immobilisations" ADD CONSTRAINT "pieces_jointes_immobilisations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_immobilisations" ADD CONSTRAINT "pieces_jointes_immobilisations_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_salaries" ADD CONSTRAINT "pieces_jointes_salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes_salaries" ADD CONSTRAINT "pieces_jointes_salaries_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


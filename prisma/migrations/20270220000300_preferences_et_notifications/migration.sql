-- Ligne dossier-l9, fonctions 96 et 100 · les préférences de chaque
-- utilisateur (langue de l'interface, taille du texte, notifications coupées)
-- et les notifications dans l'interface (message reçu, écritures reçues,
-- exercice clôturé). Une notification lue se retire après quatre-vingt-dix
-- jours (Code du numérique, art. 193, 3°).

-- CreateEnum
CREATE TYPE "LangueInterface" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "TailleTexte" AS ENUM ('NORMALE', 'GRANDE', 'TRES_GRANDE');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('MESSAGE_RECU', 'ECRITURES_RECUES', 'EXERCICE_CLOTURE');

-- CreateTable
CREATE TABLE "preferences_utilisateurs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "langue" "LangueInterface" NOT NULL DEFAULT 'FR',
    "tailleTexte" "TailleTexte" NOT NULL DEFAULT 'NORMALE',
    "notificationsCoupees" "TypeNotification"[] DEFAULT ARRAY[]::"TypeNotification"[],
    "modifieeLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_utilisateurs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "titre" VARCHAR(250) NOT NULL,
    "lien" VARCHAR(200),
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lueLe" TIMESTAMP(3),

    CONSTRAINT "notifications_utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preferences_utilisateurs_userId_key" ON "preferences_utilisateurs"("userId");

-- CreateIndex
CREATE INDEX "preferences_utilisateurs_tenantId_idx" ON "preferences_utilisateurs"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_utilisateurs_tenantId_destinataireId_lueLe_cr_idx" ON "notifications_utilisateurs"("tenantId", "destinataireId", "lueLe", "creeeLe");

-- AddForeignKey
ALTER TABLE "preferences_utilisateurs" ADD CONSTRAINT "preferences_utilisateurs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences_utilisateurs" ADD CONSTRAINT "preferences_utilisateurs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_utilisateurs" ADD CONSTRAINT "notifications_utilisateurs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_utilisateurs" ADD CONSTRAINT "notifications_utilisateurs_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


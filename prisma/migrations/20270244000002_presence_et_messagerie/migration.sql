-- Ligne dossier-l9, fonction 95 · les sessions vues en activité (ce que
-- l'administrateur lit dans « Utilisateurs connectés », jamais un jeton) et la
-- messagerie interne entre utilisateurs d'un MÊME dossier. Données réduites à
-- ce que la fenêtre sert (Code du numérique, art. 193, 2° et 3° ; art. 194).

-- CreateTable
CREATE TABLE "presences_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empreinteSession" TEXT NOT NULL,
    "ouverteLe" TIMESTAMP(3) NOT NULL,
    "authentifieeLe" TIMESTAMP(3) NOT NULL,
    "derniereActiviteLe" TIMESTAMP(3) NOT NULL,
    "sessionLongue" BOOLEAN NOT NULL,
    "appareil" VARCHAR(60),
    "fermeeLe" TIMESTAMP(3),

    CONSTRAINT "presences_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_internes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "objet" VARCHAR(150) NOT NULL,
    "corps" VARCHAR(5000) NOT NULL,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repondAId" TEXT,
    "retireParExpediteurLe" TIMESTAMP(3),

    CONSTRAINT "messages_internes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinataires_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "luLe" TIMESTAMP(3),
    "retireLe" TIMESTAMP(3),

    CONSTRAINT "destinataires_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presences_sessions_empreinteSession_key" ON "presences_sessions"("empreinteSession");

-- CreateIndex
CREATE INDEX "presences_sessions_tenantId_derniereActiviteLe_idx" ON "presences_sessions"("tenantId", "derniereActiviteLe");

-- CreateIndex
CREATE INDEX "messages_internes_tenantId_expediteurId_envoyeLe_idx" ON "messages_internes"("tenantId", "expediteurId", "envoyeLe");

-- CreateIndex
CREATE INDEX "destinataires_messages_tenantId_destinataireId_retireLe_idx" ON "destinataires_messages"("tenantId", "destinataireId", "retireLe");

-- CreateIndex
CREATE UNIQUE INDEX "destinataires_messages_messageId_destinataireId_key" ON "destinataires_messages"("messageId", "destinataireId");

-- AddForeignKey
ALTER TABLE "presences_sessions" ADD CONSTRAINT "presences_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences_sessions" ADD CONSTRAINT "presences_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_internes" ADD CONSTRAINT "messages_internes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_internes" ADD CONSTRAINT "messages_internes_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_internes" ADD CONSTRAINT "messages_internes_repondAId_fkey" FOREIGN KEY ("repondAId") REFERENCES "messages_internes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinataires_messages" ADD CONSTRAINT "destinataires_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinataires_messages" ADD CONSTRAINT "destinataires_messages_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages_internes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinataires_messages" ADD CONSTRAINT "destinataires_messages_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


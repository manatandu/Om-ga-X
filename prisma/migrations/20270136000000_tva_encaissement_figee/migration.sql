-- Ligne A7 bis · ce que chaque liquidation de TVA a déclaré à l'encaissement,
-- ligne de TVA par ligne de TVA. NULL pour les liquidations existantes, passées
-- sous l'ancien moteur · la déclaration les reconstitue (transition).
ALTER TABLE "liquidations_tva" ADD COLUMN "tvaEncaissementFigee" JSONB;

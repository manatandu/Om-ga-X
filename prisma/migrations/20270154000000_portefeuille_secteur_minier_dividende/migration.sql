-- Décision par la loi du 2026-10-07, point 3 (docs/decisions-par-la-loi-2026-10-07.md) ·
-- entreprise minière du portefeuille de l'État (arrêté interministériel du
-- 10 décembre 2025, art. 2 et 3) · secteur minier déclaré, quote-part de l'État
-- dans le capital et sa source, nullables, jamais présumés ; trois dates
-- déclarées par exercice pour le dividende prioritaire (déclaration, réception
-- de la note de perception, paiement).
ALTER TABLE "tenants"
  ADD COLUMN "portefeuilleSecteurMinier" BOOLEAN,
  ADD COLUMN "quotePartEtatCapital" DECIMAL(7,4),
  ADD COLUMN "sourceQuotePartEtat" TEXT;

ALTER TABLE "exercices"
  ADD COLUMN "dateDeclarationDividendeEtat" TIMESTAMP(3),
  ADD COLUMN "dateNotePerceptionDividende" TIMESTAMP(3),
  ADD COLUMN "datePaiementDividendeEtat" TIMESTAMP(3);

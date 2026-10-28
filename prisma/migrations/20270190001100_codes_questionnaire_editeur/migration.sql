-- Les questions du questionnaire de révision que l'éditeur a écrites portaient
-- le préfixe de l'ancien éditeur (« VMG-CLI-2 »). Le nom est retiré du
-- logiciel (décision de Manasse du 2026-10-28) · le catalogue les nomme
-- désormais « EDI-CLI-2 », même suffixe. Les réponses déjà saisies suivent leur
-- question, sans quoi elles resteraient orphelines (le catalogue ne les
-- retrouverait plus) et le questionnaire se rouvrirait vide.
--
-- Aucune collision possible sur la clé unique (questionnaireId, code) · aucun
-- code « EDI-… » n'existait avant cette migration.
UPDATE "reponses_questionnaire"
SET "code" = 'EDI-' || substr("code", 5)
WHERE "code" LIKE 'VMG-%';

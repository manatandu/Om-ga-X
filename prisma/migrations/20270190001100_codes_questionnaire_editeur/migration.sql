-- Les questions du questionnaire de révision que l'éditeur a écrites portaient
-- le préfixe de trois lettres de l'ancien éditeur (« XXX-CLI-2 »). Le nom est retiré du
-- logiciel (décision de Manasse du 2026-10-28) · le catalogue les nomme
-- désormais « EDI-CLI-2 », même suffixe. Les réponses déjà saisies suivent leur
-- question, sans quoi elles resteraient orphelines (le catalogue ne les
-- retrouverait plus) et le questionnaire se rouvrirait vide.
--
-- Aucune collision possible sur la clé unique (questionnaireId, code) · aucun
-- code « EDI-… » n'existait avant cette migration. Les seuls préfixes alors en
-- base étaient « CPCC- », de quatre lettres, et celui de l'ancien éditeur, de
-- trois · la condition ci-dessous vise donc exactement ce dernier, sans le
-- nommer (retrait du nom réécrit dans ce commentaire et cette condition le
-- 2026-10-28, décision de Manasse, la migration déjà appliquée partout).
UPDATE "reponses_questionnaire"
SET "code" = 'EDI-' || substr("code", 5)
WHERE "code" ~ '^[A-Z]{3}-' AND "code" NOT LIKE 'EDI-%';

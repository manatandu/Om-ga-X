-- « Se déconnecter » ferme la session sur le serveur (relevé de sécurité du
-- 2026-10-23, src/modules/auth/sessions-fermees.ts) · empreinte du jeton CSRF
-- de chaque session fermée et fin de sa vie possible. Liste vide pour tous.
ALTER TABLE "users" ADD COLUMN "sessionsFermees" JSONB NOT NULL DEFAULT '[]';

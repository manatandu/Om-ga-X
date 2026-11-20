# Avancement · ligne securite-connexion

Branche de sauvegarde `travail/securite-connexion`, partie de `origin/main`
(`bcd6db5e5`). Cinq corrections demandées par Manasse (« Go ») après l'audit
de sécurité par lecture (`/root/security-audit-skill/omegax/run-1/`) et le
rejeu `scripts/rejouer-attaques-connexion.cjs`. Rien d'autre.

## Fait

- (4) `validate-env.ts` refuse en production un secret absent, connu ou de
  moins de 32 caractères, message nommé sans la valeur ni sa longueur
  (`validate-env.spec.ts`) ; étape « Contrôle du secret de session » de
  `deploy-cloud-run.yml` avant les migrations, secret par l'environnement de
  l'étape, verdict seul (`chaine-de-livraison.spec.ts`). Valeurs jetables
  relues · workflows (toutes ≥ 32), scripts de rejeu (`rejouer-attaques-connexion`
  allongé), k6 README (allongé), paquet sur site (64 hexadécimaux, `Aleatoire 32`).
- (5) `POST /auth/logout` exige l'en-tête `application/json` (415,
  `MOTIF_DECONNEXION_EN_JSON`), corps facultatif ; l'écran et les tests
  navigateur envoient `{}`.

## Reste

1. Un inconnu ne tient plus un compte fermé (second facteur pendant le
   verrou ; lien de déverrouillage au seul titulaire).
2. Limite d'essais par adresse e-mail, partagée entre instances.
3. Le mot de passe actuel compte ses échecs.
4. Secret de session faible refusé au démarrage en production, et contrôlé
   avant le déploiement (`deploy-cloud-run.yml`).
5. Déconnexion en JSON seulement (415 sinon).
6. Rejeu étendu sur base jetable, relecteurs, suivi.

## Décisions

- (5) L'EN-TÊTE est lu, pas le corps (`req.is` rend null sans corps) · un
  formulaire d'un autre site ne peut poser `application/json` sans contrôle
  CORS préalable.

## Commandes de vérification

```bash
# serveur
npx tsc --noEmit && npx jest && npm run build
# client
cd client && npx tsc --noEmit && npm test && npm run build
# rejeu (base jetable PostgreSQL 16)
pg_ctlcluster 16 main start
DATABASE_URL=postgresql://reprise:reprise-jetable@127.0.0.1:5432/<base> node scripts/rejouer-attaques-connexion.cjs
```

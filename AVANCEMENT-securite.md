# AVANCEMENT · ligne securite (2026-10-23)

Demande de Manasse · « teste, attaque et renforce la sécurité de mon
application ». Sondes menées sur une instance JETABLE locale (serveur compilé,
base PostgreSQL jetable), jamais la production.

## Fait

- Dépendances du serveur · `npm audit fix` (proxy-addr, compression, express,
  brace-expansion…), surcharges `overrides` (multer 2.5.0, qs 6.16.1,
  body-parser 1.20.9, lodash 4.18.1), nodemailer 6.10.1 vers 10.2.1 (injection
  SMTP et d'en-têtes, déni de service de l'analyseur d'adresses). Rupture de
  la 7 à la 10 sans effet ici · Node 22, SMTP seul, le code `NoAuth` renommé
  `ENOAUTH` reste lu « authentification » par `cause-echec-envoi.ts`.
- Client · dompurify 3.4.17 (par posthog-js).
- Inscription publique · `typeLicence` refusé à la porte HTTP
  (`MOTIF_LICENCE_A_L_INSCRIPTION`) · rouverte, elle laissait l'inscrit se
  donner une licence perpétuelle (201 sondé).

## Sondes passées (instance jetable)

En-têtes (CSP, HSTS, nosniff, frame, referrer, x-powered-by masqué), CORS
d'une origine étrangère, cookie httpOnly SameSite=Lax, jeton hors du corps,
champ non déclaré refusé, licence de l'éditeur refusée, lecture sans session,
jeton `alg: none`, CSRF absent ou faux, cloisonnement (lecture, modification,
suppression, balance et écritures par exercice, journal d'audit, documents),
console fermée à un administrateur de cabinet, JSON malformé sans pile,
injection dans un filtre, traversée de chemin, même message adresse inconnue
et mot de passe faux, verrouillage, rôles cantonnés (lecture seule,
aide-comptable, gestionnaire de paie), élévation de privilège, mot de passe
provisoire, dépôts (HTML déguisé, SVG, polyglotte servi en pièce jointe
nosniff, 6 Mo refusés en 413), corps de 5 Mo.

## Reste

- Déconnexion · le cookie reste valable côté serveur après « Se déconnecter »
  (sondé · 200 après logout). En cours.
- Limitation de débit contournable par `X-Forwarded-For` sur un appel DIRECT à
  `*.run.app` (sondé · 25 essais sans 429) · se ferme dans l'infrastructure
  (`sauts-de-confiance.ts` le dit), à remonter à Manasse.
- Restant connus, sans correctif mineur · @nestjs 10 (avis modérés, correctif
  en 11), react-router 6 (redirection ouverte par barre oblique inverse,
  correctif en 7 · sans portée en HashRouter, aucun `navigate` sur une donnée
  de l'URL), glob, ajv, webpack (outillage de construction).

## Vérifier

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```

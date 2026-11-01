# Ligne commercial-site · avancement

Gel levé par Manasse le 2026-11-01 (« Fais tout le point 1 »). Branche de
sauvegarde `travail/commercial-site`. Hors ligne · le paiement par mobile money
(choix du prestataire par Manasse).

## 1. Refus par le serveur des logiciels non attribués · fait

- `src/common/logiciels/logiciels-des-routes.ts` · table fermée contrôleur
  → logiciel(s), lectures partagées (`lecture`, `TOUS`), méthodes rangées à
  part, contrôleurs communs avec motif ; `motifRefusLogiciel`.
- `JwtAuthGuard`, étape 3 bis, après le profil de fonctions · 403 nommé.
- `JwtStrategy` porte `restreindreLogiciels` et `logicielsAutorises`.
- `definirLogiciels` ferme les sessions (sauf administrateur, jamais restreint).
- Client · `/impressions-differees` quitte les chemins communs pour les
  tuiles Comptabilité, Tiers et trésorerie, Révision et audit (elle produit
  les livres, que le serveur refuse aux autres).
- `logiciels-des-routes.spec.ts` · table fermée contre les sources, et
  relevé des écrans de chaque tuile (appels `api.*` à chemin littéral,
  imports suivis) · aucun appel refusé à un utilisateur qui n'a que la tuile.
- e2e · `logiciels-refus.e2e.ts` (chaque commande de chaque tuile ouverte
  par un collaborateur restreint, contre-épreuve nommée) ;
  `ecran-logiciels.e2e.ts` mis à jour (l'attribution ferme les sessions).

Décisions
- Lus par toute tuile · natures, taxes, modes et modèles de règlement,
  paramètres du dossier, et la LISTE seule des comptes, journaux, devises,
  exercices, tiers (et la fiche du tiers), banques · ils alimentent les listes
  de choix. L'analyse d'un journal, l'aperçu de l'ouverture suivante, les
  réévaluations restent à la comptabilité.
- Un contrôleur inconnu de la table est refusé à l'utilisateur restreint
  (le spec empêche qu'il en existe un).

## 2. Formulaire de demande sur la page publique · fait

- `POST /demandes/information` (`src/modules/demande-information/`) · sans
  session, JSON seul, cinq par heure et par adresse, DTO fermé, consentement
  exigé (Code du numérique, art. 192 ; preuve dans le message, art. 196) ;
  message mis en file dans le dossier de l'éditeur vers
  `OPERATEURS_PLATEFORME` ; sans messagerie, sans opérateur ou sans dossier
  d'éditeur, 503 nommé et rien d'écrit ; un destinataire refusé par la file ne
  remonte jamais son adresse.
- `client/public/vitrine/` · section « Demande d'information », envoi par le
  script (bouton caché et désactivé sans script, la page le dit), message du
  serveur affiché, `?v=20261101` monté sur les deux fichiers.
- Politique de confidentialité · catégorie, traitement, fondement ; date au
  1er novembre 2026 (le bandeau de mesure se rouvre une fois).

## Vérification

```bash
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
DATABASE_URL=<base jetable migrée> node scripts/rejouer-commercial-site.cjs
cd e2e && npx playwright test logiciels-refus ecran-logiciels vitrine-demande
```

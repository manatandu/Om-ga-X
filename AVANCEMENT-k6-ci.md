# AVANCEMENT · ligne k6-ci

Branche de sauvegarde `travail/k6-ci`, copie `/home/user/wt-k6ci`, partie de
`origin/main` a940974 (intégration de la ligne k6-defauts). Demande de Manasse
du 2026-10-21 (« Fais ça tout en cascade ») · « les réglages du banc k6 sur
Cloud Run, Neon et PostgreSQL 17 et 18 n'ont pas été mesurés ».

## Décision

Cloud Run et Neon ne se mesurent d'aucun workflow · aucune préproduction
n'existe, et le banc crée des dizaines de dossiers à la minute (e2e/k6/README.md,
JAMAIS la production). Ce qui se mesure, c'est PostgreSQL 18 et 17, sur un
coureur GitHub, avec le serveur bridé comme en production · un workflow
MANUEL, `charge-k6.yml`, deux jambes indépendantes, aucun secret, artefacts.
Le reste (Cloud Run, Neon, PgBouncer) reste à `docs/test-de-charge-k6.md`
section 6, et c'est dit à Manasse.

## Fait

1. `.github/workflows/charge-k6.yml` · `workflow_dispatch` seul, entrées
   profil / cabinets / durée / version de base ; version servie relue ; k6
   épinglé (2.3.0) et somme vérifiée ; serveur `taskset -c 0`,
   `--max-old-space-size=460`, `connection_limit=10` ; puits de courriel et
   essai public ; `surveiller.sh` ; résumé en une ligne ; verdict sur le code
   de k6 (seuils du script) et sur les maillons non écrits ; artefacts.
2. CLAUDE.md § 5 (table, relue par `reglement-interieur.spec.ts`) et § 10 ;
   `docs/test-de-charge-k6.md` § 6 et § 8 ; `e2e/k6/README.md`.

## Reste

3. Specs `reglement-interieur`, `chaine-de-livraison`, `cadratins` ; relecture
   « échecs silencieux » du workflow (un tour) ; lancement réel du workflow
   sur la branche (`workflow_dispatch` avec `ref`) · au moins la jambe 18 en
   `fumee`, puis `palier` ; intégration sur `main`, fiche retirée, Manasse
   prévenu avec les chiffres.

# Avancement · ligne sage-l2 (tiers et règlements)

Branche de sauvegarde `travail/sage-l2`, copie `/home/user/wt-sage-l2`.
Fonctions de la ligne (architecture.md), dans l'ordre · n° 1, n° 3, n° 36
(« must »), puis n° 24, n° 31, n° 32, n° 27, n° 18 (part règlement).
Migrations dans la plage `20270180000100` et suivantes.

## Fait

(rien encore)

## Reste

1. n° 1 · modes de règlement (structure, fiche du tiers, saisie, règlement, art. 59 bis).
2. n° 3 · échéance calculée par le modèle de règlement du tiers en saisie, fenêtre multi-échéance, validation automatique.
3. n° 36 · écart de règlement sous un seuil, escompte financier.
4. n° 24 · qualité du tiers.
5. n° 31 · lieux de livraison des clients.
6. n° 32 · duplication d'un tiers.
7. n° 27 · modèles d'impression propres au tiers.
8. n° 18 · assistant de règlement.
9. Scénarios sur vraie base (n° 1, 3, 36), tests navigateur, bloc du § 3.

## Décisions par la loi

(au fil des fonctions)

## Questions à Manasse

(au fil des fonctions)

## Pour CLAUDE.md

(paragraphe du § 6, écrit à la fin)

## Pour build-log.md

| # | Date | Ligne | État | Ce qui manque | Plus dur que prévu |
|---|---|---|---|---|---|

## Pour features.csv

(au fil des fonctions)

## Commandes de vérification

```bash
cd /home/user/wt-sage-l2
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest <specs touchés> --maxWorkers=1
```

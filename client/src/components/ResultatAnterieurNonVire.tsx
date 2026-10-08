import { Aide } from './chrome/Aide';
import { montant } from '../lib/montants';
import type { ResultatAnterieurNonVire } from '../lib/types';

/**
 * UN EXERCICE CLÔTURÉ QUI PORTE ENCORE LE RÉSULTAT PRÉCÉDENT NON AFFECTÉ, DIT
 * (relecture de la passe V1, 2026-10-08).
 *
 * Le serveur tranche et sert (`resultatAnterieurNonVire`) · sur un exercice
 * clôturé avant que la clôture ne vire ce résultat au report à nouveau, le
 * poste du résultat l'additionne à celui de l'exercice. Le bilan s'équilibre,
 * et sans cet avis il présenterait deux résultats comme un seul. Le texte
 * qui cite la fiche du compte 13 va dans la bulle.
 */
export function AvisResultatAnterieurNonVire({ avis }: { avis?: ResultatAnterieurNonVire | null }) {
  if (!avis) return null;
  return (
    <div className="border border-warning/40 bg-warning-soft mt-2 px-3.5 py-2.5">
      <div className="text-[11.5px] font-bold mb-1 flex items-center gap-1.5">
        Résultat de l'exercice précédent non viré
        <Aide titre="Résultat de l'exercice précédent non viré" texte={avis.motif} source="Fiche du compte 13" />
      </div>
      <p className="text-[11.5px]">
        Le poste {avis.poste} inclut {montant(avis.montant)} de résultat de l'exercice précédent, resté au compte 13 à la
        clôture.
      </p>
    </div>
  );
}

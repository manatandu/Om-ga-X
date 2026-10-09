import { Aide } from './chrome/Aide';
import {
  TITRE_AVIS_COLONNE_N1,
  TITRE_AVIS_EXERCICE,
  phraseAvisColonneN1,
  phraseAvisExercice,
} from '../lib/resultat-anterieur-non-vire';
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
 *
 * LA COLONNE N-1 AUSSI (paquet 1, A1) · l'exercice qui suit un tel exercice
 * reprend son poste tel quel dans sa colonne N-1, rien n'est recalculé ; le
 * serveur le sert à part (`resultatAnterieurNonVireN1`), et l'écran le dit
 * sous le bilan, la colonne nommée. Les phrases vivent dans
 * `lib/resultat-anterieur-non-vire.ts`, où elles se testent.
 */
export function AvisResultatAnterieurNonVire({
  avis,
  avisN1,
}: {
  avis?: ResultatAnterieurNonVire | null;
  avisN1?: ResultatAnterieurNonVire | null;
}) {
  if (!avis && !avisN1) return null;
  return (
    <>
      {avis && (
        <div className="border border-warning/40 bg-warning-soft mt-2 px-3.5 py-2.5">
          <div className="text-[11.5px] font-bold mb-1 flex items-center gap-1.5">
            {TITRE_AVIS_EXERCICE}
            <Aide titre={TITRE_AVIS_EXERCICE} texte={avis.motif} source="Fiche du compte 13" />
          </div>
          <p className="text-[11.5px]">{phraseAvisExercice(avis)}</p>
        </div>
      )}
      {avisN1 && (
        <div className="border border-warning/40 bg-warning-soft mt-2 px-3.5 py-2.5">
          <div className="text-[11.5px] font-bold mb-1 flex items-center gap-1.5">
            {TITRE_AVIS_COLONNE_N1}
            <Aide titre={TITRE_AVIS_COLONNE_N1} texte={avisN1.motif} source="Fiche du compte 13" />
          </div>
          <p className="text-[11.5px]">{phraseAvisColonneN1(avisN1)}</p>
        </div>
      )}
    </>
  );
}

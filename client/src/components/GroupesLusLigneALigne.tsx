import type { GroupesLusLigneALigne as Groupes } from '../lib/types';
import { RAISON_GROUPES_LUS_LIGNE_A_LIGNE, texteGroupesLusLigneALigne } from '../lib/groupes-lus-ligne-a-ligne';

/**
 * Une ligne · les groupes de lettrage que l'état a lus ligne à ligne
 * (paquet 1, B5). Rien quand il n'y en a aucun.
 */
export function GroupesLusLigneALigne({ groupes, className = '' }: { groupes?: Groupes | null; className?: string }) {
  const texte = texteGroupesLusLigneALigne(groupes);
  if (!texte) return null;
  return (
    <p className={`text-[11px] text-warning ${className}`} title={RAISON_GROUPES_LUS_LIGNE_A_LIGNE}>
      {texte}
    </p>
  );
}

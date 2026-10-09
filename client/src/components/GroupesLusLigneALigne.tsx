import type { GroupesLusLigneALigne as Groupes } from '../lib/types';
import { raisonGroupesLusLigneALigne, texteGroupesLusLigneALigne } from '../lib/groupes-lus-ligne-a-ligne';

/**
 * Une ligne · les groupes de lettrage que l'état nomme, chacun avec son motif
 * (paquet 1, B5 ; mineur 7), la raison en infobulle. Rien quand il n'y en a
 * aucun.
 */
export function GroupesLusLigneALigne({ groupes, className = '' }: { groupes?: Groupes | null; className?: string }) {
  const texte = texteGroupesLusLigneALigne(groupes);
  if (!texte) return null;
  return (
    <p className={`text-[11px] text-warning ${className}`} title={raisonGroupesLusLigneALigne(groupes) ?? undefined}>
      {texte}
    </p>
  );
}

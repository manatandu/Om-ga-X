import type { GroupesLusLigneALigne as Groupes } from '../lib/types';
import { raisonGroupesLusLigneALigne, texteGroupesLusLigneALigne, type LectureDesGroupes } from '../lib/groupes-lus-ligne-a-ligne';

/**
 * Une ligne · les groupes de lettrage que l'état nomme, chacun avec son motif
 * (paquet 1, B5 ; mineur 7), la raison en infobulle. Rien quand il n'y en a
 * aucun.
 */
export function GroupesLusLigneALigne({
  groupes,
  lecture = 'etat',
  className = '',
}: {
  groupes?: Groupes | null;
  /** La relance réclame le groupe pour son net (relecture, M2) · l'infobulle le dit. */
  lecture?: LectureDesGroupes;
  className?: string;
}) {
  const texte = texteGroupesLusLigneALigne(groupes);
  if (!texte) return null;
  return (
    <p className={`text-[11px] text-warning ${className}`} title={raisonGroupesLusLigneALigne(groupes, lecture) ?? undefined}>
      {texte}
    </p>
  );
}

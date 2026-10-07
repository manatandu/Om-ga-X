/**
 * LA COLONNE N-1 D'UN ÉTAT, DITE (cas chiffrés de la clôture, Q3, 2026-10-07).
 *
 * Trois cas, que le serveur tranche et sert · l'exercice précédent est tenu
 * (rien à dire) ; il ne l'est pas mais le dossier a un bilan d'ouverture, et
 * la colonne N-1 du BILAN le lit (`mention`, AUDCIF art. 34 ou SYCEBNL
 * Partie 4 ch. 1 § 1.4) tandis que celle du COMPTE DE RÉSULTAT reste vide,
 * l'issue dite (`motif`) ; aucun des deux · la colonne reste vide, ce n'est
 * pas un zéro.
 */
export function ComparatifN1({
  exerciceN1Disponible,
  mention,
  motif,
  defaut = "Aucun exercice antérieur dans ce dossier : la colonne N-1 reste vide, ce n'est pas un zéro.",
  className = 'text-[11px] text-text-dim mb-1.5',
}: {
  exerciceN1Disponible: boolean;
  mention?: string | null;
  motif?: string | null;
  defaut?: string;
  className?: string;
}) {
  if (mention) return <p className={className}>{mention}</p>;
  if (exerciceN1Disponible) return null;
  return <p className={className}>{motif ?? defaut}</p>;
}

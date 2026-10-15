import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * LA RÉFÉRENCE RETIRÉE ENTRE LE CONTRÔLE ET L'ÉCRITURE (second tour de
 * relecture de la ligne sage-l2, m7) · le mode, le modèle de règlement, le
 * modèle d'impression ou le journal choisi est vérifié, puis l'écriture part ;
 * retiré entre les deux, la clé étrangère refuse (P2003) et la réponse était
 * une erreur 500 sans mot. Le refus se dit, nommé par la référence en cause,
 * en 409 · relire et choisir à nouveau.
 */
export function motifReferenceRetiree(champ: string): string {
  const nom = champ.includes('modeleImpression')
    ? "Le modèle d'impression choisi"
    : champ.includes('modeleReglement')
      ? 'Le modèle de règlement choisi'
      : champ.includes('modeReglement')
        ? 'Le mode de règlement choisi'
        : champ.includes('journal')
          ? 'Le journal choisi'
          : champ.includes('celluleGroupe')
            ? 'Le dossier du groupe choisi'
            : 'Un élément choisi';
  return `${nom} vient d'être retiré par une autre saisie · relisez la fiche et choisissez-en un autre.`;
}

/** Rend le 409 nommé d'une clé étrangère refusée ; toute autre erreur repart telle. */
export function conflitSiReferenceRetiree(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
    return new ConflictException(motifReferenceRetiree(String(e.meta?.field_name ?? '')));
  }
  return e;
}

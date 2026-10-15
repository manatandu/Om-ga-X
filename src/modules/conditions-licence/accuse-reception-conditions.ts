import { texteBrutDesConditions, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { AcceptationEnregistree } from './acceptation-conditions';

/**
 * L'ACCUSÉ DE RÉCEPTION D'UNE ACCEPTATION · Code du numérique (ordonnance-loi
 * n° 23/10 du 13 mars 2023), art. 55, al. 2 (« L'auteur de l'offre accuse
 * réception par voie électronique de la commande lui adressée ») et art. 56,
 * al. 1er (« Dès la conclusion du contrat électronique, le fournisseur est
 * tenu de transmettre au client une copie électronique dudit contrat »).
 *
 * Le corps ne porte aucun secret · il est écrit en clair dans la file, comme
 * tout message (voir `auth/avis-double-authentification.ts`). La copie du
 * contrat part en PIÈCE JOINTE TEXTE, le même texte que l'écran affiche,
 * engendré par `texteBrutDesConditions` · jamais une seconde rédaction.
 */

/** Date et heure au calendrier de Kinshasa, comme le reste du logiciel. */
export function horodatageKinshasa(instant: Date): string {
  return instant.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' });
}

export function nomPieceJointeConditions(version: number = VERSION_CONDITIONS_LICENCE.numero): string {
  return `conditions-de-licence-omegax-version-${version}.txt`;
}

export function accuseReceptionConditions(
  acceptation: AcceptationEnregistree,
  dossier: string,
): { sujet: string; corps: string; pieceJointe: { nom: string; texte: string } } {
  const v = VERSION_CONDITIONS_LICENCE;
  return {
    sujet: `OmegaX · Accusé de réception · conditions de licence, version ${acceptation.version}`,
    corps: [
      'Bonjour,',
      '',
      `VMG Consulting accuse réception de l’acceptation des conditions de licence d’OmegaX, version ${acceptation.version} du ${v.dateLisible}.`,
      '',
      `Dossier · ${dossier}`,
      `Acceptées par · ${acceptation.par}`,
      `Le · ${horodatageKinshasa(new Date(acceptation.le))} (heure de Kinshasa)`,
      '',
      'Le texte accepté est joint à ce message. Il reste consultable et imprimable dans OmegaX, menu « ? », Contrat de licence.',
      'Si vous n’êtes pas l’auteur de cette acceptation, prévenez l’administrateur de votre dossier.',
    ].join('\n'),
    pieceJointe: { nom: nomPieceJointeConditions(acceptation.version), texte: texteBrutDesConditions() },
  };
}

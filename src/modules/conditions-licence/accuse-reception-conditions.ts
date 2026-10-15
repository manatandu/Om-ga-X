import { VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { AcceptationEnregistree, AUTEUR_NON_ENREGISTRE } from './acceptation-conditions';
import { versionPubliee } from './versions-publiees';

/**
 * L'ACCUSÉ DE RÉCEPTION D'UNE ACCEPTATION · Code du numérique (ordonnance-loi
 * n° 23/10 du 13 mars 2023), art. 55, al. 2 (« L'auteur de l'offre accuse
 * réception par voie électronique de la commande lui adressée ») et art. 56,
 * al. 1er (« Dès la conclusion du contrat électronique, le fournisseur est
 * tenu de transmettre au client une copie électronique dudit contrat »).
 *
 * Le corps ne porte aucun secret · il est écrit en clair dans la file, comme
 * tout message (voir `auth/avis-double-authentification.ts`). La copie du
 * contrat part en PIÈCE JOINTE TEXTE · le texte ARCHIVÉ de la version acceptée
 * (`versions-publiees.ts`), le même que l'écran affiche, le spec le garantit.
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
  // Le texte JOINT est celui de la version acceptée, lu dans l'archive des
  // versions publiées (relecture M2) · jamais le générateur du jour, qui peut
  // déjà servir une version plus récente.
  // Une version absente de l'archive ne s'accuse pas sur un autre texte · le
  // service consigne l'échec et le dit (`NON_MIS_EN_FILE`).
  const publiee = versionPubliee(acceptation.version);
  if (!publiee) throw new Error(`La version ${acceptation.version} des conditions n’est pas dans l’archive des versions publiées.`);
  return {
    sujet: `OmegaX · Accusé de réception · conditions de licence, version ${acceptation.version}`,
    corps: [
      'Bonjour,',
      '',
      `VMG Consulting accuse réception de l’acceptation des conditions de licence d’OmegaX, version ${acceptation.version} du ${publiee.dateLisible}.`,
      '',
      `Dossier · ${dossier}`,
      `Acceptées par · ${acceptation.par ?? AUTEUR_NON_ENREGISTRE}`,
      `Le · ${horodatageKinshasa(new Date(acceptation.le))} (heure de Kinshasa)`,
      `Empreinte SHA-256 du texte accepté · ${acceptation.empreinte ?? 'non enregistrée'}`,
      '',
      'Le texte accepté est joint à ce message. Il reste consultable et imprimable dans OmegaX, menu « ? », Contrat de licence.',
      'Si vous n’êtes pas l’auteur de cette acceptation, prévenez l’administrateur de votre dossier.',
    ].join('\n'),
    pieceJointe: { nom: nomPieceJointeConditions(acceptation.version), texte: publiee.texte },
  };
}

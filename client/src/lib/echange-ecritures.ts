/**
 * L'ÉCHANGE D'ÉCRITURES, côté écran (ligne dossier-l9, fonction 102,
 * src/modules/exports/echange/). Les types que le serveur rend et deux aides
 * de lecture · aucune règle ici, le serveur juge et compte.
 */

export interface PieceDuCompteRendu {
  piece: string;
  message: string;
  refus: boolean;
}

export interface CompteRenduReception {
  simulation: boolean;
  receptionId: string | null;
  dossierSource: string;
  numeroExport: number;
  creees: number;
  modifiees: number;
  retirees: number;
  ignorees: number;
  refusees: number;
  pieces: PieceDuCompteRendu[];
  piecesTotal: number;
  tronque: boolean;
  avertissements: string[];
}

export interface ReceptionServie {
  id: string;
  etat: 'EN_COURS' | 'TERMINEE';
  dossierSource: string;
  numeroExportSource: number;
  nomFichier: string;
  empreinteFichier: string;
  recuLe: string;
  recuPar: string;
  termineeLe: string | null;
  nombreCreees: number;
  nombreModifiees: number;
  nombreRetirees: number;
  nombreIgnorees: number;
  nombreRefusees: number;
}

export interface ListeReceptions {
  receptions: ReceptionServie[];
  total: number;
  tronque: boolean;
}

export type EtatEcritureRecue = 'TENUE' | 'DETACHEE' | 'RETIREE_PAR_LA_SOURCE';

export interface EcritureRecueServie {
  id: string;
  etat: EtatEcritureRecue;
  identifiantSource: string;
  numeroExportSource: number;
  recueLe: string;
  detacheeLe: string | null;
  ecritureId: string | null;
  ecritureDetacheeId: string | null;
  ecriture: { numeroPiece: number | null; date: string; libelle: string; statut: string; journal: { code: string } } | null;
}

export interface ListeRecues {
  recues: EcritureRecueServie[];
  total: number;
  tronque: boolean;
}

export const LIBELLE_ETAT_RECUE: Record<EtatEcritureRecue, string> = {
  TENUE: "Tenue par l'échange",
  DETACHEE: 'Détachée',
  RETIREE_PAR_LA_SOURCE: "Retirée par l'expéditeur",
};

const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/** Le résumé d'un compte rendu · ce qui naît, change, part, reste. */
export function resumeReception(r: Pick<CompteRenduReception, 'creees' | 'modifiees' | 'retirees' | 'ignorees' | 'refusees'>): string {
  return [
    pluriel(r.creees, 'créée'),
    pluriel(r.modifiees, 'remplacée'),
    pluriel(r.retirees, 'retirée'),
    `${pluriel(r.ignorees, 'inchangée')}`,
    pluriel(r.refusees, 'refusée'),
  ].join(', ');
}

/** Lit un fichier en base64, par tranches (String.fromCharCode borne ses arguments). */
export async function lireEnBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 8192) binaire += String.fromCharCode(...octets.subarray(i, i + 8192));
  return btoa(binaire);
}

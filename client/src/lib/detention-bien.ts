import type { RoleUtilisateur } from './types';

/**
 * LIGNE MICROFINA M4 · LE DÉTENTEUR D'UN BIEN, côté écran. La règle est celle
 * du serveur (`src/modules/immobilisations/detention-bien.controller.ts`), qui
 * refuse de toute façon · l'écran la reprend pour ne pas proposer un volet
 * voué au refus (masquer ET refuser).
 *
 * Lire · administrateur, comptable, lecture seule. Écrire · administrateur et
 * comptable (`peutValider`). Les deux rôles cantonnés n'ont ni l'un ni
 * l'autre · le détenteur est un salarié nommé, et le registre du personnel
 * est fermé à l'aide-comptable ; le gestionnaire de paie n'a pas le registre
 * des immobilisations.
 */
export function detentionsLisiblesPar(role: RoleUtilisateur | undefined): boolean {
  return role === 'ADMIN_CABINET' || role === 'COMPTABLE' || role === 'LECTURE_SEULE';
}

export interface RecuServi {
  id: string;
  numero: number;
  nature: 'AFFECTATION' | 'TRANSFERT' | 'LIBERATION';
  dateActe: string;
  signature: { signataires: string | null; date: string | null; declareeLe: string; declareePar: string | null } | null;
}

export interface DetentionServie {
  id: string;
  bien: { id: string; designation: string; numeroInventaire: string | null };
  salarie: { id: string; nom: string };
  lieu: { id: string; code: string; intitule: string } | null;
  dateDebut: string;
  dateFin: string | null;
  observation: string | null;
  bienSortiPendantLaDetention: boolean;
  dateSortieDuBien: string | null;
  recuRemise: RecuServi | null;
  recuFin: RecuServi | null;
}

export const LIBELLE_NATURE_RECU: Record<RecuServi['nature'], string> = {
  AFFECTATION: 'Remise',
  TRANSFERT: 'Transfert',
  LIBERATION: 'Retour',
};

/** « 2026-03-01 » lu « 01/03/2026 » · une date absente se dit par « · », jamais par un vide. */
export function dateLue(iso: string | null | undefined): string {
  if (!iso) return '·';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

/**
 * LIGNE PAIE-SUITE · LE VISA D'UN PLAN D'ÉTALEMENT, ce que l'écran lit du
 * serveur (`personnel/visa-plan-etalement.ts`). Aucune règle ici · qui peut
 * viser, ce qui fait tomber le visa et la proposition retirée au bulletin se
 * jugent au serveur ; l'écran montre l'état et renvoie l'instant qu'il a montré.
 */
import type { VisaRibLu } from './visa-rib';

/** Même forme que le visa d'un RIB · seul le sens de l'option change. */
export type VisaPlanLu = VisaRibLu;

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

/** L'état en une ligne · « Visé par … », « Non visé · exigé pour la proposition », ou « Non visé ». */
export function etatDuVisaPlan(v: VisaPlanLu): string {
  if (v.vise) {
    const vise = `Plan visé par ${v.visePar ?? 'un utilisateur'}${v.viseLe ? ` le ${jour(v.viseLe)}` : ''}`;
    return v.saisiPar ? vise : `${vise} · auteur du plan inconnu`;
  }
  return v.exige ? 'Plan non visé · sa retenue n’est pas proposée au bulletin' : 'Plan non visé';
}

/** Le bouton « Viser le plan » · qui peut valider, sur un plan non visé qu'il n'a pas saisi. */
export function peutViserLePlan(v: VisaPlanLu | null | undefined, peutValider: boolean): boolean {
  return !!v && peutValider && !v.vise && !v.saisiParVous;
}

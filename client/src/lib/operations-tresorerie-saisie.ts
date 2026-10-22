import { lireNombre, type Lu } from './conditions-bancaires-saisie';

/**
 * LA SAISIE D'UN FINANCEMENT OU D'UN PLACEMENT (ligne sage-l3, fonction 47).
 * Même règle que les conditions bancaires · vide = absent, illisible = refus
 * NOMMÉ à l'écran et rien ne part (`Number("2,5 %")` partait en `null`, que le
 * serveur lit « non déclaré »). Un montant au point des milliers (« 500.000 »)
 * est AMBIGU et refusé. Les règles de fond restent au serveur
 * (`src/modules/tresorerie/operations-tresorerie.ts`).
 */
export type Type = 'FINANCEMENT' | 'PLACEMENT';
export type Mode = 'POST_COMPTES' | 'PRECOMPTES';

export interface ChampsOperation {
  type: Type;
  modeInterets: Mode;
  reference: string;
  journalBanqueId: string;
  journalOdId: string;
  comptePrincipalId: string;
  compteInteretsId: string;
  compteCourusId: string;
  compteFraisId: string;
  /** « FIXE » ou l'identifiant d'un taux de référence. */
  taux: string;
  tauxFixe: string;
  marge: string;
  baseCalcul: string;
  montant: string;
  frais: string;
  interetsPrecomptes: string;
  deblocableAToutMoment: '' | 'oui' | 'non';
  dateMiseEnPlace: string;
  dateEcheance: string;
  referenceConvention: string;
  dateConvention: string;
}

export type Corps<T> = { corps: T } | { refus: string };

const valeur = (lu: Lu) => ('valeur' in lu ? lu.valeur : null);

export function corpsOperation(c: ChampsOperation): Corps<Record<string, unknown>> {
  const montant = lireNombre(c.montant, 'montant');
  if ('illisible' in montant) return { refus: 'Montant illisible (écrivez 10 000 000 ou 10 000 000,00).' };
  if ('vide' in montant) return { refus: 'Le montant est exigé.' };
  const frais = lireNombre(c.frais, 'montant');
  if ('illisible' in frais) return { refus: 'Frais illisibles (écrivez 50 000 ou 50 000,00).' };
  const pre = lireNombre(c.interetsPrecomptes, 'montant');
  if ('illisible' in pre) return { refus: 'Intérêts précomptés illisibles (écrivez 75 000 ou 75 000,00).' };
  if (c.modeInterets === 'PRECOMPTES' && 'vide' in pre) return { refus: 'Les intérêts précomptés du décompte de la banque sont exigés.' };
  const fixe = c.taux === 'FIXE';
  const tauxFixe = lireNombre(c.tauxFixe);
  const marge = lireNombre(c.marge);
  if (fixe && !('valeur' in tauxFixe)) return { refus: 'Le taux fixe est exigé (en pour cent, par exemple 12 ou 11,5).' };
  if (!fixe && 'illisible' in marge) return { refus: 'Marge illisible (en points de pour cent, par exemple 3,75).' };
  // Une marge vide n'est pas zéro · le serveur la refuse aussi.
  if (!fixe && c.taux && 'vide' in marge) return { refus: "La marge est exigée avec un taux de référence · tapez 0 s'il n'y en a pas." };
  if (!c.taux) return { refus: 'Choisissez un taux fixe ou un taux de référence.' };
  const base = lireNombre(c.baseCalcul);
  return {
    corps: {
      type: c.type,
      modeInterets: c.modeInterets,
      reference: c.reference.trim(),
      journalBanqueId: c.journalBanqueId,
      journalOdId: c.journalOdId,
      comptePrincipalId: c.comptePrincipalId,
      compteInteretsId: c.compteInteretsId,
      ...(c.compteCourusId ? { compteCourusId: c.compteCourusId } : {}),
      ...(c.compteFraisId ? { compteFraisId: c.compteFraisId } : {}),
      ...(fixe ? { tauxFixe: valeur(tauxFixe) } : { tauxReferenceId: c.taux, marge: valeur(marge) }),
      baseCalcul: valeur(base),
      montant: valeur(montant),
      frais: valeur(frais),
      ...(c.modeInterets === 'PRECOMPTES' ? { interetsPrecomptes: valeur(pre) } : {}),
      ...(c.type === 'PLACEMENT' ? { deblocableAToutMoment: c.deblocableAToutMoment === '' ? null : c.deblocableAToutMoment === 'oui' } : {}),
      dateMiseEnPlace: c.dateMiseEnPlace,
      dateEcheance: c.dateEcheance,
      referenceConvention: c.referenceConvention.trim(),
      dateConvention: c.dateConvention,
    },
  };
}

/** Un montant seul (régularisation, intérêts de l'échéance) · vide ou illisible, refus nommé. */
export function montantExige(texte: string, objet: string): Corps<number> {
  const lu = lireNombre(texte, 'montant');
  if ('illisible' in lu) return { refus: `${objet} illisible (écrivez 303 333,33).` };
  if ('vide' in lu) return { refus: `${objet} est exigé.` };
  return { corps: lu.valeur };
}

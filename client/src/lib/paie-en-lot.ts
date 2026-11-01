import { jourDeKinshasaIso } from './roles-cantonnes';
/**
 * LIGNE PAIE-LOT · ce que l'écran lit et envoie. Aucun calcul de paie ici ·
 * le corps proposé et le verdict viennent du serveur, et l'émission envoie
 * EXACTEMENT ce corps à la route unitaire (`/personnel/salaries/:id/bulletins`).
 */

export type NatureInpp = 'PUBLIC' | 'PRIVE';
/** Au dossier, seulement ce qui qualifie l'employeur · le personnel domestique se déclare au salarié (art. 121, al. 2). */
export type RegimeSalarialDeclare = 'BAREME_ARTICLE_118' | 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE';

export interface ParametresPaie {
  natureEmployeurInpp: NatureInpp | null;
  effectifInpp: number | null;
  /** Premier mois (AAAA-MM) où nature et effectif valent · null sans déclaration. */
  inppDepuisMois: string | null;
  regimeSalarial: RegimeSalarialDeclare | null;
}

export const LIBELLES_REGIME: Record<RegimeSalarialDeclare, string> = {
  BAREME_ARTICLE_118: 'Barème progressif',
  FORFAIT_SALARIE_DE_MICRO_ENTREPRISE: 'Forfait des salariés d’une micro-entreprise',
};

/** Ce que la ligne a repris du dossier, avec sa source. */
export interface RepriseDuDossier {
  natureEmployeurInpp: NatureInpp | null;
  effectifInpp: number | null;
  inppDepuisMois: string | null;
  regimeSalarial: RegimeSalarialDeclare | null;
  source: string;
}

export interface CorpsPropose {
  moisDePaie: string;
  deviseStipulation?: 'USD';
  elements: { nature: string; libelle: string; montantFc?: number; montantUsd?: number }[];
  allocationsConge?: { congeId: string }[];
  natureEmployeurInpp?: NatureInpp;
  effectif?: number;
  regimeSalarial?: RegimeSalarialDeclare;
  joursPayes?: number;
  classeProfessionnelle?: number;
  personnesACharge?: number;
}

export interface VerdictLot {
  totalVerseFc: number;
  cotisationsTravailleurFc: number;
  cotisationsEmployeurFc: number;
  irppFc: number | null;
  netAPayerFc: number | null;
  conversion: { cours: number; dateCours: string } | null;
}

export type LigneLot =
  | { etat: 'DEJA_EMIS'; salarieId: string; nomComplet: string; matricule: string | null; bulletinNumero: number; motif: string }
  | {
      etat: 'REFUSE';
      salarieId: string;
      nomComplet: string;
      matricule: string | null;
      corps?: CorpsPropose;
      manques?: string[];
      reprise?: RepriseDuDossier;
      motifs: string[];
    }
  | {
      etat: 'EMISSIBLE' | 'NON_EMISSIBLE';
      salarieId: string;
      nomComplet: string;
      matricule: string | null;
      corps: CorpsPropose;
      manques: string[];
      salaireRepris: boolean;
      reprise: RepriseDuDossier;
      motifs: string[];
      verdict: VerdictLot;
      personnesAChargeProposees: number | null;
      avertissements: string[];
    };

export interface PropositionLot {
  mois: string;
  parametres: ParametresPaie;
  lignes: LigneLot[];
  totalActifs: number;
  sansContrat: number;
  tronque: boolean;
  plafond: number;
}

/** Un entier saisi · vide = `null` (« pas encore dit »), jamais zéro ; illisible = `undefined`. */
export function entierSaisi(v: string): number | null | undefined {
  const t = v.replace(/\s/g, '');
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

/**
 * LE CORPS ENVOYÉ À L'ÉMISSION · celui que le serveur a proposé, plus les
 * personnes à charge que le cabinet a RETENUES sur la ligne (art. 124 et
 * 125) · jamais celles du registre par défaut. Vide, le champ reste absent.
 */
export function corpsAEmettre(corps: CorpsPropose, personnesACharge: string): CorpsPropose | { refus: string } {
  const n = entierSaisi(personnesACharge);
  if (n === undefined || (n !== null && n > 99)) return { refus: 'Nombre de personnes à charge illisible.' };
  return n === null ? corps : { ...corps, personnesACharge: n };
}

/** Le résultat d'une émission du lot, salarié par salarié · jamais un compte global seul. */
export type IssueEmission = { salarieId: string; nomComplet: string } & (
  | { emis: true; numero: number }
  | { emis: false; motif: string }
);

/**
 * ÉMETTRE LES COCHÉS · l'un après l'autre, par la route unitaire. Un refus
 * n'arrête pas la suite et garde son motif.
 */
export async function emettreLesCoches(
  coches: readonly { salarieId: string; nomComplet: string; corps: CorpsPropose }[],
  emettre: (salarieId: string, corps: CorpsPropose) => Promise<{ numero: number }>,
  messageDErreur: (e: unknown) => string,
): Promise<IssueEmission[]> {
  const issues: IssueEmission[] = [];
  for (const c of coches) {
    try {
      const b = await emettre(c.salarieId, c.corps);
      issues.push({ salarieId: c.salarieId, nomComplet: c.nomComplet, emis: true, numero: b.numero });
    } catch (e) {
      issues.push({ salarieId: c.salarieId, nomComplet: c.nomComplet, emis: false, motif: messageDErreur(e) });
    }
  }
  return issues;
}

/**
 * LE PRÉREMPLISSAGE DE LA SIMULATION UNITAIRE · un champ déjà tapé n'est
 * jamais écrasé ; seul un champ vide reçoit le paramètre déclaré, un
 * paramètre non déclaré laisse le champ vide, et nature et effectif INPP ne
 * se reprennent que pour un mois couvert par leur déclaration (mois d'effet).
 */
export function prerempliParametres(
  champs: { natureInpp: string; effectifInpp: string; regimeSalarial: string },
  p: ParametresPaie,
  moisDePaie: string,
): { natureInpp: string; effectifInpp: string; regimeSalarial: string } {
  const couvert = p.inppDepuisMois !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(moisDePaie) && moisDePaie >= p.inppDepuisMois;
  return {
    natureInpp: champs.natureInpp || (couvert ? (p.natureEmployeurInpp ?? '') : ''),
    effectifInpp: champs.effectifInpp || (couvert && p.effectifInpp !== null ? String(p.effectifInpp) : ''),
    regimeSalarial: champs.regimeSalarial || (p.regimeSalarial ?? ''),
  };
}

/** Le mois courant à Kinshasa (UTC+1), jamais celui de l'horloge UTC. */
export function moisDeKinshasa(maintenant: Date): string {
  return jourDeKinshasaIso(maintenant).slice(0, 7);
}

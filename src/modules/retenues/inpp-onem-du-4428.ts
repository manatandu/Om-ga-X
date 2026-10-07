/**
 * LE 4428 « AUTRES IMPÔTS ET TAXES » N'EST PAS UN COMPTE D'INPP ET D'ONEM ·
 * relecture M1 du 2026-10-07 (ligne « corrections de la paie »).
 *
 * La décision T1 a porté la dette de l'INPP et de l'ONEM au 4428 (fiche du
 * compte 64 des deux plans, « par le crédit du compte 44 »), et la nature
 * `inppOnem` du registre des retenues lisait le compte ENTIER. Or le 4428 est
 * le compte de TOUS les autres impôts et taxes · une taxe étrangère portée là
 * par un dossier existant était annoncée comme INPP ou ONEM dû le 15 du mois
 * suivant, et pouvait sortir « en retard » au tableau de bord. Un contrôle qui
 * FABRIQUE une anomalie (CLAUDE.md, § 10 bis).
 *
 * UNE LIGNE DU 4428 EST DE L'INPP OU DE L'ONEM PAR SA STRUCTURE, JAMAIS PAR
 * SON NUMÉRO ·
 *  - son écriture est celle de la paie du mois, ou sa reprise en négatif
 *    (`BulletinPaie.ecritureId`, `BulletinPaie.ecritureNegatifId`) ;
 *  - ou son écriture porte la charge de l'INPP (6415) ou de l'ONEM (6413),
 *    les comptes que la passation de la paie leur donne (`passation-paie.ts`) ;
 *  - ou elle est LETTRÉE dans un groupe qui réunit une telle ligne · c'est
 *    ainsi qu'un reversement (D 4428 / C trésorerie) se rattache à la dette
 *    qu'il éteint.
 *
 * DEUX RÉGIMES, selon que le 4428 de l'exercice porte ou non autre chose ·
 *  - PUR · aucun crédit du 4428 ne vient d'ailleurs. Le compte entier est
 *    lu, reversements non lettrés et solde d'ouverture compris, comme avant
 *    la relecture · rien ne peut y être étranger.
 *  - MÊLÉ · un crédit au moins vient d'une autre taxe. Ne sont lues que les
 *    lignes rattachées par la structure ; le solde d'ouverture du 4428, qu'un
 *    report à-nouveau ne ventile pas, n'est pas lu ; les crédits étrangers et
 *    les reversements que rien ne rattache sont NOMMÉS avec leur montant.
 *    Tant qu'un reversement reste non rattaché, aucun mois n'est dit en
 *    retard · il peut éteindre l'INPP ou l'ONEM comme l'autre taxe, et le
 *    registre ne le sait pas. Lettrer le reversement avec la dette qu'il
 *    éteint lève l'incertitude.
 *
 * Les 4334 et 4335 des dossiers semés avant la décision T1 portent, eux, le
 * seul INPP et le seul ONEM par leur intitulé même · ils restent lus en entier.
 */

/** Le compte de la dette de l'INPP et de l'ONEM depuis la décision T1. */
export const RACINE_4428 = '4428';

/** La charge de l'ONEM (6413) et celle de l'INPP (6415), aux deux plans (`passation-paie.ts`). */
export const RACINES_CHARGE_INPP_ONEM = ['6413', '6415'] as const;

/** Ce que la requête du registre dit de l'écriture d'une ligne du 4428. */
export type StructureEcriture4428 = {
  /** L'écriture est la paie du mois ou sa reprise en négatif (un bulletin la porte). */
  readonly estDePaie?: boolean;
  /** L'écriture porte une ligne au 6413 ou au 6415. */
  readonly porteUneChargeInppOnem?: boolean;
};

export type LigneDu4428 = {
  readonly debit: unknown;
  readonly credit: unknown;
  readonly lettrageId?: string | null;
  readonly compte: { readonly numero: string };
  readonly ecriture: StructureEcriture4428;
};

export const estDu4428 = (numero: string): boolean => numero.startsWith(RACINE_4428);

export type Partage4428<L> = {
  /** Aucun crédit du 4428 de l'exercice ne vient d'une autre taxe. */
  readonly pur: boolean;
  /** Les lignes du 4428 que la nature `inppOnem` lit. */
  readonly lues: ReadonlySet<L>;
  /** Crédits du 4428 qu'aucune structure ne rattache à l'INPP ou à l'ONEM. */
  readonly creditsEtrangersFc: number;
  /** Reversements du 4428 qu'aucune structure ne rattache, en régime mêlé. */
  readonly reversementsNonRattachesFc: number;
};

/**
 * Le partage des lignes du 4428 de l'exercice (reports à-nouveau exclus par
 * l'appelant, qui les lit comme solde d'ouverture).
 */
export function partagerLe4428<L extends LigneDu4428>(lignes: readonly L[]): Partage4428<L> {
  const du4428 = lignes.filter((l) => estDu4428(l.compte.numero));
  const structurelle = (l: L) => l.ecriture.estDePaie === true || l.ecriture.porteUneChargeInppOnem === true;
  const rattachees = new Set<L>(du4428.filter(structurelle));
  const groupes = new Set(
    [...rattachees].map((l) => l.lettrageId).filter((g): g is string => typeof g === 'string' && g.length > 0),
  );
  for (const l of du4428) {
    if (l.lettrageId && groupes.has(l.lettrageId)) rattachees.add(l);
  }
  const etrangers = du4428.filter((l) => !rattachees.has(l) && Number(l.credit) > 0);
  const pur = etrangers.length === 0;
  const centimes = (v: number) => Math.round(v * 100) / 100;
  if (pur) {
    return { pur, lues: new Set(du4428), creditsEtrangersFc: 0, reversementsNonRattachesFc: 0 };
  }
  const nonRattaches = du4428.filter((l) => !rattachees.has(l) && Number(l.debit) > 0);
  return {
    pur,
    lues: rattachees,
    creditsEtrangersFc: centimes(etrangers.reduce((s, l) => s + Number(l.credit), 0)),
    reversementsNonRattachesFc: centimes(nonRattaches.reduce((s, l) => s + Number(l.debit), 0)),
  };
}

/** Ce que le registre dit du 4428 mêlé, avec ses montants · `null` quand il est pur. */
export function mentionDu4428Mele(p: Partage4428<unknown>, soldeOuverture4428Fc: number): string | null {
  if (p.pur) return null;
  return (
    `LE 4428 PORTE D'AUTRES IMPÔTS ET TAXES · ${p.creditsEtrangersFc.toFixed(2)} FC crédités cet exercice ne viennent ni de la paie ni d'une charge d'INPP (6415) ou d'ONEM (6413), et ne sont pas comptés ici. ` +
    (Math.abs(soldeOuverture4428Fc) > 0.005
      ? `Son solde d'ouverture (${soldeOuverture4428Fc.toFixed(2)} FC), qu'un report à-nouveau ne ventile pas, ne l'est pas non plus. `
      : '') +
    (p.reversementsNonRattachesFc > 0.005
      ? `${p.reversementsNonRattachesFc.toFixed(2)} FC de reversements au 4428 ne sont rattachés à aucune dette · tant qu'ils ne sont pas lettrés avec celle qu'ils éteignent, aucun mois de l'INPP et de l'ONEM n'est dit en retard.`
      : 'Les reversements comptés ici sont ceux que la paie ou un lettrage rattache.')
  );
}

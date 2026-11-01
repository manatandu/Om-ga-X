/**
 * LA VUE DE LA PAIE DU REGISTRE DES RETENUES (ligne paie-declarations, relecture
 * du 2026-11-01, MAJEUR 2). Le gestionnaire de paie lit le registre et
 * l'échéancier pour savoir quand reverser ce que la PAIE retient · il ne lit
 * pas la TVA, la retenue locative, les capitaux mobiliers, les prestataires non
 * résidents ni l'impôt sur les sociétés. La confidentialité tient au RÔLE
 * CANTONNÉ (CLAUDE.md § 8, « le personnel et la paie […] rien d'autre »), et le
 * filtre se pose AU SERVEUR, jamais à l'écran · une liste FERMÉE, gelée par
 * `vue-de-la-paie.spec.ts`.
 *
 *  · irppSalaires · l'impôt retenu sur les salaires (loi n° 23/053, art. 119) ;
 *  · cnss · les cotisations de la Caisse (loi n° 16/009, décret n° 18/041) ;
 *  · inppOnem · l'INPP et l'ONEM, ventilés au 4428 (décision T1) ;
 *  · autresOrganismesSociaux · retraites complémentaires et facultatives,
 *    mutuelles, que la paie peut retenir ;
 *  · declarationMensuelleOnem, declarationAnnuelleSalaires · les deux
 *    déclarations que le registre range sous la paie.
 *
 * Les totaux se recalculent sur les seules natures servies (sinon le « total
 * dû » dirait la TVA), les comptes non rattachés ne se servent pas (ils
 * nomment des comptes hors paie), et les avertissements gardés sont ceux des
 * natures servies, plus celui qui dit la vue.
 */
export const NATURES_DE_LA_PAIE: readonly string[] = ['irppSalaires', 'cnss', 'inppOnem', 'autresOrganismesSociaux'];
export const DECLARATIONS_DE_LA_PAIE: readonly string[] = ['declarationMensuelleOnem', 'declarationAnnuelleSalaires'];

export const AVERTISSEMENT_VUE_DE_LA_PAIE =
  'Vue de la paie · le registre ne sert au gestionnaire de paie que les retenues et cotisations de la paie (impôt sur les salaires, CNSS, INPP, ONEM, autres organismes sociaux).';

const servie = (cle: string) =>
  NATURES_DE_LA_PAIE.includes(cle) || DECLARATIONS_DE_LA_PAIE.includes(cle) || NATURES_DE_LA_PAIE.some((n) => cle.startsWith(`${n}-`));

const somme = (xs: number[]) => Math.round(xs.reduce((t, x) => t + Math.round(x * 100), 0)) / 100;

type NatureLue = {
  cle: string;
  retenu: number;
  reverse: number;
  solde: number;
  mention4428?: string | null;
  mentionNonVentilee?: string | null;
  mentionOuvertureNonVentilee?: string | null;
};

export function registreDeLaPaie<
  R extends { natures: NatureLue[]; comptesNonRattaches: unknown[]; signalementsDeductibilite: { cle: string }[]; avertissements: string[] },
>(r: R): R & { vueDeLaPaie: true } {
  const natures = r.natures.filter((n) => servie(n.cle));
  return {
    ...r,
    natures,
    totalRetenu: somme(natures.map((n) => n.retenu)),
    totalReverse: somme(natures.map((n) => n.reverse)),
    totalDu: somme(natures.map((n) => n.solde)),
    comptesNonRattaches: [],
    signalementsDeductibilite: r.signalementsDeductibilite.filter((s) => servie(s.cle)),
    avertissements: [
      AVERTISSEMENT_VUE_DE_LA_PAIE,
      ...natures.flatMap((n) => [n.mention4428, n.mentionNonVentilee, n.mentionOuvertureNonVentilee].filter((x): x is string => !!x)),
    ],
    vueDeLaPaie: true,
  };
}

export function echeancierDeLaPaie<E extends { echeances: { cle: string; genre: string; montantDu: number }[]; avertissements: string[] }>(
  e: E,
): E & { vueDeLaPaie: true } {
  const echeances = e.echeances.filter((x) => servie(x.cle));
  return {
    ...e,
    echeances,
    totalDu: somme(echeances.filter((x) => x.genre === 'REVERSEMENT').map((x) => x.montantDu)),
    avertissements: [AVERTISSEMENT_VUE_DE_LA_PAIE],
    vueDeLaPaie: true,
  };
}

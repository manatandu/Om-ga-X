import { FormeJuridiqueSyscohada, Referentiel, RegimeLiquidation } from '@prisma/client';
import {
  echeancierDissolution,
  echeanceDerniereCotisation,
  impotAnnuelCedeAuxCotisations,
} from './liquidation-societe';
import { FiscaliteService } from '../fiscalite/fiscalite.service';
import { TenantService } from '../tenant/tenant.service';

/**
 * Décisions par la loi du 2026-10-07, quatrième lot, points 2 à 5 · ce que la
 * dissolution change à l'échéancier fiscal et à l'impôt de l'année. Chaque
 * montant est calculé à la main dans le commentaire du test.
 */
const jour = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));
const iso = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));

const SARL = {
  forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
  dateDissolution: jour(2026, 5, 15),
  dateNominationLiquidateur: jour(2026, 5, 15),
  regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE,
  associeUniquePersonneMorale: false,
  dateClotureLiquidation: null as Date | null,
};

describe('Échéancier d’une société dissoute (points 3, 4 et 5 ; constat 9)', () => {
  it('la déclaration annuelle de l’IS cède dès l’année de la dissolution · celle de l’année précédente reste due', () => {
    const e = echeancierDissolution(SARL, jour(2026, 3, 1));
    // 30 avril 2026 · revenus de 2025, antérieurs à la dissolution.
    expect(e.retenir('declarationImpotSocietes', jour(2026, 4, 30))).toBe(true);
    // 30 avril 2027 · revenus de 2026, l'année de la dissolution · cède aux cotisations.
    expect(e.retenir('declarationImpotSocietes', jour(2027, 4, 30))).toBe(false);
    expect(impotAnnuelCedeAuxCotisations(SARL, { dateFin: jour(2025, 12, 31) })).toBe(false);
    expect(impotAnnuelCedeAuxCotisations(SARL, { dateFin: jour(2026, 5, 15) })).toBe(true);
    expect(impotAnnuelCedeAuxCotisations(SARL, { dateFin: jour(2027, 3, 10) })).toBe(true);
  });

  it('acomptes · dus dans l’année de la dissolution avant l’échéance de la dernière cotisation, jamais après', () => {
    // Clôture déclarée le 10 septembre 2026 · seconde cotisation au 10 octobre
    // 2026 (un samedi), reportée au lundi 12 octobre (LPF art. 110 bis).
    const faits = { ...SARL, dateClotureLiquidation: jour(2026, 9, 10) };
    expect(iso(echeanceDerniereCotisation(faits))).toBe('2026-10-12');
    const e = echeancierDissolution(faits, jour(2026, 6, 1));
    expect(e.retenir('premierAcompteIs', jour(2026, 7, 25))).toBe(true);
    expect(e.retenir('deuxiemeAcompteIs', jour(2026, 9, 25))).toBe(true);
    // 25 novembre 2026 · après l'échéance de la dernière cotisation.
    expect(e.retenir('troisiemeAcompteIs', jour(2026, 11, 25))).toBe(false);
    // Aucun acompte pour l'année qui suit celle de la dissolution.
    expect(e.retenir('premierAcompteIs', jour(2027, 7, 25))).toBe(false);
    // Une année antérieure garde ses acomptes, une autre obligation n'est pas touchée.
    expect(e.retenir('premierAcompteIs', jour(2025, 7, 25))).toBe(true);
    expect(e.retenir('retenueIpr', jour(2027, 1, 15))).toBe(true);
    expect(e.mentionAcompte).toContain('57 bis');
  });

  it('les deux déclarations de cotisation sont servies, « dans le mois » de date à date', () => {
    const faits = { ...SARL, dateClotureLiquidation: jour(2027, 3, 10) };
    const e = echeancierDissolution(faits, jour(2026, 5, 20));
    const parCle = new Map(e.cotisations.map((c) => [c.cle, c]));
    // 15 mai 2026 + un mois = 15 juin 2026, un lundi.
    expect(iso(parCle.get('cotisationSpecialeActivite')!.date)).toBe('2026-06-15');
    // 10 mars 2027 + un mois = 10 avril 2027, un samedi · lundi 12 avril.
    expect(iso(parCle.get('cotisationSpecialeLiquidation')!.date)).toBe('2027-04-12');
    // Déposée, ou échue, une déclaration n'est plus la prochaine.
    const deposee = echeancierDissolution({ ...faits, dateDeclarationCotisationActivite: jour(2026, 6, 1) }, jour(2026, 5, 20));
    expect(deposee.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeLiquidation']);
  });

  it('dissolution le dernier jour d’un mois court · la date servie est la plus précoce, l’autre lecture est dite', () => {
    // 30 juin 2026 · AUPSRVE (date à date) 30 juillet, CPC art. 195 (quantième
    // à veille de quantième) 31 juillet. Servie · le 30 juillet, un jeudi.
    const e = echeancierDissolution({ ...SARL, dateDissolution: jour(2026, 6, 30) }, jour(2026, 7, 1));
    const c = e.cotisations.find((x) => x.cle === 'cotisationSpecialeActivite')!;
    expect(iso(c.date)).toBe('2026-07-30');
    expect(c.echeance).toContain('31/07/2026');
  });

  it('sans clôture déclarée · la seconde n’a pas d’échéance, les acomptes de l’année restent dus, et c’est dit', () => {
    const e = echeancierDissolution(SARL, jour(2026, 6, 1));
    expect(e.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeActivite']);
    expect(e.retenir('troisiemeAcompteIs', jour(2026, 11, 25))).toBe(true);
    expect(e.avertissements.join(' ')).toContain('clôture de la liquidation');
  });

  it('sans liquidation (associé unique personne morale) · une seule cotisation, et aucun acompte après elle', () => {
    const faits = {
      ...SARL,
      forme: FormeJuridiqueSyscohada.SOCIETE_ANONYME,
      associeUniquePersonneMorale: true,
      dateNominationLiquidateur: null,
      regimeLiquidation: null,
    };
    expect(iso(echeanceDerniereCotisation(faits))).toBe('2026-06-15');
    const e = echeancierDissolution(faits, jour(2026, 5, 20));
    expect(e.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeActivite']);
    expect(e.retenir('premierAcompteIs', jour(2026, 7, 25))).toBe(false);
  });

  it('coopérative et procédure collective · les cotisations sont dues (point 7) ; une association, non', () => {
    const coop = echeancierDissolution({ ...SARL, forme: FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE }, jour(2026, 5, 20));
    expect(coop.cotisationsDues).toBe(true);
    const pc = echeancierDissolution({ ...SARL, regimeLiquidation: RegimeLiquidation.PROCEDURE_COLLECTIVE }, jour(2026, 5, 20));
    expect(pc.cotisationsDues).toBe(true);
    const gie = echeancierDissolution({ ...SARL, forme: FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE }, jour(2026, 5, 20));
    expect(gie.cotisationsDues).toBe(false);
    expect(gie.retenir('declarationImpotSocietes', jour(2027, 4, 30))).toBe(true);
  });
});

describe('Bilans successifs de l’année de la dissolution (point 2 ; constat 12)', () => {
  const ARRETE = { id: 'n', dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 5, 15) };
  const LIQ = { id: 'l', dateDebut: jour(2026, 5, 16), dateFin: jour(2027, 3, 10) };
  const tenant = {
    dateDissolution: SARL.dateDissolution,
    formeJuridiqueSyscohada: SARL.forme,
    regimeLiquidation: SARL.regimeLiquidation,
    associeUniquePersonneMorale: false,
  };
  function service(options: { constat?: number | null; impotAu89?: number; reintegre?: number; statut?: 'OUVERT' | 'CLOTURE' } = {}) {
    const constat = options.constat === undefined ? 2_700_000 : options.constat;
    // L'impôt au 89 de l'exercice arrêté · celui du constat, à défaut rien.
    const au89 = options.impotAu89 ?? constat ?? 0;
    const s = new FiscaliteService(
      {
        exercice: { findFirst: async () => ({ ...ARRETE, statut: options.statut ?? 'OUVERT' }) },
        // M3 · la première cotisation se lit sur le constat NON ANNULÉ de
        // l'exercice arrêté · la doublure honore la requête.
        constatImpotResultat: {
          findFirst: async ({ where }: { where: { exerciceId: string; annuleeLe: null } }) =>
            constat !== null && where.exerciceId === ARRETE.id && where.annuleeLe === null ? { montantImpot: constat } : null,
        },
      } as never,
      {} as never,
    );
    // Période d'activité · base avant report 10 000 000, déficit antérieur
    // disponible 1 000 000 (tout imputé), 9 000 000 × 30 % = 2 700 000 ;
    // chiffre d'affaires 30 000 000.
    jest.spyOn(s, 'resultatFiscal').mockResolvedValue({
      resultatFiscal: 9_000_000,
      deficitImpute: 1_000_000,
      deficitAnterieur: { montant: 1_000_000 },
      chiffreAffairesMinimum: 30_000_000,
      impotDu: 2_700_000,
      impotConstateAu89: au89,
      impotExerciceAu89: au89,
      reintegrationsImpot: options.reintegre ?? au89,
    } as never);
    return s as unknown as {
      bilansSuccessifsDe: (t: string, ten: typeof tenant, e: typeof LIQ, c: Record<string, unknown>) => Promise<{
        role: string;
        calculable: boolean;
        premiereCotisation: number | null;
        totalisation: Record<string, number | null> | null;
      }>;
    };
  }
  const courant = (base: number) => ({
    base,
    chiffreAffaires: 20_000_000,
    impotDu: null,
    acomptesVerses: 300_000,
    regime: 'IMPOT_SOCIETES',
    natureActivite: null,
  });

  it('une assiette · total 15 000 000, report 1 000 000, impôt 4 200 000, seconde = 4 200 000 − 2 700 000 − 300 000', async () => {
    // Liquidation 5 000 000 · total 15 000 000 − 1 000 000 = 14 000 000 × 30 %
    // = 4 200 000 ; minimum 1 % de 50 000 000 = 500 000 ; seconde 1 200 000.
    const b = await service().bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000));
    expect(b.role).toBe('SECONDE_COTISATION');
    expect(b.calculable).toBe(true);
    expect(b.totalisation).toMatchObject({
      total: 15_000_000,
      deficitImpute: 1_000_000,
      resultatFiscal: 14_000_000,
      chiffreAffaires: 50_000_000,
      impotTotal: 4_200_000,
      dejaRegle: 3_000_000,
      secondeCotisation: 1_200_000,
      excedent: 0,
    });
  });

  it('une liquidation en perte · seconde nulle, l’excédent réglé se SÉPARE · première cotisation au 441, acomptes au 4492', async () => {
    // Liquidation − 2 000 000 · total 8 000 000 − 1 000 000 = 7 000 000 × 30 %
    // = 2 100 000 ; réglé 2 700 000 + 300 000 = 3 000 000 · excédent 900 000,
    // dont 2 700 000 − 2 100 000 = 600 000 de première cotisation (dette de
    // l'État, D 441 / C 8994, décision de Manasse du 2026-10-08) et les 300 000
    // d'acomptes, qui restent au 4492 (LPF art. 57 ter).
    const b = (await service().bilansSuccessifsDe('t', tenant, LIQ, courant(-2_000_000))) as unknown as {
      totalisation: Record<string, number | null>;
      observation: string;
    };
    expect(b.totalisation).toMatchObject({
      impotTotal: 2_100_000,
      secondeCotisation: 0,
      excedent: 900_000,
      cotisationDeLExercice: 0,
      tropPayePremiereCotisation: 600_000,
      excedentAcomptes: 300_000,
    });
    expect(b.observation).toContain('au débit du 441 par le crédit du 8994');
    expect(b.observation).toContain('jamais un remboursement à encaisser');
    expect(b.observation).toContain('qui restent au 4492 (LPF art. 57 ter');
  });

  it('première cotisation sous l’impôt de l’année, acomptes au-delà · aucun trop-payé au 441, l’excédent d’acomptes reste au 4492', async () => {
    // Liquidation 500 000 · total 10 500 000 − 1 000 000 = 9 500 000 × 30 % =
    // 2 850 000 ; cotisation de l'exercice 150 000 ; acomptes 300 000 · 150 000
    // d'acomptes en trop, aucun trop-payé de la première.
    const b = await service().bilansSuccessifsDe('t', tenant, LIQ, courant(500_000));
    expect(b.totalisation).toMatchObject({
      impotTotal: 2_850_000,
      cotisationDeLExercice: 150_000,
      secondeCotisation: 0,
      excedent: 150_000,
      tropPayePremiereCotisation: 0,
      excedentAcomptes: 150_000,
    });
  });

  /*
    LIGNE TVA-DECISIONS, RELECTURE « ÉCHECS SILENCIEUX », M3 · la première
    cotisation était RECALCULÉE · constat 6 000 000, réintégration non saisie,
    relue 4 200 000, trop-payé faux, aucun refus.
  */
  it('M3 · la première cotisation est celle du CONSTAT, jamais recalculée', async () => {
    // Constat 3 000 000 (recalcul 2 700 000) · liquidation 5 000 000, impôt de
    // l'année 4 200 000, seconde 4 200 000 − 3 000 000 − 300 000 = 900 000.
    const b = await service({ constat: 3_000_000, impotAu89: 3_000_000, reintegre: 3_000_000 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000));
    expect(b.calculable).toBe(true);
    expect(b.premiereCotisation).toBe(3_000_000);
    expect(b.totalisation).toMatchObject({ dejaRegle: 3_300_000, secondeCotisation: 900_000 });
  });

  it('M3 · sans constat de la première, la totalisation est REFUSÉE, nommée avec l’issue', async () => {
    const b = (await service({ constat: null }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000))) as unknown as { calculable: boolean; motif: string; totalisation: unknown };
    expect(b.calculable).toBe(false);
    expect(b.totalisation).toBeNull();
    expect(b.motif).toMatch(/n'est pas constatée · passez l'écriture de l'impôt de cet exercice/);
  });

  /*
    SECOND TOUR, BLOQUANT 2 · sans constat, renvoyer à « passer l'écriture de
    l'impôt » enfermait le dossier quand l'écriture de l'impôt la refuse
    (exercice clôturé, impôt déjà passé à la main au 891 ou au 895).
  */
  it('BLOQUANT 2 · sans constat, l’impôt passé à la main au 891 et au 895 fait la première cotisation, et c’est dit', async () => {
    const b = (await service({ constat: null, impotAu89: 3_000_000 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000))) as unknown as {
      calculable: boolean;
      premiereCotisation: number;
      sourcePremiereCotisation: string;
      observation: string;
      totalisation: Record<string, number>;
    };
    expect(b.calculable).toBe(true);
    expect(b.sourcePremiereCotisation).toBe('COMPTE_89');
    expect(b.premiereCotisation).toBe(3_000_000);
    expect(b.totalisation).toMatchObject({ secondeCotisation: 900_000 });
    expect(b.observation).toContain('lue sur le débit du 891 et du 895');
  });

  it('BLOQUANT 2 · exercice arrêté CLÔTURÉ sans constat ni impôt au 89 · la première est recalculée, avec sa réserve', async () => {
    const b = (await service({ constat: null, statut: 'CLOTURE' }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000))) as unknown as {
      calculable: boolean;
      premiereCotisation: number;
      sourcePremiereCotisation: string;
      observation: string;
    };
    expect(b.calculable).toBe(true);
    expect(b.sourcePremiereCotisation).toBe('RECALCUL');
    expect(b.premiereCotisation).toBe(2_700_000);
    expect(b.observation).toContain('RECALCULÉE');
  });

  it('M3 · l’impôt de la période d’activité non réintégré à sa mesure · refus nommé, jamais une base fausse', async () => {
    const b = (await service({ constat: 6_000_000, impotAu89: 6_000_000, reintegre: 0 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000))) as unknown as {
      calculable: boolean;
      motif: string;
    };
    expect(b.calculable).toBe(false);
    expect(b.motif).toMatch(/n'est pas réintégré à sa mesure/);
  });

  it('l’exercice arrêté porte la première · un exercice non arrêté ne sépare rien', async () => {
    const s = service();
    const premiere = await s.bilansSuccessifsDe('t', tenant, { ...ARRETE } as never, courant(9_000_000));
    expect(premiere.role).toBe('PREMIERE_COTISATION');
    const mele = await s.bilansSuccessifsDe('t', tenant, { id: 'x', dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31) } as never, courant(0));
    expect(mele.role).toBe('NON_CALCULEE');
    expect(mele.calculable).toBe(false);
  });
});

describe('La dissolution qui borne un exercice ne change plus seule (constat 2)', () => {
  function service(exerciceArrete: boolean) {
    const t = {
      id: 't1',
      referentiel: Referentiel.SYSCOHADA,
      formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      dateDissolution: jour(2026, 5, 15),
    };
    return new TenantService({
      tenant: { findUnique: async () => t, findUniqueOrThrow: async () => t, update: async () => ({ id: 't1' }) },
      exercice: {
        findFirst: async ({ where }: { where: { dateFin?: Date } }) =>
          exerciceArrete && where.dateFin?.getTime() === t.dateDissolution.getTime()
            ? { dateDebut: jour(2026, 1, 1), dateFin: t.dateDissolution }
            : null,
        count: async () => 0,
      },
      ecriture: { count: async () => 0 },
      compte: { findMany: async () => [] },
    } as never);
  }

  it('un exercice arrêté à la dissolution refuse de la déplacer, avec l’issue', async () => {
    await expect(service(true).modifierIdentite('t1', { dateDissolution: '2026-06-30' })).rejects.toThrow('Annuler l');
    await expect(service(false).modifierIdentite('t1', { dateDissolution: '2026-06-30' })).resolves.toBeDefined();
  });
});

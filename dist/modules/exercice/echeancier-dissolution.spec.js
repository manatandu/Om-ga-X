"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const liquidation_societe_1 = require("./liquidation-societe");
const fiscalite_service_1 = require("../fiscalite/fiscalite.service");
const tenant_service_1 = require("../tenant/tenant.service");
const jour = (a, m, j) => new Date(Date.UTC(a, m - 1, j));
const iso = (d) => (d === null ? null : d.toISOString().slice(0, 10));
const SARL = {
    forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    dateDissolution: jour(2026, 5, 15),
    dateNominationLiquidateur: jour(2026, 5, 15),
    regimeLiquidation: client_1.RegimeLiquidation.AMIABLE_STATUTAIRE,
    associeUniquePersonneMorale: false,
    dateClotureLiquidation: null,
};
describe('Échéancier d’une société dissoute (points 3, 4 et 5 ; constat 9)', () => {
    it('la déclaration annuelle de l’IS cède dès l’année de la dissolution · celle de l’année précédente reste due', () => {
        const e = (0, liquidation_societe_1.echeancierDissolution)(SARL, jour(2026, 3, 1));
        expect(e.retenir('declarationImpotSocietes', jour(2026, 4, 30))).toBe(true);
        expect(e.retenir('declarationImpotSocietes', jour(2027, 4, 30))).toBe(false);
        expect((0, liquidation_societe_1.impotAnnuelCedeAuxCotisations)(SARL, { dateFin: jour(2025, 12, 31) })).toBe(false);
        expect((0, liquidation_societe_1.impotAnnuelCedeAuxCotisations)(SARL, { dateFin: jour(2026, 5, 15) })).toBe(true);
        expect((0, liquidation_societe_1.impotAnnuelCedeAuxCotisations)(SARL, { dateFin: jour(2027, 3, 10) })).toBe(true);
    });
    it('acomptes · dus dans l’année de la dissolution avant l’échéance de la dernière cotisation, jamais après', () => {
        const faits = { ...SARL, dateClotureLiquidation: jour(2026, 9, 10) };
        expect(iso((0, liquidation_societe_1.echeanceDerniereCotisation)(faits))).toBe('2026-10-12');
        const e = (0, liquidation_societe_1.echeancierDissolution)(faits, jour(2026, 6, 1));
        expect(e.retenir('premierAcompteIs', jour(2026, 7, 25))).toBe(true);
        expect(e.retenir('deuxiemeAcompteIs', jour(2026, 9, 25))).toBe(true);
        expect(e.retenir('troisiemeAcompteIs', jour(2026, 11, 25))).toBe(false);
        expect(e.retenir('premierAcompteIs', jour(2027, 7, 25))).toBe(false);
        expect(e.retenir('premierAcompteIs', jour(2025, 7, 25))).toBe(true);
        expect(e.retenir('retenueIpr', jour(2027, 1, 15))).toBe(true);
        expect(e.mentionAcompte).toContain('57 bis');
    });
    it('les deux déclarations de cotisation sont servies, « dans le mois » de date à date', () => {
        const faits = { ...SARL, dateClotureLiquidation: jour(2027, 3, 10) };
        const e = (0, liquidation_societe_1.echeancierDissolution)(faits, jour(2026, 5, 20));
        const parCle = new Map(e.cotisations.map((c) => [c.cle, c]));
        expect(iso(parCle.get('cotisationSpecialeActivite').date)).toBe('2026-06-15');
        expect(iso(parCle.get('cotisationSpecialeLiquidation').date)).toBe('2027-04-12');
        const deposee = (0, liquidation_societe_1.echeancierDissolution)({ ...faits, dateDeclarationCotisationActivite: jour(2026, 6, 1) }, jour(2026, 5, 20));
        expect(deposee.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeLiquidation']);
    });
    it('dissolution le dernier jour d’un mois court · la date servie est la plus précoce, l’autre lecture est dite', () => {
        const e = (0, liquidation_societe_1.echeancierDissolution)({ ...SARL, dateDissolution: jour(2026, 6, 30) }, jour(2026, 7, 1));
        const c = e.cotisations.find((x) => x.cle === 'cotisationSpecialeActivite');
        expect(iso(c.date)).toBe('2026-07-30');
        expect(c.echeance).toContain('31/07/2026');
    });
    it('sans clôture déclarée · la seconde n’a pas d’échéance, les acomptes de l’année restent dus, et c’est dit', () => {
        const e = (0, liquidation_societe_1.echeancierDissolution)(SARL, jour(2026, 6, 1));
        expect(e.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeActivite']);
        expect(e.retenir('troisiemeAcompteIs', jour(2026, 11, 25))).toBe(true);
        expect(e.avertissements.join(' ')).toContain('clôture de la liquidation');
    });
    it('sans liquidation (associé unique personne morale) · une seule cotisation, et aucun acompte après elle', () => {
        const faits = {
            ...SARL,
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            associeUniquePersonneMorale: true,
            dateNominationLiquidateur: null,
            regimeLiquidation: null,
        };
        expect(iso((0, liquidation_societe_1.echeanceDerniereCotisation)(faits))).toBe('2026-06-15');
        const e = (0, liquidation_societe_1.echeancierDissolution)(faits, jour(2026, 5, 20));
        expect(e.cotisations.map((c) => c.cle)).toEqual(['cotisationSpecialeActivite']);
        expect(e.retenir('premierAcompteIs', jour(2026, 7, 25))).toBe(false);
    });
    it('coopérative et procédure collective · les cotisations sont dues (point 7) ; une association, non', () => {
        const coop = (0, liquidation_societe_1.echeancierDissolution)({ ...SARL, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE }, jour(2026, 5, 20));
        expect(coop.cotisationsDues).toBe(true);
        const pc = (0, liquidation_societe_1.echeancierDissolution)({ ...SARL, regimeLiquidation: client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE }, jour(2026, 5, 20));
        expect(pc.cotisationsDues).toBe(true);
        const gie = (0, liquidation_societe_1.echeancierDissolution)({ ...SARL, forme: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE }, jour(2026, 5, 20));
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
    function service(options = {}) {
        const constat = options.constat === undefined ? 2_700_000 : options.constat;
        const au89 = options.impotAu89 ?? constat ?? 0;
        const s = new fiscalite_service_1.FiscaliteService({
            exercice: { findFirst: async () => ({ ...ARRETE, statut: options.statut ?? 'OUVERT' }) },
            constatImpotResultat: {
                findFirst: async ({ where }) => constat !== null && where.exerciceId === ARRETE.id && where.annuleeLe === null ? { montantImpot: constat } : null,
            },
        }, {});
        jest.spyOn(s, 'resultatFiscal').mockResolvedValue({
            resultatFiscal: 9_000_000,
            deficitImpute: 1_000_000,
            deficitAnterieur: { montant: 1_000_000 },
            chiffreAffairesMinimum: 30_000_000,
            impotDu: 2_700_000,
            impotConstateAu89: au89,
            impotExerciceAu89: au89,
            reintegrationsImpot: options.reintegre ?? au89,
        });
        return s;
    }
    const courant = (base) => ({
        base,
        chiffreAffaires: 20_000_000,
        impotDu: null,
        acomptesVerses: 300_000,
        regime: 'IMPOT_SOCIETES',
        natureActivite: null,
    });
    it('une assiette · total 15 000 000, report 1 000 000, impôt 4 200 000, seconde = 4 200 000 − 2 700 000 − 300 000', async () => {
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
        const b = (await service().bilansSuccessifsDe('t', tenant, LIQ, courant(-2_000_000)));
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
    it('M3 · la première cotisation est celle du CONSTAT, jamais recalculée', async () => {
        const b = await service({ constat: 3_000_000, impotAu89: 3_000_000, reintegre: 3_000_000 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000));
        expect(b.calculable).toBe(true);
        expect(b.premiereCotisation).toBe(3_000_000);
        expect(b.totalisation).toMatchObject({ dejaRegle: 3_300_000, secondeCotisation: 900_000 });
    });
    it('M3 · sans constat de la première, la totalisation est REFUSÉE, nommée avec l’issue', async () => {
        const b = (await service({ constat: null }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000)));
        expect(b.calculable).toBe(false);
        expect(b.totalisation).toBeNull();
        expect(b.motif).toMatch(/n'est pas constatée · passez l'écriture de l'impôt de cet exercice/);
    });
    it('BLOQUANT 2 · sans constat, l’impôt passé à la main au 891 et au 895 fait la première cotisation, et c’est dit', async () => {
        const b = (await service({ constat: null, impotAu89: 3_000_000 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000)));
        expect(b.calculable).toBe(true);
        expect(b.sourcePremiereCotisation).toBe('COMPTE_89');
        expect(b.premiereCotisation).toBe(3_000_000);
        expect(b.totalisation).toMatchObject({ secondeCotisation: 900_000 });
        expect(b.observation).toContain('lue sur le débit du 891 et du 895');
    });
    it('BLOQUANT 2 · exercice arrêté CLÔTURÉ sans constat ni impôt au 89 · la première est recalculée, avec sa réserve', async () => {
        const b = (await service({ constat: null, statut: 'CLOTURE' }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000)));
        expect(b.calculable).toBe(true);
        expect(b.sourcePremiereCotisation).toBe('RECALCUL');
        expect(b.premiereCotisation).toBe(2_700_000);
        expect(b.observation).toContain('RECALCULÉE');
    });
    it('M3 · l’impôt de la période d’activité non réintégré à sa mesure · refus nommé, jamais une base fausse', async () => {
        const b = (await service({ constat: 6_000_000, impotAu89: 6_000_000, reintegre: 0 }).bilansSuccessifsDe('t', tenant, LIQ, courant(5_000_000)));
        expect(b.calculable).toBe(false);
        expect(b.motif).toMatch(/n'est pas réintégré à sa mesure/);
    });
    it('l’exercice arrêté porte la première · un exercice non arrêté ne sépare rien', async () => {
        const s = service();
        const premiere = await s.bilansSuccessifsDe('t', tenant, { ...ARRETE }, courant(9_000_000));
        expect(premiere.role).toBe('PREMIERE_COTISATION');
        const mele = await s.bilansSuccessifsDe('t', tenant, { id: 'x', dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31) }, courant(0));
        expect(mele.role).toBe('NON_CALCULEE');
        expect(mele.calculable).toBe(false);
    });
});
describe('La dissolution qui borne un exercice ne change plus seule (constat 2)', () => {
    function service(exerciceArrete) {
        const t = {
            id: 't1',
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            dateDissolution: jour(2026, 5, 15),
        };
        return new tenant_service_1.TenantService({
            tenant: { findUnique: async () => t, findUniqueOrThrow: async () => t, update: async () => ({ id: 't1' }) },
            exercice: {
                findFirst: async ({ where }) => exerciceArrete && where.dateFin?.getTime() === t.dateDissolution.getTime()
                    ? { dateDebut: jour(2026, 1, 1), dateFin: t.dateDissolution }
                    : null,
                count: async () => 0,
            },
            ecriture: { count: async () => 0 },
            compte: { findMany: async () => [] },
        });
    }
    it('un exercice arrêté à la dissolution refuse de la déplacer, avec l’issue', async () => {
        await expect(service(true).modifierIdentite('t1', { dateDissolution: '2026-06-30' })).rejects.toThrow('Annuler l');
        await expect(service(false).modifierIdentite('t1', { dateDissolution: '2026-06-30' })).resolves.toBeDefined();
    });
});
//# sourceMappingURL=echeancier-dissolution.spec.js.map
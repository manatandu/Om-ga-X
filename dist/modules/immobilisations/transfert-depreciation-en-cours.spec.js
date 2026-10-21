"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const transfert_depreciation_en_cours_1 = require("./transfert-depreciation-en-cours");
const immobilisation_service_1 = require("./immobilisation.service");
const D = (s) => new Date(`${s}T00:00:00.000Z`);
const dot2939 = (o = {}) => ({
    sens: 'DOTATION',
    montant: 1_000_000,
    compteDepreciationId: 'c2939',
    numeroCompteDepreciation: '29390000',
    numeroContrepartie: '69140000',
    montantImputeEcart: 0,
    ...o,
});
describe('la proposition de transfert', () => {
    it('1 000 000 au 2939, bien achevé au 231 · reprise 7914, dotation 6914, au 2931', () => {
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '23110000', mouvements: [dot2939()] })).toEqual({
            etat: 'A_PASSER',
            montant: 1_000_000,
            compteSourceId: 'c2939',
            numeroSource: '29390000',
            niveau: 'EXPLOITATION',
            numeroReprise: '79140000',
            numeroDotation: '69140000',
            racineCible: '2931',
        });
    });
    it("un incorporel en cours (2919) · 7913 et 6913, fiches 69 et 79 des deux plans", () => {
        const p = (0, transfert_depreciation_en_cours_1.propositionTransfert)({
            smt: false,
            numeroCompteDefinitif: '21310000',
            mouvements: [dot2939({ compteDepreciationId: 'c2919', numeroCompteDepreciation: '29190000', numeroContrepartie: '69130000' })],
        });
        expect(p).toMatchObject({ etat: 'A_PASSER', numeroReprise: '79130000', numeroDotation: '69130000', racineCible: '2913' });
    });
    it('dotée en 853 · reprise en 863 et dotation en 853 (fiche du compte 79, « reprises HAO → 86 »)', () => {
        const p = (0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '24410000', mouvements: [dot2939({ numeroContrepartie: '85300000', numeroCompteDepreciation: '29490000' })] });
        expect(p).toMatchObject({ etat: 'A_PASSER', niveau: 'HAO', numeroReprise: '86300000', numeroDotation: '85300000', racineCible: '2944' });
    });
    it('le montant est le cumul net du 29x9 · dotations moins reprises', () => {
        const p = (0, transfert_depreciation_en_cours_1.propositionTransfert)({
            smt: false,
            numeroCompteDefinitif: '23110000',
            mouvements: [dot2939(), dot2939({ sens: 'REPRISE', montant: 250_000, numeroContrepartie: '79140000' })],
        });
        expect(p).toMatchObject({ etat: 'A_PASSER', montant: 750_000 });
    });
    it('sans dépréciation au 29x9 · rien à transférer', () => {
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '23110000', mouvements: [] })).toEqual({ etat: 'SANS_OBJET' });
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '23110000', mouvements: [dot2939({ compteDepreciationId: 'c2931', numeroCompteDepreciation: '29310000' })] })).toEqual({ etat: 'SANS_OBJET' });
    });
    it('trois abstentions dites · SMT, part imputée sur l’écart de réévaluation, niveaux mêlés', () => {
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: true, numeroCompteDefinitif: '23110000', mouvements: [dot2939()] })).toMatchObject({
            etat: 'ABSTENTION',
            motif: expect.stringMatching(/Système minimal/),
        });
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '23110000', mouvements: [dot2939({ montantImputeEcart: 200_000 })] })).toMatchObject({
            etat: 'ABSTENTION',
            motif: expect.stringMatching(/écart de réévaluation/),
        });
        expect((0, transfert_depreciation_en_cours_1.propositionTransfert)({ smt: false, numeroCompteDefinitif: '23110000', mouvements: [dot2939(), dot2939({ numeroContrepartie: '85300000', montant: 1 })] })).toMatchObject({ etat: 'ABSTENTION', motif: expect.stringMatching(/mélange/) });
    });
    it('une dépréciation déjà répartie sur deux comptes · abstention, jamais un choix deviné', () => {
        const p = (0, transfert_depreciation_en_cours_1.propositionTransfert)({
            smt: false,
            numeroCompteDefinitif: '23110000',
            mouvements: [dot2939(), dot2939({ compteDepreciationId: 'c2931', numeroCompteDepreciation: '29310000', montant: 5 })],
        });
        expect(p).toMatchObject({ etat: 'ABSTENTION', motif: expect.stringMatching(/plusieurs comptes 29/) });
    });
});
describe('le 29 du bien achevé', () => {
    it('suit la division du compte définitif (AUDCIF Titre VII ch. 2)', () => {
        expect((0, transfert_depreciation_en_cours_1.racine29DuCompteDefinitif)('23110000')).toBe('2931');
        expect((0, transfert_depreciation_en_cours_1.racine29DuCompteDefinitif)('24440000')).toBe('2944');
    });
    it('refuse un 29x9, un compte hors division, un compte hors 29', () => {
        expect((0, transfert_depreciation_en_cours_1.motifRefusCompteCible)('29310000', '2931')).toBeNull();
        expect((0, transfert_depreciation_en_cours_1.motifRefusCompteCible)('29380000', '2931')).toBeNull();
        expect((0, transfert_depreciation_en_cours_1.motifRefusCompteCible)('29390000', '2931')).toMatch(/EN COURS/);
        expect((0, transfert_depreciation_en_cours_1.motifRefusCompteCible)('29440000', '2931')).toMatch(/attendu un 293/);
        expect((0, transfert_depreciation_en_cours_1.motifRefusCompteCible)('28310000', '2931')).toMatch(/n'est pas un compte de dépréciation/);
    });
    it("propose l'unique compte de la racine, sinon l'unique de la division, sinon rien", () => {
        const plan = [{ numero: '29310000' }, { numero: '29320000' }, { numero: '29390000' }];
        expect((0, transfert_depreciation_en_cours_1.compteCiblePropose)('2931', plan)).toEqual({ numero: '29310000' });
        expect((0, transfert_depreciation_en_cours_1.compteCiblePropose)('2931', [{ numero: '29311000' }, { numero: '29312000' }])).toBeNull();
        expect((0, transfert_depreciation_en_cours_1.compteCiblePropose)('2931', [{ numero: '29380000' }, { numero: '29390000' }])).toEqual({ numero: '29380000' });
        expect((0, transfert_depreciation_en_cours_1.compteCiblePropose)('2931', [{ numero: '29390000' }])).toBeNull();
    });
});
describe('le compte qui porte la dépréciation après un transfert', () => {
    it('le 2931, quel que soit l’ordre de lecture des deux mouvements du jour · la reprise suit la dotation', () => {
        const avant = { sens: 'DOTATION', montant: 1_000_000, compteDepreciationId: 'c2939', compteContrepartieId: 'c853' };
        const reprise = { sens: 'REPRISE', montant: 1_000_000, compteDepreciationId: 'c2939', compteContrepartieId: 'c863' };
        const dotation = { sens: 'DOTATION', montant: 1_000_000, compteDepreciationId: 'c2931', compteContrepartieId: 'c853b' };
        expect((0, transfert_depreciation_en_cours_1.porteurDeLaDepreciation)([avant, dotation, reprise])).toEqual({ compteDepreciationId: 'c2931', compteContrepartieDotationId: 'c853b' });
        expect((0, transfert_depreciation_en_cours_1.porteurDeLaDepreciation)([avant, reprise, dotation])).toEqual({ compteDepreciationId: 'c2931', compteContrepartieDotationId: 'c853b' });
        expect((0, transfert_depreciation_en_cours_1.porteurDeLaDepreciation)([])).toBeNull();
    });
});
function harnais(o) {
    const ids = (n) => `c${n.slice(0, 4)}`;
    const immo = {
        id: 'i1',
        designation: 'Entrepôt',
        dateAcquisition: D('2025-03-01'),
        dateMiseEnService: o.dateMiseEnService ? D(o.dateMiseEnService) : null,
        statut: 'EN_SERVICE',
        valeurOrigine: 10_000_000,
        compteImmobilisationId: 'c2311',
        compteEnCoursId: 'c2391',
        compteImmobilisation: { numero: '23110000' },
        depreciations: (o.depreciations ?? []).map((d) => ({
            nature: client_1.NatureMouvementDepreciation.CLOTURE,
            sens: d.sens,
            montant: d.montant,
            montantImputeEcart: d.impute ?? 0,
            compteDepreciationId: ids(d.compte),
            compteDepreciation: { numero: d.compte },
            compteContrepartie: { numero: d.contrepartie },
            exercice: { dateFin: D(d.dateFin ?? '2025-12-31') },
        })),
    };
    const plan = (o.plan ?? ['29310000', '29390000', '79140000', '69140000']).map((n) => ({ id: ids(n), numero: n, intitule: n, typeCompte: 'DETAIL' }));
    const crees = [];
    const update = jest.fn(({ data }) => Promise.resolve({ id: 'i1', ...data }));
    const tx = {
        immobilisation: { update },
        depreciationImmobilisation: { create: jest.fn(({ data }) => (crees.push(data), Promise.resolve(data))) },
    };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: o.referentiel ?? client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: o.smt ? 'MINIMAL_TRESORERIE' : 'NORMAL',
                jeuEtatsFinanciersSycebnl: o.referentiel === client_1.Referentiel.SYCEBNL ? 'ASSOCIATIONS' : null,
            }),
        },
        immobilisation: { findFirst: jest.fn().mockResolvedValue(immo), update },
        coutEmpruntIncorpore: { aggregate: jest.fn().mockResolvedValue({ _max: { dateFin: null } }) },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null) },
        exercice: {
            findFirst: jest.fn(({ where }) => {
                const an = where.id.slice(1);
                return Promise.resolve({ id: where.id, statut: 'OUVERT', dateDebut: D(`20${an}-01-01`), dateFin: D(`20${an}-12-31`) });
            }),
        },
        compte: {
            findMany: jest.fn(({ where }) => Promise.resolve(plan.filter((c) => c.numero.startsWith(where.numero.startsWith)))),
            findFirst: jest.fn(({ where }) => Promise.resolve(plan.find((c) => c.numero === where.numero || c.id === where.id) ?? null)),
        },
        ecriture: { delete: jest.fn(), deleteMany: jest.fn() },
        $transaction: jest.fn((fn) => fn(tx)),
    };
    let n = 0;
    const ecritures = [];
    const ecritureService = {
        creer: jest.fn((_t, _u, e) => {
            n += 1;
            if (o.echecSecondeEcriture && n === 3)
                return Promise.reject(new Error('PANNE'));
            ecritures.push(e);
            return Promise.resolve({ id: `e${n}` });
        }),
    };
    const service = new immobilisation_service_1.ImmobilisationService(prisma, ecritureService);
    const retirees = [];
    service.annulerEcritureOrpheline = (id) => {
        retirees.push(id);
        return Promise.resolve();
    };
    return { service, crees, ecritures, retirees, update };
}
const MES = { date: '2026-03-01', exerciceId: 'e26', journalId: 'j1' };
const DEPRECIE_N = [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_000_000, compte: '29390000', contrepartie: '69140000' }];
describe('câblage de la mise en service', () => {
    for (const referentiel of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
        it(`${referentiel} · virement du brut, reprise D 2939 / C 7914, dotation D 6914 / C 2931, même jour, même montant`, async () => {
            const h = harnais({ referentiel, depreciations: DEPRECIE_N });
            const r = await h.service.mettreEnService('t1', 'u1', 'i1', MES);
            expect(h.ecritures.map((e) => [e.date, e.lignes])).toEqual([
                ['2026-03-01', [{ compteId: 'c2311', debit: 10_000_000, credit: 0 }, { compteId: 'c2391', debit: 0, credit: 10_000_000 }]],
                ['2026-03-01', [{ compteId: 'c2939', debit: 1_000_000, credit: 0 }, { compteId: 'c7914', debit: 0, credit: 1_000_000 }]],
                ['2026-03-01', [{ compteId: 'c6914', debit: 1_000_000, credit: 0 }, { compteId: 'c2931', debit: 0, credit: 1_000_000 }]],
            ]);
            const solde = (c) => h.ecritures.flatMap((e) => e.lignes).filter((l) => l.compteId === c).reduce((t, l) => t + l.debit - l.credit, 0);
            expect(1_000_000 * -1 + solde('c2939')).toBe(0);
            expect(solde('c2931')).toBe(-1_000_000);
            expect(solde('c7914') + solde('c6914')).toBe(0);
            expect(h.crees).toEqual([
                expect.objectContaining({ nature: client_1.NatureMouvementDepreciation.TRANSFERT_REPRISE, sens: 'REPRISE', montant: 1_000_000, compteDepreciationId: 'c2939', compteContrepartieId: 'c7914', ecritureId: 'e2', exerciceId: 'e26' }),
                expect.objectContaining({ nature: client_1.NatureMouvementDepreciation.TRANSFERT_DOTATION, sens: 'DOTATION', montant: 1_000_000, compteDepreciationId: 'c2931', compteContrepartieId: 'c6914', ecritureId: 'e3', exerciceId: 'e26' }),
            ]);
            expect(r.transfertDepreciation).toMatchObject({ montant: 1_000_000, compteSource: '29390000', compteCible: '29310000' });
            expect(r.ecritureMiseEnServiceId).toBe('e1');
        });
    }
    it('sans dépréciation · une seule écriture, aucun mouvement', async () => {
        const h = harnais({});
        const r = await h.service.mettreEnService('t1', 'u1', 'i1', MES);
        expect(h.ecritures).toHaveLength(1);
        expect(h.crees).toHaveLength(0);
        expect(r.transfertDepreciation).toBeNull();
    });
    it('un 2931 absent du plan refuse AVANT toute écriture, et nomme le compte à ouvrir', async () => {
        const h = harnais({ depreciations: DEPRECIE_N, plan: ['29390000', '79140000', '69140000'] });
        await expect(h.service.mettreEnService('t1', 'u1', 'i1', MES)).rejects.toThrow(/aucun compte 2931/);
        expect(h.ecritures).toHaveLength(0);
    });
    it('une panne entre deux écritures retire celles de la requête, et rien n’est enregistré', async () => {
        const h = harnais({ depreciations: DEPRECIE_N, echecSecondeEcriture: true });
        await expect(h.service.mettreEnService('t1', 'u1', 'i1', MES)).rejects.toThrow('PANNE');
        expect(h.retirees).toEqual(['e2', 'e1']);
        expect(h.crees).toHaveLength(0);
        expect(h.update).not.toHaveBeenCalled();
    });
    it('SMT · rien n’est transféré, la réponse le dit', async () => {
        const h = harnais({ smt: true, depreciations: DEPRECIE_N });
        const r = await h.service.mettreEnService('t1', 'u1', 'i1', MES);
        expect(h.ecritures).toHaveLength(1);
        expect(r.avertissementDepreciation).toMatch(/Système minimal/);
    });
    const TESTE_2026_2027 = [
        { ...DEPRECIE_N[0], montant: 500_000, dateFin: '2026-12-31' },
        { ...DEPRECIE_N[0], montant: 100_000, dateFin: '2027-12-31' },
    ];
    it('mise en service au 2027-06-01 ADMISE à sa vraie date, sans transfert, la réponse dit pourquoi et quoi faire', async () => {
        const h = harnais({ depreciations: TESTE_2026_2027 });
        const r = await h.service.mettreEnService('t1', 'u1', 'i1', { date: '2027-06-01', exerciceId: 'e27', journalId: 'j1' });
        expect(h.ecritures).toHaveLength(1);
        expect(h.ecritures[0].date).toBe('2027-06-01');
        expect(h.crees).toHaveLength(0);
        expect(r.dateMiseEnService).toEqual(D('2027-06-01'));
        expect(r.transfertDepreciation).toBeNull();
        expect(r.avertissementDepreciation).toMatch(/600000\.00 au 29390000/);
        expect(r.avertissementDepreciation).toMatch(/clôture du 2027-12-31/);
        expect(r.avertissementDepreciation).toMatch(/Transférer la dépréciation/);
    });
    it('l’aperçu le dit avant le geste, à la date saisie', async () => {
        const h = harnais({ depreciations: TESTE_2026_2027 });
        const a = await h.service.propositionTransfertDepreciation('t1', 'i1', undefined, '2027-06-01');
        expect(a).toMatchObject({ etat: 'A_PASSER', montant: 600_000, auPlusTotApres: '2027-12-31' });
        expect(a.differe).toMatch(/commence après le 2027-12-31/);
        const b = await h.service.propositionTransfertDepreciation('t1', 'i1', undefined, '2028-01-01');
        expect(b).toMatchObject({ differe: null });
    });
    it('le transfert passe en 2028, au 2028-01-01, pour les 600 000 du 2939 ; refusé dans 2027', async () => {
        const h = harnais({ depreciations: TESTE_2026_2027, dateMiseEnService: '2027-06-01' });
        await expect(h.service.transfererDepreciation('t1', 'u1', 'i1', { exerciceId: 'e27', journalId: 'j1' })).rejects.toThrow(/exercice ouvert qui commence après cette clôture/);
        expect(h.ecritures).toHaveLength(0);
        const r = await h.service.transfererDepreciation('t1', 'u1', 'i1', { exerciceId: 'e28', journalId: 'j1' });
        expect(r).toMatchObject({ montant: 600_000, date: '2028-01-01', compteSource: '29390000', compteCible: '29310000' });
        expect(h.ecritures.map((e) => [e.date, e.lignes])).toEqual([
            ['2028-01-01', [{ compteId: 'c2939', debit: 600_000, credit: 0 }, { compteId: 'c7914', debit: 0, credit: 600_000 }]],
            ['2028-01-01', [{ compteId: 'c6914', debit: 600_000, credit: 0 }, { compteId: 'c2931', debit: 0, credit: 600_000 }]],
        ]);
        expect(h.crees.map((c) => [c.nature, c.exerciceId, c.montant])).toEqual([
            [client_1.NatureMouvementDepreciation.TRANSFERT_REPRISE, 'e28', 600_000],
            [client_1.NatureMouvementDepreciation.TRANSFERT_DOTATION, 'e28', 600_000],
        ]);
    });
});
describe('le dernier test de clôture au 29x9 au ou après une date', () => {
    const m = (dateFin, numero = '29390000', nature = 'CLOTURE') => ({ nature, exercice: { dateFin: D(dateFin) }, compteDepreciation: { numero } });
    it('rend la clôture la plus tardive, au ou après la date ; ignore les transferts et les 29 du bien achevé', () => {
        expect((0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)([m('2026-12-31'), m('2027-12-31')], D('2027-06-01'))).toEqual(D('2027-12-31'));
        expect((0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)([m('2026-12-31')], D('2027-06-01'))).toBeNull();
        expect((0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)([m('2027-12-31')], D('2027-12-31'))).toEqual(D('2027-12-31'));
        expect((0, transfert_depreciation_en_cours_1.dernierTestDeClotureDepuis)([m('2028-12-31', '29310000'), m('2028-12-31', '29390000', 'TRANSFERT_REPRISE')], D('2028-01-01'))).toBeNull();
    });
});
//# sourceMappingURL=transfert-depreciation-en-cours.spec.js.map
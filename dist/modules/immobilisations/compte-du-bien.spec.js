"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const bareme_amortissement_013_2025_1 = require("./bareme-amortissement-013-2025");
const comptes_du_bien_1 = require("./comptes-du-bien");
const compte_du_bien_1 = require("./compte-du-bien");
const contrepartie_acquisition_1 = require("./contrepartie-acquisition");
const detail = (plan) => plan.filter((c) => (c.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL) === client_1.TypeCompteDetailTotal.DETAIL).map((c) => c.numero);
const PLANS = [
    [client_1.Referentiel.SYCEBNL, detail(compte_seed_1.PLAN_COMPTES_SYCEBNL)],
    [client_1.Referentiel.SYSCOHADA, detail(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA)],
];
describe('compte du bien · le 28 et le 68 se lisent dans le plan', () => {
    it.each(PLANS)('%s · tout compte de bien amortissable trouve son 28 de la division et son 68', (ref, numeros) => {
        const biens = numeros.filter((n) => (0, compte_du_bien_1.estCompteDeBien)(ref, n) && !(0, comptes_du_bien_1.motifNonAmortissable)(n, ref) && !/^2[1-4]9/.test(n) && !n.startsWith('221'));
        expect(biens.length).toBeGreaterThan(20);
        for (const n of biens) {
            const r = (0, compte_du_bien_1.comptesSuivantLeBien)(ref, n, numeros);
            expect({ n, motif: r.motif }).toEqual({ n, motif: null });
            expect(numeros).toContain(r.amortissement);
            expect(numeros).toContain(r.dotation);
            const usufruit = ref === client_1.Referentiel.SYCEBNL && n.startsWith('20');
            expect(r.amortissement.slice(0, 4)).toBe(usufruit ? '2800' : `28${n.charAt(1)}${n.charAt(2)}`);
            expect(r.dotation.slice(0, 4)).toBe(usufruit ? '6800' : n.startsWith('21') ? '6812' : '6813');
        }
    });
    it('les cas lus dans les semis · véhicule, aménagement, logiciel, usufruit', () => {
        const [, sycebnl] = PLANS[0];
        const [, syscohada] = PLANS[1];
        expect((0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYSCOHADA, '24510000', syscohada)).toMatchObject({ amortissement: '28450000', dotation: '68130000' });
        expect((0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYCEBNL, '23450000', sycebnl)).toMatchObject({ amortissement: '28340000' });
        expect((0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYSCOHADA, '21310000', syscohada)).toMatchObject({ amortissement: '28130000', dotation: '68120000' });
        expect((0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYCEBNL, '20110000', sycebnl)).toMatchObject({ amortissement: '28000000', dotation: '68000000' });
    });
    it('le compte semé passe avant un sous-compte que le cabinet a ouvert dessous', () => {
        const r = (0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYSCOHADA, '24510000', ['28459000', '28450000', '28451000', '68130000']);
        expect(r.amortissement).toBe('28450000');
    });
    it('un compte absent du plan est NOMMÉ, jamais composé', () => {
        const r = (0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYSCOHADA, '24510000', ['68130000']);
        expect(r.amortissement).toBeNull();
        expect(r.motif).toContain('aucun compte 2845');
    });
    it('un terrain non amortissable reçoit un 28 inerte de sa division', () => {
        const [, syscohada] = PLANS[1];
        const r = (0, compte_du_bien_1.comptesSuivantLeBien)(client_1.Referentiel.SYSCOHADA, '22200000', syscohada, true);
        expect(r.motif).toBeNull();
        expect(r.amortissement.startsWith('282')).toBe(true);
    });
    it('les 25 à 27 ne portent pas un bien, le 20 seulement au SYCEBNL', () => {
        expect((0, compte_du_bien_1.estCompteDeBien)(client_1.Referentiel.SYSCOHADA, '25200000')).toBe(false);
        expect((0, compte_du_bien_1.estCompteDeBien)(client_1.Referentiel.SYSCOHADA, '20000000')).toBe(false);
        expect((0, compte_du_bien_1.estCompteDeBien)(client_1.Referentiel.SYCEBNL, '20110000')).toBe(true);
    });
});
describe('sections du barème proposées · un filtre, jamais un refus', () => {
    const sections = new Set(bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.map((n) => n.section));
    it('toute section proposée existe dans l’arrêté', () => {
        for (const n of ['21310000', '23450000', '24110000', '24210000', '24410000', '24510000', '24800000']) {
            for (const s of (0, compte_du_bien_1.sectionsBaremeDuCompte)(n) ?? [])
                expect(sections).toContain(s);
        }
    });
    it('incorporel en I, transport en V, terrain sans catégorie', () => {
        expect((0, compte_du_bien_1.sectionsBaremeDuCompte)('21310000')).toEqual(['I']);
        expect((0, compte_du_bien_1.sectionsBaremeDuCompte)('24510000')).toEqual(['V']);
        expect((0, compte_du_bien_1.sectionsBaremeDuCompte)('22200000')).toEqual([]);
    });
});
describe("mode d'acquisition · chaque contrepartie admise a son mode", () => {
    it.each([client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA])('%s · fournisseur, trésorerie, apport, en-cours', (ref) => {
        const racines = (0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(ref, '24510000');
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(ref, '48120000', racines)).toBe('ACHAT_A_CREDIT');
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(ref, '52110000', racines)).toBe('ACHAT_COMPTANT');
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(ref, '10110000', racines)).toBe('APPORT');
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(ref, '24950000', racines)).toBe('EN_COURS_ACHEVE');
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(ref, '25200000', racines)).toBe('AVANCE_SOLDEE');
    });
    it('les dons et fonds affectés sont du SYCEBNL, la part non libérée a son mode', () => {
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYCEBNL, '14')).toBe('SUBVENTION_EN_NATURE');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYSCOHADA, '14')).toBe('SUBVENTION_EN_NATURE');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYCEBNL, '167')).toBe('DON_LEGS');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYCEBNL, '171')).toBe('DON_LEGS');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYCEBNL, '163')).toBe('FONDS_AFFECTES');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYSCOHADA, '4813')).toBe('TITRES_NON_LIBERES');
        expect((0, compte_du_bien_1.modeDeLaRacine)(client_1.Referentiel.SYSCOHADA, '4812')).toBe('ACHAT_A_CREDIT');
    });
    it('un compte hors de la liste fermée n’a pas de mode', () => {
        expect((0, compte_du_bien_1.modeDuCompteDeContrepartie)(client_1.Referentiel.SYSCOHADA, '60100000', (0, contrepartie_acquisition_1.racinesContrepartieAcquisition)(client_1.Referentiel.SYSCOHADA, '24510000'))).toBeNull();
    });
});
describe('la famille du compte · trouvée, ou créée avec les comptes du plan', () => {
    const { ImmobilisationService } = jest.requireActual('./immobilisation.service');
    const plan = [
        { id: 'c2451', numero: '24510000', intitule: 'Véhicules de tourisme' },
        { id: 'c2845', numero: '28450000', intitule: 'Amortissements du matériel de transport' },
        { id: 'c6813', numero: '68130000', intitule: 'Dotations corporelles' },
        { id: 'c6011', numero: '60110000', intitule: 'Achats' },
    ];
    function service(existante = null) {
        const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'f-neuve', ...data }));
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            familleImmobilisation: { findFirst: jest.fn().mockResolvedValue(existante), count: jest.fn().mockResolvedValue(0), create },
            compte: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(plan.find((c) => c.id === where.id) ?? null)),
                findMany: jest.fn().mockResolvedValue(plan),
            },
        };
        const svc = new ImmobilisationService(prisma, {});
        return { svc, create, prisma };
    }
    it('reprend la famille ACTIVE du même compte, sans en créer', async () => {
        const { svc, create, prisma } = service({ id: 'f-ancienne' });
        await expect(svc.famillePourCompte('t1', 'c2451', 3)).resolves.toEqual({ id: 'f-ancienne' });
        expect(prisma.familleImmobilisation.findFirst.mock.calls[0][0].where).toMatchObject({ compteImmobilisationId: 'c2451', estActif: true });
        expect(create).not.toHaveBeenCalled();
    });
    it('crée la famille avec le 28 et le 68 que le plan donne', async () => {
        const { svc, create } = service();
        await svc.famillePourCompte('t1', 'c2451', 3);
        expect(create.mock.calls[0][0].data).toMatchObject({
            code: '24510000',
            compteImmobilisationId: 'c2451',
            compteAmortissementId: 'c2845',
            compteDotationId: 'c6813',
            dureeAmortissementAns: 3,
        });
    });
    it('refuse un compte qui ne porte pas un bien, et un bien sans durée', async () => {
        await expect(service().svc.famillePourCompte('t1', 'c6011', 3)).rejects.toThrow('ne porte pas un bien');
        await expect(service().svc.famillePourCompte('t1', 'c2451')).rejects.toThrow("durée d'amortissement");
    });
});
//# sourceMappingURL=compte-du-bien.spec.js.map
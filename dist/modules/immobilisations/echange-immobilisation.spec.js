"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const PLAN = {
    c2451: '24510000',
    c4812: '48120000',
    c4851: '48510000',
    c5211: '52110000',
    c4141: '41410000',
    c2315: '23150000',
};
const DTO = {
    dateEchange: '2026-06-30',
    exerciceId: 'e1',
    journalId: 'j1',
    prixDeReprise: 2_000_000,
    soulte: 6_000_000,
    compteCreanceId: 'c4851',
    compteFournisseurId: 'c4812',
    compteImmobilisationId: 'c2451',
    designation: 'Camion neuf',
    dureeAmortissementAns: 5,
};
function monter(o = {}) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
        compte: { findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(PLAN[where.id] ? { numero: PLAN[where.id] } : null)) },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue({ ecritureAcquisitionId: 'acq' }),
            delete: jest.fn().mockResolvedValue({}),
        },
    };
    const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
    const s = svc;
    s.trouver = jest.fn().mockResolvedValue({ id: 'ancien', designation: 'Vieux camion', statut: o.statut ?? client_1.StatutImmobilisation.EN_SERVICE });
    const creer = jest.spyOn(svc, 'creer').mockResolvedValue({ id: 'nouveau' });
    const sortir = jest
        .spyOn(svc, 'sortir')
        .mockImplementation(() => (o.sortieEchoue ? Promise.reject(new Error('sortie refusée')) : Promise.resolve({ id: 'ancien' })));
    s.annulerEcritureOrpheline = jest.fn();
    return { svc, creer, sortir, prisma, annuler: s.annulerEcritureOrpheline };
}
describe('échange d’immobilisations', () => {
    it('le nouveau bien entre à prix de reprise + soulte, au crédit du 481 ; l’ancien sort au prix de reprise, au 485', async () => {
        const { svc, creer, sortir } = monter();
        const r = await svc.echanger('t', 'u', 'ancien', DTO);
        expect(r.valeurOrigine).toBe(8_000_000);
        expect(creer.mock.calls[0][2]).toMatchObject({ valeurOrigine: 8_000_000, compteContrepartieId: 'c4812', dateAcquisition: '2026-06-30' });
        expect(sortir.mock.calls[0][3]).toMatchObject({ type: 'CESSION', prixCession: 2_000_000, compteContrepartieId: 'c4851', dateSortie: '2026-06-30' });
    });
    it('une soulte reçue se retranche', async () => {
        const { svc, creer } = monter();
        await svc.echanger('t', 'u', 'ancien', { ...DTO, soulte: -500_000 });
        expect(creer.mock.calls[0][2].valeurOrigine).toBe(1_500_000);
    });
    it('une sortie refusée retire le bien reçu et son écriture', async () => {
        const { svc, prisma, annuler } = monter({ sortieEchoue: true });
        await expect(svc.echanger('t', 'u', 'ancien', DTO)).rejects.toThrow('sortie refusée');
        expect(prisma.immobilisation.delete).toHaveBeenCalledWith({ where: { id: 'nouveau' } });
        expect(annuler).toHaveBeenCalledWith('acq');
    });
    it('refus · bien déjà sorti, valeur nulle, contrepartie hors schéma, immeuble de placement', async () => {
        await expect(monter({ statut: client_1.StatutImmobilisation.CEDEE }).svc.echanger('t', 'u', 'ancien', DTO)).rejects.toThrow('déjà sorti');
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, soulte: -2_000_000 })).rejects.toThrow('aucune valeur');
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, compteFournisseurId: 'c5211' })).rejects.toThrow('fournisseur');
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, compteCreanceId: 'c5211' })).rejects.toThrow('485');
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, compteCreanceId: 'c4141' })).rejects.toThrow('485');
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, cessionCourante: true, compteCreanceId: 'c4141' })).resolves.toBeTruthy();
        await expect(monter().svc.echanger('t', 'u', 'ancien', { ...DTO, compteImmobilisationId: 'c2315' })).rejects.toThrow('§ 2.1.2.2');
    });
    it('les comptes du schéma sont semés aux deux plans, et l’immeuble de placement y garde son sens', () => {
        for (const plan of [compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA, compte_seed_1.PLAN_COMPTES_SYCEBNL]) {
            const n = new Map(plan.map((c) => [c.numero, c.intitule]));
            for (const c of ['48120000', '48510000', '82200000'])
                expect(n.has(c)).toBe(true);
            for (const c of ['22810000', '23150000', '23250000'])
                expect(n.get(c)).toMatch(/immeubles? de placement/i);
        }
    });
});
//# sourceMappingURL=echange-immobilisation.spec.js.map
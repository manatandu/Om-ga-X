"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const repartitions_analytiques_paie_service_1 = require("./repartitions-analytiques-paie.service");
const PLAN = { id: 'p1', code: 'PROJ', classesVentilees: '2,6,7', estActif: true };
const SECTIONS = [
    { id: 's1', planId: 'p1', code: 'P1', type: 'DETAIL', estActive: true },
    { id: 's2', planId: 'p1', code: 'P2', type: 'DETAIL', estActive: true },
];
function monter(o = {}) {
    const prisma = {
        salarie: { findFirst: jest.fn().mockResolvedValue({ id: 'sa1' }) },
        planAnalytique: {
            findFirst: jest.fn().mockResolvedValue(PLAN),
            findMany: jest.fn().mockResolvedValue(Array.from({ length: o.plans ?? 1 }, (_, i) => ({ ...PLAN, id: `p${i + 1}`, ventilationObligatoire: false }))),
        },
        sectionAnalytique: {
            findMany: jest.fn(async ({ where }) => SECTIONS.filter((s) => where.id.in.includes(s.id))),
        },
        repartitionAnalytiquePaie: {
            findFirst: jest.fn(async ({ where }) => 'retireLe' in where ? (o.existante ? { id: 'v0' } : null) : { id: 'v1', retireLe: o.retiree ? new Date() : null }),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn(async () => {
                if (o.doublon)
                    throw new client_1.Prisma.PrismaClientKnownRequestError('doublon', { code: 'P2002', clientVersion: '5' });
                return { id: 'v2', moisEffet: '2026-12' };
            }),
            update: jest.fn().mockResolvedValue({ id: 'v1', retireLe: new Date() }),
        },
    };
    return { service: new repartitions_analytiques_paie_service_1.RepartitionsAnalytiquesPaieService(prisma), prisma };
}
const dto = (lignes) => ({ planId: 'p1', moisEffet: '2026-12', lignes: lignes.map(([sectionId, pourcentage]) => ({ sectionId, pourcentage })) });
describe('la répartition analytique déclarée', () => {
    it('écrit la version et ses parts, à deux décimales, dans le dossier de la session', async () => {
        const { service, prisma } = monter();
        await service.declarer('t1', 'u1', 'sa1', dto([['s1', 60], ['s2', 40]]));
        expect(prisma.repartitionAnalytiquePaie.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                tenantId: 't1',
                salarieId: 'sa1',
                planId: 'p1',
                moisEffet: '2026-12',
                lignes: { create: [expect.objectContaining({ tenantId: 't1', sectionId: 's1' }), expect.objectContaining({ sectionId: 's2' })] },
            }),
        }));
        expect(prisma.planAnalytique.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', tenantId: 't1' } }));
    });
    it('refuse ce qui ne fait pas 100 %, et une section qui n’est pas lue dans le dossier', async () => {
        await expect(monter().service.declarer('t1', 'u1', 'sa1', dto([['s1', 60], ['s2', 30]]))).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(monter().service.declarer('t1', 'u1', 'sa1', dto([['ailleurs', 100]]))).rejects.toThrow(/n'appartient pas au plan PROJ/);
    });
    it('une version du même mois refuse · à la lecture comme à l’index unique', async () => {
        await expect(monter({ existante: true }).service.declarer('t1', 'u1', 'sa1', dto([['s1', 100]]))).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(monter({ doublon: true }).service.declarer('t1', 'u1', 'sa1', dto([['s1', 100]]))).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it('se retire une fois, par une mise à jour unitaire du dossier', async () => {
        const { service, prisma } = monter();
        await service.retirer('t1', 'u1', 'v1', '  Projet clos  ');
        expect(prisma.repartitionAnalytiquePaie.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1', tenantId: 't1' }, data: expect.objectContaining({ retirePar: 'u1', motifRetrait: 'Projet clos' }) }));
        await expect(monter({ retiree: true }).service.retirer('t1', 'u1', 'v1', 'motif')).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it('la passation ne ventile rien au-delà de la borne des plans · rien d’ignoré en silence', async () => {
        expect(await monter({ plans: repartitions_analytiques_paie_service_1.PLAFOND_PLANS_LUS + 1 }).service.pourLaPassation('t1', '2026-12', ['sa1'])).toBeNull();
        expect(await monter({ plans: 1 }).service.pourLaPassation('t1', '2026-12', ['sa1'])).toMatchObject({ versions: [], obligatoires: [] });
    });
});
//# sourceMappingURL=repartitions-analytiques-paie.spec.js.map
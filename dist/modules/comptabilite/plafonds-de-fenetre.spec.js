"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
function serviceListe(nombreEcritures, rendues) {
    const ecritures = Array.from({ length: rendues }, (_, i) => ({
        id: `e-${i}`,
        lignes: [{ debit: 1, credit: 0 }],
    }));
    const prisma = {
        ecriture: {
            findMany: jest.fn().mockResolvedValue(ecritures),
            count: jest.fn().mockResolvedValue(nombreEcritures),
        },
        ligneEcriture: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { debit: 987654, credit: 987654 } }),
        },
    };
    return { svc: new ecriture_service_1.EcritureService(prisma, {}, {}, {}), prisma: prisma };
}
describe('plafond de la fenêtre Journal', () => {
    it('borne la requête même quand personne n’a demandé de limite', async () => {
        const { svc, prisma } = serviceListe(500000, ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        await svc.lister('t-1', {});
        expect(prisma.ecriture.findMany.mock.calls[0][0].take).toBe(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
    });
    it('DIT qu’il ne montre pas tout', async () => {
        const { svc } = serviceListe(500000, ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        const r = await svc.lister('t-1', {});
        expect(r.tronque).toBe(true);
        expect(r.total).toBe(500000);
        expect(r.plafond).toBe(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
    });
    it('ne crie pas à la troncature quand tout tient', async () => {
        const { svc } = serviceListe(12, 12);
        const r = await svc.lister('t-1', {});
        expect(r.tronque).toBe(false);
    });
    it('les totaux sont ceux du JOURNAL, jamais ceux de la tranche', async () => {
        const { svc } = serviceListe(500000, ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        const r = await svc.lister('t-1', {});
        expect(r.totaux).toEqual({ debit: 987654, credit: 987654 });
    });
    it('les plus récentes d’abord, sous le même plafond (audit final F61)', async () => {
        const { svc, prisma } = serviceListe(500000, ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        await svc.lister('t-1', { plusRecentesDAbord: true });
        const appel = prisma.ecriture.findMany.mock.calls[0][0];
        expect(appel.take).toBe(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        expect(appel.orderBy).toEqual([{ date: 'desc' }, { numeroPiece: 'desc' }, { id: 'desc' }]);
        await svc.lister('t-1', {});
        expect(prisma.ecriture.findMany.mock.calls[1][0].orderBy[0]).toEqual({ date: 'asc' });
    });
    it('la route transmet la demande de la saisie', () => {
        const controleur = require('fs').readFileSync(require('path').join(__dirname, 'ecriture.controller.ts'), 'utf8');
        expect(controleur).toContain("...(plusRecentes === '1' ? { plusRecentesDAbord: true } : {})");
    });
    it('une limite explicite garde la sienne · le tableau de bord ne veut que huit lignes', async () => {
        const { svc, prisma } = serviceListe(500000, 8);
        await svc.lister('t-1', { limite: 8 });
        expect(prisma.ecriture.findMany.mock.calls[0][0].take).toBe(8);
    });
});
describe('le grand livre ne se tronque pas, il se refuse', () => {
    function serviceGrandLivre(nombreLignes) {
        const prisma = {
            ligneEcriture: { count: jest.fn().mockResolvedValue(nombreLignes), findMany: jest.fn().mockResolvedValue([]) },
        };
        return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    }
    it('refuse au-delà du plafond, plutôt que d’amputer un livre obligatoire', async () => {
        const svc = serviceGrandLivre(ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE + 1);
        await expect(svc.grandLivreComplet('t-1', 'ex-1')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('le refus dit le volume et par où passer', async () => {
        const svc = serviceGrandLivre(1000000);
        await expect(svc.grandLivreComplet('t-1', 'ex-1')).rejects.toThrow(/compte par compte/);
    });
    it('laisse passer ce qui tient', async () => {
        const svc = serviceGrandLivre(10);
        await expect(svc.grandLivreComplet('t-1', 'ex-1')).resolves.toBeDefined();
    });
});
//# sourceMappingURL=plafonds-de-fenetre.spec.js.map
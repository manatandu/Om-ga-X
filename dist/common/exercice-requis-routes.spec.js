"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const route_paramtypes_enum_1 = require("@nestjs/common/enums/route-paramtypes.enum");
const exercice_requis_1 = require("./exercice-requis");
const contexte_audit_1 = require("./audit/contexte-audit");
const analytique_controller_1 = require("../modules/analytique/analytique.controller");
const ifrs_controller_1 = require("../modules/ifrs/ifrs.controller");
const engagement_service_1 = require("../modules/analytique/engagement.service");
function pipesExercice(controleur, methode, type) {
    const args = (Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, controleur, methode) ?? {});
    const trouves = Object.entries(args).filter(([cle, arg]) => Number(cle.split(':')[0]) === type && arg.data === 'exerciceId');
    expect(trouves).toHaveLength(1);
    return trouves[0][1].pipes ?? [];
}
const ILLISIBLES = [undefined, '', 'ex-2026', '1'];
const ID = '0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30';
const ID_DU_VOISIN = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const DOSSIER = 'dossier-de-la-session';
async function jouer(pipes, valeur, type) {
    const prisma = {
        exercice: {
            findFirst: async (a) => a.where.id === ID && a.where.tenantId === DOSSIER ? { id: ID } : null,
        },
    };
    return (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'c@d.test', tenantId: DOSSIER }, async () => {
        let courant = valeur;
        for (const p of pipes) {
            const pipe = typeof p === 'function' ? new p(prisma) : p;
            courant = await pipe.transform(courant, { type, data: 'exerciceId' });
        }
        return courant;
    });
}
async function attendreRefusNomme(pipes, type) {
    for (const v of ILLISIBLES) {
        const refus = await jouer(pipes, v, type).catch((e) => e);
        expect(refus).toBeInstanceOf(common_1.BadRequestException);
        expect(refus.message).toBe(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
    }
    await expect(jouer(pipes, ID, type)).resolves.toBe(ID);
    const voisin = await jouer(pipes, ID_DU_VOISIN, type).catch((e) => e);
    expect(voisin).toBeInstanceOf(common_1.NotFoundException);
    expect(voisin.message).toBe(exercice_requis_1.MESSAGE_EXERCICE_HORS_DOSSIER);
}
describe('exerciceId exigé par le porteur · les trois routes qui y échappaient', () => {
    it('GET /analytique/engagements refuse un exercice absent ou illisible par un 400 nommé', async () => {
        const pipes = pipesExercice(analytique_controller_1.AnalytiqueController, 'listerEngagements', route_paramtypes_enum_1.RouteParamtypes.QUERY);
        expect(pipes).toContain(exercice_requis_1.EXERCICE_REQUIS);
        await attendreRefusNomme(pipes, 'query');
    });
    it('GET /analytique/engagements/ecritures-rattachables refuse un exercice absent ou illisible par un 400 nommé', async () => {
        const pipes = pipesExercice(analytique_controller_1.AnalytiqueController, 'ecrituresRattachables', route_paramtypes_enum_1.RouteParamtypes.QUERY);
        expect(pipes).toContain(exercice_requis_1.EXERCICE_REQUIS);
        await attendreRefusNomme(pipes, 'query');
    });
    it('DELETE /ifrs/effet-change/:exerciceId refuse un identifiant illisible par un 400 nommé', async () => {
        const pipes = pipesExercice(ifrs_controller_1.IfrsController, 'supprimerEffetChange', route_paramtypes_enum_1.RouteParamtypes.PARAM);
        expect(pipes).toContain(exercice_requis_1.EXERCICE_REQUIS);
        await attendreRefusNomme(pipes, 'param');
    });
});
describe('le registre des engagements exige aussi l’exercice au service', () => {
    function service() {
        const prisma = {
            engagementDepense: { findMany: jest.fn().mockResolvedValue([]) },
            ecriture: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        };
        return { service: new engagement_service_1.EngagementService(prisma), prisma };
    }
    it('lister refuse un exercice absent sans rien lire', async () => {
        const { service: s, prisma } = service();
        await expect(s.lister('t1', undefined)).rejects.toThrow(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
        expect(prisma.engagementDepense.findMany).not.toHaveBeenCalled();
    });
    it('ecrituresRattachables refuse un exercice absent sans rien lire', async () => {
        const { service: s, prisma } = service();
        await expect(s.ecrituresRattachables('t1', undefined)).rejects.toThrow(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
        expect(prisma.ecriture.findMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=exercice-requis-routes.spec.js.map
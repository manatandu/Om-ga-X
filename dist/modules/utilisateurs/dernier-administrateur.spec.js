"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const utilisateur_service_1 = require("./utilisateur.service");
function prismaComptes(comptes) {
    const ecrits = [];
    const verrous = [];
    const correspond = (c, w) => c.tenantId === w.tenantId &&
        (w.role === undefined || c.role === w.role) &&
        (w.estActif === undefined || c.estActif === w.estActif) &&
        (w.id === undefined || c.id !== w.id.not);
    const user = {
        findFirst: jest.fn(({ where }) => Promise.resolve(comptes.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null)),
        count: jest.fn(({ where }) => Promise.resolve(comptes.filter((c) => correspond(c, where)).length)),
        update: jest.fn(({ where, data }) => {
            ecrits.push({ id: where.id, ...data });
            return Promise.resolve({ id: where.id });
        }),
    };
    const tx = {
        user,
        $executeRaw: jest.fn((_g, ...v) => {
            verrous.push(String(v[0]));
            return Promise.resolve(1);
        }),
    };
    const prisma = { user, $transaction: jest.fn(async (fn) => fn(tx)) };
    return { prisma, ecrits, verrous };
}
const service = (prisma) => new utilisateur_service_1.UtilisateurService(prisma);
const admin = (id, estActif = true) => ({ id, tenantId: 'd-1', role: client_1.RoleUtilisateur.ADMIN_CABINET, estActif });
const comptable = (id) => ({ id, tenantId: 'd-1', role: client_1.RoleUtilisateur.COMPTABLE, estActif: true });
describe('F157 · le dernier administrateur actif ne se retire pas', () => {
    it('se rétrograder quand on est le seul administrateur est refusé, et rien n’est écrit', async () => {
        const { prisma, ecrits } = prismaComptes([admin('a1'), comptable('c1')]);
        await expect(service(prisma).modifier('d-1', 'a1', 'a1', { role: client_1.RoleUtilisateur.COMPTABLE })).rejects.toThrow(utilisateur_service_1.MOTIF_DERNIER_ADMINISTRATEUR);
        expect(ecrits).toEqual([]);
    });
    it('désactiver le seul autre administrateur actif, quand on n’est pas soi-même administrateur actif, est refusé', async () => {
        const { prisma, ecrits } = prismaComptes([admin('a1'), admin('a2', false), comptable('c1')]);
        await expect(service(prisma).modifier('d-1', 'a1', 'c1', { estActif: false })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(ecrits).toEqual([]);
    });
    it('un administrateur d’un AUTRE dossier ne compte pas', async () => {
        const { prisma, ecrits } = prismaComptes([admin('a1'), { ...admin('x1'), tenantId: 'd-2' }]);
        await expect(service(prisma).modifier('d-1', 'a1', 'a1', { role: client_1.RoleUtilisateur.LECTURE_SEULE })).rejects.toThrow(utilisateur_service_1.MOTIF_DERNIER_ADMINISTRATEUR);
        expect(ecrits).toEqual([]);
    });
    it('avec un second administrateur actif, la rétrogradation passe, sous le verrou du dossier', async () => {
        const { prisma, ecrits, verrous } = prismaComptes([admin('a1'), admin('a2')]);
        await service(prisma).modifier('d-1', 'a1', 'a2', { role: client_1.RoleUtilisateur.COMPTABLE });
        expect(ecrits).toEqual([expect.objectContaining({ id: 'a1', role: client_1.RoleUtilisateur.COMPTABLE })]);
        expect(verrous).toEqual(['administrateurs:d-1']);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
    it('le décompte exclut le compte visé lui-même', async () => {
        const { prisma } = prismaComptes([admin('a1'), admin('a2')]);
        await service(prisma).modifier('d-1', 'a1', 'a2', { estActif: false });
        expect(prisma.user.count).toHaveBeenCalledWith({
            where: { tenantId: 'd-1', role: client_1.RoleUtilisateur.ADMIN_CABINET, estActif: true, id: { not: 'a1' } },
        });
    });
    it('un geste qui ne retire rien n’ouvre ni transaction ni décompte', async () => {
        const { prisma, ecrits } = prismaComptes([admin('a1'), comptable('c1')]);
        await service(prisma).modifier('d-1', 'c1', 'a1', { role: client_1.RoleUtilisateur.LECTURE_SEULE });
        await service(prisma).modifier('d-1', 'a1', 'a1', { role: client_1.RoleUtilisateur.ADMIN_CABINET, estActif: true });
        expect(ecrits).toHaveLength(2);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    it('la règle · seul un compte ADMINISTRATEUR ET ACTIF perd quelque chose', () => {
        const a = { role: client_1.RoleUtilisateur.ADMIN_CABINET, estActif: true };
        expect((0, utilisateur_service_1.retireUnAdministrateur)(a, { role: client_1.RoleUtilisateur.COMPTABLE })).toBe(true);
        expect((0, utilisateur_service_1.retireUnAdministrateur)(a, { estActif: false })).toBe(true);
        expect((0, utilisateur_service_1.retireUnAdministrateur)(a, { role: client_1.RoleUtilisateur.ADMIN_CABINET })).toBe(false);
        expect((0, utilisateur_service_1.retireUnAdministrateur)(a, { estActif: true })).toBe(false);
        expect((0, utilisateur_service_1.retireUnAdministrateur)({ ...a, estActif: false }, { role: client_1.RoleUtilisateur.COMPTABLE })).toBe(false);
        expect((0, utilisateur_service_1.retireUnAdministrateur)({ ...a, role: client_1.RoleUtilisateur.COMPTABLE }, { estActif: false })).toBe(false);
    });
});
describe('F158 · une adresse prise dans un autre dossier rend un conflit, pas une panne', () => {
    it('la contrainte d’unicité de la base devient un 409, sans dire à qui l’adresse appartient', async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })),
            },
        };
        const promesse = service(prisma).creer('d-1', { email: 'Voisin@Cabinet.cd', motDePasse: 'mot-de-passe-long', role: client_1.RoleUtilisateur.COMPTABLE });
        await expect(promesse).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(promesse).rejects.toThrow(utilisateur_service_1.MOTIF_ADRESSE_PRISE);
    });
    it('une autre panne de la base n’est pas déguisée en conflit', async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockRejectedValue(Object.assign(new Error('connexion perdue'), { code: 'P1001' })),
            },
        };
        await expect(service(prisma).creer('d-1', { email: 'nouveau@cabinet.cd', motDePasse: 'mot-de-passe-long', role: client_1.RoleUtilisateur.COMPTABLE })).rejects.toThrow('connexion perdue');
    });
});
//# sourceMappingURL=dernier-administrateur.spec.js.map
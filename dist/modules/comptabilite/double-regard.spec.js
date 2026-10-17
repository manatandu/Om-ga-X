"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
function service(prisma) {
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
function ecriture(id, createdBy, options = {}) {
    return {
        id,
        createdBy,
        statut: 'BROUILLARD',
        numeroPiece: 1,
        estGenereeParCloture: options.cloture ?? false,
        exercice: { statut: 'OUVERT' },
        journal: { code: 'ACH' },
        lignes: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 100 },
        ],
    };
}
function prismaAvec(ecritures, doubleRegard, referentiel = 'SYCEBNL') {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    return {
        prisma: {
            ecriture: { findMany: jest.fn().mockResolvedValue(ecritures), updateMany },
            tenant: {
                findUniqueOrThrow: jest
                    .fn()
                    .mockResolvedValue({ doubleRegardValidation: doubleRegard, referentiel }),
            },
        },
        updateMany,
    };
}
describe('le double regard écarte, il ne jette pas', () => {
    it('écarte celles que leur auteur valide, et laisse passer les autres', async () => {
        const { prisma, updateMany } = prismaAvec([ecriture('sienne', 'moi'), ecriture('autre', 'toi')], true);
        const r = await service(prisma).valider('t1', 'moi', ['sienne', 'autre']);
        expect(r.validees).toBe(1);
        expect(r.refuseesSecondRegard).toBe(1);
        expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['autre'] }, tenantId: 't1' } }));
    });
    it('ne jette aucune exception quand tout le lot est écarté', async () => {
        const { prisma, updateMany } = prismaAvec([ecriture('a', 'moi'), ecriture('b', 'moi')], true);
        const r = await service(prisma).valider('t1', 'moi', ['a', 'b']);
        expect(r.validees).toBe(0);
        expect(r.refuseesSecondRegard).toBe(2);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('ne fait rien du tout quand le dossier n’a pas activé l’option', async () => {
        const { prisma } = prismaAvec([ecriture('sienne', 'moi')], false);
        const r = await service(prisma).valider('t1', 'moi', ['sienne']);
        expect(r.validees).toBe(1);
        expect(r.refuseesSecondRegard).toBe(0);
        expect(r.motifRefus).toBeNull();
    });
    it('épargne les écritures engendrées par la clôture', async () => {
        const { prisma } = prismaAvec([ecriture('report', 'moi', { cloture: true })], true);
        const r = await service(prisma).valider('t1', 'moi', ['report']);
        expect(r.validees).toBe(1);
        expect(r.refuseesSecondRegard).toBe(0);
    });
});
describe('la dérogation nominative', () => {
    it('laisse passer et pose le visa, nom et motif', async () => {
        const { prisma, updateMany } = prismaAvec([ecriture('sienne', 'moi')], true);
        const r = await service(prisma).valider('t1', 'moi', ['sienne'], {
            secondRegardNom: 'Me KABILA, expert-comptable',
            secondRegardMotif: 'Relecture des pièces d’achat du mois',
        });
        expect(r.validees).toBe(1);
        expect(r.sousDerogation).toBe(1);
        expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                secondRegardNom: 'Me KABILA, expert-comptable',
                secondRegardMotif: 'Relecture des pièces d’achat du mois',
            }),
        }));
    });
    it('refuse un nom sans motif, et un motif sans nom', async () => {
        const { prisma } = prismaAvec([ecriture('sienne', 'moi')], true);
        await expect(service(prisma).valider('t1', 'moi', ['sienne'], { secondRegardNom: 'Un nom' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service(prisma).valider('t1', 'moi', ['sienne'], { secondRegardMotif: 'Un motif' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('ne tamponne PAS le visa sur un lot ordinaire', async () => {
        const { prisma, updateMany } = prismaAvec([ecriture('autre', 'toi')], true);
        await service(prisma).valider('t1', 'moi', ['autre']);
        const data = updateMany.mock.calls[0][0].data;
        expect(data).not.toHaveProperty('secondRegardNom');
    });
});
describe('le message est aiguillé, et ne transpose pas', () => {
    it('un dossier SYCEBNL est renvoyé à SON article, pas à celui de l’AUDCIF', async () => {
        const { prisma } = prismaAvec([ecriture('sienne', 'moi')], true, 'SYCEBNL');
        const r = await service(prisma).valider('t1', 'moi', ['sienne']);
        expect(r.motifRefus).toContain('art. 16, 2)');
        expect(r.motifRefus).toContain('exclu par l’art. 3');
        expect(r.motifRefus).not.toContain('art. 19');
        expect(r.motifRefus).not.toContain('mensuel');
    });
    it('un dossier SYSCOHADA est renvoyé à l’art. 69', async () => {
        const { prisma } = prismaAvec([ecriture('sienne', 'moi')], true, 'SYSCOHADA');
        const r = await service(prisma).valider('t1', 'moi', ['sienne']);
        expect(r.motifRefus).toContain('art. 69');
        expect(r.motifRefus).toContain('sous sa responsabilité');
        expect(r.motifRefus).not.toContain('art. 16, 2)');
    });
    it('les deux messages disent qu’AUCUN texte n’impose la séparation', async () => {
        for (const ref of ['SYCEBNL', 'SYSCOHADA']) {
            const { prisma } = prismaAvec([ecriture('sienne', 'moi')], true, ref);
            const r = await service(prisma).valider('t1', 'moi', ['sienne']);
            expect(r.motifRefus).toContain('Aucun texte n’impose');
        }
    });
});
describe('validerJusqua rend la forme COMPLÈTE, même à vide', () => {
    it('le retour anticipé porte les sept champs', async () => {
        const prisma = {
            ecriture: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex' }) },
        };
        const r = await service(prisma).validerJusqua('t1', 'moi', {
            exerciceId: 'ex',
            dateLimite: '2026-06-30',
        });
        expect(r).toEqual({
            validees: 0,
            dejaValidees: 0,
            refuseesSecondRegard: 0,
            sousDerogation: 0,
            motifRefus: null,
            ecarteesJournalDeSituation: 0,
            motifEcarteesJournalDeSituation: null,
        });
    });
});
describe("validerJusqua refuse l'exercice ou le journal d'un autre dossier (ligne lettrage-cloture)", () => {
    const prismaDe = () => {
        const findMany = jest.fn().mockResolvedValue([]);
        return {
            findMany,
            prisma: {
                ecriture: { findMany, count: jest.fn().mockResolvedValue(0) },
                exercice: {
                    findFirst: jest.fn(async ({ where }) => where.id === 'exA' && where.tenantId === 'tA' ? { id: 'exA' } : null),
                },
                journal: {
                    findFirst: jest.fn(async ({ where }) => where.id === 'jA' && where.tenantId === 'tA' ? { id: 'jA' } : null),
                },
            },
        };
    };
    it("l'exercice d'un autre dossier est un 404 nommé, jamais « 0 validée »", async () => {
        const { prisma, findMany } = prismaDe();
        await expect(service(prisma).validerJusqua('tB', 'moi', { exerciceId: 'exA', dateLimite: '2026-06-30' })).rejects.toThrow('Exercice introuvable pour ce dossier.');
        expect(findMany).not.toHaveBeenCalled();
    });
    it("le journal d'un autre dossier aussi", async () => {
        const { prisma } = prismaDe();
        await expect(service(prisma).validerJusqua('tA', 'moi', { exerciceId: 'exA', dateLimite: '2026-06-30', journalId: 'jB' })).rejects.toThrow('Journal introuvable pour ce dossier.');
    });
    it("l'exercice du dossier passe, et le vide reste la forme complète", async () => {
        const { prisma } = prismaDe();
        const r = await service(prisma).validerJusqua('tA', 'moi', { exerciceId: 'exA', dateLimite: '2026-06-30', journalId: 'jA' });
        expect(r.validees).toBe(0);
    });
});
//# sourceMappingURL=double-regard.spec.js.map
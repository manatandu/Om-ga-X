"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const export_service_1 = require("./export.service");
const TENANT = { id: 't1', nom: 'ASBL ESPOIR', numeroImpot: 'A1', adresse: null, ville: null, pays: null };
const EXERCICES = [
    { id: 'e1', tenantId: 't1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z'), dateArreteComptes: null },
    { id: 'e0', tenantId: 't1', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z'), dateArreteComptes: null },
];
function prismaFactice() {
    return {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                if (where.id !== undefined) {
                    return Promise.resolve(EXERCICES.find((e) => e.id === where.id && e.tenantId === where.tenantId) ?? null);
                }
                const avant = EXERCICES.filter((e) => e.tenantId === where.tenantId && (!where.dateDebut || e.dateDebut < where.dateDebut.lt));
                avant.sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
                return Promise.resolve(avant[0] ?? null);
            }),
            findFirstOrThrow: jest.fn().mockImplementation(({ where }) => {
                const trouve = EXERCICES.find((e) => e.id === where.id && e.tenantId === where.tenantId);
                return trouve
                    ? Promise.resolve(trouve)
                    : Promise.reject(new client_1.Prisma.PrismaClientKnownRequestError('No Exercice found', { code: 'P2025', clientVersion: '5' }));
            }),
        },
    };
}
function exportService(notes = {}) {
    return new export_service_1.ExportService(prismaFactice(), {}, {}, {}, {}, {}, notes, {}, {}, {});
}
describe('export d’un exercice inconnu du dossier (audit final F222)', () => {
    it('le classeur des notes est refusé par un 404 nommé, même quand l’identité échoue la première', async () => {
        const enAttente = new Promise(() => undefined);
        const service = exportService({ notesProjet: jest.fn().mockReturnValue(enAttente) });
        const refus = service.notesProjetExcel('t1', 'inconnu');
        await expect(refus).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(refus).rejects.toThrow(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
    });
    it('l’exercice d’un AUTRE dossier est inconnu ici', async () => {
        const service = exportService({ notesProjet: jest.fn().mockReturnValue(new Promise(() => undefined)) });
        await expect(service.notesProjetExcel('t2', 'e1')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it('le comparatif des liasses refuse lui aussi, et sert l’antérieur d’un exercice connu', async () => {
        const service = exportService();
        const exerciceN1Id = (tenantId, exerciceId) => service.exerciceN1Id(tenantId, exerciceId);
        await expect(exerciceN1Id('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(exerciceN1Id('t1', 'e1')).resolves.toBe('e0');
        await expect(exerciceN1Id('t1', 'e0')).resolves.toBeNull();
    });
    it('le refus de l’export est mot pour mot celui des états · la réponse ne dépend pas de l’ordre', async () => {
        const lister = { lister: jest.fn().mockResolvedValue(EXERCICES) };
        const [etat, exporte] = await Promise.allSettled([
            (0, etats_financiers_communs_1.trouverExerciceN1)(lister, 't1', 'inconnu'),
            exportService({ notesProjet: jest.fn().mockReturnValue(new Promise(() => undefined)) }).notesProjetExcel('t1', 'inconnu'),
        ]);
        expect(etat.status).toBe('rejected');
        expect(exporte.status).toBe('rejected');
        const motif = (r) => r.reason.message;
        expect(motif(exporte)).toBe(motif(etat));
        expect(motif(etat)).toBe(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE);
    });
});
//# sourceMappingURL=exercice-introuvable-f222.spec.js.map
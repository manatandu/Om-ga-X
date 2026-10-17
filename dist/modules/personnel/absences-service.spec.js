"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const absences_service_1 = require("./absences.service");
describe('mineur 3 · l’index unique de l’indemnité de la Caisse', () => {
    it('une seconde déclaration simultanée rencontre l’index · 409 nommé', async () => {
        const conflit = new client_1.Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5' });
        const prisma = { $transaction: jest.fn().mockRejectedValue(conflit) };
        const svc = new absences_service_1.AbsencesService(prisma);
        const dto = { mois: '2026-08', montant: 20_000, traitement: 'DEDUITE', piece: 'Bordereau CNSS 118' };
        await expect(svc.declarerIndemniteCaisse('t', 'u@x.cd', 'a-1', dto)).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(svc.declarerIndemniteCaisse('t', 'u@x.cd', 'a-1', dto)).rejects.toThrow(/déjà déclarée sur cet arrêt pour ce mois/);
    });
    it('le schéma déclare l’index sur l’arrêt, le mois et l’annulation', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const schema = readFileSync(`${__dirname}/../../../prisma/schema.prisma`, 'utf8');
        const bloc = /model IndemniteCaisseAbsence \{([\s\S]*?)\n\}/.exec(schema)[1];
        expect(bloc).toContain('@@unique([absenceId, mois, annuleLe])');
    });
});
//# sourceMappingURL=absences-service.spec.js.map
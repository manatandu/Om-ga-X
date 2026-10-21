"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
describe('EcritureService.modifierPieceDuModule', () => {
    function monter(retirees) {
        const ajouts = [];
        const tx = {
            ecriture: {
                findFirst: async () => ({
                    id: 'e1',
                    statut: client_1.StatutEcriture.BROUILLARD,
                    exerciceId: 'x1',
                    journalId: 'j1',
                    date: new Date('2026-03-10T00:00:00.000Z'),
                    journal: { numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL },
                    lignes: [],
                }),
                update: async (a) => {
                    ajouts.push(a);
                    return { id: 'e1' };
                },
            },
            exercice: {
                findFirst: async () => ({
                    dateDebut: new Date('2026-01-01T00:00:00.000Z'),
                    dateFin: new Date('2026-12-31T00:00:00.000Z'),
                    statut: 'OUVERT',
                }),
            },
            ligneEcriture: { deleteMany: async () => ({ count: retirees }) },
            pieceJointeEcriture: { count: async () => 0 },
        };
        const s = new ecriture_service_1.EcritureService({}, {}, {}, {});
        jest.spyOn(s, 'controlesDEntree').mockResolvedValue({ date: new Date('2026-03-10T00:00:00.000Z'), sectionsParId: new Map() });
        return { s, tx, ajouts };
    }
    const dto = { date: '2026-03-10', lignes: [] };
    it('validée entre-temps · aucune ligne retirée, 409 et rien ajouté', async () => {
        const m = monter(0);
        await expect(m.s.modifierPieceDuModule(m.tx, 't1', 'e1', dto)).rejects.toThrow(common_1.ConflictException);
        expect(m.ajouts).toEqual([]);
    });
    it('au brouillard · les lignes sont remplacées', async () => {
        const m = monter(2);
        await expect(m.s.modifierPieceDuModule(m.tx, 't1', 'e1', dto)).resolves.toBe(true);
        expect(m.ajouts).toHaveLength(1);
    });
});
//# sourceMappingURL=piece-du-module-en-place.spec.js.map
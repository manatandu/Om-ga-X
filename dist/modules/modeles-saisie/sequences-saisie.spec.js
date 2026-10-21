"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const sequences_saisie_1 = require("./sequences-saisie");
const sequences_saisie_service_1 = require("./sequences-saisie.service");
const modele_saisie_service_1 = require("./modele-saisie.service");
describe('séquences de saisie · les règles', () => {
    it('le premier rang libre de 1 à 10, et aucun au-delà de dix', () => {
        expect((0, sequences_saisie_1.premierRangLibre)([])).toBe(1);
        expect((0, sequences_saisie_1.premierRangLibre)([1, 2, 4])).toBe(3);
        expect((0, sequences_saisie_1.premierRangLibre)([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
    });
    it('un intitulé non vide de 35 caractères au plus', () => {
        expect((0, sequences_saisie_1.motifRefusIntituleSequence)('Achats')).toBeNull();
        expect((0, sequences_saisie_1.motifRefusIntituleSequence)('   ')).toMatch(/obligatoire/);
        expect((0, sequences_saisie_1.motifRefusIntituleSequence)('x'.repeat(35))).toBeNull();
        expect((0, sequences_saisie_1.motifRefusIntituleSequence)('x'.repeat(36))).toMatch(/35 caractères au plus \(36 tapés\)/);
    });
});
describe('séquences de saisie · le service', () => {
    function monde(existantes = [], modelesRanges = 0) {
        const sequences = [...existantes];
        const create = jest.fn(async ({ data }) => {
            if (sequences.some((s) => s.intitule === data.intitule)) {
                throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
            }
            const s = { id: `s${data.numero}`, numero: data.numero, intitule: data.intitule };
            sequences.push(s);
            return s;
        });
        const tx = {
            $executeRaw: jest.fn(async () => 1),
            sequenceSaisie: { findMany: jest.fn(async () => sequences.map((s) => ({ numero: s.numero }))), create },
        };
        const p = {
            $transaction: jest.fn(async (fn) => fn(tx)),
            sequenceSaisie: {
                findMany: jest.fn(async () => [...sequences].sort((a, b) => a.numero - b.numero)),
                findFirst: jest.fn(async ({ where }) => sequences.find((s) => s.id === where.id) ?? null),
                update: jest.fn(async ({ where, data }) => ({ ...sequences.find((s) => s.id === where.id), ...data })),
                delete: jest.fn(async () => ({})),
            },
            modeleSaisie: {
                groupBy: jest.fn(async () => (modelesRanges ? [{ sequenceSaisieId: existantes[0]?.id, _count: { _all: modelesRanges } }] : [])),
                count: jest.fn(async () => modelesRanges),
            },
        };
        return { svc: new sequences_saisie_service_1.SequencesSaisieService(p), p, tx, create };
    }
    it('crée au premier rang libre, sous le verrou du dossier, l’intitulé nettoyé', async () => {
        const { svc, tx } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }]);
        expect(await svc.creer('t1', 'u1', '  Ventes ')).toEqual({ id: 's2', numero: 2, intitule: 'Ventes' });
        expect(tx.$executeRaw).toHaveBeenCalled();
    });
    it('refuse une onzième séquence, un intitulé vide et un intitulé déjà pris, en le disant', async () => {
        const dix = Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, numero: i + 1, intitule: `S${i + 1}` }));
        await expect(monde(dix).svc.creer('t1', 'u1', 'Onze')).rejects.toThrow(sequences_saisie_1.MOTIF_DIX_SEQUENCES);
        await expect(monde().svc.creer('t1', 'u1', ' ')).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(monde([{ id: 's1', numero: 1, intitule: 'Achats' }]).svc.creer('t1', 'u1', 'Achats')).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it('liste par rang avec le nombre de modèles rangés', async () => {
        const { svc } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }], 3);
        expect(await svc.lister('t1')).toEqual([{ id: 's1', numero: 1, intitule: 'Achats', nombreModeles: 3 }]);
    });
    it('ne retire pas une séquence qui range des modèles · le refus les compte', async () => {
        const { svc, p } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }], 2);
        await expect(svc.supprimer('t1', 's1')).rejects.toThrow(/« Achats » range 2 modèle\(s\) de saisie/);
        expect(p.sequenceSaisie.delete).not.toHaveBeenCalled();
        await expect(monde().svc.supprimer('t1', 'inconnue')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it('un modèle rangé entre le compte et la suppression · 409 nommé, jamais une erreur 500 (relecture m4)', async () => {
        const { svc, p } = monde([{ id: 's1', numero: 1, intitule: 'Achats' }]);
        p.sequenceSaisie.delete.mockRejectedValueOnce(new client_1.Prisma.PrismaClientKnownRequestError('clé étrangère', { code: 'P2003', clientVersion: 'x' }));
        p.modeleSaisie.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        const refus = svc.supprimer('t1', 's1');
        await expect(refus).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(svc.supprimer('t1', 's1')).resolves.toEqual({ supprime: true });
    });
});
describe('séquences de saisie · le modèle', () => {
    it('une séquence d’un autre dossier est refusée au modèle', async () => {
        const p = {
            sequenceSaisie: { findFirst: jest.fn(async () => null) },
            modeleSaisie: { findFirst: jest.fn(async () => ({ id: 'm1', tenantId: 't1' })), create: jest.fn(), update: jest.fn() },
        };
        const svc = new modele_saisie_service_1.ModeleSaisieService(p);
        await expect(svc.modifier('t1', 'm1', { sequenceSaisieId: 'autre' })).rejects.toThrow(/Séquence de saisie introuvable/);
        expect(p.sequenceSaisie.findFirst).toHaveBeenCalledWith({ where: { id: 'autre', tenantId: 't1' }, select: { id: true } });
        expect(p.modeleSaisie.update).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=sequences-saisie.spec.js.map
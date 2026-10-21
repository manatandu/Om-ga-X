"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
function ecriture(i, avecReference) {
    const id = `e-${String(i).padStart(5, '0')}`;
    return {
        id,
        date: new Date('2026-05-10'),
        libelle: `Pièce ${i}`,
        reference: avecReference ? `PJ-${i}` : null,
        numeroPiece: i,
        createdAt: new Date('2026-05-10'),
        statut: 'VALIDEE',
        createdBy: 'u1',
        valideeBy: 'u2',
        secondRegardNom: null,
        estGenereeParCloture: false,
        estANouveauProvisoire: false,
        journal: { code: 'VT' },
        lignes: [
            { debit: 100, credit: 0, lettre: null, compte: { numero: '41110000' } },
            { debit: 0, credit: 100, lettre: null, compte: { numero: '70110000' } },
        ],
    };
}
function servicePagine(ecritures) {
    const appels = [];
    const findMany = jest.fn(async (args) => {
        appels.push(args);
        const tries = [...ecritures].sort((a, b) => a.id.localeCompare(b.id));
        let debut = 0;
        if (args.cursor)
            debut = tries.findIndex((e) => e.id === args.cursor.id) + (args.skip ?? 0);
        return tries.slice(debut, args.take === undefined ? undefined : debut + args.take);
    });
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS }),
        },
        ecriture: { findMany },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new controles_service_1.ControlesService(prisma), appels };
}
describe('batterie de contrôles · lecture par tranches (F185)', () => {
    it('parcourt tout l’exercice par lots bornés, curseur exclu', async () => {
        const n = 2 * lecture_par_lots_1.LOT_ECRITURES + 7;
        const { svc, appels } = servicePagine(Array.from({ length: n }, (_, i) => ecriture(i, true)));
        await svc.analyser('t', 'ex');
        const lectures = appels.filter((a) => a.take !== undefined);
        expect(lectures).toHaveLength(3);
        expect(lectures.every((a) => a.take === lecture_par_lots_1.LOT_ECRITURES)).toBe(true);
        expect(lectures[0].cursor).toBeUndefined();
        expect(lectures[1]).toMatchObject({ cursor: { id: `e-${String(lecture_par_lots_1.LOT_ECRITURES - 1).padStart(5, '0')}` }, skip: 1 });
    });
    it('une anomalie du dernier lot est vue, et le nombre trouvé est dit quand la liste est bornée', async () => {
        const n = 2 * lecture_par_lots_1.LOT_ECRITURES + 7;
        const { svc } = servicePagine(Array.from({ length: n }, (_, i) => ecriture(i, i < 1000)));
        const rapport = await svc.analyser('t', 'ex');
        const sansPiece = rapport.anomalies.find((a) => a.code === 'SANS_PIECE');
        expect(sansPiece?.occurrences).toHaveLength(7);
        expect(sansPiece?.nombre).toBeUndefined();
        expect(sansPiece?.occurrences[0].reference).toBe('VT n° 1000');
    });
    it('au-delà de deux cents, la liste s’arrête et le total se dit', async () => {
        const n = lecture_par_lots_1.LOT_ECRITURES + 30;
        const { svc } = servicePagine(Array.from({ length: n }, (_, i) => ecriture(i, false)));
        const sansPiece = (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === 'SANS_PIECE');
        expect(sansPiece?.occurrences).toHaveLength(200);
        expect(sansPiece?.nombre).toBe(n);
    });
    it('les soldes de tiers se cumulent sur tous les lots', async () => {
        const ecritures = Array.from({ length: 2 * lecture_par_lots_1.LOT_ECRITURES + 7 }, (_, i) => ecriture(i, true));
        ecritures.push({
            ...ecriture(99999, true),
            lignes: [
                { debit: 200_000, credit: 0, lettre: null, compte: { numero: '52110000' } },
                { debit: 0, credit: 200_000, lettre: null, compte: { numero: '41110000' } },
            ],
        });
        const { svc } = servicePagine(ecritures);
        const inverse = (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === 'TIERS_SOLDE_INVERSE');
        expect(inverse?.occurrences[0]).toMatchObject({ reference: '41110000', montant: (2 * lecture_par_lots_1.LOT_ECRITURES + 7) * 100 - 200_000 });
    });
});
describe('F185 · toute collecte bornée dit son total', () => {
    it('chaque collecte servie en occurrences porte aussi son nombre quand elle est tronquée', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'controles.service.ts'), 'utf8');
        const servies = new Set([...source.matchAll(/parcours\.(\w+)\.elements/g)].map((m) => m[1]));
        expect(servies.size).toBeGreaterThanOrEqual(8);
        for (const nom of servies) {
            expect({ nom, dit: source.includes(`nombreSiTronque(parcours.${nom})`) }).toEqual({ nom, dit: true });
        }
    });
});
//# sourceMappingURL=controles-par-tranches.spec.js.map
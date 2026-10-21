"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
function service(lignes, finExercice = '2026-12-31') {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date(`${finExercice.slice(0, 4)}-01-01`),
                dateFin: new Date(finExercice),
                dateArreteComptes: null,
            }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                nom: 'Dossier',
                referentiel: client_1.Referentiel.SYSCOHADA,
                formeJuridique: null,
                droitEtranger: false,
                actePersonnaliteJuridique: null,
                attestationExemptionIs: null,
                dateAttestationExemptionIs: null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation((a) => {
                const prefixes = (a?.where?.OR ?? []).map((o) => o.compte?.numero?.startsWith).filter(Boolean);
                if (prefixes.length === 0)
                    return Promise.resolve([]);
                return Promise.resolve(lignes
                    .filter((l) => prefixes.some((prefixe) => l.numero.startsWith(prefixe)))
                    .map((l) => ({ debit: l.debit, credit: l.credit, compte: { numero: l.numero, intitule: l.intitule } })));
            }),
            groupBy: jest.fn().mockImplementation((a) => {
                const prefixes = (a?.where?.OR ?? []).map((o) => o.compte?.numero?.startsWith).filter(Boolean);
                return Promise.resolve(lignes
                    .filter((l) => prefixes.some((prefixe) => l.numero.startsWith(prefixe)))
                    .map((l) => ({ compteId: l.numero, _sum: { debit: l.debit, credit: l.credit } })));
            }),
        },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const SOURCE = require('fs').readFileSync(require('path').join(__dirname, 'controles.service.ts'), 'utf8');
const BLOC = SOURCE.slice(SOURCE.indexOf('DECLARATION_REEVALUATION_A_DEPOSER'), SOURCE.indexOf('const ordre: Record<Gravite'));
describe('Déclaration spéciale de réévaluation · les deux chiffres du texte en vigueur', () => {
    it('cite 300 000 francs par jour, jamais 100 000 · l’ancien montant vient d’un texte abrogé', () => {
        const bloc = BLOC;
        expect(bloc).toContain('300.000,00');
        expect(bloc).not.toContain('100 000');
        expect(bloc).not.toContain('100.000,00');
    });
    it('écrit « AU PLUS TARD le 30 avril », la formule de l’art. 136 · pas « avant le 30 avril »', () => {
        const bloc = BLOC;
        expect(bloc).toContain('AU PLUS TARD LE 30 AVRIL');
        expect(bloc.toLowerCase()).not.toContain('avant le 30 avril');
    });
    it('l’ordonnance-loi abrogée n’est citée nulle part comme droit positif', () => {
        const bloc = BLOC;
        expect(bloc).not.toContain('89/017');
    });
});
describe('Déclaration spéciale de réévaluation · déclenchement et bornage', () => {
    const anomalie = async (lignes, finExercice = '2026-12-31') => {
        const r = await service(lignes, finExercice).analyser('t', 'ex');
        return r.anomalies.find((a) => a.code === 'DECLARATION_REEVALUATION_A_DEPOSER');
    };
    it('se déclenche sur un mouvement du 106', async () => {
        const a = await anomalie([{ numero: '10610000', intitule: 'Écarts de réévaluation légale', debit: 0, credit: 5000000 }]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
    });
    it('se déclenche aussi sur le 154 · c’est le schéma attendu quand la neutralité fiscale est exigée', async () => {
        const a = await anomalie([{ numero: '15400000', intitule: 'Provisions spéciales de réévaluation', debit: 0, credit: 900000 }]);
        expect(a).toBeDefined();
    });
    it('ne se déclenche pas sans mouvement', async () => {
        expect(await anomalie([])).toBeUndefined();
    });
    it('NE SE DÉCLENCHE PAS sur un exercice 2025 · la loi n’entre en vigueur qu’au 1er janvier 2026', async () => {
        const a = await anomalie([{ numero: '10610000', intitule: 'Écarts de réévaluation légale', debit: 0, credit: 5000000 }], '2025-12-31');
        expect(a).toBeUndefined();
    });
    it('ne CONSTATE aucun manquement · le dépôt est un fait externe', async () => {
        const a = await anomalie([{ numero: '10610000', intitule: 'Écarts', debit: 0, credit: 5000000 }]);
        expect(a.consequence).toContain('NE CONSTATE AUCUN MANQUEMENT');
        expect(a.libelle).not.toMatch(/non déposée|manquante|absente/i);
    });
    it('porte la réserve sur les entités à but non lucratif au lieu de la taire', async () => {
        const a = await anomalie([{ numero: '10610000', intitule: 'Écarts', debit: 0, credit: 5000000 }]);
        expect(a.consequence).toContain('n’est tranché par aucun texte lu');
    });
    it('ne descend PAS sous le 106 · 1061 et 1062 ne veulent pas dire la même chose des deux côtés', () => {
        const table = SOURCE.slice(SOURCE.indexOf('const COMPTES_REEVALUATION'), SOURCE.indexOf('const COMPTES_REEVALUATION') + 200);
        expect(table).toContain("'106'");
        expect(table).not.toContain("'1061'");
        expect(table).not.toContain("'1062'");
    });
});
describe('Passe F6 · chaque interdit de l’écart de réévaluation nomme SA source', () => {
    it('rend la non-distribution à l’AUDCIF et la compensation des pertes à la loi fiscale', () => {
        expect(BLOC).toContain('ni distribuable (art. 65 AUDCIF)');
        expect(BLOC).toContain('loi n° 23/053, art. 133, alinéa 4');
    });
    it('dit que les deux interdits viennent de deux textes distincts, et le dit à l’écran', () => {
        expect(BLOC).toContain('DEUX textes distincts');
        expect(BLOC).toContain('AMORTISSABLES');
    });
});
//# sourceMappingURL=declaration-reevaluation.spec.js.map
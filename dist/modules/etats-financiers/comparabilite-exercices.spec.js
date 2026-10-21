"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const comparabilite_exercices_1 = require("./comparabilite-exercices");
const ex = (debut, fin) => ({ dateDebut: new Date(debut), dateFin: new Date(fin) });
describe('Comparabilité de la colonne N-1', () => {
    it('deux exercices de douze mois se comparent · l’exception reste l’exception', () => {
        const c = (0, comparabilite_exercices_1.evaluerComparabilite)(client_1.Referentiel.SYCEBNL, ex('2026-01-01', '2026-12-31'), ex('2025-01-01', '2025-12-31'));
        expect(c.disponible).toBe(true);
        expect(c.comparable).toBe(true);
        expect(c.motifs).toHaveLength(0);
    });
    it('une année BISSEXTILE ne rend rien incomparable · l’unité du texte est le MOIS', () => {
        const c = (0, comparabilite_exercices_1.evaluerComparabilite)(client_1.Referentiel.SYSCOHADA, ex('2028-01-01', '2028-12-31'), ex('2027-01-01', '2027-12-31'));
        expect(c.comparable).toBe(true);
    });
    it('un premier exercice de six mois rend la DEUXIÈME liasse non comparable', () => {
        const c = (0, comparabilite_exercices_1.evaluerComparabilite)(client_1.Referentiel.SYCEBNL, ex('2026-01-01', '2026-12-31'), ex('2025-07-01', '2025-12-31'));
        expect(c.comparable).toBe(false);
        expect(c.motifs.map((m) => m.code)).toEqual(['DUREE_DIFFERENTE']);
        expect(c.motifs[0].phrase).toContain('12 mois');
        expect(c.motifs[0].phrase).toContain('6');
    });
    it('un premier exercice PLUS LONG que douze mois est signalé aussi', () => {
        const c = (0, comparabilite_exercices_1.evaluerComparabilite)(client_1.Referentiel.SYSCOHADA, ex('2027-01-01', '2027-12-31'), ex('2025-09-01', '2026-12-31'));
        expect(c.comparable).toBe(false);
        expect((0, comparabilite_exercices_1.moisCouverts)(ex('2025-09-01', '2026-12-31'))).toBe(16);
    });
    it('le PREMIER exercice du dossier ne porte aucun motif · il n’a pas de colonne à qualifier', () => {
        const c = (0, comparabilite_exercices_1.evaluerComparabilite)(client_1.Referentiel.SYCEBNL, ex('2026-01-01', '2026-12-31'), null);
        expect(c.disponible).toBe(false);
        expect(c.comparable).toBe(true);
        expect(c.motifs).toHaveLength(0);
    });
    it('chaque référentiel cite SON article, jamais celui de l’autre', () => {
        const ebnl = (0, comparabilite_exercices_1.articleComparabilite)(client_1.Referentiel.SYCEBNL);
        const commercial = (0, comparabilite_exercices_1.articleComparabilite)(client_1.Referentiel.SYSCOHADA);
        expect(ebnl).toContain('SYCEBNL art. 16, 7°');
        expect(commercial).toContain('AUDCIF art. 34');
        expect(commercial).not.toContain('SYCEBNL art. 16');
        expect(ebnl).toContain('écarte');
    });
    it('LE MODULE N’ADAPTE RIEN · aucun prorata dans la source', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'comparabilite-exercices.ts'), 'utf8');
        const code = source
            .split('\n')
            .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//') && !l.trimStart().startsWith('/*'))
            .join('\n');
        for (const interdit of ['prorata', 'proratis', 'adapter(', 'adapte(', 'ajuster(']) {
            expect(code.toLowerCase()).not.toContain(interdit.toLowerCase());
        }
        expect(code).not.toMatch(/moisN\s*\/\s*moisN1|moisN1\s*\/\s*moisN/);
    });
});
const controles_service_1 = require("../controles/controles.service");
function serviceControles(referentiel, precedent) {
    const courant = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), dateArreteComptes: new Date('2027-03-31') };
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const filtreFin = where.dateFin;
                if (filtreFin?.lt) {
                    return Promise.resolve(precedent ? { id: 'exN1', dateDebut: new Date(precedent.dateDebut), dateFin: new Date(precedent.dateFin) } : null);
                }
                return Promise.resolve(courant);
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (referentiel, precedent) => {
    const rapport = await serviceControles(referentiel, precedent).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'COMPARATIF_N1_NON_COMPARABLE');
};
describe('le contrôle qui refuse de servir la colonne N-1 en silence', () => {
    it('SYCEBNL · signale un précédent de six mois, et cite SON article', async () => {
        const a = await anomalie(client_1.Referentiel.SYCEBNL, { dateDebut: '2025-07-01', dateFin: '2025-12-31' });
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.consequence).toContain('SYCEBNL art. 16, 7°');
        expect(a.consequence).toContain('Notes annexes');
        expect(a.action).toMatch(/n’adapte aucun chiffre|proratis/i);
    });
    it('SYSCOHADA · même signalement, article de l’AUDCIF', async () => {
        const a = await anomalie(client_1.Referentiel.SYSCOHADA, { dateDebut: '2025-07-01', dateFin: '2025-12-31' });
        expect(a.consequence).toContain('AUDCIF art. 34');
        expect(a.consequence).not.toContain('SYCEBNL art. 16');
    });
    it('se TAIT quand les deux exercices font douze mois · pas d’anomalie fabriquée', async () => {
        expect(await anomalie(client_1.Referentiel.SYCEBNL, { dateDebut: '2025-01-01', dateFin: '2025-12-31' })).toBeUndefined();
    });
    it('se TAIT sur le premier exercice du dossier', async () => {
        expect(await anomalie(client_1.Referentiel.SYSCOHADA, null)).toBeUndefined();
    });
});
//# sourceMappingURL=comparabilite-exercices.spec.js.map
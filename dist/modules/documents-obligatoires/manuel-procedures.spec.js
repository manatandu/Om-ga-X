"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const manuel_procedures_service_1 = require("./manuel-procedures.service");
const controles_service_1 = require("../controles/controles.service");
function service(versions = []) {
    const crees = [];
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
        manuelProcedures: {
            findMany: jest.fn().mockResolvedValue([...versions]
                .sort((a, b) => b.version - a.version)
                .map((v) => ({ ...v, dateApplication: new Date('2026-01-01') }))),
            findFirst: jest
                .fn()
                .mockResolvedValue(versions.length ? versions.reduce((a, b) => (a.version > b.version ? a : b)) : null),
            create: jest.fn().mockImplementation(({ data }) => {
                crees.push(data);
                return Promise.resolve({ id: 'm1', ...data });
            }),
        },
    };
    return { svc: new manuel_procedures_service_1.ManuelProceduresService(prisma), crees };
}
const SECTIONS = [
    { cle: 'organisation', titre: 'Organisation', texte: 'Un comptable, un chef comptable, un directeur financier.' },
    { cle: 'classement-archivage', titre: 'Classement', texte: 'Par journal, puis par numéro de pièce croissant.' },
];
describe('le manuel se VERSIONNE, il ne s’écrase pas', () => {
    it('la première version porte le numéro 1', async () => {
        const { svc, crees } = service();
        await svc.enregistrer('t1', 'u1', { dateApplication: '2026-01-01', sections: SECTIONS });
        expect(crees[0].version).toBe(1);
    });
    it('la suivante incrémente, sans toucher à la précédente', async () => {
        const { svc, crees } = service([{ version: 3, sections: SECTIONS }]);
        await svc.enregistrer('t1', 'u1', { dateApplication: '2027-01-01', sections: SECTIONS });
        expect(crees[0].version).toBe(4);
    });
    it('refuse un manuel sans section', async () => {
        const { svc } = service();
        await expect(svc.enregistrer('t1', 'u1', { dateApplication: '2026-01-01', sections: [] })).rejects.toThrow(/ne décrit rien/i);
    });
    it('refuse deux sections de même clé · chacune doit être identifiable', async () => {
        const { svc } = service();
        await expect(svc.enregistrer('t1', 'u1', {
            dateApplication: '2026-01-01',
            sections: [SECTIONS[0], { ...SECTIONS[1], cle: 'organisation' }],
        })).rejects.toThrow(/même clé/i);
    });
});
describe('le squelette proposé', () => {
    it('reprend les sept rubriques que le CPCC énumère', () => {
        expect(manuel_procedures_service_1.SQUELETTE_MANUEL).toHaveLength(7);
        expect(manuel_procedures_service_1.SQUELETTE_MANUEL.map((s) => s.cle)).toContain('classement-archivage');
        expect(manuel_procedures_service_1.SQUELETTE_MANUEL.every((s) => s.texte === '')).toBe(true);
    });
});
describe('la conformité dit ce qui est vérifiable, et rien de plus', () => {
    it('signale l’absence de manuel', async () => {
        const { svc } = service();
        const c = await svc.conformite('t1');
        expect(c.existe).toBe(false);
        expect(c.classementRenseigne).toBe(false);
    });
    it('relève les sections restées vides', async () => {
        const { svc } = service([
            { version: 1, sections: [SECTIONS[0], { cle: 'classement-archivage', titre: 'Classement', texte: '  ' }] },
        ]);
        const c = await svc.conformite('t1');
        expect(c.existe).toBe(true);
        expect(c.sectionsVides).toEqual(['Classement']);
        expect(c.classementRenseigne).toBe(false);
    });
    it('reconnaît un manuel dont le classement est décrit', async () => {
        const { svc } = service([{ version: 2, sections: SECTIONS }]);
        const c = await svc.conformite('t1');
        expect(c.classementRenseigne).toBe(true);
        expect(c.sectionsVides).toEqual([]);
    });
});
describe('chaque référentiel cite le chemin par lequel l’obligation lui parvient', () => {
    it('le SYSCOHADA cite les articles de l’AUDCIF, seuls', () => {
        const s = (0, manuel_procedures_service_1.sourceManuel)(client_1.Referentiel.SYSCOHADA);
        expect(s).toContain('art. 16 al. 1');
        expect(s).toContain('art. 17, 3°');
        expect(s).not.toContain('SYCEBNL');
    });
    it('le SYCEBNL cite le RENVOI de son art. 3, et son propre art. 16, 2)', () => {
        const s = (0, manuel_procedures_service_1.sourceManuel)(client_1.Referentiel.SYCEBNL);
        expect(s).toContain("l'art. 3 du SYCEBNL");
        expect(s).toContain('art. 16, 2) du SYCEBNL');
        expect(s).toContain('contrôle interne fiable');
    });
});
function serviceControles(referentiel, manuel) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                dateArreteComptes: new Date('2027-04-28'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'Dossier test', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(manuel) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (code, referentiel, manuel) => {
    const rapport = await serviceControles(referentiel, manuel).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === code);
};
describe('les contrôles du manuel', () => {
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · signale l’absence complète de manuel`, async () => {
            const a = await anomalie('MANUEL_PROCEDURES_ABSENT', referentiel, null);
            expect(a).toBeDefined();
            expect(a.gravite).toBe('AVERTISSEMENT');
            expect(a.consequence).toContain('comptabilité reste équilibrée');
        });
    }
    it('se tait dès qu’un manuel existe', async () => {
        const a = await anomalie('MANUEL_PROCEDURES_ABSENT', client_1.Referentiel.SYSCOHADA, {
            version: 1,
            sections: SECTIONS,
        });
        expect(a).toBeUndefined();
    });
    it('signale, en INFORMATION, un manuel muet sur l’ordre de classement', async () => {
        const a = await anomalie('MANUEL_SANS_ORDRE_DE_CLASSEMENT', client_1.Referentiel.SYSCOHADA, {
            version: 5,
            sections: [SECTIONS[0]],
        });
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
        expect(a.occurrences[0].reference).toBe('Manuel version 5');
    });
    it('ne signale pas le classement quand il est décrit', async () => {
        expect(await anomalie('MANUEL_SANS_ORDRE_DE_CLASSEMENT', client_1.Referentiel.SYSCOHADA, { version: 5, sections: SECTIONS })).toBeUndefined();
    });
});
//# sourceMappingURL=manuel-procedures.spec.js.map
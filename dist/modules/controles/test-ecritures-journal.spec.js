"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const ExcelJS = require("exceljs");
const client_1 = require("@prisma/client");
const test_ecritures_journal_service_1 = require("./test-ecritures-journal.service");
const test_ecritures_journal_1 = require("./test-ecritures-journal");
const export_service_1 = require("../exports/export.service");
const EXERCICE = {
    id: 'ex',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    dateArreteComptes: new Date('2027-04-20'),
};
const COMPTABLE = { id: 'u-compta', email: 'jeanne@cabinet.cd', role: client_1.RoleUtilisateur.COMPTABLE };
const ADMIN = { id: 'u-admin', email: 'patron@cabinet.cd', role: client_1.RoleUtilisateur.ADMIN_CABINET };
const ligne = (numero, debit, credit = 0) => ({
    debit,
    credit,
    compte: { numero, intitule: `Compte ${numero}` },
});
const ORDINAIRE = {
    id: 'e-ordinaire',
    date: new Date('2026-05-14'),
    createdAt: new Date('2026-05-15T09:12:00Z'),
    createdBy: COMPTABLE.id,
    valideeAt: new Date('2026-05-16T10:00:00Z'),
    valideeBy: COMPTABLE.id,
    statut: client_1.StatutEcriture.VALIDEE,
    numeroPiece: 12,
    reference: 'FA-2026-0087',
    libelle: 'Achat de fournitures de bureau, facture Kin Papeterie',
    motifCorrection: null,
    journal: { code: 'ACH' },
    lignes: [ligne('60100000', 745_320), ligne('40100000', 0, 745_320)],
};
function service(ecritures) {
    const lignesDe = (liste) => liste.flatMap((e) => e.lignes ?? []);
    const numeros = [...new Set(lignesDe(ecritures).map((l) => l.compte.numero))];
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        user: { findMany: jest.fn().mockResolvedValue([COMPTABLE, ADMIN]) },
        compte: { findMany: jest.fn().mockResolvedValue(numeros.map((n) => ({ id: n, numero: n }))) },
        ligneEcriture: {
            groupBy: jest.fn(async ({ where }) => {
                const retenues = ecritures.filter((e) => !(e.estGenereeParCloture === true && where.ecriture.estGenereeParCloture === false));
                const lignes = lignesDe(retenues);
                return numeros
                    .map((n) => ({ compteId: n, _count: { _all: lignes.filter((l) => l.compte.numero === n).length } }))
                    .filter((g) => g._count._all > 0);
            }),
        },
    };
    return new test_ecritures_journal_service_1.TestEcrituresJournalService(prisma);
}
const criteresDe = async (e) => {
    const remplissage = Array.from({ length: 5 }, (_, i) => ({ ...ORDINAIRE, id: `r${i}` }));
    const r = await service([...remplissage, e]).selection('t1', 'ex');
    return r.selection.find((s) => s.id === e.id)?.criteres ?? [];
};
describe('la sélection ISA 240 · § 33 a)', () => {
    it('laisse tranquille une écriture ordinaire', async () => {
        expect(await criteresDe({ ...ORDINAIRE, id: 'temoin' })).toEqual([]);
    });
    it('retient les écritures de FIN DE PÉRIODE · l’exigence du § 33 a) ii)', async () => {
        const c = await criteresDe({ ...ORDINAIRE, id: 'e1', date: new Date('2026-12-30') });
        expect(c).toContain('FIN_DE_PERIODE');
    });
    it('retient une écriture SAISIE APRÈS la clôture, et dit de combien', async () => {
        const e = { ...ORDINAIRE, id: 'e2', date: new Date('2026-12-31'), createdAt: new Date('2027-03-15T08:00:00Z') };
        expect(await criteresDe(e)).toContain('SAISIE_APRES_CLOTURE');
        const r = await service([e]).selection('t1', 'ex');
        expect(r.selection[0].joursEntreDateEtSaisie).toBe(74);
    });
    it('retient « peu ou pas de justification » · libellé court ou pièce absente', async () => {
        expect(await criteresDe({ ...ORDINAIRE, id: 'e3', libelle: 'OD' })).toContain('SANS_JUSTIFICATION');
        expect(await criteresDe({ ...ORDINAIRE, id: 'e4', reference: null })).toContain('SANS_JUSTIFICATION');
    });
    it('retient une écriture passée par un ADMINISTRATEUR du cabinet', async () => {
        const c = await criteresDe({ ...ORDINAIRE, id: 'e5', createdBy: ADMIN.id });
        expect(c).toContain('AUTEUR_INATTENDU');
    });
    it('retient une écriture dont l’auteur a été RETIRÉ du dossier', async () => {
        const r = await service([{ ...ORDINAIRE, id: 'e6', createdBy: 'fantome' }]).selection('t1', 'ex');
        expect(r.selection[0].criteres).toContain('AUTEUR_INATTENDU');
        expect(r.selection[0].saisiePar).toBe('utilisateur retiré du dossier');
    });
    it('retient les CHIFFRES RONDS, et seulement au-dessus du plancher', async () => {
        const rond = { ...ORDINAIRE, id: 'e7', lignes: [ligne('60100000', 5_000_000), ligne('40100000', 0, 5_000_000)] };
        expect(await criteresDe(rond)).toContain('MONTANT_ROND');
        const petit = { ...ORDINAIRE, id: 'e8', lignes: [ligne('60100000', 900_000), ligne('40100000', 0, 900_000)] };
        expect(await criteresDe(petit)).not.toContain('MONTANT_ROND');
    });
    it('retient les COMPTES RAREMENT UTILISÉS, et les nomme', async () => {
        const r = await service([
            ...Array.from({ length: 5 }, (_, i) => ({ ...ORDINAIRE, id: `r${i}` })),
            { ...ORDINAIRE, id: 'e9', lignes: [ligne('27500000', 3_400_000), ligne('40100000', 0, 3_400_000)] },
        ]).selection('t1', 'ex');
        const e = r.selection.find((s) => s.id === 'e9');
        expect(e.criteres).toContain('COMPTE_RARE');
        expect(e.comptesRares).toEqual(['27500000']);
    });
    it('un compte de charge d’un exercice CLOS reste rare · l’écriture de clôture n’est pas un usage', async () => {
        const usage = (id) => ({
            ...ORDINAIRE, id, lignes: [ligne('65800000', 3_400_000), ligne('40100000', 0, 3_400_000)],
        });
        const cloture = {
            ...ORDINAIRE, id: 'cl', estGenereeParCloture: true,
            lignes: [ligne('65800000', 0, 6_800_000), ligne('13100000', 6_800_000)],
        };
        const r = await service([
            ...Array.from({ length: 5 }, (_, i) => ({ ...ORDINAIRE, id: `r${i}` })),
            usage('u1'),
            usage('u2'),
            cloture,
        ]).selection('t1', 'ex');
        expect(r.selection.find((s) => s.id === 'u1')?.comptesRares).toEqual(['65800000']);
    });
    it('compte les écritures retenues par critère · une sélection se justifie', async () => {
        const r = await service([...Array.from({ length: 5 }, (_, i) => ({ ...ORDINAIRE, id: `r${i}` }))]).selection('t1', 'ex');
        expect(r.totalEcritures).toBe(5);
        expect(r.parCritere).toHaveLength(test_ecritures_journal_1.CRITERES_ISA_240.length);
        expect(r.parCritere.every((p) => p.nombre === 0)).toBe(true);
    });
    it('cite le texte de la norme, jamais une paraphrase', () => {
        const exigence = test_ecritures_journal_1.CRITERES_ISA_240.find((c) => c.cle === 'FIN_DE_PERIODE');
        expect(exigence.source).toContain('exigence');
        expect(exigence.citation).toBe("sélectionner des écritures de journal et d'autres ajustements effectués à la fin de la période");
        for (const c of test_ecritures_journal_1.CRITERES_ISA_240)
            expect(c.mesure.length).toBeGreaterThan(20);
    });
    it('les seuils sont déclarés, pas enfouis dans une requête', () => {
        expect(test_ecritures_journal_1.SEUILS_ISA_240.joursFinDePeriode).toBe(7);
        expect(test_ecritures_journal_1.SEUILS_ISA_240.mouvementsCompteRare).toBe(2);
    });
});
describe('la piste d’audit, restituée · AUDCIF art. 22, 1°', () => {
    function exportService(ecritures) {
        const prisma = {
            ligneEcriture: { count: jest.fn().mockResolvedValue(ecritures.length * 2) },
            user: { findMany: jest.fn().mockResolvedValue([COMPTABLE, ADMIN]) },
            compte: { groupBy: jest.fn().mockResolvedValue([]) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', nif: 'A1234', deviseComptes: 'CDF' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE), findUnique: jest.fn().mockResolvedValue(EXERCICE) },
            journal: { findMany: jest.fn().mockResolvedValue([{ id: 'j-ach', code: 'ACH', intitule: 'Achats', type: 'ACHATS' }]) },
            ecriture: {
                count: jest.fn().mockResolvedValue(ecritures.length),
                groupBy: jest.fn().mockResolvedValue([{ journalId: 'j-ach', statut: 'VALIDEE', _count: { _all: ecritures.length } }]),
                findMany: jest.fn().mockResolvedValue(ecritures),
            },
        };
        const ecritureService = {};
        return new export_service_1.ExportService(prisma, ecritureService, {}, {}, {}, {}, {}, {}, {}, {});
    }
    it('le journal exporté porte le statut, la date de saisie et son auteur', async () => {
        const morceaux = [];
        const sortie = new stream_1.Writable({
            write(m, _e, cb) {
                morceaux.push(Buffer.from(m));
                cb();
            },
        });
        await exportService([
            { ...ORDINAIRE, lignes: ORDINAIRE.lignes, _count: { lignes: ORDINAIRE.lignes.length }, correction: null, corrigeEcriture: null },
        ]).journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie);
        const classeur = new ExcelJS.Workbook();
        await classeur.xlsx.load(Buffer.concat(morceaux));
        const feuille = classeur.getWorksheet('Piste de révision');
        expect(feuille).toBeDefined();
        const entetes = [];
        feuille.getRow(4).eachCell((c) => entetes.push(String(c.value ?? '')));
        for (const attendu of ['Statut', 'Saisie le', 'Saisie par', 'Validée le', 'Validée par']) {
            expect(entetes).toContain(attendu);
        }
        const tout = JSON.stringify(feuille.getRow(5).values);
        expect(tout).toContain(COMPTABLE.email);
        expect(tout).not.toContain(COMPTABLE.id);
    });
});
describe('la sélection ISA 240 se lit par tranches et se dit tronquée (audit final F185)', () => {
    it('au-delà du plafond, la sélection garde sa tête et compte tout le reste', async () => {
        const sansPiece = Array.from({ length: 7 }, (_, i) => ({ ...ORDINAIRE, id: `s${i}`, reference: null }));
        const remplissage = Array.from({ length: 5 }, (_, i) => ({ ...ORDINAIRE, id: `r${i}` }));
        const r = await service([...remplissage, ...sansPiece]).selection('t1', 'ex', 3);
        expect(r.selection).toHaveLength(3);
        expect(r.totalRetenues).toBe(7);
        expect(r.tronque).toBe(true);
        expect(r.totalEcritures).toBe(12);
        expect(r.parCritere.find((c) => c.cle === 'SANS_JUSTIFICATION')?.nombre).toBe(7);
    });
    it('le classeur remis à l’auditeur refuse une sélection plus grande qu’un classeur en mémoire', async () => {
        const svc = new export_service_1.ExportService({}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        svc.testEcrituresJournal = {
            selection: jest.fn().mockResolvedValue({ totalRetenues: 50_001, selection: [], tronque: true }),
        };
        await expect(svc.testEcrituresJournalExcel('t1', 'ex')).rejects.toThrow(/Test des écritures de journal \(ISA 240\) : 50[\s ]001 lignes/);
    });
});
//# sourceMappingURL=test-ecritures-journal.spec.js.map
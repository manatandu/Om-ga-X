"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const controles_service_1 = require("./controles.service");
let idLigne = 0;
const RECLASSE_LE = new Date('2026-01-10');
function ligne(numero, debit, credit = 0, creanceReclassee = false) {
    idLigne += 1;
    return {
        id: `l${idLigne}`,
        debit,
        credit,
        lettre: null,
        compte: {
            id: `c-${numero}`,
            numero,
            intitule: `Compte ${numero}`,
            ...(creanceReclassee ? { creancesDouteusesSource: [{ dateReclassement: RECLASSE_LE }] } : {}),
        },
    };
}
function ecriture(libelle, lignes, liaisons = {}, date = new Date('2026-01-05')) {
    return {
        id: `e-${libelle}`,
        date,
        libelle,
        reference: 'PJ-1',
        numeroPiece: 1,
        createdAt: new Date('2026-01-05'),
        statut: 'VALIDEE',
        journalId: 'jOD',
        journal: { code: 'OD' },
        lignes,
        ...liaisons,
    };
}
function service(ecritures) {
    const prisma = {
        exercice: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }) },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                referentiel: client_1.Referentiel.SYSCOHADA,
                jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
                systemeComptableSyscohada: null,
                formeJuridiqueSyscohada: null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
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
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anciennes = async (ecritures) => (await service(ecritures).analyser('t', 'ex')).anomalies.find((a) => a.code === 'TIERS_ANCIEN_NON_LETTRE');
const facture = () => ecriture('Facture F-118', [ligne('41110001', 1_160_000, 0, true), ligne('70100000', 0, 1_000_000), ligne('44310000', 0, 160_000)]);
const reclassement = (annuleeLe = null) => ecriture('Créance douteuse reclassée', [ligne('41620000', 1_160_000), ligne('41110001', 0, 1_160_000, true)], {
    creanceDouteuseReclassement: { annuleeLe },
});
const perte = (annuleeLe = null, creanceAnnulee = null) => ecriture('Perte sur créance irrécouvrable', [ligne('65110000', 400_000), ligne('41620000', 0, 400_000)], {
    mouvementCreanceDouteuse: { annuleeLe, creance: { annuleeLe: creanceAnnulee } },
});
describe('A7 ter, B2 (a) · le contrôle d’ancienneté laisse au module ce qu’il tient', () => {
    it('le reclassement et la perte d’une créance en vigueur sortent du contrôle, reconnus par leur liaison', async () => {
        const a = await anciennes([facture(), reclassement(), perte()]);
        expect(a).toBeDefined();
        expect(a.occurrences.map((o) => o.detail)).toEqual([
            "Facture F-118 · compte d'une créance reclassée au 416, à ne pas lettrer avec le reclassement",
        ]);
        expect(a.action).toMatch(/ne se lettre pas avec le reclassement/);
    });
    it('un acte ANNULÉ, ou une créance annulée, ne tient plus rien · ses écritures reviennent au contrôle', async () => {
        const a = await anciennes([reclassement(new Date('2026-03-01')), perte(new Date('2026-03-01')), perte(null, new Date('2026-03-02'))]);
        expect(a.occurrences).toHaveLength(3);
    });
    it('mineur 9 · une vente postérieure au reclassement n’est pas annotée ; une facture antérieure l’est, taxée ou non (règle d’A7)', async () => {
        const posterieure = ecriture('Facture F-130', [ligne('41110001', 580_000, 0, true), ligne('70100000', 0, 500_000), ligne('44310000', 0, 80_000)], {}, new Date('2026-01-20'));
        const sansTva = ecriture('Facture F-119', [ligne('41110001', 300_000, 0, true), ligne('70100000', 0, 300_000)]);
        const a = await anciennes([facture(), posterieure, sansTva]);
        expect(a.occurrences.map((o) => o.detail)).toEqual([
            "Facture F-118 · compte d'une créance reclassée au 416, à ne pas lettrer avec le reclassement",
            'Facture F-130',
            "Facture F-119 · compte d'une créance reclassée au 416, à ne pas lettrer avec le reclassement",
        ]);
    });
    it('sans liaison servie, rien ne passe pour tenu · une facture ordinaire reste listée telle quelle', async () => {
        const a = await anciennes([ecriture('Facture ordinaire', [ligne('41110009', 300_000), ligne('70100000', 0, 300_000)])]);
        expect(a.occurrences.map((o) => o.detail)).toEqual(['Facture ordinaire']);
    });
    it('mineur 1 et m-d · le compte d’origine d’une créance reclassée devenu créditeur a son constat, en AVERTISSEMENT, hors du solde inversé', async () => {
        const reglement = ecriture('Règlement client', [ligne('52110000', 400_000), ligne('41110001', 0, 400_000, true)]);
        const r = await service([facture(), reclassement(), reglement]).analyser('t', 'ex');
        const constat = r.anomalies.find((a) => a.code === 'COMPTE_CREANCE_RECLASSEE_CREDITEUR');
        expect(constat).toMatchObject({ gravite: 'AVERTISSEMENT' });
        expect(constat.occurrences).toEqual([expect.objectContaining({ reference: '41110001', montant: -400_000 })]);
        expect(constat.action).toMatch(/passez l’encaissement par « Recouvrement » dans « Créances douteuses ou litigieuses »/);
        const inverse = r.anomalies.find((a) => a.code === 'TIERS_SOLDE_INVERSE');
        expect(inverse?.occurrences.map((o) => o.reference) ?? []).not.toContain('41110001');
    });
    it('la lecture porte les trois liaisons et le compte d’origine en vigueur (une seule lecture des écritures)', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'controles.service.ts'), 'utf8');
        const select = source.slice(source.indexOf('const SELECT_ECRITURE_CONTROLEE'), source.indexOf('satisfies Prisma.EcritureSelect'));
        expect(select).toContain('creanceDouteuseReclassement: { select: { annuleeLe: true } }');
        expect(select).toContain('mouvementCreanceDouteuse: { select: { annuleeLe: true, creance: { select: { annuleeLe: true } } } }');
        expect(select).toContain('ajustementCreanceDouteuse: { select: { annuleeLe: true, creance: { select: { annuleeLe: true } } } }');
        expect(select).toMatch(/creancesDouteusesSource: \{\s*where: \{ annuleeLe: null \},\s*select: \{ dateReclassement: true \},\s*orderBy: \{ dateReclassement: 'desc' \},\s*take: 1,/);
    });
});
//# sourceMappingURL=tiers-ancien-creance-douteuse.spec.js.map
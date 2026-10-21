"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reglements_sans_ecart_1 = require("./reglements-sans-ecart");
let n = 0;
const ligne = (ecritureId, lettrageId, debit, credit, devise, date, numero = '40110000', tresorerie) => ({
    id: `l${++n}`,
    ecritureId,
    lettrageId,
    debit,
    credit,
    montantDevise: devise,
    compte: { numero },
    ecriture: {
        date: new Date(date),
        numeroPiece: n,
        journal: { code: 'OD', type: 'GENERAL' },
        lignes: (tresorerie ?? ecritureId !== 'f') ? [{ id: 'tr' }] : [],
    },
});
function monter(lignes, pieces = []) {
    const findMany = jest.fn(async ({ where }) => where.ecritureId ? pieces.filter((p) => where.ecritureId.in.includes(p.ecritureId)).map((p) => ({ ecritureId: p.ecritureId, compte: { numero: p.numero } })) : lignes);
    return { prisma: { ligneEcriture: { findMany } }, findMany };
}
const p = { tenantId: 't', exerciceId: 'n', referentiel: 'SYSCOHADA' };
describe('les règlements en devise qui ont soldé le tiers au payé', () => {
    it('600 USD portés 1 050 000 contre 1 008 000 d’origine · 42 000 de perte non constatée, signalés', async () => {
        const { prisma, findMany } = monter([ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'), ligne('r', 'L', 1_050_000, 0, 600, '2026-05-15')], [
            { ecritureId: 'r', numero: '40110000' },
            { ecritureId: 'r', numero: '57110000' },
        ]);
        const r = await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p);
        expect(r.elements).toEqual([
            expect.objectContaining({ compteNumero: '40110000', montantDevise: 600, francsPortes: 1_050_000, francsHistoriques: 1_008_000, ecart: 42_000 }),
        ]);
        expect(findMany.mock.calls[0][0].where).toMatchObject({ lettrage: { statut: 'PARTIEL' }, deviseId: { not: null }, ecriture: { exerciceId: 'n' } });
        expect(findMany.mock.calls[0][0].take).toBeGreaterThan(0);
    });
    it('réglé au coût historique avec sa ligne d’écart (A6), ou pièce qui porte un 656 · rien', async () => {
        const a6 = monter([ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'), ligne('r', 'L', 1_008_000, 0, 600, '2026-05-15')]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(a6.prisma, p)).elements).toEqual([]);
        const avec656 = monter([ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'), ligne('r', 'L', 1_050_000, 0, 600, '2026-05-15')], [
            { ecritureId: 'r', numero: '65600000' },
        ]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(avec656.prisma, p)).elements).toEqual([]);
    });
    it('côté client, encaisser moins que l’origine est une perte', async () => {
        const { prisma } = monter([ligne('f', 'M', 1_948_800, 0, 1160, '2026-04-10', '41110000'), ligne('r', 'M', 0, 960_000, 600, '2026-05-15', '41110000')]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).elements[0]).toMatchObject({ ecart: 48_000 });
    });
    it('un acompte antérieur à la facture · écarté et compté, jamais signalé comme anomalie', async () => {
        const { prisma } = monter([ligne('acompte', 'L', 1_350_000, 0, 500, '2026-03-01', '40110000', true), ligne('f', 'L', 0, 2_800_000, 1000, '2026-04-10')]);
        expect(await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).toEqual({ elements: [], tronque: false, nonReconnaissables: 1 });
    });
    it('un avoir dans le groupe (factures des deux sens) · écarté et compté', async () => {
        const { prisma } = monter([
            ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'),
            ligne('f', 'L', 168_000, 0, 100, '2026-04-20', '40110000', false),
            ligne('r', 'L', 1_050_000, 0, 600, '2026-05-15'),
        ]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).nonReconnaissables).toBe(1);
    });
    it('factures à des cours différents · le coût historique se lit par la règle d’A6, jamais au cours moyen', async () => {
        const a6 = monter([
            ligne('f', 'L', 0, 1_600_000, 1000, '2026-03-01'),
            ligne('f', 'L', 0, 1_800_000, 1000, '2026-04-01'),
            ligne('r', 'L', 1_600_000, 0, 1000, '2026-05-15'),
        ]);
        expect(await (0, reglements_sans_ecart_1.reglementsSansEcart)(a6.prisma, p)).toEqual({ elements: [], tronque: false, nonReconnaissables: 0 });
        const auPaye = monter([
            ligne('f', 'L', 0, 1_600_000, 1000, '2026-03-01'),
            ligne('f', 'L', 0, 1_800_000, 1000, '2026-04-01'),
            ligne('r', 'L', 1_750_000, 0, 1000, '2026-05-15'),
        ]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(auPaye.prisma, p)).elements).toEqual([
            expect.objectContaining({ francsPortes: 1_750_000, francsHistoriques: 1_600_000, ecart: 150_000 }),
        ]);
    });
    it('deux règlements successifs · le second reprend où le premier s’est arrêté', async () => {
        const { prisma } = monter([
            ligne('f', 'L', 0, 1_600_000, 1000, '2026-03-01'),
            ligne('f', 'L', 0, 1_800_000, 1000, '2026-04-01'),
            ligne('r', 'L', 1_600_000, 0, 1000, '2026-05-15'),
            ligne('s', 'L', 900_000, 0, 500, '2026-06-15'),
        ]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).elements).toEqual([]);
    });
    it('une ligne d’à-nouveau (clôture ou provisoire) n’est jamais un règlement · la facture reportée est reconnue', async () => {
        for (const drapeau of [{ estGenereeParCloture: true }, { estANouveauProvisoire: true }]) {
            const report = ligne('ran', 'L', 0, 1_948_800, 1160, '2027-01-01', '40110000', true);
            Object.assign(report.ecriture, drapeau);
            const { prisma } = monter([report, ligne('r', 'L', 1_050_000, 0, 600, '2027-02-15')]);
            expect(await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).toEqual({
                elements: [expect.objectContaining({ francsHistoriques: 1_008_000, ecart: 42_000 })],
                tronque: false,
                nonReconnaissables: 0,
            });
        }
    });
    it('des règlements qui dépassent les factures dans leur devise · écartés et comptés, rien n’est conclu', async () => {
        const { prisma } = monter([ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'), ligne('r', 'L', 2_100_000, 0, 1200, '2026-05-15')]);
        expect(await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).toEqual({ elements: [], tronque: false, nonReconnaissables: 1 });
    });
    it('un partiel soldé dans sa devise relève du refus de la clôture (D3), pas de ce signalement', async () => {
        const { prisma } = monter([
            ligne('f', 'L', 0, 1_948_800, 1160, '2026-04-10'),
            ligne('r', 'L', 1_050_000, 0, 600, '2026-05-15'),
            ligne('s', 'L', 1_064_000, 0, 560, '2026-11-30'),
        ]);
        expect((await (0, reglements_sans_ecart_1.reglementsSansEcart)(prisma, p)).elements).toEqual([]);
    });
});
describe('le contrôle REGLEMENT_DEVISE_SANS_ECART', () => {
    it('information, exercice ouvert, sans retraitement', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const { join } = jest.requireActual('node:path');
        const source = readFileSync(join(__dirname, '../controles/controles.service.ts'), 'utf8');
        const bloc = source.slice(source.indexOf('// --- 31. Règlement en devise'), source.indexOf('const ordre: Record<Gravite, number>'));
        expect(bloc).toContain('if (ex.statut !== StatutExercice.CLOTURE) {');
        expect(bloc).toContain('await reglementsSansEcart(this.prisma');
        expect(bloc).toContain("code: 'REGLEMENT_DEVISE_SANS_ECART'");
        expect(bloc).toContain("gravite: 'INFORMATION'");
        expect(bloc).not.toMatch(/ecritures?\.creer|\.create\(/);
    });
    it('les lettrages non examinés · anomalie distincte, en information, sans libellé ni action de correction', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const { join } = jest.requireActual('node:path');
        const source = readFileSync(join(__dirname, '../controles/controles.service.ts'), 'utf8');
        const bloc = source.slice(source.indexOf("code: 'LETTRAGES_DEVISE_NON_EXAMINES'"), source.indexOf('occurrences: []', source.indexOf("code: 'LETTRAGES_DEVISE_NON_EXAMINES'")));
        expect(bloc).toContain("gravite: 'INFORMATION'");
        expect(bloc).toContain("libelle: 'Lettrages partiels en devise non examinés'");
        expect(bloc).toContain("n'ont pas pu être examinés");
        expect(bloc).toContain('acompte antérieur à la facture, avoir, pièce sans ligne de trésorerie');
        const sansEcart = source.slice(source.indexOf('// --- 31. Règlement en devise'), source.indexOf("code: 'REGLEMENT_DEVISE_SANS_ECART'"));
        expect(sansEcart).toContain('if (sansEcart.elements.length > 0 || sansEcart.tronque) {');
    });
});
//# sourceMappingURL=reglements-sans-ecart.spec.js.map
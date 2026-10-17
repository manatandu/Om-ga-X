"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const comptes_du_bien_1 = require("../immobilisations/comptes-du-bien");
function service(lignes28, o = {}) {
    const ligneFindMany = jest.fn(({ where, }) => {
        if (where.compte?.numero?.startsWith !== '28')
            return Promise.resolve([]);
        const exclues = new Set(where.ecriture?.id?.notIn ?? []);
        const sansReevaluation = !!where.ecriture && 'reevaluationBilan' in where.ecriture && where.ecriture.reevaluationBilan === null;
        const sansAnnulation = !!where.ecriture && 'annulationTraitementOrigine' in where.ecriture && where.ecriture.annulationTraitementOrigine === null;
        return Promise.resolve(lignes28
            .filter((l) => !exclues.has(l.ecritureId) && !(sansReevaluation && l.reevaluationDuModule) && !(sansAnnulation && l.retenueParUneAnnulation))
            .map((l) => ({ credit: l.credit, compte: { numero: l.numero, intitule: l.intitule } })));
    });
    const prisma = {
        exercice: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel: o.referentiel ?? client_1.Referentiel.SYCEBNL }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: ligneFindMany, groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue((o.dotationsDuModule ?? []).map((ecritureId) => ({ ecritureId }))) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: {
            findMany: jest.fn(({ where }) => Promise.resolve(where.OR
                ? (o.sortiesDuModule ?? []).map((ecritureSortieId) => ({ ecritureAcquisitionId: null, ecritureSortieId, ecritureProduitCessionId: null }))
                : [])),
            count: jest.fn().mockResolvedValue(1),
        },
    };
    return { svc: new controles_service_1.ControlesService(prisma), ligneFindMany };
}
const signale = async (...a) => (await service(...a).svc.analyser('t', 'ex')).anomalies.find((x) => x.code === 'AMORTISSEMENT_IMMO_HORS_MODULE');
describe('amortissement d’immobilisation hors module (D-21)', () => {
    it('signale un crédit du 28 passé hors fiche, par compte, en avertissement', async () => {
        const a = await signale([
            { ecritureId: 'cat', numero: '28000000', intitule: "Amortissements d'usufruit temporaire", credit: 15_000_000 },
            { ecritureId: 'main', numero: '28000000', intitule: "Amortissements d'usufruit temporaire", credit: 1_000_000 },
        ]);
        expect(a?.gravite).toBe('AVERTISSEMENT');
        expect(a?.occurrences).toEqual([expect.objectContaining({ reference: "28000000 Amortissements d'usufruit temporaire", montant: 16_000_000 })]);
        expect(a?.consequence).toMatch(/amorti deux fois/);
    });
    it('ce que le module retient ne compte pas · dotation et sortie de ses fiches', async () => {
        const lignes = [
            { ecritureId: 'dot', numero: '28310000', intitule: 'Bâtiments', credit: 4_000_000 },
            { ecritureId: 'sortie', numero: '28310000', intitule: 'Bâtiments', credit: 10 },
        ];
        expect(await signale(lignes, { dotationsDuModule: ['dot'], sortiesDuModule: ['sortie'] })).toBeUndefined();
        expect(await signale(lignes, { dotationsDuModule: ['dot'] })).toBeDefined();
    });
    it('la réévaluation du module (lot 14) ne compte pas · son crédit du 28 est porté par la fiche', async () => {
        const lignes = [{ ecritureId: 'reeval', numero: '28410000', intitule: 'Matériel', credit: 160, reevaluationDuModule: true }];
        expect(await signale(lignes)).toBeUndefined();
        expect(await signale([{ ...lignes[0], reevaluationDuModule: false }])).toBeDefined();
    });
    it("la dotation annulée et inscrite en négatif ne compte pas · son origine est retenue par l'annulation (ligne sage-l4)", async () => {
        const lignes = [{ ecritureId: 'origine', numero: '28450000', intitule: 'Matériel de transport', credit: 3_000_000, retenueParUneAnnulation: true }];
        expect(await signale(lignes)).toBeUndefined();
        expect(await signale([{ ...lignes[0], retenueParUneAnnulation: false }])).toBeDefined();
    });
    it('la lecture ne prend que les crédits, hors clôture et hors à-nouveau provisoire', async () => {
        const { svc, ligneFindMany } = service([]);
        await svc.analyser('t', 'ex');
        const appel = ligneFindMany.mock.calls.map((c) => c[0]).find((w) => w.where.compte?.numero?.startsWith === '28');
        expect(appel?.where).toMatchObject({
            credit: { gt: 0 },
            ecriture: {
                tenantId: 't',
                exerciceId: 'ex',
                estGenereeParCloture: false,
                estANouveauProvisoire: false,
                reevaluationBilan: null,
                annulationTraitementOrigine: null,
                annulationTraitementNegatif: null,
            },
        });
    });
    it('cite la fiche du compte 28 du référentiel du dossier', async () => {
        const l = [{ ecritureId: 'x', numero: '28000000', intitule: 'U', credit: 1 }];
        expect((await signale(l))?.consequence).toContain('SYCEBNL, Partie 2 ch. 3, fiche du compte 28');
        expect((await signale(l, { referentiel: client_1.Referentiel.SYSCOHADA }))?.consequence).toContain('AUDCIF, Titre VII, fiche du compte 28');
    });
});
describe('division 20 du SYCEBNL · comptes de dépréciation écrits bien par bien', () => {
    const D = 'DOTATION';
    const R = 'REPRISE';
    it('bien destiné à la vente · 2902, 6952 à la dotation, 7952 à la reprise (§ 2.2.2, § 2.2.3)', () => {
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20300000', D, '29020000', '69520000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20300000', R, '29020000', '79520000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20300000', D, '29010000', '69520000')).toMatch(/2902/);
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20300000', D, '29020000', '69510000')).toMatch(/6952/);
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20300000', R, '29020000', '79510000')).toMatch(/7952.*§ 2.2.3/);
    });
    it('usufruit · 2901, 6951, 7951 (§ 2.3.2)', () => {
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20110000', D, '29010000', '69510000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20110000', D, '29020000', '69510000')).toMatch(/2901/);
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '20110000', R, '29010000', '79520000')).toMatch(/7951/);
    });
    it('hors division 20 et au SYSCOHADA, sans objet', () => {
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYCEBNL, '23130000', D, '29310000', '69140000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusDepreciationDivision20)(client_1.Referentiel.SYSCOHADA, '20300000', D, '29010000', '69140000')).toBeNull();
    });
});
//# sourceMappingURL=amortissement-immo-hors-module.spec.js.map
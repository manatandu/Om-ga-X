"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const provisions_service_1 = require("./provisions.service");
const court_terme_et_conditions_1 = require("./court-terme-et-conditions");
describe('A16 · le court terme · 499 et 599, jamais 19', () => {
    it('un numéro, deux plans · le SYCEBNL n’ouvre pas de 4997', () => {
        expect((0, court_terme_et_conditions_1.comptesCourtTerme)(client_1.Referentiel.SYSCOHADA).map((c) => c.compte)).toEqual(['4991', '4997', '4998', '599']);
        expect((0, court_terme_et_conditions_1.comptesCourtTerme)(client_1.Referentiel.SYCEBNL).map((c) => c.compte)).toEqual(['4991', '4998', '599']);
        expect((0, court_terme_et_conditions_1.motifRefusCompteCourtTerme)(client_1.Referentiel.SYCEBNL, '49970000')).toMatch(/fiche du compte 19/);
        expect((0, court_terme_et_conditions_1.motifRefusCompteCourtTerme)(client_1.Referentiel.SYSCOHADA, '49970000')).toBeNull();
    });
    it('le 4991 se dote au 6591 et se reprend au 7591 (ch. 18 § 2.2.1)', () => {
        const c = (0, court_terme_et_conditions_1.comptesCourtTerme)(client_1.Referentiel.SYCEBNL).find((x) => x.compte === '4991');
        expect([c.dotation, c.reprise]).toEqual(['6591', '7591']);
    });
    it('un 19 sur une provision à court terme, un 499 sur une provision à long terme · refusés', () => {
        expect((0, court_terme_et_conditions_1.motifRefusCompteCourtTerme)(client_1.Referentiel.SYSCOHADA, '19100000')).toMatch(/4991/);
        expect((0, court_terme_et_conditions_1.motifRefusCompteLongTerme)('49910000')).toMatch(/à plus d'un an se porte au 19/);
        expect((0, court_terme_et_conditions_1.motifRefusCompteLongTerme)('59900000')).toMatch(/19/);
        expect((0, court_terme_et_conditions_1.motifRefusCompteLongTerme)('19100000')).toBeNull();
    });
    it('l’horizon et l’échéance ne se contredisent pas', () => {
        const fin = new Date('2026-12-31');
        expect((0, court_terme_et_conditions_1.motifRefusHorizon)(true, new Date('2027-06-30'), fin)).toBeNull();
        expect((0, court_terme_et_conditions_1.motifRefusHorizon)(true, new Date('2028-03-31'), fin)).toMatch(/plus d'un an/);
        expect((0, court_terme_et_conditions_1.motifRefusHorizon)(false, new Date('2027-06-30'), fin)).toMatch(/moins d’un an/);
        expect((0, court_terme_et_conditions_1.motifRefusHorizon)(false, new Date('2028-03-31'), fin)).toBeNull();
        expect((0, court_terme_et_conditions_1.motifRefusHorizon)(false, null, fin)).toBeNull();
    });
});
describe('A16 · les conditions propres', () => {
    it('restructuration, contrat déficitaire, déménagement · chacune citée', () => {
        expect(Object.keys(court_terme_et_conditions_1.CONDITIONS_PROPRES).sort()).toEqual(['CONTRAT_DEFICITAIRE', 'DEMENAGEMENT', 'RESTRUCTURATION']);
        expect(court_terme_et_conditions_1.CONDITIONS_PROPRES.RESTRUCTURATION.map((c) => c.source)).toEqual([
            'AUDCIF Titre VIII ch. 18 § 4.1.1',
            'AUDCIF Titre VIII ch. 18 § 4.1.1',
            'AUDCIF Titre VIII ch. 18 § 4.1.1',
            'AUDCIF Titre VIII ch. 18 § 4.1',
            'AUDCIF Titre VIII ch. 18 § 4.1.2',
        ]);
        expect(court_terme_et_conditions_1.CONDITIONS_PROPRES.CONTRAT_DEFICITAIRE.every((c) => c.source.endsWith('§ 4.3'))).toBe(true);
        expect(court_terme_et_conditions_1.CONDITIONS_PROPRES.DEMENAGEMENT.every((c) => c.source.endsWith('§ 4.10'))).toBe(true);
    });
    it('une nature sans cas particulier n’a aucune condition propre', () => {
        expect((0, court_terme_et_conditions_1.conditionsPropresManquantes)(client_1.NatureProvision.LITIGE, null)).toEqual([]);
    });
});
function service(referentiel, lignes = []) {
    const comptes = [
        { id: 'c4991', tenantId: 't1', numero: '49910000' },
        { id: 'c4997', tenantId: 't1', numero: '49970000' },
        { id: 'c1988', tenantId: 't1', numero: '19880000' },
        { id: 'c197', tenantId: 't1', numero: '19700000' },
    ];
    const prisma = {
        tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel, jeuEtatsFinanciersSycebnl: null, systemeComptableSyscohada: null }) },
        exercice: { findFirst: jest.fn().mockResolvedValue({ dateFin: new Date('2026-12-31') }) },
        compte: {
            findFirst: jest.fn(async ({ where }) => comptes.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null),
        },
        provisionRisqueCharge: {
            findFirst: jest.fn().mockResolvedValue(lignes[0] ?? null),
            findMany: jest.fn().mockResolvedValue(lignes),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'p1', ...a.data })),
            update: jest.fn().mockImplementation((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        },
    };
    return new provisions_service_1.ProvisionsService(prisma, { balance: jest.fn() });
}
const QUATRE = { obligationExiste: true, resulteEvenementPasse: true, sortieProbable: true, estimationFiable: true };
const LIGNE = (o) => ({
    objet: 'Risque',
    justificationObligation: 'Pièces au dossier',
    statut: client_1.StatutProvision.COMPTABILISEE,
    ...QUATRE,
    ...o,
});
describe('A16 · le service applique horizon et conditions propres', () => {
    it('SYCEBNL · un litige à moins d’un an se comptabilise au 4991, et la ligne le garde', async () => {
        const r = await service(client_1.Referentiel.SYCEBNL).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.LITIGE, compteId: 'c4991', courtTerme: true, echeanceAttendue: '2027-05-31' }), 'u1');
        expect([r.compteId, r.courtTerme]).toEqual(['c4991', true]);
    });
    it('SYCEBNL · le même litige au 4997 est refusé (aucun 4997 à son plan)', async () => {
        await expect(service(client_1.Referentiel.SYCEBNL).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.LITIGE, compteId: 'c4997', courtTerme: true }), 'u1')).rejects.toThrow(/4991, 4998, 599/);
    });
    it('une provision à long terme au 4991 est refusée, et un court terme au 19 aussi', async () => {
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.DIVERS_RISQUES_ET_CHARGES, compteId: 'c4991' }), 'u1')).rejects.toThrow(/au 19/);
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.DIVERS_RISQUES_ET_CHARGES, compteId: 'c1988', courtTerme: true }), 'u1')).rejects.toThrow(/moins d'un an se porte au 4991/);
    });
    it('une échéance dans l’année sur une ligne à long terme est refusée', async () => {
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.DIVERS_RISQUES_ET_CHARGES, compteId: 'c1988', echeanceAttendue: '2027-03-31', dotationsExercice: 300_000 }), 'u1')).rejects.toThrow(/Déclarez-la « à moins d’un an »/);
    });
    it('restructuration · les quatre conditions ne suffisent pas, chaque condition propre manquante est nommée', async () => {
        const svc = service(client_1.Referentiel.SYSCOHADA);
        await expect(svc.creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.RESTRUCTURATION, compteId: 'c197', conditionsPropres: { PLAN_DETAILLE: true } }), 'u1')).rejects.toThrow(/attente fondée.*§ 4\.1\.1/);
        const tout = Object.fromEntries(court_terme_et_conditions_1.CONDITIONS_PROPRES.RESTRUCTURATION.map((c) => [c.cle, true]));
        const r = await svc.creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.RESTRUCTURATION, compteId: 'c197', conditionsPropres: tout }), 'u1');
        expect(r.conditionsPropres).toEqual(tout);
    });
    it('déménagement · condition manquante, la ligne passe en passif éventuel avec son motif', async () => {
        const r = await service(client_1.Referentiel.SYCEBNL).creer('t1', 'ex', LIGNE({
            nature: client_1.NatureProvision.DEMENAGEMENT,
            statut: client_1.StatutProvision.PASSIF_EVENTUEL,
            motifNonComptabilisation: 'Bail non encore dénoncé à la clôture',
            conditionsPropres: { SORTIE_AU_PROFIT_DU_BAILLEUR: true },
        }), 'u1');
        expect(r.statut).toBe(client_1.StatutProvision.PASSIF_EVENTUEL);
    });
    it('une clé qui n’appartient pas à la nature est refusée, jamais ignorée', async () => {
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.CONTRAT_DEFICITAIRE, compteId: 'c1988', conditionsPropres: { PLAN_DETAILLE: true } }), 'u1')).rejects.toThrow(/PLAN_DETAILLE inconnue/);
    });
    it('le report à l’ouverture garde l’horizon et les conditions', async () => {
        const source = {
            ...LIGNE({ nature: client_1.NatureProvision.LITIGE, compteId: 'c4991', courtTerme: true, conditionsPropres: null }),
            id: 's1',
            exerciceId: 'n',
            echeanceAttendue: null,
            incertitudes: null,
            montantOuverture: 0,
            dotationsExercice: 500_000,
            montantsUtilises: 0,
            reprisesNonUtilisees: 0,
            effetActualisation: 0,
            remboursementTiers: null,
            motifNonComptabilisation: null,
        };
        const svc = service(client_1.Referentiel.SYCEBNL, [source]);
        const prisma = svc.prisma;
        prisma.provisionRisqueCharge.findMany.mockResolvedValueOnce([source]).mockResolvedValueOnce([]);
        await svc.reporterALOuverture('t1', 'n', 'n1', 'u1');
        expect(prisma.provisionRisqueCharge.create.mock.calls[0][0].data).toMatchObject({ courtTerme: true, montantOuverture: 500_000 });
    });
});
function serviceN1(ligne) {
    const prisma = {
        tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA, jeuEtatsFinanciersSycebnl: null, systemeComptableSyscohada: null }) },
        exercice: { findFirst: jest.fn().mockResolvedValue({ dateFin: new Date('2027-12-31') }) },
        compte: { findFirst: jest.fn().mockResolvedValue({ numero: '19100000' }) },
        provisionRisqueCharge: {
            findFirst: jest.fn().mockResolvedValue(ligne),
            update: jest.fn().mockImplementation((a) => Promise.resolve({ ...ligne, ...a.data })),
        },
    };
    return new provisions_service_1.ProvisionsService(prisma, { balance: jest.fn() });
}
const ligneN1 = (montant, echeance) => ({
    id: 'l1',
    exerciceId: 'n1',
    nature: client_1.NatureProvision.LITIGE,
    statut: client_1.StatutProvision.COMPTABILISEE,
    compteId: 'c191',
    courtTerme: false,
    conditionsPropres: null,
    ...QUATRE,
    echeanceAttendue: new Date(echeance),
    montantOuverture: montant,
    dotationsExercice: 0,
    montantsUtilises: 0,
    reprisesNonUtilisees: 0,
    effetActualisation: 0,
});
describe('A16 second tour · l’horizon d’une ligne existante', () => {
    it('191 de 500 000, échéance 2027-03-31 · la reprise de 500 000 en N+1 passe, sans avertissement (montant nul)', async () => {
        const r = await serviceN1(ligneN1(500_000, '2027-03-31')).modifier('t1', 'l1', { reprisesNonUtilisees: 500_000 });
        expect([Number(r.reprisesNonUtilisees), r.avertissements]).toEqual([500_000, []]);
    });
    it('191 de 800 000, échéance 2028-06-30 · modifiée en N+1, elle passe avec l’avertissement de reclassement', async () => {
        const r = await serviceN1(ligneN1(800_000, '2028-06-30')).modifier('t1', 'l1', { incertitudes: 'Audience renvoyée' });
        expect(r.avertissements).toEqual([expect.stringMatching(/à reclasser au 499 \(ou au 599\) à la clôture/)]);
    });
    it('changer l’échéance d’une ligne active reste refusé si elle contredit l’horizon', async () => {
        await expect(serviceN1(ligneN1(800_000, '2029-06-30')).modifier('t1', 'l1', { echeanceAttendue: '2028-03-31' })).rejects.toThrow(/Déclarez-la « à moins d’un an »/);
    });
    it('un passif éventuel n’est jamais jugé sur l’horizon', async () => {
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', {
            objet: 'Risque',
            nature: client_1.NatureProvision.LITIGE,
            justificationObligation: 'x',
            statut: client_1.StatutProvision.PASSIF_EVENTUEL,
            motifNonComptabilisation: 'Sortie non probable',
            echeanceAttendue: '2027-03-31',
            dotationsExercice: 100_000,
        }, 'u1')).resolves.toBeTruthy();
    });
    it('la restructuration annonce le compte exact de ses conditions · 4 + 5 = 9', async () => {
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', 'ex', LIGNE({ nature: client_1.NatureProvision.RESTRUCTURATION, compteId: 'c197' }), 'u1')).rejects.toThrow(/ses 9 conditions sont réunies .* et les 5 conditions propres .*Il en manque 5/);
    });
    it('§ 4.1.2 transcrit mot pour mot, pertes futures identifiables comprises', () => {
        const c = court_terme_et_conditions_1.CONDITIONS_PROPRES.RESTRUCTURATION.find((x) => x.cle === 'DEPENSES_DIRECTES');
        expect(c.libelle).toContain("De même, les pertes futures identifiables jusqu'à la date de restructuration ne peuvent pas faire l'objet de provision, sauf si elles concernent un contrat déficitaire.");
    });
});
//# sourceMappingURL=court-terme-et-conditions.spec.js.map
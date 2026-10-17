"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const echeancier_modele_1 = require("./echeancier-modele");
const tiers_service_1 = require("./tiers.service");
const jour = (d) => d.toISOString().slice(0, 10);
const modele = { delaiJours: 30, echeance: client_1.ConditionEcheance.NET, modeReglementId: 'mVir' };
const ech = (ordre, type, valeur, delaiJours, echeance = client_1.ConditionEcheance.NET, mode = null) => ({
    ordre,
    type,
    valeur,
    delaiJours,
    echeance,
    modeReglementId: mode,
});
describe('la date d’échéance', () => {
    it('net · la date de la facture plus le délai', () => {
        expect(jour((0, echeancier_modele_1.dateEcheanceDuModele)(new Date('2026-12-10'), 30, client_1.ConditionEcheance.NET))).toBe('2027-01-09');
    });
    it('fin de mois · la fin du mois de la facture plus le délai, février compris', () => {
        expect(jour((0, echeancier_modele_1.dateEcheanceDuModele)(new Date('2026-01-31'), 0, client_1.ConditionEcheance.FIN_DE_MOIS))).toBe('2026-01-31');
        expect(jour((0, echeancier_modele_1.dateEcheanceDuModele)(new Date('2026-01-15'), 28, client_1.ConditionEcheance.FIN_DE_MOIS))).toBe('2026-02-28');
    });
});
describe('l’échéancier', () => {
    it('sans fractionnement · une échéance, le montant entier, au mode du modèle', () => {
        expect((0, echeancier_modele_1.echeancierDuModele)(modele, [], new Date('2026-03-10'), 1_160_000, 'mHab')).toEqual([
            { ordre: 1, type: null, montant: 1_160_000, dateEcheance: new Date('2026-04-09'), modeReglementId: 'mVir' },
        ]);
    });
    it('le mode habituel du tiers vaut quand ni le modèle ni l’échéance n’en disent', () => {
        const [e] = (0, echeancier_modele_1.echeancierDuModele)({ ...modele, modeReglementId: null }, [], new Date('2026-03-10'), 100, 'mHab');
        expect(e.modeReglementId).toBe('mHab');
    });
    it('trois tiers d’un million · la somme rend le montant au centime, la dernière prend le reste', () => {
        const r = (0, echeancier_modele_1.echeancierDuModele)(modele, [ech(1, client_1.TypeEcheance.POURCENTAGE, 33.33, 0), ech(2, client_1.TypeEcheance.POURCENTAGE, 33.33, 30), ech(3, client_1.TypeEcheance.EQUILIBRE, null, 60)], new Date('2026-03-10'), 1_000_000.01);
        expect(r.map((e) => e.montant)).toEqual([333_300, 333_300, 333_400.01]);
        expect(Math.round(r.reduce((s, e) => s + e.montant, 0) * 100)).toBe(100_000_001);
    });
    it('l’Équilibre se calcule en dernier quel que soit son rang, et un montant fixe est borné au reste', () => {
        const r = (0, echeancier_modele_1.echeancierDuModele)(modele, [ech(1, client_1.TypeEcheance.EQUILIBRE, null, 0), ech(2, client_1.TypeEcheance.MONTANT, 900, 30, client_1.ConditionEcheance.FIN_DE_MOIS, 'mChq')], new Date('2026-03-10'), 500);
        expect(r).toEqual([
            { ordre: 1, type: client_1.TypeEcheance.EQUILIBRE, montant: 0, dateEcheance: new Date('2026-03-10'), modeReglementId: null },
            { ordre: 2, type: client_1.TypeEcheance.MONTANT, montant: 500, dateEcheance: new Date('2026-04-30'), modeReglementId: 'mChq' },
        ]);
    });
});
describe('la ligne qui reçoit l’échéancier', () => {
    it('la facture · fournisseur au crédit, client au débit, hors trésorerie', () => {
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '40110001', sens: 'CREDIT', typeJournal: client_1.TypeJournal.ACHATS })).toBeNull();
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '41110001', sens: 'DEBIT', typeJournal: client_1.TypeJournal.VENTES })).toBeNull();
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '41110001', sens: 'DEBIT', typeJournal: null })).toBeNull();
    });
    it.each(['40810000', '40910000', '41620000', '41810000', '41910000'])('le %s ne reçoit pas d’échéance tirée d’un modèle', (numero) => {
        const sens = numero.startsWith('40') ? 'CREDIT' : 'DEBIT';
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero, sens, typeJournal: client_1.TypeJournal.GENERAL })).toContain('ne reçoit pas');
    });
    it('un avoir, un règlement ou un journal de trésorerie non plus', () => {
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '40110001', sens: 'DEBIT', typeJournal: client_1.TypeJournal.ACHATS })).toContain('sens inverse');
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '41110001', sens: 'DEBIT', typeJournal: client_1.TypeJournal.TRESORERIE })).toContain('trésorerie');
        expect((0, echeancier_modele_1.motifSansEcheancierDuModele)({ numero: '60110000', sens: 'DEBIT', typeJournal: client_1.TypeJournal.ACHATS })).toContain('fournisseur (40) ou de client (41)');
    });
});
describe('TiersService.echeancierDeLigne', () => {
    function service(opts) {
        const prisma = {
            compte: { findFirst: jest.fn(async ({ where }) => (where.tenantId === 't' ? (opts.compte ?? null) : null)) },
            tiersCompte: { findFirst: jest.fn(async () => (opts.tiers === undefined ? null : { tiers: opts.tiers })) },
            modeReglement: { findMany: jest.fn(async () => opts.modes ?? []) },
        };
        return { s: new tiers_service_1.TiersService(prisma), prisma };
    }
    const dto = { date: '2026-12-10', montant: 1_160_000, sens: 'CREDIT', typeJournal: client_1.TypeJournal.ACHATS };
    const tiers = (extra = {}) => ({
        id: 'tr',
        code: 'FRS1',
        nom: 'Fournisseur',
        estActif: true,
        validationAutomatiqueEcheances: false,
        modeReglement: { id: 'mEsp', code: 'ESP', estActif: true },
        modeleReglement: {
            id: 'mod',
            intitule: '50/50',
            estActif: true,
            delaiJours: 30,
            echeance: client_1.ConditionEcheance.NET,
            modeReglementId: null,
            echeances: [ech(1, client_1.TypeEcheance.POURCENTAGE, 50, 30, client_1.ConditionEcheance.NET, 'mVir'), ech(2, client_1.TypeEcheance.EQUILIBRE, null, 60)],
        },
        ...extra,
    });
    it('le compte d’un autre dossier est introuvable', async () => {
        const { s } = service({ compte: { id: 'c', numero: '40110001' } });
        await expect(s.echeancierDeLigne('autre', 'c', dto)).rejects.toThrow('Compte introuvable pour ce dossier.');
    });
    it('deux échéances · chacune son mode, le mode habituel pour celle qui n’en dit pas', async () => {
        const { s } = service({
            compte: { id: 'c', numero: '40110001' },
            tiers: tiers(),
            modes: [{ id: 'mVir', code: 'VIR', estActif: true }],
        });
        const r = await s.echeancierDeLigne('t', 'c', dto);
        expect(r.motif).toBeNull();
        expect(r.echeances).toEqual([
            { ordre: 1, montant: 580_000, dateEcheance: '2027-01-09', modeReglementId: 'mVir', modeCode: 'VIR' },
            { ordre: 2, montant: 580_000, dateEcheance: '2027-02-08', modeReglementId: 'mEsp', modeCode: 'ESP' },
        ]);
        expect(r.modele).toEqual({ id: 'mod', intitule: '50/50' });
    });
    it('un mode d’échéance mis en sommeil n’est pas posé d’office', async () => {
        const { s } = service({
            compte: { id: 'c', numero: '40110001' },
            tiers: tiers({ modeReglement: null }),
            modes: [{ id: 'mVir', code: 'VIR', estActif: false }],
        });
        const r = await s.echeancierDeLigne('t', 'c', dto);
        expect(r.echeances[0]).toMatchObject({ modeReglementId: null, modeCode: null });
    });
    it('un tiers sans modèle · aucune échéance, le motif et le mode habituel', async () => {
        const { s } = service({ compte: { id: 'c', numero: '40110001' }, tiers: tiers({ modeleReglement: null }) });
        const r = await s.echeancierDeLigne('t', 'c', dto);
        expect(r.echeances).toEqual([]);
        expect(r.motif).toContain("n'a pas de modèle de règlement");
        expect(r.modeHabituel).toEqual({ id: 'mEsp', code: 'ESP' });
        expect(r.applicable).toBe(true);
    });
    it('une avance au 409 · aucune échéance, le motif dit pourquoi', async () => {
        const { s } = service({ compte: { id: 'c', numero: '40910001' }, tiers: tiers() });
        const r = await s.echeancierDeLigne('t', 'c', { ...dto, sens: 'DEBIT' });
        expect(r.echeances).toEqual([]);
        expect(r.motif).toContain('409');
        expect(r.applicable).toBe(false);
    });
});
//# sourceMappingURL=echeancier-modele.spec.js.map
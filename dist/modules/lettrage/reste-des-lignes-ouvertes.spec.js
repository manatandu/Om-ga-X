"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ouverte_a_la_cloture_1 = require("./ouverte-a-la-cloture");
const reste_des_lignes_ouvertes_1 = require("./reste-des-lignes-ouvertes");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const relances_service_1 = require("../relances/relances.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const ligne = (id, debit, credit, date, lettrageId, echeance = null, devise = null) => ({
    id,
    debit,
    credit,
    lettrageId,
    dateEcheance: echeance ? d(echeance) : null,
    deviseId: devise?.deviseId ?? null,
    montantDevise: devise?.montantDevise ?? null,
    ecriture: { date: d(date) },
});
describe('poids des lignes ouvertes · la règle', () => {
    it('une créance réglée en partie pèse son reste, le règlement plus rien', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'),
            ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
        ]);
        expect(poids.get('f')).toBe(2_480_000);
        expect(poids.get('r')).toBe(0);
    });
    it('une dette réglée en partie garde son sens créditeur', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f', 0, 2_320_000, '2026-09-05', 'g', '2026-10-05'),
            ligne('r', 500_000, 0, '2026-09-20', 'g'),
        ]);
        expect(poids.get('f')).toBe(-1_820_000);
        expect(poids.get('r')).toBe(0);
    });
    it('plusieurs factures · le règlement éteint la plus ancienne d’abord', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('b', 2_000_000, 0, '2026-03-01', 'g', '2026-04-01'),
            ligne('a', 1_000_000, 0, '2026-01-10', 'g', '2026-02-10'),
            ligne('r', 0, 1_500_000, '2026-05-01', 'g'),
        ]);
        expect(poids.get('a')).toBe(0);
        expect(poids.get('b')).toBe(1_500_000);
        expect(poids.get('r')).toBe(0);
    });
    it('l’ordre est celui de la LOI · la facture échue avant la plus ancienne non échue (art. 154 ; second tour, M1)', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f1', 1_000_000, 0, '2026-01-15', 'g', '2026-12-15'),
            ligne('f2', 2_000_000, 0, '2026-03-01', 'g', '2026-03-31'),
            ligne('r', 0, 1_000_000, '2026-04-10', 'g'),
        ]);
        expect(poids.get('f1')).toBe(1_000_000);
        expect(poids.get('f2')).toBe(1_000_000);
        expect(poids.get('r')).toBe(0);
    });
    it('la part DÉCLARÉE d’un paiement prime l’ordre légal (art. 151 et 153 · le client C2 de la simulation)', () => {
        const lignes = [
            ligne('fp001', 1_160_000, 0, '2026-05-05', 'g'),
            ligne('fv004', 672_800, 0, '2026-05-06', 'g'),
            ligne('paie', 0, 1_160_000, '2026-05-20', 'g'),
        ];
        expect((0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)(lignes).poids.get('fv004')).toBe(672_800);
        const declarations = new Map([['paie', [{ ligneFactureId: 'fv004', montant: 672_800 }, { ligneFactureId: 'fp001', montant: 487_200 }]]]);
        const { poids, nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)(lignes, new Map(), new Set(), declarations);
        expect(nonRepartis).toEqual([]);
        expect(poids.get('fp001')).toBe(672_800);
        expect(poids.get('fv004')).toBe(0);
        expect(poids.get('paie')).toBe(0);
    });
    it('une part déclarée au-delà de ce que la facture doit ne se répartit pas, et le groupe est nommé', () => {
        const { nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('f', 500_000, 0, '2026-05-05', 'g'), ligne('p', 0, 300_000, '2026-05-20', 'g')], new Map(), new Set(), new Map([['p', [{ ligneFactureId: 'f', montant: 600_000 }]]]));
        expect(nonRepartis).toEqual(['g']);
    });
    it('chaque groupe nommé porte son motif (relecture « échecs silencieux », mineur 7)', () => {
        const declaree = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('f', 500_000, 0, '2026-05-05', 'g'), ligne('p', 0, 300_000, '2026-05-20', 'g')], new Map(), new Set(), new Map([['p', [{ ligneFactureId: 'f', montant: 600_000 }]]]));
        expect([...declaree.motifs]).toEqual([['g', 'IMPUTATION_DECLAREE_NON_LUE']]);
        const negatif = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('f', 1_000_000, 0, '2026-01-05', 'g'), ligne('rneg', 0, -400_000, '2026-02-01', 'g')]);
        expect([...negatif.motifs]).toEqual([['g', 'NEGATIF_SANS_ORIGINE']]);
        const soldee = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f', 2_800_000, 0, '2026-03-01', 'g', '2026-03-31', { deviseId: 'usd', montantDevise: 1_000 }),
            ligne('r', 0, 2_900_000, '2026-06-10', 'g', null, { deviseId: 'usd', montantDevise: 1_000 }),
        ]);
        expect([...soldee.motifs]).toEqual([['g', 'DEVISE_SOLDEE_ECART_NON_PASSE']]);
        const partielle = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f', 2_800_000, 0, '2026-03-01', 'g', '2026-03-31', { deviseId: 'usd', montantDevise: 1_000 }),
            ligne('r', 0, 1_800_000, '2026-06-10', 'g', null, { deviseId: 'usd', montantDevise: 600 }),
        ]);
        expect([...partielle.motifs]).toEqual([['g', 'DEVISE_REGLEE_EN_PARTIE']]);
        expect((0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('f', 1_000_000, 0, '2026-01-05', 'g'), ligne('r', 0, 400_000, '2026-02-01', 'g')]).motifs.size).toBe(0);
    });
    it('un négatif qui a deux origines possibles ne devine pas la sienne (second tour, m1)', () => {
        const { nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('fjan', 1_000_000, 0, '2026-01-05', 'g'),
            ligne('fmar', 1_000_000, 0, '2026-03-05', 'g'),
            ligne('fneg', -1_000_000, 0, '2026-03-20', 'g'),
            ligne('r', 0, 500_000, '2026-04-01', 'g'),
        ]);
        expect(nonRepartis).toEqual(['g']);
    });
    it('un groupe RECONDUIT se lit à la pièce d’origine de ses à-nouveaux, jamais à leur identifiant (relecture TypeScript, bloquant 1)', () => {
        const lignes = [
            ligne('an-0001', 2_000_000, 0, '2027-01-01', 'g', '2029-06-30'),
            ligne('an-0002', 1_000_000, 0, '2027-01-01', 'g', '2026-02-10'),
            ligne('reg', 0, 1_500_000, '2027-02-01', 'g'),
        ];
        const origines = new Map([
            ['an-0001', { date: d('2026-03-01'), id: 'f2-2026' }],
            ['an-0002', { date: d('2026-01-10'), id: 'f1-2026' }],
        ]);
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)(lignes, origines);
        expect(poids.get('an-0002')).toBe(0);
        expect(poids.get('an-0001')).toBe(1_500_000);
    });
    it('une facture annulée par son négatif s’éteint avec lui, jamais sur la plus ancienne (relecture, mineur 4)', () => {
        const { poids, nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f0', 1_000_000, 0, '2026-01-05', 'g', '2026-02-05'),
            ligne('f', 2_000_000, 0, '2026-03-01', 'g', '2029-03-01'),
            ligne('fneg', -2_000_000, 0, '2026-03-20', 'g', '2029-03-01'),
            ligne('r', 0, 300_000, '2026-04-01', 'g'),
        ]);
        expect(nonRepartis).toEqual([]);
        expect(poids.get('f')).toBe(0);
        expect(poids.get('fneg')).toBe(0);
        expect(poids.get('f0')).toBe(700_000);
        expect(poids.get('r')).toBe(0);
    });
    it('un négatif sans son origine garde la lecture ligne à ligne, et le groupe est nommé', () => {
        const { poids, nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f', 1_000_000, 0, '2026-01-05', 'g', '2026-02-05'),
            ligne('rneg', 0, -400_000, '2026-02-01', 'g'),
        ]);
        expect(nonRepartis).toEqual(['g']);
        expect(poids.size).toBe(0);
    });
    it('un reste négatif d’une facture en devise garde la lecture ligne à ligne (relecture, mineur 3)', () => {
        const usd = (montantDevise) => ({ deviseId: 'usd', montantDevise });
        const { poids, nonRepartis } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f1', 100_000, 0, '2026-01-05', 'g', '2026-02-05', usd(100)),
            ligne('f2', 100_000, 0, '2026-02-05', 'g', '2026-03-05', usd(100)),
            ligne('f3', 1_000_000, 0, '2026-03-05', 'g', '2029-03-05'),
            ligne('r', 0, 400_000, '2026-04-01', 'g', null, usd(150)),
        ]);
        expect(nonRepartis).toEqual(['g']);
        expect(poids.size).toBe(0);
    });
    it('le reste négatif d’une facture en devise payée à moitié est nommé « réglée en partie »', () => {
        const usd = (montantDevise) => ({ deviseId: 'usd', montantDevise });
        const { motifs } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([
            ligne('f1', 100_000, 0, '2026-01-05', 'g', '2026-02-05', usd(100)),
            ligne('f2', 100_000, 0, '2026-02-05', 'g', '2026-03-05', usd(100)),
            ligne('f3', 1_000_000, 0, '2026-03-05', 'g', '2029-03-05'),
            ligne('r', 0, 400_000, '2026-04-01', 'g', null, usd(150)),
        ]);
        expect(motifs.get('g')).toBe('DEVISE_REGLEE_EN_PARTIE');
    });
    it('une ligne hors groupe, ou seule de son groupe, se lit à son montant · elle n’est pas dans la table', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('x', 700, 0, '2026-01-01', null), ligne('y', 0, 300, '2026-01-02', 'seul')]);
        expect(poids.size).toBe(0);
    });
    it('un groupe dont les lignes reçues se compensent ne pèse rien', () => {
        const { poids } = (0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)([ligne('f', 900, 0, '2026-01-01', 'g'), ligne('r', 0, 900, '2026-02-01', 'g')]);
        expect(poids.get('f')).toBe(0);
        expect(poids.get('r')).toBe(0);
    });
});
function lecteur(base, exercices = []) {
    const vue = (l) => ({
        id: l.id,
        compteId: l.compteId ?? 'c411',
        debit: l.debit,
        credit: l.credit,
        libelle: l.libelle ?? null,
        dateEcheance: l.dateEcheance,
        lettrageId: l.lettrageId,
        compte: { numero: '41110001' },
        ecriture: {
            date: l.ecriture.date,
            libelle: 'Pièce sans libellé de ligne',
            estANouveauProvisoire: false,
            estGenereeParCloture: l.aNouveau === true,
            estSoldeDesComptesDeGestion: false,
        },
    });
    const reporteeAuDetail = (l, ou) => ou.some((o) => 'lettre' in o
        ? (l.lettre ?? null) === o.lettre
        : l.lettrageId !== null &&
            base.some((x) => x.lettrageId === l.lettrageId && (x.exerciceId ?? null) !== o.lettrage.lignes.some.ecriture.exerciceId.not));
    return {
        exercice: {
            findFirst: jest.fn(async (a) => exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null),
        },
        ligneEcriture: {
            findMany: jest.fn(async (a) => {
                if (a.cursor)
                    return [];
                const w = a.where;
                return base
                    .filter((l) => (!w.id || w.id.in.includes(l.id)) &&
                    (!w.ecriture?.OR || l.aNouveau === true) &&
                    (!w.ecriture?.exerciceId || l.exerciceId === w.ecriture.exerciceId) &&
                    (!w.compteId || w.compteId.in.includes(l.compteId ?? 'c411')) &&
                    (!w.OR || reporteeAuDetail(l, w.OR)))
                    .map(vue);
            }),
            groupBy: jest.fn(async (a) => {
                const ids = a.where.lettrageId?.in ?? [];
                return ids.map((id) => ({
                    lettrageId: id,
                    _count: {
                        _all: base.filter((l) => l.lettrageId === id &&
                            (!a.where.ecriture?.date || l.ecriture.date <= a.where.ecriture.date.lte) &&
                            (!a.where.ecriture?.statut || (l.statut ?? 'VALIDEE') === a.where.ecriture.statut)).length,
                    },
                }));
            }),
        },
        lettrage: { findMany: jest.fn(async () => []) },
        imputationPaiement: { findMany: jest.fn(async () => []) },
    };
}
describe('poids des lignes ouvertes · un groupe se répartit s’il est lu en entier', () => {
    it('un groupe à cheval sur l’exercice précédent garde la lecture ligne à ligne (relecture, majeur 1)', async () => {
        const base = [
            ligne('f0', 0, 1_000_000, '2025-12-10', 'g', '2026-01-10'),
            ligne('f2', 0, 500_000, '2026-01-15', 'g', '2029-03-15'),
            ligne('r', 800_000, 0, '2026-02-10', 'g'),
        ];
        const lues = base.filter((l) => l.ecriture.date >= d('2026-01-01'));
        const p = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(lecteur(base), 't', lues, { dateMax: d('2026-12-31') }, 'essai');
        expect(p.poids.size).toBe(0);
        expect(p.nonRepartis).toEqual([]);
    });
    it('un règlement postérieur à la date d’arrêté ne retire pas le groupe · il n’est pas dans la borne', async () => {
        const base = [
            ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'),
            ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
            ligne('r2', 0, 2_480_000, '2027-02-01', 'g'),
        ];
        const lues = base.filter((l) => l.ecriture.date <= d('2026-12-31'));
        const p = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(lecteur(base), 't', lues, { dateMax: d('2026-12-31') }, 'essai');
        expect(p.poids.get('f')).toBe(2_480_000);
    });
});
describe('poids des lignes ouvertes · les à-nouveaux d’un groupe posé à la main (paquet 1, B7)', () => {
    const exercices = [
        { id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
        { id: 'e2027', dateDebut: d('2027-01-01'), dateFin: d('2027-12-31') },
    ];
    const de2026 = (id, debit, date, echeance, libelle) => ({
        ...ligne(id, debit, 0, date, null, echeance),
        exerciceId: 'e2026',
        libelle,
    });
    const report = (id, debit, echeance, libelle, lettrageId = 'g') => ({
        ...ligne(id, debit, 0, '2027-01-01', lettrageId, echeance),
        exerciceId: 'e2027',
        libelle: `RAN détail 41110001 · ${libelle}`,
        aNouveau: true,
    });
    const reglement = (id, credit, date, lettrageId = 'g') => ({
        ...ligne(id, 0, credit, date, lettrageId),
        exerciceId: 'e2027',
        libelle: 'Règlement',
    });
    const lire = (base) => (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(lecteur(base, exercices), 't', base.filter((l) => l.exerciceId === 'e2027'), { dateMax: d('2027-12-31') }, 'essai');
    afterEach(() => jest.restoreAllMocks());
    it('la facture la plus ancienne est éteinte la première, jamais au prorata', async () => {
        const base = [
            de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
            de2026('f2', 1_000_000, '2026-09-01', '2026-09-30', 'Facture FV-B7-2'),
            report('an-a', 1_000_000, '2026-09-30', 'Facture FV-B7-2'),
            report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
            reglement('reg', 1_000_000, '2027-02-15'),
        ];
        const p = await lire(base);
        expect(p.poids.get('an-b')).toBe(0);
        expect(p.poids.get('an-a')).toBe(1_000_000);
        expect(p.poids.get('reg')).toBe(0);
        expect(p.nonRepartis).toEqual([]);
    });
    it('même montant, même libellé · l’échéance que le report recopie distingue les deux factures', async () => {
        const base = [
            de2026('fev', 600_000, '2026-02-01', '2026-02-28', 'Vente marchandises'),
            de2026('aou', 600_000, '2026-08-01', '2026-08-31', 'Vente marchandises'),
            report('an-a', 600_000, '2026-08-31', 'Vente marchandises'),
            report('an-b', 600_000, '2026-02-28', 'Vente marchandises'),
            reglement('reg', 600_000, '2027-02-20'),
        ];
        const p = await lire(base);
        expect(p.poids.get('an-b')).toBe(0);
        expect(p.poids.get('an-a')).toBe(600_000);
    });
    it('tout ou rien · une origine non retrouvée laisse le groupe à la date du report, et il est consigné', async () => {
        const warn = jest.spyOn(common_1.Logger.prototype, 'warn').mockImplementation(() => undefined);
        const base = [
            de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
            report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
            report('an-c', 1_000_000, '2026-06-30', 'Facture inconnue'),
            reglement('reg', 1_000_000, '2027-02-15'),
        ];
        const p = await lire(base);
        expect(p.poids.get('an-b')).toBe(500_000);
        expect(p.poids.get('an-c')).toBe(500_000);
        expect(warn.mock.calls.some(([m]) => String(m).includes('pièce d\'origine') && String(m).includes('g'))).toBe(true);
        expect([...p.motifs]).toEqual([['g', 'A_NOUVEAU_SANS_ORIGINE']]);
    });
    it('une seule facture dans le groupe · rien à départager, rien de consigné', async () => {
        const warn = jest.spyOn(common_1.Logger.prototype, 'warn').mockImplementation(() => undefined);
        const base = [report('an-c', 1_000_000, '2026-06-30', 'Facture inconnue'), reglement('reg', 400_000, '2027-02-15')];
        const p = await lire(base);
        expect(p.poids.get('an-c')).toBe(600_000);
        expect(warn).not.toHaveBeenCalled();
        expect(p.motifs.size).toBe(0);
    });
    it('premier exercice tenu · la ligne du bilan importé est l’origine, la plus ancienne, et s’éteint d’abord', async () => {
        const warn = jest.spyOn(common_1.Logger.prototype, 'warn').mockImplementation(() => undefined);
        const base = [
            { ...ligne('imp', 1_000_000, 0, '2026-01-01', null, '2025-11-30'), exerciceId: 'e2026', libelle: null, aNouveau: true },
            de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-1'),
            report('an-imp', 1_000_000, '2025-11-30', 'Pièce sans libellé de ligne'),
            report('an-f1', 1_000_000, '2026-03-31', 'Facture FV-1'),
            reglement('reg', 1_000_000, '2027-02-15'),
        ];
        const p = await lire(base);
        expect(p.poids.get('an-imp')).toBe(0);
        expect(p.poids.get('an-f1')).toBe(1_000_000);
        expect(p.motifs.size).toBe(0);
        expect(warn).not.toHaveBeenCalled();
    });
    it('dans le premier exercice lui-même, la ligne importée d’un groupe n’en fait pas un groupe sans origine', async () => {
        const warn = jest.spyOn(common_1.Logger.prototype, 'warn').mockImplementation(() => undefined);
        const base = [
            { ...ligne('imp', 600_000, 0, '2026-01-01', 'g', null), exerciceId: 'e2026', libelle: null, aNouveau: true },
            { ...ligne('f', 400_000, 0, '2026-04-01', 'g', '2026-04-30'), exerciceId: 'e2026', libelle: 'Facture' },
            { ...ligne('reg', 0, 700_000, '2026-05-15', 'g'), exerciceId: 'e2026', libelle: 'Règlement' },
        ];
        const p = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(lecteur(base, [exercices[0]]), 't', base, { dateMax: d('2026-12-31') }, 'essai');
        expect(p.poids.get('imp')).toBe(0);
        expect(p.poids.get('f')).toBe(300_000);
        expect(p.motifs.size).toBe(0);
        expect(warn).not.toHaveBeenCalled();
    });
    it('tout ou rien sur TOUTES les lignes d’à-nouveau, celles que la reconduction a datées comprises (mineur 1)', async () => {
        const vueGroupe = (l, exerciceId) => ({
            id: l.id,
            compteId: 'c411',
            debit: l.debit,
            credit: l.credit,
            dateEcheance: l.dateEcheance,
            deviseId: null,
            montantDevise: null,
            libelle: l.libelle ?? null,
            ecriture: { exerciceId, date: l.ecriture.date, libelle: l.libelle ?? 'Pièce' },
        });
        const f = de2026('f', 1_000_000, '2026-03-01', '2026-03-31', 'Facture F');
        const pReg = { ...ligne('p', 0, 400_000, '2026-06-10', null), exerciceId: 'e2026', libelle: 'Règlement P' };
        const anF = report('an-f', 1_000_000, '2026-03-31', 'Facture F');
        const anP = { ...ligne('an-p', 0, 400_000, '2027-01-01', 'g'), exerciceId: 'e2027', libelle: 'RAN détail 41110001 · Règlement P', aNouveau: true };
        const anI = { ...ligne('an-i', 1_000_000, 0, '2027-01-01', 'g', null), exerciceId: 'e2027', libelle: 'RAN détail 41110001 · Inconnue', aNouveau: true };
        const reg2 = reglement('reg2', 600_000, '2027-02-15');
        const base = [f, pReg, anF, anP, anI, reg2];
        const l = lecteur(base, exercices);
        l.lettrage.findMany = jest.fn(async (a) => {
            if (a.where.lettrageReconduitId) {
                return (a.where.id?.in ?? []).includes('g')
                    ? [{ id: 'g', lettrageReconduitId: 'g26', compte: { numero: '41110001' }, lignes: [anF, anP, anI, reg2].map((x) => vueGroupe(x, 'e2027')) }]
                    : [];
            }
            return (a.where.id?.in ?? []).includes('g26')
                ? [{ id: 'g26', lettrageReconduitId: null, compte: { numero: '41110001' }, lignes: [f, pReg].map((x) => vueGroupe(x, 'e2026')) }]
                : [];
        });
        const p = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(l, 't', base.filter((x) => x.exerciceId === 'e2027'), { dateMax: d('2027-12-31') }, 'essai');
        expect(p.poids.get('an-f')).toBe(500_000);
        expect(p.poids.get('an-i')).toBe(500_000);
        expect([...p.motifs]).toEqual([['g', 'A_NOUVEAU_SANS_ORIGINE']]);
    });
    it('une lecture qui rend plus que demandé n’invente aucun report', async () => {
        const base = [
            de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
            de2026('f2', 1_000_000, '2026-09-01', '2026-09-30', 'Facture FV-B7-2'),
            report('an-a', 1_000_000, '2026-09-30', 'Facture FV-B7-2'),
            report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
            reglement('reg', 1_000_000, '2027-02-15'),
        ];
        const l = lecteur(base, exercices);
        const touteLaBase = base.map((x) => ({
            ...x,
            compteId: 'c411',
            compte: { numero: '41110001' },
            ecriture: { ...x.ecriture, estGenereeParCloture: x.aNouveau === true },
        }));
        const parId = l.ligneEcriture.findMany;
        l.ligneEcriture.findMany = jest.fn(async (a) => (a.where.id ? touteLaBase : parId(a)));
        const p = await (0, reste_des_lignes_ouvertes_1.poidsDesLignesLues)(l, 't', base.filter((x) => x.exerciceId === 'e2027'), { dateMax: d('2027-12-31') }, 'essai');
        expect(p.poids.get('an-b')).toBe(0);
        expect(p.poids.get('an-a')).toBe(1_000_000);
    });
});
describe('poids des lignes ouvertes · la balance âgée', () => {
    it('le reste d’un report réglé en partie reste antérieur à l’exercice', async () => {
        const compte = { id: 'c411', numero: '41110001', intitule: 'U1' };
        const lignes = [
            {
                ...ligne('ran', 2_000_000, 0, '2026-01-01', 'g'),
                compte,
                ecriture: { date: d('2026-01-01'), estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
            },
            {
                ...ligne('reg', 0, 800_000, '2026-03-15', 'g'),
                compte,
                ecriture: { date: d('2026-03-15'), estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
            },
        ];
        const prisma = {
            ...lecteur(lignes),
            exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
            ligneEcriture: { ...lecteur(lignes).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
            tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const r = await new ecriture_service_1.EcritureService(prisma, {}, {}, {}).balanceAgee('t', {
            exerciceId: 'ex',
            dateReference: '2026-05-31',
            type: 'CLIENTS_41',
        });
        expect(r.debiteurs).toHaveLength(1);
        expect(r.debiteurs[0].solde).toBe(1_200_000);
        expect(r.debiteurs[0].montants[0]).toBe(1_200_000);
        expect(r.debiteurs[0].montants.slice(1).every((m) => m === 0)).toBe(true);
    });
});
function baseQuiHonore(lignes) {
    const tenantId = 't';
    const exerciceId = 'ex';
    const dateDe = (b, x) => Object.entries(b).every(([op, v]) => {
        if (op === 'lte')
            return x <= v;
        if (op === 'lt')
            return x < v;
        if (op === 'gt')
            return x > v;
        if (op === 'gte')
            return x >= v;
        throw new Error(`doublure : borne de date ${op} non honorée`);
    });
    const ecritureSatisfait = (w, l) => Object.entries(w).every(([cle, v]) => {
        switch (cle) {
            case 'tenantId':
                return v === tenantId;
            case 'exerciceId':
                return v === exerciceId;
            case 'statut':
                return v === l.statut;
            case 'date':
                return dateDe(v, l.ecriture.date);
            case 'estANouveauProvisoire':
            case 'estGenereeParCloture':
            case 'estSoldeDesComptesDeGestion':
                return v === false;
            case 'OR':
                return v.some((x) => ecritureSatisfait(x, l));
            default:
                throw new Error(`doublure : clé d'écriture ${cle} non honorée`);
        }
    });
    const satisfait = (w, l) => Object.entries(w).every(([cle, v]) => {
        switch (cle) {
            case 'AND':
                return v.every((x) => satisfait(x, l));
            case 'OR':
                return v.some((x) => satisfait(x, l));
            case 'ecriture':
                return ecritureSatisfait(v, l);
            case 'lettre':
                if (v !== null)
                    throw new Error('doublure : seule `lettre: null` est honorée');
                return (l.lettre ?? null) === null;
            case 'lettrageId': {
                const f = v;
                if (f.in)
                    return l.lettrageId !== null && f.in.includes(l.lettrageId);
                if ('not' in f && f.not === null)
                    return l.lettrageId !== null;
                throw new Error('doublure : filtre de lettrage non honoré');
            }
            case 'lettrage': {
                const apres = v.lignes.some.ecriture.date;
                return lignes.some((x) => x.lettrageId !== null && x.lettrageId === l.lettrageId && dateDe(apres, x.ecriture.date));
            }
            case 'id':
                return v.in.includes(l.id);
            case 'compteId':
                return v.in.includes(l.compteId);
            default:
                throw new Error(`doublure : clé ${cle} non honorée`);
        }
    });
    const triees = [...lignes].sort((a, b) => a.id.localeCompare(b.id));
    const vue = (l) => ({
        ...l,
        ecriture: { ...l.ecriture, estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
    });
    return {
        ligneEcriture: {
            findMany: jest.fn(async (a) => {
                const retenues = triees.filter((l) => satisfait(a.where, l));
                const debut = a.cursor ? retenues.findIndex((l) => l.id === a.cursor.id) + (a.skip ?? 0) : 0;
                return retenues.slice(debut, a.take === undefined ? undefined : debut + a.take).map(vue);
            }),
            groupBy: jest.fn(async (a) => {
                if (a.by.length !== 1 || a.by[0] !== 'lettrageId')
                    throw new Error(`doublure : regroupement ${a.by.join(', ')} non honoré`);
                const parGroupe = new Map();
                for (const l of lignes.filter((x) => satisfait(a.where, x)))
                    parGroupe.set(l.lettrageId, (parGroupe.get(l.lettrageId) ?? 0) + 1);
                return [...parGroupe].map(([lettrageId, n]) => ({ lettrageId, _count: { _all: n } }));
            }),
        },
        lettrage: { findMany: jest.fn(async () => []) },
        imputationPaiement: { findMany: jest.fn(async () => []) },
        exercice: { findFirst: jest.fn(async () => ({ id: exerciceId, dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') })) },
    };
}
describe('poids des lignes ouvertes · les notes par échéance', () => {
    it('la colonne « à un an au plus » vaut le solde, à travers deux lots, le brouillard écarté', async () => {
        const enBase = (l, statut = 'VALIDEE') => ({
            ...l,
            statut,
            compteId: 'c411',
            compte: { numero: '41110001' },
        });
        const remplissage = Array.from({ length: lecture_par_lots_1.LOT_LECTURE }, (_, i) => enBase(ligne(`m${String(i).padStart(6, '0')}`, 1, 0, '2026-11-01', null, '2026-12-01')));
        const lignes = [
            enBase(ligne('a-facture', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05')),
            ...remplissage,
            enBase(ligne('y-reglement-brouillard', 0, 500_000, '2026-10-20', 'g'), 'BROUILLARD'),
            enBase(ligne('z-reglement', 0, 1_000_000, '2026-10-10', 'g')),
        ];
        const base = baseQuiHonore(lignes);
        const findMany = base.ligneEcriture.findMany;
        const prisma = base;
        const service = new note_annexe_service_1.NoteAnnexeService({}, {}, prisma, {}, {});
        const { parCompte: echeances, nommes } = await service.chargerEcheances('t', 'ex');
        expect(findMany.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(echeances.get('41110001')).toEqual({ unAn: 2_480_000 + lecture_par_lots_1.LOT_LECTURE, deuxAns: 0, plusDeDeuxAns: 0, nonVentile: 0 });
        expect(nommes.size).toBe(0);
    });
});
describe('poids des lignes ouvertes · les relances (relecture, bloquant 6)', () => {
    it('l’avis préventif réclame le reste de la facture, jamais la facture entière', async () => {
        const tiers = { id: 't-c1', nom: 'C1', type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null };
        const compte = { id: 'c-41110001', numero: '41110001', intitule: 'Client C1', tiersCompte: { tiers } };
        const base = [
            ligne('f', 3_480_000, 0, '2026-10-01', 'g', '2026-11-05'),
            ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
        ];
        const lignes = base.map((l) => ({
            ...l,
            lettre: null,
            libelle: l.id,
            compte,
            ecriture: { ...l.ecriture, libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
        }));
        const prisma = {
            ...lecteur(base),
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            ligneEcriture: { ...lecteur(base).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
            niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
            relance: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const [p] = await new relances_service_1.RelancesService(prisma, {}).positions('t', {
            exerciceId: 'ex',
            type: client_1.TypeRelance.PREVENTIVE,
            dateReference: '2026-10-20',
        });
        expect(p.montantDu).toBe(2_480_000);
        expect(p.lignes.map((l) => l.montant)).toEqual([2_480_000]);
    });
});
describe('poids des lignes ouvertes · la NOTE 3 des SMT (relecture, majeur 8)', () => {
    it('l’écart d’une facture réglée en partie va à la part de SON échéance, le règlement sans échéance n’en change aucune', async () => {
        const enBase = (l, statut = 'VALIDEE') => ({
            ...l,
            statut,
            compteId: 'c1',
            compte: { numero: '41110001' },
        });
        const db = baseQuiHonore([
            enBase(ligne('f', 3_480_000, 0, '2026-12-05', 'g', '2027-02-05')),
            enBase(ligne('r', 0, 1_000_000, '2026-12-20', 'g')),
            enBase(ligne('r-brouillard', 0, 500_000, '2026-12-22', 'g'), 'BROUILLARD'),
        ]);
        const ouvertes = {
            ecriture: { tenantId: 't', exerciceId: 'ex', statut: client_1.StatutEcriture.VALIDEE },
            ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(d('2026-12-31')),
            compteId: { in: ['c1'] },
        };
        const { ecarts, nommes } = await (0, reste_des_lignes_ouvertes_1.ecartsDesGroupesParEcheance)(db, 't', ouvertes, d('2026-12-31'), 'essai');
        expect(ecarts.get('c1')).toEqual({ nonEchu: -1_000_000, echu: 0 });
        expect(nommes.size).toBe(0);
    });
});
describe('poids des lignes ouvertes · les groupes lus ligne à ligne, servis (paquet 1, B5)', () => {
    const groupesEnBase = (n, tenantId = 't') => Array.from({ length: n }, (_, i) => ({
        id: `g${String(i).padStart(2, '0')}`,
        code: `A${String.fromCharCode(65 + (i % 26))}`,
        compteId: `c${i % 3}`,
        compte: { numero: `4111000${i % 3}` },
        tenantId,
    }));
    const motifsDe = (base, motif = 'RESTE_NON_REPARTI') => new Map(base.map((g) => [g.id, motif]));
    const lecteurDeGroupes = (base) => ({
        lettrage: {
            findMany: jest.fn(async (a) => a.where.lettrageReconduitId
                ? []
                : base.filter((g) => g.tenantId === a.where.tenantId && (!a.where.id || a.where.id.in.includes(g.id)))),
        },
    });
    it('borné, le total dit · les premiers par compte puis code, le code tel que le lettrage l’affiche', async () => {
        const base = groupesEnBase(reste_des_lignes_ouvertes_1.PLAFOND_GROUPES_NOMMES + 5);
        const r = await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(lecteurDeGroupes(base), 't', motifsDe(base));
        expect(r.total).toBe(reste_des_lignes_ouvertes_1.PLAFOND_GROUPES_NOMMES + 5);
        expect(r.tronque).toBe(true);
        expect(r.groupes).toHaveLength(reste_des_lignes_ouvertes_1.PLAFOND_GROUPES_NOMMES);
        expect(r.groupes[0]).toEqual({ code: 'aa', compte: '41110000', motif: 'RESTE_NON_REPARTI' });
        const tries = [...r.groupes].sort((a, b) => a.compte.localeCompare(b.compte) || a.code.localeCompare(b.code));
        expect(r.groupes).toEqual(tries);
    });
    it('aucun groupe · une lecture faite, total 0, rien n’est lu', async () => {
        const l = lecteurDeGroupes([]);
        expect(await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(l, 't', new Map())).toEqual({ total: 0, groupes: [], tronque: false });
        expect(l.lettrage.findMany).not.toHaveBeenCalled();
    });
    it('un groupe d’un autre dossier n’est pas nommé', async () => {
        const r = await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigne)(lecteurDeGroupes(groupesEnBase(1, 'autre')), 't', new Map([['g00', 'RESTE_NON_REPARTI']]));
        expect(r.groupes).toEqual([]);
    });
    it('compte par compte (relances)', async () => {
        const base = groupesEnBase(4);
        const r = await (0, reste_des_lignes_ouvertes_1.groupesLusLigneALigneParCompte)(lecteurDeGroupes(base), 't', motifsDe(base, 'NEGATIF_SANS_ORIGINE'));
        expect(r.get('c0')).toEqual({
            total: 2,
            groupes: [
                { code: 'aa', compte: '41110000', motif: 'NEGATIF_SANS_ORIGINE' },
                { code: 'ad', compte: '41110000', motif: 'NEGATIF_SANS_ORIGINE' },
            ],
            tronque: false,
        });
        expect(r.get('c1')?.total).toBe(1);
    });
    const usd = { deviseId: 'usd', montantDevise: 1_000 };
    const base5 = [
        ligne('f5', 2_800_000, 0, '2026-03-01', 'g5', '2026-03-31', usd),
        ligne('r5', 0, 1_800_000, '2026-06-10', 'g5', null, { deviseId: 'usd', montantDevise: 600 }),
    ];
    const groupe5 = [{ id: 'g5', code: 'AA', compteId: 'c411', compte: { numero: '41110001' }, tenantId: 't' }];
    const attendu = { total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'DEVISE_REGLEE_EN_PARTIE' }], tronque: false };
    it('la règle · le reste en devise ne rend pas le solde en francs, le groupe est lu ligne à ligne', () => {
        expect((0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)(base5).nonRepartis).toEqual(['g5']);
    });
    it('la balance âgée le sert', async () => {
        const compte = { id: 'c411', numero: '41110001', intitule: 'C5' };
        const lignes = base5.map((l) => ({ ...l, compte, ecriture: { ...l.ecriture, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false } }));
        const prisma = {
            ...lecteur(base5),
            ...lecteurDeGroupes(groupe5),
            exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
            ligneEcriture: { ...lecteur(base5).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
            tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const r = await new ecriture_service_1.EcritureService(prisma, {}, {}, {}).balanceAgee('t', {
            exerciceId: 'ex',
            dateReference: '2026-12-31',
            type: 'CLIENTS_41',
        });
        expect(r.groupesLusLigneALigne).toEqual(attendu);
        expect(r.totaux.net).toBe(1_000_000);
    });
    it('la relance le sert sur la position du compte', async () => {
        const tiers = { id: 't-c5', nom: 'C5', type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null };
        const compte = { id: 'c411', numero: '41110001', intitule: 'Client C5', tiersCompte: { tiers } };
        const lignes = base5.map((l) => ({
            ...l,
            lettre: null,
            libelle: l.id,
            compte,
            ecriture: { ...l.ecriture, libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
        }));
        const prisma = {
            ...lecteur(base5),
            ...lecteurDeGroupes(groupe5),
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
            ligneEcriture: { ...lecteur(base5).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
            niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
            relance: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const [p] = await new relances_service_1.RelancesService(prisma, {}).positions('t', {
            exerciceId: 'ex',
            type: client_1.TypeRelance.RAPPEL,
            dateReference: '2026-12-31',
        });
        expect(p.groupesLusLigneALigne).toEqual(attendu);
        expect(p.montantDu).toBe(1_000_000);
        expect(p.lignes.map((x) => [x.libelle, x.montant])).toEqual([['f5', 1_000_000]]);
    });
    describe('la relance lit le groupe comme un tout (relecture, M2)', () => {
        const tiers = { id: 't-c51', nom: 'C51', type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null };
        const compte = { id: 'c411', numero: '41110001', intitule: 'Client C51', tiersCompte: { tiers } };
        const baseM2 = [
            ligne('f0', 1_500_000, 0, '2027-01-05', null, '2027-01-31'),
            ligne('fusd', 2_800_000, 0, '2027-01-20', 'g5', '2027-04-30', usd),
            ligne('rusd', 0, 1_800_000, '2027-02-15', 'g5', null, { deviseId: 'usd', montantDevise: 600 }),
        ];
        const positions = async (type) => {
            const lignes = baseM2.map((l) => ({
                ...l,
                lettre: null,
                libelle: l.id,
                compte,
                ecriture: { ...l.ecriture, libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
            }));
            const prisma = {
                ...lecteur(baseM2),
                ...lecteurDeGroupes(groupe5),
                tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
                ligneEcriture: { ...lecteur(baseM2).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
                niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
                relance: { findMany: jest.fn().mockResolvedValue([]) },
            };
            return new relances_service_1.RelancesService(prisma, {}).positions('t', { exerciceId: 'ex', type, dateReference: '2027-03-01' });
        };
        it('préventif · le net du groupe (1 000 000), à l’échéance de sa facture, jamais la facture entière', async () => {
            const [p] = await positions(client_1.TypeRelance.PREVENTIVE);
            expect(p.montantDu).toBe(1_000_000);
            expect(p.lignes.map((x) => [x.libelle, x.montant, x.echeance])).toEqual([['fusd', 1_000_000, '2027-04-30']]);
        });
        it('rappel · F0 seule (1 500 000) · le règlement du groupe ne se retranche jamais d’une autre facture', async () => {
            const [p] = await positions(client_1.TypeRelance.RAPPEL);
            expect(p.montantDu).toBe(1_500_000);
            expect(p.lignes.map((x) => [x.libelle, x.montant])).toEqual([['f0', 1_500_000]]);
        });
    });
    it('la facture encore ouverte la plus ancienne · par les restes de la loi, sinon les plus récentes qui couvrent le net', () => {
        const f1 = ligne('f1', 100_000, 0, '2026-01-05', 'g', '2026-02-05');
        const f2 = ligne('f2', 100_000, 0, '2026-02-05', 'g', '2026-03-05');
        const f3 = ligne('f3', 100_000, 0, '2026-03-05', 'g', '2026-04-05');
        const r = ligne('r', 0, 150_000, '2026-04-10', 'g');
        expect((0, reste_des_lignes_ouvertes_1.factureOuverteLaPlusAncienne)([f1, f2, f3, r], new Map(), 15_000_000)).toBe('f2');
        expect((0, reste_des_lignes_ouvertes_1.factureOuverteLaPlusAncienne)([f1, f2, f3, r], new Map(), 15_000_000, new Map([['f3', { francs: 100_000, devise: null }], ['f1', { francs: 0, devise: null }]]))).toBe('f3');
        expect((0, reste_des_lignes_ouvertes_1.factureOuverteLaPlusAncienne)([f2, f3], new Map([['f3', { date: d('2025-12-01'), id: 'o3' }]]), 10_000_000)).toBe('f2');
        expect((0, reste_des_lignes_ouvertes_1.factureOuverteLaPlusAncienne)([r, f3], new Map(), 5_000_000)).toBe('f3');
    });
    it('chaque groupe lu ligne à ligne porte sa ligne et son net, pour qui le réclame', () => {
        expect([...(0, reste_des_lignes_ouvertes_1.poidsDesLignesOuvertes)(base5).enBloc]).toEqual([['g5', { ligneId: 'f5', net: 1_000_000 }]]);
    });
    it('les notes par échéance le rendent', async () => {
        const lignes = base5.map((l) => ({ ...l, compte: { numero: '41110001' } }));
        const prisma = {
            ...lecteur(base5),
            ...lecteurDeGroupes(groupe5),
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
            ligneEcriture: {
                ...lecteur(base5).ligneEcriture,
                groupBy: jest.fn(async (a) => a.where.lettrageId?.in ? lecteur(base5).ligneEcriture.groupBy(a) : [{ lettrageId: 'g5', _count: { _all: 2 } }]),
                findMany: jest.fn(async (a) => (a.cursor ? [] : lignes)),
            },
            imputationPaiement: { findMany: jest.fn(async () => []) },
        };
        const service = new note_annexe_service_1.NoteAnnexeService({}, {}, prisma, {}, {});
        const { nommes } = await service.chargerEcheances('t', 'ex');
        expect([...nommes]).toEqual([['g5', 'DEVISE_REGLEE_EN_PARTIE']]);
    });
    it('chaque lecteur sert ce qu’il a lu ligne à ligne', () => {
        const lire = (f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', f), 'utf8');
        const ecriture = lire('comptabilite/ecriture.service.ts');
        expect(ecriture.match(/groupesLusLigneALigne: await groupesLusLigneALigne\(this\.prisma, tenantId, poids\.motifs\)/g)).toHaveLength(2);
        expect(lire('notes-annexes/note-annexe.service.ts')).toMatch(/groupesLusLigneALigne: await groupesLusLigneALigne\(this\.prisma, tenantId, nommes\)/);
        for (const f of ['etats-financiers/etats-financiers-smt.service.ts', 'etats-financiers-syscohada/etats-financiers-smt-syscohada.service.ts']) {
            expect(lire(f)).toMatch(/groupesLusLigneALigne: await groupesLusLigneALigne\(this\.prisma, tenantId, nommes\)/);
            expect(lire(f)).toMatch(/const \{ ecarts, nommes \} = await ecartsDesGroupesParEcheance\(/);
        }
    });
});
describe('poids des lignes ouvertes · les jumeaux qui lisent les mêmes lignes', () => {
    const lire = (f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', f), 'utf8');
    it('l’échéancier range chaque ligne lettrée à son poids', () => {
        expect(lire('comptabilite/ecriture.service.ts')).toMatch(/for \(const l of lettrees\) ranger\(l, poidsOuMontant\(poids, l\)\);/);
    });
    it('la NOTE 3 des deux SMT porte l’écart des groupes à la part de l’échéance', () => {
        for (const f of ['etats-financiers/etats-financiers-smt.service.ts', 'etats-financiers-syscohada/etats-financiers-smt-syscohada.service.ts']) {
            expect(lire(f)).toMatch(/await ecartsDesGroupesParEcheance\(this\.prisma, tenantId, lignesOuvertes, exercice\.dateFin,/);
        }
    });
    it('les relances lisent la paire à cheval, puis le poids', () => {
        expect(lire('relances/relances.service.ts')).toMatch(/const net = paires\?\.reste\.get\(l\.id\)\?\.francs \?\? bloc\?\.net \?\? poidsOuMontant\(poids, l\);/);
    });
});
//# sourceMappingURL=reste-des-lignes-ouvertes.spec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const taux_tva_service_1 = require("./taux-tva.service");
const periode_autorisation_debits_1 = require("../tiers/periode-autorisation-debits");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'TVA 16 %',
    taux: 16,
    compteCollecteId: 'c443',
    compteDeductibleId: 'c445',
};
const fiche = (p = {}) => ({
    code: 'F001',
    nom: 'Gardiennage Kivu',
    autoriseTvaDebits: true,
    referenceAutorisationDebits: 'DGI/2026/77',
    dateEffetAutorisationDebits: new Date('2026-01-15'),
    dateRevocationAutorisationDebits: null,
    ...p,
});
const ACHAT_AVEC_MENTION = { sens: client_1.SensFacture.ACHAT, mentionTvaDebits: true, nature: client_1.NatureFacture.FACTURE };
const ACHAT_SANS_MENTION = { sens: client_1.SensFacture.ACHAT, mentionTvaDebits: false, nature: client_1.NatureFacture.FACTURE };
function ligneTva(opts) {
    const ttc = opts.tva * 7.25;
    const vente = opts.vente === true;
    const regle = (opts.reglements ?? []).reduce((t, r) => t + r.montant, 0);
    const facture = vente ? { debit: ttc, credit: 0 } : { debit: 0, credit: ttc };
    const lettrage = opts.reglements && opts.reglements.length > 0
        ? {
            statut: regle >= ttc - 0.005 ? 'SOLDE' : 'PARTIEL',
            solde: ttc - regle,
            soldeAt: null,
            lignes: [
                { ...facture, ecriture: { date: new Date(opts.date) } },
                ...opts.reglements.map((r) => ({
                    debit: vente ? 0 : r.montant,
                    credit: vente ? r.montant : 0,
                    ecriture: { date: new Date(r.date) },
                })),
            ],
        }
        : { statut: 'PARTIEL', solde: ttc, soldeAt: null, lignes: [{ ...facture, ecriture: { date: new Date(opts.date) } }] };
    return {
        id: `l-${opts.date}-${opts.tva}`,
        tauxTvaId: TAUX.id,
        compteId: vente ? 'c4432' : 'c4454',
        compte: { numero: vente ? '44320000' : '44540000' },
        debit: vente ? 0 : opts.tva,
        credit: vente ? opts.tva : 0,
        piece: opts.piece ?? null,
        fiche: opts.fiche ?? null,
        ecriture: {
            date: new Date(opts.date),
            lignes: [
                {
                    ...facture,
                    compte: { numero: vente ? '41110001' : '40110001', classe: 'CLASSE_4' },
                    lettrage,
                },
                vente
                    ? { debit: 0, credit: opts.tva * 6.25, compte: { numero: '70610000', classe: 'CLASSE_7', tiersCompte: null }, lettrage: null }
                    : { debit: opts.tva * 6.25, credit: 0, compte: { numero: '62400000', classe: 'CLASSE_6', tiersCompte: null }, lettrage: null },
            ],
        },
    };
}
function retenue(where, l) {
    const e = where.ecriture;
    const date = l.ecriture.date;
    const avant = (d, borne) => !borne?.lte || d.getTime() <= borne.lte.getTime();
    if (e.date)
        return avant(date, e.date);
    if (!Array.isArray(e.OR))
        return true;
    return e.OR.some((b) => {
        if (b.date)
            return avant(date, b.date);
        const borne = b.lignes?.some?.lettrage?.lignes?.some?.ecriture?.date;
        if (!borne)
            return false;
        return l.ecriture.lignes.some((x) => x.lettrage?.lignes?.some((g) => avant(g.ecriture.date, borne)));
    });
}
function service(lignesTva, regime = 'LIVRAISONS', dateAutorisationDebitsTva = null) {
    const findMany = jest.fn().mockImplementation(({ where, select }) => {
        if (!where.compte?.OR)
            return Promise.resolve([]);
        const colonnesPiece = select?.ecriture?.select?.facture?.select;
        const colonnesTiers = select?.ecriture?.select?.lignes?.select?.compte?.select?.tiersCompte?.select?.tiers?.select;
        const garder = (o, cols) => Object.fromEntries(Object.entries(o).filter(([c]) => cols?.[c]));
        return Promise.resolve(lignesTva
            .filter((l) => retenue(where, l))
            .map(({ piece, fiche: f, ...l }) => ({
            ...l,
            ecriture: {
                ...l.ecriture,
                facture: colonnesPiece && piece ? garder(piece, colonnesPiece) : null,
                lignes: l.ecriture.lignes.map((x) => x.compte.classe === 'CLASSE_4'
                    ? { ...x, compte: { ...x.compte, tiersCompte: f ? { tiers: garder(f, colonnesTiers) } : null } }
                    : x),
            },
        })));
    });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: regime, referentiel: 'SYSCOHADA', dateAutorisationDebitsTva }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
        ligneEcriture: {
            findMany,
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
        imputationPaiement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { s: new taux_tva_service_1.TauxTvaService(prisma, {}), findMany };
}
const fr = (n) => n.toLocaleString('fr-FR');
const MARS = new Date('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
const AVRIL = new Date('2026-04-01');
const FIN_AVRIL = new Date('2026-04-30T23:59:59.999Z');
describe('la période de l’autorisation se lit sur la fiche (décret art. 59 et 63)', () => {
    it('la requête demande les deux dates, le code et le nom du fournisseur', async () => {
        const { s, findMany } = service([ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche() })]);
        await s.declaration('t1', MARS, FIN_MARS);
        const appel = findMany.mock.calls.find(([arg]) => arg.where?.compte?.OR);
        expect(appel?.[0].select.ecriture.select.lignes.select.compte.select.tiersCompte.select.tiers.select).toEqual({
            code: true,
            nom: true,
            autoriseTvaDebits: true,
            referenceAutorisationDebits: true,
            dateEffetAutorisationDebits: true,
            dateRevocationAutorisationDebits: true,
        });
    });
    it('dans la période, la déduction est anticipée à la facture', async () => {
        const { s } = service([ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche(), piece: ACHAT_AVEC_MENTION })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.mentionExigibilite).not.toContain('HORS DE LA PÉRIODE');
    });
    it('une facture ANTÉRIEURE à la date d’effet revient au droit commun, fournisseur nommé', async () => {
        const { s } = service([
            ligneTva({
                date: '2026-03-10',
                tva: 160_000,
                fiche: fiche({ dateEffetAutorisationDebits: new Date('2026-04-01') }),
                piece: ACHAT_AVEC_MENTION,
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain(`HORS DE LA PÉRIODE D’AUTORISATION · ${fr(160_000)} CDF`);
        expect(d.mentionExigibilite).toContain('Fournisseur(s) : F001 Gardiennage Kivu.');
        expect(d.mentionExigibilite).toContain(`Dont ${fr(160_000)} CDF sur une facture d’achat enregistrée qui PORTE pourtant`);
        expect(d.mentionExigibilite).not.toContain('AUCUNE AUTORISATION D’ACQUITTER');
    });
    it('une facture POSTÉRIEURE à la révocation revient au droit commun', async () => {
        const { s } = service([
            ligneTva({
                date: '2026-03-10',
                tva: 160_000,
                fiche: fiche({ dateRevocationAutorisationDebits: new Date('2026-03-01') }),
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('suit le retour au droit commun');
    });
    it('la révocation vaut à sa date, comprise · la veille reste aux débits', async () => {
        const f = fiche({ dateRevocationAutorisationDebits: new Date('2026-03-11') });
        const { s } = service([
            ligneTva({ date: '2026-03-10', tva: 160_000, fiche: f }),
            ligneTva({ date: '2026-03-11', tva: 48_000, fiche: f }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
    });
    it('autorisé SANS date d’effet · anticipation gardée, et dite non datée', async () => {
        const { s } = service([
            ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche({ dateEffetAutorisationDebits: null }), piece: ACHAT_AVEC_MENTION }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.mentionExigibilite).toContain(`AUTORISATION AUX DÉBITS NON DATÉE · ${fr(160_000)} CDF`);
        expect(d.mentionExigibilite).toContain('Date d’effet à porter sur la fiche de : F001 Gardiennage Kivu.');
    });
});
describe('les deux signaux de la mention de l’art. 60', () => {
    it('(b) mention lue sur la facture, fiche NON autorisée · droit commun gardé, fournisseur nommé', async () => {
        const { s } = service([
            ligneTva({
                date: '2026-03-10',
                tva: 160_000,
                fiche: fiche({ autoriseTvaDebits: false, dateEffetAutorisationDebits: null }),
                piece: ACHAT_AVEC_MENTION,
            }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(0);
        expect(d.mentionExigibilite).toContain('Fiche(s) à reprendre, le droit commun étant gardé d’ici là : F001 Gardiennage Kivu.');
    });
    it('(c) fiche autorisée, facture enregistrée SANS la mention · anticipation gardée, preuve manquante dite', async () => {
        const { s } = service([ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche(), piece: ACHAT_SANS_MENTION })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.totalDeductible).toBe(160_000);
        expect(d.mentionExigibilite).toContain(`FACTURE ENREGISTRÉE SANS LA MENTION DES DÉBITS · ${fr(160_000)} CDF`);
        expect(d.mentionExigibilite).toContain('ou à faire rectifier par : F001 Gardiennage Kivu.');
    });
    it('(c) ne se dit pas sans facture enregistrée · il n’y a rien à lire', async () => {
        const { s } = service([ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche(), piece: null })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).not.toContain('FACTURE ENREGISTRÉE SANS LA MENTION');
    });
});
describe('art. 62 · le règlement antérieur au débit avance l’exigibilité', () => {
    it('la requête lit aussi une facture postérieure dont un règlement lettré tombe dans la période', async () => {
        const { s, findMany } = service([ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche() })]);
        await s.declaration('t1', MARS, FIN_MARS);
        const appel = findMany.mock.calls.find(([arg]) => arg.where?.compte?.OR);
        expect(appel?.[0].where.ecriture.OR).toEqual([
            { date: { lte: FIN_MARS } },
            { lignes: { some: { lettrage: { lignes: { some: { ecriture: { date: { lte: FIN_MARS } } } } } } } },
            { corrigeEcriture: { is: { date: { lte: FIN_MARS } } } },
        ]);
        expect(appel?.[0].where.ecriture.tenantId).toBe('t1');
    });
    it('une facture d’avril réglée en mars se déduit en MARS, et pas une seconde fois en avril', async () => {
        const lignes = [
            ligneTva({
                date: '2026-04-10',
                tva: 160_000,
                fiche: fiche(),
                reglements: [{ date: '2026-03-20', montant: 160_000 * 7.25 }],
            }),
        ];
        const mars = await service(lignes).s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalDeductible).toBe(160_000);
        expect(mars.mentionExigibilite).toContain(`RÈGLEMENT ANTÉRIEUR AU DÉBIT · ${fr(160_000)} CDF`);
        const avril = await service(lignes).s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalDeductible).toBe(0);
    });
    it('un acompte partiel antérieur ne rend exigible que sa part, le reste au débit', async () => {
        const lignes = [
            ligneTva({
                date: '2026-04-10',
                tva: 100_000,
                fiche: fiche(),
                reglements: [{ date: '2026-03-20', montant: 100_000 * 7.25 * 0.4 }],
            }),
        ];
        const mars = await service(lignes).s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalDeductible).toBe(40_000);
        const avril = await service(lignes).s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalDeductible).toBe(60_000);
    });
    it('un fournisseur NON autorisé n’y est pas soumis · droit commun, déduction au règlement', async () => {
        const lignes = [
            ligneTva({
                date: '2026-04-10',
                tva: 160_000,
                fiche: fiche({ autoriseTvaDebits: false }),
                reglements: [{ date: '2026-03-20', montant: 160_000 * 7.25 }],
            }),
        ];
        const mars = await service(lignes).s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalDeductible).toBe(160_000);
        expect(mars.mentionExigibilite).not.toContain('RÈGLEMENT ANTÉRIEUR AU DÉBIT');
    });
    it('collecte d’un dossier aux DÉBITS · l’encaissement lettré antérieur à la facture date la taxe', async () => {
        const lignes = [
            ligneTva({
                date: '2026-04-10',
                tva: 320_000,
                vente: true,
                reglements: [{ date: '2026-03-20', montant: 320_000 * 7.25 }],
            }),
        ];
        const mars = await service(lignes, 'DEBITS').s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(320_000);
        expect(mars.mentionExigibilite).toContain(`ENCAISSEMENT ANTÉRIEUR AU DÉBIT · ${fr(320_000)} CDF`);
        const avril = await service(lignes, 'DEBITS').s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalCollecte).toBe(0);
    });
    it('collecte d’un dossier aux DÉBITS · une vente ANTÉRIEURE à son autorisation reste au droit commun', async () => {
        const lignes = [
            ligneTva({ date: '2026-03-10', tva: 160_000, vente: true, reglements: [{ date: '2026-04-20', montant: 160_000 * 7.25 }] }),
            ligneTva({ date: '2026-03-20', tva: 80_000, vente: true }),
        ];
        const autorisation = new Date('2026-03-15');
        const mars = await service(lignes, 'DEBITS', autorisation).s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(80_000);
        expect(mars.mentionExigibilite).toContain(`AVANT L'AUTORISATION · ${fr(160_000)} CDF`);
        expect(mars.mentionExigibilite).not.toContain('AUTORISATION DU DOSSIER NON DATÉE');
        const avril = await service(lignes, 'DEBITS', autorisation).s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalCollecte).toBe(160_000);
    });
    it('collecte d’un dossier aux DÉBITS sans date d’autorisation · régime gardé, et dit non daté', async () => {
        const lignes = [ligneTva({ date: '2026-03-10', tva: 160_000, vente: true })];
        const mars = await service(lignes, 'DEBITS').s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(160_000);
        expect(mars.mentionExigibilite).toContain('AUTORISATION DU DOSSIER NON DATÉE');
    });
    it('un règlement POSTÉRIEUR au débit ne change rien à la date aux débits', async () => {
        const lignes = [
            ligneTva({ date: '2026-03-10', tva: 160_000, fiche: fiche(), reglements: [{ date: '2026-04-20', montant: 160_000 * 7.25 }] }),
        ];
        const mars = await service(lignes).s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalDeductible).toBe(160_000);
        expect(mars.mentionExigibilite).not.toContain('RÈGLEMENT ANTÉRIEUR AU DÉBIT');
    });
});
function groupeAuxDebits(reglement) {
    const f1 = { id: 'g-f1', debit: 1_160_000, credit: 0, ecriture: { id: 'e-f1', date: new Date('2026-04-10'), libelle: 'Facture F1' } };
    const f2 = { id: 'g-f2', debit: 580_000, credit: 0, ecriture: { id: 'e-f2', date: new Date('2026-04-15'), libelle: 'Facture F2' } };
    const r = {
        id: 'g-r',
        debit: 0,
        credit: reglement.montant,
        ecriture: {
            id: 'e-r',
            date: new Date(reglement.date),
            libelle: reglement.avoir ? 'Avoir' : 'Encaissement',
            _count: { lignes: reglement.avoir ? 1 : 0 },
        },
    };
    const lettrage = { id: 'G1', statut: 'PARTIEL', solde: 1_740_000 - reglement.montant, soldeAt: null, lignes: [f1, f2, r] };
    const vente = (f, tva) => ({
        id: `tva-${f.id}`,
        tauxTvaId: TAUX.id,
        compteId: 'c4432',
        compte: { numero: '44320000' },
        debit: 0,
        credit: tva,
        piece: null,
        fiche: null,
        ecriture: {
            id: f.ecriture.id,
            date: f.ecriture.date,
            libelle: f.ecriture.libelle,
            lignes: [
                { id: f.id, debit: f.debit, credit: 0, compte: { numero: '41110001', classe: 'CLASSE_4' }, lettrage },
                { debit: 0, credit: tva * 6.25, compte: { numero: '70610000', classe: 'CLASSE_7', tiersCompte: null }, lettrage: null },
            ],
        },
    });
    return [vente(f1, 160_000), vente(f2, 80_000)];
}
describe('M7 · aux débits, le groupe à plusieurs factures impute son règlement antérieur (décret art. 62)', () => {
    it('l’encaissement du 20 mars paie F1 (art. 154) · sa taxe en MARS, celle de F2 au débit, en avril', async () => {
        const lignes = groupeAuxDebits({ date: '2026-03-20', montant: 1_160_000 });
        const mars = await service(lignes, 'DEBITS').s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(160_000);
        expect(mars.imputationsDesPaiements).toEqual([
            expect.objectContaining({ factures: ['Facture F1', 'Facture F2'], encaisse: 1_160_000, fondement: 'LEGALE' }),
        ]);
        const avril = await service(lignes, 'DEBITS').s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalCollecte).toBe(80_000);
    });
    it('un groupe que le moteur ne décompose pas (un avoir) reste au débit, NOMMÉ avec la somme perçue avant le débit', async () => {
        const lignes = groupeAuxDebits({ date: '2026-03-20', montant: 1_160_000, avoir: true });
        const mars = await service(lignes, 'DEBITS').s.declaration('t1', MARS, FIN_MARS);
        expect(mars.totalCollecte).toBe(0);
        expect(mars.groupesImputationIndeterminee).toEqual([
            { factures: ['Facture F1', 'Facture F2'], encaisse: 1_160_000, motif: 'régime des débits, taxe datée au débit · un avoir dans le groupe' },
        ]);
        const avril = await service(lignes, 'DEBITS').s.declaration('t1', AVRIL, FIN_AVRIL);
        expect(avril.totalCollecte).toBe(240_000);
    });
    it('règle pure · la part payée avant le débit à sa date, le reste (même jour ou après, ou non payé) au débit', () => {
        const debit = new Date('2026-04-10');
        expect(taux_tva_service_1.TauxTvaService.tranchesAuxDebitsImputees([
            { date: new Date('2026-03-20'), fraction: 0.25 },
            { date: new Date('2026-04-10'), fraction: 0.25 },
            { date: null, fraction: 0.5 },
        ], debit)).toEqual([
            { date: new Date('2026-03-20'), fraction: 0.25, auPaiement: true },
            { date: debit, fraction: 0.75 },
        ]);
    });
});
describe('la période, règle pure', () => {
    const f = (p) => fiche(p);
    it('rend les cinq situations', () => {
        expect((0, periode_autorisation_debits_1.situationAutorisationDebits)(f({ autoriseTvaDebits: false }), new Date('2026-03-10'))).toBe('NON_AUTORISE');
        expect((0, periode_autorisation_debits_1.situationAutorisationDebits)(f({}), new Date('2026-01-14'))).toBe('AVANT_EFFET');
        expect((0, periode_autorisation_debits_1.situationAutorisationDebits)(f({}), new Date('2026-01-15'))).toBe('AUTORISE');
        expect((0, periode_autorisation_debits_1.situationAutorisationDebits)(f({ dateEffetAutorisationDebits: null }), new Date('2020-01-01'))).toBe('AUTORISE_NON_DATE');
        expect((0, periode_autorisation_debits_1.situationAutorisationDebits)(f({ dateRevocationAutorisationDebits: new Date('2026-06-01') }), new Date('2026-06-01'))).toBe('REVOQUEE');
    });
    it('refuse une révocation qui ne suit pas la date d’effet', () => {
        expect((0, periode_autorisation_debits_1.motifRefusPeriodeAutorisationDebits)(new Date('2026-03-01'), new Date('2026-03-01'))).toContain('art. 63');
        expect((0, periode_autorisation_debits_1.motifRefusPeriodeAutorisationDebits)(new Date('2026-03-01'), new Date('2026-03-02'))).toBeNull();
        expect((0, periode_autorisation_debits_1.motifRefusPeriodeAutorisationDebits)(null, new Date('2026-03-02'))).toBeNull();
    });
});
//# sourceMappingURL=tva-periode-autorisation-debits.spec.js.map
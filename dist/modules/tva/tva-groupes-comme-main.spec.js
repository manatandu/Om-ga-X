"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCreanceId: 'c443', compteCollecteId: 'c443', compteDeductibleId: 'c445' };
const jour = (d) => new Date(`${d}T00:00:00.000Z`);
const mois = (m) => {
    const debut = jour(`${m}-01`);
    return [debut, new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0))];
};
function vente(p) {
    const groupe = p.groupe
        ? {
            id: p.groupe.id,
            statut: p.groupe.statut,
            solde: p.groupe.solde,
            soldeAt: null,
            createdAt: p.groupe.createdAt ? jour(p.groupe.createdAt) : undefined,
            lignes: p.groupe.lignes.map((g, i) => ({
                id: g.ecriture ? `g-${g.ecriture}-${i}` : undefined,
                debit: g.debit,
                credit: g.credit,
                dateEcheance: g.echeance ? jour(g.echeance) : null,
                ecriture: {
                    id: g.ecriture,
                    libelle: g.ecriture ? `Facture ${g.ecriture}` : undefined,
                    corrigeEcritureId: g.corrige ?? null,
                    date: jour(g.date),
                    createdAt: jour(g.date),
                    _count: { lignes: g.avoir ? 1 : 0 },
                },
            })),
        }
        : null;
    return {
        id: p.id,
        tauxTvaId: TAUX.id,
        compteId: 'c443',
        compte: { numero: p.compteTva ?? '44320000' },
        debit: 0,
        credit: p.tva,
        ecriture: {
            id: p.id,
            date: jour(p.date),
            createdAt: jour(p.saisie ?? p.date),
            libelle: `Facture ${p.id}`,
            facture: null,
            lignes: [
                {
                    id: `t-${p.id}`,
                    debit: p.ttc,
                    credit: 0,
                    compteId: 'c-client',
                    deviseId: null,
                    montantDevise: null,
                    dateEcheance: null,
                    libelle: null,
                    compte: { numero: p.numeroClient ?? '41110101', classe: 'CLASSE_4', tiersCompte: null },
                    lettrage: groupe,
                },
                { id: `p-${p.id}`, debit: 0, credit: p.ttc - p.tva, compte: { numero: p.produit, classe: 'CLASSE_7' }, lettrage: null },
            ],
        },
    };
}
function avoir(p) {
    return {
        id: p.id,
        tauxTvaId: TAUX.id,
        compteId: 'c443',
        compte: { numero: '44320000' },
        debit: p.tva,
        credit: 0,
        ecriture: { date: jour(p.date), libelle: `Avoir ${p.id}`, facture: null, lignes: [] },
    };
}
function prisma(lignes, liquidations = [], evenementsAudit = [], declarees = []) {
    return {
        imputationPaiement: {
            findMany: jest.fn(({ where }) => Promise.resolve(declarees.filter((d) => (d.tenantId ?? 't1') === where.tenantId &&
                where.retireeLe === null &&
                !d.retireeLe &&
                where.ligneReglementId.in.includes(d.ligneReglementId)))),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue({ id: 'an' }) },
        ligneEcriture: {
            findMany: jest.fn(({ where }) => Promise.resolve(where.compteId?.in ? [] : lignes)),
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue(liquidations) },
        evenementAudit: { findMany: jest.fn().mockResolvedValue(evenementsAudit) },
        exercice: { count: jest.fn().mockResolvedValue(3) },
    };
}
const JEUX = {
    'groupe partiel à une facture (un règlement)': {
        lignes: [
            vente({
                id: 'F',
                date: '2026-01-15',
                tva: 160_000,
                ttc: 1_160_000,
                produit: '70610000',
                groupe: { statut: 'PARTIEL', solde: 696_000, lignes: [{ debit: 1_160_000, credit: 0, date: '2026-01-15' }, { debit: 0, credit: 464_000, date: '2026-03-12' }] },
            }),
        ],
        periodes: ['2026-01', '2026-03'],
    },
    'groupe avec une facture de biens et une facture de services': (() => {
        const lignesGroupe = [
            { debit: 580_000, credit: 0, date: '2026-01-10', ecriture: 'G' },
            { debit: 1_160_000, credit: 0, date: '2026-01-15', ecriture: 'S' },
            { debit: 0, credit: 1_000_000, date: '2026-03-12', ecriture: 'R' },
        ];
        const groupe = { id: 'GBS', statut: 'PARTIEL', solde: 740_000, lignes: lignesGroupe };
        return {
            lignes: [
                vente({ id: 'G', date: '2026-01-10', tva: 80_000, ttc: 580_000, produit: '70110000', compteTva: '44310000', groupe }),
                vente({ id: 'S', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
            ],
            periodes: ['2026-01', '2026-03'],
        };
    })(),
    'avoir dans le groupe': (() => {
        const groupe = {
            statut: 'SOLDE',
            solde: 0,
            lignes: [
                { debit: 1_160_000, credit: 0, date: '2026-01-15' },
                { debit: 0, credit: 116_000, date: '2026-02-05', avoir: true },
                { debit: 0, credit: 1_044_000, date: '2026-03-12' },
            ],
        };
        return {
            lignes: [
                vente({ id: 'F', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
                avoir({ id: 'A', date: '2026-02-05', tva: 16_000, ttc: 116_000 }),
            ],
            periodes: ['2026-01', '2026-02', '2026-03'],
        };
    })(),
    'groupe à deux factures (500 000 réglés)': (() => {
        const groupe = {
            id: 'G2',
            statut: 'PARTIEL',
            solde: 1_820_000,
            lignes: [
                { debit: 1_160_000, credit: 0, date: '2026-12-10', ecriture: 'F1' },
                { debit: 1_160_000, credit: 0, date: '2026-12-11', ecriture: 'F2' },
                { debit: 0, credit: 500_000, date: '2026-12-20', ecriture: 'R1' },
            ],
        };
        return {
            lignes: [
                vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
                vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
            ],
            periodes: ['2026-12'],
        };
    })(),
    'facture B ajoutée au groupe d’un paiement antérieur': (() => {
        const groupe = {
            id: 'GAB',
            statut: 'PARTIEL',
            solde: 1_160_000,
            lignes: [
                { debit: 1_160_000, credit: 0, date: '2026-01-15', ecriture: 'A' },
                { debit: 0, credit: 1_160_000, date: '2026-02-10', ecriture: 'RA' },
                { debit: 1_160_000, credit: 0, date: '2026-03-05', ecriture: 'B' },
            ],
        };
        return {
            lignes: [
                vente({ id: 'A', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
                vente({ id: 'B', date: '2026-03-05', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
            ],
            periodes: ['2026-01', '2026-02', '2026-03'],
        };
    })(),
};
async function rendu(Moteur, jeu) {
    const s = new Moteur(prisma(jeu.lignes), {});
    const r = {};
    for (const m of jeu.periodes) {
        const d = await s.declaration('t1', ...mois(m));
        r[m] = [d.totalCollecte, d.avoirsCollecteConstates];
    }
    return r;
}
const RENDU_DE_MAIN = {
    'groupe partiel à une facture (un règlement)': { '2026-01': [0, 0], '2026-03': [64_000, 0] },
    'groupe avec une facture de biens et une facture de services': { '2026-01': [80_000, 0], '2026-03': [57_931.03, 0] },
    'avoir dans le groupe': { '2026-01': [0, 0], '2026-02': [0, 16_000], '2026-03': [160_000, 0] },
    'groupe à deux factures (500 000 réglés)': { '2026-12': [0, 0] },
    'facture B ajoutée au groupe d’un paiement antérieur': { '2026-01': [0, 0], '2026-02': [0, 0], '2026-03': [0, 0] },
};
const RENDU_ATTENDU = {
    ...RENDU_DE_MAIN,
    'groupe à deux factures (500 000 réglés)': { '2026-12': [68_965.52, 0] },
    'facture B ajoutée au groupe d’un paiement antérieur': { '2026-01': [0, 0], '2026-02': [160_000, 0], '2026-03': [0, 0] },
};
describe('Sans créance désignée, chaque groupe rend ce que rend main, sauf le groupe à plusieurs factures de même composition (F1)', () => {
    for (const [nom, jeu] of Object.entries(JEUX)) {
        it(nom, async () => {
            expect(await rendu(taux_tva_service_1.TauxTvaService, jeu)).toEqual(RENDU_ATTENDU[nom]);
        });
    }
    it('F1 · deux prestations, 500 000 encaissés · le reste est en attente, rien n’est dit « indéterminé »', async () => {
        const s = new taux_tva_service_1.TauxTvaService(prisma(JEUX['groupe à deux factures (500 000 réglés)'].lignes), {});
        const d = await s.declaration('t1', ...mois('2026-12'));
        expect(d.tvaEnAttenteEncaissement).toBe(251_034.48);
        expect(d.tvaEnAttenteImputationIndeterminee).toBe(0);
        expect(d.groupesImputationIndeterminee).toEqual([]);
    });
    it('F1 · le solde du 15 janvier 2027 rend exigible le reste, 251 034,48, et le total des deux mois vaut 320 000', async () => {
        const groupe = {
            id: 'G2',
            statut: 'SOLDE',
            solde: 0,
            lignes: [
                { debit: 1_160_000, credit: 0, date: '2026-12-10', ecriture: 'F1' },
                { debit: 1_160_000, credit: 0, date: '2026-12-11', ecriture: 'F2' },
                { debit: 0, credit: 500_000, date: '2026-12-20', ecriture: 'R1' },
                { debit: 0, credit: 1_820_000, date: '2027-01-15', ecriture: 'R2' },
            ],
        };
        const lignes = [
            vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
            vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignes), {});
        expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(68_965.52);
        expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(251_034.48);
    });
    it('point 4 · biens et services · le million du 12 mars est IMPUTÉ (art. 154) · G (10 janvier) d’abord, S reçoit 420 000 · 57 931,03, rien de « non déterminé »', async () => {
        const s = new taux_tva_service_1.TauxTvaService(prisma(JEUX['groupe avec une facture de biens et une facture de services'].lignes), {});
        const d = await s.declaration('t1', ...mois('2026-03'));
        expect(d.totalCollecte).toBe(57_931.03);
        expect(d.groupesImputationIndeterminee).toEqual([]);
        expect(d.groupesImputationIndetermineeTotal).toBe(0);
        expect(d.tvaEnAttenteImputationIndeterminee).toBe(0);
        expect(d.imputationsDesPaiements).toEqual([{ factures: ['Facture G', 'Facture S'], encaisse: 1_000_000, fondement: 'LEGALE' }]);
        expect(d.mentionExigibilite).not.toContain('IMPUTATION N’EST PAS DÉTERMINÉE');
        expect(d.mentionExigibilite).toContain('IMPUTATION DES PAIEMENTS · factures « Facture G », « Facture S », 1');
        expect(d.mentionExigibilite).toContain('imputation légale, Code civil, Livre III, art. 154');
        expect(d.mentionExigibilite).toContain('ni intérêt, ni pénalité, ni sûreté');
    });
    it('F1 · un mois liquidé reste FIGÉ · février liquidé avec A seule (160 000), B entrée en mars · rien de plus en mars ni en avril', async () => {
        const jeu = JEUX['facture B ajoutée au groupe d’un paiement antérieur'];
        const [debut, fin] = mois('2026-02');
        const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-01'), tvaEncaissementFigee: { A: 160_000 } }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(jeu.lignes, liq), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(160_000);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
    });
    it('F1 · un mois liquidé par l’ancien moteur (aucun figé) reste ce qu’il a déclaré · décembre 0, le reste reporté en janvier', async () => {
        const jeu = JEUX['groupe à deux factures (500 000 réglés)'];
        const [debut, fin] = mois('2026-12');
        const liq = [{ id: 'liqD', dateDebut: debut, dateFin: fin, createdAt: jour('2027-01-05'), tvaEncaissementFigee: null }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(jeu.lignes, liq), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(68_965.52);
    });
    it('une liquidation de l’ancien moteur se relit telle qu’elle a déclaré · mars reste 57 931,03, avril 0', async () => {
        const jeu = JEUX['groupe avec une facture de biens et une facture de services'];
        const [debut, fin] = mois('2026-03');
        const s = new taux_tva_service_1.TauxTvaService(prisma(jeu.lignes, [{ id: 'liqM', dateDebut: debut, dateFin: fin, createdAt: jour('2026-04-02'), tvaEncaissementFigee: null }]), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(57_931.03);
        expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
    });
    it('à-nouveau N vers N+1 · F0 (N) et F1 (N+1) réglées ensemble · le règlement n’est jamais compté deux fois', async () => {
        const groupeN1 = {
            statut: 'SOLDE',
            solde: 0,
            soldeAt: null,
            createdAt: jour('2027-02-20'),
            lignes: [
                { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, createdAt: jour('2027-01-01') } },
                { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-15'), estANouveauProvisoire: false, estGenereeParCloture: false, createdAt: jour('2027-01-15') } },
                { debit: 0, credit: 2_320_000, ecriture: { date: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, createdAt: jour('2027-02-15') } },
            ],
        };
        const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        f0.ecriture.libelle = 'Facture F0';
        const f1 = vente({ id: 'F1', date: '2027-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        f1.ecriture.lignes[0].lettrage = groupeN1;
        const aNouveau = {
            id: 'an0',
            compteId: 'c-client',
            debit: 1_160_000,
            credit: 0,
            deviseId: null,
            montantDevise: null,
            dateEcheance: null,
            libelle: 'RAN détail 41110101 · Facture F0',
            ecriture: { date: jour('2027-01-01'), exerciceId: 'ex2027' },
            lettrage: groupeN1,
        };
        const p = prisma([f0, f1]);
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? [aNouveau] : [f0, f1]));
        const s = new taux_tva_service_1.TauxTvaService(p, {});
        expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2027-02'))).totalCollecte).toBe(320_000);
    });
});
describe('BLOQUANT 4 · l’ancien moteur se reconstitue tel qu’il a déclaré (fraction CUMULÉE)', () => {
    const ligne = vente({
        id: 'F',
        date: '2026-01-15',
        tva: 160_000,
        ttc: 1_160_000,
        produit: '70610000',
        groupe: {
            statut: 'SOLDE',
            solde: 0,
            createdAt: '2026-02-10',
            lignes: [
                { debit: 1_160_000, credit: 0, date: '2026-01-15' },
                { debit: 0, credit: 232_000, date: '2026-02-10' },
                { debit: 0, credit: 232_000, date: '2026-03-10' },
                { debit: 0, credit: 696_000, date: '2026-05-10' },
            ],
        },
    });
    const liquidations = [
        { id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null },
        { id: 'liqM', dateDebut: mois('2026-03')[0], dateFin: mois('2026-03')[1], createdAt: jour('2026-04-01'), tvaEncaissementFigee: null },
    ];
    it('février 32 000 et mars 64 000 relus tels que versés, mai 64 000', async () => {
        const s = new taux_tva_service_1.TauxTvaService(prisma([ligne], liquidations), {});
        expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(32_000);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(64_000);
        expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-05'))).totalCollecte).toBe(64_000);
    });
    it('declareParAncienMoteur · le groupe tel qu’il était à l’instant de chaque liquidation', () => {
        const tiers = ligne.ecriture.lignes.filter((x) => x.lettrage);
        expect(taux_tva_service_1.TauxTvaService.declareParAncienMoteur(tiers, 160_000, jour('2026-01-15'), liquidations[0])).toBe(32_000);
        expect(taux_tva_service_1.TauxTvaService.declareParAncienMoteur(tiers, 160_000, jour('2026-01-15'), liquidations[1])).toBe(64_000);
    });
});
describe('Cinquième reprise · saisie après la liquidation, reconstitution incertaine nommée, avoir dans le groupe de l’à-nouveau', () => {
    it('BLOQUANT · facture du 20 mars SAISIE le 15 avril, mars liquidé le 1er avril par l’ancien moteur · mars 0, mai 160 000 (comme main)', async () => {
        const ligne = vente({
            id: 'F',
            date: '2026-03-20',
            saisie: '2026-04-15',
            tva: 160_000,
            ttc: 1_160_000,
            produit: '70610000',
            groupe: {
                statut: 'SOLDE',
                solde: 0,
                createdAt: '2026-05-10',
                lignes: [{ debit: 1_160_000, credit: 0, date: '2026-03-20' }, { debit: 0, credit: 1_160_000, date: '2026-05-10' }],
            },
        });
        const liq = [{ id: 'liqM', dateDebut: mois('2026-03')[0], dateFin: mois('2026-03')[1], createdAt: jour('2026-04-01'), tvaEncaissementFigee: null }];
        const s = new taux_tva_service_1.TauxTvaService(prisma([ligne], liq), {});
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-05'))).totalCollecte).toBe(160_000);
        expect(taux_tva_service_1.TauxTvaService.declareParAncienMoteur([], 160_000, jour('2026-03-20'), liq[0], jour('2026-04-15'))).toBe(0);
    });
    it('un groupe lu par l’ancien moteur et COMPLÉTÉ après la liquidation (journal d’audit) · reconstitution incertaine NOMMÉE, montant compris', async () => {
        const ligne = vente({
            id: 'F',
            date: '2026-01-15',
            tva: 160_000,
            ttc: 1_160_000,
            produit: '70610000',
            groupe: {
                id: 'G1',
                statut: 'PARTIEL',
                solde: 696_000,
                createdAt: '2026-02-10',
                lignes: [
                    { debit: 1_160_000, credit: 0, date: '2026-01-15' },
                    { debit: 0, credit: 232_000, date: '2026-02-10' },
                    { debit: 0, credit: 232_000, date: '2026-02-20' },
                ],
            },
        });
        const liq = [{ id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null }];
        const audit = [
            { id: 'e1', action: 'MODIFICATION', entiteId: 'G1', horodatage: jour('2026-03-05'), avant: { solde: 928_000 }, apres: { solde: 696_000 } },
            { id: 'e2', action: 'MODIFICATION', entiteId: 'G9', horodatage: jour('2026-03-06'), avant: { solde: 10 }, apres: { solde: 10 } },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma([ligne], liq, audit), {});
        const d = await s.declaration('t1', ...mois('2026-04'));
        expect(d.reconstitutionsIncertaines).toEqual([{ facture: 'Facture F', dateDebut: '2026-02-01', dateFin: '2026-02-28', montantReconstitue: 64_000 }]);
        expect(d.reconstitutionsIncertainesTotal).toBe(1);
        expect(d.mentionExigibilite).toContain('reconstitution incertaine pour la facture « Facture F »');
        expect(d.mentionExigibilite).toContain('à vérifier contre la déclaration déposée');
    });
    it('un paiement DÉLETTRÉ après la liquidation (groupe né avant elle supprimé) · reconstitution incertaine nommée', async () => {
        const ligne = vente({ id: 'F', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        const liq = [{ id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null }];
        const audit = [{ id: 'e1', action: 'SUPPRESSION', entiteId: 'G1', horodatage: jour('2026-03-05'), avant: { compteId: 'c-client', createdAt: '2026-02-10T00:00:00.000Z' }, apres: null }];
        const s = new taux_tva_service_1.TauxTvaService(prisma([ligne], liq, audit), {});
        const d = await s.declaration('t1', ...mois('2026-04'));
        expect(d.reconstitutionsIncertaines.map((r) => r.facture)).toEqual(['Facture F']);
    });
    it('sans ancienne liquidation, le journal d’audit n’est pas lu', async () => {
        const p = prisma(JEUX['avoir dans le groupe'].lignes);
        await new taux_tva_service_1.TauxTvaService(p, {}).declaration('t1', ...mois('2026-03'));
        expect(p.evenementAudit.findMany).not.toHaveBeenCalled();
    });
    it('un AVOIR dans le groupe de l’à-nouveau n’est pas un règlement · F0 entière au paiement, comme main', async () => {
        const groupeN1 = {
            statut: 'SOLDE',
            solde: 0,
            soldeAt: null,
            createdAt: jour('2027-02-20'),
            lignes: [
                { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-01'), createdAt: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, _count: { lignes: 0 } } },
                { debit: 0, credit: 116_000, ecriture: { date: jour('2027-01-20'), createdAt: jour('2027-01-20'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 1 } } },
                { debit: 0, credit: 1_044_000, ecriture: { date: jour('2027-02-15'), createdAt: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } } },
            ],
        };
        const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        const aNouveau = {
            id: 'an0',
            compteId: 'c-client',
            debit: 1_160_000,
            credit: 0,
            deviseId: null,
            montantDevise: null,
            dateEcheance: null,
            libelle: 'RAN détail 41110101 · Facture F0',
            ecriture: { date: jour('2027-01-01'), exerciceId: 'ex2027' },
            lettrage: groupeN1,
        };
        const p = prisma([f0]);
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? [aNouveau] : [f0]));
        const s = new taux_tva_service_1.TauxTvaService(p, {});
        expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2027-02'))).totalCollecte).toBe(160_000);
        const appel = p.ligneEcriture.findMany.mock.calls.find((c) => c[0].where.compteId?.in)[0];
        expect(appel.select.lettrage.select.lignes.select.ecriture.select).toMatchObject({ createdAt: true, _count: expect.any(Object) });
    });
});
describe('F1 · les briques du groupe à plusieurs factures', () => {
    it('fractionsDuGroupe · une tranche par encaissement, sur le total des factures du groupe', () => {
        expect(taux_tva_service_1.TauxTvaService.fractionsDuGroupe([{ date: jour('2026-12-20'), montant: 500_000 }], 2_320_000, false)).toEqual([
            { date: jour('2026-12-20'), fraction: 500_000 / 2_320_000 },
            { date: null, fraction: 1 - 500_000 / 2_320_000 },
        ]);
        const soldee = taux_tva_service_1.TauxTvaService.fractionsDuGroupe([{ date: jour('2026-12-20'), montant: 2_319_999.99 }], 2_320_000, true);
        expect(soldee).toHaveLength(1);
        expect(soldee[0].fraction).toBeCloseTo(1, 12);
    });
    it('repartirLibresEntreLignes · au centime, la somme rendue vaut celle du groupe, aucune ligne au-delà de sa taxe', () => {
        const libres = [{ date: jour('2026-12-20'), montant: 68_965.52, origine: jour('2026-12-20') }];
        const r = taux_tva_service_1.TauxTvaService.repartirLibresEntreLignes(libres, [160_000, 160_000]);
        expect(r.map((x) => x[0].montant).reduce((t, v) => t + v, 0)).toBeCloseTo(68_965.52, 2);
        const plafonnee = taux_tva_service_1.TauxTvaService.repartirLibresEntreLignes([{ date: jour('2026-02-10'), montant: 160_000, origine: jour('2026-02-10') }], [0, 160_000]);
        expect(plafonnee[0]).toEqual([]);
        expect(plafonnee[1][0].montant).toBe(160_000);
    });
    it('groupeAPlusieursFactures · null pour un groupe à une facture ou sans identifiant', () => {
        const une = { debit: 1_160_000, credit: 0, lettrage: { id: 'G', statut: 'PARTIEL', solde: 1, lignes: [{ debit: 1_160_000, credit: 0 }, { debit: 0, credit: 5, ecriture: { date: jour('2026-01-02') } }] } };
        expect(taux_tva_service_1.TauxTvaService.groupeAPlusieursFactures([une])).toBeNull();
        const deux = { ...une, lettrage: { ...une.lettrage, lignes: [...une.lettrage.lignes, { debit: 10, credit: 0 }] } };
        expect(taux_tva_service_1.TauxTvaService.groupeAPlusieursFactures([deux])?.id).toBe('G');
        expect(taux_tva_service_1.TauxTvaService.groupeAPlusieursFactures([{ ...deux, lettrage: { ...deux.lettrage, id: undefined } }])).toBeNull();
    });
});
describe('F1 à travers la clôture · le groupe partiel de N se poursuit par ses à-nouveaux', () => {
    const ligneN = (id, debit, credit, date, libelle) => ({
        id: `t-${id}`,
        compteId: 'c-client',
        libelle: null,
        dateEcheance: null,
        deviseId: null,
        montantDevise: null,
        debit,
        credit,
        ecriture: { id, libelle, date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } },
    });
    const groupeN = {
        id: 'GN',
        statut: 'PARTIEL',
        solde: 1_820_000,
        soldeAt: null,
        createdAt: jour('2026-12-20'),
        lignes: [
            ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'),
            ligneN('F2', 1_160_000, 0, '2026-12-11', 'Facture F2'),
            ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel'),
        ],
    };
    const ran = (id, debit, credit, libelle) => ({
        id,
        compteId: 'c-client',
        libelle: `RAN détail 41110101 · ${libelle}`,
        dateEcheance: null,
        deviseId: null,
        montantDevise: null,
        debit,
        credit,
        ecriture: { id: 'AN27', libelle: 'À-nouveau', date: jour('2027-01-01'), createdAt: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, exerciceId: 'ex2027', _count: { lignes: 0 } },
    });
    const lignesGPrime = [
        ran('anF1', 1_160_000, 0, 'Facture F1'),
        ran('anF2', 1_160_000, 0, 'Facture F2'),
        ran('anR1', 0, 500_000, 'Règlement partiel'),
        ligneN('R2', 0, 1_820_000, '2027-01-15', 'Solde'),
    ];
    const groupePrime = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: lignesGPrime };
    const aNouveaux = lignesGPrime.slice(0, 3).map((l) => ({ ...l, lettrage: groupePrime }));
    const ventes = () => [
        vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null }),
        vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null }),
    ].map((v) => {
        v.ecriture.lignes[0].lettrage = groupeN;
        return v;
    });
    function base(liquidations, ran) {
        const p = prisma(ventes(), liquidations);
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? ran : ventes()));
        return p;
    }
    it('décembre liquidé (figé) · janvier 2027 rend 251 034,48, le total vaut 320 000', async () => {
        const [debut, fin] = mois('2026-12');
        const liq = [{ id: 'liqD', dateDebut: debut, dateFin: fin, createdAt: jour('2027-01-05'), tvaEncaissementFigee: { F1: 34_482.76, F2: 34_482.76 } }];
        const s = new taux_tva_service_1.TauxTvaService(base(liq, aNouveaux), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(68_965.52);
        const janvier = await s.declaration('t1', ...mois('2027-01'));
        expect(janvier.totalCollecte).toBe(251_034.48);
        expect(janvier.groupesImputationIndeterminee).toEqual([]);
    });
    it('deux reports candidats dans le même exercice · rien n’est relié (aucune devinette), et les factures sont NOMMÉES', async () => {
        const doublon = { ...aNouveaux[0], id: 'anF1bis' };
        const s = new taux_tva_service_1.TauxTvaService(base([], [...aNouveaux, doublon]), {});
        const d = await s.declaration('t1', ...mois('2027-01'));
        expect(d.totalCollecte).toBe(0);
        expect(d.rapprochementsANouveauAbandonnes).toEqual([
            { facture: 'Facture F1', date: '2026-12-10', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
            { facture: 'Facture F2', date: '2026-12-11', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
        ]);
        expect(d.rapprochementsANouveauAbandonnesTotal).toBe(2);
        expect(d.mentionExigibilite).toContain('RAPPROCHEMENT PAR L’À-NOUVEAU NON FAIT · facture « Facture F1 » du 10/12/2026, 160');
    });
    it('relierAuxANouveaux · une facture non lettrée de N, deux à-nouveaux candidats lettrés en N+1 · NOMMÉE, jamais tue', async () => {
        const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        const groupe = {
            statut: 'SOLDE',
            solde: 0,
            soldeAt: null,
            createdAt: jour('2027-02-20'),
            lignes: [{ debit: 0, credit: 1_160_000, ecriture: { date: jour('2027-02-15'), createdAt: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } } }],
        };
        const an = (id) => ({
            id,
            compteId: 'c-client',
            debit: 1_160_000,
            credit: 0,
            deviseId: null,
            montantDevise: null,
            dateEcheance: null,
            libelle: 'RAN détail 41110101 · Facture F0',
            ecriture: { date: jour('2027-01-01'), exerciceId: 'ex2027' },
            lettrage: groupe,
        });
        const p = prisma([f0]);
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? [an('a1'), an('a2')] : [f0]));
        const d = await new taux_tva_service_1.TauxTvaService(p, {}).declaration('t1', ...mois('2027-02'));
        expect(d.totalCollecte).toBe(0);
        expect(d.rapprochementsANouveauAbandonnes).toEqual([
            { facture: 'Facture F0', date: '2026-12-10', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
        ]);
    });
});
describe('Second tour · l’ancien moteur ne voit jamais la prolongation, la chaîne se suit sur trois exercices', () => {
    const ligneN = (id, debit, credit, date, libelle) => ({
        id: `t-${id}`,
        compteId: 'c-client',
        libelle: null,
        dateEcheance: null,
        deviseId: null,
        montantDevise: null,
        debit,
        credit,
        ecriture: { id, libelle, date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } },
    });
    const ran = (id, debit, credit, libelle, an, exercice, date) => ({
        id,
        compteId: 'c-client',
        libelle: `RAN détail 41110101 · ${libelle}`,
        dateEcheance: null,
        deviseId: null,
        montantDevise: null,
        debit,
        credit,
        ecriture: { id: an, libelle: 'À-nouveau', date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: true, exerciceId: exercice, _count: { lignes: 0 } },
    });
    const vendre = (id, date, groupe) => {
        const v = vente({ id, date, tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
        v.ecriture.lignes[0].lettrage = groupe;
        return v;
    };
    const base = (ventes, aNouveaux, liquidations = []) => {
        const p = prisma(ventes(), liquidations);
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? aNouveaux : ventes()));
        return new taux_tva_service_1.TauxTvaService(p, {});
    };
    const rendu = async (s, periodes) => {
        const r = {};
        for (const m of periodes)
            r[m] = (await s.declaration('t1', ...mois(m))).totalCollecte;
        return r;
    };
    const liqs = [
        { id: 'liqD', dateDebut: mois('2026-12')[0], dateFin: mois('2026-12')[1], createdAt: jour('2027-01-05'), tvaEncaissementFigee: null },
        { id: 'liqJ', dateDebut: mois('2027-01')[0], dateFin: mois('2027-01')[1], createdAt: jour('2027-02-05'), tvaEncaissementFigee: null },
    ];
    const groupeDeux = {
        id: 'GN',
        statut: 'PARTIEL',
        solde: 1_820_000,
        soldeAt: null,
        createdAt: jour('2026-12-20'),
        lignes: [ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'), ligneN('F2', 1_160_000, 0, '2026-12-11', 'Facture F2'), ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel')],
    };
    const l27 = [
        ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'),
        ran('anF2', 1_160_000, 0, 'Facture F2', 'AN27', 'ex2027', '2027-01-01'),
        ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'),
        ligneN('R2', 0, 1_820_000, '2027-01-15', 'Solde'),
    ];
    const g27 = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: l27 };
    const ans27 = l27.slice(0, 3).map((l) => ({ ...l, lettrage: g27 }));
    it('deux factures, liquidations de l’ancien moteur · décembre 0 et janvier 0 relus tels que versés, 320 000 au premier mois libre', async () => {
        const s = base(() => [vendre('F1', '2026-12-10', groupeDeux), vendre('F2', '2026-12-11', groupeDeux)], ans27, liqs);
        expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 0, '2027-01': 0, '2027-02': 320_000 });
    });
    const groupeUne = {
        id: 'G1',
        statut: 'PARTIEL',
        solde: 660_000,
        soldeAt: null,
        createdAt: jour('2026-12-20'),
        lignes: [ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'), ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel')],
    };
    const u27 = [ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'), ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'), ligneN('R2', 0, 660_000, '2027-01-15', 'Solde')];
    const gu27 = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: u27 };
    const ansU = u27.slice(0, 2).map((l) => ({ ...l, lettrage: gu27 }));
    it('une facture, liquidations de l’ancien moteur · décembre 68 965,52 (versé), janvier 0 (versé), 91 034,48 en février', async () => {
        const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], ansU, liqs);
        expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 68_965.52, '2027-01': 0, '2027-02': 91_034.48 });
    });
    it('une facture, aucune liquidation · décembre 68 965,52, janvier 91 034,48', async () => {
        const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], ansU);
        expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 68_965.52, '2027-01': 91_034.48, '2027-02': 0 });
    });
    const c27 = [ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'), ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'), ligneN('R2', 0, 300_000, '2027-06-15', 'Acompte 2')];
    const gc27 = { id: 'G27', statut: 'PARTIEL', solde: 360_000, lignes: c27 };
    const c28 = [
        ran('an2F1', 1_160_000, 0, 'RAN détail 41110101 · Facture F1', 'AN28', 'ex2028', '2028-01-01'),
        ran('an2R1', 0, 500_000, 'RAN détail 41110101 · Règlement partiel', 'AN28', 'ex2028', '2028-01-01'),
        ran('an2R2', 0, 300_000, 'Acompte 2', 'AN28', 'ex2028', '2028-01-01'),
        ligneN('R3', 0, 360_000, '2028-01-20', 'Solde'),
    ];
    const gc28 = { id: 'G28', statut: 'SOLDE', solde: 0, lignes: c28 };
    const ansC27 = c27.slice(0, 2).map((l) => ({ ...l, lettrage: gc27 }));
    const ansC = [...ansC27, ...c28.slice(0, 3).map((l) => ({ ...l, lettrage: gc28 }))];
    it('chaîne N, N+1, N+2 · 68 965,52, 41 379,31, 49 655,17, soit 160 000, et rien n’est nommé', async () => {
        const s = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC);
        expect(await rendu(s, ['2026-12', '2027-06', '2028-01'])).toEqual({ '2026-12': 68_965.52, '2027-06': 41_379.31, '2028-01': 49_655.17 });
        const janvier = await s.declaration('t1', ...mois('2028-01'));
        expect(janvier.groupesImputationIndeterminee).toEqual([]);
        expect(janvier.tvaEnAttenteEncaissement).toBe(0);
    });
    it('chaîne · juin 2027, non liquidé, ne change pas à la saisie de 2028', async () => {
        const avant = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC27);
        const apres = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC);
        expect((await avant.declaration('t1', ...mois('2027-06'))).totalCollecte).toBe(41_379.31);
        expect((await apres.declaration('t1', ...mois('2027-06'))).totalCollecte).toBe(41_379.31);
    });
    it('à-nouveau PROVISOIRE, premier exercice non clos · le solde du 15/01/2027 lettré avec lui rend 91 034,48 en janvier', async () => {
        const provisoire = (l) => ({ ...l, ecriture: { ...l.ecriture, estANouveauProvisoire: true, estGenereeParCloture: false } });
        const p27 = [provisoire(u27[0]), provisoire(u27[1]), u27[2]];
        const g = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: p27 };
        const ventes = () => [vendre('F1', '2026-12-10', groupeUne)];
        const p = prisma(ventes());
        p.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in ? p27.slice(0, 2).map((l) => ({ ...l, lettrage: g })) : ventes()));
        p.exercice.count.mockImplementation(({ where }) => Promise.resolve(where.statut ? 0 : 2));
        const s = new taux_tva_service_1.TauxTvaService(p, {});
        expect(await rendu(s, ['2026-12', '2027-01'])).toEqual({ '2026-12': 68_965.52, '2027-01': 91_034.48 });
        const d = await s.declaration('t1', ...mois('2027-01'));
        expect(d.tvaEnAttenteEncaissement).toBe(0);
    });
    it('la taxe d’un encaissement se calcule sur le groupe, arrondie une fois · 1 000 000 sur deux factures rend 137 931,03', async () => {
        const g = { ...groupeDeux, id: 'GR', solde: 1_320_000, lignes: [groupeDeux.lignes[0], groupeDeux.lignes[1], ligneN('R1', 0, 1_000_000, '2026-12-20', 'Acompte')] };
        const s = base(() => [vendre('F1', '2026-12-10', g), vendre('F2', '2026-12-11', g)], []);
        expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(137_931.03);
    });
    it('sans écriture d’à-nouveau dans le dossier, aucun report n’est lu', async () => {
        const p = prisma([vendre('F1', '2026-12-10', groupeUne)]);
        p.ecriture.findFirst.mockResolvedValue(null);
        await new taux_tva_service_1.TauxTvaService(p, {}).declaration('t1', ...mois('2026-12'));
        expect(p.ligneEcriture.findMany.mock.calls.some((c) => c[0].where.compteId?.in)).toBe(false);
    });
    it('un groupe d’à-nouveau au-delà de sa borne de lecture · rien n’est relié, et la facture est NOMMÉE', async () => {
        const remplissage = Array.from({ length: 501 }, (_, i) => ligneN(`X${i}`, 1, 0, '2027-02-01', `Divers ${i}`));
        const gTrop = { id: 'G27', statut: 'PARTIEL', solde: 1, lignes: [...u27, ...remplissage] };
        const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], u27.slice(0, 2).map((l) => ({ ...l, lettrage: gTrop })));
        const d = await s.declaration('t1', ...mois('2027-01'));
        expect(d.totalCollecte).toBe(0);
        expect(d.rapprochementsANouveauAbandonnes.map((a) => a.motif)).toEqual(['groupe de lettrage de plus de 500 lignes, rapprochement non fait']);
    });
});
describe('point 4 · l’imputation des paiements date la taxe d’un groupe de composition différente', () => {
    const groupeSX = (lignes, statut = 'PARTIEL', solde = 1_000_000) => ({ id: 'GSX', statut, solde, lignes });
    const sansEcheance = [
        { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S' },
        { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X' },
        { debit: 0, credit: 1_160_000, date: '2026-02-15', ecriture: 'R' },
    ];
    const lignesS = (lignes, statut, solde) => [
        vente({ id: 'S', date: '2026-01-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: groupeSX(lignes, statut, solde) }),
    ];
    it('S, la plus ancienne, est payée la première · février 160 000 (main rendait 22 068,97)', async () => {
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance)), {});
        const fevrier = await s.declaration('t1', ...mois('2026-02'));
        expect(fevrier.totalCollecte).toBe(160_000);
        expect(fevrier.imputationsDesPaiements).toEqual([{ factures: ['Facture S', 'Facture X'], encaisse: 1_160_000, fondement: 'LEGALE' }]);
        expect(fevrier.groupesImputationIndeterminee).toEqual([]);
        expect((await s.declaration('t1', ...mois('2026-01'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    });
    it('l’échue avant la non échue · S à échéance du 30 juin, X échue · le paiement va d’abord à X, S reçoit 160 000 · 22 068,97', async () => {
        const lignes = [
            { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S', echeance: '2026-06-30' },
            { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X', echeance: '2026-01-20' },
            { debit: 0, credit: 1_160_000, date: '2026-02-15', ecriture: 'R' },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(lignes)), {});
        expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(22_068.97);
    });
    it('février liquidé par l’ancien moteur (22 068,97 versés) reste ce qu’il a déclaré · l’écart, 137 931,03, au 1er mars', async () => {
        const [debut, fin] = mois('2026-02');
        const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: null }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), liq), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(22_068.97);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(137_931.03);
        expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
    });
    it('février liquidé et FIGÉ à 22 068,97 · même report au premier jour non liquidé, rien deux fois', async () => {
        const [debut, fin] = mois('2026-02');
        const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: { S: 22_068.97 } }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), liq), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(22_068.97);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(137_931.03);
    });
    it('le solde du groupe paie X ensuite · rien de plus pour S (déjà payée)', async () => {
        const lignes = [...sansEcheance, { debit: 0, credit: 1_000_000, date: '2026-03-20', ecriture: 'R2' }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(lignes, 'SOLDE', 0)), {});
        expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(160_000);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    });
    it('un avoir dans le groupe garde la fraction cumulée, et le groupe est NOMMÉ pour ce motif', async () => {
        const lignes = [...sansEcheance, { debit: 0, credit: 100_000, date: '2026-02-20', ecriture: 'AV', avoir: true }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 900_000)), {});
        const d = await s.declaration('t1', ...mois('2026-02'));
        expect(d.imputationsDesPaiements).toEqual([]);
        expect(d.groupesImputationIndeterminee).toEqual([{ factures: ['Facture S'], encaisse: 1_260_000, motif: 'un avoir dans le groupe' }]);
        expect(d.mentionExigibilite).toContain('GROUPE DE LETTRAGE LU EN BLOC');
    });
    it('le débiteur déclare payer X d’abord (1 000 000), S ne reçoit que 160 000 · 22 068,97, fondement DÉCLARÉ', async () => {
        const declarees = [
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000 },
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-S-0', montant: 160_000 },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {});
        const fevrier = await s.declaration('t1', ...mois('2026-02'));
        expect(fevrier.totalCollecte).toBe(22_068.97);
        expect(fevrier.imputationsDesPaiements).toEqual([{ factures: ['Facture S', 'Facture X'], encaisse: 1_160_000, fondement: 'DECLAREE' }]);
    });
    it('une déclaration EN PARTIE · 500 000 déclarés sur X, le reste suit l’art. 154 et paie S (660 000) · 91 034,48', async () => {
        const declarees = [{ ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 500_000 }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {});
        const fevrier = await s.declaration('t1', ...mois('2026-02'));
        expect(fevrier.totalCollecte).toBe(91_034.48);
        expect(fevrier.imputationsDesPaiements[0].fondement).toBe('DECLAREE_EN_PARTIE');
    });
    it('une part déclarée au-delà du reste de la facture est DITE à part (avertissement), jamais mêlée à l’imputation', async () => {
        const declarees = [{ ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_160_000 }];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {});
        const fevrier = await s.declaration('t1', ...mois('2026-02'));
        expect(fevrier.imputationsDesPaiements[0].declareNonRetenu).toBe(160_000);
        expect(fevrier.mentionExigibilite).toContain('IMPUTATION DÉCLARÉE NON RETENUE · factures « Facture S », « Facture X », 160');
        const imputation = fevrier.mentionExigibilite.slice(fevrier.mentionExigibilite.indexOf('IMPUTATION DES PAIEMENTS'));
        expect(imputation.slice(0, imputation.indexOf('Lectures d’OmegaX'))).not.toContain('non retenu');
    });
    it('une déclaration RETIRÉE ou d’un autre dossier ne compte pas · l’imputation légale revient, 160 000', async () => {
        const declarees = [
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000, retireeLe: jour('2026-03-01') },
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000, tenantId: 'autre' },
        ];
        const p = prisma(lignesS(sansEcheance), [], [], declarees);
        const fevrier = await new taux_tva_service_1.TauxTvaService(p, {}).declaration('t1', ...mois('2026-02'));
        expect(fevrier.totalCollecte).toBe(160_000);
        expect(fevrier.imputationsDesPaiements[0].fondement).toBe('LEGALE');
        const appel = p.imputationPaiement.findMany.mock.calls[0][0];
        expect(appel.where).toEqual({ tenantId: 't1', retireeLe: null, ligneReglementId: { in: ['g-S-0', 'g-X-1', 'g-R-2'] } });
    });
    it('février liquidé (figé à 160 000) puis déclaration posée en mars · le mois liquidé reste, le trop-déclaré absorbe la suite', async () => {
        const [debut, fin] = mois('2026-02');
        const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: { S: 160_000 } }];
        const declarees = [
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000 },
            { ligneReglementId: 'g-R-2', ligneFactureId: 'g-S-0', montant: 160_000 },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(sansEcheance), liq, [], declarees), {});
        expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(160_000);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    });
    it('M1 · un paiement annulé par inscription en négatif ne date rien · février 0, avril 68 965,52', async () => {
        const lignes = [
            { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S' },
            { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X' },
            { debit: 0, credit: 500_000, date: '2026-02-15', ecriture: 'P1' },
            { debit: 0, credit: -500_000, date: '2026-03-10', ecriture: 'N1', corrige: 'P1' },
            { debit: 0, credit: 500_000, date: '2026-04-15', ecriture: 'P2' },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 1_660_000)), {});
        expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
        expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(68_965.52);
    });
    it('M1 · une inscription en négatif sans la ligne qu’elle annule · le groupe se lit en bloc, NOMMÉ', async () => {
        const lignes = [
            ...sansEcheance,
            { debit: 0, credit: -300_000, date: '2026-02-20', ecriture: 'N9', corrige: 'Z' },
        ];
        const s = new taux_tva_service_1.TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 1_300_000)), {});
        const d = await s.declaration('t1', ...mois('2026-02'));
        expect(d.groupesImputationIndeterminee.map((g) => g.motif)).toEqual(['une inscription en négatif dans le groupe sans la ligne qu’elle annule']);
    });
    it('M1 · neutraliserLesNegatifs · la liaison d’abord, sinon le même compte au montant opposé ; la facture annulée sort aussi', () => {
        const l = (id, debit, credit, corrige = null) => ({ compteId: 'c', debit, credit, ecriture: { id, corrigeEcritureId: corrige } });
        const a = l('A', 0, 100);
        const b = l('B', 0, 100);
        const n = l('N', 0, -100, 'B');
        expect(taux_tva_service_1.TauxTvaService.neutraliserLesNegatifs([a, b, n])).toEqual([a]);
        const f = l('F', 500, 0);
        const nf = l('NF', -500, 0);
        expect(taux_tva_service_1.TauxTvaService.neutraliserLesNegatifs([f, nf, a])).toEqual([a]);
        expect(taux_tva_service_1.TauxTvaService.neutraliserLesNegatifs([a, l('N2', 0, -50)])).toBeNull();
    });
});
//# sourceMappingURL=tva-groupes-comme-main.spec.js.map
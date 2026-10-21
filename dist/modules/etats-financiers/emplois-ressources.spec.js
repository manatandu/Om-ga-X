"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_projet_service_1 = require("./etats-financiers-projet.service");
function ligne(numero, classe, mouvement, report = {}) {
    const reportDebit = report.debit ?? 0;
    const reportCredit = report.credit ?? 0;
    const mouvementDebit = mouvement.debit ?? 0;
    const mouvementCredit = mouvement.credit ?? 0;
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        totalDebit: reportDebit + mouvementDebit,
        totalCredit: reportCredit + mouvementCredit,
        reportDebit,
        reportCredit,
        mouvementDebit,
        mouvementCredit,
        solde: reportDebit + mouvementDebit - reportCredit - mouvementCredit,
    };
}
function service(lignes, options = {}) {
    const ecritureService = {
        balance: jest.fn().mockResolvedValue({ lignes, totaux: { debit: 0, credit: 0 } }),
        balanceCumulee: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve({
            lignes: exerciceId === (options.exercicePrecedentId ?? '__aucun__')
                ? (options.cumulDebut ?? [])
                : (options.cumulFin ?? lignes),
            totaux: { debit: 0, credit: 0 },
        })),
    };
    const exerciceService = {
        lister: jest.fn().mockResolvedValue(options.exercicePrecedentId
            ? [
                { id: 'e1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
                { id: options.exercicePrecedentId, dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') },
            ]
            : [{ id: 'e1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }]),
    };
    const prisma = {
        bailleur: { findMany: jest.fn().mockResolvedValue(options.bailleurs ?? []) },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.porteFondsContrepartieEtat === true
                ? (options.contrepartieEtat ?? []).map((id) => ({ id }))
                :
                    (where.id?.in ?? Object.keys(options.rattachements ?? {}))
                        .filter((id) => options.rattachements?.[id])
                        .map((id) => ({ id, bailleurId: options.rattachements[id] })))),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new etats_financiers_projet_service_1.EtatsFinanciersProjetService(ecritureService, exerciceService, prisma);
}
const poste = (etat, ref) => etat.lignes.find((l) => l.ref === ref);
describe('Tableau emplois-ressources · projets de développement', () => {
    it('lit les ressources dans le MOUVEMENT CRÉDIT, pas dans le solde', async () => {
        const s = service([ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 1_000_000 }, { credit: 400_000 })]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FA').montant).toBe(1_000_000);
    });
    it('la correction de dettes S’AJOUTE : une dette qui augmente réduit l’emploi décaissé', async () => {
        const s = service([
            ligne('66100000', client_1.ClasseCompte.CLASSE_6, { debit: 200_000 }),
            ligne('42200000', client_1.ClasseCompte.CLASSE_4, { credit: 50_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        const fr = poste(er, 'FR');
        expect(fr.brut).toBe(200_000);
        expect(fr.correction).toBe(-50_000);
        expect(fr.montant).toBe(150_000);
    });
    it('le renvoi 8 RETRANCHE le mouvement crédit des intérêts courus (186 au plan SYCEBNL), il ne l’ajoute pas', async () => {
        const s = service([
            ligne('67100000', client_1.ClasseCompte.CLASSE_6, { debit: 80_000 }),
            ligne('18620000', client_1.ClasseCompte.CLASSE_1, { credit: 30_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FS').montant).toBe(50_000);
    });
    it('écarte le 603 du poste Achats · le guide l’exclut nommément du compte 60', async () => {
        const s = service([
            ligne('60100000', client_1.ClasseCompte.CLASSE_6, { debit: 500_000 }),
            ligne('60300000', client_1.ClasseCompte.CLASSE_6, { debit: 120_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FM').montant).toBe(500_000);
    });
    it('FT se lit en SOLDE DÉBITEUR de clôture, seul poste d’emploi dans ce cas', async () => {
        const s = service([ligne('40910000', client_1.ClasseCompte.CLASSE_4, { debit: 90_000, credit: 30_000 })]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FT').montant).toBe(60_000);
    });
    it('LE CONTRÔLE OFFICIEL BOUCLE · V = VI sur un projet entièrement décaissé', async () => {
        const s = service([
            ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 1_000_000 }),
            ligne('24110000', client_1.ClasseCompte.CLASSE_2, { debit: 300_000 }),
            ligne('66100000', client_1.ClasseCompte.CLASSE_6, { debit: 200_000 }),
            ligne('42200000', client_1.ClasseCompte.CLASSE_4, { credit: 50_000 }),
            ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 1_000_000, credit: 450_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(er.totalRessources).toBe(1_000_000);
        expect(er.totalEmplois).toBe(450_000);
        expect(er.excedent).toBe(550_000);
        expect(er.encaisseDisponible).toBe(550_000);
        expect(er.fondsFinExercice).toBe(550_000);
        expect(er.controle.boucle).toBe(true);
        expect(er.controle.ecart).toBe(0);
    });
    it('l’achèvement d’un en-cours n’est pas un second emploi · renvoi (2), seconde phrase (passe R6)', async () => {
        const s = service([
            ligne('23910000', client_1.ClasseCompte.CLASSE_2, { credit: 400_000 }, { debit: 400_000 }),
            ligne('23110000', client_1.ClasseCompte.CLASSE_2, { debit: 400_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FG').montant).toBe(0);
    });
    it('l’en-cours du transport (2495) se retranche de FJ, pas du matériel (FI)', async () => {
        const s = service([
            ligne('24950000', client_1.ClasseCompte.CLASSE_2, { credit: 90_000 }, { debit: 90_000 }),
            ligne('24510000', client_1.ClasseCompte.CLASSE_2, { debit: 90_000 }),
            ligne('24410000', client_1.ClasseCompte.CLASSE_2, { debit: 50_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FJ').montant).toBe(0);
        expect(poste(er, 'FI').montant).toBe(50_000);
    });
    it('émet une ligne PAR BAILLEUR quand les comptes de fonds leur sont rattachés', async () => {
        const s = service([
            ligne('46210000', client_1.ClasseCompte.CLASSE_4, { credit: 600_000 }),
            ligne('46220000', client_1.ClasseCompte.CLASSE_4, { credit: 400_000 }),
        ], {
            bailleurs: [
                { id: 'b1', nom: 'Union européenne' },
                { id: 'b2', nom: 'USAID' },
            ],
            rattachements: { 'id-46210000': 'b1', 'id-46220000': 'b2' },
        });
        const er = await s.tableauEmploisRessources('t1', 'e1');
        const fonds = er.lignes.filter((l) => l.libelle.startsWith('Fonds reçus, Bailleur'));
        expect(fonds.map((l) => l.libelle)).toEqual([
            'Fonds reçus, Bailleur Union européenne',
            'Fonds reçus, Bailleur USAID',
        ]);
        expect(fonds.map((l) => l.ref)).toEqual(['FA', 'FB']);
        expect(er.totalRessources).toBe(1_000_000);
    });
    it('signale un poste rendu négatif par la correction, sans masquer que le TOTAL reste juste', async () => {
        const s = service([
            ligne('24110000', client_1.ClasseCompte.CLASSE_2, { debit: 400_000 }),
            ligne('60100000', client_1.ClasseCompte.CLASSE_6, { debit: 300_000 }),
            ligne('40110000', client_1.ClasseCompte.CLASSE_4, { credit: 400_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FM').montant).toBe(-100_000);
        expect(er.anomalies.map((a) => a.ref)).toEqual(['FM']);
        expect(er.anomalies[0].diagnostic).toContain('481');
        expect(er.totalEmplois).toBe(300_000);
    });
    it('sans compte déclaré, la contrepartie de l’État reçue reste en FZ, et c’est dit', async () => {
        const s = service([
            ligne('57100000', client_1.ClasseCompte.CLASSE_5, { debit: 500_000 }),
            ligne('46300000', client_1.ClasseCompte.CLASSE_4, { credit: 500_000 }),
        ]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FY').montant).toBe(0);
        expect(poste(er, 'FZ').montant).toBe(500_000);
        expect(er.avertissements.some((a) => a.includes('contrepartie État'))).toBe(true);
    });
    it('le compte DÉCLARÉ porter la contrepartie de l’État va en FV et FY, sans avertissement', async () => {
        const s = service([ligne('57100000', client_1.ClasseCompte.CLASSE_5, { debit: 500_000 }), ligne('46300000', client_1.ClasseCompte.CLASSE_4, { credit: 500_000 })], { contrepartieEtat: ['id-57100000'] });
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect({ fy: poste(er, 'FY').montant, fz: poste(er, 'FZ').montant }).toEqual({ fy: 500_000, fz: 0 });
        expect(er.avertissements.some((a) => a.includes('contrepartie État'))).toBe(false);
    });
    it('sans fonds de l’État, rien à dire', async () => {
        const s = service([ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 500_000 })]);
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FZ').montant).toBe(500_000);
        expect(er.avertissements.some((a) => a.includes('contrepartie État'))).toBe(false);
    });
    describe('colonnes cumulées', () => {
        it('rend le CUMUL DEPUIS L’ORIGINE à côté du montant de l’exercice', async () => {
            const s = service([ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 300_000 })], {
                exercicePrecedentId: 'e0',
                cumulFin: [ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 800_000 })],
                cumulDebut: [ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 500_000 })],
            });
            const er = await s.tableauEmploisRessources('t1', 'e1');
            const fa = poste(er, 'FA');
            expect(fa.montant).toBe(300_000);
            expect(fa.montantCumulDebut).toBe(500_000);
            expect(fa.montantCumulFin).toBe(800_000);
        });
        it('UN BAILLEUR QUI N’A RIEN VERSÉ CETTE ANNÉE GARDE SA LIGNE, avec son cumul', async () => {
            const s = service([], {
                bailleurs: [{ id: 'b-a', nom: 'Alpha' }],
                rattachements: { 'id-46200001': 'b-a' },
                exercicePrecedentId: 'e0',
                cumulFin: [ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 800_000 })],
                cumulDebut: [ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 800_000 })],
            });
            const er = await s.tableauEmploisRessources('t1', 'e1');
            const alpha = er.lignes.find((l) => l.libelle.includes('Alpha'));
            expect(alpha.montant).toBe(0);
            expect(alpha.montantCumulDebut).toBe(800_000);
            expect(alpha.montantCumulFin).toBe(800_000);
        });
        it('apparie les lignes par leur CLÉ, jamais par leur RANG', async () => {
            const bailleurs = [{ id: 'b-a', nom: 'Alpha' }];
            const rattachements = { 'id-46200001': 'b-a' };
            const s = service([ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 100_000 })], {
                bailleurs,
                rattachements,
                exercicePrecedentId: 'e0',
                cumulFin: [
                    ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 900_000 }),
                    ligne('46200099', client_1.ClasseCompte.CLASSE_4, { credit: 400_000 }),
                ],
                cumulDebut: [ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 800_000 })],
            });
            const er = await s.tableauEmploisRessources('t1', 'e1');
            const alpha = er.lignes.find((l) => l.libelle.includes('Alpha'));
            expect(alpha.montant).toBe(100_000);
            expect(alpha.montantCumulFin).toBe(900_000);
            const fc = poste(er, 'FC');
            expect(fc.montantCumulFin).toBe(0);
            const nonRattaches = er.lignes.find((l) => l.libelle.includes('non rattachés'));
            expect(nonRattaches.montantCumulFin).toBe(400_000);
        });
        it('une ligne de bailleur du SEUL CUMUL se range dans le bloc FA/FB, avant FC (passe R6, D9)', async () => {
            const s = service([ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 100_000 })], {
                bailleurs: [{ id: 'b-a', nom: 'Alpha' }],
                rattachements: { 'id-46200001': 'b-a' },
                exercicePrecedentId: 'e0',
                cumulFin: [
                    ligne('46200001', client_1.ClasseCompte.CLASSE_4, { credit: 900_000 }),
                    ligne('46200099', client_1.ClasseCompte.CLASSE_4, { credit: 400_000 }),
                ],
                cumulDebut: [ligne('46200099', client_1.ClasseCompte.CLASSE_4, { credit: 400_000 })],
            });
            const er = await s.tableauEmploisRessources('t1', 'e1');
            expect(er.lignes.slice(0, 3).map((l) => l.ref)).toEqual(['FA', 'FB', 'FC']);
            expect(er.lignes[1].libelle).toContain('non rattachés');
            expect(er.lignes[er.lignes.length - 1].ref).toBe('GZ');
        });
        it('vérifie le CONTRÔLE VII sur chacune des trois colonnes', async () => {
            const s = service([
                ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 300_000 }),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 300_000 }),
            ], {
                exercicePrecedentId: 'e0',
                cumulFin: [
                    ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 800_000 }),
                    ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 800_000 }),
                ],
                cumulDebut: [
                    ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 500_000 }),
                    ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 500_000 }),
                ],
            });
            const er = await s.tableauEmploisRessources('t1', 'e1');
            expect(er.controle.boucle).toBe(true);
            expect(er.controle.cumulFin.boucle).toBe(true);
            expect(er.controle.cumulDebut.boucle).toBe(true);
        });
    });
});
describe('Emplois-ressources · la dette concernée, jamais un prorata (B4)', () => {
    const C10_2026 = [
        ligne('60110000', client_1.ClasseCompte.CLASSE_6, { debit: 2_000_000 }),
        ligne('61810000', client_1.ClasseCompte.CLASSE_6, { debit: 400_000 }),
        ligne('63270000', client_1.ClasseCompte.CLASSE_6, { debit: 1_000_000 }),
        ligne('40110000', client_1.ClasseCompte.CLASSE_4, { debit: 1_500_000, credit: 2_000_000 }),
        ligne('46200000', client_1.ClasseCompte.CLASSE_4, { credit: 3_400_000 }),
        ligne('52110000', client_1.ClasseCompte.CLASSE_5, { debit: 3_400_000, credit: 2_900_000 }),
    ];
    const avec = (s, fin, debut = new Map()) => jest.spyOn(s, 'dettesRattacheesDesColonnes').mockResolvedValue({
        exercice: new Map([['401::', { debut: { parRef: debut, nonRattache: 0 }, fin: { parRef: fin, nonRattache: 0 } }]]),
        cumulFin: new Map([['401::', { fin: { parRef: fin, nonRattache: 0 } }]]),
        cumulDebut: new Map([['401::', { fin: undefined }]]),
    });
    it('C10, 2026 · la facture B de fournitures due au 31 décembre ne diminue que les achats', async () => {
        const s = service(C10_2026);
        avec(s, new Map([['FM', 500_000]]));
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect([poste(er, 'FM').montant, poste(er, 'FN').montant, poste(er, 'FO').montant]).toEqual([1_500_000, 400_000, 1_000_000]);
        expect(er.avertissements.some((a) => a.includes('ne se rattache à aucune facture'))).toBe(false);
        expect(er.controle.boucle).toBe(true);
    });
    it('la part non rattachée seule se répartit au prorata du brut, et elle est NOMMÉE', async () => {
        const s = service(C10_2026);
        avec(s, new Map([['FM', 300_000]]));
        const er = await s.tableauEmploisRessources('t1', 'e1');
        const fm = poste(er, 'FM');
        expect(fm.correctionNonRattachee).toBeCloseTo((-200_000 * 2_000_000) / 3_400_000, 2);
        expect(fm.montant).toBeCloseTo(2_000_000 - 300_000 - (200_000 * 2_000_000) / 3_400_000, 2);
        expect(er.avertissements.find((a) => a.includes('ne se rattache à aucune facture'))).toContain('-200000.00');
        const total = ['FM', 'FN', 'FO'].reduce((t, r) => t + poste(er, r).montant, 0);
        expect(total).toBeCloseTo(2_900_000, 2);
    });
    it('une dette qui passe d’un poste à l’autre corrige les deux, même à variation totale nulle', async () => {
        const s = service([
            ligne('60110000', client_1.ClasseCompte.CLASSE_6, { debit: 1_000 }),
            ligne('61810000', client_1.ClasseCompte.CLASSE_6, { debit: 1_000 }),
            ligne('40110000', client_1.ClasseCompte.CLASSE_4, { debit: 1_000, credit: 1_000 }, { credit: 100 }),
            ligne('52110000', client_1.ClasseCompte.CLASSE_5, { credit: 1_000 }, { debit: 5_000 }),
        ]);
        avec(s, new Map([['FN', 100]]), new Map([['FM', 100]]));
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FM').montant).toBe(1_100);
        expect(poste(er, 'FN').montant).toBe(900);
    });
    it('sans pièce lisible, la colonne garde l’ancien prorata et le dit', async () => {
        const s = service(C10_2026);
        avec(s, new Map());
        const er = await s.tableauEmploisRessources('t1', 'e1');
        expect(poste(er, 'FM').montant).toBeCloseTo(2_000_000 - (500_000 * 2_000_000) / 3_400_000, 2);
        expect(er.avertissements.some((a) => a.includes('FM, FN, FO'))).toBe(true);
    });
});
//# sourceMappingURL=emplois-ressources.spec.js.map
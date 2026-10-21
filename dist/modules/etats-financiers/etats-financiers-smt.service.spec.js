"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_smt_service_1 = require("./etats-financiers-smt.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const dettesRattachees = require("./dettes-rattachees");
const virement_resultat_non_affecte_1 = require("../exercice/virement-resultat-non-affecte");
beforeEach(() => {
    jest.spyOn(dettesRattachees, 'dettesFournisseursNeesDImmobilisations').mockResolvedValue({ ouverture: 0, cloture: 0 });
});
function ligne(numero, classe, totalDebit, totalCredit, report = {}) {
    const reportDebit = report.debit ?? 0;
    const reportCredit = report.credit ?? 0;
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        totalDebit,
        totalCredit,
        reportDebit,
        reportCredit,
        mouvementDebit: totalDebit - reportDebit,
        mouvementCredit: totalCredit - reportCredit,
        solde: totalDebit - totalCredit,
    };
}
function ligneTiers(numero, montant, echeance, lettre = null, regleApresCloture = false, statut = 'VALIDEE') {
    return {
        compteId: `id-${numero}`,
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateEcheance: echeance ? new Date(echeance) : null,
        lettre,
        regleApresCloture,
        statut,
    };
}
let rangDeSaisie = 0;
function ecriture(id, date, libelle, lignes, options = {}) {
    rangDeSaisie += 1;
    return {
        id,
        exerciceId: 'e1',
        statut: options.statut ?? 'VALIDEE',
        date: new Date(date),
        createdAt: new Date(Date.UTC(2026, 0, 1) + rangDeSaisie * 1000),
        libelle,
        reference: null,
        estGenereeParCloture: options.estGenereeParCloture ?? false,
        lignes: lignes.map((l, i) => ({
            id: `${id}-${i}`,
            compteId: `id-${l.numero}`,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            compte: { numero: l.numero, intitule: `Compte ${l.numero}` },
        })),
    };
}
function service(lignesParExercice, options = {}) {
    const ecritureService = {
        balance: jest.fn().mockImplementation((_t, exerciceId, _inclureBrouillard, _arreteAu, opts) => {
            const lignes = (opts?.avantLaCloture ? options.ouvertures?.[exerciceId] : undefined) ?? lignesParExercice[exerciceId] ?? [];
            return Promise.resolve({ lignes, totaux: { debit: 0, credit: 0 } });
        }),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    };
    const exercicesDuDossier = options.exercices ?? Object.keys(lignesParExercice).map((id) => ({ id, dateDebut: new Date('2026-01-01') }));
    const exerciceService = {
        lister: jest
            .fn()
            .mockImplementation((tenantId) => Promise.resolve(tenantId === 't1'
            ? [...exercicesDuDossier].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())
            : [])),
    };
    const prisma = {
        ecriture: {
            findMany: jest.fn().mockImplementation((args) => {
                appelsEcritures += 1;
                if (appelsEcritures > 1000)
                    throw new Error('La lecture des écritures ne s’arrête pas.');
                return Promise.resolve(lireEcritures(options.ecritures ?? [], args));
            }),
        },
        immobilisation: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve((options.immobilisations ?? []).filter((i) => {
                if (where.tenantId !== undefined && (i.tenantId ?? 't1') !== where.tenantId)
                    return false;
                if (where.dateAcquisition?.lte && !(i.dateAcquisition <= where.dateAcquisition.lte))
                    return false;
                if (where.OR) {
                    const retenu = where.OR.some((o) => o.dateSortie === null ? i.dateSortie === null : i.dateSortie !== null && i.dateSortie >= o.dateSortie.gte);
                    if (!retenu)
                        return false;
                }
                return true;
            }))),
        },
        campagneInventaire: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(options.campagne && where.tenantId === 't1' && where.exerciceId === (options.campagneExerciceId ?? 'e1') &&
                where.fiches?.some?.compte?.classe === 'CLASSE_3'
                ? options.campagne
                : null)),
        },
        tiersCompte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve((options.tiersComptes ?? []).filter((t) => (where?.compteId?.in ? where.compteId.in.includes(t.compteId) : true)))),
        },
        ligneEcriture: {
            groupBy: jest.fn().mockImplementation(({ where, }) => {
                const retenues = (options.lignesTiers ?? []).filter((l) => {
                    if (where.ecriture?.statut !== undefined && l.statut !== where.ecriture.statut)
                        return false;
                    const ouverte = where.lettre === null ? l.lettre === null : where.OR ? l.lettre === null || l.regleApresCloture : true;
                    if (!ouverte)
                        return false;
                    const e = where.dateEcheance;
                    if (e === undefined)
                        return true;
                    if (!l.dateEcheance)
                        return false;
                    if (e.gt !== undefined && !(l.dateEcheance > e.gt))
                        return false;
                    if (e.lte !== undefined && !(l.dateEcheance <= e.lte))
                        return false;
                    return true;
                });
                const parCompte = new Map();
                for (const l of retenues) {
                    const g = parCompte.get(l.compteId) ?? { compteId: l.compteId, _sum: { debit: 0, credit: 0 } };
                    g._sum.debit += l.debit;
                    g._sum.credit += l.credit;
                    parCompte.set(l.compteId, g);
                }
                return Promise.resolve([...parCompte.values()]);
            }),
            findMany: jest.fn().mockImplementation(({ where }) => {
                if (!where.id?.in)
                    throw new Error('doublure : lecture de lignes non honorée');
                return Promise.resolve(where.id.in.map((id) => ({ id, lettrageId: null })));
            }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ devise: 'devise' in options ? options.devise : 'CDF' }),
        },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                if (where.id !== undefined) {
                    const connu = where.tenantId === 't1' && exercicesDuDossier.some((e) => e.id === where.id);
                    return Promise.resolve(connu ? { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') } : null);
                }
                return Promise.resolve(options.exercicePrecedent ?? null);
            }),
        },
    };
    let appelsEcritures = 0;
    return new etats_financiers_smt_service_1.EtatsFinanciersSmtService(ecritureService, exerciceService, prisma);
}
function compteRetenu(numero, f) {
    if (!f)
        return true;
    if (f.numero?.startsWith !== undefined && !numero.startsWith(f.numero.startsWith))
        return false;
    if (f.NOT && compteRetenu(numero, f.NOT))
        return false;
    if (f.OR && !f.OR.some((g) => compteRetenu(numero, g)))
        return false;
    if (f.AND && !f.AND.every((g) => compteRetenu(numero, g)))
        return false;
    return true;
}
function lireEcritures(ecritures, args) {
    const w = args.where;
    let r = ecritures.filter((e) => (w.tenantId === undefined || w.tenantId === 't1') &&
        (w.exerciceId === undefined || e.exerciceId === w.exerciceId) &&
        (w.statut === undefined || e.statut === w.statut) &&
        (w.estGenereeParCloture === undefined || e.estGenereeParCloture === w.estGenereeParCloture) &&
        (w.lignes?.some === undefined || e.lignes.some((l) => compteRetenu(l.compte.numero, w.lignes.some.compte))));
    if (args.orderBy?.id === 'asc')
        r = [...r].sort((a, b) => a.id.localeCompare(b.id));
    if (args.cursor) {
        const i = r.findIndex((e) => e.id === args.cursor.id);
        r = r.slice(i + (args.skip ?? 0));
    }
    if (args.take !== undefined)
        r = r.slice(0, args.take);
    return r;
}
function prismaDe(s) {
    return s
        .prisma;
}
function poste(etat, ref) {
    return [...etat.actif, ...etat.passif].find((p) => p.ref === ref);
}
describe('Bilan S.M.T', () => {
    it('GA porte la classe 2 en valeur NETTE : la maquette n’a qu’une colonne de montant', async () => {
        const s = service({
            e1: [
                ligne('24100000', client_1.ClasseCompte.CLASSE_2, 10000, 0),
                ligne('28410000', client_1.ClasseCompte.CLASSE_2, 0, 4000),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'GA').montant).toBe(6000);
    });
    it('GD est la caisse (57) et GE tout le reste de la classe 5', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 3000, 500),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 9000, 1000),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'GD').montant).toBe(2500);
        expect(poste(bilan, 'GE').montant).toBe(8000);
    });
    it('GE accepte un solde NÉGATIF : « Banque (en + ou en -) », ce jeu n’a pas de trésorerie-passif', async () => {
        const s = service({ e1: [ligne('56100000', client_1.ClasseCompte.CLASSE_5, 0, 2000)] });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'GE').montant).toBe(-2000);
    });
    it('la classe 4 se partage par le SENS du solde entre GC (débiteurs) et HD (créditeurs)', async () => {
        const s = service({
            e1: [
                ligne('41100000', client_1.ClasseCompte.CLASSE_4, 5000, 1000),
                ligne('40100000', client_1.ClasseCompte.CLASSE_4, 500, 3500),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'GC').montant).toBe(4000);
        expect(poste(bilan, 'HD').montant).toBe(3000);
    });
    it('HB vient des classes 6/7/8 avant clôture, du compte 13 après · jamais des deux', async () => {
        const avant = service({
            e1: [ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 9000), ligne('60100000', client_1.ClasseCompte.CLASSE_6, 4000, 0)],
        });
        expect(poste(await avant.bilan('t1', 'e1'), 'HB').montant).toBe(5000);
        const apres = service({ e1: [ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 5000)] });
        expect(poste(await apres.bilan('t1', 'e1'), 'HB').montant).toBe(5000);
    });
    it('HC accueille le compte 18 · réserve assumée et VISIBLE dans le drill-down', async () => {
        const s = service({ e1: [ligne('18100000', client_1.ClasseCompte.CLASSE_1, 0, 7000)] });
        const hc = poste(await s.bilan('t1', 'e1'), 'HC');
        expect(hc.montant).toBe(7000);
        expect(hc.comptes.map((c) => c.numero)).toContain('18100000');
    });
    it('le bilan boucle : GZ = HZ sur un dossier équilibré', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 9000, 4000),
                ligne('41100000', client_1.ClasseCompte.CLASSE_4, 2000, 0),
                ligne('10100000', client_1.ClasseCompte.CLASSE_1, 0, 3000),
                ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 1000),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 7000),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 4000, 0),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(bilan.totalActif).toBe(7000);
        expect(bilan.totalPassif).toBe(7000);
        expect(bilan.equilibre).toBe(true);
    });
    it('porte les renvois de note de la maquette (GA → 1, GD et GE → 4, HA → 5)', async () => {
        const bilan = await service({ e1: [] }).bilan('t1', 'e1');
        expect(poste(bilan, 'GA').note).toBe('1');
        expect(poste(bilan, 'GD').note).toBe('4');
        expect(poste(bilan, 'GE').note).toBe('4');
        expect(poste(bilan, 'HA').note).toBe('5');
    });
    it('un 130 va à HC, le bilan boucle, et HB reste le résultat du compte de résultat', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 14000, 4000, { debit: 5000 }),
                ligne('10100000', client_1.ClasseCompte.CLASSE_1, 0, 3000, { credit: 3000 }),
                ligne('13010000', client_1.ClasseCompte.CLASSE_1, 0, 2000, { credit: 2000 }),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 9000),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 4000, 0),
            ],
        }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 9000 },
                    { numero: '70100000', credit: 9000 },
                ]),
                ecriture('b', '2026-04-01', 'Achat de fournitures', [
                    { numero: '60100000', debit: 4000 },
                    { numero: '57100000', credit: 4000 },
                ]),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'HC').montant).toBe(2000);
        expect(poste(bilan, 'HC').comptes.map((c) => c.numero)).toEqual(['13010000']);
        expect(poste(bilan, 'HB').montant).toBe(5000);
        expect(bilan.totalActif).toBe(10000);
        expect(bilan.totalPassif).toBe(10000);
        expect(bilan.equilibre).toBe(true);
        expect(bilan.controle).toEqual({
            resultatClasses678: 5000,
            resultatCompte13: 0,
            resultatAnterieurNonAffecte: 0,
            compte13LuHorsDuResultat: 2000,
        });
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)(bilan, 2000)).toBe(0);
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.resultatNet).toBe(5000);
        expect(cr.controle.resultatBilan).toBe(poste(bilan, 'HB').montant);
        expect(cr.controle.concordant).toBe(true);
    });
    it('B1 · un résultat N-1 encore au 131 pendant que les classes 6 à 8 portent N va à HB avec lui · le bilan s\'équilibre', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 14000, 4000, { debit: 5000 }),
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 5000, { credit: 5000 }),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 9000),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 4000, 0),
            ],
        }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 9000 },
                    { numero: '70100000', credit: 9000 },
                ]),
                ecriture('b', '2026-04-01', 'Achat de fournitures', [
                    { numero: '60100000', debit: 4000 },
                    { numero: '57100000', credit: 4000 },
                ]),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'HB').montant).toBe(10000);
        expect(poste(bilan, 'HC').montant).toBe(0);
        expect(bilan.totalActif).toBe(10000);
        expect(bilan.totalPassif).toBe(10000);
        expect(bilan.equilibre).toBe(true);
        expect(bilan.controle).toEqual({ resultatClasses678: 5000, resultatCompte13: 5000, resultatAnterieurNonAffecte: 5000, compte13LuHorsDuResultat: 0 });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.resultatNet).toBe(5000);
        expect(cr.controle.resultatBilan).toBe(5000);
        expect(cr.controle.concordant).toBe(true);
    });
    it('MAJEUR (relecture V1) · cotisations et achats égaux, déficit antérieur au 139 · KZC = 0 concorde avec la part de l\'exercice de HB', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1_700_000, 1_000_000, { debit: 700_000 }),
                ligne('10100000', client_1.ClasseCompte.CLASSE_1, 0, 1_000_000, { credit: 1_000_000 }),
                ligne('13900000', client_1.ClasseCompte.CLASSE_1, 300_000, 0, { debit: 300_000 }),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1_000_000),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 1_000_000, 0),
            ],
        }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 1_000_000 },
                    { numero: '70100000', credit: 1_000_000 },
                ]),
                ecriture('b', '2026-04-01', 'Achat de fournitures', [
                    { numero: '60100000', debit: 1_000_000 },
                    { numero: '57100000', credit: 1_000_000 },
                ]),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'HB').montant).toBe(-300_000);
        expect(bilan.equilibre).toBe(true);
        expect(bilan.controle.resultatAnterieurNonAffecte).toBe(-300_000);
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.resultatBilan).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
});
const BALANCE_CAISSE = [
    ligne('57100000', client_1.ClasseCompte.CLASSE_5, 9000, 4000),
    ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 9000),
    ligne('60100000', client_1.ClasseCompte.CLASSE_6, 4000, 0),
];
describe('Compte de résultat S.M.T', () => {
    it('lit les recettes et les dépenses dans les MOUVEMENTS de trésorerie, pas dans les soldes 6/7', async () => {
        const s = service({ e1: BALANCE_CAISSE }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 9000 },
                    { numero: '70100000', credit: 9000 },
                ]),
                ecriture('b', '2026-04-01', 'Achat de fournitures', [
                    { numero: '60100000', debit: 4000 },
                    { numero: '57100000', credit: 4000 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.recettes.find((p) => p.ref === 'KA').montant).toBe(9000);
        expect(cr.depenses.find((p) => p.ref === 'JA').montant).toBe(4000);
        expect(cr.soldeCaisse).toBe(5000);
    });
    it('un virement caisse vers banque n’est NI une recette NI une dépense', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 0, 2000),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 2000, 0),
            ],
        }, {
            ecritures: [
                ecriture('v', '2026-05-01', 'Versement en banque', [
                    { numero: '52100000', debit: 2000 },
                    { numero: '57100000', credit: 2000 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalRecettes).toBe(0);
        expect(cr.totalDepenses).toBe(0);
    });
    it('l’écriture de report à nouveau ne devient pas une recette de l’exercice', async () => {
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, 6000, 0, { debit: 6000 })] }, {
            ecritures: [
                ecriture('ran', '2026-01-01', 'Report à nouveau', [
                    { numero: '57100000', debit: 6000 },
                    { numero: '12100000', credit: 6000 },
                ], { estGenereeParCloture: true }),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalRecettes).toBe(0);
    });
    it('KZC retrouve le résultat d’engagement d’un dossier tenu en engagement (VC rétablit la dette)', async () => {
        const exercices = [
            { id: 'e0', dateDebut: new Date('2025-01-01') },
            { id: 'e1', dateDebut: new Date('2026-01-01') },
        ];
        const s = service({
            e0: [],
            e1: [
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 1000, 0),
                ligne('40100000', client_1.ClasseCompte.CLASSE_4, 600, 1000),
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 0, 600),
            ],
        }, {
            exercices,
            ecritures: [
                ecriture('f', '2026-02-01', 'Facture fournisseur', [
                    { numero: '60100000', debit: 1000 },
                    { numero: '40100000', credit: 1000 },
                ]),
                ecriture('r', '2026-03-01', 'Règlement partiel', [
                    { numero: '40100000', debit: 600 },
                    { numero: '57100000', credit: 600 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.depenses.find((p) => p.ref === 'JF').montant).toBe(600);
        expect(cr.soldeCaisse).toBe(-600);
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(400);
        expect(cr.resultatNet).toBe(-1000);
        expect(cr.controle.concordant).toBe(true);
    });
    it('la dette du 401 née d’une immobilisation sort de VC, comme le 481 · facture encore due à la clôture', async () => {
        const exercices = [
            { id: 'e0', dateDebut: new Date('2025-01-01') },
            { id: 'e1', dateDebut: new Date('2026-01-01') },
        ];
        const s = service({ e0: [], e1: [ligne('24410000', client_1.ClasseCompte.CLASSE_2, 600, 0), ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 600)] }, { exercices, ecritures: [] });
        const espion = jest.spyOn(dettesRattachees, 'dettesFournisseursNeesDImmobilisations').mockResolvedValue({ ouverture: 0, cloture: 600 });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(0);
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.concordant).toBe(true);
        expect(espion).toHaveBeenCalledWith(expect.anything(), 't1', expect.objectContaining({ id: 'e1' }), expect.objectContaining({ comptes: ['40'] }));
    });
    it('les dotations aux amortissements (68) sont retranchées et ne sont jamais un décaissement', async () => {
        const exercices = [
            { id: 'e0', dateDebut: new Date('2025-01-01') },
            { id: 'e1', dateDebut: new Date('2026-01-01') },
        ];
        const s = service({
            e0: [],
            e1: [
                ...BALANCE_CAISSE,
                ligne('68100000', client_1.ClasseCompte.CLASSE_6, 1500, 0),
                ligne('28410000', client_1.ClasseCompte.CLASSE_2, 0, 1500),
            ],
        }, {
            exercices,
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 9000 },
                    { numero: '70100000', credit: 9000 },
                ]),
                ecriture('b', '2026-04-01', 'Achat', [
                    { numero: '60100000', debit: 4000 },
                    { numero: '57100000', credit: 4000 },
                ]),
                ecriture('d', '2026-12-31', 'Dotation aux amortissements', [
                    { numero: '68100000', debit: 1500 },
                    { numero: '28410000', credit: 1500 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalDepenses).toBe(4000);
        expect(cr.retraitements.find((r) => r.ref === 'JG').montant).toBe(1500);
        expect(cr.resultatNet).toBe(3500);
        expect(cr.controle.concordant).toBe(true);
    });
    it('les variations VA/VB/VC se mesurent contre l’OUVERTURE de l’exercice, pas contre l’exercice N-1 du logiciel', async () => {
        const s = service({ e1: [ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 250, { credit: 100 })] }, { ecritures: [] });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(150);
    });
    it('isole les flux qui ne sont NI produit NI charge, hors de KX, JX et KZC, et le contrôle concorde sans rien retrancher (constat B2)', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 500, 600),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 500),
                ligne('24110000', client_1.ClasseCompte.CLASSE_2, 600, 0),
            ],
        }, {
            ecritures: [
                ecriture('d', '2026-01-10', 'Apport en dotation', [
                    { numero: '57100000', debit: 500 },
                    { numero: '10110000', credit: 500 },
                ]),
                ecriture('i', '2026-07-15', 'Achat de matériel', [
                    { numero: '24110000', debit: 600 },
                    { numero: '57100000', credit: 600 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.soldeCaisse).toBe(0);
        expect(cr.totalRecettes).toBe(0);
        expect(cr.totalDepenses).toBe(0);
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.fluxHorsExploitation).toBe(-100);
        expect(cr.controle.comptesHorsExploitation.map((c) => c.numero)).toEqual(['10110000', '24110000']);
        expect(cr.controle.resultatBilan).toBe(0);
        expect(cr.controle.ecart).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
});
describe('Note 4 · journal unique de trésorerie', () => {
    it('le virement interne EST dans le journal (livre de caisse), et le solde boucle avec la balance', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1000, 400),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 400, 0),
            ],
        }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 1000 },
                    { numero: '70100000', credit: 1000 },
                ]),
                ecriture('v', '2026-06-01', 'Versement en banque', [
                    { numero: '52100000', debit: 400 },
                    { numero: '57100000', credit: 400 },
                ]),
            ],
        });
        const { journaux } = await s.journalTresorerie('t1', 'e1');
        const caisse = journaux.find((j) => j.numero === '57100000');
        expect(caisse.operations).toHaveLength(2);
        expect(caisse.operations[1].virementInterne).toBe(true);
        expect(caisse.operations[1].depense).toBe(400);
        expect(Object.values(caisse.operations[1].ventilation).every((v) => v === 0)).toBe(true);
        expect(caisse.soldeAReporter).toBe(600);
        expect(caisse.soldeBalance).toBe(600);
        expect(caisse.boucle).toBe(true);
        const banque = journaux.find((j) => j.numero === '52100000');
        expect(banque.operations[0].recette).toBe(400);
        expect(banque.boucle).toBe(true);
    });
    it('ouvre un journal PAR compte de trésorerie, du report à nouveau au solde à reporter', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1200, 0, { debit: 200 }),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 500, 0, { debit: 500 }),
            ],
        }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations', [
                    { numero: '57100000', debit: 1000 },
                    { numero: '70100000', credit: 1000 },
                ]),
            ],
        });
        const { journaux } = await s.journalTresorerie('t1', 'e1');
        expect(journaux.map((j) => j.numero)).toEqual(['52100000', '57100000']);
        const caisse = journaux.find((j) => j.numero === '57100000');
        expect(caisse.reportANouveau).toBe(200);
        expect(caisse.operations).toHaveLength(1);
        expect(caisse.soldeAReporter).toBe(1200);
        expect(journaux.find((j) => j.numero === '52100000').operations).toHaveLength(0);
    });
    it('ventile la recette dans la colonne officielle « Cotisations » (compte 701)', async () => {
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1000, 0)] }, {
            ecritures: [
                ecriture('a', '2026-03-01', 'Cotisations 2026', [
                    { numero: '57100000', debit: 1000 },
                    { numero: '70100000', credit: 1000 },
                ]),
            ],
        });
        const { journaux, colonnesRecettes } = await s.journalTresorerie('t1', 'e1');
        expect(colonnesRecettes.map((c) => c.libelle)).toEqual([
            'Cotisations',
            'Subventions',
            'Autres',
            'Matériel, mobilier et autres',
        ]);
        expect(journaux[0].operations[0].ventilation.cotisations).toBe(1000);
    });
    it('une écriture touchant DEUX comptes de trésorerie est comptée mais laissée hors ventilation, et signalée', async () => {
        const s = service({
            e1: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 300, 0),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 700, 0),
            ],
        }, {
            ecritures: [
                ecriture('m', '2026-06-01', 'Quête répartie caisse et banque', [
                    { numero: '57100000', debit: 300 },
                    { numero: '52100000', debit: 700 },
                    { numero: '70400000', credit: 1000 },
                ]),
            ],
        });
        const { journaux } = await s.journalTresorerie('t1', 'e1');
        const caisse = journaux.find((j) => j.numero === '57100000');
        expect(caisse.operations[0].recette).toBe(300);
        expect(caisse.operations[0].ventile).toBe(false);
        expect(caisse.lignesNonVentilees).toBe(1);
    });
});
describe('Lecture des écritures de trésorerie et plafond de la NOTE 4 (jumeau de F258)', () => {
    const recette = (id, montant, date = '2026-03-01') => ecriture(id, date, `Cotisation ${id}`, [
        { numero: '57100000', debit: montant },
        { numero: '70100000', credit: montant },
    ]);
    it('ne demande que les écritures validées, hors clôture, qui portent une ligne de la classe 5 hors 59', async () => {
        const s = service({ e1: BALANCE_CAISSE }, { ecritures: [recette('a', 1000)] });
        await s.compteDeResultat('t1', 'e1');
        const { where } = prismaDe(s).ecriture.findMany.mock.calls[0][0];
        expect(where).toMatchObject({ tenantId: 't1', exerciceId: 'e1', statut: 'VALIDEE', estGenereeParCloture: false });
        const filtre = where.lignes?.some?.compte;
        expect(filtre).toBeDefined();
        expect(['57100000', '52100000', '50100000', '58500000'].map((n) => compteRetenu(n, filtre))).toEqual([
            true,
            true,
            true,
            true,
        ]);
        expect(['59100000', '59400000', '41100000', '70100000', '12100000'].map((n) => compteRetenu(n, filtre))).toEqual([
            false,
            false,
            false,
            false,
            false,
        ]);
    });
    it('ne rapatrie ni l’écriture entière ni les comptes entiers : une sélection, jamais un `include`', async () => {
        const s = service({ e1: BALANCE_CAISSE }, { ecritures: [recette('a', 1000)] });
        await s.journalTresorerie('t1', 'e1');
        const args = prismaDe(s).ecriture.findMany.mock.calls[0][0];
        expect(args.include).toBeUndefined();
        const lignes = args.select.lignes.select;
        expect(lignes.compte).toEqual({ select: { numero: true, intitule: true } });
    });
    it('lit par tranches de LOT_ECRITURES, curseur sur l’identifiant, sans perdre ni compter deux fois', async () => {
        const n = lecture_par_lots_1.LOT_ECRITURES * 2 + 3;
        const ecritures = Array.from({ length: n }, (_, i) => recette(`r${String(i).padStart(5, '0')}`, 10));
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, n * 10, 0)] }, { ecritures });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalRecettes).toBe(n * 10);
        const appels = prismaDe(s).ecriture.findMany.mock.calls.map((c) => c[0]);
        expect(appels).toHaveLength(3);
        for (const a of appels) {
            expect(a.take).toBe(lecture_par_lots_1.LOT_ECRITURES);
            expect(a.orderBy).toEqual({ id: 'asc' });
        }
        expect(appels[0].cursor).toBeUndefined();
        expect(appels[1].cursor).toEqual({ id: `r${String(lecture_par_lots_1.LOT_ECRITURES - 1).padStart(5, '0')}` });
        expect(appels[1].skip).toBe(1);
    });
    it('remet le journal dans l’ordre du livre (date, puis saisie), quel que soit l’ordre des identifiants', async () => {
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, 600, 0)] }, {
            ecritures: [
                recette('z', 100, '2026-02-01'),
                recette('y', 200, '2026-05-01'),
                recette('x', 300, '2026-05-01'),
            ],
        });
        const { journaux } = await s.journalTresorerie('t1', 'e1');
        expect(journaux[0].operations.map((o) => o.recette)).toEqual([100, 200, 300]);
        expect(journaux[0].operations.map((o) => o.solde)).toEqual([100, 300, 600]);
    });
    it('le plafond de la NOTE 4 est celui du grand livre complet', () => {
        expect(etats_financiers_smt_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL).toBe(ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE);
    });
    it('au-delà du plafond, la NOTE 4 se REFUSE en nommant le grand livre, et la lecture s’arrête au plafond', async () => {
        const n = etats_financiers_smt_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL + lecture_par_lots_1.LOT_ECRITURES * 3;
        const ecritures = Array.from({ length: n }, (_, i) => recette(`p${String(i).padStart(6, '0')}`, 1));
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, n, 0)] }, { ecritures });
        const refus = s.journalTresorerie('t1', 'e1');
        await expect(refus).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(refus).rejects.toThrow(/grand livre de chaque compte de trésorerie/);
        expect(prismaDe(s).ecriture.findMany.mock.calls).toHaveLength(Math.ceil((etats_financiers_smt_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL + 1) / lecture_par_lots_1.LOT_ECRITURES));
    });
    it('au plafond exactement, la NOTE 4 est rendue en entier', async () => {
        const n = etats_financiers_smt_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL;
        const ecritures = Array.from({ length: n }, (_, i) => recette(`q${String(i).padStart(6, '0')}`, 1));
        const s = service({ e1: [ligne('57100000', client_1.ClasseCompte.CLASSE_5, n, 0)] }, { ecritures });
        const { journaux } = await s.journalTresorerie('t1', 'e1');
        expect(journaux[0].operations).toHaveLength(n);
        expect(journaux[0].boucle).toBe(true);
    });
    it('les parts de la Note 3 sont deux sommes demandées à la base, bornées à la clôture', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 9000, 0)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 5000 }, '2026-06-30'),
                ligneTiers('41100000', { debit: 4000 }, '2027-03-31'),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantEchu).toBe(5000);
        expect(note.creances[0].montantNonEchu).toBe(4000);
        const appels = prismaDe(s)
            .ligneEcriture.groupBy.mock.calls.map((c) => c[0])
            .filter((a) => a.by[0] !== 'lettrageId');
        expect(appels).toHaveLength(2);
        for (const a of appels)
            expect(a.by).toEqual(['compteId']);
        const dateFin = new Date('2026-12-31');
        expect(appels.map((a) => a.where.dateEcheance)).toEqual(expect.arrayContaining([{ gt: dateFin }, { lte: dateFin }]));
    });
});
describe('Notes annexes S.M.T', () => {
    it('Note 2 · sans campagne d’inventaire, laisse les quantités vides et dit où les servir', async () => {
        const s = service({ e1: [ligne('31100000', client_1.ClasseCompte.CLASSE_3, 4000, 1000, { debit: 1000 })] });
        const note = await s.note2Stocks('t1', 'e1');
        expect(note.lignes[0].quantite).toBeNull();
        expect(note.lignes[0].prixUnitaire).toBeNull();
        expect(note.quantitesTenues).toBe(false);
        expect(note.sourceQuantites).toBeNull();
        expect(note.motifQuantites).toContain("Aucune campagne d'inventaire n'est enregistrée pour cet exercice");
        expect(note.valeurStockFinal).toBe(3000);
        expect(note.valeurStockInitial).toBe(1000);
    });
    it('Note 2 · sert quantité et prix unitaire depuis la campagne quand ses fiches font le solde (audit final F85)', async () => {
        const s = service({ e1: [ligne('31100000', client_1.ClasseCompte.CLASSE_3, 4000, 1000, { debit: 1000 })] }, {
            campagne: {
                libelle: 'Inventaire de clôture',
                dateInventaire: new Date('2026-12-31T00:00:00Z'),
                fiches: [
                    { designation: 'Riz', uniteMesure: 'kg', quantiteComptee: 200, valeurInventaire: 2000, compte: { numero: '31100000' } },
                    { designation: 'Huile', uniteMesure: null, quantiteComptee: 40, valeurInventaire: 1000, compte: { numero: '31100000' } },
                ],
            },
        });
        const note = await s.note2Stocks('t1', 'e1');
        expect(note.lignes).toEqual([
            { reference: '31100000', designation: 'Riz (kg)', quantite: 200, prixUnitaire: 10, montant: 2000 },
            { reference: '31100000', designation: 'Huile', quantite: 40, prixUnitaire: 25, montant: 1000 },
        ]);
        expect(note.quantitesTenues).toBe(true);
        expect(note.sourceQuantites).toContain('« Inventaire de clôture » du 31/12/2026');
        expect(note.lignes.reduce((t, l) => t + l.montant, 0)).toBe(note.valeurStockFinal);
    });
    it('Note 2 · un écart non régularisé garde la ligne du compte et le dit', async () => {
        const s = service({ e1: [ligne('31100000', client_1.ClasseCompte.CLASSE_3, 4000, 1000, { debit: 1000 })] }, {
            campagne: {
                libelle: 'Inventaire',
                dateInventaire: new Date('2026-12-31T00:00:00Z'),
                fiches: [{ designation: 'Riz', uniteMesure: 'kg', quantiteComptee: 200, valeurInventaire: 2500, compte: { numero: '31100000' } }],
            },
        });
        const note = await s.note2Stocks('t1', 'e1');
        expect(note.lignes).toEqual([
            { reference: '31100000', designation: expect.any(String), quantite: null, prixUnitaire: null, montant: 3000 },
        ]);
        expect(note.quantitesTenues).toBe(false);
        expect(note.motifQuantites).toContain('31100000, fiches à 2');
        expect(note.motifQuantites).toContain('écart non régularisé');
    });
    it('Note 2 · la campagne est cherchée dans CET exercice et parmi celles qui ont compté un stock', async () => {
        const campagne = {
            libelle: 'Inventaire',
            dateInventaire: new Date('2026-12-31T00:00:00Z'),
            fiches: [{ designation: 'Riz', uniteMesure: null, quantiteComptee: 1, valeurInventaire: 3000, compte: { numero: '31100000' } }],
        };
        const ailleurs = service({ e1: [ligne('31100000', client_1.ClasseCompte.CLASSE_3, 4000, 1000, { debit: 1000 })] }, { campagne, campagneExerciceId: 'e0' });
        expect((await ailleurs.note2Stocks('t1', 'e1')).sourceQuantites).toBeNull();
    });
    it('Note 3 · « Montant au 1er janvier N » est le report à nouveau, pas le solde de N-1', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 5000, 1000, { debit: 1500 })] }, { tiersComptes: [{ compteId: 'id-41100000', tiers: { nom: 'Mutuelle Kin' } }] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].nom).toBe('Mutuelle Kin');
        expect(note.creances[0].montantCloture).toBe(4000);
        expect(note.creances[0].montantOuverture).toBe(1500);
        expect(note.creances[0].variationValeur).toBe(2500);
    });
    it('Note 3 · une ouverture nulle donne une variation en % à `null`, pas un infini', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].variationPourcent).toBeNull();
    });
    it('Note 3 · une créance dont le terme est passé à la clôture est comptée ÉCHUE, pas non échue', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] }, { lignesTiers: [ligneTiers('41100000', { debit: 4000 }, '2026-11-30')] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantEchu).toBe(4000);
        expect(note.creances[0].montantNonEchu).toBe(0);
        expect(note.totalCreancesNonEchues).toBe(0);
        expect(note.totalCreancesEchues).toBe(4000);
        expect(note.creances[0].montantCloture).toBe(4000);
    });
    it('Note 3 · une ligne au BROUILLARD n’entre dans aucune part (paquet 1, B8 ; livre-journal seul)', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 4000 }, '2027-03-31'),
                ligneTiers('41100000', { debit: 1500 }, '2027-04-30', null, false, 'BROUILLARD'),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(4000);
        expect(note.creances[0].montantNonVentile).toBe(0);
        expect(note.echeancesTenues).toBe(true);
    });
    it('Note 3 · une créance à terme postérieur à la clôture est la seule à être dite non échue', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] }, { lignesTiers: [ligneTiers('41100000', { debit: 4000 }, '2027-03-31')] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(4000);
        expect(note.creances[0].montantEchu).toBe(0);
        expect(note.echeancesTenues).toBe(true);
        expect(note.motifEcheances).toBeNull();
    });
    it('Note 3 · une créance venue à terme LE JOUR de la clôture est échue, la borne est incluse', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] }, { lignesTiers: [ligneTiers('41100000', { debit: 4000 }, '2026-12-31')] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantEchu).toBe(4000);
        expect(note.creances[0].montantNonEchu).toBe(0);
    });
    it('Note 3 · une dette échue se lit en positif sous le total des dettes, comme le solde', async () => {
        const s = service({ e1: [ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 3000)] }, { lignesTiers: [ligneTiers('40100000', { credit: 3000 }, '2026-06-30')] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.dettes[0].montantCloture).toBe(3000);
        expect(note.dettes[0].montantEchu).toBe(3000);
        expect(note.totalDettesEchues).toBe(3000);
        expect(note.totalDettesNonEchues).toBe(0);
    });
    it('Note 3 · une ligne SANS échéance n’est rangée ni en échu ni en non échu : elle est nommée', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 4000, 0)] }, { lignesTiers: [ligneTiers('41100000', { debit: 4000 })] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonVentile).toBe(4000);
        expect(note.creances[0].montantNonEchu).toBe(0);
        expect(note.creances[0].montantEchu).toBe(0);
        expect(note.totalCreancesNonVentilees).toBe(4000);
        expect(note.echeancesTenues).toBe(false);
        expect(note.motifEcheances).toContain('non échues');
    });
    it('Note 3 · un dossier qui n’a jamais saisi d’échéance garde EXACTEMENT la note d’avant', async () => {
        const s = service({
            e1: [
                ligne('41100000', client_1.ClasseCompte.CLASSE_4, 5000, 1000, { debit: 1500 }),
                ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 3000),
            ],
        }, { tiersComptes: [{ compteId: 'id-41100000', tiers: { nom: 'Mutuelle Kin' } }] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantCloture).toBe(4000);
        expect(note.creances[0].montantOuverture).toBe(1500);
        expect(note.creances[0].variationValeur).toBe(2500);
        expect(note.totalCreances).toBe(4000);
        expect(note.totalDettes).toBe(3000);
        expect(note.totalCreancesNonEchues).toBe(0);
        expect(note.totalDettesNonEchues).toBe(0);
        expect(note.echeancesTenues).toBe(false);
    });
    it('Note 3 · une ligne soldée après la clôture reste dans la ventilation', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 9000, 0)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 5000 }, '2027-02-28', 'A1', true),
                ligneTiers('41100000', { debit: 4000 }, '2027-05-31'),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(9000);
    });
    it('Note 3 · une ligne lettrée est soldée et sort de la ventilation', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 9000, 5000)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 5000 }, '2026-05-31', 'A1'),
                ligneTiers('41100000', { credit: 5000 }, undefined, 'A1'),
                ligneTiers('41100000', { debit: 4000 }, '2027-05-31'),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(4000);
        expect(note.creances[0].montantEchu).toBe(0);
        expect(note.creances[0].montantNonVentile).toBe(0);
        expect(note.echeancesTenues).toBe(true);
    });
    it('Note 3 · les trois parts somment TOUJOURS au solde présenté, même quand la tenue est incohérente', async () => {
        const s = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 5000, 5000)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 5000 }, '2027-06-30'),
                ligneTiers('41100000', { credit: 5000 }),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances).toHaveLength(0);
        expect(note.dettes).toHaveLength(0);
        const s2 = service({ e1: [ligne('41100000', client_1.ClasseCompte.CLASSE_4, 5000, 2000)] }, {
            lignesTiers: [
                ligneTiers('41100000', { debit: 5000 }, '2027-06-30'),
                ligneTiers('41100000', { credit: 2000 }),
            ],
        });
        const note2 = await s2.note3CreancesDettes('t1', 'e1');
        const c = note2.creances[0];
        expect(c.montantCloture).toBe(3000);
        expect(c.montantNonEchu).toBe(5000);
        expect(c.montantEchu).toBe(0);
        expect(c.montantNonVentile).toBe(-2000);
        expect(c.montantNonEchu + c.montantEchu + c.montantNonVentile).toBe(c.montantCloture);
        expect(note2.echeancesTenues).toBe(false);
    });
    it('Note 5 · sert les trois rubriques officielles et déclare la nationalité non tenue', async () => {
        const s = service({
            e1: [
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 5000),
                ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 800),
                ligne('10410000', client_1.ClasseCompte.CLASSE_1, 0, 1200),
            ],
        });
        const note = await s.note5Dotation('t1', 'e1');
        expect(note.rubriques.map((r) => r.montant)).toEqual([5000, 800, 1200]);
        expect(note.total).toBe(7000);
        expect(note.nationaliteTenue).toBe(false);
    });
    it('la fiche récapitulative range la Note 4 du côté du compte de résultat, les quatre autres du bilan', async () => {
        const fiche = service({ e1: [] }).ficheNotes();
        expect(fiche.filter((n) => n.partie === 'BILAN').map((n) => n.numero)).toEqual([1, 2, 3, 5]);
        expect(fiche.filter((n) => n.partie === 'COMPTE_DE_RESULTAT').map((n) => n.numero)).toEqual([4]);
    });
});
describe('Éligibilité au S.M.T · article 6', () => {
    it('mesure les cinq catégories de ressources sans convertir le seuil en monnaie locale', async () => {
        const s = service({
            e1: [
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 12_000_000),
                ligne('70400000', client_1.ClasseCompte.CLASSE_7, 0, 3_000_000),
                ligne('71100000', client_1.ClasseCompte.CLASSE_7, 0, 8_000_000),
            ],
        }, { devise: 'CDF' });
        const e = await s.eligibilite('t1', 'e1');
        const par = (cle) => e.categories.find((c) => c.cle === cle).montant;
        expect(par('cotisationsRevenus')).toBe(12_000_000);
        expect(par('donsLegs')).toBe(3_000_000);
        expect(par('subventions')).toBe(8_000_000);
        expect(e.seuilParCategorieFcfa).toBe(30_000_000);
        expect(e.deviseDossier).toBe('CDF');
        expect(e.conversionAppliquee).toBe(false);
    });
    it('sert la monnaie du jeu légal quand le dossier n’a aucune devise posée (audit final F212)', async () => {
        const e = await service({ e1: [] }, { devise: null }).eligibilite('t1', 'e1');
        expect(e.deviseDossier).toBe('CDF');
    });
});
describe('Cumul biennal de l’article 6', () => {
    const cotisations = (montant) => [ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, montant)];
    it('additionne les ressources des deux exercices, catégorie par catégorie', async () => {
        const s = service({ e2026: cotisations(20_000_000), e2025: cotisations(15_000_000) }, { exercicePrecedent: { id: 'e2025', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') } });
        const r = await s.eligibilite('t1', 'e2026');
        const categorie = r.cumulBiennal.find((c) => c.cle === 'cotisationsRevenus');
        expect(categorie.exerciceCourant).toBe(20_000_000);
        expect(categorie.exercicePrecedent).toBe(15_000_000);
        expect(categorie.cumule).toBe(35_000_000);
        expect(categorie.cumule).toBeGreaterThan(r.seuilParCategorieFcfa);
    });
    it('sans exercice antérieur, le DIT au lieu de conclure sur un cumul incomplet', async () => {
        const r = await service({ e2026: cotisations(20_000_000) }).eligibilite('t1', 'e2026');
        expect(r.cumulBiennal).toBeNull();
        expect(r.exercicePrecedent).toBeNull();
        expect(r.avertissementCumul).toContain('ne peut pas être mesuré');
    });
    it('ne convertit toujours pas le seuil · la règle vaut aussi pour le cumul', async () => {
        const r = await service({ e2026: cotisations(1), e2025: cotisations(1) }, { exercicePrecedent: { id: 'e2025', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') } }).eligibilite('t1', 'e2026');
        expect(r.conversionAppliquee).toBe(false);
        expect(r.avertissementCumul).toContain('cumulée sur deux exercices');
    });
});
describe('Exercice introuvable · un refus, jamais un état à zéro (audit final F222)', () => {
    const ETATS = [
        'bilan',
        'compteDeResultat',
        'journalTresorerie',
        'note1Immobilisations',
        'note2Stocks',
        'note3CreancesDettes',
        'note5Dotation',
        'eligibilite',
    ];
    it.each(ETATS)('%s refuse un exercice inconnu du dossier', async (etat) => {
        const s = service({ e1: BALANCE_CAISSE });
        await expect(s[etat]('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it.each(ETATS)('%s refuse l’exercice d’un AUTRE dossier', async (etat) => {
        const s = service({ e1: BALANCE_CAISSE });
        await expect(s[etat]('t2', 'e1')).rejects.toThrow('Exercice introuvable dans ce dossier');
    });
});
describe('Compte de résultat S.M.T · une contrepartie de classe 3 n’est pas un flux hors exploitation', () => {
    it('un achat de stock payé (D 31 / C 57) est repris par VA, et le contrôle concorde', async () => {
        const s = service({
            e1: [ligne('31100000', client_1.ClasseCompte.CLASSE_3, 1000, 0), ligne('57100000', client_1.ClasseCompte.CLASSE_5, 0, 1000)],
        }, {
            ecritures: [
                ecriture('s', '2026-02-01', 'Achat de stock', [
                    { numero: '31100000', debit: 1000 },
                    { numero: '57100000', credit: 1000 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.depenses.find((p) => p.ref === 'JF').montant).toBe(1000);
        expect(cr.retraitements.find((r) => r.ref === 'VA').montant).toBe(1000);
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.fluxHorsExploitation).toBe(0);
        expect(cr.controle.comptesHorsExploitation).toEqual([]);
        expect(cr.controle.ecart).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
    it('une vente de stock encaissée (D 57 / C 31) concorde de même, dans l’autre sens', async () => {
        const s = service({
            e1: [
                ligne('31100000', client_1.ClasseCompte.CLASSE_3, 1000, 1000, { debit: 1000 }),
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1000, 0),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000, { credit: 1000 }),
            ],
        }, {
            ecritures: [
                ecriture('v', '2026-02-01', 'Cession de stock', [
                    { numero: '57100000', debit: 1000 },
                    { numero: '31100000', credit: 1000 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.recettes.find((p) => p.ref === 'KB').montant).toBe(1000);
        expect(cr.retraitements.find((r) => r.ref === 'VA').montant).toBe(-1000);
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.fluxHorsExploitation).toBe(0);
        expect(cr.controle.ecart).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
});
describe('Compte de résultat S.M.T · VC ne lit que les dettes d’exploitation (481 écarté)', () => {
    it('une immobilisation acquise à crédit (D 24 / C 4812) ne fait ni VC ni écart', async () => {
        const s = service({
            e1: [ligne('24110000', client_1.ClasseCompte.CLASSE_2, 5000, 0), ligne('48120000', client_1.ClasseCompte.CLASSE_4, 0, 5000)],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(0);
        expect(cr.retraitements.find((r) => r.ref === 'VC').comptes).toEqual([]);
        expect(cr.resultatNet).toBe(0);
        expect(cr.controle.concordant).toBe(true);
        expect(poste(await s.bilan('t1', 'e1'), 'HD').montant).toBe(5000);
    });
    it('son règlement l’exercice suivant (D 4812 / C 52) est un flux hors exploitation, et le contrôle concorde', async () => {
        const s = service({
            e1: [
                ligne('24110000', client_1.ClasseCompte.CLASSE_2, 5000, 0, { debit: 5000 }),
                ligne('48120000', client_1.ClasseCompte.CLASSE_4, 5000, 5000, { credit: 5000 }),
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 0, 5000),
            ],
        }, {
            ecritures: [
                ecriture('r', '2026-03-01', 'Règlement du fournisseur d’immobilisation', [
                    { numero: '48120000', debit: 5000 },
                    { numero: '52100000', credit: 5000 },
                ]),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.soldeCaisse).toBe(0);
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(0);
        expect(cr.controle.fluxHorsExploitation).toBe(-5000);
        expect(cr.controle.comptesHorsExploitation.map((c) => c.numero)).toEqual(['48120000']);
        expect(cr.controle.ecart).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
});
describe('Bilan S.M.T · les dépréciations de tiers (490 à 498) en déduction de GC', () => {
    const BALANCE_49 = [
        ligne('41110000', client_1.ClasseCompte.CLASSE_4, 1_000_000, 0),
        ligne('49120000', client_1.ClasseCompte.CLASSE_4, 0, 300_000),
        ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 200_000),
        ligne('49910000', client_1.ClasseCompte.CLASSE_4, 0, 50_000),
        ligne('65910000', client_1.ClasseCompte.CLASSE_6, 350_000, 0),
        ligne('60100000', client_1.ClasseCompte.CLASSE_6, 200_000, 0),
        ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1_000_000),
    ];
    it('GC est net de la dépréciation, HD ne porte que les dettes et le 499, et le bilan boucle', async () => {
        const bilan = await service({ e1: BALANCE_49 }).bilan('t1', 'e1');
        expect(poste(bilan, 'GC').montant).toBe(700_000);
        expect(poste(bilan, 'GC').comptes.map((c) => c.numero).sort()).toEqual(['41110000', '49120000']);
        expect(poste(bilan, 'HD').montant).toBe(250_000);
        expect(poste(bilan, 'HD').comptes.map((c) => c.numero).sort()).toEqual(['40110000', '49910000']);
        expect(bilan.equilibre).toBe(true);
    });
    it('la dotation passe par VB, pas par VC, et le résultat concorde', async () => {
        const cr = await service({ e1: BALANCE_49 }).compteDeResultat('t1', 'e1');
        expect(cr.retraitements.find((r) => r.ref === 'VB').montant).toBe(700_000);
        expect(cr.retraitements.find((r) => r.ref === 'VC').montant).toBe(250_000);
        expect(cr.resultatNet).toBe(450_000);
        expect(cr.controle.concordant).toBe(true);
    });
    it('la Note 3 sort la dépréciation du bloc des dettes et la porte en déduction des créances', async () => {
        const note = await service({ e1: BALANCE_49 }).note3CreancesDettes('t1', 'e1');
        expect(note.dettes.map((d) => d.numero)).toEqual(['40110000', '49910000']);
        expect(note.creances.map((c) => c.numero)).toEqual(['41110000']);
        expect(note.depreciationsCreances.map((d) => [d.numero, d.montantCloture])).toEqual([['49120000', -300_000]]);
        expect(note.totalCreancesNettes).toBe(700_000);
        expect(note.totalDettesNonVentilees).toBe(250_000);
    });
});
describe('Compte de résultat S.M.T · la colonne N-1 (art. 16, 7°)', () => {
    const exercices = [
        { id: 'e0', dateDebut: new Date('2025-01-01') },
        { id: 'e1', dateDebut: new Date('2026-01-01') },
    ];
    const ecrituresN1 = [
        {
            ...ecriture('n1', '2025-05-01', 'Cotisations 2025', [
                { numero: '57100000', debit: 3000 },
                { numero: '70100000', credit: 3000 },
            ]),
            exerciceId: 'e0',
        },
    ];
    const ecrituresN = [
        ecriture('a', '2026-03-01', 'Cotisations', [
            { numero: '57100000', debit: 9000 },
            { numero: '70100000', credit: 9000 },
        ]),
        ecriture('b', '2026-04-01', 'Achat', [
            { numero: '60100000', debit: 4000 },
            { numero: '57100000', credit: 4000 },
        ]),
    ];
    it('rend montantN1 sur chaque poste, chaque retraitement et chaque total quand l’exercice N-1 existe', async () => {
        const s = service({
            e0: [
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 3000, 0),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 3000),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 200, 0),
                ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 200),
            ],
            e1: BALANCE_CAISSE,
        }, { exercices, ecritures: [...ecrituresN1, ...ecrituresN] });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.exerciceN1Disponible).toBe(true);
        expect(cr.recettes.find((p) => p.ref === 'KA').montant).toBe(9000);
        expect(cr.recettes.find((p) => p.ref === 'KA').montantN1).toBe(3000);
        expect(cr.depenses.find((p) => p.ref === 'JA').montantN1).toBe(0);
        expect(cr.retraitements.find((r) => r.ref === 'VA').montantN1).toBe(0);
        expect(cr.retraitements.find((r) => r.ref === 'VC').montantN1).toBe(200);
        expect(cr.totalRecettesN1).toBe(3000);
        expect(cr.soldeCaisseN1).toBe(3000);
        expect(cr.resultatNetN1).toBe(2800);
    });
    it('sans exercice N-1, montantN1 reste undefined, jamais zéro', async () => {
        const cr = await service({ e1: BALANCE_CAISSE }, { ecritures: ecrituresN }).compteDeResultat('t1', 'e1');
        expect(cr.exerciceN1Disponible).toBe(false);
        expect(cr.recettes.find((p) => p.ref === 'KA').montantN1).toBeUndefined();
        expect(cr.retraitements.find((r) => r.ref === 'JG').montantN1).toBeUndefined();
        expect(cr.resultatNetN1).toBeUndefined();
    });
    it('chaque poste de flux porte le renvoi de note de la maquette (« 4 »)', async () => {
        const cr = await service({ e1: BALANCE_CAISSE }, { ecritures: ecrituresN }).compteDeResultat('t1', 'e1');
        expect([...cr.recettes, ...cr.depenses].map((p) => p.note)).toEqual(['4', '4', '4', '4', '4', '4', '4', '4']);
    });
});
describe('Note 5 · dotation, apporteurs et colonnes non tenues', () => {
    it('rappelle le 106 hors rubriques : TOTAL inchangé, TOTAL + hors rubriques = HA', async () => {
        const balance = [
            ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 5000),
            ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 800),
            ligne('10410000', client_1.ClasseCompte.CLASSE_1, 0, 1200),
            ligne('10611000', client_1.ClasseCompte.CLASSE_1, 0, 900),
        ];
        const s = service({ e1: balance });
        const note = await s.note5Dotation('t1', 'e1');
        expect(note.total).toBe(7000);
        expect(note.horsRubriques.map((c) => [c.numero, c.montant])).toEqual([['10611000', 900]]);
        expect(note.totalPosteHA).toBe(poste(await s.bilan('t1', 'e1'), 'HA').montant);
        expect(note.totalPosteHA).toBe(7900);
        expect(note.motifHorsRubriques).toContain('106');
    });
    it('ne retient comme membres que les sous-comptes d’apporteurs, jamais un compte courant ni un bénévole', async () => {
        const s = service({
            e1: [
                ligne('45120000', client_1.ClasseCompte.CLASSE_4, 2000, 2000),
                ligne('45150000', client_1.ClasseCompte.CLASSE_4, 500, 500),
                ligne('45720000', client_1.ClasseCompte.CLASSE_4, 300, 300),
            ],
        }, {
            tiersComptes: [
                { compteId: 'id-45120000', tiers: { nom: 'Apporteur' } },
                { compteId: 'id-45150000', tiers: { nom: 'Dirigeant en compte courant' } },
                { compteId: 'id-45720000', tiers: { nom: 'Bénévole' } },
            ],
        });
        const note = await s.note5Dotation('t1', 'e1');
        expect(note.membres.map((m) => [m.nom, m.numero, m.montant])).toEqual([['Apporteur', '45120000', 2000]]);
        expect(note.motifMembres).toContain('4515');
    });
    it('déclare la quatrième colonne (avec ou sans droit d’entrée) comme la nationalité, sans rien déduire', async () => {
        const s = service({ e1: [ligne('45120000', client_1.ClasseCompte.CLASSE_4, 2000, 2000), ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 2000)] }, { tiersComptes: [{ compteId: 'id-45120000', tiers: { nom: 'Apporteur' } }] });
        const note = await s.note5Dotation('t1', 'e1');
        expect(note.membres[0].precisionDroitEntree).toBeNull();
        expect(note.precisionDroitEntreeTenue).toBe(false);
        expect(note.nationaliteTenue).toBe(false);
        expect(note.motifColonnesNonTenues).toContain('nationalité');
        expect(note.motifColonnesNonTenues).toContain("avec droit d'entrée ou sans droit d'entrée");
    });
});
describe('Note 1 · cautions, rapprochement avec GA et total des biens détenus', () => {
    const immobilisation = (id, compte, montant, acquisition, sortie) => ({
        id,
        tenantId: 't1',
        compteImmobilisationId: `id-${compte}`,
        designation: `Bien ${id}`,
        valeurOrigine: montant,
        dateAcquisition: new Date(acquisition),
        dateMiseEnService: new Date(acquisition),
        dureeAmortissementAns: 5,
        dateSortie: sortie ? new Date(sortie) : null,
        prixCession: sortie ? 100 : null,
    });
    const IMMOBILISATIONS = [
        immobilisation('detenu', '24410000', 3000, '2024-02-01', null),
        immobilisation('sortiN1', '24410000', 700, '2023-02-01', '2025-06-30'),
        immobilisation('sortiN', '24410000', 900, '2024-03-01', '2026-06-30'),
    ];
    const BALANCE_GA = [
        ligne('24410000', client_1.ClasseCompte.CLASSE_2, 3000, 0),
        ligne('24500000', client_1.ClasseCompte.CLASSE_2, 1000, 0),
        ligne('28440000', client_1.ClasseCompte.CLASSE_2, 0, 600),
        ligne('27510000', client_1.ClasseCompte.CLASSE_2, 400, 0),
    ];
    it('ne totalise que les biens détenus, présente à part ceux sortis dans l’exercice, écarte ceux sortis avant', async () => {
        const note = await service({ e1: BALANCE_GA }, { immobilisations: IMMOBILISATIONS }).note1Immobilisations('t1', 'e1');
        expect(note.lignes.filter((l) => l.origine === 'REGISTRE').map((l) => l.designation)).toEqual(['Bien detenu']);
        expect(note.sortiesDeLExercice.map((l) => l.designation)).toEqual(['Bien sortiN']);
        expect(note.totalRegistre).toBe(3000);
    });
    it('reprend les cautions du 275 depuis la balance, sans date inventée', async () => {
        const note = await service({ e1: BALANCE_GA }, { immobilisations: IMMOBILISATIONS }).note1Immobilisations('t1', 'e1');
        const cautions = note.lignes.filter((l) => l.origine === 'BALANCE');
        expect(cautions.map((l) => [l.designation.split(' ')[0], l.montant, l.dateAcquisition])).toEqual([['27510000', 400, null]]);
        expect(note.totalCautions).toBe(400);
        expect(note.total).toBe(3400);
    });
    it('nomme le compte de la classe 2 que les fiches ne reconstituent pas, hors 28 et 275', async () => {
        const note = await service({ e1: BALANCE_GA }, { immobilisations: IMMOBILISATIONS }).note1Immobilisations('t1', 'e1');
        expect(note.ecartsGA.map((e) => [e.numero, e.ecart])).toEqual([['24500000', 1000]]);
        expect(note.motifEcartsGA).toContain('GA');
    });
    it('confronte un bien non achevé à son compte en cours, et un bien achevé à son compte définitif (immobilisation-en-cours.ts)', async () => {
        const immobilisations = [
            {
                ...immobilisation('chantier', '23100000', 5000, '2026-03-01', null),
                compteEnCoursId: 'id-23910000',
                dateMiseEnService: null,
            },
            {
                ...immobilisation('machine', '24100000', 2000, '2026-02-01', null),
                compteEnCoursId: 'id-24910000',
                dateMiseEnService: new Date('2026-09-01'),
            },
        ];
        const balance = [ligne('23910000', client_1.ClasseCompte.CLASSE_2, 5000, 0), ligne('24100000', client_1.ClasseCompte.CLASSE_2, 2000, 0)];
        const note = await service({ e1: balance }, { immobilisations }).note1Immobilisations('t1', 'e1');
        expect(note.ecartsGA).toEqual([]);
        expect(note.fichesSansSolde).toEqual([]);
    });
});
describe('Fiche récapitulative · colonnes A et N/A', () => {
    it('coche applicable la note qui porte une ligne, et N/A les autres', async () => {
        const s = service({
            e1: [
                ligne('41110000', client_1.ClasseCompte.CLASSE_4, 500, 0),
                ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1000, 0, { debit: 1000 }),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1500, { credit: 1000 }),
            ],
        });
        const [note1, note2, note3, note5] = await Promise.all([
            s.note1Immobilisations('t1', 'e1'),
            s.note2Stocks('t1', 'e1'),
            s.note3CreancesDettes('t1', 'e1'),
            s.note5Dotation('t1', 'e1'),
        ]);
        const applicables = await s.notesApplicables('t1', 'e1', { note1, note2, note3, note5 });
        expect(applicables).toEqual([3, 5, 4]);
    });
    it('un dossier sans aucun solde n’a aucune note applicable', async () => {
        const s = service({ e1: [] });
        const [note1, note2, note3, note5] = await Promise.all([
            s.note1Immobilisations('t1', 'e1'),
            s.note2Stocks('t1', 'e1'),
            s.note3CreancesDettes('t1', 'e1'),
            s.note5Dotation('t1', 'e1'),
        ]);
        expect(await s.notesApplicables('t1', 'e1', { note1, note2, note3, note5 })).toEqual([]);
    });
});
describe('Bilan S.M.T · la colonne N-1 qui reprend un résultat antérieur non viré', () => {
    const lignes2027 = [
        ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0),
        ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_000),
        ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
    ];
    const lignes2028 = [ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0), ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_500)];
    const exercices = (statut2027) => [
        { id: 'e0', dateDebut: new Date('2027-01-01'), statut: statut2027 },
        { id: 'e1', dateDebut: new Date('2028-01-01'), statut: 'OUVERT' },
    ];
    it('2027 clôturé · HB N-1 reprend 1 164 500, et la colonne dit l’excédent de 2026 resté au 13', async () => {
        const bilan = await service({ e0: lignes2027, e1: lignes2028 }, { exercices: exercices('CLOTURE') }).bilan('t1', 'e1');
        expect(poste(bilan, 'HB').montantN1).toBe(1_164_500);
        expect(bilan.resultatAnterieurNonVire).toBeNull();
        expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: 1_164_000, poste: 'HB' }));
        expect(bilan.resultatAnterieurNonVireN1.motif).toMatch(/^Colonne N-1 · /);
    });
    it('2027 ouvert · rien n’est dit', async () => {
        const bilan = await service({ e0: lignes2027, e1: lignes2028 }, { exercices: exercices('OUVERT') }).bilan('t1', 'e1');
        expect(bilan.resultatAnterieurNonVireN1).toBeNull();
    });
});
describe('Bilan S.M.T · paquet 1, A4 · l’ouverture d’un premier exercice clôturé', () => {
    it('la colonne N-1 porte le résultat repris en HB, pas en HC', async () => {
        const apresCloture = [
            ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1_000, 0, { debit: 1_000 }),
            ligne('13100000', client_1.ClasseCompte.CLASSE_1, 1_000, 1_000, { debit: 1_000, credit: 1_000 }),
            ligne('12100000', client_1.ClasseCompte.CLASSE_1, 0, 1_000, { credit: 1_000 }),
        ];
        const avantCloture = [
            ligne('57100000', client_1.ClasseCompte.CLASSE_5, 1_000, 0, { debit: 1_000 }),
            ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_000, { credit: 1_000 }),
        ];
        const bilan = await service({ e1: apresCloture }, { ouvertures: { e1: avantCloture } }).bilan('t1', 'e1');
        expect({ comparatif: bilan.comparatif, hbN1: poste(bilan, 'HB').montantN1, hcN1: poste(bilan, 'HC').montantN1 }).toEqual({
            comparatif: 'BILAN_D_OUVERTURE',
            hbN1: 1_000,
            hcN1: 0,
        });
        expect(poste(bilan, 'HC').montant).toBe(1_000);
    });
});
//# sourceMappingURL=etats-financiers-smt.service.spec.js.map
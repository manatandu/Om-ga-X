"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const fiscalite_service_1 = require("./fiscalite.service");
const catalogue_retraitements_1 = require("./catalogue-retraitements");
const ecriture_impot_resultat_1 = require("./ecriture-impot-resultat");
const periode_creation_1 = require("./periode-creation");
const D = client_1.TypeCompteDetailTotal.DETAIL;
const ligne = (numero, solde, typeCompte = D) => ({ numero, solde, typeCompte });
function service(options) {
    const exercices = options.exercices ?? [
        { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
    ];
    const crees = [];
    const prisma = {
        tenant: {
            findUnique: async () => ({
                id: 't1',
                referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA,
                formeJuridiqueSyscohada: options.forme === undefined ? client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE : options.forme,
                ...(options.tenant ?? {}),
            }),
        },
        exercice: {
            findFirst: async ({ where }) => exercices.find((e) => e.id === where.id) ?? null,
            findMany: async ({ where, take }) => exercices
                .filter((e) => e.dateFin < where.dateFin.lt && (!where.dateFin.gte || e.dateFin >= where.dateFin.gte))
                .sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())
                .slice(0, take),
        },
        retraitementFiscal: {
            findMany: async ({ where }) => (options.retraitements?.[where.exerciceId] ?? []).map((r, i) => ({
                id: `r${i}`,
                code: 'X',
                libelle: 'x',
                commentaire: null,
                ...r,
            })),
            create: async ({ data }) => {
                crees.push(data);
                return data;
            },
        },
        ecriture: {
            count: async ({ where }) => (options.brouillards?.[where.exerciceId] ?? []).length > 0 ? 1 : 0,
        },
        dossierFiscalExercice: {
            upsert: async ({ create }) => {
                crees.push(create);
                return create;
            },
            findMany: async ({ where }) => Object.entries(options.dossiers ?? {})
                .filter(([id]) => where.exerciceId.in.includes(id))
                .map(([exerciceId, d]) => ({ exerciceId, deficitAnterieurSaisi: null, deficitAnterieurOrigines: null, ...d })),
            findUnique: async ({ where }) => options.dossiers?.[where.exerciceId]
                ? { acomptesVerses: 0, supplementsAdministration: 0, deficitAnterieurSaisi: null, natureActivite: null, ...options.dossiers[where.exerciceId] }
                : options.dossier
                    ? {
                        acomptesVerses: 0,
                        supplementsAdministration: 0,
                        deficitAnterieurSaisi: null,
                        natureActivite: null,
                        resultatPeriodeCreationSaisi: null,
                        ...options.dossier,
                    }
                    : null,
        },
    };
    const ecritures = {
        balance: async (_t, exerciceId, inclureBrouillard = true, arreteAu) => {
            const parNumero = new Map();
            const verser = (lignes, estCloture) => {
                for (const l of lignes ?? []) {
                    const a = parNumero.get(l.numero) ?? {
                        numero: l.numero, solde: 0, typeCompte: l.typeCompte ?? D,
                        totalDebit: 0, totalCredit: 0, reportDebit: 0, reportCredit: 0,
                        mouvementDebit: 0, mouvementCredit: 0, clotureDebit: 0, clotureCredit: 0,
                    };
                    a.solde += l.solde;
                    const debit = Math.max(l.solde, 0);
                    const credit = Math.max(-l.solde, 0);
                    a.totalDebit += debit;
                    a.totalCredit += credit;
                    if (estCloture === 'report') {
                        a.reportDebit += debit;
                        a.reportCredit += credit;
                    }
                    else if (estCloture) {
                        a.clotureDebit += debit;
                        a.clotureCredit += credit;
                    }
                    else {
                        a.mouvementDebit += debit;
                        a.mouvementCredit += credit;
                    }
                    parNumero.set(l.numero, a);
                }
            };
            if (arreteAu) {
                verser(options.balancesAu?.[exerciceId], false);
                return { lignes: [...parNumero.values()], totaux: { debit: 0, credit: 0 } };
            }
            verser(options.reports?.[exerciceId], 'report');
            verser(options.balances[exerciceId], false);
            verser(options.clotures?.[exerciceId], true);
            if (inclureBrouillard)
                verser(options.brouillards?.[exerciceId], false);
            return { lignes: [...parNumero.values()], totaux: { debit: 0, credit: 0 } };
        },
    };
    return { s: new fiscalite_service_1.FiscaliteService(prisma, ecritures), crees };
}
describe('Résultat fiscal · lecture de la balance', () => {
    it('lit le résultat dans les classes 6, 7, 8 avant clôture, et le chiffre d’affaires dans 701 à 707 seulement', async () => {
        const { s } = service({
            balances: {
                N: [
                    ligne('70110000', -1000),
                    ligne('70610000', -500),
                    ligne('75800000', -200),
                    ligne('60110000', 900),
                    ligne('70', -1500, client_1.TypeCompteDetailTotal.TOTAL),
                ],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.sourceResultat).toBe('CLASSES_6_7_8');
        expect(r.resultatComptable).toBe(800);
        expect(r.chiffreAffaires).toBe(1500);
    });
    it('bascule sur le compte 13 quand les classes de gestion sont soldées', async () => {
        const { s } = service({ balances: { N: [ligne('13100000', -800)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.sourceResultat).toBe('COMPTE_13');
        expect(r.resultatComptable).toBe(800);
    });
    it('IGNORE le résultat en instance d’affectation (130) · sinon l’impôt est payé deux fois', async () => {
        const { s } = service({
            balances: {
                N: [ligne('13100000', -800), ligne('13010000', -5_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.resultatComptable).toBe(800);
    });
    it('LIT une cascade de soldes intermédiaires arrêtée en chemin (Titre VIII ch. 19 § 2.4)', async () => {
        const { s } = service({
            balances: {
                N: [ligne('13200000', 0), ligne('13300000', 0), ligne('13700000', -1_700), ligne('13800000', 900)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.sourceResultat).toBe('COMPTE_13');
        expect(r.resultatComptable).toBe(800);
    });
    it('retient la PERTE portée au 139', async () => {
        const { s } = service({ balances: { N: [ligne('13900000', 1_500)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.resultatComptable).toBe(-1_500);
    });
});
describe('Impôt sur les sociétés · art. 56 et 57', () => {
    it('applique 30 % du résultat fiscal après réintégrations et déductions', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -100_000), ligne('60110000', 60_000)] },
            retraitements: {
                N: [
                    { sens: client_1.SensRetraitementFiscal.REINTEGRATION, montant: 5_000 },
                    { sens: client_1.SensRetraitementFiscal.DEDUCTION, montant: 1_000 },
                ],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.resultatComptable).toBe(40_000);
        expect(r.resultatFiscal).toBe(44_000);
        expect(r.impotTheorique).toBe(13_200);
        expect(r.impotMinimum).toBe(1_000);
        expect(r.impotDu).toBe(13_200);
        expect(r.minimumApplique).toBe(false);
    });
    it('retient l’impôt minimum de 1 % du chiffre d’affaires quand il dépasse l’impôt théorique, déficit compris', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
            dossier: { acomptesVerses: 4_000 },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.resultatFiscal).toBe(-200_000);
        expect(r.impotTheorique).toBe(0);
        expect(r.impotMinimum).toBe(10_000);
        expect(r.impotDu).toBe(10_000);
        expect(r.minimumApplique).toBe(true);
        expect(r.soldeAPayer).toBe(6_000);
        expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([3_000, 3_000, 2_000]);
    });
});
describe('Base des acomptes provisionnels · art. 57 bis LPF', () => {
    const dossierRedresse = (supplements) => service({
        balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
        dossier: { supplementsAdministration: supplements },
    });
    it('ajoute les suppléments de l’Administration à la base des trois acomptes', async () => {
        const { s } = dossierRedresse(5_000);
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotDu).toBe(10_000);
        expect(r.baseAcomptes).toBe(15_000);
        expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([4_500, 4_500, 3_000]);
    });
    it('ne touche NI le solde à payer NI l’impôt dû de l’exercice', async () => {
        const { s } = dossierRedresse(5_000);
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotDu).toBe(10_000);
        expect(r.soldeAPayer).toBe(10_000);
    });
    it('sans supplément, la base est l’impôt dû seul', async () => {
        const { s } = dossierRedresse(0);
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.baseAcomptes).toBe(10_000);
        expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([3_000, 3_000, 2_000]);
    });
    it('porte les échéances de la loi de finances, pas celles de la rédaction de 2023', async () => {
        const { s } = dossierRedresse(0);
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet', '25 septembre', '25 novembre']);
    });
});
describe('Acomptes de l’année de la dissolution · bornés comme l’échéancier (relecture du 2026-10-07, mineur 7)', () => {
    const exercice2025 = [{ id: 'N', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }];
    const dossierDissous = (tenant) => service({
        balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
        exercices: exercice2025,
        tenant: { dateDissolution: new Date(Date.UTC(2026, 4, 15)), regimeLiquidation: null, associeUniquePersonneMorale: null, ...tenant },
    });
    it('liquidation close le 10/08/2026 · seul l’acompte du 25 juillet reste dû', async () => {
        const { s } = dossierDissous({ dateClotureLiquidation: new Date(Date.UTC(2026, 7, 10)) });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet']);
        expect(r.baseAcomptes).toBe(10_000);
        expect(r.observations.some((o) => o.startsWith('ACOMPTES APRÈS LA DISSOLUTION · 2 acompte(s) de 2026'))).toBe(true);
    });
    it('sans liquidation, la cotisation de juin est la dernière · aucun acompte de 2026', async () => {
        const { s } = dossierDissous({ associeUniquePersonneMorale: true });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.acomptesProchainExercice).toEqual([]);
        expect(r.baseAcomptes).toBeNull();
    });
    it('liquidation dont la clôture n’est pas déclarée · les trois restent servis, rien ne les borne encore', async () => {
        const { s } = dossierDissous({});
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.acomptesProchainExercice).toHaveLength(3);
    });
});
describe('Report des déficits · art. 51 et 52', () => {
    const ex = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    it('impute le déficit antérieur sur le bénéfice, sans jamais dépasser celui-ci', async () => {
        const { s } = service({
            exercices: [ex('N-1', 2025), ex('N', 2026)],
            balances: {
                'N-1': [ligne('60110000', 30_000)],
                N: [ligne('70110000', -20_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(30_000);
        expect(r.deficitImpute).toBe(20_000);
        expect(r.resultatFiscal).toBe(0);
    });
    it('consomme les déficits dans l’ordre sur les bénéfices intermédiaires, et perd ce qui a plus de trois exercices', async () => {
        const { s } = service({
            exercices: [ex('N-4', 2022), ex('N-3', 2023), ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
            balances: {
                'N-4': [ligne('60110000', 100_000)],
                'N-3': [ligne('60110000', 10_000)],
                'N-2': [ligne('70110000', -4_000)],
                'N-1': [ligne('60110000', 5_000)],
                N: [ligne('70110000', -1_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(15_000);
        expect(r.deficitAnterieur.detail.map((d) => d.montant)).toEqual([10_000, 5_000]);
    });
    it('impute le déficit à 100 % du bénéfice · aucun plafond de 60 % (art. 51)', async () => {
        const { s } = service({
            exercices: [ex('N-1', 2025), ex('N', 2026)],
            balances: {
                'N-1': [ligne('60110000', 100_000)],
                N: [ligne('70110000', -50_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitImpute).toBe(50_000);
        expect(r.resultatFiscal).toBe(0);
    });
    it('perd un amortissement réputé différé au-delà de trois exercices · art. 51, déficit ordinaire', async () => {
        const { s } = service({
            exercices: [ex('N-4', 2022), ex('N-3', 2023), ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
            balances: {
                'N-4': [ligne('68130000', 40_000)],
                'N-3': [],
                'N-2': [],
                'N-1': [],
                N: [ligne('70110000', -40_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(0);
        expect(r.resultatFiscal).toBe(40_000);
    });
    it('laisse un déficit saisi à la main primer sur le calcul · dossier repris à un confrère', async () => {
        const { s } = service({
            exercices: [ex('N-1', 2025), ex('N', 2026)],
            balances: { 'N-1': [ligne('60110000', 30_000)], N: [ligne('70110000', -50_000)] },
            dossier: { deficitAnterieurSaisi: 7_000 },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur).toMatchObject({ montant: 7_000, saisi: true });
        expect(r.resultatFiscal).toBe(43_000);
    });
});
describe('Régime selon la forme juridique · art. 3 à 6 et 107 à 128', () => {
    it('une entreprise individuelle bascule de régime avec son chiffre d’affaires', async () => {
        const cas = async (ca, nature) => {
            const { s } = service({
                forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
                balances: { N: [ligne('70110000', -ca)] },
                dossier: nature ? { natureActivite: nature } : undefined,
            });
            return s.resultatFiscal('t1', 'N');
        };
        const micro = await cas(20_000_000);
        expect(micro.regime).toBe('IRPP_MICRO_ENTREPRISE');
        expect(micro.impotDu).toBeNull();
        const petiteSansNature = await cas(100_000_000);
        expect(petiteSansNature.regime).toBe('IRPP_PETITE_ENTREPRISE');
        expect(petiteSansNature.impotDu).toBeNull();
        expect((await cas(100_000_000, 'VENTE')).impotDu).toBe(1_000_000);
        expect((await cas(100_000_000, 'PRESTATIONS')).impotDu).toBe(2_000_000);
        const reel = await cas(400_000_000);
        expect(reel.regime).toBe('IRPP_REGIME_REEL');
        expect(reel.impotDu).toBeNull();
        expect(reel.impotMinimum).toBe(4_000_000);
    });
    it('une société de personnes est signalée comme imposable sur option seulement', async () => {
        const { s } = service({ forme: client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, balances: { N: [] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IMPOT_SOCIETES');
        expect(r.observations.join(' ')).toMatch(/SUR OPTION/);
    });
    it('une forme non renseignée est dite, pas devinée en silence', async () => {
        const { s } = service({ forme: null, balances: { N: [] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toMatch(/pas renseignée/);
    });
});
describe('Cloisonnement et saisie', () => {
    it('refuse un dossier SYCEBNL · une EBNL est exemptée (art. 5)', async () => {
        const { s } = service({ referentiel: client_1.Referentiel.SYCEBNL, balances: { N: [] } });
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/SYSCOHADA/);
    });
    it('impose un fondement écrit à une ligne libre, et le sens du catalogue aux autres', async () => {
        const { s, crees } = service({ balances: { N: [] } });
        await expect(s.ajouterRetraitement('t1', 'N', { code: catalogue_retraitements_1.CODE_LIBRE, libelle: 'x', montant: 10 })).rejects.toThrow(/fondement/);
        await s.ajouterRetraitement('t1', 'N', {
            code: 'AMENDES_PENALITES',
            sens: client_1.SensRetraitementFiscal.DEDUCTION,
            montant: 10,
        });
        expect(crees[0].sens).toBe(client_1.SensRetraitementFiscal.REINTEGRATION);
    });
    it('chaque entrée du catalogue cite un article et porte un sens', () => {
        for (const r of catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS) {
            expect(r.source.length).toBeGreaterThan(8);
            expect([client_1.SensRetraitementFiscal.REINTEGRATION, client_1.SensRetraitementFiscal.DEDUCTION]).toContain(r.sens);
            if (r.plafond)
                expect(r.plafond.part).toBeGreaterThan(0);
        }
        expect(new Set(catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.map((r) => r.code)).size).toBe(catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.length);
    });
});
describe('Régime des personnes physiques · art. 113, déclassement et reclassement', () => {
    const ex = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    const individuelle = (exercices, balances, nature) => service({
        forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
        exercices,
        balances,
        dossier: nature ? { natureActivite: nature } : undefined,
    }).s;
    it('NE DÉCLASSE PAS après un seul exercice sous le seuil', async () => {
        const s = individuelle([ex('N-1', 2025), ex('N', 2026)], { 'N-1': [ligne('70110000', -400_000_000)], N: [ligne('70110000', -100_000_000)] }, 'VENTE');
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_REGIME_REEL');
        expect(r.impotDu).toBeNull();
        expect(r.observations.join(' ')).toMatch(/Art. 113/);
        expect(r.observations.join(' ')).toMatch(/MAINTENU/);
    });
    it('déclasse après DEUX exercices consécutifs sous le seuil', async () => {
        const s = individuelle([ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)], {
            'N-2': [ligne('70110000', -400_000_000)],
            'N-1': [ligne('70110000', -100_000_000)],
            N: [ligne('70110000', -100_000_000)],
        }, 'VENTE');
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
        expect(r.impotDu).toBe(1_000_000);
    });
    it('ne descend que d’UN CRAN · le régime réel tombe aux petites entreprises, pas aux micro', async () => {
        const s = individuelle([ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)], {
            'N-2': [ligne('70110000', -400_000_000)],
            'N-1': [ligne('70110000', -20_000_000)],
            N: [ligne('70110000', -20_000_000)],
        }, 'VENTE');
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
        expect(r.impotDu).toBe(200_000);
    });
    it('reclasse IMMÉDIATEMENT vers le haut · art. 113, al. 2', async () => {
        const s = individuelle([ex('N-1', 2025), ex('N', 2026)], {
            'N-1': [ligne('70110000', -20_000_000)],
            N: [ligne('70110000', -400_000_000)],
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_REGIME_REEL');
    });
    it('AVERTIT de l’option pour le régime réel, qu’aucune écriture ne porte · art. 110 et 111', async () => {
        const s = individuelle([ex('N', 2026)], { N: [ligne('70110000', -100_000_000)] }, 'VENTE');
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
        const dit = r.observations.join(' ');
        expect(dit).toMatch(/Art. 110 et 111/);
        expect(dit).toMatch(/1er février/);
        expect(dit).toMatch(/irrévocable/);
        expect(dit).toMatch(/Aucun exercice antérieur/);
    });
});
describe('Paiement en deux quotités · art. 57, al. 3 et 57 quater LPF', () => {
    const petite = async (nature) => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70610000', -100_000_000)] },
            dossier: { natureActivite: nature },
        });
        return s.resultatFiscal('t1', 'N');
    };
    it('sert 60 % au 31 janvier et 40 % ensuite, sur l’impôt de l’exercice', async () => {
        const r = await petite('PRESTATIONS');
        expect(r.impotDu).toBe(2_000_000);
        expect(r.quotitesPetiteEntreprise.map((q) => [q.quotite, q.echeance, q.montant])).toEqual([
            [0.6, '31 janvier', 1_200_000],
            [0.4, '30 avril', 800_000],
        ]);
    });
    it('NE SERT PAS les trois acomptes de l’impôt sur les sociétés', async () => {
        const r = await petite('PRESTATIONS');
        expect(r.acomptesProchainExercice).toEqual([]);
        expect(r.baseAcomptes).toBeNull();
        expect(r.observations.join(' ')).toMatch(/DEUX QUOTITÉS/);
    });
    it('porte la réserve sur la seconde échéance, que le texte officiel libelle mal', async () => {
        const r = await petite('VENTE');
        expect(r.quotitesPetiteEntreprise[0].reserve).toBeNull();
        expect(r.quotitesPetiteEntreprise[1].reserve).toMatch(/57 quater/);
        expect(r.observations.join(' ')).toMatch(/à confirmer auprès du service gestionnaire/);
    });
    it('laisse à l’impôt sur les sociétés ses trois acomptes, et aucune quotité', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 60_000_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.quotitesPetiteEntreprise).toEqual([]);
        expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet', '25 septembre', '25 novembre']);
    });
    it('une micro-entreprise ne reçoit ni acompte ni quotité', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -20_000_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
        expect(r.acomptesProchainExercice).toEqual([]);
        expect(r.quotitesPetiteEntreprise).toEqual([]);
    });
});
describe('Déchéances du report déficitaire · avertissements, art. 51 al. 2 et 52, 1°', () => {
    const ex = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    it('avertit dès qu’un déficit antérieur est imputé', async () => {
        const { s } = service({
            exercices: [ex('N-1', 2025), ex('N', 2026)],
            balances: { 'N-1': [ligne('60110000', 30_000)], N: [ligne('70110000', -20_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitImpute).toBe(20_000);
        const dit = r.observations.join(' ');
        expect(dit).toMatch(/Art. 51, al. 2/);
        expect(dit).toMatch(/mise en demeure/);
        expect(dit).toMatch(/Art. 52, 1°/);
        expect(dit).toMatch(/nouvel exploitant/);
    });
    it('ne dit rien quand il n’y a aucun déficit à reporter', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -20_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(0);
        expect(r.observations.join(' ')).not.toMatch(/mise en demeure/);
    });
    it('avertit aussi quand le déficit a été SAISI à la main', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -50_000)] }, dossier: { deficitAnterieurSaisi: 7_000 } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toMatch(/Art. 51, al. 2/);
    });
});
describe('Arrondi légal de l’impôt · art. 150', () => {
    it('supprime la décimale, PUIS remonte ou descend à la centaine', () => {
        expect((0, fiscalite_service_1.arrondirImpotArt150)(1_234_567.89)).toBe(1_234_600);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(1_234_549.4)).toBe(1_234_500);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(1_234_549.5)).toBe(1_234_600);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(0)).toBe(0);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(49)).toBe(0);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(50)).toBe(100);
        expect((0, fiscalite_service_1.arrondirImpotArt150)(1_234_600)).toBe(1_234_600);
    });
    it('l’impôt minimum de l’art. 57 sort arrondi, et sert de base aux acomptes', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -123_456_789), ligne('60110000', 200_000_000)] },
            dossier: { supplementsAdministration: 0 },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotMinimum).toBe(1_234_600);
        expect(r.impotDu).toBe(1_234_600);
        expect(r.minimumApplique).toBe(true);
        expect(r.baseAcomptes).toBe(1_234_600);
    });
    it('l’IRPP d’une petite entreprise aussi · l’article le nomme', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -123_456_789)] },
            dossier: { natureActivite: 'PRESTATIONS' },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotDu).toBe(2_469_100);
        expect(r.quotitesPetiteEntreprise.map((q) => q.montant)).toEqual([1_481_460, 987_640]);
    });
});
describe('Plafond des dons servi à l’écran · condition de l’art. 44', () => {
    const dons = (r) => r.plafonds.find((p) => p.code === 'DONS_EXCEDENT');
    it('dossier DÉFICITAIRE · le plafond est servi à zéro, et le seuil est dit', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 102_800_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.resultatFiscalBrut).toBe(-2_800_000);
        expect(dons(r).montantAdmis).toBe(0);
        expect(dons(r).conditionOuverte).toBe(false);
        expect(dons(r).enonce.replace(/[\u202f\u00a0]/g, ' ')).toContain('dépassent 2 800 000');
    });
    it('dossier BÉNÉFICIAIRE · le plafond joue, et le relevé du 1° est rappelé', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 60_000_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(dons(r).montantAdmis).toBe(500_000);
        expect(dons(r).conditionOuverte).toBe(true);
        expect(dons(r).enonce).toContain('relevé');
    });
    it('les plafonds SANS condition d’ouverture ne bougent pas, déficit ou non', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 102_800_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        const cadeaux = r.plafonds.find((p) => p.code === 'CADEAUX_EXCEDENT');
        expect(cadeaux.montantAdmis).toBe(200_000);
        expect(cadeaux.conditionOuverte).toBeNull();
    });
});
describe('Assiette des acomptes · les branches que le module ne peut pas calculer', () => {
    it('avertit de la base reconstituée d’office, qui REMPLACE l’impôt déclaré', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toContain("reconstitué d'office");
        expect(r.observations.join(' ')).toContain('REMPLACE');
    });
    it('dit qu’aucun acompte n’est dû quand le dossier n’a pas d’exercice antérieur', async () => {
        const { s } = service({ balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toContain("AUCUN acompte n'est dû au titre de la présente année");
    });
    it('se tait sur ce point dès qu’un exercice antérieur est tenu', async () => {
        const { s } = service({
            exercices: [
                { id: 'N-1', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
                { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
            ],
            balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)], 'N-1': [] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).not.toContain("AUCUN acompte n'est dû");
        expect(r.observations.join(' ')).toContain("reconstitué d'office");
    });
    it('ne sert AUCUNE de ces observations à qui ne verse pas d’acompte', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -20_000_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
        expect(r.observations.join(' ')).not.toContain("reconstitué d'office");
    });
});
describe('Contribuables dispensés de patente · art. 64, 3° et 108', () => {
    it('avertit le dossier classé en micro-entreprise', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -20_000_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
        const dit = r.observations.join(' ');
        expect(dit).toContain("dispensés de l'obligation d'obtenir la patente");
        expect(dit).toContain('vendeurs de journaux à la criée');
        expect(dit).toContain('EXEMPTÉS');
    });
    it('ne le sert pas à une petite entreprise, que l’art. 108 ne vise pas', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -100_000_000)] },
            dossier: { natureActivite: 'VENTE' },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
        expect(r.observations.join(' ')).not.toContain('patente');
    });
});
describe('passe F5 · observations du Titre 3', () => {
    it("sert l'art. 103 à toute personne physique, et les art. 89, 90 et 92 à 99 au seul régime réel", async () => {
        const micro = await service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -20_000_000)] },
        }).s.resultatFiscal('t1', 'N');
        const reel = await service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -5_000_000_000)] },
            dossier: { natureActivite: 'VENTE' },
        }).s.resultatFiscal('t1', 'N');
        const petite = await service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balances: { N: [ligne('70110000', -100_000_000)] },
            dossier: { natureActivite: 'VENTE' },
        }).s.resultatFiscal('t1', 'N');
        expect({
            micro: [micro.regime, micro.observations.some((o) => o.startsWith('Art. 103')), micro.observations.some((o) => o.startsWith('Art. 92 à 99'))],
            petite: [petite.regime, petite.observations.some((o) => o.startsWith('Art. 89, al. 2 et 3'))],
            reel: [
                reel.regime,
                reel.observations.some((o) => o.startsWith('Art. 103')),
                reel.observations.some((o) => o.startsWith('Art. 89, al. 2 et 3')),
                reel.observations.some((o) => o.startsWith('Art. 92 à 99')),
            ],
        }).toEqual({
            micro: ['IRPP_MICRO_ENTREPRISE', true, false],
            petite: ['IRPP_PETITE_ENTREPRISE', false],
            reel: ['IRPP_REGIME_REEL', true, true, true],
        });
    });
    it("sert l'anomalie de l'art. 63, al. 2, 1° sous sa condition tant que le dossier ne tranche pas, sans quitter l'IS", async () => {
        const lire = async (forme, tenant = {}) => {
            const r = await service({ forme, tenant, balances: { N: [ligne('70110000', -20_000_000)] } }).s.resultatFiscal('t1', 'N');
            const obs = r.observations.filter((o) => o.includes('art. 63, al. 2, 1°'));
            const condition = obs.some((o) => o.includes(fiscalite_service_1.COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE))
                ? 'NATURE'
                : obs.some((o) => o.includes(fiscalite_service_1.COMPLEMENT_UNICITE_NON_DECLAREE))
                    ? 'UNICITE'
                    : null;
            return [r.regime, obs.length, condition];
        };
        const F = client_1.FormeJuridiqueSyscohada;
        expect({
            sarlSansFait: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE),
            sarlAssociePm: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUniquePersonneMorale: true }),
            sarlNonPm: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUniquePersonneMorale: false }),
            saSansFait: await lire(F.SOCIETE_ANONYME),
            saAssociePm: await lire(F.SOCIETE_ANONYME, { associeUniquePersonneMorale: true }),
            sarlPluripersonnelle: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUnique: false }),
            sarluPersonnePhysique: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUnique: true, associeUniquePersonneMorale: false }),
            sauNatureNonDite: await lire(F.SOCIETE_ANONYME, { associeUnique: true }),
            sasUniciteNonDite: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: null }),
            sasUniciteNonDitePm: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: null, associeUniquePersonneMorale: true }),
            sasPluripersonnelle: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: false }),
            sasuNatureNonDite: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: true, associeUniquePersonneMorale: null }),
            sasuPersonnePhysique: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: true, associeUniquePersonneMorale: false }),
            sasuPersonneMorale: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUnique: true, associeUniquePersonneMorale: true }),
            snc: await lire(F.SOCIETE_NOM_COLLECTIF),
        }).toEqual({
            sarlSansFait: ['IMPOT_SOCIETES', 1, 'UNICITE'],
            sarlAssociePm: ['IMPOT_SOCIETES', 0, null],
            sarlNonPm: ['IMPOT_SOCIETES', 1, 'UNICITE'],
            saSansFait: ['IMPOT_SOCIETES', 1, 'UNICITE'],
            saAssociePm: ['IMPOT_SOCIETES', 0, null],
            sarlPluripersonnelle: ['IMPOT_SOCIETES', 0, null],
            sarluPersonnePhysique: ['IMPOT_SOCIETES', 1, null],
            sauNatureNonDite: ['IMPOT_SOCIETES', 1, 'NATURE'],
            sasUniciteNonDite: ['IMPOT_SOCIETES', 1, 'UNICITE'],
            sasUniciteNonDitePm: ['IMPOT_SOCIETES', 0, null],
            sasPluripersonnelle: ['IMPOT_SOCIETES', 0, null],
            sasuNatureNonDite: ['IMPOT_SOCIETES', 1, 'NATURE'],
            sasuPersonnePhysique: ['IMPOT_SOCIETES', 1, null],
            sasuPersonneMorale: ['IMPOT_SOCIETES', 0, null],
            snc: ['IMPOT_SOCIETES', 0, null],
        });
    });
    it('les deux conditions disent la même chose, l’unicité ET la personne physique', () => {
        for (const complement of [fiscalite_service_1.COMPLEMENT_UNICITE_NON_DECLAREE]) {
            expect(complement).toContain("ne vaut que si la société n'a qu'un associé ou actionnaire, personne physique");
        }
    });
    it('unipersonnaliteDeLArticle63 · la règle seule, forme par forme', () => {
        const F = client_1.FormeJuridiqueSyscohada;
        const u = (formeJuridiqueSyscohada, associeUnique, associeUniquePersonneMorale) => (0, fiscalite_service_1.unipersonnaliteDeLArticle63)({ formeJuridiqueSyscohada, associeUnique, associeUniquePersonneMorale });
        expect([
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, false),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, null),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, undefined),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, true),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, false, false),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, null, false),
            u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, undefined, null),
            u(F.SOCIETE_ANONYME, true, false),
            u(F.SOCIETE_RESPONSABILITE_LIMITEE, true, false),
            u(F.SOCIETE_RESPONSABILITE_LIMITEE, false, true),
            u(F.SOCIETE_RESPONSABILITE_LIMITEE, false, false),
            u(F.SOCIETE_ANONYME, null, null),
            u(F.SOCIETE_NOM_COLLECTIF, true, false),
            u(null, true, false),
        ]).toEqual([
            'ASSOCIE_PERSONNE_PHYSIQUE',
            'NATURE_NON_DECLAREE',
            'NATURE_NON_DECLAREE',
            null,
            null,
            'UNICITE_NON_DECLAREE',
            'UNICITE_NON_DECLAREE',
            'ASSOCIE_PERSONNE_PHYSIQUE',
            'ASSOCIE_PERSONNE_PHYSIQUE',
            null,
            null,
            'UNICITE_NON_DECLAREE',
            null,
            null,
        ]);
    });
});
describe('Réintégration du supplément d’annuité des biens réévalués · art. 133', () => {
    it('le catalogue porte la ligne, avec son article', () => {
        const entree = catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.find((r) => r.code === 'REEVALUATION_SUPPLEMENT_ANNUITE');
        expect(entree).toBeDefined();
        expect(entree.sens).toBe(client_1.SensRetraitementFiscal.REINTEGRATION);
        expect(entree.source).toContain('art. 133');
        expect(entree.assietteHorsPortee).toBeTruthy();
    });
    it('dit que la provision spéciale reprise au 861 neutralise déjà · sinon le supplément serait neutralisé deux fois (lot 14)', () => {
        const entree = catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS.find((r) => r.code === 'REEVALUATION_SUPPLEMENT_ANNUITE');
        expect(entree.assietteHorsPortee).toContain('154');
        expect(entree.assietteHorsPortee).toContain('861');
        expect(entree.assietteHorsPortee).toContain('deux fois');
        expect(entree.assietteHorsPortee).toContain("D × (1 − 1/k')");
    });
});
describe('Suivi des acomptes provisionnels · la saisie contre le compte 4492', () => {
    const base = { acomptesDus: true, declares: 0, comptabilises: 0, impotDu: 0 };
    it('ne sert rien à qui ne doit pas d’acomptes · une petite entreprise paie en deux quotités', () => {
        expect(fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, acomptesDus: false, declares: 500, comptabilises: 0 })).toBeNull();
    });
    it('signale l’écart entre le montant déclaré et le solde du 4492, et cite l’art. 98 bis', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 3000000, comptabilises: 1000000, impotDu: 5000000 });
        expect(s.ecart).toBe(2000000);
        expect(s.observations.join(' ')).toContain('98 bis');
        expect(s.observations.join(' ')).toContain('50 %');
    });
    it('ne signale aucun écart quand la saisie et le compte disent la même chose', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 });
        expect(s.ecart).toBe(0);
        expect(s.observations.some((o) => o.includes('98 bis'))).toBe(false);
    });
    it('un excédent d’acomptes n’est PAS un remboursement · art. 57 ter, crédit au compte courant fiscal', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 8000000, comptabilises: 8000000, impotDu: 5000000 });
        expect(s.excedent).toBe(3000000);
        const texte = s.observations.join(' ');
        expect(texte).toContain('57 ter');
        expect(texte).toContain("N'EST PAS UN REMBOURSEMENT");
        expect(texte.toLowerCase()).toContain('à sa demande');
    });
    it('aucun excédent tant que l’impôt dépasse les acomptes', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 });
        expect(s.excedent).toBeNull();
    });
    it('rappelle que le 4492 se solde à la liquidation · sinon l’avance est comptée deux fois', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 });
        expect(s.observations.join(' ')).toContain('57 bis, al. 3');
    });
    it('ne dit rien sur la liquidation quand aucun acompte n’a été versé', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 0, comptabilises: 0, impotDu: 5000000 });
        expect(s.observations).toEqual([]);
    });
    it('n’affirme jamais qu’un acompte est « non versé » · établir l’insuffisance appartient à l’Administration', () => {
        const s = fiscalite_service_1.FiscaliteService.suiviAcomptes({ ...base, declares: 3000000, comptabilises: 1000000, impotDu: 5000000 });
        const texte = s.observations.join(' ');
        expect(texte).not.toMatch(/amende (due|à payer|de \d)/i);
        expect(texte).toContain('diffèrent de');
    });
});
describe('Suivi des acomptes · le 4492 et lui seul', () => {
    it('ne compte que le 4492 · une subvention à recevoir au 4495 n’est pas un acompte versé', async () => {
        const { s } = service({
            balances: {
                N: [
                    ligne('70110000', -50000000),
                    ligne('60110000', 20000000),
                    ligne('44920000', 3000000),
                    ligne('44950000', 9000000),
                    ligne('44910000', 4000000),
                ],
            },
            dossier: { acomptesVerses: 3000000 },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.suiviAcomptes.comptabilises).toBe(3000000);
        expect(r.suiviAcomptes.ecart).toBe(0);
    });
    it('agrège plusieurs sous-comptes du 4492 · un dossier peut en ouvrir un par impôt', async () => {
        const { s } = service({
            balances: {
                N: [ligne('70110000', -50000000), ligne('44921000', 1000000), ligne('44922000', 2000000)],
            },
            dossier: { acomptesVerses: 3000000 },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.suiviAcomptes.comptabilises).toBe(3000000);
    });
});
describe('Le périmètre de la loi est annoncé · entrée en vigueur et territoire', () => {
    const balance = [ligne('13100000', -10_000_000)];
    it('la territorialité est annoncée sur TOUT exercice, DANS LES DEUX SENS', async () => {
        const { s } = service({ balances: { N: balance } });
        const r = await s.resultatFiscal('t1', 'N');
        const texte = r.observations.join(' | ');
        expect(texte).toContain('PÉRIMÈTRE TERRITORIAL NON DÉCOUPÉ (art. 7 et art. 51, alinéa 3)');
        expect(texte).toContain('uniquement');
        expect(texte).toContain('TROP LARGE');
        expect(texte).toContain('TROP ÉTROITE');
        expect(texte).toContain('RÉINTÉGRER');
        expect(texte).toContain('sens inverse');
    });
    it('un exercice de 2026 ne porte PAS l’avertissement d’entrée en vigueur', async () => {
        const { s } = service({ balances: { N: balance } });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' | ')).not.toContain("ANTÉRIEUR À L'ENTRÉE EN VIGUEUR");
    });
    it('un exercice ouvert AVANT le 1er janvier 2026 est annoncé comme une SIMULATION', async () => {
        const { s } = service({
            balances: { A: balance },
            exercices: [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }],
        });
        const r = await s.resultatFiscal('t1', 'A');
        const texte = r.observations.join(' | ');
        expect(texte).toContain("EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR DE LA LOI");
        expect(texte).toContain('2025-01-01');
        expect(texte).toContain('SIMULATION');
        expect(texte).toContain('report déficitaire');
    });
    it('le chiffre reste CALCULÉ · on avertit, on ne bloque pas', async () => {
        const { s } = service({
            balances: { A: balance },
            exercices: [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }],
        });
        const r = await s.resultatFiscal('t1', 'A');
        expect(r.resultatComptable).toBe(10_000_000);
        expect(r.observations.length).toBeGreaterThan(0);
    });
});
describe('Report déficitaire et impôt minimum · deux bornes rendues exactes', () => {
    it('un déficit hors fenêtre de trois exercices n’est plus imputé', async () => {
        const { s } = service({
            balances: {
                A2020: [ligne('13100000', 5_000_000)],
                A2021: [ligne('13100000', 0)],
                N: [ligne('13100000', -20_000_000)],
            },
            exercices: [
                { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
                { id: 'A2021', dateDebut: new Date(Date.UTC(2021, 0, 1)), dateFin: new Date(Date.UTC(2021, 11, 31)) },
                { id: 'A2020', dateDebut: new Date(Date.UTC(2020, 0, 1)), dateFin: new Date(Date.UTC(2020, 11, 31)) },
            ],
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(0);
        expect(r.resultatFiscal).toBe(20_000_000);
    });
    it('un déficit DANS la fenêtre reste imputé', async () => {
        const { s } = service({
            balances: {
                A2025: [ligne('13100000', 5_000_000)],
                N: [ligne('13100000', -20_000_000)],
            },
            exercices: [
                { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
                { id: 'A2025', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
            ],
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.deficitAnterieur.montant).toBe(5_000_000);
        expect(r.resultatFiscal).toBe(15_000_000);
    });
    it('une société DÉFICITAIRE sans chiffre d’affaires n’est plus dite imposée au taux de 30 %', async () => {
        const { s } = service({
            balances: { N: [ligne('77100000', -1_000_000), ligne('62100000', 3_000_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.chiffreAffaires).toBe(0);
        expect(r.impotDu).toBe(0);
        expect(r.explication).toContain('RÉSULTAT DÉFICITAIRE');
        expect(r.explication).toContain('article 57');
        expect(r.explication).not.toContain('supérieur à l’impôt minimum');
        expect(r.explication).toContain('701 à 707');
    });
});
describe('Rapprochement du 4492 · les deux sens de l’écart (art. 110, al. 2)', () => {
    const suivi = (declares, comptabilises) => fiscalite_service_1.FiscaliteService.suiviAcomptes({ acomptesDus: true, declares, comptabilises, impotDu: null });
    it("LE COMPTE PORTE MOINS · l'amende de l'art. 98 bis est nommée, c'est le sens où elle vaut", () => {
        const o = suivi(3_000_000, 1_000_000).observations.join(' ');
        expect(o).toContain('art. 98 bis');
        expect(o).toContain('MOINS QUE CE QUI EST DÉCLARÉ');
        expect(o).not.toContain('art. 110');
    });
    it("LE COMPTE PORTE PLUS · l'amende n'est PAS nommée, et c'est la correction de la passe", () => {
        const o = suivi(1_000_000, 3_000_000).observations.join(' ');
        expect(o).toContain('PLUS QUE CE QUI EST DÉCLARÉ');
        expect(o).toContain("n'est PAS une insuffisance de versement");
        expect(o).toContain("l'amende de l'art. 98 bis ne s'y applique pas");
    });
    it('LE COMPTE PORTE PLUS · la consignation du dixième est nommée avec son article et sa limite', () => {
        const o = suivi(1_000_000, 3_000_000).observations.join(' ');
        expect(o).toContain('art. 110, alinéa 2');
        expect(o).toContain('DIXIÈME');
        expect(o).toContain("taxation d'office");
        expect(o).toContain('appartient au cabinet');
    });
    it("un écart nul ne produit aucune des deux phrases", () => {
        expect(suivi(2_000_000, 2_000_000).observations.join(' ')).not.toContain('diffèrent de');
    });
});
describe('Passe F6 · la note de recherche énonce l’arrondi de l’art. 150 en deux temps', () => {
    const note = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../docs/fiscalite-asbl-rdc.md'), 'utf8');
    it('porte l’alinéa 1, la décimale, avant la tranche', () => {
        expect(note).toContain('en DEUX temps');
        expect(note).toContain('première décimale est\nsupérieure ou égale à 5');
        expect(note).toContain('alinéas 2 et 3');
    });
    it('donne le cas chiffré qui sépare les deux lectures, et il est celui du test du code', () => {
        expect(note).toContain('1 234 549,5');
        expect(note).toContain('1 234 600');
        expect((0, fiscalite_service_1.arrondirImpotArt150)(1_234_549.5)).toBe(1_234_600);
    });
});
describe('Passe F13 · la simulation d’avant 2026 ne fonde pas les acomptes', () => {
    const balance = [ligne('13100000', -10_000_000)];
    const exercice2025 = [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }];
    it('l’avertissement de simulation interdit aussi d’y asseoir les acomptes', async () => {
        const { s } = service({ balances: { A: balance }, exercices: exercice2025 });
        const texte = (await s.resultatFiscal('t1', 'A')).observations.join(' | ');
        expect(texte).toContain('BASE AUX ACOMPTES PROVISIONNELS');
        expect(texte).toContain("l'impôt déclaré au titre de l'exercice précédent");
    });
    it('sur 2025, la base servie est dite NON légale ; sur 2026, elle reste la première branche', async () => {
        const a = service({ balances: { A: balance }, exercices: exercice2025 });
        const t2025 = (await a.s.resultatFiscal('t1', 'A')).observations.join(' | ');
        const b = service({ balances: { N: balance } });
        const t2026 = (await b.s.resultatFiscal('t1', 'N')).observations.join(' | ');
        expect(t2025).toContain('Art. 57 bis, al. 1er : la base des acomptes');
        expect(t2026).toContain('Art. 57 bis, al. 1er : la base des acomptes');
        expect(t2025).toContain("N'EST PAS la base légale");
        expect(t2025).not.toContain('La base servie ci-dessous est la première branche');
        expect(t2026).toContain('La base servie ci-dessous est la première branche');
    });
});
describe('Lecture du livre-journal · brouillard et écriture de clôture (F6)', () => {
    const ex = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    it('un exercice clos rend son chiffre d’affaires du livre-journal, écriture de clôture comprise', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -1000), ligne('60110000', 400)] },
            clotures: { N: [ligne('70110000', 1000), ligne('60110000', -400), ligne('13100000', -600)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(['chiffreAffaires', r.chiffreAffaires]).toEqual(['chiffreAffaires', 1000]);
        expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 600]);
    });
    it('un exercice clos lit son résultat dans les classes 6 à 8 AVANT leur solde, pas dans un 13 qui porte encore N-1 (régression de F4)', async () => {
        const { s } = service({
            balances: { N: [ligne('13100000', -5_000), ligne('70110000', -1000), ligne('60110000', 400)] },
            clotures: { N: [ligne('70110000', 1000), ligne('60110000', -400), ligne('13100000', -600)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(['sourceResultat', r.sourceResultat]).toEqual(['sourceResultat', 'CLASSES_6_7_8']);
        expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 600]);
    });
    it('une écriture au brouillard ne change pas l’impôt', async () => {
        const lignesN = [ligne('70110000', -1_000_000), ligne('60110000', 200_000)];
        const sans = await service({ balances: { N: lignesN } }).s.resultatFiscal('t1', 'N');
        const avec = await service({
            balances: { N: lignesN },
            brouillards: { N: [ligne('70110000', -5_000_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(['impotDu', avec.impotDu]).toEqual(['impotDu', sans.impotDu]);
        expect(['chiffreAffaires', avec.chiffreAffaires]).toEqual(['chiffreAffaires', 1_000_000]);
    });
    it('l’historique de l’art. 113 lit les chiffres d’affaires RÉELS des exercices clos', async () => {
        const { s } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            exercices: [ex('N-1', 2025), ex('N', 2026)],
            balances: { 'N-1': [ligne('70110000', -400_000_000)], N: [ligne('70110000', -100_000_000)] },
            clotures: { 'N-1': [ligne('70110000', 400_000_000), ligne('13100000', -400_000_000)] },
            dossier: { natureActivite: 'VENTE' },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(['regime', r.regime]).toEqual(['regime', 'IRPP_REGIME_REEL']);
    });
});
describe('Passes F11 et O1a · le 4492 et la succursale', () => {
    it('F11-B7 · un 4492 qui porte PLUS nomme aussi la retenue sur loyers subie, imputée sur l’IRL', () => {
        const o = fiscalite_service_1.FiscaliteService.suiviAcomptes({
            acomptesDus: true,
            declares: 1_000_000,
            comptabilises: 3_000_000,
            impotDu: null,
        }).observations.join(' ');
        expect(o).toContain('TROIS CAUSES À EXAMINER');
        expect(o).toContain('la loi n° 83/004, art. 11, appelle chacune « acompte »');
    });
    it('O1a-B1 · une succursale ne se lit plus comme l’établissement d’une société non-résidente', async () => {
        const { s } = service({ forme: client_1.FormeJuridiqueSyscohada.SUCCURSALE, balances: { N: [] } });
        const r = await s.resultatFiscal('t1', 'N');
        const o = r.observations.join(' ');
        expect(o).toContain('SI ce propriétaire est une société non-résidente');
        expect(o).toContain('(AUSCGIE, art. 116)');
    });
});
describe('Ligne A11 · le 899 lu à part de l’impôt constaté', () => {
    it('899 crédité, le module reste passable · aucune réintégration exigée, le dégrèvement nommé', async () => {
        const { s } = service({
            balances: {
                N: [ligne('70110000', -10_000_000), ligne('60110000', 2_000_000), ligne('89910000', -500_000)],
            },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotConstateAu89).toBe(0);
        expect(r.degrevementsAu899).toBe(500_000);
        const o = r.observations.join(' ');
        expect(o).toMatch(/DÉGRÈVEMENT AU 899/);
        expect(o).not.toMatch(/IMPÔT NON RÉINTÉGRÉ/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({
            formeJuridique: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            regime: r.regime,
            impotDu: r.impotDu,
            minimumApplique: r.minimumApplique,
            simulationAvantLaLoi: false,
            exerciceClos: false,
            brouillardGestion: 0,
            impotDejaConstate: r.impotExerciceAu89,
            impotConstateAu89: r.impotConstateAu89,
            reintegrationsImpot: r.reintegrationsImpot,
            attestationRegime: null,
        })).toEqual([]);
    });
    it('un 892 débité sans sa réintégration reste signalé · le rappel est de l’impôt constaté', async () => {
        const { s } = service({
            balances: { N: [ligne('70110000', -10_000_000), ligne('60110000', 2_000_000), ligne('89200000', 300_000)] },
        });
        const r = await s.resultatFiscal('t1', 'N');
        expect(r.impotConstateAu89).toBe(300_000);
        expect(r.observations.join(' ')).toMatch(/IMPÔT NON RÉINTÉGRÉ/);
    });
});
describe('Cas chiffrés IS · C05, report rejoué dans l’ordre (art. 51)', () => {
    const ex = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    const exercices = [ex('A2026', 2026), ex('A2027', 2027), ex('A2028', 2028), ex('A2029', 2029), ex('A2030', 2030)];
    const balances = {
        A2026: [ligne('70110000', -10_000_000), ligne('60410000', 10_100_000)],
        A2027: [ligne('70110000', -10_000_000), ligne('60410000', 10_500_000)],
        A2028: [ligne('70110000', -10_000_000), ligne('60410000', 9_940_000)],
        A2029: [ligne('70110000', -10_000_000), ligne('60410000', 9_970_000)],
        A2030: [ligne('70110000', -10_000_000), ligne('60410000', 9_000_000)],
    };
    it('2030 · déficit imputé 500 000, impôt 150 000 (OmegaX rendait 410 000 et 177 000)', async () => {
        const r = await service({ exercices, balances }).s.resultatFiscal('t1', 'A2030');
        expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 500_000]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 150_000]);
        expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([45_000, 45_000, 30_000]);
    });
    it('le même bénéfice ne se réimpute pas · vu de 2029, 540 000 restent, dont 40 000 de 2026', async () => {
        const r = await service({ exercices, balances }).s.resultatFiscal('t1', 'A2029');
        expect(r.deficitAnterieur.montant).toBe(540_000);
        expect(r.deficitAnterieur.detail.map((d) => d.montant)).toEqual([40_000, 500_000]);
        expect(r.impotDu).toBe(100_000);
    });
});
describe('Cas chiffrés IS · C09 et C10, premier exercice long (art. 12, al. 3)', () => {
    const premier = (debut, fin) => [
        { id: 'P', dateDebut: new Date(Date.UTC(...debut)), dateFin: new Date(Date.UTC(...fin)) },
    ];
    it('C09 · période de création 300 000 (minimum), premier exercice clos 1 500 000, acomptes 2027 de 90 000, 90 000, 60 000', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation).not.toBeNull();
        expect(r.periodeCreation.resultatFiscal).toBe(100_000);
        expect(r.periodeCreation.impotDu).toBe(300_000);
        expect(r.periodeCreation.minimumApplique).toBe(true);
        expect(r.periodeCreation.acomptesExercice.map((a) => [a.montant, a.annee])).toEqual([
            [90_000, 2027],
            [90_000, 2027],
            [60_000, 2027],
        ]);
        expect(['resultatFiscal', r.resultatFiscal]).toEqual(['resultatFiscal', 5_000_000]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 1_500_000]);
        expect(['impotTotalExercice', r.impotTotalExercice]).toEqual(['impotTotalExercice', 1_800_000]);
        expect(r.chiffreAffaires).toBe(70_000_000);
        expect(['chiffreAffairesMinimum', r.chiffreAffairesMinimum]).toEqual(['chiffreAffairesMinimum', 40_000_000]);
        expect(['impotMinimum', r.impotMinimum]).toEqual(['impotMinimum', 400_000]);
        expect(r.minimumApplique).toBe(false);
        expect(r.observations.join(' ')).toMatch(/Ici · 70\s000\s000,00 pour l'exercice, 30\s000\s000,00 pour la période, 40\s000\s000,00 retenus pour le minimum du premier exercice clos\./u);
        expect(r.observations.join(' ')).not.toContain('à faire confirmer');
        expect(r.simulationAvantLaLoi).toBe(false);
        expect(r.observations.join(' ')).not.toContain("AUCUN acompte n'est dû");
        expect(r.observations.join(' ')).toContain('Art. 12, al. 3 et art. 57 bis LPF');
    });
    it('C09 · un bénéfice fiscal DÉCLARÉ pour la période prime sur la lecture du livre-journal', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
            dossier: { resultatPeriodeCreationSaisi: 1_100_000 },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.source).toBe('DECLARE');
        expect(r.periodeCreation.impotDu).toBe(330_000);
        expect(r.resultatFiscal).toBe(4_000_000);
        expect(r.periodeCreation.sourceChiffreAffaires).toBe('LIVRE_JOURNAL');
        expect(r.observations.join(' ')).toContain("lu au livre-journal au 31 décembre de l'année de création · le bénéfice de la période est déclaré, son chiffre d'affaires ne l'est pas");
    });
    it('mineur C09 · le chiffre d’affaires DÉCLARÉ avec le bénéfice assied le minimum de la période et se retranche du premier exercice clos', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
            dossier: { resultatPeriodeCreationSaisi: 100_000, chiffreAffairesPeriodeCreationSaisi: 25_000_000 },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.sourceChiffreAffaires).toBe('DECLARE');
        expect(r.periodeCreation.chiffreAffaires).toBe(25_000_000);
        expect(r.periodeCreation.chiffreAffairesLu).toBe(30_000_000);
        expect(r.periodeCreation.impotMinimum).toBe(250_000);
        expect(r.chiffreAffairesMinimum).toBe(45_000_000);
        expect(r.observations.join(' ')).toContain("celui que le cabinet DÉCLARE pour la période");
    });
    it('mineur C09 · un chiffre d’affaires sans bénéfice déclaré est refusé ; le bénéfice retiré emporte le chiffre d’affaires', async () => {
        const { s } = service({ exercices: premier([2026, 8, 1], [2027, 11, 31]), balances: { P: [] }, dossier: {} });
        await expect(s.modifierDossier('t1', 'P', { chiffreAffairesPeriodeCreationSaisi: 25_000_000 })).rejects.toThrow("se déclare avec son bénéfice fiscal");
        const t = service({ exercices: premier([2026, 8, 1], [2027, 11, 31]), balances: { P: [] }, dossier: {} });
        await t.s.modifierDossier('t1', 'P', { resultatPeriodeCreationSaisi: null });
        expect(t.crees[0]).toEqual(expect.objectContaining({ resultatPeriodeCreationSaisi: null, chiffreAffairesPeriodeCreationSaisi: null }));
    });
    it('une perte de la période de création ne vient pas en déduction (« ces bénéfices »), et la règle se dit avec ses articles', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 66_000_000)] },
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 31_000_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.deduction).toBe(0);
        expect(r.resultatFiscal).toBe(4_000_000);
        const texte = r.observations.join(' ');
        expect(texte).toContain("PERTE DE LA PÉRIODE DE CRÉATION · elle n'est ni déduite ni reportée à part");
        expect(texte).toMatch(/art\. 12, al\. 3.*« ces bénéfices ».*art\. 51.*« les pertes constatées au cours d'un exercice ».*art\. 52, 2°/);
    });
    it('une période BÉNÉFICIAIRE ne fait pas dire la règle de la perte', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.observations.join(' ')).not.toContain('PERTE DE LA PÉRIODE DE CRÉATION');
    });
    it('C09 bis · minimum du premier exercice clos 200 000 sur 20 000 000 (1 000 000 avant), total 1 000 000, acomptes rejoués', async () => {
        const r = await service({
            exercices: premier([2026, 8, 1], [2027, 11, 31]),
            balances: { P: [ligne('70110000', -100_000_000), ligne('60410000', 99_000_000)] },
            balancesAu: { P: [ligne('70110000', -80_000_000), ligne('60410000', 79_500_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.resultatFiscal).toBe(500_000);
        expect(r.periodeCreation.impotTheorique).toBe(150_000);
        expect(r.periodeCreation.impotMinimum).toBe(800_000);
        expect(r.periodeCreation.impotDu).toBe(800_000);
        expect(r.periodeCreation.minimumApplique).toBe(true);
        expect(r.periodeCreation.acomptesExercice.map((a) => [a.montant, a.annee])).toEqual([
            [240_000, 2027],
            [240_000, 2027],
            [160_000, 2027],
        ]);
        expect(r.resultatFiscal).toBe(500_000);
        expect(r.chiffreAffairesMinimum).toBe(20_000_000);
        expect(r.impotTheorique).toBe(150_000);
        expect(['impotMinimum', r.impotMinimum]).toEqual(['impotMinimum', 200_000]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 200_000]);
        expect(r.minimumApplique).toBe(true);
        expect(['impotTotalExercice', r.impotTotalExercice]).toEqual(['impotTotalExercice', 1_000_000]);
        expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([60_000, 60_000, 40_000]);
    });
    it('la règle du chiffre d’affaires du minimum · retranchée, jamais négative', () => {
        expect((0, periode_creation_1.chiffreAffairesMinimumPremierExercice)(70_000_000, 30_000_000)).toBe(40_000_000);
        expect((0, periode_creation_1.chiffreAffairesMinimumPremierExercice)(100_000_000.55, 80_000_000.3)).toBe(20_000_000.25);
        expect((0, periode_creation_1.chiffreAffairesMinimumPremierExercice)(10_000_000, 12_000_000)).toBe(0);
    });
    it('un premier exercice ouvert au premier semestre n’est pas le cas de l’art. 12, al. 3', async () => {
        const r = await service({
            exercices: premier([2026, 2, 1], [2026, 11, 31]),
            balances: { P: [ligne('70110000', -40_000_000), ligne('60410000', 38_000_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation).toBeNull();
        expect(r.impotDu).toBe(600_000);
    });
    it('C10 · créée en 2025 · impôt du premier exercice clos 1 500 000 sous la loi, période de 2025 non chiffrée', async () => {
        const r = await service({
            exercices: premier([2025, 8, 1], [2026, 11, 31]),
            balances: { P: [ligne('70110000', -60_000_000), ligne('60410000', 54_000_000)] },
            balancesAu: { P: [ligne('70110000', -10_000_000), ligne('60410000', 9_000_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.simulationAvantLaLoi).toBe(false);
        expect(r.periodeCreation.sousLaLoi).toBe(false);
        expect(r.periodeCreation.impotDu).toBeNull();
        expect(r.periodeCreation.acomptesExercice).toEqual([]);
        expect(r.impotDu).toBe(1_500_000);
        expect(r.chiffreAffairesMinimum).toBe(50_000_000);
        expect(r.impotMinimum).toBe(500_000);
        expect(r.impotTotalExercice).toBeNull();
        const texte = r.observations.join(' ');
        expect(texte).toContain('PREMIER EXERCICE LONG OUVERT AVANT LA LOI');
        expect(texte).not.toContain("EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR");
    });
    it('A11 · deux impositions, l’écriture se refuse en nommant les deux lignes', () => {
        const motifs = (0, ecriture_impot_resultat_1.motifsRefusConstat)({
            formeJuridique: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            regime: 'IMPOT_SOCIETES',
            impotDu: 1_500_000,
            minimumApplique: false,
            simulationAvantLaLoi: false,
            exerciceClos: false,
            brouillardGestion: 0,
            impotDejaConstate: 0,
            impotConstateAu89: 0,
            reintegrationsImpot: 0,
            attestationRegime: undefined,
            periodeCreation: {
                dateFin: new Date(Date.UTC(2026, 11, 31)),
                dateFinExercice: new Date(Date.UTC(2027, 11, 31)),
                impotDu: 300_000,
                minimumApplique: true,
            },
        });
        const texte = motifs.join(' ');
        expect(texte).toContain('art. 12, al. 3');
        expect(texte).toContain('89500000');
        expect(texte).toContain('89110000');
        expect(texte).toMatch(/1\s800\s000,00 au 441/u);
        expect(texte).toContain('au 2026-12-31 (période de création)');
        expect(texte).toContain('au 2027-12-31 (premier exercice clos)');
    });
    it('le report rejoue la BASE du premier exercice long, période de création déduite', async () => {
        const r = await service({
            exercices: [
                { id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
                { id: 'A2028', dateDebut: new Date(Date.UTC(2028, 0, 1)), dateFin: new Date(Date.UTC(2028, 11, 31)) },
            ],
            balances: { P: [ligne('60410000', 1_000_000)], A2028: [ligne('70110000', -5_000_000)] },
            balancesAu: { P: [ligne('70110000', -2_000_000)] },
        }).s.resultatFiscal('t1', 'A2028');
        expect(r.periodeCreation).toBeNull();
        expect(r.deficitAnterieur.montant).toBe(3_000_000);
    });
    it('C10 · la perte du premier exercice long ouvert en 2025 n’est pas une simulation · aucun avertissement en 2027', async () => {
        const r = await service({
            exercices: [
                { id: 'P', dateDebut: new Date(Date.UTC(2025, 8, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
                { id: 'A2027', dateDebut: new Date(Date.UTC(2027, 0, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
            ],
            balances: { P: [ligne('60410000', 600_000)], A2027: [ligne('70110000', -5_000_000)] },
            balancesAu: { P: [] },
        }).s.resultatFiscal('t1', 'A2027');
        expect(r.deficitAnterieur.montant).toBe(600_000);
        expect(r.deficitAnterieur.detail[0].simulation).toBe(false);
        expect(r.deficitImpute).toBe(600_000);
        expect(r.observations.join(' ')).not.toContain("DÉFICIT D'AVANT LA LOI");
    });
});
describe('Cas chiffrés IS · hypothèses dites (C01-bis, C02, C12a, C15)', () => {
    it('C01-bis · le brouillard est dit, chiffré, et le calcul n’est pas définitif', async () => {
        const r = await service({
            balances: { N: [ligne('70110000', -10_000_000)] },
            brouillards: { N: [ligne('60410000', 8_000_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.impotDu).toBe(3_000_000);
        expect(r.definitif).toBe(false);
        expect(r.brouillard).toEqual({ ecritures: 1, effetSurResultat: -8_000_000, effetSurChiffreAffaires: 0 });
        expect(r.observations[0]).toContain('CHIFFRE PROVISOIRE');
    });
    it('C01-bis · sans brouillard, le calcul est dit définitif et rien n’est annoncé', async () => {
        const r = await service({ balances: { N: [ligne('70110000', -10_000_000)] } }).s.resultatFiscal('t1', 'N');
        expect(r.definitif).toBe(true);
        expect(r.observations.join(' ')).not.toContain('CHIFFRE PROVISOIRE');
    });
    it('C02 · le chiffre d’affaires lu est dit dans toutes les branches et sur les plafonds', async () => {
        const r = await service({
            balances: { N: [ligne('70110000', -100_000_000), ligne('60410000', 60_000_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.explication).toContain('701 à 707');
        const plafondDons = r.plafonds.find((p) => p.assiette === 'CHIFFRE_AFFAIRES');
        expect(plafondDons?.enonce).toContain('701 à 707');
    });
    it('C12a · égaux après arrondi seulement · le libellé le dit, le montant et le compte ne bougent pas', async () => {
        const r = await service({
            balances: { N: [ligne('70110000', -123_456_789), ligne('60410000', 119_341_567)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.impotDu).toBe(1_234_600);
        expect(r.minimumApplique).toBe(false);
        expect(r.explication).toContain("APRÈS l'arrondi de l'art. 150");
        expect(r.explication).toContain('compte 895');
    });
    it('C15 · un déficit d’avant 2026 imputé porte son avertissement dans la vue 2026', async () => {
        const r = await service({
            exercices: [
                { id: 'A2025', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
                { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
            ],
            balances: {
                A2025: [ligne('70110000', -10_000_000), ligne('60410000', 12_000_000)],
                N: [ligne('70110000', -30_000_000), ligne('60410000', 25_000_000)],
            },
        }).s.resultatFiscal('t1', 'N');
        expect(r.deficitImpute).toBe(2_000_000);
        expect(r.impotDu).toBe(900_000);
        expect(r.deficitAnterieur.detail[0].simulation).toBe(true);
        expect(r.observations.join(' ')).toContain("DÉFICIT D'AVANT LA LOI, RECALCULÉ");
    });
});
describe('Cas chiffrés IS, second tour · le rejeu du report', () => {
    const an = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    it('B1 · une entreprise individuelle n’a pas de période de création · aucun déficit inventé en 2028', async () => {
        const r = await service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            exercices: [
                { id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
                an('A2028', 2028),
            ],
            balances: { P: [ligne('70110000', -400_000)], A2028: [ligne('70110000', -2_000_000)] },
            balancesAu: { P: [ligne('70110000', -1_000_000)] },
            dossier: { natureActivite: 'VENTE' },
        }).s.resultatFiscal('t1', 'A2028');
        expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 0]);
    });
    const casB2 = (dossier2026) => service({
        exercices: [an('A2025', 2025), an('A2026', 2026), an('A2027', 2027)],
        balances: {
            A2025: [ligne('60410000', 1_000_000)],
            A2026: [ligne('70110000', -300_000)],
            A2027: [ligne('70110000', -2_000_000)],
        },
        dossiers: { A2026: dossier2026 },
    }).s.resultatFiscal('t1', 'A2027');
    it('B2 · la saisie à l’ouverture de 2026 fait foi · 2027 voit 100 000, pas 700 000', async () => {
        const r = await casB2({ deficitAnterieurSaisi: 400_000, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 400_000 }] });
        expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 100_000]);
        expect(r.deficitAnterieur.detail[0]).toMatchObject({ declare: true, bornePrudente: false });
        expect(r.observations.join(' ')).not.toContain("DÉFICIT D'AVANT LA LOI");
    });
    it('B2 · sans origine dite, la saisie est bornée par prudence et le reste perdu est NOMMÉ', async () => {
        const r = await casB2({ deficitAnterieurSaisi: 400_000 });
        expect(r.deficitAnterieur.montant).toBe(0);
        expect(r.observations.join(' ')).toContain('REPORT PERDU PAR PRUDENCE');
    });
    it('P1 · dossier repris en 2026 avec 800 000 déclarés, 300 000 de bénéfice · 500 000 restent en 2027', async () => {
        const r = await service({
            exercices: [an('A2026', 2026), an('A2027', 2027)],
            balances: { A2026: [ligne('70110000', -300_000)], A2027: [ligne('70110000', -2_000_000)] },
            dossiers: {
                A2026: {
                    deficitAnterieurSaisi: 800_000,
                    deficitAnterieurOrigines: [
                        { dateFin: '2024-12-31', montant: 300_000 },
                        { dateFin: '2025-12-31', montant: 500_000 },
                    ],
                },
            },
        }).s.resultatFiscal('t1', 'A2027');
        expect(r.deficitAnterieur.montant).toBe(500_000);
        expect(r.deficitImpute).toBe(500_000);
    });
    it('P1 · sans origine dite, le reste qui demeure imputable est dit borné par prudence', async () => {
        const r = await service({
            exercices: [an('A2026', 2026), an('A2027', 2027), an('A2028', 2028)],
            balances: {
                A2026: [ligne('70110000', -100_000)],
                A2027: [ligne('70110000', -300_000)],
                A2028: [ligne('70110000', -2_000_000)],
            },
            dossiers: { A2027: { deficitAnterieurSaisi: 800_000 } },
        }).s.resultatFiscal('t1', 'A2028');
        expect(r.deficitAnterieur.montant).toBe(0);
        expect(r.observations.join(' ')).toMatch(/REPORT PERDU PAR PRUDENCE · 500\s000/u);
    });
    it('C15 · l’avertissement demande le reste à reporter à l’ouverture', async () => {
        const r = await service({
            exercices: [an('A2025', 2025), an('N', 2026)],
            balances: { A2025: [ligne('60410000', 2_000_000)], N: [ligne('70110000', -5_000_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toContain("le reste à reporter à l'ouverture de cet exercice");
    });
    it('(8) · des exercices non jointifs dans la fenêtre sont nommés', async () => {
        const r = await service({
            exercices: [an('A2024', 2024), an('N', 2026)],
            balances: { A2024: [ligne('60410000', 1_000)], N: [ligne('70110000', -5_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.observations.join(' ')).toContain('EXERCICES NON JOINTIFS');
        expect(r.observations.join(' ')).toContain('du 2025-01-01 au 2025-12-31');
    });
});
describe('Cas chiffrés IS, second tour · la période de création', () => {
    const P = [{ id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) }];
    const balances = { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] };
    it('(2) · l’impôt passé au 31/12 ne minore pas la lecture de la période (art. 45)', async () => {
        const r = await service({
            exercices: P,
            balances,
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000), ligne('89500000', 300_000)] },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.resultatComptable).toBe(100_000);
        expect(r.periodeCreation.impotDu).toBe(300_000);
        expect(r.periodeCreation.impotNeutralise).toBe(300_000);
    });
    it('(1) · un bénéfice déclaré qui s’écarte du livre-journal est signalé avec son écart', async () => {
        const r = await service({
            exercices: P,
            balances,
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
            dossier: { resultatPeriodeCreationSaisi: 1_100_000 },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.ecartDeclaration).toBe(1_000_000);
        expect(r.observations.join(' ')).toContain('BÉNÉFICE DÉCLARÉ DE LA PÉRIODE DE CRÉATION');
    });
    it('(5) · les suppléments sur l’impôt de la période entrent dans la base des acomptes de 2027', async () => {
        const r = await service({
            exercices: P,
            balances,
            balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
            dossier: { supplementsPeriodeCreation: 100_000 },
        }).s.resultatFiscal('t1', 'P');
        expect(r.periodeCreation.baseAcomptesExercice).toBe(400_000);
        expect(r.periodeCreation.acomptesExercice.map((a) => a.montant)).toEqual([120_000, 120_000, 80_000]);
    });
    it('(6) · période d’impôt nul · aucune ligne à zéro, l’écriture ordinaire passe', () => {
        const motifs = (0, ecriture_impot_resultat_1.motifsRefusConstat)({
            formeJuridique: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            regime: 'IMPOT_SOCIETES',
            impotDu: 1_500_000,
            minimumApplique: false,
            simulationAvantLaLoi: false,
            exerciceClos: false,
            brouillardGestion: 0,
            impotDejaConstate: 0,
            impotConstateAu89: 0,
            reintegrationsImpot: 0,
            attestationRegime: undefined,
            periodeCreation: {
                dateFin: new Date(Date.UTC(2026, 11, 31)),
                dateFinExercice: new Date(Date.UTC(2027, 11, 31)),
                impotDu: 0,
                minimumApplique: false,
            },
        });
        expect(motifs).toEqual([]);
    });
    it('(7) · sur un exercice clos, le report déclaré et la période de création ne changent plus', async () => {
        const { s } = service({
            exercices: [{ ...P[0], statut: 'CLOTURE' }],
            balances,
        });
        await expect(s.modifierDossier('t1', 'P', { deficitAnterieurSaisi: 10 })).rejects.toThrow('exercice ouvert suivant');
        await expect(s.modifierDossier('t1', 'P', { resultatPeriodeCreationSaisi: 10 })).rejects.toThrow('clôturé');
    });
    it('(7) · l’origine d’un déficit doit totaliser la saisie', async () => {
        const { s } = service({ exercices: P, balances });
        await expect(s.modifierDossier('t1', 'P', { deficitAnterieurSaisi: 100, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 90 }] })).rejects.toThrow('totalise');
    });
});
describe('Cas chiffrés IS, dernière correction · une origine hors fenêtre (art. 51)', () => {
    const an = (id, annee, statut) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
        statut,
    });
    it('2026, résultat 1 000 000, saisie de 500 000 d’origine 2021 · rien imputé, impôt 300 000, dit', async () => {
        const r = await service({
            exercices: [an('N', 2026)],
            balances: { N: [ligne('70110000', -1_000_000)] },
            dossier: { deficitAnterieurSaisi: 500_000, deficitAnterieurOrigines: [{ dateFin: '2021-12-31', montant: 500_000 }] },
        }).s.resultatFiscal('t1', 'N');
        expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 0]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 300_000]);
        expect(r.deficitAnterieur.montantSaisi).toBe(500_000);
        expect(r.observations.join(' ')).toContain('PERTE DÉCLARÉE HORS FENÊTRE');
        expect(r.observations.join(' ')).toContain('2024-12-31');
    });
    it('seule la part couverte par sa fenêtre s’impute', async () => {
        const r = await service({
            exercices: [an('N', 2026)],
            balances: { N: [ligne('70110000', -1_000_000)] },
            dossier: {
                deficitAnterieurSaisi: 800_000,
                deficitAnterieurOrigines: [
                    { dateFin: '2021-12-31', montant: 500_000 },
                    { dateFin: '2024-12-31', montant: 300_000 },
                ],
            },
        }).s.resultatFiscal('t1', 'N');
        expect(r.deficitImpute).toBe(300_000);
        expect(r.impotDu).toBe(210_000);
    });
    it('modifierDossier refuse une origine hors fenêtre en citant l’art. 51 et la date de fin', async () => {
        const { s } = service({ exercices: [an('N', 2026)], balances: { N: [] } });
        await expect(s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 500_000, deficitAnterieurOrigines: [{ dateFin: '2021-12-31', montant: 500_000 }] })).rejects.toThrow(/art\. 51.*2024-12-31/s);
    });
    it('le message « par prudence » renvoie à l’exercice ouvert suivant quand l’exercice de la saisie est clos', async () => {
        const r = await service({
            exercices: [an('A2027', 2027, 'CLOTURE'), an('A2028', 2028)],
            balances: { A2027: [ligne('70110000', -300_000)], A2028: [ligne('70110000', -2_000_000)] },
            dossiers: { A2027: { deficitAnterieurSaisi: 800_000 } },
        }).s.resultatFiscal('t1', 'A2028');
        const texte = r.observations.join(' ');
        expect(texte).toContain('REPORT PERDU PAR PRUDENCE');
        expect(texte).toContain("exercice OUVERT suivant");
        expect(texte).not.toContain("déclarez leur origine sur l'exercice de la saisie");
    });
});
describe('Cas chiffrés IS, troisième tour · relecture adverse', () => {
    const an = (id, annee) => ({
        id,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
    });
    it('V3 · une gestion qui se solde à zéro lit zéro, jamais l’à-nouveau du 13', async () => {
        const r = await service({
            balances: { N: [ligne('70110000', -1_000_000), ligne('60410000', 1_000_000)] },
            reports: { N: [ligne('13900000', 300_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
        expect(r.sourceResultat).toBe('CLASSES_6_7_8');
        expect(r.observations.join(' ')).not.toContain('RÉSULTAT LU SUR LE COMPTE 13');
    });
    it('un 13 qui ne porte que l’à-nouveau ne fait pas le résultat d’un exercice sans gestion', async () => {
        const r = await service({ balances: { N: [] }, reports: { N: [ligne('13900000', 300_000)] } }).s.resultatFiscal('t1', 'N');
        expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
    });
    it('le 13 lu porte aussi l’à-nouveau · le montant reste lu sur le solde, et l’à-nouveau est dit', async () => {
        const r = await service({
            balances: { N: [ligne('13100000', -800)] },
            reports: { N: [ligne('13900000', 300_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(r.sourceResultat).toBe('COMPTE_13');
        expect(r.resultatComptable).toBe(-299_200);
        expect(r.observations.join(' ')).toContain('RÉSULTAT LU SUR LE COMPTE 13');
    });
    it('exercice sans gestion dont l’affectation solde l’à-nouveau du 13 · résultat nul, rien à dire', async () => {
        const r = await service({
            balances: { N: [ligne('13900000', -300_000)] },
            reports: { N: [ligne('13900000', 300_000)] },
        }).s.resultatFiscal('t1', 'N');
        expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
        expect(r.observations.join(' ')).not.toContain('RÉSULTAT LU SUR LE COMPTE 13');
    });
    it('V3 · 2030 n’impute que la perte de 2027 (N-3), celle de 2026 (N-4) étant éteinte · impôt 240 000', async () => {
        const zero = [ligne('70110000', -1_000_000), ligne('60410000', 1_000_000)];
        const { s } = service({
            exercices: [an('A2026', 2026), an('A2027', 2027), an('A2028', 2028), an('A2029', 2029), an('A2030', 2030)],
            balances: {
                A2026: [ligne('70110000', -1_000_000), ligne('60410000', 1_100_000)],
                A2027: [ligne('70110000', -1_000_000), ligne('60410000', 1_200_000)],
                A2028: zero,
                A2029: zero,
                A2030: [ligne('70110000', -2_000_000), ligne('60410000', 1_000_000)],
            },
            reports: {
                A2027: [ligne('13900000', 100_000)],
                A2028: [ligne('13900000', 300_000)],
                A2029: [ligne('13900000', 300_000)],
                A2030: [ligne('13900000', 300_000)],
            },
        });
        const r2029 = await s.resultatFiscal('t1', 'A2029');
        expect(['2029', r2029.resultatComptable, r2029.deficitAnterieur.montant]).toEqual(['2029', 0, 300_000]);
        const r = await s.resultatFiscal('t1', 'A2030');
        expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 200_000]);
        expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 200_000]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 240_000]);
    });
    it('une saisie changée seule emporte l’origine qui ne la ventile plus', async () => {
        const origines = [
            { dateFin: '2024-12-31', montant: 500_000 },
            { dateFin: '2025-12-31', montant: 300_000 },
        ];
        const change = service({ balances: { N: [] }, dossier: { deficitAnterieurSaisi: 800_000, deficitAnterieurOrigines: origines } });
        await change.s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 600_000 });
        expect(change.crees[0].deficitAnterieurOrigines).toBe(client_1.Prisma.DbNull);
        const meme = service({ balances: { N: [] }, dossier: { deficitAnterieurSaisi: 800_000, deficitAnterieurOrigines: origines } });
        await meme.s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 800_000 });
        expect('deficitAnterieurOrigines' in meme.crees[0]).toBe(false);
    });
    it('une origine qui ne totalise plus la saisie ne fait pas foi · le rejeu retombe sur la borne prudente, et le dit', async () => {
        const { s } = service({
            exercices: [an('A2026', 2026), an('A2027', 2027)],
            balances: { A2026: [ligne('70110000', -100_000)], A2027: [ligne('70110000', -2_000_000)] },
            dossiers: {
                A2026: { deficitAnterieurSaisi: 600_000, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 800_000 }] },
            },
        });
        const r2026 = await s.resultatFiscal('t1', 'A2026');
        expect(r2026.deficitAnterieur.origines).toBeNull();
        const r = await s.resultatFiscal('t1', 'A2027');
        expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 0]);
        expect(['impotDu', r.impotDu]).toEqual(['impotDu', 600_000]);
        expect(r.observations.join(' ')).toContain('REPORT PERDU PAR PRUDENCE');
    });
});
describe('loi n° 23/053, art. 12 al. 4 · bilans successifs DITS, jamais totalisés (décision par la loi du 2026-10-07, point 2)', () => {
    const j = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
    const exercices = [
        { id: 'A', dateDebut: j(2026, 1, 1), dateFin: j(2026, 6, 30) },
        { id: 'L', dateDebut: j(2026, 7, 1), dateFin: j(2026, 12, 31) },
        { id: 'C', dateDebut: j(2027, 1, 1), dateFin: j(2027, 12, 31) },
    ];
    const balances = {
        A: [ligne('70110000', -1000), ligne('60110000', 400)],
        L: [ligne('70110000', -500), ligne('60110000', 100)],
        C: [ligne('70110000', -500), ligne('60110000', 100)],
    };
    it('l’exercice arrêté hors du 31 décembre et celui qui le suit la même année le disent, chacun calculé seul', async () => {
        const { s } = service({ exercices, balances });
        const rA = await s.resultatFiscal('t1', 'A');
        expect(rA.observations).toContain((0, fiscalite_service_1.observationBilansSuccessifs)(j(2026, 6, 30)));
        expect(rA.resultatComptable).toBe(600);
        const rL = await s.resultatFiscal('t1', 'L');
        expect(rL.observations).toContain((0, fiscalite_service_1.observationBilansSuccessifs)(j(2026, 12, 31)));
        expect(rL.resultatComptable).toBe(400);
        expect((0, fiscalite_service_1.observationBilansSuccessifs)(j(2026, 6, 30))).toContain('art. 12 al. 4');
    });
    it('un exercice civil ordinaire ne dit rien', async () => {
        const { s } = service({ exercices, balances });
        const rC = await s.resultatFiscal('t1', 'C');
        expect(rC.observations.join(' ')).not.toContain('BILANS SUCCESSIFS');
    });
});
//# sourceMappingURL=fiscalite.spec.js.map
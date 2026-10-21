"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_projet_service_1 = require("./etats-financiers-projet.service");
function ligne(numero, classe, totalDebit, totalCredit, typeCompte = client_1.TypeCompteDetailTotal.DETAIL) {
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte,
        totalDebit,
        totalCredit,
        solde: totalDebit - totalCredit,
    };
}
function prismaVide() {
    return {
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
    };
}
function serviceAvecExercices(lignesParExercice, exercices = [], prisma = prismaVide(), ouverturesParExercice = {}) {
    const ecritureService = {
        balance: jest.fn().mockImplementation((_tenantId, exerciceId, _inclureBrouillard, _arreteAu, options) => {
            const lignes = (options?.avantLaCloture ? ouverturesParExercice[exerciceId] : undefined) ?? lignesParExercice[exerciceId] ?? [];
            return Promise.resolve({
                lignes,
                totaux: {
                    debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                    credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                },
            });
        }),
        balanceCumulee: jest.fn().mockImplementation(() => {
            const parCompte = new Map();
            for (const l of prisma.__cumul ?? []) {
                const a = parCompte.get(l.compteId) ?? { compteId: l.compteId, totalDebit: 0, totalCredit: 0 };
                a.totalDebit += l.debit;
                a.totalCredit += l.credit;
                parCompte.set(l.compteId, a);
            }
            return Promise.resolve({ lignes: [...parCompte.values()] });
        }),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    };
    const duDossier = exercices.length
        ? exercices
        : Object.keys(lignesParExercice).map((id) => ({ id, dateDebut: new Date('2026-01-01') }));
    const exerciceService = {
        lister: jest.fn().mockResolvedValue([...duDossier].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
    };
    return new etats_financiers_projet_service_1.EtatsFinanciersProjetService(ecritureService, exerciceService, prisma);
}
function serviceAvecBalance(lignes) {
    return serviceAvecExercices({ e1: lignes });
}
function poste(etat, ref) {
    const tous = 'actif' in etat ? [...etat.actif, ...etat.passif] : [...etat.revenus, ...etat.charges];
    return tous.find((p) => p.ref === ref);
}
describe('EtatsFinanciersProjetService', () => {
    describe('bilan', () => {
        it('n’expose NI brut NI amortissement : ce jeu n’a que deux colonnes de valeur (audit 2026-08-28)', async () => {
            const service = serviceAvecBalance([ligne('24100000', client_1.ClasseCompte.CLASSE_2, 8000, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            const ad = poste(bilan, 'AD');
            expect(ad.montant).toBe(8000);
            expect(ad.brut).toBeUndefined();
            expect(ad.amortissement).toBeUndefined();
        });
        it('un compte 28x/29x ne disparaît pas en silence : il ressort en « comptes non rattachés »', async () => {
            const service = serviceAvecBalance([ligne('28400000', client_1.ClasseCompte.CLASSE_2, 0, 2000)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).toContain('28400000');
        });
        it('BD exclut 411 ET 419 comme le dit le texte ; 411 ressort en non rattaché', async () => {
            const service = serviceAvecBalance([
                ligne('41100000', client_1.ClasseCompte.CLASSE_4, 700, 0),
                ligne('41200000', client_1.ClasseCompte.CLASSE_4, 300, 0),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BD').montant).toBe(300);
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).toContain('41100000');
        });
        it('un découvert bancaire ne casse pas l’équilibre du bilan (régression audit)', async () => {
            const service = serviceAvecBalance([
                ligne('24100000', client_1.ClasseCompte.CLASSE_2, 300, 0),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 300),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.totalActif).toBe(300);
            expect(bilan.totalPassif).toBe(300);
            expect(bilan.equilibre).toBe(true);
        });
        it('un écart de conversion-passif (479) n’est porté QUE par DY, jamais aussi par DH', async () => {
            const service = serviceAvecBalance([
                ligne('41200000', client_1.ClasseCompte.CLASSE_4, 500, 0),
                ligne('47910000', client_1.ClasseCompte.CLASSE_4, 0, 500),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'DY').montant).toBe(500);
            expect(poste(bilan, 'DH').montant).toBe(0);
            expect(poste(bilan, 'DH').comptes.map((c) => c.numero)).not.toContain('47910000');
            expect(poste(bilan, 'DJ').montant).toBe(0);
            expect(bilan.totalPassif).toBe(500);
            expect(bilan.totalActif).toBe(500);
            expect(bilan.equilibre).toBe(true);
        });
        it('l’exclusion de 479 n’ampute rien d’autre du poste DH · un 471 créditeur y reste', async () => {
            const service = serviceAvecBalance([ligne('47120000', client_1.ClasseCompte.CLASSE_4, 0, 300)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'DH').montant).toBe(300);
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).not.toContain('47120000');
        });
        it('AZ (total actif immobilisé) additionne AA à AH', async () => {
            const service = serviceAvecBalance([
                ligne('21000000', client_1.ClasseCompte.CLASSE_2, 1000, 0),
                ligne('22000000', client_1.ClasseCompte.CLASSE_2, 500, 0),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'AZ').montant).toBe(1500);
        });
        it('paquet 1, A1 · la colonne N-1 reprend CC tel quel, et dit le résultat antérieur que la clôture précédente n’a pas viré', async () => {
            const lignes2027 = [ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 400), ligne('66000000', client_1.ClasseCompte.CLASSE_6, 900, 0)];
            const lignes2028 = [ligne('13900000', client_1.ClasseCompte.CLASSE_1, 500, 0)];
            const exercices = (statut2027) => [
                { id: 'e0', dateDebut: new Date('2027-01-01'), statut: statut2027 },
                { id: 'e1', dateDebut: new Date('2028-01-01'), statut: 'OUVERT' },
            ];
            const bilan = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('CLOTURE')).bilan('t1', 'e1');
            expect(poste(bilan, 'CC').montantN1).toBe(-500);
            expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: 400, poste: 'CC' }));
            const ouvert = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('OUVERT')).bilan('t1', 'e1');
            expect(ouvert.resultatAnterieurNonVireN1).toBeNull();
        });
        it('paquet 1, A4 · la colonne N-1 d’un premier exercice clôturé lit l’ouverture avant le virement du 13', async () => {
            const enReport = (numero, classe, rd, rc, md = 0, mc = 0) => ({
                ...ligne(numero, classe, rd + md, rc + mc),
                reportDebit: rd,
                reportCredit: rc,
                mouvementDebit: md,
                mouvementCredit: mc,
            });
            const apresCloture = [
                enReport('52110000', client_1.ClasseCompte.CLASSE_5, 1_400, 0),
                enReport('16500000', client_1.ClasseCompte.CLASSE_1, 0, 1_000),
                enReport('13100000', client_1.ClasseCompte.CLASSE_1, 400, 400),
                enReport('12100000', client_1.ClasseCompte.CLASSE_1, 0, 400),
            ];
            const avantCloture = [
                enReport('52110000', client_1.ClasseCompte.CLASSE_5, 1_400, 0),
                enReport('16500000', client_1.ClasseCompte.CLASSE_1, 0, 1_000),
                enReport('13100000', client_1.ClasseCompte.CLASSE_1, 0, 400),
            ];
            const service = serviceAvecExercices({ e1: apresCloture }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }], prismaVide(), { e1: avantCloture });
            const bilan = await service.bilan('t1', 'e1');
            expect({ comparatif: bilan.comparatif, ccN1: poste(bilan, 'CC').montantN1, cbN1: poste(bilan, 'CB').montantN1 }).toEqual({
                comparatif: 'BILAN_D_OUVERTURE',
                ccN1: 400,
                cbN1: 0,
            });
            expect(poste(bilan, 'CB').montant).toBe(400);
        });
        it('CC (solde des opérations) lit le compte 13 ET les classes 6/7/8, comme CH des associations', async () => {
            const service = serviceAvecBalance([
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 400),
                ligne('66000000', client_1.ClasseCompte.CLASSE_6, 900, 0),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CC').montant).toBe(-500);
            expect(bilan.controle).toEqual({ resultatClasses678: -900, resultatCompte13: 400, resultatAnterieurNonAffecte: 400 });
        });
        it('P1 · un produit non neutralisé (intérêts au 7747) entre en CC avant la clôture · le bilan s\'équilibre', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 9_620_000, 0),
                ligne('16200000', client_1.ClasseCompte.CLASSE_1, 0, 22_000_000),
                ligne('46200000', client_1.ClasseCompte.CLASSE_4, 0, 7_500_000),
                ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 1_000_000),
                ligne('24110000', client_1.ClasseCompte.CLASSE_2, 21_000_000, 0),
                ligne('60470000', client_1.ClasseCompte.CLASSE_6, 10_500_000, 0),
                ligne('70200000', client_1.ClasseCompte.CLASSE_7, 0, 10_500_000),
                ligne('77470000', client_1.ClasseCompte.CLASSE_7, 0, 120_000),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CC').montant).toBe(120_000);
            expect(bilan.totalActif).toBe(30_620_000);
            expect(bilan.totalPassif).toBe(30_620_000);
            expect(bilan.equilibre).toBe(true);
        });
        it('DW capte les découverts bancaires (52/53 créditeurs) en plus de 56', async () => {
            const service = serviceAvecBalance([
                ligne('52100000', client_1.ClasseCompte.CLASSE_5, 0, 300),
                ligne('56100000', client_1.ClasseCompte.CLASSE_5, 0, 100),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'DW').montant).toBe(400);
        });
        it('signale les comptes de bilan non rattachés à aucun poste officiel', async () => {
            const service = serviceAvecBalance([ligne('45900000', client_1.ClasseCompte.CLASSE_4, 100, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).toContain('45900000');
        });
        it('comparatif N-1 : absent (undefined) au premier exercice du dossier, présent sinon', async () => {
            const service = serviceAvecBalance([ligne('21000000', client_1.ClasseCompte.CLASSE_2, 1000, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.exerciceN1Disponible).toBe(false);
            expect(poste(bilan, 'AA').montantN1).toBeUndefined();
            const service2 = serviceAvecExercices({ e1: [ligne('21000000', client_1.ClasseCompte.CLASSE_2, 1000, 0)], e0: [ligne('21000000', client_1.ClasseCompte.CLASSE_2, 700, 0)] }, [
                { id: 'e1', dateDebut: new Date('2026-01-01') },
                { id: 'e0', dateDebut: new Date('2025-01-01') },
            ]);
            const bilan2 = await service2.bilan('t1', 'e1');
            expect(bilan2.exerciceN1Disponible).toBe(true);
            expect(poste(bilan2, 'AA').montantN1).toBe(700);
        });
    });
    describe('compteExploitation', () => {
        it('XA (revenus) inclut RE (reprises) · anomalie n° 2 corrigée, pas le "Somme RA à RD" littéral du texte', async () => {
            const service = serviceAvecBalance([
                ligne('70200000', client_1.ClasseCompte.CLASSE_7, 0, 500),
                ligne('79000000', client_1.ClasseCompte.CLASSE_7, 0, 50),
            ]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(ce.totalRevenus).toBe(550);
        });
        it('RC (subventions, compte 71) est bien rattachée · anomalie n° 1 corrigée', async () => {
            const service = serviceAvecBalance([ligne('71000000', client_1.ClasseCompte.CLASSE_7, 0, 200)]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(poste(ce, 'RC').montant).toBe(200);
        });
        it('le doublon officiel TJ/TK (comptes 66/69 et 67/82-88) est bien réparti sur deux lignes distinctes, jamais confondu', async () => {
            const service = serviceAvecBalance([
                ligne('66000000', client_1.ClasseCompte.CLASSE_6, 300, 0),
                ligne('69000000', client_1.ClasseCompte.CLASSE_6, 40, 0),
                ligne('67000000', client_1.ClasseCompte.CLASSE_6, 20, 0),
                ligne('82000000', client_1.ClasseCompte.CLASSE_8, 0, 60),
            ]);
            const ce = await service.compteExploitation('t1', 'e1');
            const tj = ce.charges.filter((p) => p.ref === 'TJ');
            const tk = ce.charges.filter((p) => p.ref === 'TK');
            expect(tj.map((p) => p.montant)).toEqual([300, 40]);
            expect(tk.map((p) => p.montant)).toEqual([20, 60]);
            expect(ce.totalCharges).toBe(300 + 40 + 20 - 60);
        });
        it('un produit H.A.O. seul (cession de fin de projet, crédit 82) donne un XC positif, en N comme en N-1', async () => {
            const service = serviceAvecExercices({
                e1: [ligne('82000000', client_1.ClasseCompte.CLASSE_8, 0, 5_000_000)],
                e0: [ligne('82000000', client_1.ClasseCompte.CLASSE_8, 0, 1_000_000)],
            }, [
                { id: 'e1', dateDebut: new Date('2026-01-01') },
                { id: 'e0', dateDebut: new Date('2025-01-01') },
            ]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(ce.charges.find((p) => p.libelle === 'Produits H.A.O.').montant).toBe(5_000_000);
            expect(ce.totalCharges).toBe(-5_000_000);
            expect(ce.solde).toBe(5_000_000);
            expect(ce.soldeN1).toBe(1_000_000);
        });
        it('XC = XA - XB, exposé même non nul (pas forcé à zéro)', async () => {
            const service = serviceAvecBalance([
                ligne('70200000', client_1.ClasseCompte.CLASSE_7, 0, 600),
                ligne('66000000', client_1.ClasseCompte.CLASSE_6, 250, 0),
            ]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(ce.solde).toBe(350);
            expect(ce.controle.boucleAZero).toBe(false);
        });
        it('comparatif N-1 sur totaux et solde', async () => {
            const service = serviceAvecExercices({
                e1: [ligne('70200000', client_1.ClasseCompte.CLASSE_7, 0, 600), ligne('66000000', client_1.ClasseCompte.CLASSE_6, 250, 0)],
                e0: [ligne('70200000', client_1.ClasseCompte.CLASSE_7, 0, 400), ligne('66000000', client_1.ClasseCompte.CLASSE_6, 400, 0)],
            }, [
                { id: 'e1', dateDebut: new Date('2026-01-01') },
                { id: 'e0', dateDebut: new Date('2025-01-01') },
            ]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(ce.totalRevenusN1).toBe(400);
            expect(ce.totalChargesN1).toBe(400);
            expect(ce.soldeN1).toBe(0);
        });
        it('signale les comptes de gestion non rattachés à aucun poste officiel', async () => {
            const service = serviceAvecBalance([ligne('68000000', client_1.ClasseCompte.CLASSE_6, 50, 0)]);
            const ce = await service.compteExploitation('t1', 'e1');
            expect(ce.comptesNonRattaches.map((c) => c.numero)).toContain('68000000');
        });
    });
    describe('noteBailleur', () => {
        const bailleurUE = { id: 'b-ue', code: 'UE-01', nom: 'Union européenne' };
        const bailleurBM = { id: 'b-bm', code: 'BM-01', nom: 'Banque mondiale' };
        function compte(id, numero, bailleur = null) {
            return { id, numero, bailleur };
        }
        function ligneMouvement(compteId, debit, credit) {
            return { compteId, debit, credit };
        }
        function prisma(comptes, mouvements) {
            return {
                compte: { findMany: jest.fn().mockResolvedValue(comptes) },
                __cumul: mouvements,
            };
        }
        it('les trois colonnes se réconcilient TOUJOURS : solde restant = décaissé − consommé', async () => {
            const prismaMock = prisma([compte('id-16210000', '16210000', bailleurUE)], [ligneMouvement('id-16210000', 0, 900), ligneMouvement('id-16210000', 350, 0)]);
            const service = serviceAvecExercices({ e1: [] }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            const ue = note.investissement.find((b) => b.bailleur.code === 'UE-01');
            expect(ue.soldeRestant).toBe(ue.decaisse - ue.consomme);
            expect(ue.soldeRestant).toBe(550);
        });
        it('lit le cumul du projet par balanceCumulee, borné à l’exercice demandé', async () => {
            const prismaMock = prisma([compte('id-16210000', '16210000', bailleurUE)], [ligneMouvement('id-16210000', 0, 100000)]);
            const service = serviceAvecExercices({ e1: [] }, [], prismaMock);
            await service.noteBailleur('t1', 'e1');
            expect(service.ecritureService.balanceCumulee).toHaveBeenCalledWith('t1', 'e1');
        });
        it('décaissé = crédits du cumul, bilan d’ouverture compris ; consommé = débits du cumul', async () => {
            const prismaMock = prisma([compte('id-16210000', '16210000', bailleurUE)], [
                ligneMouvement('id-16210000', 0, 5000),
                ligneMouvement('id-16210000', 0, 1000),
                ligneMouvement('id-16210000', 300, 0),
            ]);
            const service = serviceAvecExercices({ e1: [] }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            const ue = note.investissement.find((b) => b.bailleur.code === 'UE-01');
            expect({ decaisse: ue.decaisse, consomme: ue.consomme, reste: ue.soldeRestant }).toEqual({
                decaisse: 6000,
                consomme: 300,
                reste: 5700,
            });
        });
        it('sépare fonds d’investissement (162-164) et fonds d’administration (462-464) même pour le même bailleur', async () => {
            const prismaMock = prisma([compte('c-162', '16210000', bailleurUE), compte('c-462', '46210000', bailleurUE)], [ligneMouvement('c-162', 0, 500), ligneMouvement('c-462', 0, 800)]);
            const service = serviceAvecExercices({ e1: [ligne('16210000', client_1.ClasseCompte.CLASSE_1, 0, 500), ligne('46210000', client_1.ClasseCompte.CLASSE_4, 0, 800)] }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            expect(note.investissement.find((b) => b.bailleur.code === 'UE-01').decaisse).toBe(500);
            expect(note.administration.find((b) => b.bailleur.code === 'UE-01').decaisse).toBe(800);
        });
        it('agrège plusieurs sous-comptes du même bailleur, distingue deux bailleurs différents', async () => {
            const prismaMock = prisma([compte('c-1621', '16210000', bailleurUE), compte('c-1622', '16220000', bailleurUE), compte('c-1631', '16310000', bailleurBM)], [ligneMouvement('c-1621', 0, 400), ligneMouvement('c-1622', 0, 100), ligneMouvement('c-1631', 0, 900)]);
            const service = serviceAvecExercices({
                e1: [
                    ligne('16210000', client_1.ClasseCompte.CLASSE_1, 0, 400),
                    ligne('16220000', client_1.ClasseCompte.CLASSE_1, 0, 100),
                    ligne('16310000', client_1.ClasseCompte.CLASSE_1, 0, 900),
                ],
            }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            expect(note.investissement.find((b) => b.bailleur.code === 'UE-01').decaisse).toBe(500);
            expect(note.investissement.find((b) => b.bailleur.code === 'BM-01').decaisse).toBe(900);
        });
        it('un compte 162-164/462-464 SANS bailleur ressort dans nonAffecte, jamais silencieusement absorbé dans un total', async () => {
            const prismaMock = prisma([compte('c-164', '16400000', null)], [ligneMouvement('c-164', 0, 250)]);
            const service = serviceAvecExercices({ e1: [ligne('16400000', client_1.ClasseCompte.CLASSE_1, 0, 250)] }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            expect(note.investissement).toHaveLength(0);
            expect(note.investissementNonAffecte.decaisse).toBe(250);
        });
        it('totalFondsDuBailleur additionne investissement + administration (bailleurs affectés seulement)', async () => {
            const prismaMock = prisma([compte('c-162', '16210000', bailleurUE), compte('c-462', '46210000', bailleurUE)], [ligneMouvement('c-162', 0, 500), ligneMouvement('c-462', 0, 800)]);
            const service = serviceAvecExercices({ e1: [ligne('16210000', client_1.ClasseCompte.CLASSE_1, 0, 500), ligne('46210000', client_1.ClasseCompte.CLASSE_4, 0, 800)] }, [], prismaMock);
            const note = await service.noteBailleur('t1', 'e1');
            expect(note.totalFondsDuBailleur.decaisse).toBe(1300);
        });
    });
});
//# sourceMappingURL=etats-financiers-projet.service.spec.js.map
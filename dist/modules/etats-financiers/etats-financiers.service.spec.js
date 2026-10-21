"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_service_1 = require("./etats-financiers.service");
const correspondance_tft_1 = require("./correspondance-tft");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
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
function serviceAvecExercices(lignesParExercice, exercices = [], virementsParExercice = {}, reevaluationsParExercice = {}, incorporationsParExercice = {}, ouverturesParExercice = {}) {
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
        virementsDeMiseEnService: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve((exerciceId && virementsParExercice[exerciceId]) || new Map())),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
        positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
        nombreAuBrouillard: jest.fn().mockResolvedValue(0),
        mouvementsDeReevaluation: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve((exerciceId && reevaluationsParExercice[exerciceId]) || new Map())),
        mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve((exerciceId && incorporationsParExercice[exerciceId]) || new Map())),
    };
    const duDossier = exercices.length
        ? exercices
        : Object.keys(lignesParExercice).map((id) => ({ id, dateDebut: new Date('2026-01-01') }));
    const exerciceService = {
        lister: jest.fn().mockResolvedValue([...duDossier].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
    };
    return new etats_financiers_service_1.EtatsFinanciersService(ecritureService, exerciceService);
}
function serviceAvecBalance(lignes) {
    return serviceAvecExercices({ e1: lignes });
}
describe('EtatsFinanciersService', () => {
    describe('bilan', () => {
        const poste = (bilan, ref) => [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);
        it('équilibre un jeu simple actif / passif / résultat, chaque poste au bon endroit', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800),
                ligne('60100000', client_1.ClasseCompte.CLASSE_6, 200, 0),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 400),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BW')?.montant).toBe(1000);
            expect(poste(bilan, 'CA')?.montant).toBe(800);
            expect(poste(bilan, 'CH')?.montant).toBe(200);
            expect(poste(bilan, 'BX')?.montant).toBe(1000);
            expect(poste(bilan, 'BZ')?.montant).toBe(1000);
            expect(poste(bilan, 'CK')?.montant).toBe(1000);
            expect(poste(bilan, 'DZ')?.montant).toBe(1000);
            expect(bilan.totalActif).toBe(1000);
            expect(bilan.totalPassif).toBe(1000);
            expect(bilan.equilibre).toBe(true);
            expect(poste(bilan, 'BZ')?.estTotal).toBe(true);
            expect(poste(bilan, 'BW')?.estTotal).toBe(false);
        });
        it('fait entrer la classe 8 (H.A.O.) dans le résultat · sinon le bilan ne boucle pas', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 40, 0),
                ligne('82200000', client_1.ClasseCompte.CLASSE_8, 0, 40),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montant).toBe(40);
            expect(bilan.totalActif).toBe(40);
            expect(bilan.totalPassif).toBe(40);
            expect(bilan.equilibre).toBe(true);
        });
        it('ignore les comptes de classe 9 (hors bilan par construction de l’Acte uniforme)', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 100, 0),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 100),
                ligne('90000000', client_1.ClasseCompte.CLASSE_9, 500, 0),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.totalActif).toBe(100);
            expect(bilan.totalPassif).toBe(100);
            expect(bilan.comptesNonRattaches.some((c) => c.numero === '90000000')).toBe(false);
        });
        it('exclut les comptes Total, qui ne sont qu’un agrégat des comptes Détail', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 100, 0),
                ligne('52', client_1.ClasseCompte.CLASSE_5, 100, 0, client_1.TypeCompteDetailTotal.TOTAL),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 100),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.totalActif).toBe(100);
        });
        it('soustrait l’amortissement du brut, pas l’inverse', async () => {
            const service = serviceAvecBalance([
                ligne('24510000', client_1.ClasseCompte.CLASSE_2, 5000, 0),
                ligne('28450000', client_1.ClasseCompte.CLASSE_2, 0, 1500),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'AM')?.montant).toBe(3500);
        });
        it('sépare BE (créances) et DI (dettes) par le sens du solde, sur les mêmes préfixes de tiers', async () => {
            const service = serviceAvecBalance([
                ligne('47110000', client_1.ClasseCompte.CLASSE_4, 100, 0),
                ligne('47120000', client_1.ClasseCompte.CLASSE_4, 0, 60),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BE')?.montant).toBe(100);
            expect(poste(bilan, 'DI')?.montant).toBe(60);
            expect(poste(bilan, 'BE')?.comptes.map((c) => c.numero)).toEqual(['47110000']);
            expect(poste(bilan, 'DI')?.comptes.map((c) => c.numero)).toEqual(['47120000']);
        });
        it('retire le compte 41 de BE · déjà entièrement capté par BD (anomalie n° 1)', async () => {
            const service = serviceAvecBalance([ligne('41100000', client_1.ClasseCompte.CLASSE_4, 200, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BD')?.montant).toBe(200);
            expect(poste(bilan, 'BE')?.montant).toBe(0);
        });
        it('CH prend le résultat des classes 6/7/8 quand elles sont mouvementées (avant clôture)', async () => {
            const service = serviceAvecBalance([ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montant).toBe(500);
            expect(bilan.controle.resultatClasses678).toBe(500);
            expect(bilan.controle.resultatCompte13).toBe(0);
        });
        it('CH bascule sur le compte 13 quand les classes 6/7/8 sont soldées (après clôture)', async () => {
            const service = serviceAvecBalance([ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 500)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montant).toBe(500);
            expect(bilan.controle.resultatClasses678).toBe(0);
            expect(bilan.controle.resultatCompte13).toBe(500);
        });
        it('B1 · avant l\'affectation, CH additionne le résultat de N resté au 13 et celui de N+1 en cours · le bilan s\'équilibre', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0),
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_000),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montant).toBe(1_164_500);
            expect(bilan.controle).toEqual({ resultatClasses678: 500, resultatCompte13: 1_164_000, resultatAnterieurNonAffecte: 1_164_000 });
            expect(bilan.resultatAnterieurNonVire).toBeNull();
            expect(bilan.totalActif).toBe(1_164_500);
            expect(bilan.totalPassif).toBe(1_164_500);
            expect(bilan.equilibre).toBe(true);
            expect(poste(bilan, 'CH')?.comptes.map((c) => c.numero).sort()).toEqual(['13100000', '70100000']);
        });
        it('BLOQUANT (relecture V1) · le même bilan sur un exercice CLÔTURÉ · CH porte encore le résultat de 2026, et il est NOMMÉ', async () => {
            const service = serviceAvecExercices({
                e1: [
                    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0),
                    ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_000),
                    ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
                ],
            }, [{ id: 'e1', dateDebut: new Date('2027-01-01'), statut: 'CLOTURE' }]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montant).toBe(1_164_500);
            expect(bilan.equilibre).toBe(true);
            expect(bilan.resultatAnterieurNonVire).toEqual(expect.objectContaining({ montant: 1_164_000, poste: 'CH' }));
            expect(bilan.resultatAnterieurNonVire.motif).toContain('un excédent de');
        });
        it('paquet 1, A1 · la colonne N-1 de l’exercice suivant reprend CH tel quel, et le DIT', async () => {
            const lignes2027 = [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0),
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_000),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ];
            const lignes2028 = [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_164_500, 0), ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 1_164_500)];
            const exercices = (statut2027) => [
                { id: 'e0', dateDebut: new Date('2027-01-01'), statut: statut2027 },
                { id: 'e1', dateDebut: new Date('2028-01-01'), statut: 'OUVERT' },
            ];
            const bilan = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('CLOTURE')).bilan('t1', 'e1');
            expect(poste(bilan, 'CH')?.montantN1).toBe(1_164_500);
            expect(bilan.resultatAnterieurNonVire).toBeNull();
            expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: 1_164_000, poste: 'CH' }));
            expect(bilan.resultatAnterieurNonVireN1.motif).toContain('SYCEBNL art. 16, 7)');
            const ouvert = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('OUVERT')).bilan('t1', 'e1');
            expect(ouvert.resultatAnterieurNonVireN1).toBeNull();
        });
        it('signale un compte de bilan qu’aucun poste officiel ne réclame · et fait fuir l’équilibre de son montant', async () => {
            const service = serviceAvecBalance([
                ligne('29999999', client_1.ClasseCompte.CLASSE_2, 700, 0),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 700),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.comptesNonRattaches).toEqual([expect.objectContaining({ numero: '29999999', montant: 700 })]);
            expect(bilan.totalActif).toBe(0);
            expect(bilan.totalPassif).toBe(700);
            expect(bilan.equilibre).toBe(false);
        });
    });
    describe('compteDeResultat', () => {
        it('ventile chaque compte dans son poste officiel et applique les formules XA/XB/XC/XD/XE', async () => {
            const service = serviceAvecBalance([
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 3000),
                ligne('70510000', client_1.ClasseCompte.CLASSE_7, 0, 1200),
                ligne('70520000', client_1.ClasseCompte.CLASSE_7, 0, 800),
                ligne('60200000', client_1.ClasseCompte.CLASSE_6, 900, 0),
                ligne('62200000', client_1.ClasseCompte.CLASSE_6, 400, 0),
                ligne('66100000', client_1.ClasseCompte.CLASSE_6, 1500, 0),
                ligne('82200000', client_1.ClasseCompte.CLASSE_8, 0, 600),
                ligne('81200000', client_1.ClasseCompte.CLASSE_8, 450, 0),
            ]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.produits.find((p) => p.ref === 'RA')?.montant).toBe(3000);
            expect(cr.produits.find((p) => p.ref === 'RD')?.montant).toBe(1200);
            expect(cr.produits.find((p) => p.ref === 'RE')?.montant).toBe(800);
            expect(cr.totalProduits).toBe(5000);
            expect(cr.charges.find((p) => p.ref === 'TC')?.montant).toBe(900);
            expect(cr.totalCharges).toBe(2800);
            expect(cr.resultatActivitesOrdinaires).toBe(2200);
            expect(cr.produitsHao.montant).toBe(600);
            expect(cr.chargesHao.montant).toBe(450);
            expect(cr.resultatHao).toBe(150);
            expect(cr.resultatNet).toBe(2350);
            expect(cr.controle.coherent).toBe(true);
            expect(cr.comptesNonRattaches).toHaveLength(0);
        });
        it('inclut RH (reprises) dans XA · sans quoi le résultat cesserait d’égaler celui du bilan', async () => {
            const service = serviceAvecBalance([ligne('79000000', client_1.ClasseCompte.CLASSE_7, 0, 500)]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.produits.find((p) => p.ref === 'RH')?.montant).toBe(500);
            expect(cr.totalProduits).toBe(500);
            expect(cr.resultatNet).toBe(500);
            expect(cr.controle.coherent).toBe(true);
        });
        it('signale un compte de gestion hors poste et chiffre l’écart plutôt que de le masquer', async () => {
            const service = serviceAvecBalance([
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 100),
                ligne('70500000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.resultatNet).toBe(100);
            expect(cr.comptesNonRattaches).toEqual([
                expect.objectContaining({ numero: '70500000', montant: 500 }),
            ]);
            expect(cr.controle.coherent).toBe(false);
            expect(cr.controle.ecart).toBe(500);
            expect(cr.controle.resultatToutesClassesDeGestion).toBe(600);
        });
        it('donne le même résultat net que le bilan (contrôle croisé des deux états)', async () => {
            const lignes = [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 5000, 0),
                ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 2750),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 3000),
                ligne('60200000', client_1.ClasseCompte.CLASSE_6, 900, 0),
                ligne('82200000', client_1.ClasseCompte.CLASSE_8, 0, 600),
                ligne('81200000', client_1.ClasseCompte.CLASSE_8, 450, 0),
            ];
            expect(lignes.reduce((s, l) => s + l.totalDebit, 0)).toBe(lignes.reduce((s, l) => s + l.totalCredit, 0));
            const service = serviceAvecBalance(lignes);
            const bilan = await service.bilan('t1', 'e1');
            const cr = await service.compteDeResultat('t1', 'e1');
            const resultatAuBilan = bilan.passif.find((p) => p.ref === 'CH')?.montant ?? 0;
            expect(cr.resultatNet).toBe(resultatAuBilan);
            expect(bilan.equilibre).toBe(true);
            expect(cr.controle.coherent).toBe(true);
        });
        it('ne compte pas deux fois un compte Total et son compte Détail', async () => {
            const service = serviceAvecBalance([
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 300),
                ligne('701', client_1.ClasseCompte.CLASSE_7, 0, 300, client_1.TypeCompteDetailTotal.TOTAL),
            ]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.totalProduits).toBe(300);
        });
    });
    describe('bilan · colonnes Brut / Amortissement / Net (actif)', () => {
        const poste = (bilan, ref) => [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);
        it('expose brut, amortissement (magnitude positive) et net séparément sur un poste actif amorti', async () => {
            const service = serviceAvecBalance([
                ligne('24510000', client_1.ClasseCompte.CLASSE_2, 5000, 0),
                ligne('28450000', client_1.ClasseCompte.CLASSE_2, 0, 1500),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            const am = poste(bilan, 'AM');
            expect(am.brut).toBe(5000);
            expect(am.amortissement).toBe(1500);
            expect(am.montant).toBe(3500);
        });
        it('remonte brut/amortissement dans les totaux hiérarchiques (AH, AZ)', async () => {
            const service = serviceAvecBalance([
                ligne('24510000', client_1.ClasseCompte.CLASSE_2, 5000, 0),
                ligne('28450000', client_1.ClasseCompte.CLASSE_2, 0, 1500),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'AH')?.brut).toBe(5000);
            expect(poste(bilan, 'AH')?.amortissement).toBe(1500);
            expect(poste(bilan, 'AH')?.montant).toBe(3500);
            expect(poste(bilan, 'AZ')?.montant).toBe(3500);
        });
        it('un poste sans compte d’amortissement (AG) a amortissement=0, pas undefined', async () => {
            const service = serviceAvecBalance([ligne('25100000', client_1.ClasseCompte.CLASSE_2, 800, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            const ag = poste(bilan, 'AG');
            expect(ag.brut).toBe(800);
            expect(ag.amortissement).toBe(0);
            expect(ag.montant).toBe(800);
        });
        it('un poste PASSIF n’a pas de brut/amortissement · seulement un montant net', async () => {
            const service = serviceAvecBalance([ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800)]);
            const bilan = await service.bilan('t1', 'e1');
            const ca = poste(bilan, 'CA');
            expect(ca.brut).toBeUndefined();
            expect(ca.amortissement).toBeUndefined();
            expect(ca.montant).toBe(800);
        });
    });
    describe('audit 2026-08-28 · régressions', () => {
        const poste = (bilan, ref) => [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);
        it('un découvert bancaire ne casse plus l’équilibre du bilan (52/53 créditeurs comptés une seule fois)', async () => {
            const service = serviceAvecBalance([
                ligne('24100000', client_1.ClasseCompte.CLASSE_2, 300, 0),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 300),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.totalActif).toBe(300);
            expect(bilan.totalPassif).toBe(300);
            expect(bilan.equilibre).toBe(true);
            expect(poste(bilan, 'BW').montant).toBe(0);
            expect(poste(bilan, 'DW').montant).toBe(300);
        });
        it('une banque DÉBITRICE reste bien à l’actif (le transfert ne vaut que pour les soldes créditeurs)', async () => {
            const service = serviceAvecBalance([ligne('52110000', client_1.ClasseCompte.CLASSE_5, 800, 0)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BW').montant).toBe(800);
            expect(poste(bilan, 'DW').montant).toBe(0);
        });
        it('une caisse créditrice (57, anomalie de saisie) reste VISIBLE en négatif à l’actif, pas déplacée au passif', async () => {
            const service = serviceAvecBalance([ligne('57100000', client_1.ClasseCompte.CLASSE_5, 0, 120)]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BW').montant).toBe(-120);
            expect(poste(bilan, 'DW').montant).toBe(0);
        });
        it('BILAN COMPLET · un dossier réaliste boucle exactement (amortissement + tiers 2 sens + découvert + déficit)', async () => {
            const service = serviceAvecBalance([
                ligne('10100000', client_1.ClasseCompte.CLASSE_1, 0, 10000),
                ligne('24100000', client_1.ClasseCompte.CLASSE_2, 4000, 0),
                ligne('28410000', client_1.ClasseCompte.CLASSE_2, 0, 800),
                ligne('48100000', client_1.ClasseCompte.CLASSE_4, 4000, 4000),
                ligne('41100000', client_1.ClasseCompte.CLASSE_4, 3000, 2000),
                ligne('40100000', client_1.ClasseCompte.CLASSE_4, 0, 500),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 12000, 13000),
                ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 3000),
                ligne('60400000', client_1.ClasseCompte.CLASSE_6, 500, 0),
                ligne('62200000', client_1.ClasseCompte.CLASSE_6, 9000, 0),
                ligne('68130000', client_1.ClasseCompte.CLASSE_6, 800, 0),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'AL').brut).toBe(4000);
            expect(poste(bilan, 'AL').amortissement).toBe(800);
            expect(poste(bilan, 'AL').montant).toBe(3200);
            expect(poste(bilan, 'BD').montant).toBe(1000);
            expect(poste(bilan, 'BW').montant).toBe(0);
            expect(poste(bilan, 'CA').montant).toBe(10000);
            expect(poste(bilan, 'CH').montant).toBe(-7300);
            expect(poste(bilan, 'DH').montant).toBe(500);
            expect(poste(bilan, 'DW').montant).toBe(1000);
            expect(bilan.totalActif).toBe(4200);
            expect(bilan.totalPassif).toBe(4200);
            expect(bilan.equilibre).toBe(true);
            expect(bilan.comptesNonRattaches).toEqual([]);
        });
        it('DW capte 561 et 566 (crédits de trésorerie, intérêts courus) · la restriction à 564/565 les perdait', async () => {
            const service = serviceAvecBalance([
                ligne('56100000', client_1.ClasseCompte.CLASSE_5, 0, 500),
                ligne('56600000', client_1.ClasseCompte.CLASSE_5, 0, 20),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'DW').montant).toBe(520);
        });
    });
    describe('comparatif N-1', () => {
        const exercices = [
            { id: 'e1', dateDebut: new Date('2026-01-01') },
            { id: 'e0', dateDebut: new Date('2025-01-01') },
        ];
        it('bilan : peuple montantN1 depuis l’exercice antérieur', async () => {
            const service = serviceAvecExercices({
                e1: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0), ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000)],
                e0: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 600, 0), ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 600)],
            }, exercices);
            const bilan = await service.bilan('t1', 'e1');
            const bw = [...bilan.actif].find((p) => p.ref === 'BW');
            const ca = [...bilan.passif].find((p) => p.ref === 'CA');
            expect(bilan.exerciceN1Disponible).toBe(true);
            expect(bw.montant).toBe(1000);
            expect(bw.montantN1).toBe(600);
            expect(ca.montant).toBe(1000);
            expect(ca.montantN1).toBe(600);
            expect(bilan.totalActifN1).toBe(600);
            expect(bilan.totalPassifN1).toBe(600);
        });
        it('bilan : sans exercice antérieur, montantN1 est undefined · jamais un faux 0', async () => {
            const service = serviceAvecExercices({ e1: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)] }, [
                { id: 'e1', dateDebut: new Date('2026-01-01') },
            ]);
            const bilan = await service.bilan('t1', 'e1');
            const bw = [...bilan.actif].find((p) => p.ref === 'BW');
            expect(bilan.exerciceN1Disponible).toBe(false);
            expect(bw.montantN1).toBeUndefined();
            expect(bilan.totalActifN1).toBeUndefined();
        });
        it('bilan : ni Brut ni Amort. en N-1 · le modèle de la Partie 4 ch. 2 n’imprime que le net de N-1 (audit final F217, jumeau SYCEBNL)', async () => {
            const balances = {
                e1: [ligne('24410000', client_1.ClasseCompte.CLASSE_2, 1000, 0), ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000)],
                e0: [ligne('24410000', client_1.ClasseCompte.CLASSE_2, 600, 0), ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 600)],
            };
            for (const [exercicesDuDossier, attenduN1] of [
                [exercices, true],
                [[exercices[0]], false],
            ]) {
                const bilan = await serviceAvecExercices(balances, [...exercicesDuDossier]).bilan('t1', 'e1');
                expect(bilan.exerciceN1Disponible).toBe(attenduN1);
                for (const l of [...bilan.actif, ...bilan.passif]) {
                    expect({ ref: l.ref, cles: Object.keys(l).filter((k) => k === 'brutN1' || k === 'amortissementN1') }).toEqual({
                        ref: l.ref,
                        cles: [],
                    });
                }
            }
        });
        it('choisit le PLUS RÉCENT exercice antérieur quand il y en a plusieurs', async () => {
            const troisExercices = [
                { id: 'e2', dateDebut: new Date('2027-01-01') },
                { id: 'e1', dateDebut: new Date('2026-01-01') },
                { id: 'e0', dateDebut: new Date('2025-01-01') },
            ];
            const service = serviceAvecExercices({
                e2: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 900, 0)],
                e1: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 600, 0)],
                e0: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 300, 0)],
            }, troisExercices);
            const bilan = await service.bilan('t1', 'e2');
            const bw = [...bilan.actif].find((p) => p.ref === 'BW');
            expect(bw.montant).toBe(900);
            expect(bw.montantN1).toBe(600);
        });
        it('compte de résultat : peuple totalProduitsN1/totalChargesN1/resultatNetN1', async () => {
            const service = serviceAvecExercices({
                e1: [ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500), ligne('60100000', client_1.ClasseCompte.CLASSE_6, 200, 0)],
                e0: [ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 300), ligne('60100000', client_1.ClasseCompte.CLASSE_6, 100, 0)],
            }, exercices);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.exerciceN1Disponible).toBe(true);
            expect(cr.totalProduits).toBe(500);
            expect(cr.totalProduitsN1).toBe(300);
            expect(cr.totalCharges).toBe(200);
            expect(cr.totalChargesN1).toBe(100);
            expect(cr.resultatNet).toBe(300);
            expect(cr.resultatNetN1).toBe(200);
            expect(cr.produits.find((p) => p.ref === 'RA')?.montantN1).toBe(300);
        });
        it('compte de résultat : sans exercice antérieur, tous les champs N1 sont undefined', async () => {
            const service = serviceAvecExercices({ e1: [ligne('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)] }, [
                { id: 'e1', dateDebut: new Date('2026-01-01') },
            ]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.exerciceN1Disponible).toBe(false);
            expect(cr.totalProduitsN1).toBeUndefined();
            expect(cr.resultatNetN1).toBeUndefined();
            expect(cr.produits.find((p) => p.ref === 'RA')?.montantN1).toBeUndefined();
        });
    });
});
function ligneF(numero, classe, d, c, report = [0, 0]) {
    const [rd, rc] = report;
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        totalDebit: d + rd,
        totalCredit: c + rc,
        reportDebit: rd,
        reportCredit: rc,
        mouvementDebit: d,
        mouvementCredit: c,
        solde: d + rd - c - rc,
    };
}
const DEUX_EXERCICES = [
    { id: 'eN', dateDebut: new Date('2026-01-01') },
    { id: 'eN1', dateDebut: new Date('2025-01-01') },
];
describe('EtatsFinanciersService · tableau de flux de trésorerie', () => {
    const ref = (tft, r) => tft.lignes.find((l) => l.ref === r);
    it('A1 · premier exercice d\'un dossier repris · l\'ouverture se lit sur le bilan d\'ouverture importé, colonne N-1 comprise', async () => {
        const premier = [
            ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1400, 150, [1000, 0]),
            ligneF('40110000', client_1.ClasseCompte.CLASSE_4, 150, 0, [0, 150]),
            ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 850]),
            ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 1500, 1400),
            ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1500),
        ];
        const seul = serviceAvecExercices({ eN: premier });
        const tft = await seul.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'ZA').montant).toBe(1000);
        expect(ref(tft, 'FF').montant).toBe(-150);
        expect(ref(tft, 'FA').montant).toBe(1400);
        expect(ref(tft, 'ZF').montant).toBe(1250);
        expect(ref(tft, 'ZG').montant).toBe(2250);
        expect(tft.controle.tresorerieClotureParBilan).toBe(2250);
        expect(tft.controle.ecart).toBe(0);
        expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionComparatifSurOuverture)('SYCEBNL'));
        const deux = serviceAvecExercices({ eN1: premier, eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [2250, 0])] }, DEUX_EXERCICES);
        const suivant = await deux.tableauFluxTresorerie('t1', 'eN');
        expect(ref(suivant, 'ZA').montantN1).toBe(1000);
        expect(ref(suivant, 'ZF').montantN1).toBe(1250);
        expect(ref(suivant, 'ZG').montantN1).toBe(2250);
        expect(suivant.mentionOuverture).toBeNull();
    });
    it('relecture V1 · un exercice précédent ouvert SANS ÉCRITURE ne tient aucune clôture · ZA se lit sur l\'ouverture de l\'exercice, et c\'est dit', async () => {
        const vide = serviceAvecExercices({
            eN1: [],
            eN: [
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0, [1000, 0]),
                ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 1000]),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ],
        }, DEUX_EXERCICES);
        const tft = await vide.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'ZA').montant).toBe(1000);
        expect(ref(tft, 'ZG').montant).toBe(1500);
        expect(tft.controle.ecart).toBe(0);
        expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYCEBNL', true));
        const rien = serviceAvecExercices({ eN1: [], eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0), ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)] }, DEUX_EXERCICES);
        const tftRien = await rien.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tftRien, 'ZA').montant).toBe(0);
        expect(tftRien.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYCEBNL', false));
    });
    it('paquet 1, A3 · la colonne N-1 d’un exercice précédent ouvert sans écriture reste vide, et c’est dit', async () => {
        const vide = serviceAvecExercices({
            eN1: [],
            eN: [
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1500, 0),
                ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ],
        }, DEUX_EXERCICES);
        const tft = await vide.tableauFluxTresorerie('t1', 'eN');
        const chiffrees = tft.lignes.filter((l) => 'ref' in l && l.montantN1 !== undefined);
        expect(chiffrees).toEqual([]);
        expect(tft.exerciceN1Disponible).toBe(true);
        expect(tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison).toBe((0, etats_financiers_communs_1.motifColonneN1NonTenue)('SYCEBNL'));
        expect((0, etats_financiers_communs_1.motifColonneN1NonTenue)('SYCEBNL')).toContain('SYCEBNL art. 16, 7)');
        expect({ za: ref(tft, 'ZA').montant, zf: ref(tft, 'ZF').montant, vides: tft.postesVides }).toEqual({ za: 0, zf: 1500, vides: [] });
    });
    it('paquet 1, relecture m1 · un exercice précédent CLÔTURÉ sans écriture se dit clôturé, sans « clôturez-le »', async () => {
        const exercices = [
            { id: 'eN', dateDebut: new Date('2026-01-01') },
            { id: 'eN1', dateDebut: new Date('2025-01-01'), statut: client_1.StatutExercice.CLOTURE },
        ];
        const clos = serviceAvecExercices({ eN1: [], eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0), ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)] }, exercices);
        const tft = await clos.tableauFluxTresorerie('t1', 'eN');
        expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYCEBNL', false, 0, true));
        expect(tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison).toBe((0, etats_financiers_communs_1.motifColonneN1NonTenue)('SYCEBNL', 0, true));
        for (const texte of [tft.mentionOuverture ?? '', tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison ?? '']) {
            expect(texte).toContain('clôturé sans aucune écriture');
            expect(texte).not.toMatch(/est ouvert|clôturez-le|Importez/);
        }
    });
    it('paquet 1, A2 · un exercice précédent qui n’a que du brouillard · la mention et la colonne N-1 disent de le valider, pas d’importer', async () => {
        const auBrouillard = serviceAvecExercices({ eN1: [], eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0), ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)] }, DEUX_EXERCICES);
        const ecritures = auBrouillard.ecritureService;
        ecritures.nombreAuBrouillard.mockResolvedValue(2);
        const tft = await auBrouillard.tableauFluxTresorerie('t1', 'eN');
        expect(ecritures.nombreAuBrouillard).toHaveBeenCalledWith('t1', 'eN1');
        expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYCEBNL', false, 2));
        expect(tft.mentionOuverture).toContain('Validez-les (AUDCIF art. 22, 2°)');
        expect(tft.mentionOuverture).not.toContain('Importez');
        expect(tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison).toBe((0, etats_financiers_communs_1.motifColonneN1NonTenue)('SYCEBNL', 2));
    });
    it('paquet 1, A2 · un exercice précédent tenu n’est pas compté', async () => {
        const tenu = serviceAvecExercices({ eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0), ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)], eN: [] }, DEUX_EXERCICES);
        await tenu.tableauFluxTresorerie('t1', 'eN');
        const ecritures = tenu.ecritureService;
        expect(ecritures.nombreAuBrouillard).not.toHaveBeenCalled();
    });
    it('applique la formule officielle et BOUCLE : cycle complet des cotisations sur deux exercices', async () => {
        const service = serviceAvecExercices({
            eN1: [
                ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 1000, 800),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 800, 0),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1000),
            ],
            eN: [
                ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 1500, 1400, [200, 0]),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1400, 0, [800, 0]),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1500),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'ZA').montant).toBe(800);
        expect(ref(tft, 'FA').montant).toBe(1400);
        expect(ref(tft, 'ZB').montant).toBe(1400);
        expect(ref(tft, 'ZF').montant).toBe(1400);
        expect(ref(tft, 'ZG').montant).toBe(2200);
        expect(tft.controle.tresorerieClotureParFlux).toBe(2200);
        expect(tft.controle.tresorerieClotureParBilan).toBe(2200);
        expect(tft.controle.ecart).toBe(0);
        expect(tft.controle.coherent).toBe(true);
    });
    it('côté charges : le décaissement fournisseurs est le paiement RÉEL, pas l’achat de l’exercice', async () => {
        const service = serviceAvecExercices({
            eN1: [
                ligneF('40110000', client_1.ClasseCompte.CLASSE_4, 0, 150),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0),
            ],
            eN: [
                ligneF('40110000', client_1.ClasseCompte.CLASSE_4, 500, 600, [0, 150]),
                ligneF('60400000', client_1.ClasseCompte.CLASSE_6, 600, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 500, [1000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FF').montant).toBe(-500);
        expect(ref(tft, 'ZB').montant).toBe(-500);
        expect(ref(tft, 'ZG').montant).toBe(500);
        expect(tft.controle.coherent).toBe(true);
    });
    it('le REPORT À-NOUVEAU d’une immobilisation n’est JAMAIS une acquisition de l’exercice', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 25000, 0)],
            eN: [
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, 5000, 0, [20000, 0]),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 5000, [25000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(-5000);
        expect(tft.controle.coherent).toBe(true);
    });
    it('une acquisition ET une cession la même année ne se compensent pas : deux flux réels, de sens opposés', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 10000, 0)],
            eN: [
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, 5000, 3000),
                ligneF('82200000', client_1.ClasseCompte.CLASSE_8, 0, 3500),
                ligneF('81200000', client_1.ClasseCompte.CLASSE_8, 3000, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 3500, 5000, [10000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(-5000);
        expect(ref(tft, 'FK').montant).toBe(3500);
        expect(ref(tft, 'ZC').montant).toBe(-1500);
        expect(tft.controle.coherent).toBe(true);
    });
    it('un compte NON VENTILÉ est dit, et l’écart de bouclage en chiffre exactement l’effet', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)],
            eN: [
                ligneF('44910000', client_1.ClasseCompte.CLASSE_4, 500, 0),
                ligneF('71100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [1000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FB').montant).toBe(500);
        expect(tft.controle.tresorerieClotureParFlux).toBe(1500);
        expect(tft.controle.tresorerieClotureParBilan).toBe(1000);
        expect(tft.controle.ecart).toBe(500);
        expect(tft.controle.coherent).toBe(false);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toContain('44910000');
    });
    it('sans exercice antérieur, la trésorerie d’ouverture est nulle et le tableau le dit', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 900),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 900, 0),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.exerciceN1Disponible).toBe(false);
        expect(ref(tft, 'ZA').montant).toBe(0);
        expect(ref(tft, 'FA').montant).toBe(900);
        expect(ref(tft, 'ZG').montant).toBe(900);
        expect(tft.controle.coherent).toBe(true);
    });
    it('second tour, B1 · l’ouverture annulée par un négatif du 15/03 · la mention le dit, article du SYCEBNL', async () => {
        const service = serviceAvecExercices({
            eN: [ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 900), ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 900, 0)],
        });
        const ecritures = service.ecritureService;
        ecritures.positionDOuvertureAuPremierJour.mockResolvedValue({ etat: 'NULLE', negatifsTardifs: [{ piece: 'OD n° 2', date: new Date('2027-03-15') }] });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.mentionOuverture).toMatch(/OD n° 2 du 15\/03\/2027.*flux de l'exercice.*SYCEBNL art\. 16, 4\)/);
        expect(ref(tft, 'ZA').montant).toBe(0);
    });
    it('AUCUN compte n’est réclamé par deux postes de flux · ni en flux, ni en contrepartie', async () => {
        const ECHANTILLON = [
            '70100000', '70400000', '70600000', '70500000', '71100000', '77100000',
            '60400000', '61200000', '62200000', '64100000', '65800000', '66100000', '67100000',
            '40110000', '41100000', '41610000', '41810000', '41200000', '41620000', '41820000',
            '42200000', '43100000', '44200000', '44910000', '47110000', '47310000', '47320000', '47500000',
            '41310000', '41320000', '41330000', '41380000', '41910000', '41920000', '41940000', '41980000',
            '48100000', '48510000', '48560000',
            '21200000', '23110000', '26100000', '27100000', '10110000', '14110000', '16500000', '18200000',
            '82200000', '82600000', '88100000',
        ];
        for (const numero of ECHANTILLON) {
            const enFlux = correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptesFlux, p.exclusionsFlux));
            const enContrepartie = correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => p.comptesContrepartie && (0, etats_financiers_communs_1.correspond)(numero, p.comptesContrepartie, p.exclusionsContrepartie));
            const parLecture = new Map();
            for (const p of enFlux)
                parLecture.set(p.lectureFlux, [...(parLecture.get(p.lectureFlux) ?? []), p.ref]);
            for (const [lecture, refs] of parLecture) {
                expect({ numero, lecture, refs }).toEqual({ numero, lecture, refs: refs.slice(0, 1) });
            }
            expect({ numero, contreparties: enContrepartie.map((p) => p.ref) }).toEqual({
                numero,
                contreparties: enContrepartie.map((p) => p.ref).slice(0, 1),
            });
        }
    });
    it('AUCUNE contrepartie sans trésorerie n’est captée par un poste', () => {
        for (const { numero, intitule } of correspondance_tft_1.CONTREPARTIES_SANS_TRESORERIE) {
            const compteReel = numero.padEnd(8, '0');
            const captants = correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => p.comptesContrepartie && (0, etats_financiers_communs_1.correspond)(compteReel, p.comptesContrepartie, p.exclusionsContrepartie)).map((p) => p.ref);
            expect({ numero, intitule, captants }).toEqual({ numero, intitule, captants: [] });
        }
    });
    it('le bloc « comptes non ventilés » ne signale QUE ce qui peut expliquer un écart', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('70410000', client_1.ClasseCompte.CLASSE_7, 0, 800),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 800, 0),
                ligneF('65400000', client_1.ClasseCompte.CLASSE_6, 1000, 0),
                ligneF('75420000', client_1.ClasseCompte.CLASSE_7, 400, 1000),
                ligneF('47130000', client_1.ClasseCompte.CLASSE_4, 0, 400),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('… mais y laisse le compte que le PLAN ne tranche pas', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('44910000', client_1.ClasseCompte.CLASSE_4, 500, 0),
                ligneF('71100000', client_1.ClasseCompte.CLASSE_7, 0, 500),
                ligneF('68100000', client_1.ClasseCompte.CLASSE_6, 300, 0),
                ligneF('28110000', client_1.ClasseCompte.CLASSE_2, 0, 300),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.ecart).toBe(500);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['44910000']);
    });
    it('aucun compte « sans trésorerie » n’est en même temps le FLUX d’un poste', () => {
        for (const { numero } of correspondance_tft_1.COMPTES_SANS_TRESORERIE) {
            const compteReel = numero.padEnd(8, '0');
            const captants = correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => (0, etats_financiers_communs_1.correspond)(compteReel, p.comptesFlux, p.exclusionsFlux)).map((p) => p.ref);
            expect({ numero, captants }).toEqual({ numero, captants: [] });
        }
    });
    it('le compte 4572 « Bénévoles » n’est rattaché à AUCUN poste (anomalie n° 5)', () => {
        const compte = '45720000';
        expect(correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => (0, etats_financiers_communs_1.correspond)(compte, p.comptesFlux, p.exclusionsFlux))).toEqual([]);
        expect(correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => p.comptesContrepartie && (0, etats_financiers_communs_1.correspond)(compte, p.comptesContrepartie, p.exclusionsContrepartie))).toEqual([]);
    });
    it('la souscription non libérée d’un apporteur corrige bien FM, elle', () => {
        const fm = correspondance_tft_1.TOUS_LES_POSTES_FLUX.find((p) => p.ref === 'FM');
        for (const apporteur of ['45110000', '45120000', '45210000', '45620000', '45800000']) {
            expect({ apporteur, capte: (0, etats_financiers_communs_1.correspond)(apporteur, fm.comptesContrepartie, fm.exclusionsContrepartie) }).toEqual({
                apporteur,
                capte: true,
            });
        }
        for (const horsDotation of ['45150000', '45550000', '45710000', '45720000']) {
            expect({
                horsDotation,
                capte: (0, etats_financiers_communs_1.correspond)(horsDotation, fm.comptesContrepartie, fm.exclusionsContrepartie),
            }).toEqual({ horsDotation, capte: false });
        }
    });
    it('l’extourne de clôture des dons en nature ne déplace PAS la trésorerie', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('70410000', client_1.ClasseCompte.CLASSE_7, 0, 800),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 800, 0),
                ligneF('65400000', client_1.ClasseCompte.CLASSE_6, 1000, 0),
                ligneF('75420000', client_1.ClasseCompte.CLASSE_7, 400, 1000),
                ligneF('47130000', client_1.ClasseCompte.CLASSE_4, 0, 400),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FC').montant).toBe(800);
        expect(ref(tft, 'FH').montant).toBe(0);
        expect(tft.controle.tresorerieClotureParFlux).toBe(800);
        expect(tft.controle.tresorerieClotureParBilan).toBe(800);
        expect(tft.controle.coherent).toBe(true);
    });
    it('la colonne N-1 est une VRAIE comparaison à trois exercices, pas une copie de la colonne N', async () => {
        const trois = [
            { id: 'eN', dateDebut: new Date('2027-01-01') },
            { id: 'eN1', dateDebut: new Date('2026-01-01') },
            { id: 'eN2', dateDebut: new Date('2025-01-01') },
        ];
        const service = serviceAvecExercices({
            eN2: [ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 50, 0)],
            eN1: [
                ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 150, 0),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 900),
            ],
            eN: [
                ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 150, 0),
                ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 1000),
            ],
        }, trois);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FA').montant).toBe(1000);
        expect(ref(tft, 'FA').montantN1).toBe(800);
        expect(tft.exerciceN1Disponible).toBe(true);
    });
    it('sans troisième exercice (N-2), la colonne N-1 se dégrade proprement · jamais un crash', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 200, 0), ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 500)],
            eN: [ligneF('70100000', client_1.ClasseCompte.CLASSE_7, 0, 100)],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FA').montantN1).toBe(300);
    });
    it('la couverture des charges par la dotation consomptible (1049 / 703) ne décaisse rien en FO', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('10410000', client_1.ClasseCompte.CLASSE_1, 0, 1000),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 400),
                ligneF('60400000', client_1.ClasseCompte.CLASSE_6, 400, 0),
                ligneF('10490000', client_1.ClasseCompte.CLASSE_1, 400, 0),
                ligneF('70300000', client_1.ClasseCompte.CLASSE_7, 0, 400),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FM').montant).toBe(1000);
        expect(ref(tft, 'FO').montant).toBe(0);
        expect(ref(tft, 'FF').montant).toBe(-400);
        expect(ref(tft, 'ZF').montant).toBe(600);
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('l’incorporation de l’excédent à la dotation (131 / 101), que la balance ne qualifie pas, est NOMMÉE à côté de l’écart', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0)],
            eN: [
                ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 500, 0, [0, 500]),
                ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 500),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [500, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.ecart).toBe(500);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['13100000']);
    });
    it('… mais une affectation ordinaire au report à nouveau ne fait pas de bruit quand le tableau boucle', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0)],
            eN: [
                ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 500, 0, [0, 500]),
                ligneF('12100000', client_1.ClasseCompte.CLASSE_1, 0, 300),
                ligneF('11100000', client_1.ClasseCompte.CLASSE_1, 0, 200),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [500, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('… ni quand l’écart a une autre cause et que la dotation n’a pas bougé', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0)],
            eN: [
                ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 500, 0, [0, 500]),
                ligneF('12100000', client_1.ClasseCompte.CLASSE_1, 0, 500),
                ligneF('44910000', client_1.ClasseCompte.CLASSE_4, 200, 0),
                ligneF('71100000', client_1.ClasseCompte.CLASSE_7, 0, 200),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [500, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.ecart).toBe(200);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['44910000']);
    });
    it('les reprises du 16 au 792 et l’engagement 1679 / 192 ne sont pas des remboursements (Guide App. 4)', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 45_000_000, 15_000_000),
                ligneF('16500000', client_1.ClasseCompte.CLASSE_1, 15_000_000, 45_000_000),
                ligneF('79250000', client_1.ClasseCompte.CLASSE_7, 0, 15_000_000),
                ligneF('60400000', client_1.ClasseCompte.CLASSE_6, 15_000_000, 0),
                ligneF('16710000', client_1.ClasseCompte.CLASSE_1, 2_000_000, 0, [0, 40_000_000]),
                ligneF('79230000', client_1.ClasseCompte.CLASSE_7, 0, 2_000_000),
                ligneF('16790000', client_1.ClasseCompte.CLASSE_1, 500_000, 0),
                ligneF('19200000', client_1.ClasseCompte.CLASSE_1, 0, 500_000),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FM').montant).toBe(45_000_000);
        expect(ref(tft, 'FO').montant).toBe(0);
        expect(ref(tft, 'FP').montant).toBe(0);
        expect(ref(tft, 'FQ').montant).toBe(0);
        expect(ref(tft, 'ZF').montant).toBe(30_000_000);
        expect(tft.controle.coherent).toBe(true);
    });
    it('un débit du 16 que le texte ne décrit pas (une restitution) est un décaissement de fonds propres (FO)', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 5000, 0)],
            eN: [
                ligneF('16500000', client_1.ClasseCompte.CLASSE_1, 1000, 0, [0, 5000]),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 1000, [5000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FO').montant).toBe(-1000);
        expect(ref(tft, 'FQ').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
    });
    it('chaque débit du 16 que le plan apparie à une contrepartie sans trésorerie est neutralisé dans FO', () => {
        const fo = correspondance_tft_1.TOUS_LES_POSTES_FLUX.find((p) => p.ref === 'FO');
        const retranche = (numero) => (fo.creditsARetrancher ?? []).some((r) => (0, etats_financiers_communs_1.correspond)(numero, r.comptes, r.exclusions));
        for (const reprise of ['79230000', '79250000', '79280000']) {
            expect({ reprise, retranche: retranche(reprise) }).toEqual({ reprise, retranche: true });
        }
        for (const poste of correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => p.lectureFlux === 'DEBIT_SEUL')) {
            expect({ poste: poste.ref, lit1679: (0, etats_financiers_communs_1.correspond)('16790000', poste.comptesFlux, poste.exclusionsFlux) }).toEqual({
                poste: poste.ref,
                lit1679: false,
            });
        }
    });
    it('un en-cours payé en N-1 et achevé en N n’est pas une seconde acquisition', async () => {
        const service = serviceAvecExercices({
            eN1: [
                ligneF('23910000', client_1.ClasseCompte.CLASSE_2, 1000, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 5000, 1000),
            ],
            eN: [
                ligneF('23910000', client_1.ClasseCompte.CLASSE_2, 0, 1000, [1000, 0]),
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, 1000, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [4000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
    });
    const CINQUANTE = 50_000_000;
    const miseEnService = (definitif, enCours) => new Map([
        [`id-${definitif}`, { debit: CINQUANTE, credit: 0 }],
        [`id-${enCours}`, { debit: 0, credit: CINQUANTE }],
    ]);
    it('D6 · un logiciel acquis au 219 et mis en service au 213 dans l’exercice ne se décaisse qu’une fois', async () => {
        const lignes = {
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 60_000_000, 0)],
            eN: [
                ligneF('21900000', client_1.ClasseCompte.CLASSE_2, CINQUANTE, CINQUANTE),
                ligneF('21300000', client_1.ClasseCompte.CLASSE_2, CINQUANTE, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, CINQUANTE, [60_000_000, 0]),
            ],
        };
        const tft = await serviceAvecExercices(lignes, DEUX_EXERCICES, { eN: miseEnService('21300000', '21900000') })
            .tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(-CINQUANTE);
        expect(tft.controle.coherent).toBe(true);
        const sansFiche = await serviceAvecExercices(lignes, DEUX_EXERCICES).tableauFluxTresorerie('t1', 'eN');
        expect(ref(sansFiche, 'FI').montant).toBe(-2 * CINQUANTE);
    });
    it('D6 · un bâtiment acquis au 239 et mis en service au 231 · le crédit du 239 n’est pas retranché deux fois', async () => {
        const tft = await serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 60_000_000, 0)],
            eN: [
                ligneF('23910000', client_1.ClasseCompte.CLASSE_2, CINQUANTE, CINQUANTE),
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, CINQUANTE, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, CINQUANTE, [60_000_000, 0]),
            ],
        }, DEUX_EXERCICES, { eN: miseEnService('23110000', '23910000') }).tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(-CINQUANTE);
        expect(tft.controle.coherent).toBe(true);
    });
    it('lot 14 · la réévaluation passée par le module ne se lit pas en acquisition (FI, exemple du § 4.3.1)', async () => {
        const lignes = {
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 10_000_000, 0)],
            eN: [
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, 18_750_000, 0, [150_000_000, 0]),
                ligneF('28310000', client_1.ClasseCompte.CLASSE_2, 0, 3_750_000, [0, 30_000_000]),
                ligneF('10611000', client_1.ClasseCompte.CLASSE_1, 0, 15_000_000),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [10_000_000, 0]),
            ],
        };
        const reevaluation = new Map([
            ['id-23110000', { debit: 18_750_000, credit: 0 }],
            ['id-28310000', { debit: 0, credit: 3_750_000 }],
            ['id-10611000', { debit: 0, credit: 15_000_000 }],
        ]);
        const tft = await serviceAvecExercices(lignes, DEUX_EXERCICES, {}, { eN: reevaluation }).tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(0);
        expect(ref(tft, 'ZC').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
        const sansLiaison = await serviceAvecExercices(lignes, DEUX_EXERCICES).tableauFluxTresorerie('t1', 'eN');
        expect(ref(sansLiaison, 'FI').montant).toBe(-18_750_000);
        expect(sansLiaison.controle.coherent).toBe(false);
    });
    it('A22 · les coûts d’emprunt incorporés par le module ne se lisent pas en acquisition (FI)', async () => {
        const lignes = {
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 10_000_000, 0)],
            eN: [
                ligneF('67120000', client_1.ClasseCompte.CLASSE_6, 1_000_000, 0),
                ligneF('23910000', client_1.ClasseCompte.CLASSE_2, 1_000_000, 0),
                ligneF('78700000', client_1.ClasseCompte.CLASSE_7, 0, 1_000_000),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 1_000_000, [10_000_000, 0]),
            ],
        };
        const incorporation = new Map([
            ['id-23910000', { debit: 1_000_000, credit: 0 }],
            ['id-78700000', { debit: 0, credit: 1_000_000 }],
        ]);
        const tft = await serviceAvecExercices(lignes, DEUX_EXERCICES, {}, {}, { eN: incorporation }).tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
        const sansLiaison = await serviceAvecExercices(lignes, DEUX_EXERCICES).tableauFluxTresorerie('t1', 'eN');
        expect(ref(sansLiaison, 'FI').montant).toBe(-1_000_000);
        expect(sansLiaison.controle.coherent).toBe(false);
    });
    it('lot 14 · un titre immobilisé réévalué ne se lit pas en acquisition financière (FJ)', async () => {
        const lignes = {
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1_000, 0)],
            eN: [
                ligneF('27410000', client_1.ClasseCompte.CLASSE_2, 400, 0, [1_000, 0]),
                ligneF('10612000', client_1.ClasseCompte.CLASSE_1, 0, 400),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [1_000, 0]),
            ],
        };
        const reevaluation = new Map([
            ['id-27410000', { debit: 400, credit: 0 }],
            ['id-10612000', { debit: 0, credit: 400 }],
        ]);
        const tft = await serviceAvecExercices(lignes, DEUX_EXERCICES, {}, { eN: reevaluation }).tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FJ').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
    });
    it('une avance versée en N-1 puis imputée en N ne se décaisse qu’une fois', async () => {
        const service = serviceAvecExercices({
            eN1: [
                ligneF('25200000', client_1.ClasseCompte.CLASSE_2, 300, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 5000, 300),
            ],
            eN: [
                ligneF('25200000', client_1.ClasseCompte.CLASSE_2, 0, 300, [300, 0]),
                ligneF('24410000', client_1.ClasseCompte.CLASSE_2, 1000, 0),
                ligneF('48120000', client_1.ClasseCompte.CLASSE_4, 700, 700),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 700, [4700, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FI').montant).toBe(-700);
        expect(tft.controle.coherent).toBe(true);
    });
    it('la production immobilisée n’est pas une acquisition décaissée · ses charges le sont déjà en FF', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('60400000', client_1.ClasseCompte.CLASSE_6, 500, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 500, [0, 0]),
                ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000),
                ligneF('23110000', client_1.ClasseCompte.CLASSE_2, 500, 0),
                ligneF('72200000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FF').montant).toBe(-500);
        expect(ref(tft, 'FI').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('l’achèvement d’un 219, que la balance ne qualifie pas, est nommé à côté de l’écart', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)],
            eN: [
                ligneF('21930000', client_1.ClasseCompte.CLASSE_2, 0, 800, [800, 0]),
                ligneF('21300000', client_1.ClasseCompte.CLASSE_2, 800, 0),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [1000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.ecart).toBe(-800);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['21930000']);
    });
    it('une avance de cotisation (52 / 4191) et un chèque impayé (4131 / 52) laissent le tableau cohérent', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)],
            eN: [
                ligneF('41910000', client_1.ClasseCompte.CLASSE_4, 0, 500),
                ligneF('41310000', client_1.ClasseCompte.CLASSE_4, 200, 0),
                ligneF('41920000', client_1.ClasseCompte.CLASSE_4, 0, 150),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 650, 200, [1000, 0]),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ref(tft, 'FA').montant).toBe(300);
        expect(ref(tft, 'FE').montant).toBe(150);
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('les comptes que le plan ne tranche pas (anomalies n° 6 à 10) ne sont captés par AUCUN poste', () => {
        for (const compte of ['41860000', '47380000', '47390000', '82800000', '47210000', '47260000', '83100000', '84100000', '84300000', '48400000']) {
            const captants = correspondance_tft_1.TOUS_LES_POSTES_FLUX.filter((p) => (0, etats_financiers_communs_1.correspond)(compte, p.comptesFlux, p.exclusionsFlux) ||
                (p.comptesContrepartie && (0, etats_financiers_communs_1.correspond)(compte, p.comptesContrepartie, p.exclusionsContrepartie))).map((p) => p.ref);
            expect({ compte, captants }).toEqual({ compte, captants: [] });
        }
    });
    it('variation de stocks produits (736) et dépréciation de tiers (659 / 491) ne font pas de bruit au diagnostic', async () => {
        const service = serviceAvecExercices({
            eN: [
                ligneF('36000000', client_1.ClasseCompte.CLASSE_3, 200, 0),
                ligneF('73600000', client_1.ClasseCompte.CLASSE_7, 0, 200),
                ligneF('65900000', client_1.ClasseCompte.CLASSE_6, 100, 0),
                ligneF('49110000', client_1.ClasseCompte.CLASSE_4, 0, 100),
                ligneF('83900000', client_1.ClasseCompte.CLASSE_8, 50, 0),
                ligneF('49980000', client_1.ClasseCompte.CLASSE_4, 20, 50),
                ligneF('84900000', client_1.ClasseCompte.CLASSE_8, 0, 20),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.coherent).toBe(true);
        expect(tft.comptesNonVentiles).toEqual([]);
    });
    it('… mais y laisse l’abandon de créance (836), dont l’autre moitié est lue en FA', async () => {
        const service = serviceAvecExercices({
            eN1: [ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 300, 0)],
            eN: [
                ligneF('41100000', client_1.ClasseCompte.CLASSE_4, 0, 300, [300, 0]),
                ligneF('83600000', client_1.ClasseCompte.CLASSE_8, 300, 0),
            ],
        }, DEUX_EXERCICES);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(tft.controle.ecart).toBe(300);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['83600000']);
    });
    it('reproduit l’ordre officiel, en-têtes de section compris, et la ligne de financement SANS code REF', async () => {
        const service = serviceAvecExercices({ eN: [] });
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        const refs = tft.lignes.filter((l) => !('section' in l)).map((l) => l.ref);
        expect(refs).toEqual([
            'ZA',
            'FA', 'FB', 'FC', 'FD', 'FE', 'FF', 'FG', 'FH', 'ZB',
            'FI', 'FJ', 'FK', 'FL', 'ZC',
            'FM', 'FN', 'FO', 'ZD',
            'FP', 'FQ', 'ZE',
            '',
            'ZF', 'ZG',
        ]);
        const sections = tft.lignes.filter((l) => 'section' in l).map((l) => l.section);
        expect(sections).toHaveLength(4);
        expect(sections[0]).toBe('Flux de trésorerie provenant des activités opérationnelles');
    });
});
describe('Exercice introuvable · un refus, jamais un état à zéro (audit final F222)', () => {
    it.each(['bilan', 'compteDeResultat', 'tableauFluxTresorerie'])('%s refuse un exercice que le dossier ne porte pas', async (etat) => {
        const service = serviceAvecExercices({ e1: [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)] });
        await expect(service[etat]('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(service[etat]('t1', 'inconnu')).rejects.toThrow('Exercice introuvable dans ce dossier');
    });
});
describe('Comparatif d’un dossier repris · le bilan d’ouverture (Q3 des cas chiffrés de la clôture)', () => {
    const lignes = [
        ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 2000]),
        ligneF('12100000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 500]),
        ligneF('24410000', client_1.ClasseCompte.CLASSE_2, 0, 0, [1800, 0]),
        ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0, [700, 0]),
        ligneF('70110000', client_1.ClasseCompte.CLASSE_7, 0, 1000),
    ];
    const service = () => serviceAvecExercices({ e1: lignes }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }]);
    it('la colonne N-1 du bilan lit l’ouverture, et le dit', async () => {
        const bilan = await service().bilan('t1', 'e1');
        expect({
            disponible: bilan.exerciceN1Disponible,
            comparatif: bilan.comparatif,
            mention: bilan.mentionComparatif,
            bz: bilan.totalActifN1,
            dz: bilan.totalPassifN1,
        }).toEqual({
            disponible: false,
            comparatif: 'BILAN_D_OUVERTURE',
            mention: expect.stringContaining('SYCEBNL, Partie 4 ch. 1 § 1.4'),
            bz: 2500,
            dz: 2500,
        });
        expect(bilan.mentionComparatif).not.toContain('AUDCIF');
    });
    it('le compte de résultat N-1 reste vide, l’issue dite', async () => {
        const cr = await service().compteDeResultat('t1', 'e1');
        expect(cr.totalProduitsN1).toBeUndefined();
        expect(cr.motifComparatifAbsent).toContain('importez-y sa balance de clôture');
    });
    it('une association qui naît n’a ni colonne N-1 ni mention', async () => {
        const neuve = serviceAvecExercices({ e1: [ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 1000), ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 1000, 0)] }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }]);
        const bilan = await neuve.bilan('t1', 'e1');
        expect({ comparatif: bilan.comparatif, bz: bilan.totalActifN1 }).toEqual({ comparatif: null, bz: undefined });
        expect((await neuve.compteDeResultat('t1', 'e1')).motifComparatifAbsent).toBeNull();
    });
});
describe('Paquet 1, A4 · l’ouverture d’un premier exercice clôturé se lit avant le virement du 13', () => {
    const apresCloture = [
        ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500_000, 0, [12_000_000, 0]),
        ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 10_000_000]),
        ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 0, 0, [2_000_000, 2_000_000]),
        ligneF('12100000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 2_000_000]),
        ligneF('70110000', client_1.ClasseCompte.CLASSE_7, 0, 500_000),
    ];
    const avantCloture = [
        ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500_000, 0, [12_000_000, 0]),
        ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 10_000_000]),
        ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 2_000_000]),
        ligneF('70110000', client_1.ClasseCompte.CLASSE_7, 0, 500_000),
    ];
    const service = () => serviceAvecExercices({ e1: apresCloture }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }], {}, {}, {}, {
        e1: avantCloture,
    });
    const poste = (bilan, ref) => [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);
    it('la colonne N-1 porte le résultat 2025 au 13 et aucun report à nouveau', async () => {
        const bilan = await service().bilan('t1', 'e1');
        expect({
            comparatif: bilan.comparatif,
            chN1: poste(bilan, 'CH')?.montantN1,
            cgN1: poste(bilan, 'CG')?.montantN1,
            dzN1: bilan.totalPassifN1,
            chN: poste(bilan, 'CH')?.montant,
            cgN: poste(bilan, 'CG')?.montant,
        }).toEqual({ comparatif: 'BILAN_D_OUVERTURE', chN1: 2_000_000, cgN1: 0, dzN1: 12_000_000, chN: 500_000, cgN: 2_000_000 });
    });
    it('l’ouverture est demandée avant la clôture, à la balance du livre-journal', async () => {
        const s = service();
        await s.bilan('t1', 'e1');
        await s.tableauFluxTresorerie('t1', 'e1');
        await s.compteDeResultat('t1', 'e1');
        const balance = s.ecritureService.balance;
        const ouvertures = balance.mock.calls.filter((c) => c[4]?.avantLaCloture);
        expect(ouvertures).toHaveLength(3);
        for (const c of ouvertures)
            expect(c.slice(0, 3)).toEqual(['t1', 'e1', false]);
    });
    it('le tableau des flux part de la même ouverture, et le dit', async () => {
        const tft = await service().tableauFluxTresorerie('t1', 'e1');
        expect(tft.lignes.find((l) => l.ref === 'ZA')?.montant).toBe(12_000_000);
        expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionComparatifSurOuverture)('SYCEBNL'));
    });
});
describe('Paquet 1, A7 · TFT des associations · une ouverture passée en OD au premier jour', () => {
    const lignes = [
        ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 10_000_000),
        ligneF('13100000', client_1.ClasseCompte.CLASSE_1, 0, 2_000_000),
        ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 12_500_000, 0),
        ligneF('70110000', client_1.ClasseCompte.CLASSE_7, 0, 500_000),
    ];
    const odDuPremierJour = (service) => {
        const ecritures = service.ecritureService;
        ecritures.ouverturePasseeAuPremierJour.mockResolvedValue({ nombre: 1, pieces: ['OD n° 1'] });
        return ecritures;
    };
    it('ni flux ni ouverture · ZA et les postes FA à FQ vides, leurs totaux aussi, le motif nomme la pièce', async () => {
        const service = serviceAvecExercices({ e1: lignes }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }]);
        const ecritures = odDuPremierJour(service);
        const tft = await service.tableauFluxTresorerie('t1', 'e1');
        expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'e1');
        const vides = new Set(tft.postesVides);
        expect(['ZA', 'FA', 'FM', 'ZB', 'ZD', 'ZF', 'ZG'].every((r) => vides.has(r))).toBe(true);
        expect(correspondance_tft_1.TOUS_LES_POSTES_FLUX.every((p) => vides.has(p.ref))).toBe(true);
        expect(tft.postesNonCalculables.find((p) => p.ref === 'FM')?.raison).toContain('OD n° 1');
        expect(tft.mentionOuverture).toContain('passez-le en à-nouveau');
        expect(tft.mentionOuverture).toContain('SYCEBNL art. 16, 4)');
        expect(tft.lignes.find((l) => l.ref === 'FM')?.montant).toBe(0);
        expect(tft.comptesNonVentiles.map((c) => c.numero)).not.toContain('13100000');
    });
    it('le contrôle du tableau n’est pas effectué · coherent et écart null, motif dit', async () => {
        const service = serviceAvecExercices({ e1: lignes }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }]);
        odDuPremierJour(service);
        const tft = await service.tableauFluxTresorerie('t1', 'e1');
        expect(tft.controle).toEqual({
            tresorerieOuverture: null,
            variation: null,
            tresorerieClotureParFlux: null,
            tresorerieClotureParBilan: 12_500_000,
            ecart: null,
            coherent: null,
            motifNonControlable: expect.stringContaining('Contrôle non effectué'),
        });
        expect(tft.controle.motifNonControlable).toContain('(ZA)');
        expect(tft.controle.motifNonControlable).toContain('(ZF)');
    });
    it('la colonne N-1 suit la même règle · ses postes vides restent vides, jamais des zéros', async () => {
        const service = serviceAvecExercices({ eN1: lignes, eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [12_500_000, 0])] }, DEUX_EXERCICES);
        const ecritures = odDuPremierJour(service);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'eN1');
        expect(ecritures.ouverturePasseeAuPremierJour).not.toHaveBeenCalledWith('t1', 'eN');
        expect(tft.lignes.find((l) => l.ref === 'FM')?.montantN1).toBeUndefined();
        expect(tft.lignes.find((l) => l.ref === 'ZA')?.montantN1).toBeUndefined();
        expect(tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison).toContain('OD n° 1');
        expect(tft.postesVides).toEqual([]);
    });
    it('relecture m2 · l’exercice précédent au brouillard est dit avec l’OD, et l’issue de sa validation reste', async () => {
        const service = serviceAvecExercices({ eN1: [], eN: lignes }, DEUX_EXERCICES);
        const ecritures = odDuPremierJour(service);
        ecritures.nombreAuBrouillard.mockResolvedValue(2);
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'eN');
        const attendu = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)({ nombre: 1, pieces: ['OD n° 1'] }, 'SYCEBNL', { auBrouillard: 2, clos: false });
        expect(tft.mentionOuverture).toBe(attendu);
        expect(tft.postesNonCalculables.find((p) => p.ref === 'ZA')?.raison).toBe(attendu);
        expect(attendu).not.toContain('sans exercice précédent');
        expect(attendu).toContain('validez-les (AUDCIF art. 22, 2°)');
        expect(tft.postesVides).toContain('ZA');
    });
    it('relecture m2 · la colonne N-1 dit son propre exercice précédent (N-2) quand il existe sans rien tenir', async () => {
        const trois = [...DEUX_EXERCICES, { id: 'eN2', dateDebut: new Date('2024-01-01') }];
        const service = serviceAvecExercices({ eN2: [], eN1: lignes, eN: [ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [12_500_000, 0])] }, trois);
        const ecritures = service.ecritureService;
        ecritures.ouverturePasseeAuPremierJour.mockImplementation((_t, id) => Promise.resolve(id === 'eN1' ? { nombre: 1, pieces: ['OD n° 1'] } : null));
        const tft = await service.tableauFluxTresorerie('t1', 'eN');
        const motif = tft.postesNonCalculablesN1.find((p) => p.ref === 'ZA')?.raison;
        expect(motif).toBe((0, etats_financiers_communs_1.motifOuverturePasseeEnOd)({ nombre: 1, pieces: ['OD n° 1'] }, 'SYCEBNL', { auBrouillard: 0, clos: false }));
        expect(motif).toContain("l'exercice précédent étant ouvert sans aucune écriture");
    });
    it('un report tenu · l’OD du premier jour n’est pas cherchée, rien n’est vide', async () => {
        const service = serviceAvecExercices({ e1: [ligneF('10110000', client_1.ClasseCompte.CLASSE_1, 0, 0, [0, 2000]), ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, [2000, 0])] }, [{ id: 'e1', dateDebut: new Date('2026-01-01') }]);
        const ecritures = odDuPremierJour(service);
        const tft = await service.tableauFluxTresorerie('t1', 'e1');
        expect(ecritures.ouverturePasseeAuPremierJour).not.toHaveBeenCalled();
        expect({ vides: tft.postesVides, za: tft.lignes.find((l) => l.ref === 'ZA')?.montant }).toEqual({ vides: [], za: 2000 });
    });
});
describe('TFT des associations · la classe 9 est sans trésorerie (constat N5 des cas chiffrés de la clôture)', () => {
    it('le bénévolat (904 / 914) n’est jamais un compte « non ventilé »', async () => {
        const service = serviceAvecExercices({
            e1: [
                ligneF('90400000', client_1.ClasseCompte.CLASSE_9, 1_000_000, 0),
                ligneF('91400000', client_1.ClasseCompte.CLASSE_9, 0, 1_000_000),
                ligneF('52110000', client_1.ClasseCompte.CLASSE_5, 500, 0),
                ligneF('70110000', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ],
        });
        const tft = await service.tableauFluxTresorerie('t1', 'e1');
        expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual([]);
    });
});
//# sourceMappingURL=etats-financiers.service.spec.js.map
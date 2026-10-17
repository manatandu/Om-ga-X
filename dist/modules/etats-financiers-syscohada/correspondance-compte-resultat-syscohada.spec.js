"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("./correspondance-tft-syscohada");
describe('correspondance compte de résultat SYSCOHADA (AUDCIF Titre IX ch. 4 et ch. 7)', () => {
    const comptesDetail = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL');
    const comptesDeGestion = comptesDetail.filter((c) => '678'.includes(c.numero[0]));
    const toutesLesRefs = [...correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.map((p) => p.ref), ...correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.map((s) => s.ref)];
    describe('structure du modèle (ch. 4, section 2)', () => {
        it("reprend les 44 lignes de la maquette dans l'ordre exact, postes et soldes entrelacés", () => {
            expect(correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT).toEqual([
                'TA', 'RA', 'RB', 'XA',
                'TB', 'TC', 'TD', 'XB',
                'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ', 'XC',
                'RK', 'XD',
                'TJ', 'RL', 'RQP', 'TQP', 'XE',
                'TK', 'TL', 'TM', 'RM', 'RN', 'XF',
                'XG',
                'TN', 'TO', 'RO', 'RP', 'XH',
                'RQ', 'RS', 'XI',
            ]);
        });
        it('compte 15 produits (TA à TO), 18 charges (RA à RQ puis RS), 9 soldes (XA à XI) et les 2 postes du ch. 33', () => {
            expect(correspondance_compte_resultat_syscohada_1.POSTES_PRODUITS_SYSCOHADA.map((p) => p.ref)).toEqual([
                'TA', 'TB', 'TC', 'TD', 'TE', 'TF', 'TG', 'TH', 'TI', 'TJ', 'TQP', 'TK', 'TL', 'TM', 'TN', 'TO',
            ]);
            expect(correspondance_compte_resultat_syscohada_1.POSTES_CHARGES_SYSCOHADA.map((p) => p.ref)).toEqual([
                'RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ', 'RK', 'RL', 'RQP', 'RM', 'RN', 'RO', 'RP', 'RQ', 'RS',
            ]);
            expect(correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.map((s) => s.ref)).toEqual(['XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI']);
        });
        it("ne connaît ni RR, ni RT, ni XM, ni TP à TS · codes absents du modèle (anomalie n° 1 de la maquette du skill)", () => {
            for (const ref of ['RR', 'RT', 'XM', 'TP', 'TQ', 'TR', 'TS']) {
                expect(toutesLesRefs).not.toContain(ref);
            }
        });
        it('ne comporte aucun REF en double, postes et soldes confondus', () => {
            expect(new Set(toutesLesRefs).size).toBe(toutesLesRefs.length);
        });
        it("l'ordre d'affichage couvre exactement les postes + soldes, rien de plus, rien de moins", () => {
            expect(new Set(correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT)).toEqual(new Set(toutesLesRefs));
            expect(correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT).toHaveLength(toutesLesRefs.length);
        });
        it("l'ordre des postes de base dans la table est celui du modèle", () => {
            const refsPostesDansOrdreModele = correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.filter((r) => !r.startsWith('X'));
            expect(correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.map((p) => p.ref)).toEqual(refsPostesDansOrdreModele);
        });
        it('les quatre composantes du chiffre d’affaires portent les lettres A à D, et elles seules', () => {
            const lettres = correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.lettre).map((p) => [p.ref, p.lettre]);
            expect(lettres).toEqual([['TA', 'A'], ['TB', 'B'], ['TC', 'C'], ['TD', 'D']]);
        });
        it.each([
            ['TJ', "Reprises d'amortissements, provisions et dépréciations"],
            ['RM', 'Frais financiers et charges assimilées'],
            ['TO', 'Autres Produits HAO'],
            ['RP', 'Autres Charges HAO'],
            ['TE', 'Production stockée (ou déstockage)'],
            ['RQ', 'Participation des travailleurs'],
        ])('%s porte le libellé du modèle du ch. 4 : %s', (ref, libelle) => {
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)(ref).libelle).toBe(libelle);
        });
    });
    describe('formules des soldes intermédiaires (ch. 4, « logique de signe » : des sommes, jamais des différences)', () => {
        it.each([
            ['XA', ['TA', 'RA', 'RB']],
            ['XB', ['TA', 'TB', 'TC', 'TD']],
            ['XC', ['XB', 'RA', 'RB', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ']],
            ['XD', ['XC', 'RK']],
            ['XE', ['XD', 'TJ', 'RL', 'RQP', 'TQP']],
            ['XF', ['TK', 'TL', 'TM', 'RM', 'RN']],
            ['XG', ['XE', 'XF']],
            ['XH', ['TN', 'TO', 'RO', 'RP']],
            ['XI', ['XG', 'XH', 'RQ', 'RS']],
        ])('%s somme exactement %j', (ref, deRefs) => {
            expect((0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)(ref)?.deRefs).toEqual(deRefs);
        });
        it('chaque solde ne lit que des refs qui le PRÉCÈDENT dans l’ordre d’affichage · sinon le calcul en une passe lirait 0', () => {
            const dejaResolues = new Set();
            for (const ref of correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT) {
                const solde = (0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)(ref);
                if (solde) {
                    for (const r of solde.deRefs)
                        expect(dejaResolues.has(r)).toBe(true);
                }
                dejaResolues.add(ref);
            }
        });
        it('chaque solde ne référence que des refs qui existent', () => {
            const connues = new Set(toutesLesRefs);
            for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
                for (const r of s.deRefs)
                    expect(connues.has(r)).toBe(true);
        });
        it('« somme TE à RJ » couvre toutes les lignes entre TE et RJ dans l’ordre du modèle, aucune de plus', () => {
            const debut = correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.indexOf('TE');
            const fin = correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.indexOf('RJ');
            const plage = correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.slice(debut, fin + 1);
            expect((0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)('XC').deRefs.slice(3)).toEqual(plage);
        });
        it('chaque poste de base entre EXACTEMENT UNE FOIS dans XI (un poste oublié ou compté deux fois fausserait le résultat net)', () => {
            const compter = (ref, compteur) => {
                const solde = (0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)(ref);
                if (!solde) {
                    compteur.set(ref, (compteur.get(ref) ?? 0) + 1);
                    return;
                }
                for (const r of solde.deRefs)
                    compter(r, compteur);
            };
            const compteur = new Map();
            compter('XI', compteur);
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA)
                expect(compteur.get(p.ref)).toBe(1);
            expect(compteur.size).toBe(correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.length);
        });
        it('calculerSoldesIntermediaires : XI = somme signée de tous les postes, et chaque solde suit sa formule', () => {
            const montants = {};
            correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.forEach((p, i) => {
                const base = 1000 + i * 37;
                montants[p.ref] = p.sens === 'PRODUIT' ? base : -base;
            });
            const r = (0, correspondance_compte_resultat_syscohada_1.calculerSoldesIntermediaires)(montants);
            const totalPostes = correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.reduce((s, p) => s + montants[p.ref], 0);
            expect(r.XI).toBeCloseTo(totalPostes, 6);
            expect(r.XA).toBeCloseTo(montants.TA + montants.RA + montants.RB, 6);
            expect(r.XB).toBeCloseTo(montants.TA + montants.TB + montants.TC + montants.TD, 6);
            expect(r.XD).toBeCloseTo(r.XC + montants.RK, 6);
            expect(r.XE).toBeCloseTo(r.XD + montants.TJ + montants.RL + montants.RQP + montants.TQP, 6);
            expect(r.XG).toBeCloseTo(r.XE + r.XF, 6);
            expect(r.XI).toBeCloseTo(r.XG + r.XH + montants.RQ + montants.RS, 6);
        });
        it('calculerSoldesIntermediaires : une ref absente vaut 0, pas NaN', () => {
            const r = (0, correspondance_compte_resultat_syscohada_1.calculerSoldesIntermediaires)({ TA: 500, RA: -300 });
            expect(r.XA).toBe(200);
            expect(r.XI).toBe(200);
            expect(Number.isNaN(r.XC)).toBe(false);
        });
        it('porte sur chaque solde le sous-compte du 13 du Titre VII (132 à 138) · la maquette du skill les décalait (anomalie n° 2)', () => {
            const attendus = {
                XA: '132', XB: undefined, XC: '133', XD: '134', XE: '135', XF: '136', XG: '137', XH: '138', XI: undefined,
            };
            for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
                expect({ ref: s.ref, compte13: s.compte13 }).toEqual({ ref: s.ref, compte13: attendus[s.ref] });
        });
        it('XI est le seul solde dont le compte dépend du signe : 131 bénéfice, 139 perte (Titre VII, COMPTE 13)', () => {
            const avecSigne = correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.filter((s) => s.compte13ParSigne).map((s) => s.ref);
            expect(avecSigne).toEqual(['XI']);
            const xi = (0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)('XI');
            expect(xi.compte13ParSigne).toEqual({ benefice: '131', perte: '139' });
            expect((0, correspondance_compte_resultat_syscohada_1.compte13DuSolde)(xi, 1000)).toBe('131');
            expect((0, correspondance_compte_resultat_syscohada_1.compte13DuSolde)(xi, -1000)).toBe('139');
            expect((0, correspondance_compte_resultat_syscohada_1.compte13DuSolde)(xi, 0)).toBe('131');
            expect((0, correspondance_compte_resultat_syscohada_1.compte13DuSolde)((0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)('XA'), -50)).toBe('132');
            expect((0, correspondance_compte_resultat_syscohada_1.compte13DuSolde)((0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)('XB'), 50)).toBeUndefined();
        });
        it('chaque solde porte compte13 OU compte13ParSigne, jamais les deux', () => {
            for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
                expect(Boolean(s.compte13) && Boolean(s.compte13ParSigne)).toBe(false);
        });
        it('les huit soldes de gestion sont ceux qui ont un sous-compte 13 ; XB, agrégat de ventes, est la neuvième ligne X*', () => {
            const soldesDeGestion = correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.filter((s) => s.compte13 || s.compte13ParSigne);
            expect(soldesDeGestion).toHaveLength(8);
            expect(correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES).toHaveLength(9);
            expect(correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.filter((s) => !s.compte13 && !s.compte13ParSigne).map((s) => s.ref)).toEqual(['XB']);
        });
    });
    describe('rattachement des comptes du semis SYSCOHADA (ch. 7)', () => {
        it('chaque compte d’imputation des classes 6, 7 et 8 tombe dans UN poste et un seul', () => {
            expect(comptesDeGestion.length).toBeGreaterThan(200);
            for (const c of comptesDeGestion) {
                const candidats = correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.flatMap((p) => p.comptes.filter((prefixe) => c.numero.startsWith(prefixe)).map((prefixe) => ({ ref: p.ref, prefixe })));
                expect({ numero: c.numero, reclame: candidats.length > 0 }).toEqual({ numero: c.numero, reclame: true });
                const plusLong = Math.max(...candidats.map((x) => x.prefixe.length));
                const gagnants = [...new Set(candidats.filter((x) => x.prefixe.length === plusLong).map((x) => x.ref))];
                expect({ numero: c.numero, gagnants }).toEqual({
                    numero: c.numero,
                    gagnants: [(0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)(c.numero).ref],
                });
            }
        });
        it('les SEULS préfixes emboîtés sont les deux du ch. 33 · ailleurs les jetons du ch. 7 restent disjoints', () => {
            const emboites = [];
            for (const a of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                for (const court of a.comptes) {
                    for (const b of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                        if (a.ref === b.ref)
                            continue;
                        for (const long of b.comptes) {
                            if (long !== court && long.startsWith(court))
                                emboites.push(`${long} (${b.ref}) dans ${court} (${a.ref})`);
                        }
                    }
                }
            }
            expect(emboites.sort()).toEqual(['652 (RQP) dans 65 (RJ)', '752 (TQP) dans 75 (TH)']);
        });
        it.each([
            ['70110000', 'TA'],
            ['70210000', 'TB'],
            ['70410000', 'TB'],
            ['70510000', 'TC'],
            ['70610000', 'TC'],
            ['70710000', 'TD'],
            ['73600000', 'TE'],
            ['72100000', 'TF'],
            ['71810000', 'TG'],
            ['75420000', 'TH'],
            ['78100000', 'TI'],
            ['78700000', 'TM'],
            ['79110000', 'TJ'],
            ['79800000', 'TJ'],
            ['79900000', 'TJ'],
            ['79720000', 'TL'],
            ['77120000', 'TK'],
            ['82200000', 'TN'],
            ['84500000', 'TO'],
            ['86100000', 'TO'],
            ['88100000', 'TO'],
            ['60110000', 'RA'],
            ['60310000', 'RB'],
            ['60210000', 'RC'],
            ['60320000', 'RD'],
            ['60410000', 'RE'],
            ['60520000', 'RE'],
            ['60810000', 'RE'],
            ['60330000', 'RF'],
            ['61200000', 'RG'],
            ['62210000', 'RH'],
            ['63110000', 'RH'],
            ['64110000', 'RI'],
            ['65420000', 'RJ'],
            ['65210000', 'RQP'],
            ['65250000', 'RQP'],
            ['75210000', 'TQP'],
            ['75250000', 'TQP'],
            ['66110000', 'RK'],
            ['68120000', 'RL'],
            ['69110000', 'RL'],
            ['67120000', 'RM'],
            ['69710000', 'RN'],
            ['81200000', 'RO'],
            ['83100000', 'RP'],
            ['85100000', 'RP'],
            ['87100000', 'RQ'],
            ['89110000', 'RS'],
            ['89910000', 'RS'],
        ])('le compte %s alimente le poste %s', (numero, ref) => {
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)(numero)?.ref).toBe(ref);
        });
        it('éclate le 603 sur trois postes et jamais en bloc (ch. 7, clés de lecture)', () => {
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('60310000')?.ref).toBe('RB');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('60320000')?.ref).toBe('RD');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('60330000')?.ref).toBe('RF');
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                expect(p.comptes).not.toContain('603');
                expect(p.comptes).not.toContain('60');
            }
        });
        it('éclate 68/69, 78 et 79 par destination (exploitation / financier)', () => {
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RL').comptes).toEqual(['681', '691']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RN').comptes).toEqual(['697']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TI').comptes).toEqual(['781']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TM').comptes).toEqual(['787']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TJ').comptes).toEqual(['791', '798', '799']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TL').comptes).toEqual(['797']);
        });
        it('chaque préfixe cité existe réellement au plan SYSCOHADA semé', () => {
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                for (const prefixe of p.comptes) {
                    const existe = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.some((c) => c.numero.startsWith(prefixe));
                    expect({ ref: p.ref, prefixe, existe }).toEqual({ ref: p.ref, prefixe, existe: true });
                }
            }
        });
        it('n’attribue jamais deux postes au même préfixe', () => {
            const vus = new Map();
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                for (const prefixe of p.comptes) {
                    expect(vus.get(prefixe) ?? p.ref).toBe(p.ref);
                    vus.set(prefixe, p.ref);
                }
            }
        });
        it('ne cite aucun préfixe hors des classes 6, 7, 8', () => {
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                for (const prefixe of p.comptes)
                    expect('678').toContain(prefixe[0]);
            }
        });
        it('ne rattache aucun compte de bilan (classes 1 à 5) ni de classe 9 du semis', () => {
            const horsGestion = comptesDetail.filter((c) => !'678'.includes(c.numero[0]));
            expect(horsGestion.length).toBeGreaterThan(500);
            for (const c of horsGestion)
                expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)(c.numero)).toBeNull();
        });
    });
    describe('signes et renvois de notes (ch. 4, colonnes SIGNE et NOTE)', () => {
        it('les postes « –/+ » sont exactement les trois variations de stocks achetés et la production stockée', () => {
            const refs = correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.signe === '-/+').map((p) => p.ref);
            expect(refs).toEqual(['RB', 'TE', 'RD', 'RF']);
        });
        it('un produit est « + » (ou –/+), une charge est « – » (ou –/+) · jamais l’inverse', () => {
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
                if (p.signe === '-/+')
                    continue;
                expect(p.signe).toBe(p.sens === 'PRODUIT' ? '+' : '-');
            }
        });
        it('montantSigne = crédit − débit pour tout poste : la convention du modèle, charges en négatif', () => {
            expect((0, correspondance_compte_resultat_syscohada_1.montantSigne)(600, 0)).toBe(-600);
            expect((0, correspondance_compte_resultat_syscohada_1.montantSigne)(0, 1000)).toBe(1000);
            expect((0, correspondance_compte_resultat_syscohada_1.montantSigne)(0, 50)).toBe(50);
        });
        it('signeConformeAuModele signale une charge créditrice ou un produit débiteur, jamais un poste –/+', () => {
            const ra = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RA');
            const ta = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TA');
            const rb = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RB');
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(ra, -100)).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(ra, 100)).toBe(false);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(ta, 100)).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(ta, -100)).toBe(false);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(rb, -100)).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(rb, 100)).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(ra, 0)).toBe(true);
        });
        it.each([
            ['TA', ['21']], ['RA', ['22']], ['RB', ['6']], ['TB', ['21']], ['TC', ['21']], ['TD', ['21']],
            ['TE', ['6']], ['TF', ['21']], ['TG', ['21']], ['TH', ['21']], ['TI', ['12']],
            ['RC', ['22']], ['RD', ['6']], ['RE', ['22']], ['RF', ['6']], ['RG', ['23']], ['RH', ['24']], ['RI', ['25']], ['RJ', ['26']],
            ['RK', ['27']], ['TJ', ['28']], ['RL', ['3C', '28']],
            ['RQP', ['26']], ['TQP', ['21']],
            ['TK', ['29']], ['TL', ['28']], ['TM', ['12']], ['RM', ['29']], ['RN', ['3C', '28']],
            ['TN', ['3D']], ['TO', ['30']], ['RO', ['3D']], ['RP', ['30']],
            ['RQ', ['30']], ['RS', []],
        ])('%s renvoie aux notes %j', (ref, notes) => {
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)(ref).notes).toEqual(notes);
        });
        it('les renvois ne visent que des notes effectivement citées par le modèle du compte de résultat', () => {
            const admis = new Set(['6', '12', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '3C', '3D']);
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA)
                for (const n of p.notes)
                    expect(admis.has(n)).toBe(true);
            for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
                for (const n of s.notes)
                    expect(admis.has(n)).toBe(true);
        });
        it('la liste des codes du ch. 6 porte 46 en-têtes pour 36 numéros de notes, sous-lettres comprises', () => {
            expect(new Set(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6).size).toBe(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6.length);
            expect(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6).toHaveLength(46);
            for (const absent of ['3', '15', '16', '27'])
                expect(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6).not.toContain(absent);
        });
        it('chaque renvoi de la table, une fois résolu, pointe sur une note qui existe au ch. 6 (anomalie n° 11 : « 27 » devient 27A et 27B)', () => {
            const connues = new Set(correspondance_compte_resultat_syscohada_1.CODES_NOTES_CH6);
            const renvoisBruts = new Set();
            for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA)
                for (const n of p.notes)
                    renvoisBruts.add(n);
            for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
                for (const n of s.notes)
                    renvoisBruts.add(n);
            for (const brut of renvoisBruts) {
                for (const code of (0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)(brut)) {
                    expect({ brut, code, existe: connues.has(code) }).toEqual({ brut, code, existe: true });
                }
            }
            expect((0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)('27')).toEqual(['27A', '27B']);
            expect((0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)('28')).toEqual(['28']);
            expect(Object.keys(correspondance_compte_resultat_syscohada_1.RENVOIS_NOTES_SUBDIVISES)).toEqual(['27']);
        });
        it('resoudreRenvoiNote rend une copie : un consommateur qui la modifie ne touche pas la table', () => {
            const a = (0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)('27');
            a.push('X');
            expect((0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)('27')).toEqual(['27A', '27B']);
        });
        it('seul XD porte un renvoi parmi les soldes · transcrit tel quel et signalé (anomalie n° 4)', () => {
            const soldesAvecNote = correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.filter((s) => s.notes.length > 0).map((s) => s.ref);
            expect(soldesAvecNote).toEqual(['XD']);
        });
    });
    describe('postes supplémentaires du ch. 33 (complément n° 12)', () => {
        it('RQP et TQP sont les deux seuls postes marqués `supplementaire`, et ils portent le libellé de la section 7.2', () => {
            expect(correspondance_compte_resultat_syscohada_1.REFS_POSTES_SUPPLEMENTAIRES).toEqual(['RQP', 'TQP']);
            expect(correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.supplementaire).map((p) => p.ref)).toEqual(['RQP', 'TQP']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RQP').libelle).toBe('Quote-part de résultat partagé');
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TQP').libelle).toBe('Quote-part de résultat partagé');
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RQP').sens).toBe('CHARGE');
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TQP').sens).toBe('PRODUIT');
        });
        it('le 652 et le 752 quittent RJ et TH pour ces deux postes, subdivisions comprises', () => {
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('65210000')?.ref).toBe('RQP');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('65250000')?.ref).toBe('RQP');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('75210000')?.ref).toBe('TQP');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('75250000')?.ref).toBe('TQP');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('65110000')?.ref).toBe('RJ');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('65420000')?.ref).toBe('RJ');
            expect((0, correspondance_compte_resultat_syscohada_1.posteDuCompteSyscohada)('75420000')?.ref).toBe('TH');
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RJ').comptes).toEqual(['65']);
            expect((0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TH').comptes).toEqual(['75']);
        });
        it('les deux postes sont à la FIN du niveau exploitation · après RL, avant XE', () => {
            const rang = (ref) => correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.indexOf(ref);
            expect(rang('RL')).toBeLessThan(rang('RQP'));
            expect(rang('RQP')).toBeLessThan(rang('TQP'));
            expect(rang('TQP')).toBeLessThan(rang('XE'));
            expect(rang('XC')).toBeLessThan(rang('RQP'));
            expect(rang('XD')).toBeLessThan(rang('RQP'));
        });
        it('aucun solde antérieur à XE ne les contient ; XE, XG et XI les contiennent', () => {
            const contient = (refSolde, cible) => {
                const solde = (0, correspondance_compte_resultat_syscohada_1.trouveSoldeIntermediaire)(refSolde);
                if (!solde)
                    return refSolde === cible;
                return solde.deRefs.some((r) => contient(r, cible));
            };
            for (const cible of ['RQP', 'TQP']) {
                for (const solde of ['XA', 'XB', 'XC', 'XD', 'XF', 'XH']) {
                    expect({ solde, cible, contient: contient(solde, cible) }).toEqual({ solde, cible, contient: false });
                }
                for (const solde of ['XE', 'XG', 'XI']) {
                    expect({ solde, cible, contient: contient(solde, cible) }).toEqual({ solde, cible, contient: true });
                }
            }
        });
        it("la quote-part n'entre ni dans la valeur ajoutée ni dans l'EBE, entre dans le résultat d'exploitation, et laisse le résultat net inchangé", () => {
            const sansSp = (0, correspondance_compte_resultat_syscohada_1.calculerSoldesIntermediaires)({ TA: 1_000 });
            const avecSp = (0, correspondance_compte_resultat_syscohada_1.calculerSoldesIntermediaires)({ TA: 1_000, RQP: -400, TQP: 900 });
            expect(avecSp.XC).toBe(sansSp.XC);
            expect(avecSp.XD).toBe(sansSp.XD);
            expect(avecSp.XE).toBe(sansSp.XE + 500);
            expect(avecSp.XG).toBe(sansSp.XG + 500);
            expect(avecSp.XI).toBe(sansSp.XI + 500);
            expect(avecSp.XI).toBe(1_500);
        });
        it('les deux postes suivent la convention de signe du modèle · charge en négatif, produit en positif', () => {
            const rqp = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('RQP');
            const tqp = (0, correspondance_compte_resultat_syscohada_1.trouvePosteCompteResultat)('TQP');
            expect([rqp.signe, tqp.signe]).toEqual(['-', '+']);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(rqp, (0, correspondance_compte_resultat_syscohada_1.montantSigne)(400, 0))).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(tqp, (0, correspondance_compte_resultat_syscohada_1.montantSigne)(0, 900))).toBe(true);
            expect((0, correspondance_compte_resultat_syscohada_1.signeConformeAuModele)(rqp, (0, correspondance_compte_resultat_syscohada_1.montantSigne)(0, 400))).toBe(false);
        });
        it('la CAFG (FA) du tableau des flux reprend RQP et TQP · le point 14 a) décrit un fait (audit final F216)', () => {
            const fa = correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.find((p) => p.ref === 'FA');
            const lus = fa.termes
                .filter((t) => t.poste?.etat === 'COMPTE_RESULTAT')
                .map((t) => ({ ref: t.poste.ref, lecture: t.poste.lecture, signe: t.signe }));
            expect(lus).toEqual(expect.arrayContaining([
                { ref: 'XD', lecture: 'N', signe: 1 },
                { ref: 'RQP', lecture: 'N', signe: 1 },
                { ref: 'TQP', lecture: 'N', signe: 1 },
            ]));
        });
    });
});
//# sourceMappingURL=correspondance-compte-resultat-syscohada.spec.js.map
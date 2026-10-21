"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const correspondance_bilan_syscohada_1 = require("./correspondance-bilan-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("./correspondance-tft-syscohada");
describe('correspondance tableau des flux de trésorerie SYSCOHADA (AUDCIF Titre IX ch. 5)', () => {
    const comptesDetail = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL');
    const refsPostes = correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.map((p) => p.ref);
    const refsTotaux = correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA.map((t) => t.ref);
    const refsBilan = new Set([
        ...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.map((p) => p.ref),
        ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.map((p) => p.ref),
        ...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA.map((t) => t.ref),
        ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA.map((t) => t.ref),
        correspondance_bilan_syscohada_1.REF_RESULTAT_SYSCOHADA,
    ]);
    const refsCompteResultat = new Set([...correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.map((p) => p.ref), ...correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES.map((s) => s.ref)]);
    const existeAuPlan = (prefixe) => compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.some((c) => c.numero.startsWith(prefixe));
    const tousLesTermes = correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.flatMap((p) => p.termes.map((terme) => ({ ref: p.ref, terme })));
    describe('structure du modèle (ch. 5, section 2)', () => {
        it("reprend les REF du modèle dans l'ordre exact, rubriques et ligne sans code comprises", () => {
            const refs = correspondance_tft_syscohada_1.ORDRE_AFFICHAGE_FLUX_SYSCOHADA.filter((e) => 'ref' in e).map((e) => e.ref);
            expect(refs).toEqual([
                'ZA',
                'FA', 'FB', 'FC', 'FD', 'FE', '', 'ZB',
                'FF', 'FG', 'FH', 'FI', 'FJ', 'ZC',
                'FK', 'FL', 'FM', 'FN', 'ZD',
                'FO', 'FP', 'FQ', 'ZE',
                'ZF', 'ZG', 'ZH',
            ]);
            const sections = correspondance_tft_syscohada_1.ORDRE_AFFICHAGE_FLUX_SYSCOHADA.filter((e) => 'section' in e).map((e) => e.section);
            expect(sections).toHaveLength(4);
        });
        it('compte 17 postes FA à FQ, ZA à part, et les 7 totaux ZB à ZH plus la ligne sans code', () => {
            expect(correspondance_tft_syscohada_1.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA.ref).toBe('ZA');
            expect(correspondance_tft_syscohada_1.POSTES_OPERATIONNELS_SYSCOHADA.map((p) => p.ref)).toEqual(['FA', 'FB', 'FC', 'FD', 'FE']);
            expect(correspondance_tft_syscohada_1.POSTES_INVESTISSEMENT_SYSCOHADA.map((p) => p.ref)).toEqual(['FF', 'FG', 'FH', 'FI', 'FJ']);
            expect(correspondance_tft_syscohada_1.POSTES_CAPITAUX_PROPRES_SYSCOHADA.map((p) => p.ref)).toEqual(['FK', 'FL', 'FM', 'FN']);
            expect(correspondance_tft_syscohada_1.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA.map((p) => p.ref)).toEqual(['FO', 'FP', 'FQ']);
            expect(refsTotaux).toEqual(['', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF', 'ZG', 'ZH']);
        });
        it('ne comporte aucun REF en double, postes et totaux confondus', () => {
            const toutes = [...refsPostes, ...refsTotaux];
            expect(new Set(toutes).size).toBe(toutes.length);
        });
        it("l'ordre d'affichage couvre exactement les postes + totaux, rien de plus, rien de moins", () => {
            const refs = correspondance_tft_syscohada_1.ORDRE_AFFICHAGE_FLUX_SYSCOHADA.filter((e) => 'ref' in e).map((e) => e.ref);
            expect(new Set(refs)).toEqual(new Set([...refsPostes, ...refsTotaux]));
            expect(refs).toHaveLength(refsPostes.length + refsTotaux.length);
        });
        it('porte les clés A à H du modèle sur ZA et les totaux, et sur eux seuls', () => {
            expect(correspondance_tft_syscohada_1.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA.section).toBe('OUVERTURE');
            const cles = correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA.map((t) => [t.ref, t.cle]);
            expect(cles).toEqual([
                ['', undefined],
                ['ZB', 'B'], ['ZC', 'C'], ['ZD', 'D'], ['ZE', 'E'], ['ZF', 'F'], ['ZG', 'G'], ['ZH', 'H'],
            ]);
        });
        it('chaque poste est rangé dans la section de sa rubrique', () => {
            for (const p of correspondance_tft_syscohada_1.POSTES_OPERATIONNELS_SYSCOHADA)
                expect(p.section).toBe('OPERATIONNEL');
            for (const p of correspondance_tft_syscohada_1.POSTES_INVESTISSEMENT_SYSCOHADA)
                expect(p.section).toBe('INVESTISSEMENT');
            for (const p of correspondance_tft_syscohada_1.POSTES_CAPITAUX_PROPRES_SYSCOHADA)
                expect(p.section).toBe('CAPITAUX_PROPRES');
            for (const p of correspondance_tft_syscohada_1.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA)
                expect(p.section).toBe('CAPITAUX_ETRANGERS');
        });
        it('le renvoi (1) est porté par FB et FE, et par eux seuls', () => {
            const avecRenvoi = correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.filter((p) => p.renvoi).map((p) => [p.ref, p.renvoi]);
            expect(avecRenvoi).toEqual([['FB', '(1)'], ['FE', '(1)']]);
        });
    });
    describe('fermeture des formules (modèle de la section 2 · anomalie n° 1, le schéma de la section 1 ne fait pas foi)', () => {
        it.each([
            ['', ['FB', 'FC', 'FD', 'FE']],
            ['ZB', ['FA', 'FB', 'FC', 'FD', 'FE']],
            ['ZC', ['FF', 'FG', 'FH', 'FI', 'FJ']],
            ['ZD', ['FK', 'FL', 'FM', 'FN']],
            ['ZE', ['FO', 'FP', 'FQ']],
            ['ZF', ['ZD', 'ZE']],
            ['ZG', ['ZB', 'ZC', 'ZF']],
            ['ZH', ['ZG', 'ZA']],
        ])('« %s » somme exactement %j', (ref, deRefs) => {
            expect((0, correspondance_tft_syscohada_1.trouveTotalFluxSyscohada)(ref)?.deRefs).toEqual(deRefs);
        });
        it('chaque total ne lit que des refs qui le PRÉCÈDENT dans l’ordre d’affichage · sinon le calcul en une passe lirait 0', () => {
            const dejaResolues = new Set();
            for (const entree of correspondance_tft_syscohada_1.ORDRE_AFFICHAGE_FLUX_SYSCOHADA) {
                if (!('ref' in entree))
                    continue;
                const total = (0, correspondance_tft_syscohada_1.trouveTotalFluxSyscohada)(entree.ref);
                if (total)
                    for (const r of total.deRefs)
                        expect({ total: entree.ref, lit: r, resolue: dejaResolues.has(r) }).toEqual({ total: entree.ref, lit: r, resolue: true });
                dejaResolues.add(entree.ref);
            }
        });
        it('chaque total ne référence que des refs qui existent', () => {
            const connues = new Set([...refsPostes, ...refsTotaux]);
            for (const t of correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA)
                for (const r of t.deRefs)
                    expect(connues.has(r)).toBe(true);
        });
        it('chaque poste FA à FQ entre EXACTEMENT UNE FOIS dans ZH, et ZA une fois (un poste oublié ou compté deux fois fausserait la trésorerie de clôture)', () => {
            const compter = (ref, compteur) => {
                const total = (0, correspondance_tft_syscohada_1.trouveTotalFluxSyscohada)(ref);
                if (!total) {
                    compteur.set(ref, (compteur.get(ref) ?? 0) + 1);
                    return;
                }
                for (const r of total.deRefs)
                    compter(r, compteur);
            };
            const compteur = new Map();
            compter('ZH', compteur);
            for (const p of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA)
                expect({ ref: p.ref, fois: compteur.get(p.ref) }).toEqual({ ref: p.ref, fois: 1 });
            expect(compteur.size).toBe(correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.length);
        });
        it('les deux contrôles de ZH : par les flux (ZA + ZB + ZC + ZF) et par le bilan (BT − DT sur N)', () => {
            expect(correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LES_FLUX).toEqual(['ZA', 'ZB', 'ZC', 'ZF']);
            const zh = (0, correspondance_tft_syscohada_1.trouveTotalFluxSyscohada)('ZH');
            const zg = (0, correspondance_tft_syscohada_1.trouveTotalFluxSyscohada)('ZG');
            expect(new Set([...zg.deRefs, ...zh.deRefs.filter((r) => r !== 'ZG')])).toEqual(new Set(correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LES_FLUX));
            expect(correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LE_BILAN.map((t) => [t.signe, t.poste?.ref, t.poste?.lecture])).toEqual([[1, 'BT', 'N'], [-1, 'DT', 'N']]);
        });
        it('ZA lit BT et DT du bilan N-1, exactement comme le contrôle lit BT et DT de N', () => {
            expect(correspondance_tft_syscohada_1.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA.termes.map((t) => [t.signe, t.poste?.ref, t.poste?.lecture])).toEqual([[1, 'BT', 'N1'], [-1, 'DT', 'N1']]);
        });
    });
    describe('termes : forme, signes et postes cités', () => {
        it('chaque terme porte exactement un poste OU un ensemble de comptes, jamais les deux ni aucun', () => {
            for (const { ref, terme } of tousLesTermes) {
                const nature = [terme.poste ? 'poste' : null, terme.comptes ? 'comptes' : null].filter(Boolean);
                expect({ ref, nature }).toEqual({ ref, nature: [expect.any(String)] });
                expect([1, -1]).toContain(terme.signe);
                expect(terme.motif.length).toBeGreaterThan(10);
            }
        });
        it('une VARIATION_SOLDE porte toujours un sens de solde ; les autres lectures jamais', () => {
            for (const { ref, terme } of tousLesTermes) {
                if (!terme.comptes)
                    continue;
                const attendu = terme.comptes.lecture === 'VARIATION_SOLDE';
                expect({ ref, lecture: terme.comptes.lecture, sens: terme.comptes.sensSolde !== undefined }).toEqual({ ref, lecture: terme.comptes.lecture, sens: attendu });
            }
        });
        it('chaque poste de bilan cité existe dans la table du bilan SYSCOHADA, chaque poste de compte de résultat dans la sienne', () => {
            for (const { ref, terme } of [...tousLesTermes, ...correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LE_BILAN.map((terme) => ({ ref: 'ZH', terme }))]) {
                if (!terme.poste)
                    continue;
                const connu = terme.poste.etat === 'BILAN' ? refsBilan.has(terme.poste.ref) : refsCompteResultat.has(terme.poste.ref);
                expect({ ref, poste: terme.poste.ref, connu }).toEqual({ ref, poste: terme.poste.ref, connu: true });
            }
        });
        it('un poste du compte de résultat se lit sur N seulement ; une colonne BRUT/NET ne se pose qu’au bilan', () => {
            for (const { terme } of tousLesTermes) {
                if (!terme.poste)
                    continue;
                if (terme.poste.etat === 'COMPTE_RESULTAT') {
                    expect(terme.poste.lecture).toBe('N');
                    expect(terme.poste.colonne).toBeUndefined();
                }
            }
        });
        it('SOLDE_GESTION ne lit que des classes 6, 7, 8 ; mouvements et variations que des classes 1 à 5', () => {
            for (const { ref, terme } of tousLesTermes) {
                if (!terme.comptes)
                    continue;
                for (const prefixe of terme.comptes.prefixes) {
                    const classeGestion = '678'.includes(prefixe[0]);
                    expect({ ref, prefixe, gestion: classeGestion }).toEqual({ ref, prefixe, gestion: terme.comptes.lecture === 'SOLDE_GESTION' });
                }
            }
        });
        it('signeAttendu suit la colonne signe du modèle : « – » → NEGATIF ou LIBRE, « + » → POSITIF ou LIBRE, vide → LIBRE', () => {
            for (const p of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
                if (p.signeModele === '-')
                    expect(['NEGATIF', 'LIBRE']).toContain(p.signeAttendu);
                if (p.signeModele === '+')
                    expect(['POSITIF', 'LIBRE']).toContain(p.signeAttendu);
                if (p.signeModele === '')
                    expect(p.signeAttendu).toBe('LIBRE');
            }
            expect(correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.filter((p) => p.signeAttendu === 'LIBRE').map((p) => p.ref)).toEqual(['ZA', 'FA', 'FB', 'FC', 'FD', 'FE']);
            expect(correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.filter((p) => p.signeAttendu === 'NEGATIF').map((p) => p.ref)).toEqual(['FF', 'FG', 'FH', 'FM', 'FN', 'FQ']);
            expect(correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.filter((p) => p.signeAttendu === 'POSITIF').map((p) => p.ref)).toEqual(['FI', 'FJ', 'FK', 'FL', 'FO', 'FP']);
        });
        it('un décaissement porte ses termes principaux en négatif, un encaissement en positif · le « – » du modèle est dans les signes, pas à réappliquer', () => {
            for (const p of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
                if (p.signeAttendu === 'NEGATIF')
                    expect({ ref: p.ref, signe: p.termes[0].signe }).toEqual({ ref: p.ref, signe: -1 });
                if (p.signeAttendu === 'POSITIF')
                    expect({ ref: p.ref, signe: p.termes[0].signe }).toEqual({ ref: p.ref, signe: 1 });
            }
            expect((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FB').termes[0].signe).toBe(-1);
            expect((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FC').termes[0].signe).toBe(-1);
            expect((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FD').termes[0].signe).toBe(-1);
            expect((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FE').termes[0].signe).toBe(1);
        });
        it('signeConformeAuModeleFlux signale un décaissement positif ou un encaissement négatif, jamais un poste LIBRE', () => {
            const ff = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FF');
            const fi = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FI');
            const fb = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FB');
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(ff, -100)).toBe(true);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(ff, 100)).toBe(false);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(fi, 100)).toBe(true);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(fi, -100)).toBe(false);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(fb, -100)).toBe(true);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(fb, 100)).toBe(true);
            expect((0, correspondance_tft_syscohada_1.signeConformeAuModeleFlux)(ff, 0)).toBe(true);
        });
    });
    describe('la CAFG (ch. 5 § 1.2.1.1), terme à terme', () => {
        const fa = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FA');
        const postesLus = fa.termes.filter((t) => t.poste).map((t) => [t.signe, t.poste.ref]);
        const comptesLus = fa.termes.filter((t) => t.comptes).map((t) => [t.signe, t.comptes.prefixes.join(',')]);
        it('intègre les DEUX quotes-parts sur opérations faites en commun', () => {
            expect(postesLus).toContainEqual([1, 'RQP']);
            expect(postesLus).toContainEqual([1, 'TQP']);
        });
        it("part de l'EBE (XD), jamais du résultat net", () => {
            expect(postesLus[0]).toEqual([1, 'XD']);
            expect(fa.termes.some((t) => t.poste?.ref === 'XI')).toBe(false);
        });
        it('retire 654 et 754 (cessions courantes), ajoute XF sans 797/697, TO sans 86, RP sans 85, puis RQ et RS', () => {
            expect(postesLus).toEqual([
                [1, 'XD'],
                [1, 'RQP'],
                [1, 'TQP'],
                [1, 'XF'],
                [1, 'TO'],
                [1, 'RP'],
                [1, 'RQ'],
                [1, 'RS'],
            ]);
            expect(comptesLus).toEqual([[-1, '654'], [-1, '754'], [-1, '797'], [-1, '697'], [-1, '86'], [-1, '85']]);
            for (const t of fa.termes)
                if (t.comptes)
                    expect(t.comptes.lecture).toBe('SOLDE_GESTION');
        });
        it("n'entre ni 81 ni 82 : les cessions HAO relèvent de l'investissement", () => {
            for (const t of fa.termes)
                for (const p of t.comptes?.prefixes ?? [])
                    expect(['81', '82']).not.toContain(p.slice(0, 2));
        });
    });
    describe('exclusions du renvoi (1) et des intérêts courus (ch. 5 § 1.2.1.3 · anomalie n° 4)', () => {
        const lit = (ref, prefixe, lecture) => (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)(ref).termes.some((t) => t.comptes?.lecture === lecture && t.comptes.prefixes.includes(prefixe));
        it('FD retire 414, 4493/458, 4494, 461/467, 4751 et ajoute 276 ; FE retire 404/481/482, 461/465, 4726, 4752 et ajoute 166/176/183', () => {
            for (const p of ['414', '4493', '458', '4494', '461', '467', '4751', '4713', '276', '4781', '4791'])
                expect({ p, lu: lit('FD', p, 'VARIATION_SOLDE') }).toEqual({ p, lu: true });
            for (const p of ['404', '481', '482', '461', '465', '4726', '4752', '166', '176', '183', '4783', '4793'])
                expect({ p, lu: lit('FE', p, 'VARIATION_SOLDE') }).toEqual({ p, lu: true });
        });
        it('les intérêts courus 166, 176, 183, 276 ne sont lus en mouvement par AUCUN poste de financement ou d’investissement', () => {
            for (const p of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
                if (p.section === 'OPERATIONNEL' || p.section === 'OUVERTURE')
                    continue;
                for (const t of p.termes) {
                    if (!t.comptes)
                        continue;
                    for (const courus of ['166', '176', '183', '276']) {
                        const capte = t.comptes.prefixes.some((pr) => courus.startsWith(pr)) && !(t.comptes.exclusions ?? []).some((e) => courus.startsWith(e));
                        expect({ ref: p.ref, courus, capte }).toEqual({ ref: p.ref, courus, capte: false });
                    }
                }
            }
        });
        it('chaque compte retiré de FD/FE est repris ailleurs (FF à FQ), sinon son flux disparaîtrait du tableau', () => {
            const reprisAilleurs = (prefixe) => correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.some((p) => p.section !== 'OPERATIONNEL' && p.termes.some((t) => t.comptes?.prefixes.some((pr) => pr.startsWith(prefixe) || prefixe.startsWith(pr))));
            for (const p of ['414', '4493', '458', '4494', '461', '467', '404', '481', '482', '465', '4713'])
                expect({ p, repris: reprisAilleurs(p) }).toEqual({ p, repris: true });
            expect(correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE.map((c) => c.prefixe)).toEqual(['4726', '4751', '4752']);
            for (const { prefixe } of correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE) {
                expect({ prefixe, repris: reprisAilleurs(prefixe) }).toEqual({ prefixe, repris: false });
                const retire = [(0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FD'), (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FE')].some((p) => p.termes.some((t) => t.signe === -p.termes[0].signe && t.comptes?.lecture === 'VARIATION_SOLDE' && t.comptes.prefixes.includes(prefixe)));
                expect({ prefixe, retire }).toEqual({ prefixe, retire: true });
            }
        });
        it('tout compte lu en mouvement ou en variation par FF à FQ et logé dans BA, BB, BG ou DP est retiré de FB à FE', () => {
            const refsCirculantLues = new Set(['BA', 'BB', 'BH', 'BI', 'BJ', 'DH', 'DI', 'DJ', 'DK', 'DM', 'DN']);
            const postesCirculant = [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA].filter((p) => refsCirculantLues.has(p.ref));
            const logeDansLeCirculant = (prefixe) => comptesDetail.some((c) => c.numero.startsWith(prefixe) &&
                postesCirculant.some((p) => p.comptes.some((x) => c.numero.startsWith(x)) && !(p.exclusions ?? []).some((e) => c.numero.startsWith(e))));
            const retireDuBesoinEnFonds = (prefixe) => ['FB', 'FC', 'FD', 'FE'].some((ref) => {
                const poste = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)(ref);
                return poste.termes.some((t) => t.signe === -poste.termes[0].signe && t.comptes?.prefixes.some((pr) => prefixe.startsWith(pr) || pr.startsWith(prefixe)));
            });
            let verifies = 0;
            for (const poste of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
                if (poste.section === 'OUVERTURE' || poste.section === 'OPERATIONNEL')
                    continue;
                for (const t of poste.termes) {
                    if (!t.comptes || t.comptes.lecture === 'SOLDE_GESTION')
                        continue;
                    for (const prefixe of t.comptes.prefixes) {
                        if (!logeDansLeCirculant(prefixe))
                            continue;
                        verifies += 1;
                        expect({ ref: poste.ref, prefixe, retire: retireDuBesoinEnFonds(prefixe) }).toEqual({ ref: poste.ref, prefixe, retire: true });
                    }
                }
            }
            expect(verifies).toBeGreaterThan(10);
            expect(logeDansLeCirculant('4713')).toBe(true);
        });
    });
    describe('investissement (ch. 5 § 1.3 · anomalies n° 3, 8, 9, 12)', () => {
        it('FF et FG lisent le BRUT de AD et AI en variation, avec les amortissements sortis et la VNC', () => {
            const ff = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FF');
            const fg = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FG');
            expect(ff.termes[0].poste).toEqual({ etat: 'BILAN', ref: 'AD', lecture: 'VARIATION', colonne: 'BRUT' });
            expect(fg.termes[0].poste).toEqual({ etat: 'BILAN', ref: 'AI', lecture: 'VARIATION', colonne: 'BRUT' });
            expect(ff.termes.find((t) => t.comptes?.lecture === 'MOUVEMENT_DEBIT' && t.comptes.prefixes.includes('281'))?.signe).toBe(-1);
            expect(ff.termes.find((t) => t.comptes?.lecture === 'SOLDE_GESTION')?.comptes?.prefixes).toEqual(['6541', '811']);
            expect(fg.termes.find((t) => t.comptes?.lecture === 'SOLDE_GESTION')?.comptes?.prefixes).toEqual(['6542', '812']);
        });
        it('FG neutralise la location acquisition (crédit 17 sauf 176), le démantèlement (1984) et la réévaluation (106, 154)', () => {
            const fg = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FG');
            const credits = fg.termes.filter((t) => t.comptes?.lecture === 'MOUVEMENT_CREDIT');
            expect(credits.find((t) => t.comptes.prefixes.includes('17'))?.comptes?.exclusions).toEqual(['176']);
            expect(credits.some((t) => t.comptes.prefixes.includes('1984'))).toBe(true);
            expect(credits.some((t) => t.comptes.prefixes.includes('106') && t.comptes.prefixes.includes('154'))).toBe(true);
        });
        it('FI = prix (754, 821, 822) − variation des créances 414 et 485 ; FJ = crédit 26/27 + 826 + 816 (anomalie n° 12)', () => {
            const fi = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FI');
            expect(fi.termes.map((t) => [t.signe, t.comptes?.lecture, t.comptes?.prefixes.join(',')])).toEqual([
                [1, 'SOLDE_GESTION', '754,821,822'],
                [-1, 'VARIATION_SOLDE', '414,485'],
            ]);
            const fj = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FJ');
            expect(fj.termes[0].comptes).toEqual({ prefixes: ['26', '27'], exclusions: ['276'], lecture: 'MOUVEMENT_CREDIT' });
            expect(fj.termes[1].comptes?.prefixes).toEqual(['826', '816']);
        });
        it('FF et FG déclarent 798 ET 862 : le débit du 28 porte les deux reprises (Titre VII COMPTE 28 · anomalie n° 22)', () => {
            for (const ref of ['FF', 'FG']) {
                const nd = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)(ref).nonDeterminables ?? [];
                const comptes = nd.flatMap((n) => n.comptes);
                expect({ ref, a798: comptes.includes('798'), a862: comptes.includes('862') }).toEqual({ ref, a798: true, a862: true });
            }
        });
        it('FG déclare la désactualisation du 1984 et la part « amortissements » de la réévaluation (anomalies n° 20 et 21)', () => {
            const comptes = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FG').nonDeterminables ?? []).flatMap((n) => n.comptes);
            expect(comptes).toContain('1984');
            expect(comptes).toContain('28');
            const ff = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FF').nonDeterminables ?? []).flatMap((n) => n.comptes);
            expect(ff).not.toContain('1984');
            expect(ff).not.toContain('28');
        });
        it("FJ renvoie la créance sur cession financière au 485 (lu par FI), plus jamais au 4711 (anomalie n° 9)", () => {
            const comptes = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FJ').nonDeterminables ?? []).flatMap((n) => n.comptes);
            expect(comptes).toContain('485');
            expect(comptes).not.toContain('4711');
            const fd = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FD').nonDeterminables ?? []).flatMap((n) => n.comptes);
            expect(fd).not.toContain('4711');
        });
        it('FH lit le débit de 26 et 27 (sauf 276) et la variation du 4813 ; 4856 et 2766 ne sont cités nulle part (absents du plan)', () => {
            const fh = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FH');
            expect(fh.termes[0].comptes).toEqual({ prefixes: ['26', '27'], exclusions: ['276'], lecture: 'MOUVEMENT_DEBIT' });
            const cites = (0, correspondance_tft_syscohada_1.comptesCitesParLeTftSyscohada)().map((c) => c.prefixe);
            expect(cites).not.toContain('4856');
            expect(cites).not.toContain('2766');
            expect(cites).not.toContain('19842');
            expect(cites).not.toContain('48161');
        });
    });
    describe('financement (ch. 5 § 1.4 · anomalies n° 5, 13, 16)', () => {
        it('FO lit le crédit de 161/162 et retranche la variation du 4713 (jamais « + débit 4713 »)', () => {
            const fo = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FO');
            expect(fo.termes[0]).toMatchObject({ signe: 1, comptes: { prefixes: ['161', '162'], lecture: 'MOUVEMENT_CREDIT' } });
            expect(fo.termes.find((t) => t.comptes?.prefixes.includes('4713'))).toMatchObject({ signe: -1, comptes: { lecture: 'VARIATION_SOLDE', sensSolde: 'DEBITEUR' } });
            expect(fo.termes.some((t) => t.comptes?.lecture === 'MOUVEMENT_DEBIT')).toBe(false);
        });
        it('FQ lit le débit de 16, 17, 181, 182 sans les intérêts courus ; FP le crédit des autres dettes sans 166/183', () => {
            const fq = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FQ');
            expect(fq.termes[0].comptes).toEqual({ prefixes: ['16', '17', '181', '182'], exclusions: ['166', '176'], lecture: 'MOUVEMENT_DEBIT' });
            const fp = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FP');
            expect(fp.termes[0].comptes?.prefixes).toEqual(['163', '164', '165', '167', '168', '181', '182']);
        });
        it('FK neutralise les incorporations (débit 11, 12, 130, 131, 106) et retranche le non-versé (109, 461, 467, 4493, 4581)', () => {
            const fk = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FK');
            expect(fk.termes[0]).toMatchObject({ signe: 1, comptes: { prefixes: ['101', '102', '105'], lecture: 'VARIATION_SOLDE', sensSolde: 'CREDITEUR' } });
            const debits = fk.termes.filter((t) => t.comptes?.lecture === 'MOUVEMENT_DEBIT').flatMap((t) => t.comptes.prefixes);
            expect(new Set(debits)).toEqual(new Set(['11', '12', '130', '131', '106']));
            expect(debits).not.toContain('13');
            const retranches = fk.termes.filter((t) => t.signe === -1 && t.comptes?.lecture === 'VARIATION_SOLDE').flatMap((t) => t.comptes.prefixes);
            expect(new Set(retranches)).toEqual(new Set(['109', '461', '467', '4493', '4581']));
        });
        it('FK reprend au crédit le 130 EN ENTIER, symétriquement à son débit · sans quoi le 1301 reste orphelin (anomalie n° 23)', () => {
            const fk = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FK');
            const credits = fk.termes.filter((t) => t.comptes?.lecture === 'MOUVEMENT_CREDIT').flatMap((t) => t.comptes.prefixes);
            const debits = fk.termes.filter((t) => t.comptes?.lecture === 'MOUVEMENT_DEBIT').flatMap((t) => t.comptes.prefixes);
            expect(credits).toContain('130');
            expect(credits).not.toContain('1309');
            expect(debits).toContain('130');
            expect(credits).toContain('130');
            expect(credits).not.toContain('131');
        });
        it("FK et FM déclarent l'affectation d'une perte par le 103 (entité individuelle · anomalie n° 13)", () => {
            const fk = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FK').nonDeterminables ?? []).flatMap((n) => n.comptes);
            const fm = ((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FM').nonDeterminables ?? []).flatMap((n) => n.comptes);
            expect(fk).toContain('139');
            expect(fm).toContain('103');
            expect((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FM').termes.some((t) => t.comptes?.prefixes.includes('103'))).toBe(true);
        });
        it('FP lit le 1685 et le DIT, plutôt que de le déclarer laissé de côté', () => {
            const fp = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FP');
            const lu = fp.termes.some((t) => t.comptes?.prefixes.some((pr) => '1685'.startsWith(pr)));
            expect(lu).toBe(true);
            expect((fp.nonDeterminables ?? []).flatMap((n) => n.comptes)).not.toContain('1685');
            expect(fp.note).toContain('1685');
        });
        it('FL = Δ14 + 799 − Δ(4494, 4582) ; FM et FN ne lisent que des débits (4619, 103, 104 ; 465)', () => {
            const fl = (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FL');
            expect(fl.termes.map((t) => [t.signe, t.comptes?.lecture, t.comptes?.prefixes.join(',')])).toEqual([
                [1, 'VARIATION_SOLDE', '14'],
                [1, 'SOLDE_GESTION', '799'],
                [-1, 'VARIATION_SOLDE', '4494,4582'],
            ]);
            for (const ref of ['FM', 'FN']) {
                for (const t of (0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)(ref).termes)
                    expect({ ref, lecture: t.comptes?.lecture, signe: t.signe }).toEqual({ ref, lecture: 'MOUVEMENT_DEBIT', signe: -1 });
            }
        });
    });
    describe('besoins de chaque poste (ce que le service laisse vide et signale)', () => {
        it("ZA et les variations de postes de bilan (FB à FG) exigent un exercice N-1 ; les autres non", () => {
            const exigent = correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.filter((p) => (0, correspondance_tft_syscohada_1.besoinsDuPoste)(p).exerciceN1).map((p) => p.ref);
            expect(exigent).toEqual(['ZA', 'FB', 'FC', 'FD', 'FE', 'FF', 'FG']);
        });
        it('FA ne lit que le compte de résultat de N : ni N-1, ni mouvement, ni solde antérieur', () => {
            expect((0, correspondance_tft_syscohada_1.besoinsDuPoste)((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FA'))).toEqual({ exerciceN1: false, soldesAnterieurs: false, mouvements: false });
        });
        it('FM et FN ne lisent que des mouvements ; FH à FQ n’exigent pas d’exercice N-1', () => {
            expect((0, correspondance_tft_syscohada_1.besoinsDuPoste)((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FM'))).toEqual({ exerciceN1: false, soldesAnterieurs: false, mouvements: true });
            expect((0, correspondance_tft_syscohada_1.besoinsDuPoste)((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)('FN'))).toEqual({ exerciceN1: false, soldesAnterieurs: false, mouvements: true });
            for (const ref of ['FH', 'FI', 'FJ', 'FK', 'FL', 'FO', 'FP', 'FQ'])
                expect({ ref, n1: (0, correspondance_tft_syscohada_1.besoinsDuPoste)((0, correspondance_tft_syscohada_1.trouvePosteFluxSyscohada)(ref)).exerciceN1 }).toEqual({ ref, n1: false });
        });
    });
    describe('rattachement des comptes du plan SYSCOHADA semé', () => {
        it('chaque préfixe cité (termes, exclusions, non-déterminables) existe réellement au plan semé', () => {
            const cites = (0, correspondance_tft_syscohada_1.comptesCitesParLeTftSyscohada)();
            expect(cites.length).toBeGreaterThan(80);
            for (const { ref, prefixe } of cites)
                expect({ ref, prefixe, existe: existeAuPlan(prefixe) }).toEqual({ ref, prefixe, existe: true });
        });
        it('chaque exclusion est bien une subdivision d’un préfixe du même terme, sinon elle n’exclut rien', () => {
            for (const { ref, terme } of tousLesTermes) {
                for (const e of terme.comptes?.exclusions ?? []) {
                    const couverte = terme.comptes.prefixes.some((p) => e.startsWith(p) && e.length > p.length);
                    expect({ ref, exclusion: e, couverte }).toEqual({ ref, exclusion: e, couverte: true });
                }
            }
        });
        it('les comptes sans trésorerie et les non-ventilés justifiés existent au plan et ne sont lus en mouvement ou variation par AUCUN terme', () => {
            const lusEnFlux = tousLesTermes
                .filter(({ terme }) => terme.comptes && terme.comptes.lecture !== 'SOLDE_GESTION')
                .flatMap(({ ref, terme }) => terme.comptes.prefixes.map((prefixe) => ({ ref, prefixe, exclusions: terme.comptes.exclusions ?? [] })));
            for (const { prefixe } of [...correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA, ...correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES]) {
                expect({ prefixe, existe: existeAuPlan(prefixe) }).toEqual({ prefixe, existe: true });
                const lecteurs = lusEnFlux
                    .filter((l) => (prefixe.startsWith(l.prefixe) || l.prefixe.startsWith(prefixe)) && !l.exclusions.some((e) => prefixe.startsWith(e)))
                    .map((l) => l.ref);
                expect({ prefixe, lecteurs }).toEqual({ prefixe, lecteurs: [] });
            }
        });
        it('1984 est lu (FG) et 1962 est un décaissement sans poste, alors que le reste du 19 est sans trésorerie · liste granulaire, pas « 19 » en bloc', () => {
            expect(correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA.some((c) => c.prefixe === '19' || c.prefixe === '196')).toBe(false);
            expect(correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA.some((c) => c.prefixe === '1984' || c.prefixe === '1962')).toBe(false);
            expect(correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES.some((c) => c.prefixe === '1962')).toBe(true);
            const sous19 = comptesDetail.filter((c) => c.numero.startsWith('19')).map((c) => c.numero);
            for (const numero of sous19) {
                const couvert = numero.startsWith('1984') ||
                    [...correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA, ...correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES].some((c) => numero.startsWith(c.prefixe));
                expect({ numero, couvert }).toEqual({ numero, couvert: true });
            }
        });
        it('chaque compte de classe 1 du semis est couvert : par un terme, par un poste du circulant lu en variation, ou par une liste justifiée', () => {
            const lu = (numero) => tousLesTermes.some(({ terme }) => terme.comptes && terme.comptes.prefixes.some((p) => numero.startsWith(p)) && !(terme.comptes.exclusions ?? []).some((e) => numero.startsWith(e)));
            const justifie = (numero) => [...correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA, ...correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES, ...correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE].some((c) => numero.startsWith(c.prefixe));
            const refsCirculant = new Set(['BA', 'BB', 'BH', 'BI', 'BJ', 'DH', 'DI', 'DJ', 'DK', 'DM', 'DN']);
            const dansLeCirculant = (numero) => [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA].some((p) => refsCirculant.has(p.ref) && p.comptes.some((c) => numero.startsWith(c)) && !(p.exclusions ?? []).some((e) => numero.startsWith(e)));
            const classe1 = comptesDetail.filter((c) => c.numero.startsWith('1'));
            expect(classe1.length).toBeGreaterThan(80);
            for (const c of classe1) {
                expect({ numero: c.numero, couvert: lu(c.numero) || justifie(c.numero) || dansLeCirculant(c.numero) }).toEqual({ numero: c.numero, couvert: true });
            }
            expect(dansLeCirculant('18500000')).toBe(true);
        });
        it('chaque subdivision du 478 et du 479 est lue par un terme ou nommée dans les non-ventilés (anomalie n° 24)', () => {
            const lu = (numero) => tousLesTermes.some(({ terme }) => terme.comptes && terme.comptes.prefixes.some((p) => numero.startsWith(p)) && !(terme.comptes.exclusions ?? []).some((e) => numero.startsWith(e)));
            const nomme = (numero) => [...correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES, ...correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE, ...correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA].some((c) => numero.startsWith(c.prefixe));
            const ecarts = comptesDetail.filter((c) => c.numero.startsWith('478') || c.numero.startsWith('479'));
            expect(ecarts.length).toBeGreaterThan(8);
            for (const c of ecarts)
                expect({ numero: c.numero, couvert: lu(c.numero) || nomme(c.numero) }).toEqual({ numero: c.numero, couvert: true });
            for (const orphelin of ['4786', '4788', '4797', '4798']) {
                expect({ orphelin, nomme: correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES.some((c) => c.prefixe === orphelin) }).toEqual({ orphelin, nomme: true });
            }
        });
    });
    describe('forme des libellés et des motifs', () => {
        it('reprend le demi-cadratin du modèle dans le libellé de ZA, sans jamais introduire de cadratin (CLAUDE.md §4)', () => {
            expect(correspondance_tft_syscohada_1.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA.libelle).toContain('N-1 – Trésorerie passif N-1');
            const textes = [
                ...correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA.flatMap((p) => [p.libelle, p.note ?? '', ...p.termes.map((t) => t.motif), ...(p.nonDeterminables ?? []).map((n) => n.motif)]),
                ...correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA.map((t) => t.libelle),
                ...correspondance_tft_syscohada_1.COMPTES_SANS_TRESORERIE_SYSCOHADA.map((c) => c.motif),
                ...correspondance_tft_syscohada_1.COMPTES_TFT_NON_VENTILES_JUSTIFIES.map((c) => c.motif),
                ...correspondance_tft_syscohada_1.COMPTES_EXCLUS_SANS_REPRISE.map((c) => c.motif),
                correspondance_tft_syscohada_1.RENVOI_1_TFT_SYSCOHADA,
            ];
            for (const texte of textes)
                expect({ texte, cadratin: texte.includes('\u2014') }).toEqual({ texte, cadratin: false });
        });
        it('chaque terme porte un motif sourcé, et chaque non-déterminable dit pourquoi', () => {
            for (const { ref, terme } of tousLesTermes)
                expect({ ref, motif: terme.motif.length > 20 }).toEqual({ ref, motif: true });
            for (const p of correspondance_tft_syscohada_1.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
                for (const nd of p.nonDeterminables ?? []) {
                    expect({ ref: p.ref, comptes: nd.comptes.length > 0, motif: nd.motif.length > 20 }).toEqual({ ref: p.ref, comptes: true, motif: true });
                }
            }
        });
    });
});
describe('postesLisantEnMouvement · ce que la consolidation lit de la table (audit final F152)', () => {
    it('un prêt et un emprunt sont lus en mouvements', () => {
        expect((0, correspondance_tft_syscohada_1.postesLisantEnMouvement)('27410000')).toEqual(['FH', 'FJ']);
        expect((0, correspondance_tft_syscohada_1.postesLisantEnMouvement)('16200000')).toEqual(['FO', 'FQ']);
    });
    it('un compte lu en VARIATION de solde seulement ne l’est pas · son élimination corrige déjà la variation', () => {
        expect((0, correspondance_tft_syscohada_1.postesLisantEnMouvement)('48500000')).toEqual([]);
        expect((0, correspondance_tft_syscohada_1.postesLisantEnMouvement)('41400000')).toEqual([]);
    });
});
//# sourceMappingURL=correspondance-tft-syscohada.spec.js.map
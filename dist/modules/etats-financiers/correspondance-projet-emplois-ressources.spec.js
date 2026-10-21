"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_projet_emplois_ressources_1 = require("./correspondance-projet-emplois-ressources");
const compte_seed_1 = require("../comptes/compte-seed");
const MODELE = [
    ['FA', 'Fonds reçus, Bailleurs'],
    ['FB', 'Fonds reçus, Bailleurs'],
    ['FC', 'Fonds contrepartie Etat'],
    ['FD', 'Autres fonds reçus'],
    ['GR', 'I. RESSOURCES'],
    ['FE', 'Immobilisations incorporelles'],
    ['FF', 'Terrains'],
    ['FG', 'Bâtiments'],
    ['FH', 'Aménagements, agencements et installations'],
    ['FI', 'Matériel, mobilier et actifs biologiques'],
    ['FJ', 'Matériel de transport'],
    ['FK', 'Avances et acomptes sur immobilisations'],
    ['FL', 'Immobilisations financières'],
    ['GS', 'A- TOTAL DES IMMOBILISATIONS'],
    ['FM', 'Achats de biens et services'],
    ['FN', 'Transports'],
    ['FO', 'Services extérieurs'],
    ['FP', 'Impôts et taxes'],
    ['FQ', 'Autres charges'],
    ['FR', 'Charges de personnel'],
    ['FS', 'Charges financières'],
    ['FT', 'Avances sur charges (à justifier)'],
    ['GT', 'B- TOTAL DES CHARGES DE FONCTIONNEMENT'],
    ['GU', 'II. EMPLOIS (A+B)'],
    ['GV', 'III. EXCEDENT / DEFICIT DES FONDS RECUS SUR LES EMPLOIS (I-II)'],
    ['FU', 'Fonds Bailleur en début exercice N'],
    ['FV', 'Fonds de contrepartie État en début exercice N'],
    ['FW', 'Autres fonds en début exercice N'],
    ['GW', 'IV. FONDS DISPONIBLE EN DEBUT EXERCICE'],
    ['GX', "V. MONTANT NET DE L'ENCAISSE DISPONIBLE (III+IV)"],
    ['FX', 'Fonds Bailleur en fin exercice N'],
    ['FY', 'Fonds de contrepartie État en fin exercice N'],
    ['FZ', 'Autres fonds en fin exercice N'],
    ['GY', 'VI. FONDS DISPONIBLE EN FIN EXERCICE'],
    ['GZ', 'VII. CONTRÔLE : TOTAL V = TOTAL VI'],
];
const TOUS_LES_POSTES = [...correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES, ...correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS, ...correspondance_projet_emplois_ressources_1.POSTES_CHARGES];
const COMPTES_IMPUTATION = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL');
describe('emplois-ressources · conformité à la maquette officielle', () => {
    it("l'ordre d'affichage reprend EXACTEMENT les REF du modèle, dans l'ordre", () => {
        expect(correspondance_projet_emplois_ressources_1.ORDRE_AFFICHAGE).toEqual(MODELE.map(([ref]) => ref));
    });
    it('chaque REF affichée est soit un poste, soit un total, soit une ligne calculée', () => {
        const connues = new Set([
            ...TOUS_LES_POSTES.map((p) => p.ref),
            ...correspondance_projet_emplois_ressources_1.TOTAUX.map((t) => t.ref),
            ...Object.keys(correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES),
        ]);
        for (const ref of correspondance_projet_emplois_ressources_1.ORDRE_AFFICHAGE)
            expect([ref, connues.has(ref)]).toEqual([ref, true]);
    });
    it('les libellés des postes rattachés reprennent ceux du modèle', () => {
        const sansAccent = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const attendus = new Map(MODELE);
        for (const p of TOUS_LES_POSTES) {
            if (correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES[p.ref])
                continue;
            expect([p.ref, sansAccent(p.libelle)]).toEqual([p.ref, sansAccent(attendus.get(p.ref))]);
        }
    });
    it('les six totaux somment exactement ce que le modèle annonce', () => {
        const attendus = {
            GR: ['FA', 'FB', 'FC', 'FD'],
            GS: ['FE', 'FF', 'FG', 'FH', 'FI', 'FJ', 'FK', 'FL'],
            GT: ['FM', 'FN', 'FO', 'FP', 'FQ', 'FR', 'FS', 'FT'],
            GU: ['GS', 'GT'],
            GW: ['FU', 'FV', 'FW'],
            GY: ['FX', 'FY', 'FZ'],
        };
        for (const t of correspondance_projet_emplois_ressources_1.TOTAUX)
            expect([t.ref, t.deRefs]).toEqual([t.ref, attendus[t.ref]]);
        expect(correspondance_projet_emplois_ressources_1.TOTAUX.map((t) => t.ref).sort()).toEqual(Object.keys(attendus).sort());
    });
    it('GU somme les deux SOUS-TOTAUX, pas de nouveau les postes · « EMPLOIS (A+B) »', () => {
        expect(correspondance_projet_emplois_ressources_1.TOTAUX.find((t) => t.ref === 'GU').deRefs).toEqual(['GS', 'GT']);
    });
    it('les trois lignes de calcul (GV, GX, GZ) ne sont PAS des totaux de postes', () => {
        for (const ref of ['GV', 'GX', 'GZ']) {
            expect([ref, correspondance_projet_emplois_ressources_1.TOTAUX.some((t) => t.ref === ref)]).toEqual([ref, false]);
            expect(correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES[ref]).toBeDefined();
        }
    });
});
describe('emplois-ressources · le contrôle GZ doit pouvoir échouer', () => {
    it('les fonds disponibles se lisent en SOLDE de trésorerie, pas en mouvement', () => {
        for (const ref of ['FU', 'FV', 'FW', 'FX', 'FY', 'FZ']) {
            const p = TOUS_LES_POSTES.find((x) => x.ref === ref);
            if (!p)
                continue;
            expect([ref, p.lectureSolde]).not.toEqual([ref, undefined]);
        }
        expect(correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET).toEqual(['51', '52', '53', '55', '57']);
    });
    it('la trésorerie du projet ne comprend ni le 54 ni le 58', () => {
        expect(correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET).not.toContain('58');
        expect(correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET).not.toContain('54');
    });
    it('chaque compte de trésorerie cité existe au plan SYCEBNL', () => {
        for (const prefixe of correspondance_projet_emplois_ressources_1.COMPTES_TRESORERIE_PROJET) {
            expect([prefixe, COMPTES_IMPUTATION.some((c) => c.numero.startsWith(prefixe))]).toEqual([prefixe, true]);
        }
    });
});
describe('emplois-ressources · cohérence des rattachements', () => {
    it('chaque préfixe cité correspond à au moins un compte du semis', () => {
        for (const p of TOUS_LES_POSTES) {
            for (const prefixe of p.comptes) {
                expect([p.ref, prefixe, COMPTES_IMPUTATION.some((c) => c.numero.startsWith(prefixe))]).toEqual([
                    p.ref,
                    prefixe,
                    true,
                ]);
            }
        }
    });
    it('chaque préfixe de DÉDUCTION correspond lui aussi à au moins un compte du semis', () => {
        for (const p of TOUS_LES_POSTES) {
            for (const d of p.deductions ?? []) {
                for (const prefixe of d.comptes) {
                    expect([p.ref, prefixe, COMPTES_IMPUTATION.some((c) => c.numero.startsWith(prefixe))]).toEqual([
                        p.ref,
                        prefixe,
                        true,
                    ]);
                }
            }
        }
    });
    it('aucun compte n’est capté par deux postes de la même section', () => {
        for (const [nom, postes] of [
            ['ressources', correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES],
            ['immobilisations', correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS],
            ['charges', correspondance_projet_emplois_ressources_1.POSTES_CHARGES],
        ]) {
            const vus = new Map();
            for (const p of postes) {
                for (const c of COMPTES_IMPUTATION) {
                    const capte = p.comptes.some((pref) => c.numero.startsWith(pref)) &&
                        !(p.exclusions ?? []).some((e) => c.numero.startsWith(e));
                    if (!capte)
                        continue;
                    expect([nom, c.numero, vus.get(c.numero) ?? null]).toEqual([nom, c.numero, null]);
                    vus.set(c.numero, p.ref);
                }
            }
        }
    });
    it('le sens de chaque section suit sa nature · ressources au crédit, emplois au débit', () => {
        for (const p of correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES)
            expect([p.ref, p.sens]).toEqual([p.ref, 'CREDIT']);
        for (const p of [...correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS, ...correspondance_projet_emplois_ressources_1.POSTES_CHARGES]) {
            if (p.lectureSolde)
                continue;
            expect([p.ref, p.sens]).toEqual([p.ref, 'DEBIT']);
        }
    });
    it('chaque section déclarée sur un poste correspond au bloc qui le porte', () => {
        for (const p of correspondance_projet_emplois_ressources_1.POSTES_RESSOURCES)
            expect([p.ref, p.section]).toEqual([p.ref, 'RESSOURCES']);
        for (const p of correspondance_projet_emplois_ressources_1.POSTES_IMMOBILISATIONS)
            expect([p.ref, p.section]).toEqual([p.ref, 'IMMOBILISATIONS']);
        for (const p of correspondance_projet_emplois_ressources_1.POSTES_CHARGES)
            expect([p.ref, p.section]).toEqual([p.ref, 'CHARGES']);
    });
    it('chaque déduction cite le renvoi du guide dont elle vient', () => {
        for (const p of TOUS_LES_POSTES) {
            for (const d of p.deductions ?? []) {
                expect([p.ref, d.renvoi.length > 5]).toEqual([p.ref, true]);
                expect(['AJOUTER_VARIATION', 'RETRANCHER_MOUVEMENT']).toContain(d.operation);
            }
        }
    });
    it('chaque poste dit POURQUOI il capte ces comptes-là', () => {
        for (const p of TOUS_LES_POSTES)
            expect([p.ref, (p.fondement ?? '').length > 40]).toEqual([p.ref, true]);
    });
    it('aucun cadratin dans les libellés ni les fondements (CLAUDE.md §4)', () => {
        for (const p of TOUS_LES_POSTES) {
            expect(p.libelle).not.toContain('—');
            expect(p.fondement).not.toContain('—');
        }
        for (const t of correspondance_projet_emplois_ressources_1.TOTAUX)
            expect(t.libelle).not.toContain('—');
        for (const l of Object.values(correspondance_projet_emplois_ressources_1.LIBELLES_CALCULES))
            expect(l).not.toContain('—');
    });
});
//# sourceMappingURL=correspondance-projet-emplois-ressources.spec.js.map
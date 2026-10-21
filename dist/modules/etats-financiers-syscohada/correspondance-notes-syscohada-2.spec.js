"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_bilan_syscohada_1 = require("./correspondance-bilan-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_notes_syscohada_1_1 = require("./correspondance-notes-syscohada-1");
const correspondance_notes_syscohada_2_1 = require("./correspondance-notes-syscohada-2");
const correspondance_notes_syscohada_3_1 = require("./correspondance-notes-syscohada-3");
const COMPTES_SEMIS = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte !== 'TOTAL' && /^[1-7]/.test(c.numero));
const noteDe = (code, sousTableau) => correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.find((n) => n.code === code && (sousTableau === undefined || n.sousTableau === sousTableau));
const rubriquesChiffrees = (spec) => spec.rubriques.filter((r) => (r.comptes?.length ?? 0) > 0);
const capte = (r, numero) => (0, etats_financiers_communs_1.correspond)(numero, r.comptes ?? [], r.exclusions);
const comptesDuPoste = (p) => COMPTES_SEMIS.filter((c) => (0, etats_financiers_communs_1.correspond)(c.numero, p.comptes, p.exclusions)).map((c) => c.numero);
const horsMaquette = (note) => correspondance_notes_syscohada_2_1.RUBRIQUES_HORS_MAQUETTE_NOTES_2.filter((a) => a.note === note).map((a) => a.libelle);
const postePassif = (ref) => correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.find((p) => p.ref === ref);
const posteActif = (ref) => correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.find((p) => p.ref === ref);
const posteResultat = (ref) => correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.find((p) => p.ref === ref);
function recoupe(spec, postes, tolerances = [], sansLigneToleres = []) {
    const attendus = new Set(postes.flatMap(comptesDuPoste));
    const rubriques = rubriquesChiffrees(spec);
    const sansLigne = [...attendus]
        .filter((n) => !rubriques.some((r) => capte(r, n)))
        .filter((n) => !sansLigneToleres.some((t) => n.startsWith(t)));
    expect({ note: spec.code, sansLigne }).toEqual({ note: spec.code, sansLigne: [] });
    const horsPoste = COMPTES_SEMIS.map((c) => c.numero)
        .filter((n) => rubriques.some((r) => capte(r, n)))
        .filter((n) => !attendus.has(n) && !tolerances.some((t) => n.startsWith(t)));
    expect({ note: spec.code, horsPoste }).toEqual({ note: spec.code, horsPoste: [] });
}
describe('notes SYSCOHADA, tranche 2 · intégrité des spécifications', () => {
    it('transcrit exactement les notes 16A à 27B de la liste officielle (ch. 6 section 2), ni une de plus ni une de moins', () => {
        const transcrites = [...new Set(correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.map((n) => n.code))];
        expect(transcrites).toEqual(correspondance_notes_syscohada_2_1.CODES_NOTES_SYSCOHADA_2);
        expect(correspondance_notes_syscohada_2_1.CODES_NOTES_SYSCOHADA_2).toEqual([
            '16A', '16B', '16B bis', '16C', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27A', '27B',
        ]);
    });
    it('aucun tableau en double · un code seul, ou un code et son sous-tableau', () => {
        const cles = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.map((n) => `${n.code}::${n.sousTableau ?? ''}`);
        expect(new Set(cles).size).toBe(cles.length);
    });
    it('une note à plusieurs tableaux les nomme TOUS (16B, 16B bis, 27B)', () => {
        const parCode = new Map();
        for (const n of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2)
            parCode.set(n.code, (parCode.get(n.code) ?? 0) + 1);
        for (const n of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            const multiple = (parCode.get(n.code) ?? 0) > 1;
            expect({ code: n.code, nomme: !multiple || !!n.sousTableau }).toEqual({ code: n.code, nomme: true });
        }
        expect(parCode.get('16B')).toBe(3);
        expect(parCode.get('16B bis')).toBe(2);
        expect(parCode.get('16C')).toBe(2);
        expect(parCode.get('27B')).toBe(2);
    });
    it('16C rend les six lignes de la maquette, « litiges » puis deux lignes à compléter par bloc (anomalie n° 29)', () => {
        const blocs = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => n.code === '16C');
        expect(blocs.map((n) => n.sousTableau)).toEqual(['ACTIF ÉVENTUEL', 'PASSIF ÉVENTUEL']);
        for (const b of blocs) {
            expect(b.rubriques.map((r) => r.libelle)).toEqual(['Litiges', '…', '…']);
            expect(b.rubriques.every((r) => r.saisie)).toBe(true);
        }
        for (const b of blocs)
            expect(b.renvoyeeDepuis).toBeUndefined();
    });
    it('un total ne référence jamais une rubrique qui vient APRÈS lui · le calcul en une passe lirait 0', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            spec.rubriques.forEach((r, i) => {
                for (const idx of [...(r.totalDeRubriques ?? []), ...(r.moinsRubriques ?? [])]) {
                    expect({ note: spec.code, rubrique: r.libelle, avant: idx < i }).toEqual({ note: spec.code, rubrique: r.libelle, avant: true });
                }
            });
        }
    });
    it('une rubrique porte soit des comptes, soit un total, soit une subdivision attendue, soit une saisie · jamais rien', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const r of spec.rubriques) {
                const definie = (r.comptes?.length ?? 0) > 0 || r.totalDeRubriques !== undefined || r.subdivisionAttendue !== undefined || r.saisie === true;
                expect({ note: spec.code, rubrique: r.libelle, definie }).toEqual({ note: spec.code, rubrique: r.libelle, definie: true });
            }
        }
    });
    it('sens et natureCreditrice ne se cumulent jamais ; saisie ne se cumule ni avec des comptes ni avec une attente', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const r of spec.rubriques) {
                expect({ note: spec.code, r: r.libelle, cumul: !!(r.sens && r.natureCreditrice) }).toEqual({ note: spec.code, r: r.libelle, cumul: false });
                expect({ note: spec.code, r: r.libelle, cumul: !!(r.saisie && (r.comptes?.length || r.subdivisionAttendue)) }).toEqual({ note: spec.code, r: r.libelle, cumul: false });
            }
        }
    });
    it('toute rubrique en attente porte une clé ; les clés sont uniques dans une note', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const r of spec.rubriques) {
                if (r.subdivisionAttendue)
                    expect(typeof r.cle).toBe('string');
            }
            const cles = spec.rubriques.map((r) => r.cle).filter(Boolean);
            expect(new Set(cles).size).toBe(cles.length);
        }
    });
    it('chaque note déclare des colonnes connues du moteur et un titre non vide', () => {
        const CALCULEES = [
            'EXERCICE_N', 'EXERCICE_N1', 'VARIATION_VALEUR', 'VARIATION_POURCENT', 'VARIATION_VALEUR_ABSOLUE',
            'OUVERTURE', 'AUGMENTATIONS', 'DIMINUTIONS', 'CLOTURE',
            'AUGMENTATION_EXPLOITATION', 'AUGMENTATION_FINANCIERE', 'AUGMENTATION_HAO',
            'DIMINUTION_EXPLOITATION', 'DIMINUTION_FINANCIERE', 'DIMINUTION_HAO',
            'ECHEANCE_1AN', 'ECHEANCE_2ANS', 'ECHEANCE_PLUS_2ANS', 'LIBRE',
        ];
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            expect(spec.colonnes.length).toBeGreaterThan(0);
            expect(spec.titre.trim().length).toBeGreaterThan(0);
            for (const c of spec.colonnes)
                expect(CALCULEES).toContain(c.type);
        }
    });
    it('les échéances de dettes sont portées par 16A, 17, 18 et 19 et par elles seules (maquettes du ch. 6)', () => {
        const avecEcheances = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => n.colonnes.some((c) => c.type === 'ECHEANCE_1AN' || c.type === 'ECHEANCE_2ANS' || c.type === 'ECHEANCE_PLUS_2ANS')).map((n) => n.code);
        expect(avecEcheances).toEqual(['16A', '17', '18', '19']);
        const aValeurAbsolue = (code) => noteDe(code).colonnes.some((c) => c.libelle === 'Variation en valeur absolue');
        expect(['16A', '18', '19'].map(aValeurAbsolue)).toEqual([true, true, true]);
        expect(aValeurAbsolue('17')).toBe(false);
    });
    it('« Variation en valeur absolue » est calculée SIGNÉE (anomalie n° 33) · |N − N-1| perdrait le sens de la variation', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const c of spec.colonnes) {
                if (c.libelle === 'Variation en valeur absolue')
                    expect({ note: spec.code, type: c.type }).toEqual({ note: spec.code, type: 'VARIATION_VALEUR' });
            }
            expect(spec.colonnes.some((c) => c.type === 'VARIATION_VALEUR_ABSOLUE')).toBe(false);
        }
    });
    it('aucun cadratin dans un titre, un libellé, un commentaire ou un renvoi (CLAUDE.md §4)', () => {
        const cadratin = /\u2014/;
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            const textes = [
                spec.titre, spec.sousTableau ?? '', spec.commentaire ?? '', spec.renvoiOfficiel ?? '',
                ...spec.colonnes.map((c) => c.libelle),
                ...spec.rubriques.flatMap((r) => [r.libelle, r.renvoi ?? '', r.subdivisionAttendue ?? '']),
            ];
            for (const t of textes)
                expect(t).not.toMatch(cadratin);
        }
    });
    it('chaque préfixe cité (comptes et exclusions) correspond à au moins un compte d’imputation du semis SYSCOHADA', () => {
        const absents = [];
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const r of spec.rubriques) {
                for (const p of [...(r.comptes ?? []), ...(r.exclusions ?? [])]) {
                    if (!COMPTES_SEMIS.some((c) => c.numero.startsWith(p)))
                        absents.push({ note: spec.code, prefixe: p });
                }
            }
        }
        expect(absents).toEqual([]);
    });
    it('une note hors balance n’a que des rubriques en saisie, et une note chiffrée n’en a aucune', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            const saisies = spec.rubriques.filter((r) => r.saisie).length;
            if (spec.horsBalance)
                expect({ note: spec.code, toutes: saisies === spec.rubriques.length }).toEqual({ note: spec.code, toutes: true });
            else
                expect({ note: spec.code, saisies }).toEqual({ note: spec.code, saisies: 0 });
        }
        expect(correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => n.horsBalance).map((n) => n.code)).toEqual([
            '16B', '16B', '16B', '16B bis', '16B bis', '16C', '16C', '27B', '27B',
        ]);
    });
    it('aucune rubrique en attente de rattachement : les notes 16A à 27A descendent au divisionnaire du plan', () => {
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            expect(spec.rubriques.filter((r) => r.subdivisionAttendue).map((r) => r.libelle)).toEqual([]);
        }
    });
    it('une clé désigne une rubrique EN ATTENTE ou EN SAISIE, et n’ouvre jamais un rattachement à elle seule', () => {
        for (const note of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const r of note.rubriques) {
                if (r.subdivisionAttendue !== undefined || r.saisie === true) {
                    expect({ note: note.code, libelle: r.libelle, cle: r.cle }).toEqual({
                        note: note.code,
                        libelle: r.libelle,
                        cle: expect.any(String),
                    });
                }
                if (r.saisie)
                    expect(r.subdivisionAttendue).toBeUndefined();
            }
        }
    });
    it('le champ `renvoi` ne porte QUE des renvois du texte officiel · les lignes hors maquette sont listées à part', () => {
        const renvois = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.flatMap((n) => n.rubriques.filter((r) => r.renvoi).map((r) => `${n.code}:${r.renvoi}`));
        expect(renvois).toEqual(['19:28', '26:28']);
        for (const a of correspondance_notes_syscohada_2_1.RUBRIQUES_HORS_MAQUETTE_NOTES_2) {
            expect({ ...a, presente: noteDe(a.note).rubriques.some((r) => r.libelle === a.libelle) }).toEqual({ ...a, presente: true });
        }
        expect(correspondance_notes_syscohada_2_1.RUBRIQUES_HORS_MAQUETTE_NOTES_2).toHaveLength(7);
    });
});
describe('notes SYSCOHADA, tranche 2 · recoupement avec les postes du bilan (ch. 7)', () => {
    it('chaque `renvoyeeDepuis` de bilan est relu dans la colonne « Note » du modèle (ch. 3), pas affirmé', () => {
        const tete = (code) => /^\d+/.exec(code)[0];
        const posteBilan = (ref) => correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA.find((p) => p.ref === ref) ?? correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA.find((p) => p.ref === ref);
        const REFS_RESULTAT = new Set(correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA.map((p) => p.ref));
        for (const spec of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2) {
            for (const ref of spec.renvoyeeDepuis ?? []) {
                if (REFS_RESULTAT.has(ref))
                    continue;
                const poste = posteBilan(ref);
                expect({ note: spec.code, ref, note_du_poste: poste?.note }).toEqual({
                    note: spec.code, ref, note_du_poste: tete(spec.code),
                });
            }
        }
    });
    it('16A couvre DA, DB et DC compte par compte, en lecture créditrice sans filtre', () => {
        const n = noteDe('16A');
        expect(n.renvoyeeDepuis).toEqual(['DA', 'DB', 'DC']);
        recoupe(n, [postePassif('DA'), postePassif('DB'), postePassif('DC')]);
        for (const r of rubriquesChiffrees(n))
            expect({ r: r.libelle, nc: r.natureCreditrice, sens: r.sens }).toEqual({ r: r.libelle, nc: true, sens: undefined });
        expect(rubriquesChiffrees(n).find((r) => capte(r, '19620000'))?.libelle).toBe('Actif du régime de retraite');
        expect(rubriquesChiffrees(n).find((r) => capte(r, '18300000'))?.cle).toBe('interets-courus-emprunts');
        const totaux = n.rubriques.filter((r) => r.totalDeRubriques);
        expect(totaux.map((t) => t.libelle)).toEqual([
            'TOTAL EMPRUNTS ET DETTES FINANCIÈRES', 'TOTAL DETTES DE LOCATION ACQUISITION', 'TOTAL PROVISIONS POUR RISQUES ET CHARGES',
        ]);
        const couverts = totaux.flatMap((t) => t.totalDeRubriques);
        const chiffrees = n.rubriques.map((r, i) => (r.comptes ? i : -1)).filter((i) => i >= 0);
        expect([...couverts].sort((a, b) => a - b)).toEqual(chiffrees);
    });
    it('17 couvre DJ (dettes) et BH (fournisseurs débiteurs) · le 404 est éclaté par le plan (anomalie n° 6)', () => {
        const n = noteDe('17');
        expect(n.renvoyeeDepuis).toEqual(['DJ', 'BH']);
        recoupe(n, [postePassif('DJ'), posteActif('BH')]);
        const ligne = (numero) => rubriquesChiffrees(n).find((r) => capte(r, numero))?.libelle;
        expect(ligne('40410000')).toBe('Fournisseurs dettes en compte (hors groupe)');
        expect(ligne('40460000')).toBe('Fournisseurs effets à payer (hors groupe)');
        expect(ligne('40120000')).toBe('Fournisseurs, dettes et effets à payer groupe');
        expect(ligne('40820000')).toBe('Fournisseurs factures non parvenues groupe');
        expect(ligne('40930000')).toBe('Fournisseurs, avances et acomptes (hors groupe)');
        for (const r of rubriquesChiffrees(n)) {
            const debiteur = r.comptes.every((c) => c.startsWith('409'));
            expect({ r: r.libelle, nc: !!r.natureCreditrice }).toEqual({ r: r.libelle, nc: !debiteur });
            expect(r.sens).toBeUndefined();
        }
    });
    it('18 couvre DK, et toutes ses lignes filtrent le sens CRÉDITEUR comme le ch. 7 (anomalie n° 7 sur le 421)', () => {
        const n = noteDe('18');
        expect(n.renvoyeeDepuis).toEqual(['DK']);
        expect(postePassif('DK').sens_qualificatif).toBe('CREDITEUR');
        recoupe(n, [postePassif('DK')]);
        for (const r of rubriquesChiffrees(n))
            expect({ r: r.libelle, sens: r.sens }).toEqual({ r: r.libelle, sens: 'CREDITEUR' });
        const ligne = (numero) => rubriquesChiffrees(n).find((r) => capte(r, numero))?.libelle;
        expect(ligne('42110000')).toBe('Personnel avances et acomptes');
        expect(ligne('43130000')).toBe('Caisse de sécurité sociale');
        expect(ligne('43200000')).toBe('Caisse de retraite');
        expect(ligne('44600000')).toBe('Autres dettes État');
        expect(ligne('44520000')).toBe('État, TVA');
    });
    it('19 couvre DM et DN · 186 à 188 sont la seule tolérance (anomalie n° 11), 4998 reste à DH', () => {
        const n = noteDe('19');
        expect(n.renvoyeeDepuis).toEqual(['DM', 'DN']);
        expect(postePassif('DM').sens_qualificatif).toBe('CREDITEUR');
        recoupe(n, [postePassif('DM'), postePassif('DN')], correspondance_notes_syscohada_2_1.COMPTES_NOTES_2_HORS_POSTE_JUSTIFIES.map((j) => j.prefixe), ['478']);
        for (const j of correspondance_notes_syscohada_2_1.COMPTES_NOTES_2_HORS_POSTE_JUSTIFIES) {
            const dansUnPoste = [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA].some((p) => (0, etats_financiers_communs_1.correspond)(`${j.prefixe}00000`, p.comptes, p.exclusions));
            expect({ prefixe: j.prefixe, dansUnPoste }).toEqual({ prefixe: j.prefixe, dansUnPoste: false });
            expect(rubriquesChiffrees(noteDe(j.note)).some((r) => capte(r, `${j.prefixe}00000`))).toBe(true);
        }
        const provisions = rubriquesChiffrees(n).find((r) => r.renvoi === '28');
        expect(capte(provisions, '49980000')).toBe(false);
        expect(capte(provisions, '49910000')).toBe(true);
        expect(capte(provisions, '59900000')).toBe(true);
        expect(provisions.natureCreditrice).toBe(true);
        for (const r of rubriquesChiffrees(n).filter((r) => r !== provisions))
            expect({ r: r.libelle, sens: r.sens }).toEqual({ r: r.libelle, sens: 'CREDITEUR' });
        const idx = (libelle) => n.rubriques.findIndex((r) => r.libelle === libelle);
        expect(n.rubriques[idx('TOTAL DETTES ASSOCIÉS')].totalDeRubriques).not.toContain(idx('Organismes internationaux'));
        expect(n.rubriques[idx('TOTAL AUTRES DETTES')].totalDeRubriques).toEqual([
            idx('Organismes internationaux'), idx('TOTAL DETTES ASSOCIÉS'), idx('TOTAL CRÉDITEURS DIVERS'), idx('TOTAL COMPTES DE LIAISON'),
        ]);
        const autres = n.rubriques[idx('Autres créditeurs divers')];
        for (const numero of ['47110000', '47210000', '47310000', '47460000', '47600000', '47700000'])
            expect(capte(autres, numero)).toBe(true);
        expect(capte(autres, '47810000')).toBe(false);
        expect(capte(autres, '47910000')).toBe(false);
    });
    it('20 couvre DQ et DR, y compris les 52/53 créditeurs que BS transfère (anomalies n° 14 et 15)', () => {
        const n = noteDe('20');
        expect(n.renvoyeeDepuis).toEqual(['DQ', 'DR']);
        recoupe(n, [postePassif('DQ'), postePassif('DR'), { comptes: correspondance_bilan_syscohada_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA }]);
        const rubrique = (numero) => rubriquesChiffrees(n).find((r) => capte(r, numero));
        for (const c of COMPTES_SEMIS.filter((c) => /^5[23]/.test(c.numero)))
            expect({ c: c.numero, sens: rubrique(c.numero).sens }).toEqual({ c: c.numero, sens: 'CREDITEUR' });
        for (const numero of ['56100000', '56400000', '56500000', '56600000']) {
            expect({ numero, sens: rubrique(numero).sens, nc: rubrique(numero).natureCreditrice }).toEqual({ numero, sens: undefined, nc: true });
        }
        expect(rubrique('53100000').libelle).toBe('Autres banques');
        expect(rubrique('53600000').libelle).toBe('Autres banques');
        expect(rubrique('52610000').libelle).toBe('Banques intérêts courus');
        expect(rubrique('56600000').libelle).toBe('Crédit de trésorerie');
        expect(n.rubriques[n.rubriques.length - 1].totalDeRubriques).toEqual([2, 8]);
    });
});
describe('notes SYSCOHADA, tranche 2 · recoupement avec les postes du compte de résultat (ch. 7)', () => {
    it.each([
        ['21', ['TA', 'TB', 'TC', 'TD', 'TF', 'TG', 'TH']],
        ['22', ['RA', 'RC', 'RE']],
        ['23', ['RG']],
        ['24', ['RH']],
        ['25', ['RI']],
        ['26', ['RJ']],
        ['27A', ['RK']],
    ])('la note %s couvre exactement ses postes %j, compte par compte', (code, refs) => {
        const n = noteDe(code);
        expect(n.renvoyeeDepuis).toEqual(refs);
        for (const ref of refs)
            expect(posteResultat(ref).notes.some((x) => x === code || x === code.replace(/[AB]$/, ''))).toBe(true);
        recoupe(n, refs.map(posteResultat));
    });
    it('21 : chaque bloc de ventes recoupe son poste (TA, TB, TC) et le chiffre d’affaires est la somme des quatre (anomalie n° 16)', () => {
        const n = noteDe('21');
        const bloc = (total, ref) => {
            const t = n.rubriques.find((r) => r.libelle === total);
            const lignes = t.totalDeRubriques.map((i) => n.rubriques[i]);
            const attendus = comptesDuPoste(posteResultat(ref));
            const captes = COMPTES_SEMIS.map((c) => c.numero).filter((x) => lignes.some((r) => capte(r, x)));
            expect({ total, captes: captes.sort() }).toEqual({ total, captes: attendus.sort() });
            const ajoutees = lignes.filter((r) => horsMaquette('21').includes(r.libelle)).map((r) => r.libelle);
            expect(ajoutees.length).toBe(1);
            expect(ajoutees[0]).toMatch(/^Rabais, remises et ristournes accordés/);
        };
        bloc('TOTAL : VENTES MARCHANDISES', 'TA');
        bloc('TOTAL : VENTES DE PRODUITS FABRIQUÉS', 'TB');
        bloc('TOTAL : VENTES DE TRAVAUX ET SERVICES VENDUS', 'TC');
        const internet = rubriquesChiffrees(n).filter((r) => r.libelle.endsWith('sur internet'));
        expect(internet.flatMap((r) => r.comptes).sort()).toEqual(['7015', '7025', '7035', '7045', '7055', '7065']);
        for (const r of rubriquesChiffrees(n))
            expect({ r: r.libelle, nc: r.natureCreditrice }).toEqual({ r: r.libelle, nc: true });
        const idx = (libelle) => n.rubriques.findIndex((r) => r.libelle === libelle);
        expect(n.rubriques[idx("TOTAL : CHIFFRES D'AFFAIRES")].totalDeRubriques).toEqual([
            idx('TOTAL : VENTES MARCHANDISES'), idx('TOTAL : VENTES DE PRODUITS FABRIQUÉS'),
            idx('TOTAL : VENTES DE TRAVAUX ET SERVICES VENDUS'), idx('Produits accessoires'),
        ]);
        expect(n.rubriques[idx('TOTAL')].totalDeRubriques).toEqual([idx("TOTAL : CHIFFRES D'AFFAIRES"), idx('TOTAL : AUTRES PRODUITS')]);
        expect(rubriquesChiffrees(n).find((r) => capte(r, '75900000'))?.libelle).toBe('Autres produits');
        expect(rubriquesChiffrees(noteDe('26')).find((r) => capte(r, '65900000'))?.renvoi).toBe('28');
    });
    it('22 : les trois totaux d’achats recoupent RA, RC et RE, frais et RRR compris (anomalies n° 17 à 19)', () => {
        const n = noteDe('22');
        const bloc = (total, ref, ajoutees) => {
            const t = n.rubriques.find((r) => r.libelle === total);
            const lignes = t.totalDeRubriques.map((i) => n.rubriques[i]);
            const attendus = comptesDuPoste(posteResultat(ref));
            const captes = COMPTES_SEMIS.map((c) => c.numero).filter((x) => lignes.some((r) => capte(r, x)));
            expect({ total, captes: captes.sort() }).toEqual({ total, captes: attendus.sort() });
            expect(lignes.filter((r) => horsMaquette('22').includes(r.libelle)).length).toBe(ajoutees);
        };
        bloc('TOTAL : ACHATS DE MARCHANDISES', 'RA', 2);
        bloc('TOTAL : ACHATS MATIÈRES PREMIÈRES ET FOURNITURES LIÉES', 'RC', 2);
        bloc('TOTAL : AUTRES ACHATS', 'RE', 0);
        const ligne = (numero) => rubriquesChiffrees(n).find((r) => capte(r, numero))?.libelle;
        expect(ligne('60460000')).toBe("Fournitures d'atelier, d'usine et de magasin");
        expect(ligne('60470000')).toBe('Fourniture de bureau');
        expect(ligne('60550000')).toBe('Fourniture de bureau');
        expect(ligne('60580000')).toBe('Achats études, prestations de services, de travaux matériels et équipements');
        expect(ligne('60850000')).toBe('Frais sur achats');
        expect(ligne('60890000')).toBe('Remises rabais, remises et ristournes');
        for (const r of rubriquesChiffrees(n))
            expect({ r: r.libelle, nc: r.natureCreditrice, sens: r.sens }).toEqual({ r: r.libelle, nc: undefined, sens: undefined });
    });
    it('24 et 26 : les comptes sans ligne vont à la ligne résiduelle (anomalies n° 21 et 22)', () => {
        const l24 = (numero) => rubriquesChiffrees(noteDe('24')).find((r) => capte(r, numero))?.libelle;
        expect(l24('63710000')).toBe('Autres charges externes');
        expect(l24('63810000')).toBe('Autres charges externes');
        expect(l24('63510000')).toBe('Cotisations');
        const l26 = (numero) => rubriquesChiffrees(noteDe('26')).find((r) => capte(r, numero))?.libelle;
        expect(l26('65600000')).toBe('Autres charges diverses');
        expect(l26('65700000')).toBe('Autres charges diverses');
        expect(l26('65880000')).toBe('Autres charges diverses');
        expect(l26('65910000')).toMatch(/voir note 28/);
        expect(rubriquesChiffrees(noteDe('25')).find((r) => capte(r, '64710000'))?.libelle).toBe('Pénalités et amendes fiscales');
        expect(rubriquesChiffrees(noteDe('25')).some((r) => capte(r, '65700000'))).toBe(false);
    });
    it('27A : 661 et 662 sur une seule ligne, 667 sur la sienne ; 27B porte les codes YA à YO dans l’ordre', () => {
        const l = (numero) => rubriquesChiffrees(noteDe('27A')).find((r) => capte(r, numero))?.libelle;
        expect(l('66110000')).toBe('Rémunérations directes versées au personnel');
        expect(l('66210000')).toBe('Rémunérations directes versées au personnel');
        expect(l('66710000')).toBe('Rémunération transférée de personnel extérieur');
        const codes = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => n.code === '27B').flatMap((n) => n.rubriques.map((r) => r.cle));
        expect(codes).toEqual(['YA', 'YB', 'YC', 'YD', 'YE', 'YF', 'YG', 'YH', 'YI', 'YJ', 'YK', 'YL', 'YM', 'YN', 'YO']);
        for (const n of correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => n.code === '27B'))
            expect(n.colonnes.length).toBe(16);
        expect(noteDe('27B', '2. Personnel extérieur').colonnes.some((c) => c.libelle.startsWith("FACTURATION À L'ENTITÉ"))).toBe(true);
    });
});
describe('notes SYSCOHADA, tranche 2 · anti double comptage', () => {
    it('à l’intérieur de la tranche, aucun compte du semis n’est capté par deux rubriques', () => {
        const doublons = [];
        for (const c of COMPTES_SEMIS) {
            const notes = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => rubriquesChiffrees(n).some((r) => capte(r, c.numero))).map((n) => n.code);
            if (notes.length > 1)
                doublons.push({ numero: c.numero, notes });
        }
        expect(doublons).toEqual([]);
    });
    it('avec la première tranche, un compte de bilan n’est réclamé deux fois que dans des sens OPPOSÉS, hors chevauchements signalés', () => {
        const CHEVAUCHEMENTS_SIGNALES = ['526', '536'];
        const codes2 = new Set(correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.map((n) => n.code));
        const lecture = (r) => r.sens ?? 'SANS_FILTRE';
        const suspects = [];
        for (const c of COMPTES_SEMIS.filter((c) => /^[1-5]/.test(c.numero))) {
            const ici = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.flatMap((n) => rubriquesChiffrees(n).filter((r) => capte(r, c.numero)).map((r) => `${n.code}:${lecture(r)}`));
            if (ici.length === 0)
                continue;
            const ailleurs = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.flatMap((n) => rubriquesChiffrees(n)
                .filter((r) => capte(r, c.numero) && !(r.renvoi && codes2.has(r.renvoi)))
                .map((r) => `${n.code}:${lecture(r)}`));
            if (ailleurs.length === 0)
                continue;
            const lectures = [...ailleurs, ...ici];
            const opposes = lectures.length === 2 && ailleurs[0].endsWith(':DEBITEUR') && ici[0].endsWith(':CREDITEUR');
            if (!opposes && !CHEVAUCHEMENTS_SIGNALES.some((p) => c.numero.startsWith(p)))
                suspects.push({ numero: c.numero, lectures });
        }
        expect(suspects).toEqual([]);
        for (const p of CHEVAUCHEMENTS_SIGNALES) {
            const numero = COMPTES_SEMIS.find((c) => c.numero.startsWith(p)).numero;
            const dansT1 = correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1.some((n) => rubriquesChiffrees(n).some((r) => capte(r, numero) && !(r.renvoi && codes2.has(r.renvoi))));
            const dansT2 = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.some((n) => rubriquesChiffrees(n).some((r) => capte(r, numero)));
            expect({ p, dansT1, dansT2 }).toEqual({ p, dansT1: true, dansT2: true });
        }
    });
    it('avec la troisième tranche, le seul recouvrement est la NOTE 28, tableau des mouvements des provisions', () => {
        const attendu = new Map();
        for (const c of COMPTES_SEMIS.filter((c) => /^19/.test(c.numero)))
            attendu.set(c.numero, '2/16A + 3/28');
        for (const c of COMPTES_SEMIS.filter((c) => /^(499|599)/.test(c.numero) && !c.numero.startsWith('4998')))
            attendu.set(c.numero, '2/19 + 3/28');
        const observe = new Map();
        for (const c of COMPTES_SEMIS) {
            const ici = correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2.filter((n) => rubriquesChiffrees(n).some((r) => capte(r, c.numero))).map((n) => `2/${n.code}`);
            const laBas = correspondance_notes_syscohada_3_1.NOTES_SYSCOHADA_3.filter((n) => rubriquesChiffrees(n).some((r) => capte(r, c.numero))).map((n) => `3/${n.code}`);
            if (ici.length && laBas.length)
                observe.set(c.numero, [...ici, ...laBas].join(' + '));
        }
        expect([...observe.entries()].sort()).toEqual([...attendu.entries()].sort());
        const provisions = rubriquesChiffrees(noteDe('19')).find((r) => r.renvoi === '28');
        expect(capte(provisions, '49910000')).toBe(true);
    });
});
describe('notes SYSCOHADA, tranche 2 · anomalie n° 31, le 672 du Titre VII et celui du semis (passe R1, C11)', () => {
    it('la prémisse est relue sur le semis · 6724 y est la location-vente, 6728 les autres, et aucun 6721', () => {
        const intitule = (numero) => compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === numero)?.intitule;
        expect(intitule('67240000')).toContain('location-vente');
        expect(intitule('67280000')).toContain('autres locations acquisition');
        expect(intitule('67220000')).toContain('crédit-bail immobilier');
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.some((c) => c.numero.startsWith('6721'))).toBe(false);
    });
    it('l’anomalie n° 31 nomme l’écart du compte 67, sans le trancher', () => {
        const source = require('fs').readFileSync(require('path').join(__dirname, 'correspondance-notes-syscohada-2.ts'), 'utf8');
        const debut = source.indexOf(' * 31. **Écarts entre le Titre VII et le plan de comptes**');
        const fin = source.indexOf(' * 32. ', debut);
        const anomalie = source.slice(debut, fin);
        expect(anomalie).toContain('COMPTE 67 : le Titre VII subdivise 672');
        expect(anomalie).toContain('6724 location-vente');
        expect(anomalie).toContain('non tranché');
    });
});
//# sourceMappingURL=correspondance-notes-syscohada-2.spec.js.map
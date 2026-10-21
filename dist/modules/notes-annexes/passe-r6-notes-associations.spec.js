"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExcelJS = require("exceljs");
const compte_seed_1 = require("../comptes/compte-seed");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const export_service_1 = require("../exports/export.service");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const controles_saisie_notes_1 = require("./controles-saisie-notes");
const indicateurs_note_33_1 = require("./indicateurs-note-33");
const spec = (code, sousTableau) => correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === code && (sousTableau === undefined || n.sousTableau === sousTableau));
const rubrique = (s, libelle) => s.rubriques.find((r) => r.libelle === libelle);
const DETAIL = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL');
describe('C1 · la note 25 lit tout le compte 61', () => {
    it('chaque compte Détail semé sous 61 est lu par une ligne de la note 25', () => {
        const n25 = spec('25');
        const prefixes = n25.rubriques.flatMap((r) => (r.comptes ?? []).map((p) => ({ p, ex: r.exclusions })));
        const orphelins = DETAIL.filter((c) => c.numero.startsWith('61'))
            .filter((c) => !prefixes.some(({ p, ex }) => (0, etats_financiers_communs_1.correspond)(c.numero, [p], ex)))
            .map((c) => c.numero);
        expect(orphelins).toEqual([]);
    });
});
describe('C2 · la note 24 lit les sous-comptes que le plan ouvre sous l’intitulé de la ligne', () => {
    const ATTENDUS = [
        ['Matières consommables', '60410000', /mati[eè]res consommables/i],
        ['Matières combustibles', '60420000', /combustibles/i],
        ["Produits d'entretien", '60430000', /entretien/i],
        ['Eau', '60510000', /eau/i],
        ['Electricité', '60520000', /lectricit/i],
        ['Autres énergies', '60530000', /autres [ée]nergies/i],
        ['Fourniture de bureau', '60470000', /fournitures de bureau/i],
        ['Fourniture de bureau', '60550000', /fournitures de bureau/i],
        ['Petit matériel et outillages', '60560000', /petit mat[ée]riel/i],
    ];
    it.each(ATTENDUS)('« %s » lit le %s, semé sous un intitulé qui le justifie', (libelle, numero, intitule) => {
        const semes = DETAIL.find((c) => c.numero === numero);
        expect(semes?.intitule).toMatch(intitule);
        const r = rubrique(spec('24'), libelle);
        expect((0, etats_financiers_communs_1.correspond)(numero, r.comptes ?? [], r.exclusions)).toBe(true);
    });
    it('aucun compte Détail semé sous 60 n’est lu par DEUX lignes de la note 24', () => {
        const lignes = spec('24').rubriques.filter((r) => r.comptes?.length);
        for (const c of DETAIL.filter((x) => x.numero.startsWith('60'))) {
            const lecteurs = lignes.filter((r) => (0, etats_financiers_communs_1.correspond)(c.numero, r.comptes, r.exclusions)).map((r) => r.libelle);
            expect({ numero: c.numero, lecteurs: lecteurs.length <= 1 }).toEqual({ numero: c.numero, lecteurs: true });
        }
    });
});
describe('C5 et C6 · une ligne lue au débit n’est jamais présentée en négatif par-dessus', () => {
    it('aucune rubrique des associations ne cumule `sens: DEBITEUR` et `presenterEnNegatif`', () => {
        const doubles = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.flatMap((n) => n.rubriques.filter((r) => r.sens === 'DEBITEUR' && r.presenterEnNegatif).map((r) => `${n.code} · ${r.libelle}`));
        expect(doubles).toEqual([]);
    });
    it('le total des provisions de la note 18A retranche l’actif du régime de retraite', () => {
        const s = spec('18A');
        const total = rubrique(s, 'TOTAL PROVISIONS FINANCIERES POUR RISQUES ET CHARGES');
        const actif = s.rubriques.indexOf(rubrique(s, 'Actif du régime de retraite'));
        expect(total.moinsRubriques).toEqual([actif]);
        expect(total.totalDeRubriques).not.toContain(actif);
    });
});
describe('B14 et B16 · ce que la présentation doit dire', () => {
    it('B14 · la note 8 dit où va le compte 35', () => {
        expect(spec('8').precisionEditeur).toMatch(/comprend le compte 35 « Produits finis/);
    });
    it('B16 · les provisions réglementées de la note 17A renvoient à la NOTE 30 par la précision, pas par un renvoi de ligne', () => {
        const s = spec('17A');
        expect(s.rubriques.filter((r) => r.renvoi).map((r) => r.libelle)).toEqual([]);
        expect(s.precisionEditeur).toMatch(/NOTE 30/);
    });
    it('C18 (d) · les dettes financières de la note 33 portent le renvoi (c) des écarts de conversion', () => {
        const s = spec('33');
        expect(s.rubriques.find((r) => r.cle === 'dettes-financieres-et-ressources-assimilees')?.renvoi).toBe('(*) (c)');
    });
});
describe('B12 · les totaux et formules en saisie sont confrontés, jamais calculés', () => {
    it('lit un nombre saisi, et ne lit pas un séparateur de milliers ambigu', () => {
        expect((0, controles_saisie_notes_1.nombreSaisi)(' 1 200,50 ')).toBe(1200.5);
        expect((0, controles_saisie_notes_1.nombreSaisi)('')).toBeNull();
        expect((0, controles_saisie_notes_1.nombreSaisi)(null)).toBeNull();
        expect(Number.isNaN((0, controles_saisie_notes_1.nombreSaisi)('1.234.567'))).toBe(true);
        expect(Number.isNaN((0, controles_saisie_notes_1.nombreSaisi)('néant'))).toBe(true);
    });
    const engagements = spec('1', 'ENGAGEMENTS FINANCIERS');
    it('le total juste ne dit rien, le total faux dit l’attendu, le total vide le réclame', () => {
        const juste = (0, controles_saisie_notes_1.ecartsDesSaisies)(engagements, [[null, 100, null], [null, 50, null], undefined, [null, 150, null]]);
        expect(juste[3]).toBeUndefined();
        const faux = (0, controles_saisie_notes_1.ecartsDesSaisies)(engagements, [[null, 100, null], [null, 50, null], undefined, [null, 120, null]]);
        expect(faux[3]).toEqual([{ colonne: 1, saisi: 120, attendu: 150 }]);
        const vide = (0, controles_saisie_notes_1.ecartsDesSaisies)(engagements, [[null, 100, null], undefined, undefined, [null, null, null]]);
        expect(vide[3]).toEqual([{ colonne: 1, saisi: null, attendu: 100 }]);
    });
    it('une colonne dont aucune ligne n’est saisie n’est pas réclamée, un texte suspend le contrôle', () => {
        const r = (0, controles_saisie_notes_1.ecartsDesSaisies)(engagements, [[null, 'néant', null], [null, 50, null], undefined, [null, 9, null]]);
        expect(r[3]).toBeUndefined();
    });
    it('la formule « E = D - C » de la 5G ne se confronte que sur une ligne entièrement chiffrée', () => {
        const s5g = spec('5G');
        const complet = (0, controles_saisie_notes_1.ecartsDesSaisies)(s5g, [[1000, 400, 600, 900, 200]]);
        expect(complet[0]).toEqual([{ colonne: 4, saisi: 200, attendu: 300 }]);
        const incomplet = (0, controles_saisie_notes_1.ecartsDesSaisies)(s5g, [[1000, null, 600, 900, 300]]);
        expect(incomplet[0]).toBeUndefined();
    });
    it('l’écart part dans le classeur, en note de la cellule même', () => {
        const svc = Object.create(export_service_1.ExportService.prototype);
        const classeur = new ExcelJS.Workbook();
        const note = {
            code: '1',
            titre: 'ENGAGEMENTS FINANCIERS',
            colonnes: engagements.colonnes,
            applicable: true,
            lignes: [
                {
                    libelle: 'TOTAL', montantN: 0, estTotal: false, comptes: [],
                    saisie: [null, 120, null],
                    ecartsSaisie: [{ colonne: 1, saisi: 120, attendu: 150 }],
                },
            ],
        };
        const ident = { entite: 'X', nif: '', exercice: '2026', dateDebut: '', dateFin: '', duree: '12', adresse: '', sigle: '', ntd: '', dateArrete: '' };
        svc.feuilleNote(classeur, [note], ident);
        const ws = classeur.getWorksheet('NOTE 1');
        let trouve = '';
        ws.eachRow((row, r) => {
            if (row.getCell(1).value === 'TOTAL')
                trouve = String(ws.getCell(r, 3).note ?? '');
        });
        expect(trouve).toMatch(/saisi 120\.00, attendu 150\.00/);
    });
});
describe('C12 · la CAFG de la note 33 compte les dotations et reprises H.A.O.', () => {
    it('les 85 et 86 entrent dans la CAFG, dans leur sens', () => {
        const lignes = [
            { numero: '85200000', totalDebit: 300, totalCredit: 0 },
            { numero: '86200000', totalDebit: 0, totalCredit: 100 },
        ];
        const cessions = (0, indicateurs_note_33_1.cessionsDeLExercice)(lignes);
        expect(cessions).toMatchObject({ dotationsHao: 300, reprisesHao: 100 });
        const etats = {
            bilan: { actif: [], passif: [] },
            compteDeResultat: {
                produits: [], charges: [], totalCharges: 0, resultatActivitesOrdinaires: 0, resultatHao: 0, resultatNet: 1000,
            },
            fluxTresorerie: { lignes: [] },
        };
        const vide = { valeurComptable: 0, produits: 0, dotationsHao: 0, reprisesHao: 0 };
        const cafg = (0, indicateurs_note_33_1.indicateursNote33)(etats, cessions, vide, false).find((i) => i.cle === 'capacite-d-autofinancement-globale-cafg');
        const sansHao = (0, indicateurs_note_33_1.indicateursNote33)(etats, vide, vide, false).find((i) => i.cle === 'capacite-d-autofinancement-globale-cafg');
        expect(cafg.valeurN / sansHao.valeurN).toBeCloseTo(1.2, 9);
    });
});
describe('Paquet 1, A7 · la note 33 ne reprend pas un poste vide du tableau des flux', () => {
    const vide = { valeurComptable: 0, produits: 0, dotationsHao: 0, reprisesHao: 0 };
    const etats = (lignes, postesVides) => ({
        bilan: { actif: [], passif: [] },
        compteDeResultat: {
            produits: [], charges: [], totalCharges: 0, resultatActivitesOrdinaires: 0, resultatHao: 0, resultatNet: 0,
            resultatActivitesOrdinairesN1: 0, resultatHaoN1: 0, resultatNetN1: 0, totalChargesN1: 0,
        },
        fluxTresorerie: { lignes, postesVides },
    });
    const valeur = (i, cle) => i.find((x) => x.cle === cle);
    it('colonne N · les indicateurs des flux valent null, jamais zéro', () => {
        const lignes = ['ZB', 'ZC', 'ZD', 'ZE', 'ZF'].map((ref) => ({ ref, montant: 0 }));
        const i = (0, indicateurs_note_33_1.indicateursNote33)(etats(lignes, ['ZB', 'ZC', 'ZD', 'ZE', 'ZF']), vide, vide, false);
        for (const cle of [
            'flux-de-tresorerie-des-activites-operationnelles',
            'flux-de-tresorerie-des-activites-d-investissemen',
            'flux-de-tresorerie-des-activites-de-financement',
            'variation-de-la-tresorerie-nette-de-la-periode',
        ]) {
            expect(valeur(i, cle).valeurN).toBeNull();
        }
        expect(valeur((0, indicateurs_note_33_1.indicateursNote33)(etats(lignes), vide, vide, false), 'flux-de-tresorerie-des-activites-operationnelles').valeurN).toBe(0);
    });
    it('colonne N-1 · un poste sans montantN1 n’a pas de valeur', () => {
        const lignes = [
            { ref: 'ZB', montant: 1000, montantN1: undefined },
            { ref: 'ZD', montant: 0, montantN1: 4000 },
            { ref: 'ZE', montant: 0, montantN1: undefined },
        ];
        const i = (0, indicateurs_note_33_1.indicateursNote33)(etats(lignes), vide, vide, true);
        expect(valeur(i, 'flux-de-tresorerie-des-activites-operationnelles').valeurN1).toBeNull();
        expect(valeur(i, 'flux-de-tresorerie-des-activites-de-financement').valeurN1).toBeNull();
        expect(valeur(i, 'flux-de-tresorerie-des-activites-operationnelles').valeurN).not.toBeNull();
    });
});
//# sourceMappingURL=passe-r6-notes-associations.spec.js.map
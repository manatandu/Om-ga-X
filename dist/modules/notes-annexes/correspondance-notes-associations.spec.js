"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const notes_sycebnl_commun_1 = require("./notes-sycebnl.commun");
const CODES_OFFICIELS = [
    '1', '2', '3', '4',
    '5A', '5B', '5C', '5D', '5E', '5F', '5G', '5H',
    '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
    '17A', '17B', '18A', '18B',
    '19', '20', '21', '22', '23', '24', '25', '26', '27', '28',
    '29A', '29B',
    '30', '31', '32', '33', '34', '35',
];
const HORS_BALANCE_RELEVES = [
    '1 / ENGAGEMENTS FINANCIERS',
    '18B',
    '2',
    '29B / PERSONNEL EXTERIEUR ET BENEVOLE',
    '29B / PERSONNEL PROPRE',
    '3',
    '33',
    '34',
    '35',
    '4',
    '5G',
    '5H',
];
describe('couverture de la liste officielle', () => {
    it('porte les 45 tableaux du chapitre 2, ni un de plus ni un de moins', () => {
        const codes = (0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS);
        expect(codes.filter((c) => !CODES_OFFICIELS.includes(c))).toEqual([]);
        expect(CODES_OFFICIELS.filter((c) => !codes.includes(c))).toEqual([]);
        expect(codes).toHaveLength(45);
    });
    it('les trente-cinq numéros de tête sont tous représentés', () => {
        const tetes = new Set((0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS).map((c) => /^(\d+)/.exec(c)[1]));
        expect(tetes.size).toBe(35);
    });
    it('un code partagé par plusieurs tableaux les NOMME tous', () => {
        const parCode = new Map();
        for (const n of correspondance_notes_associations_1.NOTES_ASSOCIATIONS)
            parCode.set(n.code, (parCode.get(n.code) ?? 0) + 1);
        for (const n of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            if (parCode.get(n.code) > 1) {
                expect([n.code, Boolean(n.sousTableau)]).toEqual([n.code, true]);
            }
        }
        const multiples = [...parCode].filter(([, n]) => n > 1).map(([c, n]) => `${c}×${n}`);
        expect(multiples.sort()).toEqual(['1×3', '29B×2', '7×2']);
    });
    it('aucun tableau en double · une étiquette ne désigne qu’une chose', () => {
        const etiquettes = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.map(notes_sycebnl_commun_1.etiquette);
        expect(etiquettes.filter((e, i) => etiquettes.indexOf(e) !== i)).toEqual([]);
    });
});
describe('l’export ne peut pas perdre une note en silence', () => {
    function codesDeLExport() {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../exports/export.service.ts'), 'utf8');
        const debut = source.indexOf('PARTIES_NOTES_ASSOCIATIONS: Array<[string, string[]]> = [');
        const bloc = source.slice(debut, source.indexOf('\n  ];', debut));
        return [...bloc.matchAll(/'([\w ]+)'/g)].map((m) => m[1]).filter((s) => !s.startsWith('Partie'));
    }
    it('les quatre parties couvrent exactement les 45 codes, chacun une fois', () => {
        const aLExport = codesDeLExport();
        expect(aLExport.filter((c, i) => aLExport.indexOf(c) !== i)).toEqual([]);
        expect(aLExport.sort()).toEqual([...CODES_OFFICIELS].sort());
    });
    it('les parties suivent le découpage officiel de la fiche récapitulative', () => {
        expect(codesDeLExport()).toEqual(CODES_OFFICIELS);
    });
});
describe('les comptes cités existent vraiment', () => {
    it('aucun préfixe de compte absent du plan SYCEBNL semé', () => {
        const fantomes = [];
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)) {
            for (const p of rubrique.comptes ?? []) {
                if (!(0, notes_sycebnl_commun_1.compteSeme)(p))
                    fantomes.push(`${(0, notes_sycebnl_commun_1.etiquette)(note)} · ${rubrique.libelle} · ${p}`);
            }
            for (const e of rubrique.exclusions ?? []) {
                if (!(0, notes_sycebnl_commun_1.compteSeme)(e))
                    fantomes.push(`${(0, notes_sycebnl_commun_1.etiquette)(note)} · ${rubrique.libelle} · exclusion ${e}`);
            }
        }
        expect(fantomes).toEqual([]);
    });
    it('aucune exclusion qui n’exclut rien', () => {
        const inutiles = [];
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)) {
            for (const e of rubrique.exclusions ?? []) {
                if (!(rubrique.comptes ?? []).some((p) => e.startsWith(p))) {
                    inutiles.push(`${(0, notes_sycebnl_commun_1.etiquette)(note)} · ${rubrique.libelle} · exclut ${e} hors de [${(rubrique.comptes ?? []).join(', ')}]`);
                }
            }
        }
        expect(inutiles).toEqual([]);
    });
});
describe('cohérence de chaque rubrique', () => {
    it('une rubrique en attente de subdivision ne porte PAS de comptes', () => {
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)) {
            if (rubrique.subdivisionAttendue) {
                expect([(0, notes_sycebnl_commun_1.etiquette)(note), rubrique.libelle, rubrique.comptes ?? []]).toEqual([
                    (0, notes_sycebnl_commun_1.etiquette)(note),
                    rubrique.libelle,
                    [],
                ]);
            }
        }
    });
    it('une rubrique en attente de subdivision porte une CLÉ', () => {
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)) {
            if (rubrique.subdivisionAttendue) {
                expect([(0, notes_sycebnl_commun_1.etiquette)(note), rubrique.libelle, Boolean(rubrique.cle)]).toEqual([
                    (0, notes_sycebnl_commun_1.etiquette)(note),
                    rubrique.libelle,
                    true,
                ]);
            }
        }
    });
    it('les clés sont uniques à l’intérieur d’un même tableau', () => {
        for (const note of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            const cles = note.rubriques.map((r) => r.cle).filter(Boolean);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), cles.filter((c, i) => cles.indexOf(c) !== i)]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
    it('un total ne renvoie qu’à des rubriques qui existent, et jamais à lui-même', () => {
        for (const note of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            note.rubriques.forEach((r, i) => {
                for (const index of [...(r.totalDeRubriques ?? []), ...(r.moinsRubriques ?? [])]) {
                    expect([(0, notes_sycebnl_commun_1.etiquette)(note), r.libelle, index >= 0 && index < note.rubriques.length && index !== i]).toEqual([
                        (0, notes_sycebnl_commun_1.etiquette)(note),
                        r.libelle,
                        true,
                    ]);
                }
            });
        }
    });
    it('« moins » ne s’emploie qu’avec un total', () => {
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)) {
            if (rubrique.moinsRubriques?.length) {
                expect([(0, notes_sycebnl_commun_1.etiquette)(note), rubrique.libelle, Boolean(rubrique.totalDeRubriques?.length)]).toEqual([
                    (0, notes_sycebnl_commun_1.etiquette)(note),
                    rubrique.libelle,
                    true,
                ]);
            }
        }
    });
    it('aucun libellé vide, aucun titre vide', () => {
        for (const note of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.titre.trim().length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.colonnes.length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.rubriques.length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            for (const r of note.rubriques) {
                expect([(0, notes_sycebnl_commun_1.etiquette)(note), r.libelle.trim().length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            }
        }
    });
    it('les colonnes d’un tableau ne se répètent pas', () => {
        for (const note of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            const signatures = note.colonnes.map((c) => `${c.type}·${c.libelle}`);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), signatures.filter((s, i) => signatures.indexOf(s) !== i)]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
});
describe('une note hors balance ne chiffre rien', () => {
    it('aucune rubrique à comptes dans un tableau déclaré hors balance', () => {
        for (const note of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            if (!note.horsBalance)
                continue;
            const chiffrees = note.rubriques.filter((r) => (r.comptes ?? []).length > 0).map((r) => r.libelle);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), chiffrees]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
    it('la liste des tableaux hors balance est GELÉE', () => {
        const horsBalance = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.filter((n) => n.horsBalance).map(notes_sycebnl_commun_1.etiquette).sort();
        expect(horsBalance).toEqual(HORS_BALANCE_RELEVES);
    });
});
describe('Note 9 · impayés au 413, douteux au 416 (passe R6)', () => {
    const note9 = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '9');
    const comptesDe = (libelle) => note9.rubriques.find((r) => r.libelle === libelle).comptes;
    it('la ligne des impayés lit le 413', () => {
        expect(comptesDe('Adhérents, clients-usagers, chèques, effets et autres valeurs impayés')).toEqual(['413']);
    });
    it('la ligne des créances litigieuses ou douteuses lit le 416', () => {
        expect(comptesDe('Adhérents, créances litigieuses ou douteuses')).toEqual(['416']);
    });
});
describe('Notes 1, 7, 10 et 21 · les écarts de conversion et le 4881 à leur place (passe R6)', () => {
    const toutes = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.flatMap((n) => n.rubriques.map((r) => ({ code: n.code, sous: n.sousTableau, r })));
    const rubrique = (code, libelle, sous) => toutes.find((x) => x.code === code && x.r.libelle === libelle && (sous === undefined || x.sous === sous)).r;
    it('la note 10 ne lit pas le 478', () => {
        expect(rubrique('10', 'Autres débiteurs divers').comptes).toEqual(['472', '473', '474', '476']);
    });
    it('la note 21 ne lit pas le 479', () => {
        expect(rubrique('21', 'Autres créditeurs divers').comptes).not.toContain('479');
    });
    it('les créditeurs divers de la note 1 excluent le 479', () => {
        expect(rubrique('1', 'Créditeurs divers').exclusions).toContain('479');
    });
    it('la note 7 lit le 4881 sur sa ligne et l’exclut des autres dettes et des autres créances HAO', () => {
        expect(rubrique('7', 'Créditeurs, dons nature HAO non consommés')).toMatchObject({
            comptes: ['4881'],
            sens: 'CREDITEUR',
        });
        expect(rubrique('7', 'Autres dettes hors activités ordinaires').exclusions).toContain('4881');
        expect(rubrique('7', 'Autres créances hors activités ordinaires').exclusions).toContain('4881');
    });
    it('la note 7 des dettes HAO et la note 21 disent où va le 4998', () => {
        const n7 = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '7' && n.sousTableau === 'DETTES CIRCULANTES HAO');
        const n21 = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '21');
        expect(n7.precisionEditeur).toContain('4998');
        expect(n21.precisionEditeur).toContain('4998');
    });
});
describe('Notes 5D, 7, 11, 13, 15 et 24 · recopiées comme le modèle (passe R6)', () => {
    const note = (code, sous) => correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === code && (sous === undefined || n.sousTableau === sous));
    it('la note 5D suit l’ordre du modèle, sous-totaux intercalés', () => {
        expect(note('5D').rubriques.map((r) => r.libelle)).toEqual([
            'Usufruit',
            'Brevets, licences, logiciels et droits similaires',
            'Autres immobilisations incorporelles',
            'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES',
            'Terrains',
            'Bâtiments',
            'Matériel, mobilier',
            'SOUS TOTAL : IMMOBILISATIONS CORPORELLES',
            'TOTAL GENERAL',
        ]);
    });
    it('un sous-total de la note 5D additionne les lignes qui le précèdent immédiatement', () => {
        const r = note('5D').rubriques;
        expect(r[3].totalDeRubriques).toEqual([0, 1, 2]);
        expect(r[7].totalDeRubriques).toEqual([4, 5, 6]);
        expect(r[8].totalDeRubriques).toEqual([3, 7]);
    });
    it('la note 15 ne prête au modèle aucun renvoi, la précision du plan est dite d’OmegaX', () => {
        expect(note('15').renvoiOfficiel).toBeUndefined();
        expect(note('15').precisionEditeur).toContain('102');
    });
    it('les commentaires officiels des notes 7, 11, 13 et 24 sont recopiés mot pour mot', () => {
        expect(note('7', 'ACTIF CIRCULANT HAO').commentaire).toContain('dépréciations : indiquer les événements et circonstances motivant la dépréciation ou la reprise');
        expect(note('11').commentaire).toContain("pour les titres cotés à une bourse de valeur, indiquer le nombre, le prix unitaire d'acquisition et le cours de bourse au 31 décembre");
        expect(note('11').commentaire).toMatch(/^justifier toute variation significative/);
        expect(note('13').commentaire).toContain('détailler les instruments de monnaie électronique si le montant est significatif');
        expect(note('24').commentaire).toMatch(/^de toute variation significative/);
    });
    it('la note 13 porte le NB du modèle', () => {
        expect(note('13').renvoiOfficiel).toContain('figurent dans cette rubrique en négatif si le compte principal attaché est débiteur');
    });
});
//# sourceMappingURL=correspondance-notes-associations.spec.js.map
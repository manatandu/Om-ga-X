"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const etat_etafi_1 = require("../exports/etat-etafi");
const notes_sycebnl_commun_1 = require("./notes-sycebnl.commun");
const CODES_OFFICIELS = [
    '1', '2',
    '3A', '3B',
    '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
    '14', '15', '16', '17', '18', '19',
    '20A', '20B',
    '21', '22', '23', '24',
];
const HORS_BALANCE_RELEVES = [
    '1',
    '2',
    '20B / PERSONNEL EXTERIEUR ET BENEVOLE',
    '20B / PERSONNEL PROPRE',
    '22',
    '24',
    '9',
];
describe('couverture de la liste officielle', () => {
    it('porte les 26 tableaux du chapitre 3, ni un de plus ni un de moins', () => {
        const codes = (0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_projets_1.NOTES_PROJETS);
        expect(codes.filter((c) => !CODES_OFFICIELS.includes(c))).toEqual([]);
        expect(CODES_OFFICIELS.filter((c) => !codes.includes(c))).toEqual([]);
        expect(codes).toHaveLength(26);
    });
    it('les vingt-quatre numéros de tête sont tous représentés', () => {
        const tetes = new Set((0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_projets_1.NOTES_PROJETS).map((c) => /^(\d+)/.exec(c)[1]));
        expect(tetes.size).toBe(24);
    });
    it('un code partagé par plusieurs tableaux les NOMME tous', () => {
        const parCode = new Map();
        for (const n of correspondance_notes_projets_1.NOTES_PROJETS)
            parCode.set(n.code, (parCode.get(n.code) ?? 0) + 1);
        for (const n of correspondance_notes_projets_1.NOTES_PROJETS) {
            if (parCode.get(n.code) > 1) {
                expect([n.code, Boolean(n.sousTableau)]).toEqual([n.code, true]);
            }
        }
        const multiples = [...parCode].filter(([, n]) => n > 1).map(([c, n]) => `${c}×${n}`);
        expect(multiples.sort()).toEqual(['20B×2', '4×2']);
    });
    it('aucun tableau en double · une étiquette ne désigne qu’une chose', () => {
        const etiquettes = correspondance_notes_projets_1.NOTES_PROJETS.map(notes_sycebnl_commun_1.etiquette);
        expect(etiquettes.filter((e, i) => etiquettes.indexOf(e) !== i)).toEqual([]);
    });
});
describe('les deux jeux SYCEBNL ne se contaminent pas', () => {
    it('aucun code propre aux associations n’a glissé chez les projets', () => {
        const codesProjets = new Set((0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_projets_1.NOTES_PROJETS));
        const propresAuxAssociations = (0, notes_sycebnl_commun_1.codesDistincts)(correspondance_notes_associations_1.NOTES_ASSOCIATIONS).filter((c) => !CODES_OFFICIELS.includes(c));
        expect(propresAuxAssociations.filter((c) => codesProjets.has(c))).toEqual([]);
    });
    it('les deux tables ne partagent aucun OBJET · une retouche n’en touche qu’une', () => {
        const partages = correspondance_notes_projets_1.NOTES_PROJETS.filter((n) => correspondance_notes_associations_1.NOTES_ASSOCIATIONS.includes(n)).map(notes_sycebnl_commun_1.etiquette);
        expect(partages).toEqual([]);
        const rubriquesAssociations = new Set(correspondance_notes_associations_1.NOTES_ASSOCIATIONS.flatMap((n) => n.rubriques));
        const rubriquesPartagees = correspondance_notes_projets_1.NOTES_PROJETS.flatMap((n) => n.rubriques.filter((r) => rubriquesAssociations.has(r)).map((r) => `${(0, notes_sycebnl_commun_1.etiquette)(n)} · ${r.libelle}`));
        expect(rubriquesPartagees).toEqual([]);
    });
});
describe('l’export ne peut pas perdre une note en silence', () => {
    function codesDeLExport() {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../exports/export.service.ts'), 'utf8');
        const debut = source.indexOf('PARTIES_NOTES_PROJETS: Array<[string, string[]]> = [');
        const bloc = source.slice(debut, source.indexOf('\n  ];', debut));
        return [...bloc.matchAll(/'([\w ]+)'/g)].map((m) => m[1]).filter((s) => !s.startsWith('Partie'));
    }
    it('les quatre parties couvrent exactement les 26 codes, chacun une fois', () => {
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
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_projets_1.NOTES_PROJETS)) {
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
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_projets_1.NOTES_PROJETS)) {
            for (const e of rubrique.exclusions ?? []) {
                if (!(rubrique.comptes ?? []).some((p) => e.startsWith(p))) {
                    inutiles.push(`${(0, notes_sycebnl_commun_1.etiquette)(note)} · ${rubrique.libelle} · exclut ${e}`);
                }
            }
        }
        expect(inutiles).toEqual([]);
    });
});
describe('cohérence de chaque rubrique', () => {
    it('une rubrique en attente de subdivision ne porte PAS de comptes', () => {
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_projets_1.NOTES_PROJETS)) {
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
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_projets_1.NOTES_PROJETS)) {
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
        for (const note of correspondance_notes_projets_1.NOTES_PROJETS) {
            const cles = note.rubriques.map((r) => r.cle).filter(Boolean);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), cles.filter((c, i) => cles.indexOf(c) !== i)]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
    it('un total ne renvoie qu’à des rubriques qui existent, et jamais à lui-même', () => {
        for (const note of correspondance_notes_projets_1.NOTES_PROJETS) {
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
        for (const { note, rubrique } of (0, notes_sycebnl_commun_1.toutesLesRubriques)(correspondance_notes_projets_1.NOTES_PROJETS)) {
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
        for (const note of correspondance_notes_projets_1.NOTES_PROJETS) {
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.titre.trim().length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.colonnes.length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), note.rubriques.length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            for (const r of note.rubriques) {
                expect([(0, notes_sycebnl_commun_1.etiquette)(note), r.libelle.trim().length > 0]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), true]);
            }
        }
    });
    it('les colonnes d’un tableau ne se répètent pas', () => {
        for (const note of correspondance_notes_projets_1.NOTES_PROJETS) {
            const signatures = note.colonnes.map((c) => `${c.type}·${c.libelle}`);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), signatures.filter((s, i) => signatures.indexOf(s) !== i)]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
});
describe('une note hors balance ne chiffre rien', () => {
    it('aucune rubrique à comptes dans un tableau déclaré hors balance', () => {
        for (const note of correspondance_notes_projets_1.NOTES_PROJETS) {
            if (!note.horsBalance)
                continue;
            const chiffrees = note.rubriques.filter((r) => (r.comptes ?? []).length > 0).map((r) => r.libelle);
            expect([(0, notes_sycebnl_commun_1.etiquette)(note), chiffrees]).toEqual([(0, notes_sycebnl_commun_1.etiquette)(note), []]);
        }
    });
    it('la liste des tableaux hors balance est GELÉE', () => {
        const horsBalance = correspondance_notes_projets_1.NOTES_PROJETS.filter((n) => n.horsBalance).map(notes_sycebnl_commun_1.etiquette).sort();
        expect(horsBalance).toEqual(HORS_BALANCE_RELEVES);
    });
});
describe('la lacune de la note 22 reste une lacune', () => {
    const note22 = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '22');
    it('le texte officiel ne donne ni colonnes ni rubriques · le code le DIT', () => {
        expect(note22.colonnes.some((c) => c.libelle.includes('[texte officiel]'))).toBe(true);
        expect(note22.rubriques.some((r) => r.libelle.includes('[texte officiel]'))).toBe(true);
    });
    it('elle n’est PAS comblée depuis la note 30 du jeu associations', () => {
        const note30 = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.find((n) => n.code === '30');
        expect(note30).toBeDefined();
        expect(note22.rubriques.map((r) => r.libelle)).not.toEqual(note30.rubriques.map((r) => r.libelle));
        expect(note22.rubriques.every((r) => (r.comptes ?? []).length === 0)).toBe(true);
    });
});
describe('les renvois des notes et la colonne Note de la liasse disent la même chose', () => {
    it('chaque note se dit renvoyée depuis exactement les postes que la liasse lui renvoie', () => {
        const refDeCle = (cle) => cle.replace(/2$/, '');
        const attendu = new Map();
        for (const [cle, notes] of Object.entries(etat_etafi_1.NOTE_PAR_CLE_PROJETS)) {
            for (const code of notes.split(' et ')) {
                const s = attendu.get(code) ?? new Set();
                s.add(refDeCle(cle));
                attendu.set(code, s);
            }
        }
        const declare = new Map();
        for (const n of correspondance_notes_projets_1.NOTES_PROJETS) {
            const s = declare.get(n.code) ?? new Set();
            for (const r of n.renvoyeeDepuis ?? [])
                s.add(r);
            declare.set(n.code, s);
        }
        for (const code of CODES_OFFICIELS) {
            expect([code, [...(declare.get(code) ?? [])].sort()]).toEqual([code, [...(attendu.get(code) ?? [])].sort()]);
        }
    });
});
describe('note 8 · les six colonnes de la maquette, et la variation lue aux 478 et 479', () => {
    it('les libellés et les types suivent la maquette (Partie 4 ch. 3, note 8)', () => {
        const note8 = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '8');
        expect(note8.colonnes.map((c) => [c.libelle, c.type])).toEqual([
            ['Devises', 'LIBRE'],
            ['Montant en devises', 'LIBRE'],
            ['Cours UML Année acquisition', 'LIBRE'],
            ['Cours UML 31/12', 'LIBRE'],
            ['Variation en valeur', 'EXERCICE_N'],
            ['Variation en %', 'LIBRE'],
        ]);
    });
});
describe('note 16 · la maquette, et elle seule', () => {
    it('six rubriques et le TOTAL, sans ligne de rabais (passe R6, D14)', () => {
        const note16 = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '16');
        expect(note16.rubriques.map((r) => r.libelle)).toEqual([
            'Transports sur ventes',
            'Transports pour le compte de tiers',
            'Transport du personnel',
            'Transports de plis',
            'Voyages et déplacements',
            'Transports administratifs',
            'TOTAL',
        ]);
        expect(note16.rubriques[6].totalDeRubriques).toEqual([0, 1, 2, 3, 4, 5]);
    });
});
describe('note 19 · les renvois sont ceux de la maquette', () => {
    it('la ligne du 659 ne porte pas le « voir note 22 » que la maquette n’imprime pas (passe R6, D21)', () => {
        const note19 = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '19');
        expect(note19.rubriques.map((r) => [r.libelle, r.renvoi ?? null])).toEqual(note19.rubriques.map((r) => [r.libelle, null]));
    });
});
//# sourceMappingURL=correspondance-notes-projets.spec.js.map
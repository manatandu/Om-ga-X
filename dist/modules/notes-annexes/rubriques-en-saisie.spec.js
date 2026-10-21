"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const correspondance_notes_syscohada_1_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-1");
const correspondance_notes_syscohada_2_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-2");
const correspondance_notes_syscohada_3_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-3");
const cellules_libres_en_saisie_1 = require("./cellules-libres-en-saisie");
const JEUX = [
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS, correspondance_notes_associations_1.NOTES_ASSOCIATIONS],
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT, correspondance_notes_projets_1.NOTES_PROJETS],
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL, [...correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1, ...correspondance_notes_syscohada_2_1.NOTES_SYSCOHADA_2, ...correspondance_notes_syscohada_3_1.NOTES_SYSCOHADA_3]],
];
const etiquette = (n) => (n.sousTableau ? `${n.code}|${n.sousTableau}` : n.code);
const stockeDesSaisies = (n) => n.rubriques.some((r) => r.saisie) || n.colonnes.some(cellules_libres_en_saisie_1.colonneLibreEnSaisie);
const COLONNES_GELEES = {
    ASSOCIATIONS_ORDRES_PROFESSIONNELS: {
        '1|DETTES GARANTIES PAR DES SURETES REELLES': 5,
        '5C': 5,
        '17A': 7,
        '18B': 2,
        '1|ENGAGEMENTS FINANCIERS': 3,
        '5G': 5,
        '2': 1,
        '3': 1,
        '4': 1,
        '5H': 4,
        '29B|PERSONNEL PROPRE': 16,
        '29B|PERSONNEL EXTERIEUR ET BENEVOLE': 1,
        '33': 4,
        '34': 1,
        '35': 8,
    },
    PROJETS_DEVELOPPEMENT: {
        '1': 1,
        '3B': 5,
        '10': 5,
        '2': 1,
        '9': 1,
        '20B|PERSONNEL PROPRE': 16,
        '20B|PERSONNEL EXTERIEUR ET BENEVOLE': 1,
        '22': 1,
        '24': 8,
    },
    SYSCOHADA_SYSTEME_NORMAL: {
        '1|DETTES GARANTIES PAR DES SÛRETÉS RÉELLES': 5,
        '1|ENGAGEMENTS FINANCIERS': 2,
        '2': 1,
        '3B': 8,
        '3C': 4,
        '3D': 5,
        '3E': 3,
        '3F': 3,
        '4|LISTE DES FILIALES ET PARTICIPATIONS': 6,
        '13': 6,
        '15A': 7,
        '15B': 6,
        '16B|HYPOTHÈSES ACTUARIELLES': 2,
        '16B|VARIATION DE LA VALEUR DE L\'ENGAGEMENT DE RETRAITE AU COURS DE L\'EXERCICE': 2,
        '16B|ANALYSE DE SENSIBILITÉ DES HYPOTHÈSES ACTUARIELLES': 4,
        '16B bis|ACTIF/PASSIF NET COMPTABILISÉ AU TITRE DES RÉGIMES FINANCÉS': 2,
        '16B bis|VALEUR ACTUELLE DES ACTIFS DU RÉGIME': 4,
        '16C|ACTIF ÉVENTUEL': 2,
        '16C|PASSIF ÉVENTUEL': 2,
        '27B|1. Personnel propre': 16,
        '27B|2. Personnel extérieur': 16,
        '31': 5,
        '32': 15,
        '33': 9,
        '34': 3,
        '35': 1,
        '36': 2,
    },
};
describe('rubriques de notes en saisie · ancrage du stockage', () => {
    it.each(JEUX)('%s · toute rubrique en saisie porte une clé', (_jeu, table) => {
        const sansCle = table.flatMap((n) => n.rubriques.filter((r) => r.saisie && !r.cle).map((r) => `${etiquette(n)} :: ${r.libelle}`));
        expect(sansCle).toEqual([]);
    });
    it.each(JEUX)('%s · les clés sont uniques DANS UN CODE, sous-tableaux compris', (_jeu, table) => {
        const vues = new Map();
        const collisions = [];
        for (const n of table) {
            for (const r of n.rubriques) {
                if (!r.cle)
                    continue;
                const ancre = `${n.code}::${r.cle}`;
                if (vues.has(ancre))
                    collisions.push(`${ancre} · ${vues.get(ancre)} et ${etiquette(n)}`);
                vues.set(ancre, etiquette(n));
            }
        }
        expect(collisions).toEqual([]);
    });
    it.each(JEUX)('%s · une rubrique en saisie n’ouvre jamais un rattachement', (_jeu, table) => {
        const ambigues = table.flatMap((n) => n.rubriques.filter((r) => r.saisie && r.subdivisionAttendue).map((r) => `${etiquette(n)} :: ${r.libelle}`));
        expect(ambigues).toEqual([]);
    });
    it.each(JEUX)('%s · le nombre de colonnes des tableaux en saisie est celui qui est gelé', (jeu, table) => {
        const reel = {};
        for (const n of table) {
            if (!stockeDesSaisies(n))
                continue;
            reel[etiquette(n)] = n.colonnes.length;
        }
        expect(reel).toEqual(COLONNES_GELEES[jeu]);
    });
});
describe('cellules LIBRE d’une rubrique chiffrée · ce qui s’ouvre et ce qui reste fermé', () => {
    it.each(JEUX)('%s · une colonne ouverte à la saisie est LIBRE, jamais la colonne « Note »', (_jeu, table) => {
        const fautives = table.flatMap((n) => n.colonnes
            .filter((c) => c.saisieSurLigneChiffree && (c.type !== 'LIBRE' || /^note$/i.test(c.libelle)))
            .map((c) => `${etiquette(n)} :: ${c.libelle}`));
        expect(fautives).toEqual([]);
    });
    it.each(JEUX)('%s · chaque ligne de détail d’un tableau ouvert porte sa clé, aucun total ne s’ouvre', (_jeu, table) => {
        const sansAncre = [];
        const totauxOuverts = [];
        for (const n of table) {
            if (!n.colonnes.some(cellules_libres_en_saisie_1.colonneLibreEnSaisie))
                continue;
            for (const r of n.rubriques) {
                if (r.totalDeRubriques && (0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(n, r))
                    totauxOuverts.push(`${etiquette(n)} :: ${r.libelle}`);
                if (!r.totalDeRubriques && !r.saisie && !r.cle)
                    sansAncre.push(`${etiquette(n)} :: ${r.libelle}`);
            }
        }
        expect({ sansAncre, totauxOuverts }).toEqual({ sansAncre: [], totauxOuverts: [] });
    });
    it('la note 1 ouvre ses trois colonnes de sûretés, et elles seules, dans les deux référentiels', () => {
        const ouvertes = (table, sousTableau) => table
            .find((n) => n.code === '1' && n.sousTableau === sousTableau)
            .colonnes.map((c, i) => ((0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)(c) ? i : -1))
            .filter((i) => i >= 0);
        expect(ouvertes(correspondance_notes_associations_1.NOTES_ASSOCIATIONS, 'DETTES GARANTIES PAR DES SURETES REELLES')).toEqual([2, 3, 4]);
        expect(ouvertes(correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1, 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES')).toEqual([2, 3, 4]);
    });
    it.each(JEUX)('%s · les clés du code 1 sont uniques sur ses sous-tableaux, dettes garanties comprises', (_jeu, table) => {
        const note1 = table.filter((n) => n.code === '1');
        const cles = note1.flatMap((n) => n.rubriques.map((r) => r.cle).filter(Boolean));
        expect(cles.length).toBe(new Set(cles).size);
    });
    it('la note 1 porte au moins deux sous-tableaux à clés · le test d’unicité ci-dessus mord', () => {
        for (const table of [correspondance_notes_associations_1.NOTES_ASSOCIATIONS, correspondance_notes_syscohada_1_1.NOTES_SYSCOHADA_1]) {
            const aCles = table.filter((n) => n.code === '1' && n.rubriques.some((r) => r.cle));
            expect(aCles.length).toBeGreaterThanOrEqual(2);
        }
    });
    const MOTIF_RENVOI = 'porte le renvoi de la ligne (`renvoi`), fixé par la spécification';
    const MOTIF_MONTANT = 'MONTANT mal typé : saisi sur une ligne chiffrée, il ferait une seconde source à côté de A/B/C/D';
    const MOTIF_DEVISE = 'une ligne par sens d’écart, pas par devise · le texte veut le détail par devise, que la saisie par ligne ne porte pas';
    const MOTIF_PAR_PERSONNE = 'le texte veut une ligne par membre ou apporteur ; la ligne chiffrée agrège par nature';
    const VIDES_MOTIVEES = {
        ASSOCIATIONS_ORDRES_PROFESSIONNELS: {
            '1|DETTES GARANTIES PAR DES SURETES REELLES :: Note': MOTIF_RENVOI,
            '5D :: D · Virements de poste à poste': MOTIF_MONTANT,
            '5E :: D · Virements de poste à poste': MOTIF_MONTANT,
            '14 :: Devises': MOTIF_DEVISE,
            '14 :: Montant en devises': MOTIF_DEVISE,
            '14 :: Cours UML Année acquisition': MOTIF_DEVISE,
            '14 :: Cours UML 31/12': MOTIF_DEVISE,
            '15 :: Nom et prénoms des membres': MOTIF_PAR_PERSONNE,
            '15 :: Nationalité': MOTIF_PAR_PERSONNE,
            '15 :: Préciser avec ou sans droit de reprise': 'se lit au compte (renvoi officiel de la note : 101 sans droit de reprise, 102 avec), et le texte veut une ligne par membre',
            '17A :: Note': MOTIF_RENVOI,
            '17B :: Note': MOTIF_RENVOI,
        },
        PROJETS_DEVELOPPEMENT: {
            '8 :: Devises': MOTIF_DEVISE,
            '8 :: Montant en devises': MOTIF_DEVISE,
            '8 :: Cours UML Année acquisition': MOTIF_DEVISE,
            '8 :: Cours UML 31/12': MOTIF_DEVISE,
            '8 :: Variation en %': MOTIF_DEVISE,
        },
        SYSCOHADA_SYSTEME_NORMAL: {
            '1|DETTES GARANTIES PAR DES SÛRETÉS RÉELLES :: Note': MOTIF_RENVOI,
            '12|ÉCARTS DE CONVERSION :: Devises': MOTIF_DEVISE,
            '12|ÉCARTS DE CONVERSION :: Montant en devises': MOTIF_DEVISE,
            '12|ÉCARTS DE CONVERSION :: Cours UML Année acquisition': MOTIF_DEVISE,
            '12|ÉCARTS DE CONVERSION :: Cours UML 31/12': MOTIF_DEVISE,
            '13 :: Nom et prénoms': MOTIF_PAR_PERSONNE,
            '13 :: Nationalité': MOTIF_PAR_PERSONNE,
            '13 :: Nature des actions ou parts (Ordinaires ou préférences)': MOTIF_PAR_PERSONNE,
            '13 :: Nombre': MOTIF_PAR_PERSONNE,
            "13 :: Cessions ou remboursements en cours d'exercice": MOTIF_MONTANT,
            '15A :: NOTE': MOTIF_RENVOI,
            '15B :: NOTE': MOTIF_RENVOI,
        },
    };
    it.each(JEUX)('%s · toute colonne LIBRE d’un tableau chiffré est ouverte, ou vide sous un motif écrit', (jeu, table) => {
        const videsReelles = [];
        for (const n of table) {
            if (!n.rubriques.some((r) => !r.saisie && !r.totalDeRubriques))
                continue;
            for (const c of n.colonnes) {
                if (c.type === 'LIBRE' && !(0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)(c))
                    videsReelles.push(`${etiquette(n)} :: ${c.libelle}`);
            }
        }
        expect(videsReelles.sort()).toEqual(Object.keys(VIDES_MOTIVEES[jeu]).sort());
    });
});
//# sourceMappingURL=rubriques-en-saisie.spec.js.map
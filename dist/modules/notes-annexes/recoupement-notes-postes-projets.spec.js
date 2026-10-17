"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const correspondance_projet_bilan_1 = require("../etats-financiers/correspondance-projet-bilan");
const correspondance_projet_compte_exploitation_1 = require("../etats-financiers/correspondance-projet-compte-exploitation");
const etat_etafi_1 = require("../exports/etat-etafi");
const compte_seed_1 = require("../comptes/compte-seed");
const COMPTES_SEMIS = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL').map((c) => c.numero);
const capte = (o, n) => (o.comptes ?? []).some((p) => n.startsWith(p)) && !(o.exclusions ?? []).some((e) => n.startsWith(e));
function sensDuPoste(p, n) {
    if (p.ref === 'DW' && ['52', '53'].some((x) => n.startsWith(x)))
        return ['C'];
    if (!capte(p, n))
        return [];
    if ((p.comptesTransferesSiCrediteur ?? []).some((x) => n.startsWith(x)))
        return ['D'];
    if (p.sens_qualificatif === 'DEBITEUR')
        return ['D'];
    if (p.sens_qualificatif === 'CREDITEUR')
        return ['C'];
    return ['D', 'C'];
}
function sensDeLaRubrique(r, n) {
    if (!capte(r, n))
        return [];
    if (r.sens === 'DEBITEUR')
        return ['D'];
    if (r.sens === 'CREDITEUR')
        return ['C'];
    return ['D', 'C'];
}
const POSTES = new Map();
for (const p of [...correspondance_projet_bilan_1.POSTES_ACTIF, ...correspondance_projet_bilan_1.POSTES_PASSIF])
    POSTES.set(p.ref, (n) => sensDuPoste(p, n));
POSTES.set('DW', (n) => sensDuPoste(correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DW'), n));
for (const p of correspondance_projet_compte_exploitation_1.TOUS_LES_POSTES) {
    POSTES.set(etat_etafi_1.CLE_ETAFI_PAR_CLE_PROJET[p.cle] ?? p.cle, (n) => (capte(p, n) ? ['D', 'C'] : []));
}
function ecartsParNote() {
    const resultat = {};
    const codes = [...new Set(Object.values(etat_etafi_1.NOTE_PAR_CLE_PROJETS).flatMap((v) => v.split(' et ')))];
    for (const code of codes) {
        const cles = Object.entries(etat_etafi_1.NOTE_PAR_CLE_PROJETS)
            .filter(([, v]) => v.split(' et ').includes(code))
            .map(([k]) => k);
        const rubriques = correspondance_notes_projets_1.NOTES_PROJETS.filter((n) => n.code === code && !n.horsBalance)
            .flatMap((n) => n.rubriques)
            .filter((r) => (r.comptes ?? []).length > 0);
        if (rubriques.length === 0)
            continue;
        const manquants = new Set();
        for (const n of COMPTES_SEMIS) {
            for (const cle of cles) {
                if ((POSTES.get(cle)?.(n) ?? []).length === 0)
                    continue;
                if (!rubriques.some((r) => sensDeLaRubrique(r, n).length > 0))
                    manquants.add(n);
            }
        }
        if (manquants.size)
            resultat[code] = [...manquants].sort();
    }
    return resultat;
}
function horsPosteParNote() {
    const resultat = {};
    const codes = [...new Set(Object.values(etat_etafi_1.NOTE_PAR_CLE_PROJETS).flatMap((v) => v.split(' et ')))];
    for (const code of codes) {
        const cles = Object.entries(etat_etafi_1.NOTE_PAR_CLE_PROJETS)
            .filter(([, v]) => v.split(' et ').includes(code))
            .map(([k]) => k);
        const rubriques = correspondance_notes_projets_1.NOTES_PROJETS.filter((n) => n.code === code && !n.horsBalance)
            .flatMap((n) => n.rubriques)
            .filter((r) => (r.comptes ?? []).length > 0);
        const hors = COMPTES_SEMIS.filter((n) => rubriques.some((r) => capte(r, n)) && !cles.some((cle) => (POSTES.get(cle)?.(n) ?? []).length > 0));
        if (hors.length)
            resultat[code] = hors.sort();
    }
    return resultat;
}
describe('SYCEBNL projets · les comptes d’un poste et ceux de la note qui le détaille', () => {
    it('les comptes qu’un poste prend et qu’aucune ligne chiffrée de sa note ne reprend sont GELÉS, un par un', () => {
        expect(ecartsParNote()).toEqual({
            '4': ['49980000'],
            '5': ['34100000', '34500000', '36310000', '36320000', '36380000', '60310000', '60320000', '60330000', '60340000', '60350000'],
            '11': ['18100000', '19200000'],
            '12': [
                '42110000', '42120000', '42130000', '42870000', '43870000', '47110000', '47120000', '47130000', '47170000',
                '47190000', '47210000', '47260000', '47310000', '47320000', '47330000', '47380000', '47390000', '47460000',
                '47470000', '47500000', '47600000', '47700000',
            ],
            '14': ['70520000', '70530000', '70540000', '70550000'],
            '15': [
                '60210000', '60220000', '60230000', '60250000', '60290000', '60450000', '60460000', '60470000', '60490000',
                '60550000', '60570000', '60580000', '60590000', '60610000', '60620000', '60630000', '60640000', '60680000',
            ],
            '16': ['61900000'],
            '17': ['63600000'],
            '19': ['65120000', '65200000'],
            '20A': ['66500000'],
            '21': ['67810000', '67820000'],
            '23': [
                '81100000', '81200000', '81600000', '81800000', '82100000', '82200000', '82600000', '82800000', '83800000',
                '84600000', '85100000', '85200000', '85300000', '85400000', '85800000', '87000000',
            ],
        });
    });
    it('en sens inverse · les comptes qu’une note lit et qu’aucun poste qui la renvoie ne prend', () => {
        expect(horsPosteParNote()).toEqual({
            '4': ['48810000', '49850000', '49880000'],
            '5': ['39100000', '39200000', '39300000', '39600000', '39700000'],
            '6': ['49000000', '49110000', '49120000', '49200000', '49300000', '49400000', '49700000'],
            '7': ['59200000', '59300000', '59500000'],
            '21': [
                '77120000', '77130000', '77210000', '77220000', '77300000', '77450000', '77460000', '77470000', '77480000',
                '77600000', '77700000', '77910000', '77950000', '77980000', '78700000',
            ],
        });
    });
    it('chaque lacune du modèle de note est DITE au lecteur, sur la note (precisionEditeur)', () => {
        const attendu = [
            ['ACTIF CIRCULANT HAO', ['488']],
            ['DETTES CIRCULANTES HAO', ['4998']],
            ['STOCKS ET ENCOURS', ['34', '363']],
            ['DETTES FINANCIERES ET RESSOURCES ASSIMILEES', ['181', '192']],
            ['DETTES FOURNISSEURS ET ASSIMILEES, FISCALES ET SOCIALES', ['47']],
            ["BANQUES, CREDIT D'ESCOMPTE ET DE TRESORERIE", ['53']],
            ['ACHATS', ['606']],
            ['SERVICES EXTERIEURS', ['636']],
            ['AUTRES CHARGES', ['6512', '652']],
            ['CHARGES DE PERSONNEL', ['665']],
            ['CHARGES ET REVENUS FINANCIERS', ['678']],
            ['AUTRES CHARGES ET PRODUITS HAO', ['81', '838', '85', '87', '82', '846']],
        ];
        for (const [titre, comptes] of attendu) {
            const note = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.titre === titre);
            for (const c of comptes) {
                expect([titre, c, new RegExp(`\\b${c}\\b`).test(note.precisionEditeur ?? '')]).toEqual([titre, c, true]);
            }
        }
    });
});
describe('SYCEBNL projets · note 13, les 53 créditeurs de DW', () => {
    it('la ligne « Autres Banques » lit les 53 au CRÉDIT, comme la note 22 des associations', () => {
        const note = correspondance_notes_projets_1.NOTES_PROJETS.find((n) => n.code === '13');
        const autres = note.rubriques.find((r) => r.libelle === 'Autres Banques');
        expect(autres.comptes).toContain('53');
        expect(autres.sens).toBe('CREDITEUR');
        expect(note.precisionEditeur).toContain('La ligne « Autres Banques » comprend aussi les comptes 53');
    });
});
//# sourceMappingURL=recoupement-notes-postes-projets.spec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NIVEAUX_TFT_SYSCOHADA = exports.REP_TFT_SYSCOHADA = exports.NOTE_PAR_REF_SYSCOHADA = exports.NIVEAUX_ETAT_SYSCOHADA = exports.TOTAUX_SYSCOHADA = exports.NIVEAUX_RECONCILIATION = exports.NIVEAUX_TER = exports.TOTAUX_TER = exports.NOTE_PAR_CLE_PROJETS = exports.NIVEAUX_ETAT_PROJETS = exports.TOTAUX_PROJETS_CE = exports.CLE_ETAFI_PAR_CLE_PROJET = exports.TOTAUX_PROJETS_BILAN = exports.ENTETES_VENTILATION_ECHEANCE = exports.NIVEAUX_TFT = exports.REP_TFT = exports.NOTE_PAR_REF_ASSOCIATIONS = exports.NIVEAUX_ETAT_ASSOCIATIONS = exports.TOTAUX_ASSOCIATIONS = void 0;
exports.construireFeuilleEtat = construireFeuilleEtat;
exports.ligneControleSousEtat = ligneControleSousEtat;
exports.ecrireVentilationEcheance = ecrireVentilationEcheance;
exports.texteControleEcheances = texteControleEcheances;
const theme_etafi_1 = require("./theme-etafi");
const correspondance_bilan_syscohada_1 = require("../etats-financiers-syscohada/correspondance-bilan-syscohada");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("../etats-financiers-syscohada/correspondance-tft-syscohada");
exports.TOTAUX_ASSOCIATIONS = {
    AA: 'AB+AC',
    AD: 'AE+AF+AG',
    AH: 'AI+AJ+AK+AL+AM+AN',
    AO: 'AX+AY',
    AZ: 'AA+AD+AH+AO',
    BT: 'BA+BB+BC+BD+BE',
    BX: 'BU+BV+BW',
    BZ: 'AZ+BT+BX+BY',
    CK: 'CA+CB+CC+CD+CE+CF+CG+CH+CI+CJ',
    CY: 'CW+CX',
    CZ: 'CK+CY',
    DD: 'DA+DB+DC',
    DE: 'CZ+DD',
    DV: 'DF+DG+DH+DI',
    DX: 'DW',
    DZ: 'DE+DV+DX+DY',
    XA: 'RA+RB+RC+RD+RE+RF+RG+RH',
    XB: 'TA+TB+TC+TD+TE+TF+TG+TH+TI+TJ+TK+TL',
    XC: 'XA-XB',
    XD: 'TM-TN',
    XE: 'XC+XD',
};
exports.NIVEAUX_ETAT_ASSOCIATIONS = {
    AA: 'rubrique',
    AD: 'rubrique',
    AH: 'rubrique',
    AO: 'inter',
    AZ: 'section',
    BT: 'section',
    BX: 'section',
    BZ: 'general',
    CK: 'inter',
    CY: 'inter',
    CZ: 'inter',
    DD: 'inter',
    DE: 'section',
    DV: 'section',
    DX: 'section',
    DZ: 'general',
    XA: 'section',
    XB: 'section',
    XC: 'inter',
    XD: 'inter',
    XE: 'section',
};
exports.NOTE_PAR_REF_ASSOCIATIONS = {
    AA: 'note 5',
    AD: 'note 5',
    AE: 'note 5F',
    AH: 'note 5',
    AO: 'note 6',
    BA: 'note 7',
    BB: 'note 8',
    BC: 'note 19',
    BD: 'note 9',
    BE: 'note 10',
    BU: 'note 11',
    BV: 'note 12',
    BW: 'note 13',
    BY: 'note 14',
    CA: 'note 15',
    CB: 'note 15',
    CC: 'note 15',
    CD: 'note 15',
    CE: 'note 5F',
    CF: 'note 16',
    CG: 'note 16',
    CI: 'note 17A',
    CJ: 'note 17A',
    CW: 'note 17B',
    CX: 'note 17B',
    DA: 'note 18A',
    DB: 'note 18A',
    DC: 'note 18A',
    DF: 'note 7',
    DG: 'note 9',
    DH: 'note 19',
    DI: 'note 20 et 21',
    DW: 'note 22',
    DY: 'note 14',
    RA: 'note 23',
    RB: 'note 23',
    RC: 'note 23',
    RD: 'note 23',
    RE: 'note 23',
    RF: 'note 23',
    RG: 'note 23',
    RH: 'note 5D et 30',
    TA: 'note 24',
    TB: 'note 8',
    TC: 'note 24',
    TD: 'note 24',
    TE: 'note 8',
    TF: 'note 25',
    TG: 'note 26',
    TH: 'note 27',
    TI: 'note 28',
    TJ: 'note 29',
    TK: 'note 31',
    TL: 'note 5D et 30',
    TM: 'note 32',
    TN: 'note 32',
};
exports.REP_TFT = { ZA: 'A', ZB: 'B', ZC: 'C', ZD: 'D', ZE: 'E', ZF: 'G', ZG: 'H' };
exports.NIVEAUX_TFT = {
    ZA: 'cle',
    ZB: 'section',
    ZC: 'section',
    ZD: 'inter',
    ZE: 'inter',
    ZF: 'cle',
    ZG: 'cle',
};
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function construireFeuilleEtat(wb, options) {
    const ws = wb.addWorksheet(options.nom);
    const nbMontants = options.groupes.reduce((n, g) => n + g.sousTitres.length, 0);
    const ncols = 3 + nbMontants;
    (0, theme_etafi_1.ecrireCartouche)(ws, options.ident, options.pageRef ?? options.titre, ncols);
    (0, theme_etafi_1.titreEtat)(ws, options.titre, 2, ncols - 1, 7, options.taille ?? 14);
    ws.getCell(8, 1).value = 'REF';
    ws.getCell(8, 2).value = options.libelleColonne;
    ws.getCell(8, 3).value = 'NOTE';
    for (const c of [1, 2, 3])
        (0, theme_etafi_1.fusion)(ws, 8, c, 9, c);
    let colonne = 4;
    for (const groupe of options.groupes) {
        const debut = colonne;
        ws.getCell(8, debut).value = groupe.titre;
        if (groupe.sousTitres.length > 1)
            (0, theme_etafi_1.fusion)(ws, 8, debut, 8, debut + groupe.sousTitres.length - 1);
        for (const sous of groupe.sousTitres) {
            ws.getCell(9, colonne).value = sous;
            colonne += 1;
        }
    }
    (0, theme_etafi_1.entetesBande)(ws, 8, 9, 1, ncols);
    ws.getRow(8).height = 22;
    ws.getRow(9).height = 22;
    ws.getCell(8, 2).font = { name: 'Arial Black', size: 11, bold: true };
    let r = 9;
    const colsMontant = Array.from({ length: nbMontants }, (_, i) => 4 + i);
    const refVersRang = new Map();
    for (const ligne of options.lignes) {
        r += 1;
        refVersRang.set(ligne.cle ?? ligne.ref, r);
        ws.getCell(r, 1).value = ligne.ref;
        ws.getCell(r, 2).value = ligne.libelle;
        ws.getCell(r, 3).value = ligne.note;
        const estTotal = Boolean(options.totaux?.[ligne.cle ?? ligne.ref]);
        if (!estTotal) {
            for (const [i, montant] of ligne.montants.entries()) {
                if (montant === null || montant === undefined)
                    continue;
                ws.getCell(r, 4 + i).value =
                    typeof montant === 'number' ? montant : { formula: montant.formule.replace(/\{r\}/g, String(r)) };
            }
        }
        (0, theme_etafi_1.styleLigne)(ws, r, 1, ncols, ligne.niveau, colsMontant, 1);
        ws.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(r).height = 22;
    }
    for (const [ref, expression] of Object.entries(options.totaux ?? {})) {
        const rang = refVersRang.get(ref);
        if (!rang)
            continue;
        for (const col of colsMontant) {
            const lettre = LETTRES[col - 1];
            const formule = expression.replace(/[A-Z][A-Z0-9]*/g, (composante) => {
                const rr = refVersRang.get(composante);
                return rr ? `${lettre}${rr}` : '0';
            });
            ws.getCell(rang, col).value = { formula: formule };
        }
    }
    (0, theme_etafi_1.cadre)(ws, 8, 1, r, ncols, theme_etafi_1.MOYEN);
    const spec = { A: 5.5, B: options.largeurLibelle ?? 52, C: 6.5 };
    for (const col of colsMontant)
        spec[LETTRES[col - 1]] = 15.7;
    (0, theme_etafi_1.largeurs)(ws, spec);
    ws.views = [{ state: 'frozen', ySplit: 9, showGridLines: false }];
    return refVersRang;
}
function ligneControleSousEtat(ws, rang, texte) {
    const c = ws.getCell(rang, 1);
    c.value = texte;
    c.font = { ...theme_etafi_1.F_DONNEE, size: 8, italic: true };
    c.alignment = theme_etafi_1.AL_GAUCHE;
}
exports.ENTETES_VENTILATION_ECHEANCE = [
    'Dont non échu au 31/12/N',
    'Dont échu au 31/12/N',
    'Part non ventilée · signal de tenue',
];
const NOTE_PART_NON_VENTILEE = "Part du solde qu'aucune date d'échéance ne permet de qualifier : ni échue, ni non échue. Ce n'est pas une " +
    "catégorie de créance ou de dette, c'est ce que la tenue n'a pas daté. Saisir la date d'échéance des lignes de " +
    'tiers, et tenir ces comptes en report à-nouveau mode DÉTAIL.';
const NOTE_PART_NON_VENTILEE_NEGATIVE = 'Part non ventilée NÉGATIVE · un règlement non lettré fait face à une facture datée. Signal de tenue, pas un ' +
    "montant : rien n'est dû ni recouvrable de ce fait. Lettrer les mouvements du compte pour la résorber.";
function ecrireVentilationEcheance(ws, rang, colDebut, v) {
    ws.getCell(rang, colDebut).value = v.nonEchu;
    ws.getCell(rang, colDebut + 1).value = v.echu;
    const c = ws.getCell(rang, colDebut + 2);
    c.value = v.nonVentile;
    if (Math.abs(v.nonVentile) < 0.005)
        return;
    c.note = v.nonVentile < -0.005 ? NOTE_PART_NON_VENTILEE_NEGATIVE : NOTE_PART_NON_VENTILEE;
}
function texteControleEcheances(motif, creancesNonVentilees, dettesNonVentilees) {
    const phrases = [
        motif ??
            "Ventilation complète : toute ligne de tiers non lettrée porte une date d'échéance, les colonnes « dont non " +
                "échu » et « dont échu » couvrent donc l'intégralité des soldes.",
    ];
    if (creancesNonVentilees < -0.005 || dettesNonVentilees < -0.005)
        phrases.push(NOTE_PART_NON_VENTILEE_NEGATIVE);
    return phrases.join(' ');
}
exports.TOTAUX_PROJETS_BILAN = {
    AZ: 'AA+AB+AC+AD+AE+AF+AG+AH',
    BF: 'BA+BB+BC+BD+BE',
    BX: 'BV+BW',
    BZ: 'AZ+BF+BX+BY',
    CZ: 'CA+CB+CC+CD',
    DC: 'DA+DB',
    DD: 'CZ+DC',
    DJ: 'DE+DF+DG+DH+DI',
    DX: 'DW',
    DZ: 'DD+DJ+DX+DY',
};
exports.CLE_ETAFI_PAR_CLE_PROJET = {
    TJ_PERSONNEL: 'TJ',
    TK_FRAIS_FINANCIERS: 'TK',
    TJ_DOTATIONS_PROVISIONS: 'TJ2',
    TK_PRODUITS_HAO: 'TK2',
};
exports.TOTAUX_PROJETS_CE = {
    XA: 'RA+RB+RC+RD+RE',
    XB: 'TA+TB+TC+TD+TG+TH+TI+TJ+TK+TJ2-TK2+TL',
    XC: 'XA-XB',
};
exports.NIVEAUX_ETAT_PROJETS = {
    AZ: 'section',
    BF: 'section',
    BX: 'section',
    BZ: 'general',
    CZ: 'inter',
    DC: 'inter',
    DD: 'section',
    DJ: 'section',
    DX: 'section',
    DZ: 'general',
    XA: 'section',
    XB: 'section',
    XC: 'section',
};
exports.NOTE_PAR_CLE_PROJETS = {
    AA: '3A',
    AB: '3A',
    AC: '3A',
    AD: '3A',
    AE: '3A',
    AF: '3A',
    AG: '3A',
    AH: '3A',
    BA: '4',
    BB: '5',
    BC: '6',
    BD: '6',
    BE: '6',
    BV: '7',
    BW: '7',
    BY: '8',
    CA: '9',
    CD: '10',
    DA: '11',
    DB: '11',
    DE: '4',
    DF: '9',
    DG: '12',
    DH: '12',
    DW: '13',
    DY: '8',
    RA: '9',
    RB: '14',
    RC: '14',
    RD: '14',
    RE: '22',
    TA: '15',
    TB: '15',
    TC: '5',
    TD: '16',
    TG: '17',
    TH: '18',
    TI: '19',
    TJ: '20A',
    TK: '21',
    TJ2: '22',
    TK2: '23',
    TL: '23',
};
exports.TOTAUX_TER = {
    GR: 'FA+FB+FC+FD',
    GS: 'FE+FF+FG+FH+FI+FJ+FK+FL',
    GT: 'FM+FN+FO+FP+FQ+FR+FS+FT',
    GU: 'GS+GT',
    GV: 'GR-GU',
    GW: 'FU+FV+FW',
    GX: 'GV+GW',
    GY: 'FX+FY+FZ',
    GZ: 'GX-GY',
};
exports.NIVEAUX_TER = {
    GR: 'section',
    GS: 'inter',
    GT: 'inter',
    GU: 'section',
    GV: 'cle',
    GW: 'section',
    GX: 'cle',
    GY: 'section',
    GZ: 'general',
};
exports.NIVEAUX_RECONCILIATION = { G: 'section', I: 'general' };
exports.TOTAUX_SYSCOHADA = (() => {
    const table = {};
    for (const t of [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA])
        table[t.ref] = t.deRefs.join('+');
    for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES)
        table[s.ref] = s.deRefs.join('+');
    return table;
})();
exports.NIVEAUX_ETAT_SYSCOHADA = {
    AD: 'rubrique',
    AI: 'rubrique',
    AP: 'rubrique',
    AQ: 'rubrique',
    AZ: 'section',
    BA: 'rubrique',
    BB: 'rubrique',
    BG: 'rubrique',
    BK: 'section',
    BT: 'section',
    BU: 'rubrique',
    BZ: 'general',
    CP: 'inter',
    DD: 'inter',
    DF: 'section',
    DP: 'section',
    DT: 'section',
    DV: 'rubrique',
    DZ: 'general',
    XA: 'inter',
    XB: 'inter',
    XC: 'inter',
    XD: 'inter',
    XE: 'inter',
    XF: 'inter',
    XG: 'section',
    XH: 'inter',
    XI: 'general',
};
exports.NOTE_PAR_REF_SYSCOHADA = (() => {
    const table = {};
    for (const p of [...correspondance_bilan_syscohada_1.POSTES_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.POSTES_PASSIF_SYSCOHADA]) {
        if (p.note)
            table[p.ref] = p.note;
    }
    for (const t of [...correspondance_bilan_syscohada_1.TOTAUX_ACTIF_SYSCOHADA, ...correspondance_bilan_syscohada_1.TOTAUX_PASSIF_SYSCOHADA]) {
        if (t.note)
            table[t.ref] = t.note;
    }
    const renvois = (notes) => notes.flatMap((n) => (0, correspondance_compte_resultat_syscohada_1.resoudreRenvoiNote)(n)).join(' et ');
    for (const p of correspondance_compte_resultat_syscohada_1.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
        if (p.notes.length)
            table[p.ref] = renvois(p.notes);
    }
    for (const s of correspondance_compte_resultat_syscohada_1.SOLDES_INTERMEDIAIRES) {
        if (s.notes.length)
            table[s.ref] = renvois(s.notes);
    }
    return table;
})();
exports.REP_TFT_SYSCOHADA = (() => {
    const table = { ZA: 'A' };
    for (const t of correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA) {
        if (t.cle)
            table[t.ref] = t.cle;
    }
    return table;
})();
exports.NIVEAUX_TFT_SYSCOHADA = {
    ZA: 'cle',
    ZB: 'section',
    ZC: 'section',
    ZD: 'inter',
    ZE: 'inter',
    ZF: 'section',
    ZG: 'cle',
    ZH: 'cle',
};
//# sourceMappingURL=etat-etafi.js.map
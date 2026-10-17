"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLONNES_BALANCE_FPM = exports.ENTETES_GRAND_LIVRE_FPM = exports.COLONNES_GRAND_LIVRE_FPM = exports.POLICE_LIEN = exports.LIGNE_ENTETE_FPM = exports.FOND_ENTETE_FPM = exports.FORMAT_DATE_FPM = exports.FORMAT_MONTANT_FPM = void 0;
exports.montantFpm = montantFpm;
exports.soldeEnDeuxColonnes = soldeEnDeuxColonnes;
exports.tirageAKinshasa = tirageAKinshasa;
exports.nomsDeFeuilles = nomsDeFeuilles;
exports.formuleLien = formuleLien;
exports.poserFeuilleFpm = poserFeuilleFpm;
exports.libelleAvantPeriode = libelleAvantPeriode;
exports.entetesBalanceFpm = entetesBalanceFpm;
const classeur_en_flux_1 = require("./classeur-en-flux");
exports.FORMAT_MONTANT_FPM = '#\\ ##0.00';
exports.FORMAT_DATE_FPM = 'dd\\/mm\\/yy';
exports.FOND_ENTETE_FPM = 'FF4F81BD';
const BLANC = 'FFFFFFFF';
const BLEU_LIEN = 'FF0000FF';
const POLICE = { name: 'Arial', size: 9 };
const FILET = { style: 'thin' };
exports.LIGNE_ENTETE_FPM = 8;
function montantFpm(n) {
    const a = Math.round(n * 100) / 100;
    return a === 0 ? null : a;
}
function soldeEnDeuxColonnes(solde) {
    const a = Math.round(solde * 100) / 100;
    return { debit: a > 0 ? a : null, credit: a < 0 ? -a : null };
}
function tirageAKinshasa(instant = new Date()) {
    const k = new Date(instant.getTime() + 60 * 60 * 1000);
    const d2 = (x) => String(x).padStart(2, '0');
    return (`${d2(k.getUTCDate())}/${d2(k.getUTCMonth() + 1)}/${d2(k.getUTCFullYear() % 100)} à ` +
        `${d2(k.getUTCHours())}:${d2(k.getUTCMinutes())}:${d2(k.getUTCSeconds())}`);
}
function nomsDeFeuilles(numeros, reserves) {
    const pris = new Set([...reserves, 'Historique', 'History'].map((n) => n.toLowerCase()));
    return numeros.map((numero) => {
        const base = (numero.replace(/[[\]:*?/\\']/g, '').trim() || 'Compte').slice(0, 31);
        let nom = base;
        for (let i = 2; pris.has(nom.toLowerCase()); i++) {
            const suffixe = `-${i}`;
            nom = `${base.slice(0, 31 - suffixe.length)}${suffixe}`;
        }
        pris.add(nom.toLowerCase());
        return nom;
    });
}
function formuleLien(feuille, cellule, texte) {
    const cible = `#'${feuille.replace(/'/g, "''")}'!${cellule}`;
    const echapper = (s) => s.replace(/"/g, '""');
    return { formula: `HYPERLINK("${echapper(cible)}","${echapper(texte)}")`, result: texte };
}
exports.POLICE_LIEN = { ...POLICE, color: { argb: BLEU_LIEN }, underline: true };
function filetsDe(c) {
    return { ...(c.filetGauche ? { left: FILET } : {}), ...(c.filetDroit ? { right: FILET } : {}) };
}
function styleDeColonne(c) {
    return {
        font: { ...POLICE },
        border: filetsDe(c),
        ...(c.genre === 'montant' ? { numFmt: exports.FORMAT_MONTANT_FPM, alignment: { horizontal: 'right' } } : {}),
        ...(c.genre === 'date' ? { numFmt: exports.FORMAT_DATE_FPM } : {}),
    };
}
function poserFeuilleFpm(classeur, sortie, p) {
    const n = p.colonnes.length;
    const derniereEntete = exports.LIGNE_ENTETE_FPM + p.lignesEntete - 1;
    const ident = (0, classeur_en_flux_1.segmentIdentification)(p.identite);
    const feuille = classeur.addWorksheet(p.nomFeuille, {
        views: [{ state: 'frozen', ySplit: derniereEntete }],
        properties: { defaultRowHeight: 12 },
        headerFooter: {
            oddFooter: `&L${p.identite.entite.replace(/&/g, '&&')}${ident ? ` · ${ident.replace(/&/g, '&&')}` : ''} · ` +
                `${p.identite.periode} · montants en ${p.identite.devise}` +
                `&RPage &P / &N · édité le ${new Date().toLocaleDateString('fr-FR')}`,
        },
    });
    feuille.columns = p.colonnes.map((c) => ({ key: c.cle, width: c.largeur, style: styleDeColonne(c) }));
    const milieu = Math.max(2, Math.ceil(n / 2));
    const avantDerniere = n - 1;
    const cart = (ligne, col) => {
        const cellule = ligne.getCell(col);
        cellule.border = {};
        cellule.alignment = {};
        cellule.font = { ...POLICE };
        cellule.numFmt = '@';
        return cellule;
    };
    const poser = (ligne, col, valeur, style = {}) => {
        const cellule = cart(ligne, col);
        cellule.value = valeur;
        if (style.font)
            cellule.font = style.font;
        if (style.alignment)
            cellule.alignment = style.alignment;
        if (style.numFmt)
            cellule.numFmt = style.numFmt;
    };
    const gras = { font: { ...POLICE, bold: true } };
    const aGauche = { horizontal: 'left' };
    const l1 = feuille.getRow(1);
    if (p.retour)
        poser(l1, 1, p.retour, { font: exports.POLICE_LIEN });
    l1.commit();
    const l2 = feuille.getRow(2);
    l2.height = 23;
    poser(l2, 1, p.identite.entite, gras);
    poser(l2, milieu, p.titre, { font: { name: 'Arial', size: 18, bold: true }, alignment: { horizontal: 'center' } });
    poser(l2, avantDerniere, 'Période du', gras);
    poser(l2, n, p.debut, { numFmt: exports.FORMAT_DATE_FPM, alignment: aGauche });
    l2.commit();
    const l3 = feuille.getRow(3);
    poser(l3, avantDerniere, 'au', gras);
    poser(l3, n, p.fin, { numFmt: exports.FORMAT_DATE_FPM, alignment: aGauche });
    l3.commit();
    const l4 = feuille.getRow(4);
    poser(l4, milieu, p.sousTitre, { ...gras, alignment: { horizontal: 'center' } });
    poser(l4, avantDerniere, `Tenue de compte : ${p.identite.devise}`);
    l4.commit();
    const l5 = feuille.getRow(5);
    l5.height = 13.2;
    for (let c = 1; c <= n; c++) {
        const cellule = cart(l5, c);
        cellule.value = null;
        cellule.border = { bottom: FILET };
    }
    l5.commit();
    const l6 = feuille.getRow(6);
    poser(l6, 1, 'OmegaX');
    poser(l6, milieu, `Date de tirage ${tirageAKinshasa()}`);
    poser(l6, avantDerniere, 'Page :', { alignment: { horizontal: 'right' } });
    poser(l6, n, 1, { numFmt: '0', alignment: aGauche });
    l6.commit();
    const l7 = feuille.getRow(7);
    if (p.mention)
        poser(l7, 1, p.mention, { font: { ...POLICE, italic: true, bold: true } });
    l7.commit();
    for (let r = 0; r < p.lignesEntete; r++) {
        const ligne = feuille.getRow(exports.LIGNE_ENTETE_FPM + r);
        if (r === 0 && p.lignesEntete === 2)
            ligne.height = 24;
        for (let c = 1; c <= n; c++) {
            const cellule = ligne.getCell(c);
            const col = p.colonnes[c - 1];
            cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: exports.FOND_ENTETE_FPM } };
            cellule.font = { ...POLICE, bold: true, color: { argb: BLANC } };
            cellule.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cellule.border = { ...filetsDe(col), ...(r === p.lignesEntete - 1 ? { bottom: FILET } : {}) };
            cellule.numFmt = '@';
        }
        for (const e of p.entetes.filter((x) => x.ligne === r))
            ligne.getCell(e.colonne).value = e.texte;
    }
    for (const e of p.entetes) {
        const haut = exports.LIGNE_ENTETE_FPM + e.ligne;
        const bas = e.surDeuxLignes ? haut + 1 : haut;
        const droite = e.jusquA ?? e.colonne;
        if (bas > haut || droite > e.colonne)
            feuille.mergeCells(haut, e.colonne, bas, droite);
    }
    for (let r = 0; r < p.lignesEntete; r++)
        feuille.getRow(exports.LIGNE_ENTETE_FPM + r).commit();
    let derniere = derniereEntete;
    const ajouter = async (valeurs, options = {}) => {
        const ligne = feuille.addRow(valeurs);
        p.colonnes.forEach((c, i) => {
            const cellule = ligne.getCell(i + 1);
            if (cellule.value === undefined)
                cellule.value = null;
            if (options.gras)
                cellule.font = { ...POLICE, bold: true };
            if (options.filetHaut)
                cellule.border = { ...filetsDe(c), top: FILET };
        });
        if (options.lien) {
            const cellule = ligne.getCell(options.lien.colonne);
            cellule.value = options.lien.valeur;
            cellule.font = { ...exports.POLICE_LIEN, ...(options.gras ? { bold: true } : {}) };
        }
        ligne.commit();
        derniere = ligne.number;
        if (sortie)
            await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
        return ligne.number;
    };
    return {
        feuille,
        ajouter,
        derniereLigne: () => derniere,
        premiereLigneDonnees: derniereEntete + 1,
        fermer: () => {
            const enFlux = feuille;
            if (typeof enFlux.commit === 'function')
                enFlux.commit();
        },
    };
}
exports.COLONNES_GRAND_LIVRE_FPM = [
    { cle: 'date', largeur: 9, genre: 'date', filetGauche: true, filetDroit: true },
    { cle: 'journal', largeur: 7, genre: 'texte', filetDroit: true },
    { cle: 'piece', largeur: 11, genre: 'texte' },
    { cle: 'libelle', largeur: 46, genre: 'texte', filetDroit: true },
    { cle: 'lettre', largeur: 7, genre: 'texte', filetDroit: true },
    { cle: 'debit', largeur: 15, genre: 'montant' },
    { cle: 'credit', largeur: 15, genre: 'montant', filetDroit: true },
    { cle: 'solde', largeur: 15, genre: 'montant', filetDroit: true },
];
exports.ENTETES_GRAND_LIVRE_FPM = [
    { colonne: 1, ligne: 0, texte: 'Date' },
    { colonne: 2, ligne: 0, texte: 'C.j' },
    { colonne: 3, ligne: 0, texte: 'N° pièce' },
    { colonne: 4, ligne: 0, texte: 'Libellé écriture' },
    { colonne: 5, ligne: 0, texte: 'Lettr.' },
    { colonne: 6, ligne: 0, texte: 'Mouvement débit' },
    { colonne: 7, ligne: 0, texte: 'Mouvement crédit' },
    { colonne: 8, ligne: 0, texte: 'Solde progressif' },
];
exports.COLONNES_BALANCE_FPM = [
    { cle: 'numero', largeur: 13, genre: 'texte', filetGauche: true, filetDroit: true },
    { cle: 'intitule', largeur: 40, genre: 'texte', filetDroit: true },
    { cle: 'avantDebit', largeur: 16, genre: 'montant' },
    { cle: 'avantCredit', largeur: 16, genre: 'montant', filetDroit: true },
    { cle: 'mouvementDebit', largeur: 16, genre: 'montant' },
    { cle: 'mouvementCredit', largeur: 16, genre: 'montant', filetDroit: true },
    { cle: 'soldeDebit', largeur: 16, genre: 'montant' },
    { cle: 'soldeCredit', largeur: 16, genre: 'montant', filetDroit: true },
];
function libelleAvantPeriode(debut) {
    const veille = new Date(debut.getTime() - 24 * 60 * 60 * 1000);
    const jj = String(veille.getUTCDate()).padStart(2, '0');
    const mm = String(veille.getUTCMonth() + 1).padStart(2, '0');
    const aa = String(veille.getUTCFullYear() % 100).padStart(2, '0');
    return `Mouvements au ${jj}/${mm}/${aa}`;
}
function entetesBalanceFpm(debut, libelleNumero, libelleIntitule) {
    return [
        { colonne: 1, ligne: 0, texte: libelleNumero, surDeuxLignes: true },
        { colonne: 2, ligne: 0, texte: libelleIntitule, surDeuxLignes: true },
        { colonne: 3, ligne: 0, texte: libelleAvantPeriode(debut), jusquA: 4 },
        { colonne: 5, ligne: 0, texte: 'Mouvements', jusquA: 6 },
        { colonne: 7, ligne: 0, texte: 'Soldes cumulés', jusquA: 8 },
        { colonne: 3, ligne: 1, texte: 'Débit' },
        { colonne: 4, ligne: 1, texte: 'Crédit' },
        { colonne: 5, ligne: 1, texte: 'Débit' },
        { colonne: 6, ligne: 1, texte: 'Crédit' },
        { colonne: 7, ligne: 1, texte: 'Débit' },
        { colonne: 8, ligne: 1, texte: 'Crédit' },
    ];
}
//# sourceMappingURL=presentation-fpm.js.map
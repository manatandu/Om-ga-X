"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOM_BALANCE_N1 = exports.NOM_BALANCE = exports.FMT_MONTANT = exports.AL_DROITE = exports.AL_GAUCHE = exports.AL_CENTRE = exports.B_SOULIGNE = exports.B_FIN = exports.B_DONNEE = exports.POINTILLE = exports.MOYEN = exports.FILET = exports.FIN = exports.F_VERDICT = exports.F_TITRE_NOTE = exports.F_TITRE_ETAT_M = exports.F_TITRE_ETAT = exports.F_ENTETE_COL = exports.F_PAGE_REF = exports.F_CARTOUCHE = exports.F_BLANC_G = exports.F_DONNEE_G = exports.F_DONNEE = exports.fond = exports.C_GARDE_TXT = exports.C_COUV = exports.C_PARTIE_TC = exports.C_CTRL_TITRE = exports.C_CTRL_ENT = exports.C_NOTE = exports.C_NAVY = exports.C_SECTION = exports.C_GRIS = exports.C_RUBRIQUE = exports.C_ENTETE = void 0;
exports.q = q;
exports.texteExercice = texteExercice;
exports.fusion = fusion;
exports.cadre = cadre;
exports.hauteurs = hauteurs;
exports.largeurs = largeurs;
exports.masquerQuadrillage = masquerQuadrillage;
exports.ecrireCartouche = ecrireCartouche;
exports.titreEtat = titreEtat;
exports.bandeNeant = bandeNeant;
exports.titreNote = titreNote;
exports.entetesBande = entetesBande;
exports.styleLigne = styleLigne;
exports.numeroterPages = numeroterPages;
exports.construireCouverture = construireCouverture;
exports.construireGarde = construireGarde;
exports.construireFiche1 = construireFiche1;
exports.construireFiche2 = construireFiche2;
exports.ecrireFeuilleBalance = ecrireFeuilleBalance;
exports.sommeColonneBalance = sommeColonneBalance;
exports.construireControleBalance = construireControleBalance;
exports.construireFicheNotes = construireFicheNotes;
exports.construireTableCommentaires = construireTableCommentaires;
exports.construireBilanPaysage = construireBilanPaysage;
const balance_fpm_1 = require("./balance-fpm");
const presentation_fpm_1 = require("./presentation-fpm");
exports.C_ENTETE = 'CCFFFF';
exports.C_RUBRIQUE = 'FFFFCC';
exports.C_GRIS = 'C0C0C0';
exports.C_SECTION = '008000';
exports.C_NAVY = '000080';
exports.C_NOTE = '003366';
exports.C_CTRL_ENT = 'CCFFCC';
exports.C_CTRL_TITRE = 'FFCC99';
exports.C_PARTIE_TC = 'CCCCFF';
exports.C_COUV = '660066';
exports.C_GARDE_TXT = 'CC99FF';
const argb = (hex) => ({ argb: `FF${hex}` });
const fond = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: argb(hex) });
exports.fond = fond;
exports.F_DONNEE = { name: 'Arial', size: 9 };
exports.F_DONNEE_G = { name: 'Arial', size: 9, bold: true };
exports.F_BLANC_G = { name: 'Arial', size: 9, bold: true, color: argb('FFFFFF') };
exports.F_CARTOUCHE = { name: 'Arial', size: 9 };
exports.F_PAGE_REF = { name: 'Arial', size: 8 };
exports.F_ENTETE_COL = { name: 'Arial', size: 9, bold: true };
exports.F_TITRE_ETAT = { name: 'Arial Black', size: 16, bold: true, color: argb(exports.C_SECTION) };
exports.F_TITRE_ETAT_M = { name: 'Arial Black', size: 14, bold: true, color: argb(exports.C_SECTION) };
exports.F_TITRE_NOTE = { name: 'Arial Black', size: 11, bold: true, color: argb(exports.C_NOTE) };
exports.F_VERDICT = { name: 'Arial Black', size: 10, bold: true, color: argb(exports.C_NAVY) };
const NOIR = { argb: 'FF000000' };
exports.FIN = { style: 'thin', color: NOIR };
exports.FILET = { style: 'hair', color: NOIR };
exports.MOYEN = { style: 'medium', color: NOIR };
exports.POINTILLE = { style: 'dashed', color: NOIR };
exports.B_DONNEE = { top: exports.FILET, bottom: exports.FILET, left: exports.FIN, right: exports.FIN };
exports.B_FIN = { top: exports.FIN, bottom: exports.FIN, left: exports.FIN, right: exports.FIN };
exports.B_SOULIGNE = { bottom: exports.POINTILLE };
exports.AL_CENTRE = { horizontal: 'center', vertical: 'middle', wrapText: true };
exports.AL_GAUCHE = { horizontal: 'left', vertical: 'middle', wrapText: true };
exports.AL_DROITE = { horizontal: 'right', vertical: 'middle' };
exports.FMT_MONTANT = '_-* #,##0\\ _€_-;\\-* #,##0\\ _€_-;_-* "-"\\ _€_-;_-@_-';
exports.NOM_BALANCE = 'BALANCE N';
exports.NOM_BALANCE_N1 = 'BALANCE N-1';
function q(nom) {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nom))
        return nom;
    return `'${nom.replace(/'/g, "''")}'`;
}
function texteExercice(exercice) {
    const ex = (exercice ?? '').trim();
    if (/^\d{4}$/.test(ex))
        return `Exercice clos le 31-12-${ex}`;
    return ex ? `Exercice clos le ${ex}` : 'Exercice clos le';
}
function fusion(ws, r1, c1, r2, c2) {
    if (r1 !== r2 || c1 !== c2)
        ws.mergeCells(r1, c1, r2, c2);
}
function cadre(ws, r1, c1, r2, c2, cote = exports.MOYEN) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const b = { ...(cell.border ?? {}) };
            if (r === r1)
                b.top = cote;
            if (r === r2)
                b.bottom = cote;
            if (c === c1)
                b.left = cote;
            if (c === c2)
                b.right = cote;
            cell.border = b;
        }
    }
}
function hauteurs(ws, spec) {
    for (const [r, h] of Object.entries(spec))
        ws.getRow(Number(r)).height = h;
}
function largeurs(ws, spec) {
    for (const [lettre, l] of Object.entries(spec))
        ws.getColumn(lettre).width = l;
}
function masquerQuadrillage(ws) {
    ws.views = ws.views?.length ? ws.views.map((v) => ({ ...v, showGridLines: false })) : [{ showGridLines: false }];
}
function ecrireCartouche(ws, ident, pageRef, colMax) {
    masquerQuadrillage(ws);
    let c = ws.getCell(1, 1);
    c.value = '- 0 -';
    c.font = { name: 'Arial', size: 10 };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.numFmt = '@';
    const cRef = Math.max(2, colMax - 1);
    fusion(ws, 2, cRef, 2, colMax);
    c = ws.getCell(2, cRef);
    c.value = pageRef;
    c.font = exports.F_PAGE_REF;
    c.alignment = exports.AL_CENTRE;
    c.numFmt = '@';
    for (let cc = cRef; cc <= colMax; cc++)
        ws.getCell(2, cc).border = { top: exports.FIN, bottom: exports.FIN, left: exports.FIN };
    c = ws.getCell(3, 1);
    c.value = `Dénomination sociale : ${ident.entite}`.trimEnd();
    c.font = exports.F_CARTOUCHE;
    ws.getCell(4, 1).value = 'Adresse :';
    ws.getCell(4, 1).font = exports.F_CARTOUCHE;
    const finAdr = Math.max(2, colMax - 3);
    fusion(ws, 4, 2, 4, finAdr);
    c = ws.getCell(4, 2);
    c.value = ident.adresse;
    c.font = exports.F_CARTOUCHE;
    for (let cc = 2; cc <= finAdr; cc++)
        ws.getCell(4, cc).border = exports.B_SOULIGNE;
    c = ws.getCell(4, Math.max(3, colMax - 1));
    c.value = 'Sigle usuel :';
    c.font = exports.F_CARTOUCHE;
    c.alignment = exports.AL_DROITE;
    c = ws.getCell(4, colMax);
    c.value = ident.sigle;
    c.font = exports.F_CARTOUCHE;
    c.border = exports.B_SOULIGNE;
    c = ws.getCell(5, 1);
    c.value = `N° d'identification fiscale (NIF) : ${ident.nif}`.trimEnd();
    c.font = exports.F_CARTOUCHE;
    c = ws.getCell(5, Math.max(3, colMax - 3));
    c.value = texteExercice(ident.exercice);
    c.font = exports.F_CARTOUCHE;
    c = ws.getCell(5, Math.max(3, colMax - 1));
    c.value = `Durée (en mois) : ${ident.duree}`;
    c.font = exports.F_CARTOUCHE;
    c = ws.getCell(6, 1);
    c.value = `N° de télédéclarant (NTD) : ${ident.ntd}`.trimEnd();
    c.font = exports.F_CARTOUCHE;
    c = ws.getCell(6, Math.max(3, colMax - 3));
    c.value = ident.dateArrete
        ? `Comptes arrêtés le ${ident.dateArrete}`
        : "Date d'arrêté des comptes non renseignée";
    c.font = exports.F_CARTOUCHE;
    if (ident.monnaie) {
        const colDate = Math.max(3, colMax - 3);
        const colMonnaie = Math.max(3, colMax - 1);
        c = ws.getCell(6, colMonnaie);
        c.value =
            colMonnaie === colDate ? `${String(c.value ?? '')} · Montants en ${ident.monnaie}` : `Montants en ${ident.monnaie}`;
        c.font = exports.F_CARTOUCHE;
    }
    hauteurs(ws, { 1: 12, 2: 26, 3: 15, 4: 15, 5: 15, 6: 15, 7: 28 });
    return 7;
}
function titreEtat(ws, texte, colMin, colMax, row = 7, taille = 16) {
    fusion(ws, row, colMin, row, colMax);
    const c = ws.getCell(row, colMin);
    c.value = texte;
    c.font = taille >= 16 ? exports.F_TITRE_ETAT : exports.F_TITRE_ETAT_M;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let cc = colMin; cc <= colMax; cc++)
        ws.getCell(row, cc).border = { bottom: exports.MOYEN };
    return row + 1;
}
function bandeNeant(ws, row, colMax) {
    fusion(ws, row, 1, row + 1, colMax);
    const c = ws.getCell(row, 1);
    c.value = 'NEANT';
    c.font = { name: 'Arial Black', size: 26, bold: true, color: argb(exports.C_GRIS) };
    c.alignment = exports.AL_CENTRE;
    ws.getRow(row).height = 30;
    ws.getRow(row + 1).height = 30;
    return row + 2;
}
function titreNote(ws, texte, colMax, row = 7) {
    fusion(ws, row, 1, row, colMax);
    const c = ws.getCell(row, 1);
    c.value = texte;
    c.font = exports.F_TITRE_NOTE;
    c.alignment = exports.AL_CENTRE;
    return row + 1;
}
function entetesBande(ws, rowMin, rowMax, colMin, colMax) {
    for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
            const cell = ws.getCell(r, c);
            cell.font = exports.F_ENTETE_COL;
            cell.fill = (0, exports.fond)(exports.C_ENTETE);
            cell.alignment = exports.AL_CENTRE;
            cell.border = exports.B_FIN;
        }
    }
    cadre(ws, rowMin, colMin, rowMax, colMax, exports.MOYEN);
}
const NIVEAUX = {
    rubrique: [exports.C_RUBRIQUE, exports.F_DONNEE_G],
    inter: [exports.C_GRIS, exports.F_DONNEE_G],
    section: [exports.C_SECTION, exports.F_BLANC_G],
    general: [exports.C_NAVY, exports.F_BLANC_G],
    cle: [exports.C_NOTE, exports.F_BLANC_G],
    bande: [exports.C_GRIS, exports.F_DONNEE_G],
};
function styleLigne(ws, row, colMin, colMax, niveau = 'normal', colsMontant = [], colRef) {
    const [fondHex, police] = niveau === 'normal' ? [null, exports.F_DONNEE] : NIVEAUX[niveau];
    for (let c = colMin; c <= colMax; c++) {
        const cell = ws.getCell(row, c);
        cell.border = exports.B_DONNEE;
        if (fondHex && c !== colRef)
            cell.fill = (0, exports.fond)(fondHex);
        cell.font = c !== colRef ? police : niveau !== 'normal' ? exports.F_DONNEE_G : exports.F_DONNEE;
        if (colsMontant.includes(c)) {
            cell.numFmt = exports.FMT_MONTANT;
            if (!cell.alignment || !cell.alignment.wrapText)
                cell.alignment = { vertical: 'middle' };
        }
        else if (c === colRef) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        else if (!cell.alignment || !cell.alignment.horizontal) {
            cell.alignment = exports.AL_GAUCHE;
        }
    }
    if (niveau === 'general') {
        for (let c = colMin; c <= colMax; c++) {
            const cell = ws.getCell(row, c);
            cell.border = { ...cell.border, bottom: exports.MOYEN };
        }
    }
}
function numeroterPages(wb) {
    let n = 0;
    wb.eachSheet((ws) => {
        const v = ws.getCell(1, 1).value;
        if (typeof v === 'string' && v.trim().startsWith('-')) {
            n += 1;
            ws.getCell(1, 1).value = `- ${n} -`;
        }
    });
}
function construireCouverture(wb, ident, titreLiasse, pays = '') {
    const ws = wb.addWorksheet('Couverture');
    masquerQuadrillage(ws);
    largeurs(ws, { A: 1.3, B: 0.8, C: 1.3, D: 8.7, E: 10.5, F: 11.5, G: 11.5, H: 13.2, I: 11.5, J: 8.7, K: 11.5, L: 1.3, M: 0.8 });
    hauteurs(ws, { 1: 4, 2: 4, 31: 33, 53: 5 });
    for (let r = 3; r < 53; r++)
        if (r !== 31)
            ws.getRow(r).height = 13;
    cadre(ws, 2, 2, 52, 13, exports.MOYEN);
    for (let r = 3; r < 19; r++)
        for (const c of [3, 4])
            ws.getCell(r, c).fill = (0, exports.fond)(exports.C_NOTE);
    if (pays) {
        fusion(ws, 4, 6, 4, 9);
        const c = ws.getCell(4, 6);
        c.value = pays;
        c.font = { name: 'Times New Roman', size: 12, bold: true };
        c.alignment = exports.AL_CENTRE;
    }
    fusion(ws, 26, 5, 29, 10);
    let c = ws.getCell(26, 5);
    c.value = ident.entite;
    c.font = { name: 'Arial', size: 22, bold: true };
    c.alignment = exports.AL_CENTRE;
    fusion(ws, 31, 5, 31, 11);
    c = ws.getCell(31, 5);
    c.value = titreLiasse;
    c.font = { name: 'Arial Black', size: 20, bold: true, color: argb('FFFFFF') };
    c.alignment = exports.AL_CENTRE;
    for (let cc = 5; cc < 12; cc++)
        ws.getCell(31, cc).fill = (0, exports.fond)(exports.C_COUV);
    fusion(ws, 34, 5, 34, 11);
    c = ws.getCell(34, 5);
    c.value = texteExercice(ident.exercice);
    c.font = { name: 'Arial', size: 12, bold: true };
    c.alignment = exports.AL_CENTRE;
    return ws;
}
function construireGarde(wb, ident, options) {
    const ws = wb.addWorksheet('Garde');
    masquerQuadrillage(ws);
    largeurs(ws, { A: 1.0, B: 19.8, C: 11.3, D: 11.0, E: 3.2, F: 5.2, G: 5.2, H: 3.2, I: 11.0, J: 11.3, K: 19.8, L: 1.0 });
    hauteurs(ws, { 2: 20, 3: 20, 4: 20, 8: 12, 9: 14, 12: 44, 13: 22, 16: 18, 20: 16, 22: 18, 26: 18, 28: 18, 30: 14, 31: 17, 32: 30, 33: 14 });
    let r = 2;
    for (const [i, ligne] of (options.lignesAdmin ?? []).entries()) {
        fusion(ws, r, 3, r, 10);
        const c = ws.getCell(r, 3);
        c.value = ligne;
        c.font = { name: 'Arial', size: i === 0 ? 14 : 10, bold: true };
        c.alignment = exports.AL_CENTRE;
        r += 1;
    }
    if (options.contextureAudcif) {
        for (const [rr, mention] of [
            [2, 'REPUBLIQUE'],
            [3, 'MINISTERE'],
            [4, 'DIRECTION'],
        ]) {
            fusion(ws, rr, 2, rr, 3);
            const cm = ws.getCell(rr, 2);
            cm.value = mention;
            cm.font = { name: 'Arial', size: 10, bold: true };
            fusion(ws, rr, 4, rr, 10);
            for (let cc = 4; cc < 11; cc++)
                ws.getCell(rr, cc).border = exports.B_SOULIGNE;
        }
        fusion(ws, 8, 3, 8, 10);
        const cc8 = ws.getCell(8, 3);
        cc8.value = 'CENTRE DE DEPOT DE';
        cc8.font = { name: 'Arial', size: 10 };
        cc8.alignment = exports.AL_CENTRE;
        fusion(ws, 9, 3, 9, 10);
        for (let cc = 3; cc < 11; cc++)
            ws.getCell(9, cc).border = exports.B_SOULIGNE;
    }
    else if (options.centreDepot) {
        fusion(ws, 8, 3, 8, 10);
        let c = ws.getCell(8, 3);
        c.value = 'CENTRE DE DEPOT DE';
        c.font = { name: 'Arial', size: 10 };
        c.alignment = exports.AL_CENTRE;
        fusion(ws, 9, 3, 9, 10);
        c = ws.getCell(9, 3);
        c.value = options.centreDepot;
        c.font = { name: 'Arial', size: 11, bold: true };
        c.alignment = exports.AL_CENTRE;
    }
    fusion(ws, 12, 2, 12, 11);
    let c = ws.getCell(12, 2);
    c.value = options.bandeau;
    c.font = { name: 'Arial', size: 14, bold: true };
    c.alignment = exports.AL_CENTRE;
    for (let cc = 2; cc < 12; cc++) {
        ws.getCell(12, cc).fill = (0, exports.fond)(exports.C_GRIS);
        ws.getCell(12, cc).border = { top: exports.MOYEN, bottom: exports.FIN };
    }
    fusion(ws, 13, 2, 13, 11);
    c = ws.getCell(13, 2);
    c.value = options.sousBandeau;
    c.font = { name: 'Arial', size: 17, bold: true, color: argb(exports.C_GARDE_TXT) };
    c.alignment = exports.AL_CENTRE;
    for (let cc = 2; cc < 12; cc++) {
        ws.getCell(13, cc).fill = (0, exports.fond)(exports.C_NAVY);
        ws.getCell(13, cc).border = { bottom: exports.MOYEN };
    }
    fusion(ws, 16, 3, 16, 10);
    c = ws.getCell(16, 3);
    c.value = `${texteExercice(ident.exercice)}   -   Durée (en mois) : ${ident.duree}`;
    c.font = { name: 'Arial', size: 14, bold: true };
    c.alignment = exports.AL_CENTRE;
    fusion(ws, 20, 2, 20, 11);
    c = ws.getCell(20, 2);
    c.value = "DESIGNATION DE L'ENTITE";
    c.font = { name: 'Arial', size: 12, bold: true };
    c.alignment = exports.AL_CENTRE;
    for (let cc = 2; cc < 12; cc++)
        ws.getCell(20, cc).border = { top: exports.FIN, bottom: exports.FIN };
    const champs = [
        [22, 'DENOMINATION SOCIALE :', ident.entite],
        [24, 'SIGLE USUEL :', ident.sigle],
        [26, 'ADRESSE COMPLETE :', ident.adresse],
        [28, "N° d'identification fiscale (NIF) :", ident.nif],
        [30, 'N° de télédéclarant (NTD) :', ident.ntd],
    ];
    for (const [rr, lab, val] of champs) {
        c = ws.getCell(rr, 2);
        c.value = lab;
        c.font = { name: 'Arial', size: 9, bold: rr >= 28 };
        fusion(ws, rr, 5, rr, 10);
        c = ws.getCell(rr, 5);
        c.value = val;
        c.font = { name: 'Arial', size: 12, bold: true };
        c.alignment = exports.AL_CENTRE;
        for (let cc = 5; cc < 11; cc++)
            ws.getCell(rr, cc).border = exports.B_SOULIGNE;
    }
    fusion(ws, 32, 2, 32, 11);
    c = ws.getCell(32, 2);
    c.value = options.systeme;
    c.font = { name: 'Arial', size: 16, bold: true };
    c.alignment = exports.AL_CENTRE;
    for (let cc = 2; cc < 12; cc++)
        ws.getCell(32, cc).border = { top: exports.POINTILLE };
    ws.getCell(34, 2).value = 'Documents déposés';
    ws.getCell(34, 2).font = { name: 'Arial', size: 10, bold: true };
    ws.getCell(34, 8).value = options.contextureAudcif
        ? 'Réservé à la Direction Générale des Impôts'
        : "Réservé à l'administration";
    ws.getCell(34, 8).font = { name: 'Arial', size: 10, bold: true };
    r = 35;
    for (const doc of options.documents) {
        fusion(ws, r, 2, r, 5);
        c = ws.getCell(r, 2);
        c.value = doc;
        c.font = exports.F_DONNEE;
        for (let cc = 2; cc < 6; cc++)
            ws.getCell(r, cc).border = exports.B_FIN;
        c = ws.getCell(r, 6);
        c.value = 'X';
        c.font = { name: 'Arial Black', size: 8, bold: true };
        c.alignment = exports.AL_CENTRE;
        c.border = exports.B_FIN;
        r += 1;
    }
    const zone = [
        ['Date de dépôt', 1],
        ['', 3],
        [
            options.contextureAudcif
                ? "Nom de l'agent de la DGI ayant réceptionné le dépôt"
                : "Nom de l'agent ayant réceptionné le dépôt",
            1,
        ],
        ['', 3],
        ["Signature de l'agent et cachet du service", 1],
        ['', 3],
    ];
    let rz = 35;
    for (const [texte, h] of zone) {
        fusion(ws, rz, 8, rz + h - 1, 11);
        if (texte) {
            c = ws.getCell(rz, 8);
            c.value = texte;
            c.font = { name: 'Arial', size: 8 };
            c.alignment = { horizontal: 'center', vertical: 'top' };
        }
        for (let rr = rz; rr < rz + h; rr++)
            for (let cc = 8; cc < 12; cc++)
                ws.getCell(rr, cc).border = exports.B_FIN;
        rz += h;
    }
    r = Math.max(r, rz) + 1;
    for (const lab of ['Nombre de pages déposées par exemplaire :', "Nombre d'exemplaires déposés :"]) {
        fusion(ws, r, 2, r, 5);
        c = ws.getCell(r, 2);
        c.value = lab;
        c.font = exports.F_DONNEE;
        for (let cc = 2; cc < 7; cc++)
            ws.getCell(r, cc).border = exports.B_FIN;
        r += 1;
    }
    return ws;
}
function construireFiche1(wb, ident, referentiel, systeme, prerempli = {}, pageRef = 'FICHE 1') {
    const ws = wb.addWorksheet('Fiche 1');
    const NB = 10;
    ecrireCartouche(ws, ident, pageRef, NB);
    fusion(ws, 7, 1, 7, NB);
    let c = ws.getCell(7, 1);
    c.value = "FICHE D'IDENTIFICATION ET RENSEIGNEMENTS DIVERS";
    c.font = { name: 'Arial', size: 11, bold: true, color: argb(exports.C_SECTION) };
    c.alignment = exports.AL_CENTRE;
    fusion(ws, 8, 1, 8, NB);
    c = ws.getCell(8, 1);
    c.value = `${referentiel} - ${systeme}`;
    c.font = { name: 'Arial', size: 9, bold: true };
    c.alignment = exports.AL_CENTRE;
    const champs = [
        ['ZA', 'EXERCICE COMPTABLE', `DU : ${ident.dateDebut}    AU : ${ident.dateFin}`],
        ['ZB', "DATE D'ARRETE EFFECTIF DES COMPTES", ident.dateArrete || 'Non renseignée'],
        ['ZC', 'EXERCICE PRECEDENT CLOS LE', ''],
        ['ZD', "DUREE DE L'EXERCICE PRECEDENT (EN MOIS)", ''],
        ['ZE', "N° REGISTRE (RCCM, F92, CONVENTION...) ET GREFFE", ''],
        ['ZF', 'N° REPERTOIRE DES ENTITES', ''],
        ['ZG', 'N° DE CAISSE SOCIALE', ''],
        ['ZH', 'N° CODE IMPORTATEUR', ''],
        ['ZI', 'CODE ACTIVITE PRINCIPALE', ''],
        ['ZJ', "DESIGNATION DE L'ENTITE ET SIGLE", `${ident.entite}${ident.sigle ? `  (${ident.sigle})` : ''}`.trim()],
        ['ZK', 'N° DE TELEPHONE, ADRESSE E-MAIL, BOITE POSTALE, VILLE', ''],
        ['ZL', 'ADRESSE GEOGRAPHIQUE COMPLETE (IMMEUBLE, RUE, QUARTIER, VILLE, PAYS)', ident.adresse],
        ['ZM', "DESIGNATION PRECISE DE L'ACTIVITE PRINCIPALE EXERCEE", ''],
        ['ZN', '% DE CAPACITE DE PRODUCTION UTILE', ''],
        ['ZO', 'NOM, ADRESSE, TELEPHONE, E-MAIL ET QUALITE DE LA PERSONNE A CONTACTER EN CAS DE DEMANDE', ''],
        ['ZP', 'NOM, ADRESSE, TELEPHONE ET E-MAIL DU SALARIE OU DU PROFESSIONNEL COMPTABLE AYANT ETABLI LES ETATS FINANCIERS', ''],
        ['ZQ', "NOM, ADRESSE, TELEPHONE, E-MAIL ET N° D'INSCRIPTION A L'ORDRE DE L'EXPERT-COMPTABLE AYANT DELIVRE L'ATTESTATION DE VISA", ''],
        ['ZR', "NOM, ADRESSE, TELEPHONE, E-MAIL ET N° D'INSCRIPTION DU COMMISSAIRE AUX COMPTES, LE CAS ECHEANT", ''],
        ['ZS', "ETATS FINANCIERS APPROUVES PAR L'ORGANE COMPETENT (OUI / NON)", ''],
        ['ZT', 'NOM DU SIGNATAIRE DES ETATS FINANCIERS', ''],
        ['ZU', 'QUALITE DU SIGNATAIRE DES ETATS FINANCIERS', ''],
        ['ZV', 'DATE DE SIGNATURE', ''],
        ['ZW', 'DOMICILIATIONS BANCAIRES (BANQUE ET NUMERO DE COMPTE)', ''],
    ];
    let r = 9;
    for (const [code, lab, defaut] of champs) {
        r += 1;
        c = ws.getCell(r, 1);
        c.value = code;
        c.font = { name: 'Arial', size: 8, bold: true };
        c.fill = (0, exports.fond)(exports.C_RUBRIQUE);
        c.alignment = exports.AL_CENTRE;
        c.border = exports.B_FIN;
        fusion(ws, r, 2, r, 6);
        c = ws.getCell(r, 2);
        c.value = lab;
        c.font = { name: 'Arial', size: 8 };
        c.alignment = exports.AL_GAUCHE;
        fusion(ws, r, 7, r, NB);
        c = ws.getCell(r, 7);
        c.value = prerempli[code] ?? defaut;
        c.font = { name: 'Arial', size: 8, bold: true };
        c.alignment = exports.AL_GAUCHE;
        for (let cc = 2; cc <= NB; cc++)
            ws.getCell(r, cc).border = { bottom: exports.FILET };
        ws.getRow(r).height = 24;
    }
    r += 2;
    fusion(ws, r, 2, r, 5);
    ws.getCell(r, 2).value = 'Signature';
    ws.getCell(r, 2).font = { name: 'Arial', size: 8 };
    for (let cc = 2; cc < 6; cc++)
        ws.getCell(r, cc).border = { top: exports.FIN };
    largeurs(ws, { A: 5, B: 12, C: 12, D: 12, E: 12, F: 12, G: 11, H: 11, I: 11, J: 11 });
    return ws;
}
function construireFiche2(wb, ident, sousTitre, dirigeants = [], pageRef = 'FICHE 2', lignes = 20, ficheR3Audcif = false) {
    const ws = wb.addWorksheet('Fiche 2');
    const NB = 10;
    ecrireCartouche(ws, ident, pageRef, NB);
    fusion(ws, 7, 1, 7, NB);
    let c = ws.getCell(7, 1);
    c.value = "FICHE D'IDENTIFICATION ET RENSEIGNEMENTS DIVERS";
    c.font = { name: 'Arial', size: 12, bold: true, color: argb(exports.C_SECTION) };
    c.alignment = exports.AL_CENTRE;
    fusion(ws, 8, 1, 8, NB);
    c = ws.getCell(8, 1);
    c.value = sousTitre;
    c.font = { name: 'Arial', size: 11, bold: true };
    c.alignment = exports.AL_CENTRE;
    const entetes = [
        ['Nom et Prénoms', 1, 2],
        ['Nationalité', 3, 3],
        ['Autres nationalités (à préciser) (2)', 4, 4],
        ['Qualité', 5, 5],
        ["N° d'identification fiscale", 6, 7],
        ['Adresse (BP, ville, pays, adresse géographique et adresse e-mail)', 8, 10],
    ];
    let r = 10;
    for (const [lab, c1, c2] of entetes) {
        fusion(ws, r, c1, r, c2);
        ws.getCell(r, c1).value = lab;
    }
    entetesBande(ws, r, r, 1, NB);
    ws.getRow(r).height = 34;
    for (let i = 0; i < Math.max(lignes, dirigeants.length); i++) {
        r += 1;
        ws.getRow(r).height = 26;
        for (const [, c1, c2] of entetes)
            fusion(ws, r, c1, r, c2);
        const d = dirigeants[i];
        if (d) {
            ws.getCell(r, 1).value = d.nom;
            ws.getCell(r, 1).font = exports.F_DONNEE;
            ws.getCell(r, 5).value = d.qualite;
            ws.getCell(r, 5).font = exports.F_DONNEE;
            if (d.nif) {
                ws.getCell(r, 6).value = d.nif;
                ws.getCell(r, 6).font = exports.F_DONNEE;
            }
        }
        for (let cc = 1; cc <= NB; cc++)
            ws.getCell(r, cc).border = exports.B_FIN;
    }
    r += 2;
    if (ficheR3Audcif) {
        c = ws.getCell(r, 1);
        c.value = '(1) Dirigeants = Président Directeur Général, Directeur Général, Administrateur Général, Gérant, Autres.';
        c.font = { name: 'Arial', size: 8 };
        r += 1;
    }
    c = ws.getCell(r, 1);
    c.value = '(2) Mentionner les autres nationalités le cas échéant.';
    c.font = { name: 'Arial', size: 8 };
    if (ficheR3Audcif) {
        r += 2;
        fusion(ws, r, 1, r, NB);
        c = ws.getCell(r, 1);
        c.value = "MEMBRES DU CONSEIL D'ADMINISTRATION";
        c.font = { name: 'Arial', size: 11, bold: true };
        c.alignment = exports.AL_CENTRE;
        r += 1;
        const colonnesCa = [
            ['Nom et Prénoms', 1, 3],
            ['Qualité', 4, 5],
            ['Adresse (BP, ville, pays)', 6, 10],
        ];
        for (const [lab, c1, c2] of colonnesCa) {
            fusion(ws, r, c1, r, c2);
            ws.getCell(r, c1).value = lab;
        }
        entetesBande(ws, r, r, 1, NB);
        ws.getRow(r).height = 24;
        for (let i = 0; i < 10; i++) {
            r += 1;
            ws.getRow(r).height = 22;
            for (const [, c1, c2] of colonnesCa)
                fusion(ws, r, c1, r, c2);
            for (let cc = 1; cc <= NB; cc++)
                ws.getCell(r, cc).border = exports.B_FIN;
        }
    }
    largeurs(ws, { A: 12, B: 16, C: 13, D: 13, E: 13, F: 8, G: 8, H: 11, I: 11, J: 11 });
    return ws;
}
async function ecrireFeuilleBalance(wb, nom, b) {
    const feuille = (0, presentation_fpm_1.poserFeuilleFpm)(wb, null, {
        nomFeuille: nom,
        titre: 'Balance des comptes',
        sousTitre: 'Complète',
        identite: b.identite,
        mention: b.mention,
        debut: b.debut,
        fin: b.fin,
        colonnes: presentation_fpm_1.COLONNES_BALANCE_FPM,
        entetes: (0, presentation_fpm_1.entetesBalanceFpm)(b.debut, 'Numéro de compte', 'Intitulé des comptes'),
        lignesEntete: 2,
    });
    const lignes = [...b.lignes].sort((x, y) => (x.numero < y.numero ? -1 : x.numero > y.numero ? 1 : 0));
    const corps = await (0, balance_fpm_1.ecrireCorpsBalance)(feuille, lignes, b.intitulesDivisions);
    feuille.fermer();
    return corps;
}
function sommeColonneBalance(feuille, corps, colonne) {
    if (corps.premiere === null || corps.derniere === null)
        return '0';
    return `SUM(${q(feuille)}!${colonne}${corps.premiere}:${colonne}${corps.derniere})`;
}
function construireControleBalance(wb, corpsN, corpsN1) {
    const ws = wb.addWorksheet('CONTROLE BALANCE');
    masquerQuadrillage(ws);
    largeurs(ws, { A: 22.5, B: 20.7, C: 20.7, D: 20.7, E: 20.7, F: 20.7, G: 20.7 });
    fusion(ws, 1, 1, 1, 7);
    const t = ws.getCell(1, 1);
    t.value = 'EQUILIBRE DE LA BALANCE';
    t.font = { name: 'Arial', size: 20, bold: true };
    t.alignment = exports.AL_CENTRE;
    for (let cc = 1; cc < 8; cc++)
        ws.getCell(1, cc).fill = (0, exports.fond)(exports.C_CTRL_TITRE);
    ws.getRow(1).height = 26;
    const cols = ['C', 'D', 'E', 'F', 'G', 'H'];
    const bloc = (r0, nom, feuille, corps) => {
        fusion(ws, r0, 1, r0 + 2, 1);
        let c = ws.getCell(r0, 1);
        c.value = nom;
        c.font = { name: 'Arial', size: 14, bold: true };
        c.fill = (0, exports.fond)(exports.C_GRIS);
        c.alignment = exports.AL_CENTRE;
        const heads = [
            ['Mouvements bruts avant la période Débit', cols[0], true],
            ['Mouvements bruts avant la période Crédit', cols[1], true],
            ['Mouvements Débit', cols[2], false],
            ['Mouvements Crédit', cols[3], false],
            ['Soldes cumulés Débit', cols[4], true],
            ['Soldes cumulés Crédit', cols[5], true],
        ];
        for (const [i, [lab, lettre, vert]] of heads.entries()) {
            const cc = 2 + i;
            c = ws.getCell(r0, cc);
            c.value = lab;
            c.font = { name: 'Arial', size: 10, bold: true };
            c.alignment = exports.AL_CENTRE;
            if (vert)
                c.fill = (0, exports.fond)(exports.C_CTRL_ENT);
            c.border = exports.B_FIN;
            c = ws.getCell(r0 + 1, cc);
            c.value = { formula: sommeColonneBalance(feuille, corps, lettre) };
            c.font = { name: 'Arial', size: 11, bold: true };
            c.fill = (0, exports.fond)(exports.C_GRIS);
            c.numFmt = '#,##0';
            c.border = exports.B_DONNEE;
        }
        for (const [c1, c2] of [
            [2, 3],
            [4, 5],
            [6, 7],
        ]) {
            fusion(ws, r0 + 2, c1, r0 + 2, c2);
            const la = String.fromCharCode(64 + c1);
            const lb = String.fromCharCode(64 + c2);
            const rr = r0 + 1;
            c = ws.getCell(r0 + 2, c1);
            c.value = {
                formula: `IF(ROUND(${la}${rr}-${lb}${rr},0)=0,"Equilibre","Déséquilibre : écart de "&TEXT(${la}${rr}-${lb}${rr},"#,##0"))`,
            };
            c.font = exports.F_VERDICT;
            c.alignment = exports.AL_CENTRE;
            for (let cc = c1; cc <= c2; cc++)
                ws.getCell(r0 + 2, cc).border = exports.B_DONNEE;
        }
        ws.getRow(r0).height = 50;
        ws.getRow(r0 + 1).height = 21;
        ws.getRow(r0 + 2).height = 54;
        cadre(ws, r0, 1, r0 + 2, 7, exports.MOYEN);
    };
    bloc(2, 'BALANCE N', exports.NOM_BALANCE, corpsN);
    if (corpsN1)
        bloc(5, 'BALANCE N-1', exports.NOM_BALANCE_N1, corpsN1);
    return ws;
}
function construireFicheNotes(wb, parties, ident, applicables, pageRef = 'NOTES ANNEXES', notePied) {
    const ws = wb.addWorksheet('NOTES ANNEXES');
    const NB = 10;
    ecrireCartouche(ws, ident, pageRef, NB);
    fusion(ws, 7, 1, 7, NB);
    let c = ws.getCell(7, 1);
    c.value = 'FICHE RECAPITULATIVE NOTES ANNEXES PRESENTEES (1)';
    c.font = exports.F_TITRE_NOTE;
    c.alignment = exports.AL_CENTRE;
    ws.getRow(7).height = 22;
    let r = 8;
    ws.getCell(r, 1).value = 'NOTES';
    fusion(ws, r, 2, r, 8);
    ws.getCell(r, 2).value = 'INTITULES';
    ws.getCell(r, 9).value = 'A (2)';
    ws.getCell(r, 10).value = 'N/A (2)';
    entetesBande(ws, r, r, 1, NB);
    ws.getRow(r).height = 19;
    for (const [titrePartie, lignes] of parties) {
        r += 1;
        fusion(ws, r, 1, r, NB);
        c = ws.getCell(r, 1);
        c.value = titrePartie;
        c.font = { name: 'Arial', size: 10, bold: true };
        c.alignment = exports.AL_CENTRE;
        for (let cc = 1; cc <= NB; cc++) {
            ws.getCell(r, cc).fill = (0, exports.fond)(exports.C_GRIS);
            ws.getCell(r, cc).border = exports.B_FIN;
        }
        ws.getRow(r).height = 16;
        for (const [numero, intitule] of lignes) {
            r += 1;
            c = ws.getCell(r, 1);
            c.value = numero;
            c.font = { name: 'Arial', size: 10 };
            c.alignment = exports.AL_CENTRE;
            fusion(ws, r, 2, r, 8);
            c = ws.getCell(r, 2);
            c.value = intitule;
            c.font = { name: 'Arial', size: 10 };
            c.alignment = exports.AL_GAUCHE;
            if (applicables) {
                const colonne = applicables.has(numero) ? 9 : 10;
                c = ws.getCell(r, colonne);
                c.value = 'X';
                c.font = { name: 'Arial', size: 10, bold: true };
                c.alignment = exports.AL_CENTRE;
            }
            for (let cc = 1; cc <= NB; cc++)
                ws.getCell(r, cc).border = exports.B_FIN;
        }
    }
    r += 2;
    fusion(ws, r, 1, r, NB);
    c = ws.getCell(r, 1);
    c.value =
        notePied ??
            '(1) Les notes non documentées ne doivent pas être jointes aux états financiers ; dans une note, les lignes non chiffrées doivent être supprimées.';
    c.font = { name: 'Arial', size: 8 };
    c.alignment = exports.AL_GAUCHE;
    ws.getRow(r).height = 30;
    r += 1;
    fusion(ws, r, 1, r, NB);
    c = ws.getCell(r, 1);
    c.value = '(2) A : applicable ; N/A : non applicable. Cocher la colonne correspondante pour chaque note.';
    c.font = { name: 'Arial', size: 8 };
    c.alignment = exports.AL_GAUCHE;
    largeurs(ws, { A: 11.5, B: 19, C: 10, D: 8, E: 17, F: 9.5, G: 8, H: 21.5, I: 6.3, J: 6.3 });
    return ws;
}
function construireTableCommentaires(wb, parties, ident, parPage = 4) {
    const ws = wb.addWorksheet('TABLE COMMENTAIRE');
    masquerQuadrillage(ws);
    const NB = 8;
    largeurs(ws, { A: 11.2, B: 14.8, C: 11.5, D: 19.8, E: 14.5, F: 10.3, G: 13.5, H: 6.3 });
    const plates = [];
    for (const [titrePartie, lignes] of parties) {
        let premier = true;
        for (const [numero, intitule] of lignes) {
            plates.push([premier ? titrePartie : null, numero, intitule]);
            premier = false;
        }
    }
    const nbPages = Math.max(1, Math.ceil(plates.length / parPage));
    let r = 1;
    let page = 0;
    for (const [i, [partie, numero, intitule]] of plates.entries()) {
        if (i % parPage === 0) {
            page += 1;
            fusion(ws, r, 1, r, 6);
            let c = ws.getCell(r, 1);
            c.value = 'TABLE DES COMMENTAIRES';
            c.font = { name: 'Arial', size: 11, bold: true, color: argb(exports.C_SECTION) };
            c.alignment = exports.AL_CENTRE;
            fusion(ws, r, 7, r, 8);
            c = ws.getCell(r, 7);
            c.value = `COMMENTAIRES\nPAGE ${page}/${nbPages}`;
            c.font = exports.F_PAGE_REF;
            c.alignment = exports.AL_CENTRE;
            for (let cc = 7; cc < 9; cc++)
                ws.getCell(r, cc).border = { top: exports.FIN, bottom: exports.FIN, left: exports.FIN };
            ws.getRow(r).height = 26;
            const petits = [
                [r + 1, 1, `Dénomination sociale : ${ident.entite}`],
                [r + 2, 1, `Adresse : ${ident.adresse}`],
                [r + 2, 6, `Sigle usuel : ${ident.sigle}`],
                [r + 3, 1, `N° d'identification fiscale (NIF) : ${ident.nif}`],
                [r + 3, 5, texteExercice(ident.exercice)],
                [r + 3, 7, `Durée (en mois) : ${ident.duree}`],
                [r + 4, 1, `N° de télédéclarant (NTD) : ${ident.ntd}`],
            ];
            for (const [rr, cc, texte] of petits) {
                c = ws.getCell(rr, cc);
                c.value = texte;
                c.font = { name: 'Arial', size: 8 };
            }
            r += 5;
        }
        if (partie) {
            fusion(ws, r, 1, r, NB);
            const c = ws.getCell(r, 1);
            c.value = partie;
            c.font = { name: 'Arial Black', size: 10, bold: true };
            c.alignment = exports.AL_CENTRE;
            for (let cc = 1; cc <= NB; cc++) {
                ws.getCell(r, cc).fill = (0, exports.fond)(exports.C_PARTIE_TC);
                ws.getCell(r, cc).border = { bottom: exports.FIN };
            }
            ws.getRow(r).height = 17;
            r += 1;
        }
        let c = ws.getCell(r, 1);
        c.value = numero;
        c.font = { name: 'Arial', size: 8 };
        c.fill = (0, exports.fond)(exports.C_GRIS);
        c.alignment = exports.AL_CENTRE;
        c.border = exports.B_FIN;
        fusion(ws, r, 2, r, NB);
        c = ws.getCell(r, 2);
        c.value = intitule;
        c.font = { name: 'Arial', size: 8, bold: true };
        c.alignment = exports.AL_GAUCHE;
        for (let cc = 2; cc <= NB; cc++)
            ws.getCell(r, cc).border = exports.B_FIN;
        ws.getRow(r).height = 16;
        r += 1;
        fusion(ws, r, 1, r, NB);
        for (let cc = 1; cc <= NB; cc++)
            ws.getCell(r, cc).border = exports.B_FIN;
        ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        ws.getRow(r).height = 110;
        r += 1;
    }
    return ws;
}
function construireBilanPaysage(wb, ident, coteActif, cotePassif, titre = 'BILAN', nom = 'Bilan paysage') {
    const ws = wb.addWorksheet(nom);
    const nca = coteActif.cols.length;
    const ncp = cotePassif.cols.length;
    const ca0 = 1;
    const cp0 = 3 + nca + 1;
    const colMax = cp0 + 2 + ncp;
    ecrireCartouche(ws, ident, `${titre}\nPAGE 1/1`, colMax);
    titreEtat(ws, titre, 3, colMax - 2, 7, 16);
    const entetesCote = (c0, cote) => {
        ws.getCell(8, c0).value = 'REF';
        ws.getCell(8, c0 + 1).value = cote.libelle;
        ws.getCell(8, c0 + 2).value = 'NOTE';
        fusion(ws, 8, c0, 9, c0);
        fusion(ws, 8, c0 + 1, 9, c0 + 1);
        fusion(ws, 8, c0 + 2, 9, c0 + 2);
        for (const [i, col] of cote.cols.entries()) {
            ws.getCell(8, c0 + 3 + i).value = col.entete;
            fusion(ws, 8, c0 + 3 + i, 9, c0 + 3 + i);
        }
        entetesBande(ws, 8, 9, c0, c0 + 2 + cote.cols.length);
    };
    entetesCote(ca0, coteActif);
    entetesCote(cp0, cotePassif);
    ws.getRow(8).height = 24;
    ws.getRow(9).height = 24;
    const ecrireCote = (c0, cote) => {
        const qsrc = q(cote.feuille);
        let rOut = 10;
        for (const l of cote.lignes) {
            ws.getCell(rOut, c0).value = l.ref;
            const c = ws.getCell(rOut, c0 + 1);
            c.value = l.libelle;
            c.alignment = exports.AL_GAUCHE;
            ws.getCell(rOut, c0 + 2).value = l.note;
            const monts = [];
            for (const [i, col] of cote.cols.entries()) {
                const cc = c0 + 3 + i;
                ws.getCell(rOut, cc).value = { formula: `${qsrc}!${col.lettre}${l.rangSource}` };
                monts.push(cc);
            }
            styleLigne(ws, rOut, c0, c0 + 2 + cote.cols.length, l.niveau, monts, c0);
            ws.getRow(rOut).height = 18;
            rOut += 1;
        }
        return rOut;
    };
    const finA = ecrireCote(ca0, coteActif);
    const finP = ecrireCote(cp0, cotePassif);
    cadre(ws, 8, ca0, Math.max(finA, finP) - 1, ca0 + 2 + nca, exports.MOYEN);
    cadre(ws, 8, cp0, Math.max(finA, finP) - 1, cp0 + 2 + ncp, exports.MOYEN);
    const lettre = (n) => String.fromCharCode(64 + n);
    const spec = {
        [lettre(ca0)]: 5,
        [lettre(ca0 + 1)]: 34,
        [lettre(ca0 + 2)]: 6,
        [lettre(cp0)]: 5,
        [lettre(cp0 + 1)]: 34,
        [lettre(cp0 + 2)]: 6,
    };
    for (let i = 0; i < nca; i++)
        spec[lettre(ca0 + 3 + i)] = 13.5;
    for (let i = 0; i < ncp; i++)
        spec[lettre(cp0 + 3 + i)] = 13.5;
    largeurs(ws, spec);
    return ws;
}
//# sourceMappingURL=theme-etafi.js.map
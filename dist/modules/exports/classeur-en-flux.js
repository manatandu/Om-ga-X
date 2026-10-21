"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LONGUEUR_MAX_ENTETE_IMPRESSION = exports.PREMIERE_LIGNE_DONNEES = exports.LIGNE_ENTETE = exports.LIGNES_COIFFE = exports.OPTIONS_CLASSEUR_EN_FLUX = exports.LOT_EXPORT = exports.MAX_LIGNES_EXPORT = void 0;
exports.confronterAuDecompte = confronterAuDecompte;
exports.segmentIdentification = segmentIdentification;
exports.attendreLeTuyau = attendreLeTuyau;
exports.enTeteImpression = enTeteImpression;
exports.poserFeuille = poserFeuille;
exports.ouvrirFeuilleEnFlux = ouvrirFeuilleEnFlux;
const common_1 = require("@nestjs/common");
const ExcelJS = require("exceljs");
exports.MAX_LIGNES_EXPORT = Number(process.env.EXPORT_MAX_LIGNES ?? 200_000);
exports.LOT_EXPORT = 500;
function confronterAuDecompte(lues, comptees, quoi) {
    if (lues === comptees)
        return;
    throw new common_1.ConflictException(`${quoi} : ${lues.toLocaleString('fr-FR')} lignes lues sur ${comptees.toLocaleString('fr-FR')} comptées au départ · ` +
        "des pièces ont été retirées, ajoutées ou déplacées pendant la production, et le livre n'est pas remis amputé. " +
        'Relancez-le une fois la saisie arrêtée.');
}
exports.OPTIONS_CLASSEUR_EN_FLUX = {
    useSharedStrings: false,
    useStyles: true,
};
exports.LIGNES_COIFFE = 3;
exports.LIGNE_ENTETE = exports.LIGNES_COIFFE + 1;
exports.PREMIERE_LIGNE_DONNEES = exports.LIGNE_ENTETE + 1;
function segmentIdentification(identite) {
    return [identite.nif ? `NIF ${identite.nif}` : '', identite.immatriculation ?? ''].filter((x) => x !== '').join(' · ');
}
async function attendreLeTuyau(sortie) {
    if (sortie.destroyed)
        throw tuyauFerme(sortie);
    if (!sortie.writableNeedDrain)
        return;
    await new Promise((resoudre, rejeter) => {
        const nettoyer = () => {
            sortie.off('drain', vide);
            sortie.off('close', ferme);
            sortie.off('error', ferme);
        };
        const vide = () => {
            nettoyer();
            resoudre();
        };
        const ferme = () => {
            nettoyer();
            rejeter(tuyauFerme(sortie));
        };
        sortie.once('drain', vide);
        sortie.once('close', ferme);
        sortie.once('error', ferme);
    });
}
function tuyauFerme(sortie) {
    return new Error(`Le livre n'a plus où s'écrire · la production s'arrête${sortie.errored ? ` (${sortie.errored.message})` : ''}.`);
}
exports.LONGUEUR_MAX_ENTETE_IMPRESSION = 255;
function enTeteImpression(gauche, centre, droiteCodee) {
    const echapper = (t) => t.replace(/&/g, '&&');
    const reste = `${centre ? `&C${echapper(centre)}` : ''}&R${droiteCodee}`;
    let g = echapper(gauche);
    const place = exports.LONGUEUR_MAX_ENTETE_IMPRESSION - 2 - reste.length;
    if (g.length > place) {
        g = g.slice(0, Math.max(0, place - 1));
        const finale = /&+$/.exec(g)?.[0].length ?? 0;
        if (finale % 2 === 1)
            g = g.slice(0, -1);
        g += '…';
    }
    return `&L${g}${reste}`;
}
function poserFeuille(classeur, sortie, params) {
    const nbColonnes = params.colonnes.length;
    const edite = params.editeLe ?? new Date().toLocaleDateString('fr-FR');
    const feuille = classeur.addWorksheet(params.nomFeuille, {
        views: [{ state: 'frozen', ySplit: exports.LIGNE_ENTETE }],
        headerFooter: {
            oddFooter: enTeteImpression(`${params.identite.entite}${segmentIdentification(params.identite) ? ` · ${segmentIdentification(params.identite)}` : ''} · ` +
                `${params.identite.periode} · montants en ${params.identite.devise}`, null, `Page &P / &N · édité le ${edite}`),
        },
    });
    feuille.columns = params.colonnes.map((c) => ({ key: c.key, width: c.width, style: c.style }));
    const titreFeuille = feuille.getRow(1);
    titreFeuille.getCell(1).value = `${params.titre} · ${params.identite.entite}`;
    titreFeuille.getCell(1).font = { bold: true, size: 12 };
    titreFeuille.commit();
    const ligneIdentite = feuille.getRow(2);
    ligneIdentite.getCell(1).value =
        `${segmentIdentification(params.identite) ? `${segmentIdentification(params.identite)} · ` : ''}${params.identite.periode} · ` +
            `montants en ${params.identite.devise} · édité le ${edite}`;
    ligneIdentite.getCell(1).font = { size: 9, italic: true };
    ligneIdentite.commit();
    feuille.getRow(3).commit();
    const entete = feuille.getRow(exports.LIGNE_ENTETE);
    params.colonnes.forEach((c, i) => {
        entete.getCell(i + 1).value = c.header;
    });
    entete.font = { bold: true };
    entete.commit();
    let derniereLigne = exports.LIGNE_ENTETE;
    return {
        feuille,
        nbColonnes,
        async ajouter(valeurs) {
            const ligne = feuille.addRow(valeurs);
            ligne.commit();
            derniereLigne = ligne.number;
            await attendreLeTuyau(sortie);
            return ligne.number;
        },
        derniereLigneDonnees: () => derniereLigne,
        fermer(derniereLigneFiltrable = derniereLigne) {
            if (derniereLigneFiltrable > exports.LIGNE_ENTETE) {
                feuille.autoFilter = {
                    from: { row: exports.LIGNE_ENTETE, column: 1 },
                    to: { row: derniereLigneFiltrable, column: nbColonnes },
                };
            }
            feuille.commit();
        },
    };
}
function ouvrirFeuilleEnFlux(params) {
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: params.sortie,
        ...exports.OPTIONS_CLASSEUR_EN_FLUX,
    });
    classeur.creator = 'OmegaX';
    classeur.created = new Date();
    const premiere = poserFeuille(classeur, params.sortie, params);
    return {
        classeur,
        feuille: premiere.feuille,
        nbColonnes: premiere.nbColonnes,
        ajouter: premiere.ajouter,
        derniereLigneDonnees: premiere.derniereLigneDonnees,
        async terminer(derniereLigneFiltrable = premiere.derniereLigneDonnees(), suivantes) {
            premiere.fermer(derniereLigneFiltrable);
            if (suivantes)
                await suivantes((p) => poserFeuille(classeur, params.sortie, p));
            await classeur.commit();
        },
    };
}
//# sourceMappingURL=classeur-en-flux.js.map
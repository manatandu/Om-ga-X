"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyserCsv = analyserCsv;
exports.ecrireCelluleCsv = ecrireCelluleCsv;
exports.ecrireCsv = ecrireCsv;
exports.lireFichier = lireFichier;
exports.lireMontant = lireMontant;
exports.lireDate = lireDate;
const common_1 = require("@nestjs/common");
const ExcelJS = require("exceljs");
const export_modifications_1 = require("../exports/modifications/export-modifications");
function detecterSeparateur(texte) {
    let meilleur = ';';
    let meilleurScore = -1;
    for (const sep of [';', ',', '\t']) {
        const comptes = analyserCsv(texte, sep)
            .slice(0, 10)
            .map((l) => l.length);
        if (comptes.length === 0)
            continue;
        const max = Math.max(...comptes);
        if (max < 2)
            continue;
        const regulier = comptes.filter((c) => c === max).length;
        const score = max * 10 + regulier;
        if (score > meilleurScore) {
            meilleurScore = score;
            meilleur = sep;
        }
    }
    return meilleur;
}
function analyserCsv(texte, separateur, options = {}) {
    const lignes = [];
    let cellules = [];
    let courante = '';
    let dansGuillemets = false;
    let protegee = false;
    const clore = () => {
        cellules.push(options.elaguer && !protegee ? courante.trim() : courante);
        courante = '';
        protegee = false;
    };
    for (let i = 0; i < texte.length; i++) {
        const c = texte[i];
        if (dansGuillemets) {
            if (c === '"') {
                if (texte[i + 1] === '"') {
                    courante += '"';
                    i++;
                }
                else {
                    dansGuillemets = false;
                }
            }
            else {
                courante += c;
            }
            continue;
        }
        if (c === '"') {
            dansGuillemets = true;
            protegee = true;
        }
        else if (c === separateur) {
            clore();
        }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && texte[i + 1] === '\n')
                i++;
            clore();
            lignes.push(cellules);
            cellules = [];
        }
        else {
            courante += c;
        }
    }
    if (courante !== '' || cellules.length > 0) {
        clore();
        lignes.push(cellules);
    }
    return lignes;
}
function ecrireCelluleCsv(valeur, separateur) {
    const doitProteger = valeur.includes(separateur) ||
        valeur.includes('"') ||
        /[\r\n]/.test(valeur) ||
        valeur !== valeur.trim();
    if (!doitProteger)
        return valeur;
    return `"${valeur.replace(/"/g, '""')}"`;
}
function ecrireCsv(colonnes, lignes, separateur = ';') {
    const ligne = (cellules) => cellules.map((c) => ecrireCelluleCsv(c, separateur)).join(separateur);
    return [ligne(colonnes), ...lignes.map(ligne)].join('\r\n');
}
function lireCsv(texte, separateurImpose) {
    const propre = texte.replace(/^﻿/, '');
    const separateur = separateurImpose ?? detecterSeparateur(propre);
    const analysees = analyserCsv(propre, separateur, { elaguer: true }).filter((l) => l.some((c) => c !== ''));
    if (analysees.length === 0) {
        throw new common_1.BadRequestException('Le fichier est vide.');
    }
    return { colonnes: analysees[0], lignes: analysees.slice(1), separateur };
}
async function lireXlsx(contenu) {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(contenu);
    const feuille = classeur.worksheets[0];
    if (!feuille)
        throw new common_1.BadRequestException('Le classeur ne contient aucune feuille.');
    const enTexte = (v) => {
        if (v === null || v === undefined)
            return '';
        if (v instanceof Date)
            return v.toISOString().slice(0, 10);
        if (typeof v === 'object') {
            const o = v;
            if (o.richText)
                return o.richText.map((t) => t.text).join('');
            if (o.text !== undefined)
                return String(o.text);
            if (o.result !== undefined)
                return String(o.result);
            return '';
        }
        return String(v);
    };
    const toutes = [];
    feuille.eachRow((row) => {
        const valeurs = [];
        const brut = row.values.slice(1);
        for (const v of brut)
            valeurs.push(enTexte(v).trim());
        toutes.push(valeurs);
    });
    const nonVides = toutes.filter((l) => l.some((c) => c !== ''));
    if (nonVides.length === 0)
        throw new common_1.BadRequestException('La feuille est vide.');
    let lignesSupprimees;
    const supprimees = classeur.getWorksheet(export_modifications_1.FEUILLE_SUPPRIMEES);
    if (supprimees && supprimees !== feuille) {
        let n = 0;
        supprimees.eachRow((row, rang) => {
            if (rang > 1 && row.values.slice(1).some((v) => enTexte(v).trim() !== ''))
                n++;
        });
        lignesSupprimees = n;
    }
    return { colonnes: nonVides[0], lignes: nonVides.slice(1), ...(lignesSupprimees !== undefined ? { lignesSupprimees } : {}) };
}
async function lireFichier(nomFichier, contenuBase64, separateur) {
    let contenu;
    try {
        contenu = Buffer.from(contenuBase64, 'base64');
    }
    catch {
        throw new common_1.BadRequestException('Contenu du fichier illisible.');
    }
    if (contenu.length === 0)
        throw new common_1.BadRequestException('Le fichier est vide.');
    if (/\.xlsx$/i.test(nomFichier))
        return lireXlsx(contenu);
    if (/\.xls$/i.test(nomFichier)) {
        throw new common_1.BadRequestException("Le format .xls (Excel 97-2003) n'est pas lu. Enregistrez le fichier en .xlsx ou en CSV.");
    }
    return lireCsv(contenu.toString('utf8'), separateur);
}
function lireMontant(valeur) {
    const brut = (valeur ?? '').trim();
    if (brut === '' || brut === '-')
        return 0;
    const negatifParenthese = /^\(.*\)$/.test(brut);
    let nettoye = brut
        .replace(/[()]/g, '')
        .replace(/[\s\u00a0\u202f\u2009]/g, '')
        .replace(/^(?:CDF|USD|FC|EUR|XAF|XOF|€|\$)/i, '')
        .replace(/(?:CDF|USD|FC|EUR|XAF|XOF|€|\$)$/i, '');
    if (nettoye === '')
        return 0;
    const derniereVirgule = nettoye.lastIndexOf(',');
    const dernierPoint = nettoye.lastIndexOf('.');
    if (derniereVirgule > dernierPoint) {
        nettoye = nettoye.replace(/\./g, '').replace(',', '.');
    }
    else {
        nettoye = nettoye.replace(/,/g, '');
    }
    if (!/^[+-]?\d+(\.\d+)?$/.test(nettoye))
        return null;
    const n = Number(nettoye);
    if (!Number.isFinite(n))
        return null;
    return negatifParenthese ? -Math.abs(n) : n;
}
function lireDate(valeur) {
    const brut = (valeur ?? '').trim();
    if (!brut)
        return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(brut);
    if (m)
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(brut);
    if (m) {
        const annee = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
        return new Date(Date.UTC(annee, Number(m[2]) - 1, Number(m[1])));
    }
    return null;
}
//# sourceMappingURL=lecture-fichier.js.map
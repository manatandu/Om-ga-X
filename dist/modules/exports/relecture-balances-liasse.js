"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enteteDeColonne = enteteDeColonne;
exports.estLigneDeCompte = estLigneDeCompte;
exports.plagesCitees = plagesCitees;
exports.defautsDePlage = defautsDePlage;
exports.evaluerSomme = evaluerSomme;
exports.verdictsControleBalance = verdictsControleBalance;
exports.enteteAttenduDe = enteteAttenduDe;
exports.defautsDesFormulesDeBalance = defautsDesFormulesDeBalance;
exports.sommeAttendue = sommeAttendue;
exports.defautsDeFeuilleBalance = defautsDeFeuilleBalance;
const presentation_fpm_1 = require("./presentation-fpm");
const theme_etafi_1 = require("./theme-etafi");
const FEUILLES_BALANCE = [theme_etafi_1.NOM_BALANCE, theme_etafi_1.NOM_BALANCE_N1];
function valeurDe(cellule) {
    const v = cellule.value;
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'object' && v !== null && 'result' in v)
        return Number(v.result ?? 0);
    if (typeof v === 'object' && v !== null && 'formula' in v) {
        throw new Error(`Formule sans résultat joint · ${v.formula}`);
    }
    return Number(v);
}
function formuleDe(cellule) {
    const v = cellule.value;
    if (v && typeof v === 'object' && 'formula' in v)
        return String(v.formula);
    return null;
}
function enteteDeColonne(feuille, colonne) {
    const c = feuille.getColumn(colonne).number;
    const premiere = c >= 3 && c % 2 === 0 ? c - 1 : c;
    return {
        groupe: String(feuille.getCell(presentation_fpm_1.LIGNE_ENTETE_FPM, premiere).value ?? ''),
        sens: String(feuille.getCell(presentation_fpm_1.LIGNE_ENTETE_FPM + 1, c).value ?? ''),
    };
}
function estLigneDeCompte(feuille, rang) {
    if (rang <= presentation_fpm_1.LIGNE_ENTETE_FPM + 1)
        return false;
    const a = feuille.getCell(rang, 1).value;
    return typeof a === 'string' && /^\d+$/.test(a.trim());
}
function plagesCitees(wb) {
    const plages = [];
    const motif = /'(BALANCE N(?:-1)?)'!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/g;
    wb.eachSheet((ws) => {
        if (FEUILLES_BALANCE.includes(ws.name))
            return;
        ws.eachRow((row) => row.eachCell((cellule) => {
            const f = formuleDe(cellule);
            if (!f)
                return;
            for (const m of f.matchAll(motif)) {
                if (m[4] && m[4] !== m[2])
                    throw new Error(`Plage sur deux colonnes · ${ws.name}!${cellule.address} · ${f}`);
                plages.push({
                    feuilleSource: ws.name,
                    celluleSource: cellule.address,
                    feuille: m[1],
                    colonne: m[2],
                    de: Number(m[3]),
                    a: Number(m[5] ?? m[3]),
                });
            }
        }));
    });
    return plages;
}
function defautsDePlage(wb, p, attendu) {
    const ws = wb.getWorksheet(p.feuille);
    if (!ws)
        return [`${p.feuilleSource}!${p.celluleSource} · feuille ${p.feuille} absente`];
    const defauts = [];
    const ou = `${p.feuilleSource}!${p.celluleSource} → ${p.feuille}!${p.colonne}${p.de}:${p.colonne}${p.a}`;
    const comptes = [];
    ws.eachRow((_row, r) => {
        if (estLigneDeCompte(ws, r))
            comptes.push(r);
    });
    for (let r = p.de; r <= p.a; r++) {
        if (!estLigneDeCompte(ws, r))
            defauts.push(`${ou} · la ligne ${r} n'est pas une ligne de compte`);
    }
    const manquants = comptes.filter((r) => r < p.de || r > p.a);
    if (manquants.length)
        defauts.push(`${ou} · comptes hors de la plage, lignes ${manquants.join(', ')}`);
    const vues = enteteDeColonne(ws, p.colonne);
    if (!attendu.groupe.test(vues.groupe) || vues.sens !== attendu.sens) {
        defauts.push(`${ou} · en-tête « ${vues.groupe} / ${vues.sens} », attendu « ${attendu.groupe} / ${attendu.sens} »`);
    }
    return defauts;
}
function evaluerSomme(wb, formule) {
    if (formule.trim() === '0')
        return 0;
    const m = /^SUM\('([^']+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/.exec(formule.trim());
    if (!m)
        throw new Error(`Formule non relue · ${formule}`);
    const ws = wb.getWorksheet(m[1]);
    if (!ws)
        throw new Error(`Feuille absente · ${m[1]}`);
    let total = 0;
    for (let r = Number(m[3]); r <= Number(m[5]); r++)
        total += valeurDe(ws.getCell(`${m[2]}${r}`));
    return Math.round(total * 100) / 100;
}
function verdictsControleBalance(wb) {
    const ws = wb.getWorksheet('CONTROLE BALANCE');
    if (!ws)
        throw new Error('Feuille CONTROLE BALANCE absente');
    const verdicts = [];
    for (const r0 of [2, 5]) {
        const bloc = ws.getCell(r0, 1).value;
        if (typeof bloc !== 'string' || !bloc)
            continue;
        for (const [c1, c2] of [
            [2, 3],
            [4, 5],
            [6, 7],
        ]) {
            const f = formuleDe(ws.getCell(r0 + 2, c1)) ?? '';
            const m = /^IF\(ROUND\(([A-Z])(\d+)-([A-Z])(\d+),0\)=0,"Equilibre","Déséquilibre : écart de "&TEXT\(\1\2-\3\4,"#,##0"\)\)$/.exec(f);
            if (!m)
                throw new Error(`Verdict non relu · ${bloc} colonne ${c1} · ${f}`);
            const somme = (lettre, rang) => evaluerSomme(wb, formuleDe(ws.getCell(`${lettre}${rang}`)) ?? '');
            const a = somme(m[1], m[2]);
            const b = somme(m[3], m[4]);
            const ecart = Math.round((a - b) * 100) / 100;
            verdicts.push({
                bloc,
                colonnes: [String(ws.getCell(r0, c1).value), String(ws.getCell(r0, c2).value)],
                sommes: [a, b],
                verdict: Math.round(ecart) === 0
                    ? 'Equilibre'
                    : `Déséquilibre : écart de ${Math.round(ecart).toLocaleString('en-US')}`,
            });
        }
    }
    return verdicts;
}
function enteteAttenduDe(wb, p) {
    const ws = wb.getWorksheet(p.feuilleSource);
    const source = ws.getCell(p.celluleSource);
    const sens = (t) => (/cr[ée]dit/i.test(t) ? 'Crédit' : 'Débit');
    if (p.feuilleSource === 'CONTROLE BALANCE') {
        const titre = String(ws.getCell(Number(source.row) - 1, Number(source.col)).value ?? '');
        if (/^Mouvements bruts avant la période /.test(titre))
            return { groupe: /^Mouvements au \d\d\/\d\d\/\d\d$/, sens: sens(titre) };
        if (/^Mouvements (Débit|Crédit)$/.test(titre))
            return { groupe: /^Mouvements$/, sens: sens(titre) };
        if (/^Soldes cumulés /.test(titre))
            return { groupe: /^Soldes cumulés$/, sens: sens(titre) };
        throw new Error(`Intitulé de CONTROLE BALANCE non relu · ${titre}`);
    }
    const libelle = String(ws.getCell(Number(source.row), 1).value ?? '');
    if (/solde de clôture/i.test(libelle))
        return { groupe: /^Soldes cumulés$/, sens: sens(libelle) };
    throw new Error(`Libellé non relu · ${p.feuilleSource}!${p.celluleSource} · ${libelle}`);
}
function defautsDesFormulesDeBalance(wb) {
    const plages = plagesCitees(wb);
    return { plages, defauts: plages.flatMap((p) => defautsDePlage(wb, p, enteteAttenduDe(wb, p))) };
}
function sommeAttendue(lignes, colonne) {
    const f = {
        C: (l) => l.reportDebit,
        D: (l) => l.reportCredit,
        E: (l) => l.mouvementDebit,
        F: (l) => l.mouvementCredit,
        G: (l) => Math.max(l.solde, 0),
        H: (l) => Math.max(-l.solde, 0),
    };
    if (!f[colonne])
        throw new Error(`Colonne ${colonne} sans montant`);
    return Math.round(lignes.reduce((t, l) => t + f[colonne](l), 0) * 100) / 100;
}
function defautsDeFeuilleBalance(wb, nom, numerosAttendus, avant, fondEntete) {
    const bal = wb.getWorksheet(nom);
    if (!bal)
        return [`feuille ${nom} absente`];
    const defauts = [];
    const attendu = (cellule, valeur) => {
        const v = String(bal.getCell(cellule).value ?? '');
        if (v !== valeur)
            defauts.push(`${nom}!${cellule} · « ${v} », attendu « ${valeur} »`);
    };
    attendu(`C${presentation_fpm_1.LIGNE_ENTETE_FPM}`, avant);
    attendu(`E${presentation_fpm_1.LIGNE_ENTETE_FPM}`, 'Mouvements');
    attendu(`G${presentation_fpm_1.LIGNE_ENTETE_FPM}`, 'Soldes cumulés');
    const fond = bal.getCell(presentation_fpm_1.LIGNE_ENTETE_FPM, 1).fill?.fgColor?.argb;
    if (fond !== fondEntete)
        defauts.push(`${nom} · fond d'en-tête ${fond}`);
    if (bal.getCell(presentation_fpm_1.LIGNE_ENTETE_FPM, 1).font?.name !== 'Arial')
        defauts.push(`${nom} · police d'en-tête`);
    const rangs = [];
    bal.eachRow((_row, r) => {
        if (estLigneDeCompte(bal, r))
            rangs.push(r);
    });
    const numeros = rangs.map((r) => String(bal.getCell(r, 1).value));
    const tries = [...numerosAttendus].sort();
    if (numeros.join() !== tries.join())
        defauts.push(`${nom} · comptes ${numeros.join(', ')}, attendus ${tries.join(', ')}`);
    for (const r of rangs) {
        const v = (c) => valeurDe(bal.getCell(r, c));
        if (Math.abs(v(3) - v(4) + v(5) - v(6) - (v(7) - v(8))) > 0.005)
            defauts.push(`${nom} · ligne ${r} ne boucle pas`);
        if (v(7) !== 0 && v(8) !== 0)
            defauts.push(`${nom} · ligne ${r} porte un solde dans les deux colonnes`);
    }
    const libelles = new Set();
    bal.eachRow((row) => libelles.add(String(row.getCell(2).value ?? '')));
    for (const t of ['Totaux comptes de bilan', 'Totaux comptes de gestion', 'Totaux de la balance']) {
        if (!libelles.has(t))
            defauts.push(`${nom} · ligne « ${t} » absente`);
    }
    return defauts;
}
//# sourceMappingURL=relecture-balances-liasse.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLES_GROUPES = exports.ENTREE_EN_VIGUEUR_IFRS18 = exports.RefusIfrs = void 0;
exports.effetsRetraitement = effetsRetraitement;
exports.motifRefusPartsMinoritaires = motifRefusPartsMinoritaires;
exports.rubriqueDuCompte = rubriqueDuCompte;
exports.motifRefusRetraitement = motifRefusRetraitement;
exports.construireEtatsIfrs = construireEtatsIfrs;
const rubriques_ifrs_1 = require("./rubriques-ifrs");
function effetsRetraitement(r) {
    let resultat = 0;
    let oci = 0;
    let capitauxPropres = 0;
    for (const l of r.lignes) {
        const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(l.rubrique);
        if (rb?.etat === 'RESULTAT')
            resultat -= l.montant;
        else if (rb?.etat === 'RESULTAT_GLOBAL')
            oci -= l.montant;
        else if (rb?.section === 'CAPITAUX_PROPRES')
            capitauxPropres -= l.montant;
    }
    return { resultat: r2(resultat), oci: r2(oci), capitauxPropres: r2(capitauxPropres) };
}
function motifRefusPartsMinoritaires(r, consolide) {
    const parts = [r.partMinoritairesResultat, r.partMinoritairesOci, r.partMinoritairesCapitauxPropres];
    if (!consolide) {
        return parts.some((x) => x != null)
            ? `Retraitement « ${r.libelle} » · une part des participations ne donnant pas le contrôle n’existe que dans les comptes consolidés.`
            : null;
    }
    const e = effetsRetraitement(r);
    const couples = [
        [e.resultat, r.partMinoritairesResultat, 'au résultat net'],
        [e.oci, r.partMinoritairesOci, 'aux autres éléments du résultat global'],
        [e.capitauxPropres, r.partMinoritairesCapitauxPropres, 'aux capitaux propres'],
    ];
    for (const [effet, part, ou] of couples) {
        if (Math.abs(effet) <= EPS) {
            if (part != null && Math.abs(part) > EPS)
                return `Retraitement « ${r.libelle} » · une part des minoritaires ${ou} sans effet ${ou}.`;
            continue;
        }
        if (part == null) {
            return `Retraitement « ${r.libelle} » · son effet ${ou} (${effet}) s’attribue aux propriétaires et aux participations ne donnant pas le contrôle (IFRS 10 § B94) · déclarez la part de ces dernières, zéro compris.`;
        }
        if (Math.abs(part) > EPS && (Math.sign(part) !== Math.sign(effet) || Math.abs(part) > Math.abs(effet) + EPS)) {
            return `Retraitement « ${r.libelle} » · la part des minoritaires ${ou} (${part}) a le signe de l’effet (${effet}) et ne le dépasse pas.`;
        }
    }
    return null;
}
class RefusIfrs extends Error {
}
exports.RefusIfrs = RefusIfrs;
const r2 = (x) => Math.round(x * 100) / 100 || 0;
const EPS = 0.005;
const ORDRE_SECTIONS = ['ACTIF_NON_COURANT', 'ACTIF_COURANT', 'CAPITAUX_PROPRES', 'PASSIF_NON_COURANT', 'PASSIF_COURANT'];
const ORDRE_CATEGORIES = ['OPERATIONNELLE', 'INVESTISSEMENT', 'FINANCEMENT', 'IMPOTS', 'ABANDONNEES'];
const ORDRE_CATEGORIES_OCI = ['OCI_RECYCLABLE', 'OCI_NON_RECYCLABLE'];
exports.ENTREE_EN_VIGUEUR_IFRS18 = Date.UTC(2027, 0, 1);
function rubriqueDuCompte(numero, regles) {
    let meilleure = null;
    for (const r of regles) {
        if (numero.startsWith(r.prefixe) && (!meilleure || r.prefixe.length > meilleure.prefixe.length))
            meilleure = r;
    }
    return meilleure?.rubrique ?? null;
}
function motifRefusRetraitement(r) {
    if (!r.fondement?.trim()) {
        return `Retraitement « ${r.libelle} » sans fondement · écrivez la norme et le paragraphe qui l’imposent (par exemple IFRS 16 § 22).`;
    }
    if (r.lignes.length < 2)
        return `Retraitement « ${r.libelle} » · une écriture a au moins deux lignes.`;
    for (const l of r.lignes) {
        if (!rubriques_ifrs_1.RUBRIQUE_PAR_CODE.has(l.rubrique))
            return `Retraitement « ${r.libelle} » · la rubrique « ${l.rubrique} » n’existe pas au catalogue.`;
        if (l.rubrique === rubriques_ifrs_1.RUBRIQUE_NCI) {
            return `Retraitement « ${r.libelle} » · les participations ne donnant pas le contrôle ne se retraitent pas directement · leur part se déclare avec le retraitement (IFRS 10 § B94).`;
        }
        if (!(Math.abs(l.montant) > EPS))
            return `Retraitement « ${r.libelle} » · une ligne sans montant.`;
    }
    const ecart = r2(r.lignes.reduce((s, l) => s + l.montant, 0));
    if (Math.abs(ecart) > EPS)
        return `Retraitement « ${r.libelle} » déséquilibré (écart de ${ecart}) · débits et crédits se balancent.`;
    return null;
}
function construireEtatsIfrs(exercice, lignes, regles, retraitements, activitePrincipale, conso) {
    for (const r of regles) {
        const m = (0, rubriques_ifrs_1.motifRefusRegle)(r.prefixe, r.rubrique);
        if (m)
            throw new RefusIfrs(m);
    }
    for (const r of retraitements) {
        const m = motifRefusRetraitement(r) ?? motifRefusPartsMinoritaires(r, !!conso);
        if (m)
            throw new RefusIfrs(m);
    }
    const legal = new Map();
    const comptes = new Map();
    const nonClasses = [];
    let resultatSyscohada = 0;
    let capitauxPropresSyscohada = 0;
    const estPoste = (numero) => !!conso && !/^\d/.test(numero);
    const estGestion = (numero) => (estPoste(numero) ? conso.estPosteDeResultat(numero) : /^[678]/.test(numero));
    for (const l of lignes) {
        if (Math.abs(l.solde) <= EPS)
            continue;
        if (!estPoste(l.numero) && (/^9/.test(l.numero) || !/^[1-8]/.test(l.numero)))
            continue;
        if (estGestion(l.numero))
            resultatSyscohada -= l.solde;
        const code = estPoste(l.numero) ? conso.rubriqueDuPoste(l.numero) : rubriqueDuCompte(l.numero, regles);
        if (!code) {
            nonClasses.push({ numero: l.numero, intitule: l.intitule, solde: r2(l.solde) });
            continue;
        }
        legal.set(code, r2((legal.get(code) ?? 0) + l.solde));
        if (rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(code).section === 'CAPITAUX_PROPRES')
            capitauxPropresSyscohada -= l.solde;
        comptes.set(code, [...(comptes.get(code) ?? []), { numero: l.numero, intitule: l.intitule, solde: r2(l.solde) }]);
    }
    resultatSyscohada = r2(resultatSyscohada);
    const conversion = conso?.conversionExercice;
    if (conversion) {
        const totale = r2(conversion.groupe + conversion.minoritaires);
        const porter = (code, montant, intitule) => {
            if (Math.abs(montant) <= EPS)
                return;
            legal.set(code, r2((legal.get(code) ?? 0) + montant));
            comptes.set(code, [...(comptes.get(code) ?? []), { numero: 'ECARTS_CONVERSION_EXERCICE', intitule, solde: r2(montant) }]);
        };
        porter('SF_AUTRES_COMPOSANTES_CP', conversion.groupe, 'Écarts de conversion de l’exercice, part du groupe · présentés en autres éléments du résultat global (IAS 21 § 39 c)');
        porter('OCI_R_AUTRES', -r2(totale - conversion.me), 'Écarts de conversion de l’exercice (IAS 21 § 39 c)');
        porter('OCI_R_QUOTE_PART_MEE', -conversion.me, 'Écarts de conversion de l’exercice nés des mises en équivalence (IAS 21 § 39 c, IFRS 18 § 89 a)');
    }
    const retr = new Map();
    for (const r of retraitements)
        for (const l of r.lignes)
            retr.set(l.rubrique, r2((retr.get(l.rubrique) ?? 0) + l.montant));
    const poste = (code, signe) => {
        const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(code);
        const a = r2(signe * (legal.get(code) ?? 0));
        const b = r2(signe * (retr.get(code) ?? 0));
        return { cle: code, libelle: rb.libelle, ref: rb.ref, groupe: rb.section ?? rb.categorie ?? rb.categorieOci, nature: 'POSTE', legal: a, retraitements: b, ifrs: r2(a + b), comptes: comptes.get(code) ?? [] };
    };
    const total = (cle, libelle, xs, ref) => ({
        cle,
        libelle,
        ...(ref ? { ref } : {}),
        nature: 'TOTAL',
        legal: r2(xs.reduce((s, x) => s + x.legal, 0)),
        retraitements: r2(xs.reduce((s, x) => s + x.retraitements, 0)),
        ifrs: r2(xs.reduce((s, x) => s + x.ifrs, 0)),
    });
    const resultat = [];
    const parCategorie = new Map();
    for (const c of ORDRE_CATEGORIES) {
        parCategorie.set(c, rubriques_ifrs_1.RUBRIQUES_IFRS.filter((r) => r.categorie === c).map((r) => poste(r.code, -1)));
    }
    const nonClassesResultat = nonClasses.filter((c) => estGestion(c.numero));
    const ligneNonClasses = (cle, xs, signe) => {
        const v = r2(signe * xs.reduce((s, x) => s + x.solde, 0));
        return { cle, libelle: 'Comptes sans rubrique', nature: 'NON_CLASSE', legal: v, retraitements: 0, ifrs: v };
    };
    const operationnel = [...parCategorie.get('OPERATIONNELLE'), ...(nonClassesResultat.length ? [ligneNonClasses('PL_NON_CLASSES', nonClassesResultat, -1)] : [])];
    const tOp = total('RESULTAT_OPERATIONNEL', 'Résultat opérationnel', operationnel, '§ 69 a, § 70');
    const tAvant = total('RESULTAT_AVANT_FINANCEMENT_IMPOTS', 'Résultat avant financement et impôts sur le résultat', [tOp, ...parCategorie.get('INVESTISSEMENT')], '§ 69 b, § 71');
    const tNet = total('RESULTAT_NET', 'Résultat net', [tAvant, ...parCategorie.get('FINANCEMENT'), ...parCategorie.get('IMPOTS'), ...parCategorie.get('ABANDONNEES')], '§ 69 c, § 72');
    resultat.push(...operationnel, tOp, ...parCategorie.get('INVESTISSEMENT'), tAvant, ...parCategorie.get('FINANCEMENT'), ...parCategorie.get('IMPOTS'), ...parCategorie.get('ABANDONNEES'), tNet);
    const sommeParts = (k) => r2(retraitements.reduce((s, r) => s + (r[k] ?? 0), 0));
    const nci = conso
        ? {
            resultatLegal: r2(conso.resultatMinoritaires),
            ociLegal: r2(conversion?.minoritaires ?? 0),
            resultat: sommeParts('partMinoritairesResultat'),
            oci: sommeParts('partMinoritairesOci'),
            capitauxPropres: sommeParts('partMinoritairesCapitauxPropres'),
        }
        : null;
    const attribution = (cle, libelle, ref, legal, retr) => ({
        cle,
        libelle,
        ref,
        nature: 'POSTE',
        legal: r2(legal),
        retraitements: r2(retr),
        ifrs: r2(legal + retr),
    });
    if (nci) {
        resultat.push(attribution('RN_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', 'Résultat net attribuable aux participations ne donnant pas le contrôle', '§ 76 a', nci.resultatLegal, nci.resultat), attribution('RN_PROPRIETAIRES', 'Résultat net attribuable aux propriétaires de la société mère', '§ 76 b', tNet.legal - nci.resultatLegal, tNet.retraitements - nci.resultat));
    }
    const resultatGlobal = [{ ...tNet, cle: 'RG_RESULTAT_NET', ref: '§ 12 b, § 86 a' }];
    const totauxOci = [];
    for (const c of ORDRE_CATEGORIES_OCI) {
        const xs = rubriques_ifrs_1.RUBRIQUES_IFRS.filter((r) => r.categorieOci === c).map((r) => poste(r.code, -1));
        const t = total(`TOTAL_${c}`, `Total · ${rubriques_ifrs_1.LIBELLE_CATEGORIE_OCI[c].toLowerCase()}`, xs, '§ 88');
        totauxOci.push(t);
        resultatGlobal.push(...xs, t);
    }
    const tOci = total('TOTAL_OCI', 'Autres éléments du résultat global', totauxOci, '§ 86 b');
    const tGlobal = total('RESULTAT_GLOBAL', 'Résultat global', [tNet, tOci], '§ 86 c');
    resultatGlobal.push(tOci, tGlobal);
    if (nci) {
        resultatGlobal.push(attribution('RG_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', 'Résultat global attribuable aux participations ne donnant pas le contrôle', '§ 87 a', nci.resultatLegal + nci.ociLegal, nci.resultat + nci.oci), attribution('RG_PROPRIETAIRES', 'Résultat global attribuable aux propriétaires de la société mère', '§ 87 b', tGlobal.legal - nci.resultatLegal - nci.ociLegal, tGlobal.retraitements - nci.resultat - nci.oci));
    }
    const situation = [];
    const totaux = new Map();
    const nonClassesBilan = nonClasses.filter((c) => !estGestion(c.numero));
    for (const s of ORDRE_SECTIONS) {
        const actif = s.startsWith('ACTIF');
        const xs = rubriques_ifrs_1.RUBRIQUES_IFRS.filter((r) => r.section === s && r.code !== rubriques_ifrs_1.RUBRIQUE_NCI).map((r) => poste(r.code, actif ? 1 : -1));
        if (s === 'CAPITAUX_PROPRES' && !nci) {
            xs.push({ cle: 'SF_RESULTAT', libelle: 'Résultat net de l’exercice', ref: '§ 72', nature: 'POSTE', legal: tNet.legal, retraitements: tNet.retraitements, ifrs: tNet.ifrs });
            xs.push({ cle: 'SF_OCI_EXERCICE', libelle: 'Autres éléments du résultat global de l’exercice', ref: '§ 86 b, § 111', nature: 'POSTE', legal: 0, retraitements: tOci.retraitements, ifrs: tOci.ifrs });
        }
        if (s === 'CAPITAUX_PROPRES' && nci) {
            const reserves = xs.find((x) => x.cle === 'SF_RESERVES');
            reserves.retraitements = r2(reserves.retraitements - nci.capitauxPropres);
            reserves.ifrs = r2(reserves.ifrs - nci.capitauxPropres);
            xs.push(attribution('SF_RESULTAT', 'Résultat net de l’exercice attribuable aux propriétaires de la société mère', '§ 72, § 76 b', tNet.legal - nci.resultatLegal, tNet.retraitements - nci.resultat), attribution('SF_OCI_EXERCICE', 'Autres éléments du résultat global de l’exercice attribuables aux propriétaires', '§ 86 b, § 111', tOci.legal - nci.ociLegal, tOci.retraitements - nci.oci));
            const proprietaires = total('TOTAL_CAPITAUX_PROPRES_PROPRIETAIRES', 'Capitaux propres attribuables aux propriétaires de la société mère', xs, '§ 104 b');
            const m = poste(rubriques_ifrs_1.RUBRIQUE_NCI, -1);
            const minoritaires = {
                ...m,
                libelle: 'Participations ne donnant pas le contrôle (résultat de l’exercice compris)',
                legal: r2(m.legal + nci.resultatLegal),
                retraitements: r2(m.retraitements + nci.resultat + nci.oci + nci.capitauxPropres),
                ifrs: r2(m.ifrs + nci.resultatLegal + nci.resultat + nci.oci + nci.capitauxPropres),
            };
            xs.push(proprietaires, minoritaires);
            const t = total(`TOTAL_${s}`, `Total · ${rubriques_ifrs_1.LIBELLE_SECTION[s].toLowerCase()}`, [proprietaires, minoritaires]);
            totaux.set(s, t);
            situation.push(...xs, t);
            continue;
        }
        const t = total(`TOTAL_${s}`, `Total · ${rubriques_ifrs_1.LIBELLE_SECTION[s].toLowerCase()}`, xs);
        totaux.set(s, t);
        situation.push(...xs, t);
    }
    if (nonClassesBilan.length > 0) {
        const debit = nonClassesBilan.filter((c) => c.solde > 0);
        const credit = nonClassesBilan.filter((c) => c.solde < 0);
        if (debit.length)
            situation.push({ ...ligneNonClasses('SF_NON_CLASSES_ACTIF', debit, 1), libelle: 'Comptes débiteurs sans rubrique' });
        if (credit.length)
            situation.push({ ...ligneNonClasses('SF_NON_CLASSES_PASSIF', credit, -1), libelle: 'Comptes créditeurs sans rubrique' });
    }
    const nc = (cle) => situation.find((l) => l.cle === cle);
    const totalActif = total('TOTAL_ACTIF', 'Total de l’actif', [totaux.get('ACTIF_NON_COURANT'), totaux.get('ACTIF_COURANT'), ...(nc('SF_NON_CLASSES_ACTIF') ? [nc('SF_NON_CLASSES_ACTIF')] : [])]);
    const totalPassif = total('TOTAL_CAPITAUX_PROPRES_PASSIF', 'Total des capitaux propres et du passif', [
        totaux.get('CAPITAUX_PROPRES'),
        totaux.get('PASSIF_NON_COURANT'),
        totaux.get('PASSIF_COURANT'),
        ...(nc('SF_NON_CLASSES_PASSIF') ? [nc('SF_NON_CLASSES_PASSIF')] : []),
    ]);
    situation.push(totalActif, totalPassif);
    const cpIfrs = totaux.get('CAPITAUX_PROPRES').ifrs;
    const cpLegalAvecResultat = r2(capitauxPropresSyscohada + resultatSyscohada);
    const rapprochements = {
        resultatSyscohada,
        retraitementsResultat: tNet.retraitements,
        resultatIfrs: tNet.ifrs,
        capitauxPropresSyscohada: cpLegalAvecResultat,
        retraitementsCapitauxPropres: r2(cpIfrs - cpLegalAvecResultat),
        capitauxPropresIfrs: cpIfrs,
    };
    const controle = (cle, libelle, a, b) => {
        const ecart = r2(a - b);
        return { cle, libelle, ecart, ok: Math.abs(ecart) <= EPS };
    };
    const controles = [
        controle('SITUATION_EQUILIBREE', 'Total de l’actif = total des capitaux propres et du passif', totalActif.ifrs, totalPassif.ifrs),
        controle('RESULTAT_SYSCOHADA', 'Résultat de la balance légale = résultat projeté avant retraitements', resultatSyscohada, tNet.legal),
        ...(conso ? [controle('RESULTAT_ENSEMBLE', 'Résultat projeté = résultat de l’ensemble consolidé (D4C)', resultatSyscohada, conso.resultatEnsemble)] : []),
    ];
    const mentions = [];
    if (exercice.dateDebut.getTime() < exports.ENTREE_EN_VIGUEUR_IFRS18) {
        mentions.push('IFRS 18 est appliquée par anticipation · l’exercice est ouvert avant le 1er janvier 2027, et le fait doit être indiqué dans les notes (IFRS 18 § C1).');
    }
    if (activitePrincipale === 'INVESTIR_ACTIFS') {
        mentions.push('L’entité investit dans des actifs à titre d’activité principale · le fait doit être indiqué (IFRS 18 § 51 a).');
    }
    if (Math.abs(tOci.ifrs) > EPS) {
        mentions.push('Les autres éléments du résultat global sont présentés nets d’impôt (IFRS 18 § 94 a) · l’impôt relatif à chacun, reclassements compris, se donne dans les notes (§ 93), et les reclassements en résultat net aussi s’ils ne sont pas présentés (§ 90).');
    }
    const motifsNonPubliable = [
        'Jeu incomplet · les informations exigées par les autres normes IFRS (IFRS 18 § 113 b), propres à chaque norme appliquée au dossier, ne sont pas servies par OmegaX.',
    ];
    if (activitePrincipale == null) {
        motifsNonPubliable.push('L’activité principale n’est pas déclarée · le classement en catégories opérationnelle, investissement et financement en dépend (IFRS 18 § 49 à 51).');
    }
    if (activitePrincipale === 'FINANCER_CLIENTS') {
        motifsNonPubliable.push('L’entité finance des clients à titre d’activité principale · les choix de méthode des § 56 b et 65 et le sous-total du § 73 ne sont pas servis par cette tranche.');
    }
    if (nonClasses.length > 0) {
        motifsNonPubliable.push(`${nonClasses.length} compte(s) sans rubrique IFRS · ${nonClasses.map((c) => c.numero).join(', ')}.`);
    }
    for (const c of controles.filter((x) => !x.ok))
        motifsNonPubliable.push(`Contrôle en échec · ${c.libelle} (écart ${c.ecart}).`);
    return { situation, resultat, resultatGlobal, nonClasses, rapprochements, controles, mentions, motifsNonPubliable };
}
exports.LIBELLES_GROUPES = { ...rubriques_ifrs_1.LIBELLE_SECTION, ...rubriques_ifrs_1.LIBELLE_CATEGORIE, ...rubriques_ifrs_1.LIBELLE_CATEGORIE_OCI };
//# sourceMappingURL=etats-ifrs.js.map
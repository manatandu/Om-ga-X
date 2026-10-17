"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estANouveau = exports.SELECT_LIGNE = exports.DETTES_FOURNISSEURS_RATTACHEES = exports.MOTIF_PART_HORS_RESULTAT = exports.MOTIF_FACTURE_SANS_CHARGE = exports.MOTIF_A_NOUVEAU_SANS_FACTURE = exports.MOTIF_GROUPE_A_PLUSIEURS_FACTURES = exports.MOTIF_REGLEMENT_NON_LETTRE = void 0;
exports.partRattachable = partRattachable;
exports.entreAuResultat = entreAuResultat;
exports.estDetteFournisseurRattachee = estDetteFournisseurRattachee;
exports.factureDOrigine = factureDOrigine;
exports.naturesDesReglementsFournisseurs = naturesDesReglementsFournisseurs;
exports.depensesRattachees = depensesRattachees;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
exports.MOTIF_REGLEMENT_NON_LETTRE = 'Règlement non lettré avec sa facture · sa nature ne se lit pas.';
exports.MOTIF_GROUPE_A_PLUSIEURS_FACTURES = 'Règlement lettré avec plusieurs factures · aucune répartition entre elles ne se devine.';
exports.MOTIF_A_NOUVEAU_SANS_FACTURE = "Règlement d'une ligne d'à-nouveau dont la facture d'origine ne se retrouve pas une fois et une seule.";
exports.MOTIF_FACTURE_SANS_CHARGE = 'Facture réglée sans ligne de charge lisible.';
exports.MOTIF_PART_HORS_RESULTAT = "Part du règlement d'une facture portée sur un compte qui n'entre pas au résultat (taxe, autre compte de bilan) · elle reste au 40.";
function partRattachable(numero) {
    return entreAuResultat(numero) || numero.startsWith('2');
}
function entreAuResultat(numero) {
    return /^[678]/.test(numero);
}
exports.DETTES_FOURNISSEURS_RATTACHEES = { comptes: ['40'], exclusions: ['404', '408', '409'] };
function estDetteFournisseurRattachee(numero) {
    return (0, etats_financiers_communs_1.correspond)(numero, exports.DETTES_FOURNISSEURS_RATTACHEES.comptes, exports.DETTES_FOURNISSEURS_RATTACHEES.exclusions);
}
const TRANCHE = 500;
const PROFONDEUR_MAX = 10;
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
exports.SELECT_LIGNE = {
    id: true,
    lettrageId: true,
    compteId: true,
    debit: true,
    credit: true,
    libelle: true,
    dateEcheance: true,
    compte: { select: { numero: true } },
    ecriture: {
        select: {
            id: true,
            date: true,
            libelle: true,
            estANouveauProvisoire: true,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: true,
        },
    },
};
const estANouveau = (e) => e.estANouveauProvisoire || (e.estGenereeParCloture && !e.estSoldeDesComptesDeGestion);
exports.estANouveau = estANouveau;
function tranches(xs) {
    const r = [];
    for (let i = 0; i < xs.length; i += TRANCHE)
        r.push(xs.slice(i, i + TRANCHE));
    return r;
}
async function factureDOrigine(db, tenantId, an) {
    let courante = an;
    for (let i = 0; i < PROFONDEUR_MAX; i++) {
        if (!(0, exports.estANouveau)(courante.ecriture))
            return courante;
        const candidates = (await db.ligneEcriture.findMany({
            where: {
                compteId: courante.compteId,
                debit: Number(courante.debit),
                credit: Number(courante.credit),
                dateEcheance: courante.dateEcheance,
                ecriture: { tenantId, date: { lt: courante.ecriture.date }, ...ecritures_de_situation_1.HORS_SITUATION },
            },
            select: exports.SELECT_LIGNE,
            take: 50,
        }));
        const attendu = courante.libelle;
        const retenues = candidates.filter((c) => `RAN détail ${c.compte.numero} · ${c.libelle ?? c.ecriture.libelle}` === attendu);
        if (retenues.length !== 1)
            return null;
        courante = retenues[0];
    }
    return null;
}
async function naturesDesReglementsFournisseurs(db, tenantId, reglements) {
    const resultat = { parLigne: new Map(), nonRattaches: [] };
    if (reglements.length === 0)
        return resultat;
    const nommer = (r, motif) => resultat.nonRattaches.push({ numero: r.numero, montant: r.montant, motif });
    const groupeDe = new Map();
    for (const t of tranches(reglements.map((r) => r.ligneId))) {
        const lues = (await db.ligneEcriture.findMany({
            where: { id: { in: t }, ecriture: { tenantId } },
            select: { id: true, lettrageId: true },
        }));
        for (const l of lues)
            if (l.lettrageId)
                groupeDe.set(l.id, l.lettrageId);
    }
    const groupes = [...new Set(groupeDe.values())];
    const lignesDuGroupe = new Map();
    for (const t of tranches(groupes)) {
        const lues = (await db.ligneEcriture.findMany({
            where: { lettrageId: { in: t }, ecriture: { tenantId } },
            select: exports.SELECT_LIGNE,
        }));
        for (const l of lues) {
            const g = lignesDuGroupe.get(l.lettrageId) ?? [];
            g.push(l);
            lignesDuGroupe.set(l.lettrageId, g);
        }
    }
    const idsReglements = new Set(reglements.map((r) => r.ligneId));
    const factureDuGroupe = new Map();
    for (const [groupe, lignes] of lignesDuGroupe) {
        const factures = lignes.filter((l) => !idsReglements.has(l.id) && centimes(l.credit) - centimes(l.debit) > 0);
        if (factures.length !== 1) {
            factureDuGroupe.set(groupe, factures.length === 0 ? exports.MOTIF_A_NOUVEAU_SANS_FACTURE : exports.MOTIF_GROUPE_A_PLUSIEURS_FACTURES);
            continue;
        }
        const origine = (0, exports.estANouveau)(factures[0].ecriture) ? await factureDOrigine(db, tenantId, factures[0]) : factures[0];
        factureDuGroupe.set(groupe, origine ?? exports.MOTIF_A_NOUVEAU_SANS_FACTURE);
    }
    const ecritures = [
        ...new Set([...factureDuGroupe.values()].filter((f) => typeof f !== 'string').map((f) => f.ecriture.id)),
    ];
    const composition = new Map();
    for (const t of tranches(ecritures)) {
        const lues = (await db.ligneEcriture.findMany({
            where: { ecritureId: { in: t }, ecriture: { tenantId } },
            select: { ecritureId: true, debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
        }));
        for (const l of lues) {
            if (l.compte.numero.startsWith('40'))
                continue;
            const parts = composition.get(l.ecritureId) ?? [];
            const existant = parts.find((p) => p.numero === l.compte.numero);
            const montant = (centimes(l.debit) - centimes(l.credit)) / 100;
            if (existant)
                existant.montant += montant;
            else
                parts.push({ numero: l.compte.numero, intitule: l.compte.intitule, montant });
            composition.set(l.ecritureId, parts);
        }
    }
    for (const r of reglements) {
        const groupe = groupeDe.get(r.ligneId);
        if (!groupe) {
            nommer(r, exports.MOTIF_REGLEMENT_NON_LETTRE);
            continue;
        }
        const facture = factureDuGroupe.get(groupe);
        if (!facture || typeof facture === 'string') {
            nommer(r, facture ?? exports.MOTIF_A_NOUVEAU_SANS_FACTURE);
            continue;
        }
        const parts = (composition.get(facture.ecriture.id) ?? []).filter((p) => Math.abs(p.montant) > 0.005);
        const total = parts.reduce((s, p) => s + p.montant, 0);
        if (total <= 0.005 || parts.some((p) => p.numero.startsWith('5'))) {
            nommer(r, exports.MOTIF_FACTURE_SANS_CHARGE);
            continue;
        }
        const enCentimes = Math.round(r.montant * 100);
        let reste = enCentimes;
        const toutes = parts.map((p, i) => {
            const c = i === parts.length - 1 ? reste : Math.round((enCentimes * p.montant) / total);
            reste -= c;
            return { numero: p.numero, intitule: p.intitule, montant: c / 100 };
        });
        const reparties = toutes.filter((p) => partRattachable(p.numero));
        const horsResultat = toutes.filter((p) => !partRattachable(p.numero)).reduce((t, p) => t + Math.round(p.montant * 100), 0);
        if (horsResultat !== 0)
            resultat.nonRattaches.push({ numero: r.numero, montant: horsResultat / 100, motif: exports.MOTIF_PART_HORS_RESULTAT });
        if (reparties.length === 0)
            continue;
        resultat.parLigne.set(r.ligneId, reparties);
    }
    return resultat;
}
function depensesRattachees(depenses, reglements, natures) {
    const r = new Map([...depenses].map(([k, v]) => [k, { ...v }]));
    const ajouter = (numero, intitule, montant) => {
        const e = r.get(numero);
        if (e)
            e.montant = Math.round((e.montant + montant) * 100) / 100;
        else
            r.set(numero, { numero, intitule, montant });
    };
    for (const reglement of reglements) {
        const parts = natures.parLigne.get(reglement.ligneId);
        if (!parts)
            continue;
        const rattache = parts.reduce((t, p) => t + Math.round(p.montant * 100), 0) / 100;
        const quarante = r.get(reglement.numero);
        if (quarante)
            quarante.montant = Math.round((quarante.montant - rattache) * 100) / 100;
        for (const p of parts)
            ajouter(p.numero, p.intitule, p.montant);
    }
    return r;
}
//# sourceMappingURL=reglements-de-tresorerie.js.map
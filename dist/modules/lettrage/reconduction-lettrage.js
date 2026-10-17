"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_NON_RECONDUITS = exports.SELECT_ORIGINE = exports.OPERATIONS_DE_BASE_CLOTURE = exports.OPERATIONS_PAR_GROUPE_RECONDUIT = exports.LOT_GROUPES = void 0;
exports.restesDesFactures = restesDesFactures;
exports.restesParLImputationLegale = restesParLImputationLegale;
exports.operationsDeLaCloture = operationsDeLaCloture;
exports.parcourirGroupesPartiels = parcourirGroupesPartiels;
exports.resteDuGroupe = resteDuGroupe;
exports.libelleDuReport = libelleDuReport;
exports.apparierAuReport = apparierAuReport;
exports.originesDesLignes = originesDesLignes;
exports.datesDOrigine = datesDOrigine;
exports.poserGroupeReconduit = poserGroupeReconduit;
exports.resteLisible = resteLisible;
exports.messagesDeReconduction = messagesDeReconduction;
exports.groupesQueLaClotureReconduira = groupesQueLaClotureReconduira;
exports.annonceDeReconduction = annonceDeReconduction;
exports.groupesNonReconduits = groupesNonReconduits;
exports.detailNonReconduit = detailNonReconduit;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const imputation_paiements_1 = require("../tva/imputation-paiements");
const ouverture_passee_1 = require("../exercice/ouverture-passee");
const ecart_change_realise_1 = require("../reglements/ecart-change-realise");
const centimes = (x) => Math.round(x * 100);
const unites = (x) => x / 100;
function netterLesNegatifs(payes) {
    const parMonnaie = new Map();
    for (const x of payes)
        parMonnaie.set(x.deviseId ?? '', [...(parMonnaie.get(x.deviseId ?? '') ?? []), x]);
    const nets = [];
    for (const lot of parMonnaie.values()) {
        const positifs = lot.filter((x) => x.francs > 0).map((x) => ({ ...x })).sort(ordreDeReglementDesSommes);
        let francs = lot.filter((x) => x.francs < 0).reduce((t, x) => t - x.francs, 0);
        let devise = lot.filter((x) => x.francs < 0).reduce((t, x) => t + (x.devise ?? 0), 0);
        for (let i = positifs.length - 1; i >= 0 && (francs > 0 || devise > 0); i--) {
            const pf = Math.min(positifs[i].francs, francs);
            positifs[i].francs -= pf;
            francs -= pf;
            if (positifs[i].devise !== null) {
                const pd = Math.min(positifs[i].devise, devise);
                positifs[i].devise = positifs[i].devise - pd;
                devise -= pd;
            }
        }
        for (const x of positifs) {
            if (x.devise !== null && x.devise <= 0 && x.francs > 0)
                nets.push({ ...x, deviseId: null, devise: null, deviseAnnulee: true });
            else if (x.francs > 0 || (x.devise ?? 0) > 0)
                nets.push(x);
        }
    }
    return nets;
}
function ordreDeReglementDesSommes(a, b) {
    return (0, ecart_change_realise_1.ordreDeReglement)({ id: a.cle, date: a.date }, { id: b.cle, date: b.date });
}
function lireLeGroupe(lignes, sens) {
    const colonneFacture = (l) => centimes(sens === 'DEBIT' ? l.debit : l.credit);
    const colonneReglement = (l) => centimes(sens === 'DEBIT' ? l.credit : l.debit);
    const deviseDe = (l) => (l.deviseId !== null && l.montantDevise !== null && l.montantDevise !== 0 ? centimes(Math.abs(l.montantDevise)) : null);
    const cle = (l) => ({ id: l.cle ?? l.id, date: l.date });
    const factures = lignes.filter((l) => colonneFacture(l) > 0).sort((a, b) => (0, ecart_change_realise_1.ordreDeReglement)(cle(a), cle(b)));
    const payes = netterLesNegatifs(lignes.flatMap((l) => {
        const francs = colonneReglement(l) + Math.max(0, -colonneFacture(l));
        if (francs === 0)
            return [];
        const d = deviseDe(l);
        return [{ id: l.id, cle: l.cle ?? l.id, date: l.date, francs, deviseId: d === null ? null : l.deviseId, devise: d }];
    })).sort(ordreDeReglementDesSommes);
    return { factures, payes, colonneFacture, deviseDe };
}
function restesDesFactures(lignes, sens) {
    const { factures, payes, colonneFacture, deviseDe } = lireLeGroupe(lignes, sens);
    const etat = new Map(factures.map((f) => [f.id, { entier: colonneFacture(f), francs: colonneFacture(f), deviseId: deviseDe(f) === null ? null : f.deviseId, devise: deviseDe(f), indeterminee: false }]));
    const ordre = factures.map((f) => etat.get(f.id));
    const enFrancs = [];
    for (const x of payes) {
        if (x.deviseId === null || x.devise === null || x.devise <= 0)
            continue;
        let resteDevise = x.devise;
        const portions = [];
        for (const e of ordre) {
            if (resteDevise <= 0)
                break;
            if (e.deviseId !== x.deviseId || e.devise === null || e.devise <= 0)
                continue;
            const pris = Math.min(resteDevise, e.devise);
            portions.push({ e, devise: pris });
            resteDevise -= pris;
        }
        const francsAuxFactures = resteDevise > 0 ? Math.round((x.francs * (x.devise - resteDevise)) / x.devise) : x.francs;
        if (x.francs - francsAuxFactures > 0)
            enFrancs.push({ ...x, francs: x.francs - francsAuxFactures, deviseId: null, devise: null });
        let aRepartir = francsAuxFactures;
        portions.forEach(({ e, devise }, i) => {
            const part = i < portions.length - 1 ? e.francs : aRepartir;
            e.francs -= part;
            aRepartir -= part;
            e.devise = e.devise - devise;
        });
    }
    for (const x of payes)
        if (x.deviseId === null)
            enFrancs.push(x);
    for (const x of enFrancs.sort(ordreDeReglementDesSommes)) {
        let reste = x.francs;
        for (const e of ordre) {
            if (reste <= 0)
                break;
            if (e.francs <= 0)
                continue;
            const pris = Math.min(reste, e.francs);
            e.francs -= pris;
            reste -= pris;
            if (e.deviseId !== null)
                e.indeterminee = true;
        }
    }
    const restes = new Map();
    for (const f of factures) {
        const e = etat.get(f.id);
        restes.set(f.id, {
            francs: unites(e.francs),
            devise: e.devise === null ? null : unites(e.devise),
            regle: unites(e.entier - e.francs),
            deviseIndeterminee: e.indeterminee,
        });
    }
    return restes;
}
function restesParLImputationLegale(lignes, sens) {
    const { factures, payes, colonneFacture, deviseDe } = lireLeGroupe(lignes, sens);
    const etat = new Map(factures.map((f) => [f.id, { francs: colonneFacture(f), deviseId: deviseDe(f) === null ? null : f.deviseId, devise: deviseDe(f) }]));
    const dette = (f, montant) => ({ id: f.id, dateFacture: f.date, dateEcheance: f.dateEcheance ?? null, montant: unites(montant) });
    const enFrancs = [];
    for (const deviseId of new Set(payes.flatMap((x) => (x.deviseId === null ? [] : [x.deviseId])))) {
        const sommes = payes.filter((x) => x.deviseId === deviseId && (x.devise ?? 0) > 0);
        const siennes = factures.filter((f) => etat.get(f.id).deviseId === deviseId);
        const r = (0, imputation_paiements_1.imputerPaiements)(siennes.map((f) => dette(f, etat.get(f.id).devise)), sommes.map((x) => ({ id: x.id, date: x.date, montant: unites(x.devise) })));
        for (const f of siennes) {
            const e = etat.get(f.id);
            const pris = centimes((r.parDette.get(f.id) ?? []).reduce((t, x) => t + x.montant, 0));
            if (pris <= 0)
                continue;
            e.francs = Math.max(0, e.francs - Math.round((colonneFacture(f) * pris) / deviseDe(f)));
            e.devise = Math.max(0, e.devise - pris);
        }
        for (const n of r.nonImpute) {
            const x = sommes.find((s) => s.id === n.paiementId);
            const francs = Math.round((x.francs * centimes(n.montant)) / x.devise);
            if (francs > 0)
                enFrancs.push({ id: x.id, date: x.date, montant: unites(francs) });
        }
    }
    for (const x of payes)
        if (x.deviseId === null)
            enFrancs.push({ id: x.id, date: x.date, montant: unites(x.francs) });
    if (enFrancs.length > 0) {
        const ouvertes = factures.filter((f) => etat.get(f.id).francs > 0);
        const r = (0, imputation_paiements_1.imputerPaiements)(ouvertes.map((f) => dette(f, etat.get(f.id).francs)), enFrancs);
        for (const f of ouvertes) {
            const e = etat.get(f.id);
            e.francs = Math.max(0, e.francs - centimes((r.parDette.get(f.id) ?? []).reduce((t, x) => t + x.montant, 0)));
        }
    }
    return new Map(factures.map((f) => [f.id, { francs: unites(etat.get(f.id).francs), devise: etat.get(f.id).devise === null ? null : unites(etat.get(f.id).devise) }]));
}
const SELECT_GROUPE = {
    id: true,
    code: true,
    compteId: true,
    ecartChange: true,
    compte: { select: { numero: true, intitule: true } },
    lignes: {
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            dateEcheance: true,
            deviseId: true,
            montantDevise: true,
            libelle: true,
            ecriture: { select: { exerciceId: true, date: true, libelle: true } },
        },
    },
};
exports.LOT_GROUPES = 500;
exports.OPERATIONS_PAR_GROUPE_RECONDUIT = 8;
exports.OPERATIONS_DE_BASE_CLOTURE = 40;
function operationsDeLaCloture(groupesPartiels) {
    return exports.OPERATIONS_DE_BASE_CLOTURE + Math.max(0, groupesPartiels) * exports.OPERATIONS_PAR_GROUPE_RECONDUIT;
}
async function parcourirGroupesPartiels(db, p, traiter) {
    const lecteur = db;
    let curseur;
    for (;;) {
        const lot = (await lecteur.lettrage.findMany({
            where: {
                tenantId: p.tenantId,
                statut: client_1.StatutLettrage.PARTIEL,
                ...(p.compteId ? { compteId: p.compteId } : {}),
                compte: { modeReportANouveau: client_1.ModeReportANouveau.DETAIL },
                lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } },
                NOT: { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: { not: p.exerciceId } } } } },
            },
            select: SELECT_GROUPE,
            ...(0, lecture_par_lots_1.pageApres)(curseur, exports.LOT_GROUPES),
        }));
        const entiers = lot.filter((g) => g.lignes.length > 0 && g.lignes.every((l) => l.ecriture.exerciceId === p.exerciceId));
        if (entiers.length > 0)
            await traiter(entiers);
        if (lot.length < exports.LOT_GROUPES)
            return;
        curseur = lot[lot.length - 1].id;
    }
}
const nombre = (x) => (x === null ? 0 : Number(x));
const auCentime = (x) => Math.round(x * 100) / 100;
function resteDuGroupe(g) {
    return auCentime(g.lignes.reduce((t, l) => t + nombre(l.debit) - nombre(l.credit), 0));
}
function libelleDuReport(compteNumero, l) {
    return `RAN détail ${compteNumero} · ${l.libelle ?? l.ecriture.libelle}`;
}
function apparierAuReport(lignes, candidates, dejaPrises = new Set()) {
    const prises = new Set(dejaPrises);
    const parCompte = new Map();
    for (const c of candidates)
        parCompte.set(c.compteId, [...(parCompte.get(c.compteId) ?? []), c]);
    const memesMontants = (l, c) => c.compteId === l.compteId &&
        centimes(c.debit) === centimes(nombre(l.debit)) &&
        centimes(c.credit) === centimes(nombre(l.credit)) &&
        (c.deviseId ?? null) === (l.deviseId ?? null) &&
        centimes(c.montantDevise ?? 0) === centimes(nombre(l.montantDevise));
    const memeEcheance = (l, c) => (c.dateEcheance?.getTime() ?? null) === (l.dateEcheance?.getTime() ?? null);
    const resultat = lignes.map(() => null);
    const passes = [
        (l, c) => memesMontants(l, c) && memeEcheance(l, c) && c.libelle === libelleDuReport(l.compteNumero, l),
        (l, c) => memesMontants(l, c) && memeEcheance(l, c),
    ];
    for (const passe of passes) {
        lignes.forEach((l, i) => {
            if (resultat[i] !== null)
                return;
            const possibles = (parCompte.get(l.compteId) ?? []).filter((c) => !prises.has(c.id) && passe(l, c));
            const rivales = lignes.filter((u, j) => j !== i && resultat[j] === null && possibles.some((c) => passe(u, c)));
            if (possibles.length === 1 && rivales.length === 0) {
                prises.add(possibles[0].id);
                resultat[i] = possibles[0].id;
            }
        });
    }
    return resultat;
}
exports.SELECT_ORIGINE = {
    id: true,
    lettrageReconduitId: true,
    compte: { select: { numero: true } },
    lignes: {
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            dateEcheance: true,
            deviseId: true,
            montantDevise: true,
            libelle: true,
            ecriture: { select: { exerciceId: true, date: true, libelle: true } },
        },
    },
};
const PROFONDEUR_ORIGINE = 10;
async function originesDesLignes(db, tenantId, groupes) {
    const lecteur = db;
    const origines = new Map();
    let niveau = groupes
        .filter((g) => g.lettrageReconduitId)
        .map((g) => ({ groupe: g, pour: new Map(g.lignes.map((l) => [l.id, l.id])) }));
    for (let k = 0; k < PROFONDEUR_ORIGINE && niveau.length > 0; k++) {
        const groupesN = (await lecteur.lettrage.findMany({
            where: { tenantId, id: { in: [...new Set(niveau.map((n) => n.groupe.lettrageReconduitId))] } },
            select: exports.SELECT_ORIGINE,
        }));
        const suivant = [];
        for (const { groupe, pour } of niveau) {
            const o = groupesN.find((x) => x.id === groupe.lettrageReconduitId);
            if (!o)
                continue;
            const accueil = apparierAuReport(o.lignes.map((l) => ({ ...l, compteNumero: o.compte.numero })), groupe.lignes.map((l) => ({
                id: l.id,
                compteId: l.compteId,
                debit: nombre(l.debit),
                credit: nombre(l.credit),
                dateEcheance: l.dateEcheance,
                deviseId: l.deviseId,
                montantDevise: l.montantDevise === null ? null : nombre(l.montantDevise),
                libelle: l.libelle,
            })));
            const pourO = new Map();
            o.lignes.forEach((l, i) => {
                const depart = accueil[i] ? pour.get(accueil[i]) : undefined;
                if (!depart)
                    return;
                origines.set(depart, { date: l.ecriture.date, id: l.id });
                pourO.set(l.id, depart);
            });
            if (o.lettrageReconduitId && pourO.size > 0)
                suivant.push({ groupe: o, pour: pourO });
        }
        niveau = suivant;
    }
    return origines;
}
async function datesDOrigine(db, tenantId, groupes) {
    return new Map([...(await originesDesLignes(db, tenantId, groupes))].map(([id, o]) => [id, o.date]));
}
async function poserGroupeReconduit(tx, p) {
    const lues = await tx.ligneEcriture.findMany({
        where: { id: { in: p.accueil }, compteId: p.groupe.compteId, lettrageId: null, ecriture: { tenantId: p.tenantId, estANouveauProvisoire: false } },
        select: { id: true, debit: true, credit: true },
        orderBy: { id: 'asc' },
    });
    if (lues.length !== new Set(p.accueil).size) {
        return { code: null, motif: "une de ses lignes d'à-nouveau est déjà lettrée, ou n'est plus une ligne d'à-nouveau définitif" };
    }
    const solde = auCentime(lues.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0));
    const groupe = await tx.lettrage.create({
        data: {
            tenantId: p.tenantId,
            compteId: p.groupe.compteId,
            code: p.code,
            statut: Math.abs(solde) < 0.005 ? client_1.StatutLettrage.SOLDE : client_1.StatutLettrage.PARTIEL,
            solde: Math.abs(solde) < 0.005 ? 0 : solde,
            origine: client_1.OrigineLettrage.CLOTURE,
            createdBy: p.userId,
            soldeAt: Math.abs(solde) < 0.005 ? new Date() : null,
            ecartChange: p.groupe.ecartChange === null ? null : Number(p.groupe.ecartChange),
            lettrageReconduitId: p.groupe.id,
        },
        select: { id: true, statut: true },
    });
    const { count } = await tx.ligneEcriture.updateMany({
        where: { id: { in: p.accueil }, lettrageId: null, ecriture: { tenantId: p.tenantId } },
        data: { lettrageId: groupe.id, lettre: groupe.statut === client_1.StatutLettrage.SOLDE ? p.code : null },
    });
    if (count !== lues.length) {
        throw new common_1.ConflictException(`Reconduction du lettrage ${p.groupe.code.toLowerCase()} · une de ses lignes d'à-nouveau a été lettrée entre la lecture et l'écriture · ` +
            'rien n’est posé. Relancez le geste.');
    }
    return { code: p.code, motif: null };
}
function resteLisible(reste) {
    const montant = Math.abs(reste).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ');
    return `${montant} ${reste >= 0 ? 'au débit' : 'au crédit'}`;
}
function messagesDeReconduction(issues, plafond = 20) {
    const messages = [];
    const reconduits = issues.filter((i) => i.codeReconduit !== null);
    const nonReconduits = issues.filter((i) => i.codeReconduit === null);
    if (reconduits.length > 0) {
        messages.push(`${reconduits.length} lettrage(s) partiel(s) reconduit(s) sur les lignes d'à-nouveau de l'exercice suivant · le tiers y doit son reste, ` +
            "pas la facture entière (AUDCIF art. 34 ; fiches des comptes 40 et 41) · " +
            reconduits
                .slice(0, plafond)
                .map((i) => `compte ${i.groupeN.compte}, ${i.groupeN.code.toLowerCase()} → ${i.codeReconduit.toLowerCase()} (reste ${resteLisible(i.groupeN.reste)})`)
                .join(' ; ') +
            (reconduits.length > plafond ? ` ; et ${reconduits.length - plafond} autre(s)` : '') +
            '.');
    }
    for (const i of nonReconduits.slice(0, plafond)) {
        messages.push(`Lettrage partiel ${i.groupeN.code.toLowerCase()} du compte ${i.groupeN.compte} (reste ${resteLisible(i.groupeN.reste)}) NON reconduit · ${i.motif} · ` +
            "ses lignes sont reportées une à une. Reconduisez-le depuis le pré-lettrage du compte dans l'exercice suivant, ou lettrez-le à la main, " +
            'avant de régler la facture · sans lui, la facture se lit due en entier.');
    }
    if (nonReconduits.length > plafond) {
        messages.push(`Et ${nonReconduits.length - plafond} autre(s) lettrage(s) partiel(s) non reconduit(s), nommés au pré-lettrage et aux contrôles.`);
    }
    return messages;
}
async function groupesQueLaClotureReconduira(db, p, plafond = 20) {
    const groupes = [];
    let total = 0;
    await parcourirGroupesPartiels(db, p, async (lot) => {
        for (const g of lot) {
            total++;
            if (groupes.length < plafond)
                groupes.push({ code: g.code.toLowerCase(), compte: g.compte.numero, reste: resteDuGroupe(g) });
        }
    });
    return { total, groupes };
}
function annonceDeReconduction(r, options = {}) {
    if (r.total === 0)
        return null;
    const comment = options.ouvertureDejaPassee
        ? "seront reconduits par la clôture sur les lignes d'à-nouveau qu'elle écrit, ou sur celles de l'ouverture déjà passée quand elles " +
            "s'apparient sûrement (mêmes montants, devise et échéance) · sinon nommés à la clôture, à relettrer"
        : "seront reconduits par la clôture sur leurs lignes d'à-nouveau définitif";
    return (`${r.total} lettrage(s) partiel(s) de cet exercice ${comment} · ` +
        "le report provisoire ne se lettre pas, et la clôture le remplace (AUDCIF art. 34 ; fiches des comptes 40 et 41) · " +
        r.groupes.map((g) => `compte ${g.compte}, ${g.code} (reste ${resteLisible(g.reste)})`).join(' ; ') +
        (r.total > r.groupes.length ? ` ; et ${r.total - r.groupes.length} autre(s)` : '') +
        '.');
}
exports.PLAFOND_NON_RECONDUITS = 200;
async function groupesNonReconduits(db, p) {
    const plafond = p.plafond ?? exports.PLAFOND_NON_RECONDUITS;
    const lecteur = db;
    const exercices = (await lecteur.exercice.findMany({
        where: { tenantId: p.tenantId },
        select: { id: true, dateDebut: true, dateFin: true, statut: true },
        orderBy: { dateDebut: 'asc' },
    }));
    const resultat = [];
    let total = 0;
    for (let i = 0; i + 1 < exercices.length; i++) {
        const n = exercices[i];
        const suivant = exercices[i + 1];
        if (n.statut !== client_1.StatutExercice.CLOTURE || suivant.statut === client_1.StatutExercice.CLOTURE)
            continue;
        if (p.exerciceSuivantId && suivant.id !== p.exerciceSuivantId)
            continue;
        await parcourirGroupesPartiels(lecteur, { tenantId: p.tenantId, exerciceId: n.id, compteId: p.compteId }, async (lot) => {
            const sansReconduction = (await lecteur.lettrage.findMany({
                where: { tenantId: p.tenantId, lettrageReconduitId: { in: lot.map((g) => g.id) } },
                select: { lettrageReconduitId: true },
            }));
            const reconduits = new Set(sansReconduction.map((r) => r.lettrageReconduitId));
            const aExaminer = lot.filter((g) => !reconduits.has(g.id));
            if (aExaminer.length === 0)
                return;
            const comptes = [...new Set(aExaminer.map((g) => g.compteId))];
            const ouverture = (0, ouverture_passee_1.filtreOuverturePasseeAuPremierJour)(p.tenantId, suivant);
            const candidates = [];
            await (0, lecture_par_lots_1.lireParLots)((curseur) => lecteur.ligneEcriture.findMany({
                where: {
                    compteId: { in: comptes },
                    ecriture: {
                        tenantId: p.tenantId,
                        exerciceId: suivant.id,
                        estANouveauProvisoire: false,
                        estSoldeDesComptesDeGestion: false,
                        OR: [{ estGenereeParCloture: true }, { AND: ouverture.AND, lignes: ouverture.lignes }],
                        correction: { is: null },
                        corrigeEcritureId: null,
                    },
                },
                select: {
                    id: true,
                    ecritureId: true,
                    ecriture: {
                        select: {
                            reevaluationContrePassationDeclaree: {
                                select: {
                                    annuleeLe: true,
                                    ecritureEcarts: { select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } } },
                                },
                            },
                        },
                    },
                    compteId: true,
                    debit: true,
                    credit: true,
                    dateEcheance: true,
                    deviseId: true,
                    montantDevise: true,
                    libelle: true,
                    lettrageId: true,
                    lettre: true,
                    lettrage: { select: { code: true, lettrageReconduitId: true } },
                },
                ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
            }), (c) => candidates.push(c));
            const declarees = new Map();
            for (const c of candidates) {
                const d = c.ecriture?.reevaluationContrePassationDeclaree;
                if (d)
                    declarees.set(c.ecritureId, { id: c.ecritureId, reevaluationContrePassationDeclaree: d });
            }
            const horsOuverture = (0, ouverture_passee_1.lignesDeContrePassationDeclaree)([...declarees.values()]);
            if (horsOuverture.size > 0) {
                const retenues = candidates.filter((c) => !horsOuverture.get(c.ecritureId)?.has(c.compteId));
                candidates.length = 0;
                candidates.push(...retenues);
            }
            const accueils = candidates.map((c) => ({
                id: c.id,
                compteId: c.compteId,
                debit: nombre(c.debit),
                credit: nombre(c.credit),
                dateEcheance: c.dateEcheance,
                deviseId: c.deviseId,
                montantDevise: c.montantDevise === null ? null : nombre(c.montantDevise),
                libelle: c.libelle,
            }));
            const parId = new Map(candidates.map((c) => [c.id, c]));
            const prises = new Set(candidates.filter((c) => c.lettrage?.lettrageReconduitId).map((c) => c.id));
            for (const g of aExaminer) {
                const accueil = apparierAuReport(g.lignes.map((l) => ({ ...l, compteNumero: g.compte.numero })), accueils, prises);
                const tenues = accueil.map((id) => (id ? parId.get(id) : null));
                const groupesTenant = new Set(tenues.flatMap((t) => (t?.lettrageId ? [t.lettrageId] : [])));
                if (accueil.every((id) => id !== null))
                    accueil.forEach((id) => prises.add(id));
                if (tenues.every((t) => t !== null && t.lettrageId !== null) && groupesTenant.size === 1)
                    continue;
                const etat = accueil.some((id) => id === null)
                    ? 'INTROUVABLES'
                    : tenues.some((t) => t?.lettrageId)
                        ? 'LETTREES_AILLEURS'
                        : 'A_RECONDUIRE';
                total++;
                if (resultat.length >= plafond)
                    continue;
                resultat.push({
                    lettrageId: g.id,
                    code: g.code.toLowerCase(),
                    compteId: g.compteId,
                    compteNumero: g.compte.numero,
                    reste: resteDuGroupe(g),
                    exerciceDebut: n.dateDebut,
                    exerciceSuivantDebut: suivant.dateDebut,
                    etat,
                    accueil,
                    lettresAilleurs: [
                        ...new Set(tenues.flatMap((t) => (t?.lettrageId ? [t.lettre ?? (t.lettrage?.code ?? '').toLowerCase()] : []))),
                    ],
                    ecartChange: g.ecartChange === null ? null : Number(g.ecartChange),
                });
            }
        });
    }
    return { groupes: resultat, total, tronque: total > resultat.length };
}
function detailNonReconduit(g) {
    const origine = `lettrage partiel ${g.code} de l'exercice ouvert le ${g.exerciceDebut.toISOString().slice(0, 10)}, reste ${resteLisible(g.reste)}`;
    switch (g.etat) {
        case 'A_RECONDUIRE':
            return `${origine} · ses lignes d'à-nouveau sont libres, et la facture s'y lit due en entier · reconduisez-le au pré-lettrage du compte (« Reconduire »).`;
        case 'LETTREES_AILLEURS':
            return (`${origine} · ses lignes d'à-nouveau sont déjà lettrées ailleurs (${g.lettresAilleurs.join(', ')}) · vérifiez que le règlement passé ne dépasse pas ` +
                'le reste dû, et lettrez-les à la main · rien n\'est délettré d\'office.');
        case 'INTROUVABLES':
            return `${origine} · une de ses lignes n'a pas d'équivalent sûr au report de l'exercice suivant · lettrez-la à la main avec ce qu'elle règle.`;
    }
}
//# sourceMappingURL=reconduction-lettrage.js.map
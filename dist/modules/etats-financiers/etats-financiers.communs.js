"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_RESULTAT_N1_NON_TENU = exports.MOTIF_EXERCICE_INTROUVABLE = void 0;
exports.correspond = correspond;
exports.trouverExerciceN1 = trouverExerciceN1;
exports.exerciceCloture = exerciceCloture;
exports.exercicePrecedentCloture = exercicePrecedentCloture;
exports.exercicePrecedentTenu = exercicePrecedentTenu;
exports.mentionExercicePrecedentVide = mentionExercicePrecedentVide;
exports.brouillardDuPrecedentNonTenu = brouillardDuPrecedentNonTenu;
exports.precedentNonTenuCloture = precedentNonTenuCloture;
exports.motifColonneN1NonTenue = motifColonneN1NonTenue;
exports.lignesALOuverture = lignesALOuverture;
exports.ouvertureTenue = ouvertureTenue;
exports.lireOuverturePasseeEnOd = lireOuverturePasseeEnOd;
exports.lireNegatifsTardifsDeLOuverture = lireNegatifsTardifsDeLOuverture;
exports.mentionNegatifsTardifs = mentionNegatifsTardifs;
exports.avecNegatifsTardifs = avecNegatifsTardifs;
exports.etatDuPrecedentNonTenu = etatDuPrecedentNonTenu;
exports.motifOuverturePasseeEnOd = motifOuverturePasseeEnOd;
exports.controleDuTableauDesFlux = controleDuTableauDesFlux;
exports.mentionOuverturePresumeeNulle = mentionOuverturePresumeeNulle;
exports.comparatifDuBilan = comparatifDuBilan;
exports.mentionComparatifSurOuverture = mentionComparatifSurOuverture;
exports.chargerLignesCumulees = chargerLignesCumulees;
exports.chargerLignes = chargerLignes;
exports.chargerOuverture = chargerOuverture;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const balance_trois_colonnes_1 = require("../comptabilite/balance-trois-colonnes");
const ouverture_passee_1 = require("../exercice/ouverture-passee");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
Object.defineProperty(exports, "MOTIF_EXERCICE_INTROUVABLE", { enumerable: true, get: function () { return exercice_introuvable_1.MOTIF_EXERCICE_INTROUVABLE; } });
function correspond(numero, prefixes, exclusions = []) {
    return prefixes.some((p) => numero.startsWith(p)) && !exclusions.some((e) => numero.startsWith(e));
}
async function trouverExerciceN1(exerciceService, tenantId, exerciceId) {
    const exercices = await exerciceService.lister(tenantId);
    const courant = exercices.find((e) => e.id === exerciceId);
    if (!courant) {
        throw new common_1.NotFoundException(exercice_introuvable_1.MOTIF_EXERCICE_INTROUVABLE);
    }
    const anterieur = exercices.find((e) => e.dateDebut < courant.dateDebut);
    return anterieur?.id ?? null;
}
async function exerciceCloture(exerciceService, tenantId, exerciceId) {
    const exercices = (await exerciceService.lister(tenantId)) ?? [];
    return exercices.find((e) => e.id === exerciceId)?.statut === client_1.StatutExercice.CLOTURE;
}
async function exercicePrecedentCloture(exerciceService, tenantId, exerciceN1Id) {
    return exerciceN1Id ? exerciceCloture(exerciceService, tenantId, exerciceN1Id) : false;
}
function exercicePrecedentTenu(exercicePrecedentId, lignesPrecedent) {
    return exercicePrecedentId !== null && lignesPrecedent.length > 0;
}
function mentionExercicePrecedentVide(referentiel, ouvertureLue, auBrouillard = 0, clos = false) {
    const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
    if (clos) {
        return ouvertureLue
            ? `L'exercice précédent est clôturé sans aucune écriture au livre-journal · les positions d'ouverture sont lues sur le bilan d'ouverture de l'exercice (${article}).`
            : `L'exercice précédent est clôturé sans aucune écriture au livre-journal et l'exercice n'a pas de bilan d'ouverture · les positions d'ouverture, trésorerie comprise, sont lues à zéro (${article}). Un exercice clôturé ne reçoit plus d'écriture · si l'entité tenait des positions à cette date, passez le bilan d'ouverture en à-nouveau.`;
    }
    if (auBrouillard > 0) {
        const etat = `L'exercice précédent n'a que des écritures au brouillard (${auBrouillard}), hors du livre-journal`;
        const issue = "Validez-les (AUDCIF art. 22, 2°) · l'exercice précédent tiendra alors ses positions de clôture.";
        return ouvertureLue
            ? `${etat} · les positions d'ouverture sont lues sur le bilan d'ouverture de l'exercice (${article}). ${issue}`
            : `${etat}, et l'exercice n'a pas de bilan d'ouverture · les positions d'ouverture, trésorerie comprise, sont lues à zéro (${article}). ${issue}`;
    }
    return ouvertureLue
        ? `L'exercice précédent est ouvert sans aucune écriture au livre-journal · les positions d'ouverture sont lues sur le bilan d'ouverture de l'exercice (${article}).`
        : `L'exercice précédent est ouvert sans aucune écriture au livre-journal et l'exercice n'a pas de bilan d'ouverture · les positions d'ouverture, trésorerie comprise, sont lues à zéro (${article}). Importez la balance de clôture de l'exercice précédent et clôturez-le, ou passez le bilan d'ouverture en à-nouveau.`;
}
async function brouillardDuPrecedentNonTenu(ecritureService, tenantId, exerciceN1Id, n1Tenu) {
    if (!exerciceN1Id || n1Tenu)
        return 0;
    return ecritureService.nombreAuBrouillard(tenantId, exerciceN1Id);
}
async function precedentNonTenuCloture(exerciceService, tenantId, exerciceN1Id, n1Tenu) {
    if (!exerciceN1Id || n1Tenu)
        return false;
    return exerciceCloture(exerciceService, tenantId, exerciceN1Id);
}
function motifColonneN1NonTenue(referentiel, auBrouillard = 0, clos = false) {
    const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 7)' : 'AUDCIF art. 34';
    if (clos) {
        return ("L'exercice précédent est clôturé sans aucune écriture au livre-journal · il ne tient ni positions ni flux, " +
            `et sa colonne reste vide, ce n'est pas un zéro (${article}). Un exercice clôturé ne reçoit plus d'écriture.`);
    }
    if (auBrouillard > 0) {
        return (`L'exercice précédent n'a que des écritures au brouillard (${auBrouillard}), hors du livre-journal · il ne tient ni ` +
            `positions ni flux, et sa colonne reste vide, ce n'est pas un zéro (${article}). Validez-les (AUDCIF art. 22, 2°) pour la servir.`);
    }
    return ("L'exercice précédent est ouvert sans aucune écriture au livre-journal · il ne tient ni positions ni flux, " +
        `et sa colonne reste vide, ce n'est pas un zéro (${article}). Importez sa balance de clôture et clôturez-le pour la servir.`);
}
function lignesALOuverture(lignes) {
    return lignes.map((l) => ({
        ...l,
        totalDebit: l.reportDebit,
        totalCredit: l.reportCredit,
        mouvementDebit: 0,
        mouvementCredit: 0,
        solde: l.reportDebit - l.reportCredit,
    }));
}
function ouvertureTenue(lignes) {
    return lignes.some((l) => Math.abs(l.reportDebit) > 0.005 || Math.abs(l.reportCredit) > 0.005);
}
async function lireOuverturePasseeEnOd(ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN) {
    if (exerciceN1Id || ouvertureTenue(ouvertureN))
        return null;
    return ecritureService.ouverturePasseeAuPremierJour(tenantId, exerciceId);
}
async function lireNegatifsTardifsDeLOuverture(ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN) {
    if (exerciceN1Id || ouvertureTenue(ouvertureN))
        return [];
    const position = await ecritureService.positionDOuvertureAuPremierJour(tenantId, exerciceId);
    return position.etat === 'NULLE' ? position.negatifsTardifs : [];
}
function mentionNegatifsTardifs(negatifs, referentiel) {
    if (negatifs.length === 0)
        return null;
    const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
    return (`L'ouverture saisie au premier jour est annulée par son négatif inscrit plus tard (${(0, ouverture_passee_1.negatifsTardifsLisibles)(negatifs)}) · ` +
        "si la position exacte a été ressaisie après le premier jour, elle se lit ici comme des flux de l'exercice et la trésorerie " +
        "d'ouverture reste à zéro. Si c'est le bilan d'ouverture d'un dossier repris, annulez la ressaisie par son négatif et passez " +
        `le bilan en à-nouveau (import du bilan d'ouverture) ; si ce sont des opérations de l'exercice, ce tableau les lit justement (${article} ; AUDCIF art. 20, al. 2).`);
}
function avecNegatifsTardifs(mention, negatifs, referentiel) {
    const ajout = mentionNegatifsTardifs(negatifs, referentiel);
    if (!ajout)
        return mention;
    return mention ? `${mention} ${ajout}` : ajout;
}
async function etatDuPrecedentNonTenu(ecritureService, exerciceService, tenantId, precedentId, tenu) {
    if (!precedentId || tenu)
        return null;
    const [auBrouillard, clos] = await Promise.all([
        brouillardDuPrecedentNonTenu(ecritureService, tenantId, precedentId, tenu),
        precedentNonTenuCloture(exerciceService, tenantId, precedentId, tenu),
    ]);
    return { auBrouillard, clos };
}
function motifOuverturePasseeEnOd(o, referentiel, precedent = null) {
    const article = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34';
    const pieces = o.pieces.join(', ') + (o.nombre > o.pieces.length ? ` et ${o.nombre - o.pieces.length} autre(s)` : '');
    const contexte = !precedent
        ? "sans exercice précédent ni à-nouveau dans le dossier"
        : precedent.clos
            ? "sans à-nouveau, l'exercice précédent étant clôturé sans aucune écriture au livre-journal"
            : precedent.auBrouillard > 0
                ? `sans à-nouveau, l'exercice précédent n'ayant que des écritures au brouillard (${precedent.auBrouillard}), hors du livre-journal`
                : "sans à-nouveau, l'exercice précédent étant ouvert sans aucune écriture au livre-journal";
    const validation = precedent && !precedent.clos && precedent.auBrouillard > 0
        ? " Les écritures au brouillard de l'exercice précédent attendent leur validation · validez-les (AUDCIF art. 22, 2°), " +
            'il tiendra alors ses positions de clôture.'
        : '';
    return (`Le premier jour de l'exercice porte une position de bilan passée en opérations diverses (${pieces}), ` +
        `${contexte} · elle peut être le bilan d'ouverture d'un dossier repris ` +
        `(${article}) ou l'apport qui fait naître l'entité, et rien ne les distingue. Ni la colonne N-1 ni les postes qui lisent ` +
        "l'ouverture ne sont servis. Si c'est un bilan d'ouverture, passez-le en à-nouveau (import du bilan d'ouverture) ; " +
        "si c'est une opération de l'exercice, passez-la par le journal qui l'encaisse ou datez-la du lendemain." +
        validation);
}
function controleDuTableauDesFlux(p) {
    const ouvertureVide = p.vides.has(p.ouverture.ref);
    const variationVide = p.vides.has(p.variation.ref);
    if (!ouvertureVide && !variationVide) {
        const ecart = p.clotureParFlux.montant - p.clotureParBilan;
        return {
            tresorerieOuverture: p.ouverture.montant,
            variation: p.variation.montant,
            tresorerieClotureParFlux: p.clotureParFlux.montant,
            tresorerieClotureParBilan: p.clotureParBilan,
            ecart,
            coherent: Math.abs(ecart) < 0.01,
            motifNonControlable: null,
        };
    }
    const termes = [
        ouvertureVide ? `la trésorerie d'ouverture (${p.ouverture.ref})` : null,
        variationVide ? `la variation de la trésorerie (${p.variation.ref})` : null,
    ].filter((t) => t !== null);
    const sujet = termes.length > 1 ? `${termes.join(' et ')} sont laissées vides` : `${termes[0]} est laissée vide`;
    return {
        tresorerieOuverture: ouvertureVide ? null : p.ouverture.montant,
        variation: variationVide ? null : p.variation.montant,
        tresorerieClotureParFlux: null,
        tresorerieClotureParBilan: p.clotureParBilan,
        ecart: null,
        coherent: null,
        motifNonControlable: `Contrôle non effectué · ${sujet}, la trésorerie de clôture par les flux (${p.clotureParFlux.ref}) n'est pas connue ` +
            "et ne se confronte pas à celle du bilan. Ce n'est ni un écart ni un bouclage.",
    };
}
function mentionOuverturePresumeeNulle(referentiel) {
    return referentiel === 'SYCEBNL'
        ? "Aucun exercice précédent ni bilan d'ouverture dans le dossier · l'ouverture est présumée nulle, celle d'une entité qui naît (SYCEBNL art. 16, 4) ; cadre conceptuel § 3.3.1.2.4). Un dossier repris importe son bilan d'ouverture en à-nouveau."
        : "Aucun exercice précédent ni bilan d'ouverture dans le dossier · l'ouverture est présumée nulle, celle d'une entité qui naît (AUDCIF art. 34). Un dossier repris importe son bilan d'ouverture en à-nouveau.";
}
function comparatifDuBilan(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, referentiel) {
    if (exerciceN1Id)
        return { provenance: 'EXERCICE_N1', lignes: lignesN1, mention: null };
    if (ouvertureTenue(ouvertureN)) {
        return { provenance: 'BILAN_D_OUVERTURE', lignes: lignesALOuverture(ouvertureN), mention: mentionComparatifSurOuverture(referentiel) };
    }
    if (ouverturePassee)
        return { provenance: null, lignes: [], mention: motifOuverturePasseeEnOd(ouverturePassee, referentiel) };
    return { provenance: null, lignes: [], mention: mentionOuverturePresumeeNulle(referentiel) };
}
function mentionComparatifSurOuverture(referentiel) {
    return referentiel === 'SYCEBNL'
        ? "Colonne N-1 lue sur le bilan d'ouverture du dossier, l'exercice précédent n'étant pas tenu dans OmegaX (SYCEBNL, Partie 4 ch. 1 § 1.4 ; cadre conceptuel § 3.3.1.2.4)."
        : "Colonne N-1 lue sur le bilan d'ouverture du dossier, l'exercice précédent n'étant pas tenu dans OmegaX (AUDCIF art. 34).";
}
exports.MOTIF_RESULTAT_N1_NON_TENU = "Exercice précédent non tenu dans OmegaX : son compte de résultat ne se tire pas du bilan d'ouverture. " +
    "Pour servir le comparatif, ouvrez l'exercice précédent, importez-y sa balance de clôture, puis clôturez-le.";
async function chargerLignesCumulees(ecritureService, tenantId, exerciceId) {
    if (!exerciceId)
        return [];
    const { lignes } = await ecritureService.balanceCumulee(tenantId, exerciceId, false);
    return lignes.filter((l) => l.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL);
}
async function chargerLignes(ecritureService, tenantId, exerciceId, arreteAu) {
    if (!exerciceId)
        return [];
    const { lignes } = await ecritureService.balance(tenantId, exerciceId, false, arreteAu);
    return lignesDesEtats(lignes);
}
function lignesDesEtats(lignes) {
    return (0, balance_trois_colonnes_1.avantSoldeDesComptesDeGestion)(lignes).filter((l) => l.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL);
}
async function chargerOuverture(ecritureService, tenantId, exerciceId, arreteAu) {
    if (!exerciceId)
        return [];
    const { lignes } = await ecritureService.balance(tenantId, exerciceId, false, arreteAu, { avantLaCloture: true });
    return lignesALOuverture(lignesDesEtats(lignes));
}
//# sourceMappingURL=etats-financiers.communs.js.map
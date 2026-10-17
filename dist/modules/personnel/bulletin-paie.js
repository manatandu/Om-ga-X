"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_MODELE = exports.LIMITE_UN_BULLETIN_PAR_MOIS = exports.TEXTE_INALTERABILITE = exports.TEXTE_NUMEROTATION = exports.TEXTE_ARTICLE_103 = void 0;
exports.enonciationsDuBulletin = enonciationsDuBulletin;
exports.moisValide = moisValide;
exports.bornesDuMois = bornesDuMois;
exports.contratCouvrantLeMois = contratCouvrantLeMois;
exports.motifsRefusEmission = motifsRefusEmission;
exports.chiffresFigeables = chiffresFigeables;
exports.nomCompletMajuscules = nomCompletMajuscules;
exports.motifRefusRemise = motifRefusRemise;
const echeance_1 = require("../../common/echeance");
exports.TEXTE_ARTICLE_103 = "Code du travail, art. 103 · le décompte écrit se remet « au moment du paiement ». Sans lui, les allégations de " +
    "l'employeur sur les paiements effectués « sont rejetées ».";
exports.TEXTE_NUMEROTATION = "Code du travail, art. 214 · « feuilles numérotées de manière continue ». Un bulletin annulé garde son numéro.";
exports.TEXTE_INALTERABILITE = "Arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 4 · écriture « indélébile ». Un bulletin émis ne se modifie " +
    "pas : il s'annule avec un motif, et un nouveau bulletin le remplace.";
exports.LIMITE_UN_BULLETIN_PAR_MOIS = "Limite d'OmegaX, pas du Code · la retenue de l'article 119 se calcule sur le revenu du mois annualisé. Deux " +
    "bulletins d'un même mois seraient annualisés séparément et l'impôt progressif serait faux. La paie " +
    "infra-mensuelle n'est pas traitée : un seul bulletin actif par salarié et par mois.";
const RANGS_DU_MODELE = 33;
const nombreOuNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const UNITES = { JOUR: 'jour', SEMAINE: 'semaine', MOIS: 'mois', ANNEE: 'an' };
function enonciationsDuBulletin(b) {
    const entree = (b.entree ?? {});
    const calcul = (b.calcul ?? {});
    const portees = [];
    portees.push({ rang: 1, valeur: b.matricule ?? 'non attribué' });
    portees.push({ rang: 2, valeur: b.nomComplet });
    if (b.emploi)
        portees.push({ rang: 3, valeur: [b.emploi, b.categorieProfessionnelle].filter(Boolean).join(' · ') });
    if (b.numeroAffiliationCnss)
        portees.push({ rang: 4, valeur: b.numeroAffiliationCnss });
    const contrat = (calcul.contrat ?? null);
    const base = nombreOuNull(contrat?.remunerationBase);
    const periode = typeof contrat?.periodiciteRemuneration === 'string' ? contrat.periodiciteRemuneration : null;
    if (base !== null && periode !== null) {
        const devise = typeof contrat?.deviseRemuneration === 'string' ? contrat.deviseRemuneration : 'monnaie non déclarée';
        portees.push({ rang: 5, valeur: `${base} ${devise} par ${UNITES[periode] ?? periode}` });
    }
    const jours = nombreOuNull(entree.joursPayes);
    portees.push({ rang: 6, valeur: jours !== null ? `${jours} jour(s)` : '26 jours (mois entier, jours non déclarés)' });
    const cotisations = (calcul.cotisations?.lignes ?? []);
    const pension = cotisations.find((l) => l.cle === 'cnss-pension-travailleur');
    if (pension)
        portees.push({ rang: 21, valeur: String(pension.montantFc) });
    const irpp = calcul.retenue?.retenueFc;
    if (typeof irpp === 'number')
        portees.push({ rang: 25, valeur: String(irpp) });
    const enfants = nombreOuNull(entree.enfantsBeneficiairesAllocations);
    if (enfants !== null)
        portees.push({ rang: 27, valeur: String(enfants) });
    const taux = nombreOuNull(calcul.tauxJournalierAllocationsFamilialesFc);
    if (taux !== null)
        portees.push({ rang: 29, valeur: `${taux} FC par jour et par enfant` });
    const net = nombreOuNull(calcul.net?.netAPayerFc);
    if (net !== null)
        portees.push({ rang: 31, valeur: String(net) });
    const assiette = nombreOuNull(calcul.assiettes?.assietteSocialeFc);
    if (assiette !== null)
        portees.push({ rang: 32, valeur: String(assiette) });
    const rangsPortes = new Set(portees.map((p) => p.rang));
    const nonPortees = Array.from({ length: RANGS_DU_MODELE }, (_, i) => i + 1).filter((r) => !rangsPortes.has(r));
    return { portees, nonPortees };
}
exports.RESERVE_MODELE = "Ce bulletin porte les montants calculés par OmegaX. Il n'est pas certifié conforme au modèle annexé à l'arrêté " +
    "de 2008, dont OmegaX ne vérifie pas la mise en forme, ni aux trente-trois énonciations de ce modèle et de " +
    "l'arrêté n° 142/2018, art. 12, dont il ne porte qu'une partie · celles qu'il ne porte pas sont nommées " +
    "(voir le livre de paie).";
const FORME_MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;
function moisValide(mois) {
    return FORME_MOIS.test(mois);
}
function bornesDuMois(mois) {
    const m = FORME_MOIS.exec(mois);
    if (!m)
        throw new Error(`Mois de paie illisible : ${mois}`);
    const annee = Number(m[1]);
    const index = Number(m[2]) - 1;
    return {
        debut: new Date(Date.UTC(annee, index, 1)),
        fin: new Date(Date.UTC(annee, index + 1, 1) - 1),
    };
}
function contratCouvrantLeMois(contrats, mois) {
    const { debut, fin } = bornesDuMois(mois);
    const couvrants = contrats.filter((c) => c.dateEntreeEnVigueur.getTime() <= fin.getTime() && (!c.dateFin || c.dateFin.getTime() >= debut.getTime()));
    if (couvrants.length === 0)
        return null;
    return [...couvrants].sort((a, b) => b.dateEntreeEnVigueur.getTime() - a.dateEntreeEnVigueur.getTime())[0];
}
function motifsRefusEmission(s) {
    const motifs = [];
    if (!s.baremeApplicable) {
        motifs.push(`Barème de l'impôt inapplicable à ce mois · ${s.motifBaremeInapplicable ?? 'motif non précisé'}`);
    }
    if (s.retenue === null) {
        motifs.push("Retenue de l'article 119 non chiffrée · le bulletin ne peut pas porter un impôt provisoire.");
    }
    for (const a of s.cotisations.abstentions)
        motifs.push(`Cotisation non chiffrée · ${a}`);
    if (s.assiettes.assietteSocialeFc === null) {
        motifs.push("Assiette sociale indéterminée · aucune cotisation ne peut s'y asseoir.");
    }
    if (s.net.netAPayerFc === null)
        motifs.push('Net à payer indéterminé.');
    return motifs;
}
function chiffresFigeables(s) {
    const motifs = motifsRefusEmission(s);
    const assietteSocialeFc = s.assiettes.assietteSocialeFc;
    const netAPayerFc = s.net.netAPayerFc;
    const irppFc = s.retenue === null ? null : s.retenue.retenueFc;
    if (motifs.length > 0 || assietteSocialeFc === null || netAPayerFc === null || irppFc === null) {
        return { motifs: motifs.length > 0 ? motifs : ['Un montant du document est indéterminé.'] };
    }
    return { assietteSocialeFc, netAPayerFc, irppFc };
}
function nomCompletMajuscules(s) {
    return [s.nom, s.postNom, s.prenoms]
        .filter((x) => !!x && x.trim() !== '')
        .map((x) => x.trim())
        .join(' ')
        .toLocaleUpperCase('fr-FR');
}
function motifRefusRemise(remisLe, emisLe, maintenant) {
    if (Number.isNaN(remisLe.getTime()))
        return 'Date de remise illisible.';
    const remis = (0, echeance_1.jourUtc)(remisLe).getTime();
    if (remis < (0, echeance_1.jourDeKinshasa)(emisLe).getTime())
        return "La remise ne peut pas précéder l'émission du bulletin.";
    if (remis > (0, echeance_1.jourDeKinshasa)(maintenant).getTime())
        return "La remise ne se déclare pas à l'avance · elle atteste un fait.";
    return null;
}
//# sourceMappingURL=bulletin-paie.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTE_REPRISE_SUBVENTION = exports.COMPTE_PERTES_AUTRES_DEBITEURS = exports.CONTREPARTIES_OCTROI_PROPOSEES = void 0;
exports.motifRefusCompteSubvention = motifRefusCompteSubvention;
exports.motifRefusContrepartieOctroi = motifRefusContrepartieOctroi;
exports.ventilerAuProrata = ventilerAuProrata;
exports.motifRefusSansVentilation = motifRefusSansVentilation;
exports.motifRefusContrepartieReduction = motifRefusContrepartieReduction;
exports.contrepartieRemboursementProposee = contrepartieRemboursementProposee;
exports.motifRefusReduction = motifRefusReduction;
exports.lignesReduction = lignesReduction;
const centimes = (x) => Math.round(x * 100) / 100;
function motifRefusCompteSubvention(numero, estDetail) {
    if (!numero.startsWith('14')) {
        return "Une subvention d'investissement se lit au compte 14 (AUDCIF Titre VIII ch. 17 § 3.2) · choisissez un compte 14.";
    }
    if (!estDetail)
        return 'Choisissez un compte de détail du 14, pas un compte de regroupement.';
    return null;
}
exports.CONTREPARTIES_OCTROI_PROPOSEES = {
    SYCEBNL: ['47310000'],
    SYSCOHADA: ['44940000', '45820000'],
};
function motifRefusContrepartieOctroi(referentiel, numero) {
    if (referentiel === 'SYCEBNL') {
        return numero.startsWith('4731')
            ? null
            : "L'octroi d'une subvention d'investissement se passe au débit du 4731 « Subventions d'équipement à recevoir » (SYCEBNL, fiche du compte 14).";
    }
    if (!numero.startsWith('4')) {
        return "L'octroi d'une subvention d'investissement se passe au débit d'un compte de tiers de la classe 4, tel que 4494 ou 4582 (AUDCIF Titre VII, fiche du compte 14).";
    }
    if (numero.startsWith('473')) {
        return 'Au SYSCOHADA, le 473 est celui des intermédiaires (mandants, fonds global d\'allocation) · une subvention à recevoir se porte au 4494 (État) ou au 4582 (organismes internationaux).';
    }
    return null;
}
function ventilerAuProrata(montant, biens) {
    const total = biens.reduce((t, b) => t + b.valeurOrigine, 0);
    let reparti = 0;
    return biens.map((b, i) => {
        const part = i === biens.length - 1 ? centimes(montant - reparti) : total > 0 ? centimes((montant * b.valeurOrigine) / total) : 0;
        reparti = centimes(reparti + part);
        return { immobilisationId: b.id, montant: part };
    });
}
function motifRefusSansVentilation(o) {
    if (!o.principalAvecComposants || o.composantsRattaches > 0)
        return null;
    if (o.motif && o.motif.trim().length >= 3)
        return null;
    return "Ce bien a des composants · la subvention se ventile entre eux au prorata, sauf si elle n'est pas significative ou si la ventilation n'est pas possible (AUDCIF Titre VIII ch. 17 § 4.4). Ventilez-la, ou écrivez le motif qui la laisse sur la structure.";
}
function motifRefusContrepartieReduction(referentiel, nature, numero) {
    if (!numero.startsWith('4')) {
        return nature === 'REMBOURSEMENT'
            ? 'La subvention remboursable est une dette envers le concédant · choisissez un compte de tiers (classe 4).'
            : 'La subvention non versée annule une créance sur le concédant · choisissez le compte de tiers qui la porte (classe 4).';
    }
    if (referentiel === 'SYSCOHADA' && nature === 'REMBOURSEMENT' && numero.startsWith('4739')) {
        return "Au SYSCOHADA, le 4739 est le « fonds global d'allocation », pas une subvention à reverser · choisissez le tiers concédant (449 État, 458 organisme international, 4712 sinon).";
    }
    return null;
}
function contrepartieRemboursementProposee(referentiel) {
    return referentiel === 'SYCEBNL' ? '47390000' : null;
}
function motifRefusReduction(o) {
    if (!(o.montant > 0))
        return 'Le montant doit être positif.';
    const plafond = centimes(Math.min(o.resteRattachement, o.soldeNonReprisBien));
    if (centimes(o.montant) > plafond) {
        return `La réduction dépasse ce qui reste de la subvention non reprise sur ce bien (${plafond.toFixed(2)}) · le texte réduit le solde du 14 (AUDCIF Titre VIII ch. 17 § 4.3.1, § 4.7) et ne dit pas où irait l'excédent.`;
    }
    return null;
}
function lignesReduction(o) {
    const m = centimes(o.montant);
    if (o.nature === 'REMBOURSEMENT') {
        return [
            { compteId: o.compte14Id, debit: m, credit: 0 },
            { compteId: o.contrepartieId, debit: 0, credit: m },
        ];
    }
    return [
        { compteId: o.compte6515Id, debit: m, credit: 0 },
        { compteId: o.contrepartieId, debit: 0, credit: m },
        { compteId: o.compte14Id, debit: m, credit: 0 },
        { compteId: o.compte799Id, debit: 0, credit: m },
    ];
}
exports.COMPTE_PERTES_AUTRES_DEBITEURS = '65150000';
exports.COMPTE_REPRISE_SUBVENTION = '79900000';
//# sourceMappingURL=subvention-rattachee.js.map
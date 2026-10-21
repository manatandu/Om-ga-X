"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELAIS_DE_CONFORMITE = exports.AUCUNE_CONDITION_DE_FORME = exports.PRIX_PRESUME_HORS_TAXES = exports.DELAI_NON_CHIFFRE = exports.MOTIF_HORS_SYCEBNL = void 0;
exports.perimetreVenteCommerciale = perimetreVenteCommerciale;
exports.qualifierOffre = qualifierOffre;
exports.dateLimiteAcceptation = dateLimiteAcceptation;
exports.etatDevis = etatDevis;
exports.revocabilite = revocabilite;
function perimetreVenteCommerciale(nature) {
    switch (nature) {
        case 'MARCHANDISES':
            return {
                regiParLeLivre8: true,
                article: 'AUDCG art. 234',
                motif: 'Vente de marchandises entre commerçants · le Livre 8 s’applique, avec ses règles de formation du ' +
                    'contrat (art. 241 à 249) et ses délais de dénonciation (art. 258 et 259).',
            };
        case 'SERVICES':
            return {
                regiParLeLivre8: false,
                article: 'AUDCG art. 234 et 235 b)',
                motif: 'Le Livre 8 ne régit que la vente de MARCHANDISES. Une prestation de services relève du droit commun ' +
                    'des contrats, auquel l’art. 237 renvoie ; aucune des règles de ce module ne lui est opposable, et le ' +
                    'devis reste un document commercial que les parties organisent librement.',
            };
        case 'MIXTE_SERVICES_PREPONDERANTS':
            return {
                regiParLeLivre8: false,
                article: 'AUDCG art. 235 b)',
                motif: 'Le Livre 8 ne régit pas « les contrats de fourniture de marchandises dans lesquels la part ' +
                    'prépondérante de l’obligation […] consiste dans une fourniture de main-d’œuvre ou d’autres ' +
                    'services ». La prépondérance s’apprécie au cas par cas : c’est une qualification du cabinet, pas ' +
                    'un calcul du logiciel.',
            };
        case 'USAGE_PERSONNEL':
            return {
                regiParLeLivre8: false,
                article: 'AUDCG art. 235 a)',
                motif: 'Marchandises achetées pour un usage personnel, familial ou domestique. L’exclusion tombe toutefois ' +
                    'si le vendeur « n’a pas su et n’a pas été censé savoir » cet usage au moment de la conclusion · ' +
                    'c’est une appréciation de fait, laissée au cabinet.',
            };
        case 'REGIME_PARTICULIER':
            return {
                regiParLeLivre8: false,
                article: 'AUDCG art. 236',
                motif: 'Vente soumise à un régime particulier : enchères, saisie ou autorité de justice, valeurs mobilières, ' +
                    'effets de commerce ou monnaies, opérations sur créances ou instruments financiers, navires, bateaux, ' +
                    'aéroglisseurs et aéronefs, électricité.',
            };
    }
}
exports.MOTIF_HORS_SYCEBNL = 'Le Livre 8 de l’AUDCG régit la vente de marchandises ENTRE COMMERÇANTS (art. 234). Une association sans but ' +
    'lucratif n’est pas commerçante · la loi n° 004/2001, art. 1er, dit qu’elle « ne se livre pas à des opérations ' +
    'industrielles ou commerciales, si ce n’est à titre accessoire ». Lui servir cette fenêtre lui appliquerait des ' +
    'règles de formation du contrat et des délais qui ne la régissent pas.';
const renseigne = (v) => typeof v === 'string' && v.trim().length > 0;
const nombre = (v) => typeof v === 'number' && Number.isFinite(v);
function qualifierOffre(d) {
    const manques = [];
    if (!d.destinataireDetermine)
        manques.push('DESTINATAIRE_INDETERMINE');
    if (d.lignes.length === 0 || !d.lignes.every((l) => renseigne(l.designation) && nombre(l.quantite) && nombre(l.prixUnitaire))) {
        manques.push('LIGNES_IMPRECISES');
    }
    if (!d.volonteDEtreLie)
        manques.push('VOLONTE_DETRE_LIE_NON_EXPRIMEE');
    return {
        estUneOffre: manques.length === 0,
        manques,
        article: 'AUDCG art. 241',
        requalification: manques.length === 0
            ? null
            : manques.includes('DESTINATAIRE_INDETERMINE')
                ? 'Proposition adressée à des personnes indéterminées · simple INVITATION À L’OFFRE (art. 241, dernier alinéa).'
                : 'Proposition qui n’atteint pas la précision de l’art. 241 · son acceptation ne formerait aucun contrat.',
    };
}
function dateLimiteAcceptation(dateEmission, delaiJours) {
    if (delaiJours === null || !Number.isFinite(delaiJours))
        return null;
    const limite = new Date(dateEmission.getTime());
    limite.setUTCDate(limite.getUTCDate() + delaiJours);
    return limite;
}
exports.DELAI_NON_CHIFFRE = 'Aucun délai n’a été stipulé. L’art. 243 renvoie alors à un « délai raisonnable, compte tenu des circonstances, ' +
    'notamment de la rapidité des moyens de communication utilisés » · aucune source ne le chiffre, et le logiciel ' +
    'ne le remplace par aucune convention.';
function etatDevis(s) {
    const dateLimite = dateLimiteAcceptation(s.dateEmission, s.delaiJours);
    if (s.natureReponse && s.dateReponse) {
        const tardive = dateLimite !== null &&
            s.dateReponse.getTime() > dateLimite.getTime() &&
            (s.natureReponse === 'ACCEPTATION' || s.natureReponse === 'MODIFICATION_NON_SUBSTANTIELLE');
        if (tardive) {
            return {
                etat: 'CADUC',
                dateLimite,
                article: 'AUDCG art. 243 et 244',
                explication: 'L’acceptation est parvenue après le délai stipulé : l’offre était caduque et aucun contrat n’est formé. ' +
                    'Pour conclure, une offre nouvelle est à émettre ou à recevoir.',
            };
        }
        switch (s.natureReponse) {
            case 'ACCEPTATION':
                return {
                    etat: 'ACCEPTE',
                    dateLimite,
                    article: 'AUDCG art. 244',
                    explication: 'Le contrat est formé : l’acquiescement est parvenu à l’auteur de l’offre.',
                };
            case 'MODIFICATION_NON_SUBSTANTIELLE':
                return {
                    etat: 'ACCEPTE',
                    dateLimite,
                    article: 'AUDCG art. 245, second alinéa',
                    explication: 'Réponse porteuse d’éléments complémentaires ou différents n’altérant pas substantiellement les ' +
                        'termes de l’offre : elle vaut ACCEPTATION, et les termes du contrat sont ceux de l’offre avec les ' +
                        'modifications énoncées dans l’acceptation, à moins que le désaccord n’ait été exprimé sans retard indu.',
                };
            case 'MODIFICATION_SUBSTANTIELLE':
                return {
                    etat: 'CONTRE_PROPOSITION',
                    dateLimite,
                    article: 'AUDCG art. 245, premier alinéa',
                    explication: 'Réponse contenant des additions, limitations ou autres modifications : elle VAUT REJET de l’offre ' +
                        'et constitue une CONTRE-PROPOSITION. C’est désormais au premier offrant d’accepter ou non.',
                };
            case 'REFUS':
                return {
                    etat: 'REFUSE',
                    dateLimite,
                    article: 'AUDCG art. 242',
                    explication: 'L’offre a pris fin : son rejet est parvenu à son auteur.',
                };
        }
    }
    if (s.revoqueLe && s.revoqueLe.getTime() <= s.reference.getTime()) {
        return {
            etat: 'REVOQUE',
            dateLimite,
            article: 'AUDCG art. 242',
            explication: 'L’offre a été révoquée avant toute acceptation.',
        };
    }
    if (dateLimite && s.reference.getTime() > dateLimite.getTime()) {
        return {
            etat: 'CADUC',
            dateLimite,
            article: 'AUDCG art. 243',
            explication: 'Le délai d’acceptation est écoulé sans réponse. Le devis n’est NI accepté NI refusé : « le silence ou ' +
                'l’inaction ne peut à lui seul valoir acceptation », et il ne vaut pas davantage rejet.',
        };
    }
    return {
        etat: 'EN_ATTENTE',
        dateLimite,
        article: 'AUDCG art. 243',
        explication: dateLimite
            ? 'Le délai d’acceptation court encore.'
            : exports.DELAI_NON_CHIFFRE,
    };
}
function revocabilite(params) {
    const reserve = 'Sous réserve de la seconde branche de l’art. 242 : l’offre ne peut pas davantage être révoquée si le ' +
        'destinataire « était raisonnablement fondé à croire que l’offre était irrévocable et a agi en conséquence ». ' +
        'C’est une appréciation de fait, que le logiciel ne tranche pas.';
    if (params.dejaAcceptee) {
        return {
            revocable: false,
            article: 'AUDCG art. 242',
            motif: 'L’acceptation est déjà parvenue à l’auteur de l’offre · la révocation ne produirait plus d’effet.',
            reserve,
        };
    }
    if (params.declareeIrrevocable && params.delaiJours !== null) {
        return {
            revocable: false,
            article: 'AUDCG art. 242',
            motif: 'L’offre fixe un délai déterminé pour l’acceptation ET se déclare irrévocable · les deux conditions du texte sont réunies.',
            reserve,
        };
    }
    return {
        revocable: true,
        article: 'AUDCG art. 242',
        motif: params.declareeIrrevocable
            ? 'L’offre se déclare irrévocable mais ne fixe AUCUN délai déterminé · l’art. 242 exige les deux ensemble.'
            : 'L’offre n’est pas déclarée irrévocable · elle peut être révoquée tant que l’acceptation n’est pas parvenue.',
        reserve,
    };
}
exports.PRIX_PRESUME_HORS_TAXES = {
    article: 'AUDCG art. 263',
    mention: 'Le prix exprimé dans le contrat est présumé convenu hors taxes.',
};
exports.AUCUNE_CONDITION_DE_FORME = {
    article: 'AUDCG art. 240',
    mention: 'Un contrat de vente commerciale peut être écrit ou verbal et n’est soumis à aucune condition de forme. ' +
        'Le devis n’est pas obligatoire : il sert la preuve et l’organisation, pas la régularité de la vente.',
};
exports.DELAIS_DE_CONFORMITE = [
    {
        cle: 'APPARENT',
        libelle: 'Défaut de conformité apparent le jour de la prise de livraison',
        delai: 'un mois à compter de la livraison, sous peine de déchéance',
        article: 'AUDCG art. 258',
    },
    {
        cle: 'CACHE',
        libelle: 'Défaut de conformité caché le jour de la prise de livraison',
        delai: 'un an à compter du jour où le défaut a été constaté ou aurait dû l’être',
        article: 'AUDCG art. 259',
    },
];
//# sourceMappingURL=vente-commerciale.js.map
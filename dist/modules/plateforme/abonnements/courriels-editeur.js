"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.montantFc = montantFc;
exports.dateLisible = dateLisible;
exports.courrielFactureAbonnement = courrielFactureAbonnement;
exports.courrielLicenceSurSite = courrielLicenceSurSite;
const MENTION_NON_HOMOLOGUE = 'Pièce établie par un système de facturation non homologué (décret n° 23/10 du 3 mars 2023, art. 22) · ce n’est pas une facture normalisée.';
function montantFc(n) {
    return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ')} FC`;
}
function dateLisible(iso) {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
}
function courrielFactureAbonnement(f) {
    const corps = [
        'Bonjour,',
        '',
        `Veuillez trouver ci-dessous la facture n° ${f.numeroSerie} du ${dateLisible(f.dateFacture)}, abonnement OmegaX, période ${f.periode}.`,
        '',
        `Émetteur : ${f.emetteurNom}`,
        ...(f.mentionsLigne ? [f.mentionsLigne] : []),
        `Client : ${f.contrepartieNom}`,
        '',
        ...f.lignes.map((l) => `- ${l.designation} · quantité ${l.quantite} · prix unitaire ${montantFc(l.prixUnitaire)} · montant HT ${montantFc(l.montantHT)}` +
            (l.montantTva ? ` · TVA ${montantFc(l.montantTva)}` : '')),
        '',
        `Montant hors TVA : ${montantFc(f.totaux.montantHT)}`,
        `TVA : ${montantFc(f.totaux.montantTva)}`,
        `Montant TTC : ${montantFc(f.totaux.montantTTC)}`,
        `Soit ${f.montantUsd} USD au cours de ${f.cours} FC du ${dateLisible(f.dateFacture)}.`,
        '',
        ...(f.echeanceLicence
            ? [`La licence de votre dossier OmegaX court jusqu’au ${dateLisible(f.echeanceLicence)} ; elle est prolongée à l’encaissement de cette facture.`, '']
            : []),
        MENTION_NON_HOMOLOGUE,
        '',
        f.emetteurNom,
    ].join('\n');
    return { sujet: `Facture ${f.numeroSerie} · abonnement OmegaX ${f.periode}`, corps, pieceJointe: null };
}
function courrielLicenceSurSite(l) {
    const corps = [
        'Bonjour,',
        '',
        `Veuillez trouver en pièce jointe la licence OmegaX n° ${l.numero}.`,
        '',
        `Titulaire : ${l.titulaire}`,
        `Empreinte du poste : ${l.empreinteMachine}`,
        `Émise le : ${dateLisible(l.emiseLe)}`,
        `Fin de maintenance : ${dateLisible(l.finMaintenance)}`,
        `Expiration : ${l.expiration ? dateLisible(l.expiration) : 'aucune (licence perpétuelle)'}`,
        `Dossiers : ${l.dossiersMax}`,
        '',
        'Pour l’installer, ouvrez OmegaX sur le poste serveur et déposez le fichier joint depuis l’écran d’ouverture.',
        'Elle ne vaut que sur le poste dont l’empreinte figure ci-dessus.',
        '',
        'VMG Consulting',
    ].join('\n');
    return {
        sujet: `Licence OmegaX ${l.numero} · ${l.titulaire}`,
        corps,
        pieceJointe: { nom: `licence-${l.numero}.omegax`, texte: l.fichier },
    };
}
//# sourceMappingURL=courriels-editeur.js.map
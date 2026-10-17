"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORMAT_LICENCE = void 0;
exports.serialiser = serialiser;
exports.motifRefusContenu = motifRefusContenu;
exports.signerLicence = signerLicence;
exports.empreinteDe = empreinteDe;
exports.verifierLicence = verifierLicence;
exports.versionCouverte = versionCouverte;
exports.motifRefusMigration = motifRefusMigration;
const crypto_1 = require("crypto");
exports.FORMAT_LICENCE = 1;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const EMPREINTE = /^[0-9a-f]{64}$/;
function serialiser(c) {
    return JSON.stringify([c.format, c.numero, c.titulaire, c.empreinteMachine, c.emiseLe, c.finMaintenance, c.expiration, c.dossiersMax]);
}
function motifRefusContenu(c) {
    if (!c || typeof c !== 'object')
        return 'contenu absent';
    if (c.format !== exports.FORMAT_LICENCE)
        return `format ${String(c.format)} inconnu de cette version`;
    if (typeof c.numero !== 'string' || !c.numero.trim())
        return 'numéro absent';
    if (typeof c.titulaire !== 'string' || !c.titulaire.trim())
        return 'titulaire absent';
    if (typeof c.empreinteMachine !== 'string' || !EMPREINTE.test(c.empreinteMachine))
        return 'empreinte de machine illisible';
    for (const [nom, v] of [['émission', c.emiseLe], ['fin de maintenance', c.finMaintenance]]) {
        if (typeof v !== 'string' || !JOUR.test(v) || Number.isNaN(Date.parse(v)))
            return `date de ${nom} illisible`;
    }
    if (c.expiration !== null && (typeof c.expiration !== 'string' || !JOUR.test(c.expiration) || Number.isNaN(Date.parse(c.expiration)))) {
        return 'date d’expiration illisible';
    }
    if (!Number.isInteger(c.dossiersMax) || c.dossiersMax < 1)
        return 'nombre de dossiers illisible';
    if (c.finMaintenance < c.emiseLe)
        return 'fin de maintenance antérieure à l’émission';
    if (c.expiration && c.expiration < c.emiseLe)
        return 'expiration antérieure à l’émission';
    return null;
}
function signerLicence(contenu, clePriveePem) {
    const m = motifRefusContenu(contenu);
    if (m)
        throw new Error(`Licence irrecevable · ${m}.`);
    const signature = (0, crypto_1.sign)(null, Buffer.from(serialiser(contenu), 'utf8'), (0, crypto_1.createPrivateKey)(clePriveePem)).toString('base64');
    return { contenu, signature };
}
function empreinteDe(identifiantSysteme) {
    return (0, crypto_1.createHash)('sha256').update(`omegax:${identifiantSysteme.trim().toLowerCase()}`).digest('hex');
}
const verdict = (statut, motif, contenu = null) => ({ statut, motif, contenu });
function veille(jour) {
    const d = new Date(`${jour}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function verifierLicence(texte, ctx) {
    if (!ctx.clePubliquePem) {
        return verdict('CLE_EDITEUR_ABSENTE', 'Cette version ne porte pas la clé publique de VMG Consulting · aucune licence ne peut y être vérifiée. Elle ne doit pas être installée chez un client.');
    }
    if (texte === null || !texte.trim()) {
        return verdict('ABSENTE', 'Aucune licence n’est installée sur ce poste. Communiquez l’empreinte de la machine à VMG Consulting pour recevoir votre fichier de licence.');
    }
    let fichier;
    try {
        fichier = JSON.parse(texte);
    }
    catch {
        return verdict('ILLISIBLE', 'Le fichier de licence est illisible · ce n’est pas un fichier émis par VMG Consulting.');
    }
    const m = motifRefusContenu(fichier?.contenu);
    if (m || typeof fichier.signature !== 'string') {
        return verdict('ILLISIBLE', `Le fichier de licence est illisible · ${m ?? 'signature absente'}.`);
    }
    const c = fichier.contenu;
    let signatureOk = false;
    try {
        signatureOk = (0, crypto_1.verify)(null, Buffer.from(serialiser(c), 'utf8'), (0, crypto_1.createPublicKey)(ctx.clePubliquePem), Buffer.from(fichier.signature, 'base64'));
    }
    catch {
        signatureOk = false;
    }
    if (!signatureOk) {
        return verdict('SIGNATURE_INVALIDE', 'La signature de la licence est invalide · le fichier a été modifié, ou il n’a pas été émis par VMG Consulting.');
    }
    if (c.empreinteMachine !== ctx.empreinte) {
        return verdict('AUTRE_MACHINE', `Cette licence (n° ${c.numero}) a été émise pour un autre poste. Elle ne se transfère pas · demandez à VMG Consulting une licence pour l’empreinte de ce poste.`, c);
    }
    if (ctx.horlogeMax && ctx.aujourdhui < veille(ctx.horlogeMax)) {
        return verdict('HORLOGE_RECULEE', `L’horloge de ce poste indique le ${ctx.aujourdhui}, alors que l’installation a déjà fonctionné le ${ctx.horlogeMax}. Remettez le poste à la bonne date.`, c);
    }
    if (c.expiration && ctx.aujourdhui > c.expiration) {
        return verdict('EXPIREE', `La licence n° ${c.numero} a expiré le ${c.expiration}.`, c);
    }
    if (!ctx.dateVersion)
        return verdict('VERSION_INCONNUE', MOTIF_VERSION_INCONNUE, c);
    if (!versionCouverte(c, ctx.dateVersion))
        return verdict('VERSION_NON_COUVERTE', motifVersionNonCouverte(ctx.dateVersion, c), c);
    return verdict('VALIDE', null, c);
}
const MOTIF_VERSION_INCONNUE = 'La date de cette version est inconnue · la couverture par la maintenance ne peut pas être vérifiée. Réinstallez OmegaX depuis un paquet officiel.';
function motifVersionNonCouverte(dateVersion, c) {
    return `Cette version a été publiée le ${dateVersion}, après la fin de maintenance de la licence n° ${c.numero} (${c.finMaintenance}). Renouvelez la maintenance, ou réinstallez une version publiée au plus tard à cette date.`;
}
function versionCouverte(c, dateVersion) {
    return dateVersion !== null && dateVersion <= c.finMaintenance;
}
function motifRefusMigration(v, dateVersion) {
    if (!v.contenu || v.statut === 'AUTRE_MACHINE')
        return null;
    if (versionCouverte(v.contenu, dateVersion))
        return null;
    return dateVersion === null ? MOTIF_VERSION_INCONNUE : motifVersionNonCouverte(dateVersion, v.contenu);
}
//# sourceMappingURL=licence-signee.js.map
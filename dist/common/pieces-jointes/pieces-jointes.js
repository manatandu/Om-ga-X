"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPES_ADMIS = exports.LONGUEUR_MAX_NOM = exports.LONGUEUR_MAX_COMMENTAIRE = exports.TAILLE_MAX_DOCUMENT = void 0;
exports.nettoyerNomFichier = nettoyerNomFichier;
exports.decoderNomMultipart = decoderNomMultipart;
exports.identifierType = identifierType;
exports.motifRefusDocument = motifRefusDocument;
exports.empreinteDocument = empreinteDocument;
exports.dispositionTelechargement = dispositionTelechargement;
exports.entetesTelechargement = entetesTelechargement;
const node_crypto_1 = require("node:crypto");
exports.TAILLE_MAX_DOCUMENT = 5 * 1024 * 1024;
exports.LONGUEUR_MAX_COMMENTAIRE = 69;
exports.LONGUEUR_MAX_NOM = 150;
exports.TYPES_ADMIS = [
    { typeMime: 'application/pdf', extensions: ['pdf'], signature: [0x25, 0x50, 0x44, 0x46] },
    { typeMime: 'image/png', extensions: ['png'], signature: [0x89, 0x50, 0x4e, 0x47] },
    { typeMime: 'image/jpeg', extensions: ['jpg', 'jpeg'], signature: [0xff, 0xd8, 0xff] },
    {
        typeMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: ['docx'],
        signature: [0x50, 0x4b, 0x03, 0x04],
    },
    {
        typeMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extensions: ['xlsx'],
        signature: [0x50, 0x4b, 0x03, 0x04],
    },
    { typeMime: 'application/msword', extensions: ['doc'], signature: [0xd0, 0xcf, 0x11, 0xe0] },
    { typeMime: 'application/vnd.ms-excel', extensions: ['xls'], signature: [0xd0, 0xcf, 0x11, 0xe0] },
];
function nettoyerNomFichier(nom) {
    const dernier = nom.split(/[\\/]/).pop() ?? '';
    const propre = dernier.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
    const points = Array.from(propre);
    if (points.length <= exports.LONGUEUR_MAX_NOM)
        return propre;
    const point = propre.lastIndexOf('.');
    const extension = point > 0 && propre.length - point <= 6 ? propre.slice(point) : '';
    return points.slice(0, exports.LONGUEUR_MAX_NOM - Array.from(extension).length).join('') + extension;
}
function decoderNomMultipart(nom) {
    if (!/[\u0080-\u00ff]/.test(nom) || /[^\u0000-\u00ff]/.test(nom))
        return nom;
    const relu = Buffer.from(nom, 'latin1').toString('utf8');
    return relu.includes('\ufffd') ? nom : relu;
}
function extensionDe(nom) {
    const point = nom.lastIndexOf('.');
    return point > 0 ? nom.slice(point + 1).toLowerCase() : '';
}
function identifierType(contenu, nom) {
    const extension = extensionDe(nom);
    const candidat = exports.TYPES_ADMIS.find((t) => t.extensions.includes(extension));
    if (!candidat) {
        return {
            refus: `Le format « .${extension || '?'} » n'est pas admis. Formats acceptés : ` +
                exports.TYPES_ADMIS.flatMap((t) => t.extensions).map((e) => `.${e}`).join(', ') + '.',
        };
    }
    const conforme = contenu.length >= candidat.signature.length && candidat.signature.every((octet, i) => contenu[i] === octet);
    if (!conforme) {
        return {
            refus: `Le contenu du fichier ne correspond pas à son extension .${extension} · il n'est pas enregistré. ` +
                'Un fichier renommé ne change pas de format.',
        };
    }
    return { typeMime: candidat.typeMime };
}
function motifRefusDocument(piece) {
    const nom = nettoyerNomFichier(piece.nom);
    if (!nom)
        return 'Le fichier n’a pas de nom lisible.';
    if (piece.contenu.length === 0)
        return 'Le fichier est vide.';
    if (piece.contenu.length > exports.TAILLE_MAX_DOCUMENT) {
        return `Le fichier dépasse 5 Mo (${(piece.contenu.length / 1024 / 1024).toFixed(1)} Mo) · réduisez-le ou numérisez-le en plus basse définition.`;
    }
    const commentaire = (piece.commentaire ?? '').trim();
    if (commentaire.length > exports.LONGUEUR_MAX_COMMENTAIRE) {
        return `Le commentaire dépasse ${exports.LONGUEUR_MAX_COMMENTAIRE} caractères (${commentaire.length}).`;
    }
    const type = identifierType(piece.contenu, nom);
    return 'refus' in type ? type.refus : null;
}
function empreinteDocument(contenu) {
    return (0, node_crypto_1.createHash)('sha256').update(contenu).digest('hex');
}
function dispositionTelechargement(nom) {
    const ascii = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}
function entetesTelechargement(piece) {
    return {
        'Content-Type': piece.typeMime,
        'Content-Disposition': dispositionTelechargement(piece.nomFichier),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Access-Control-Expose-Headers': 'Content-Disposition',
    };
}
//# sourceMappingURL=pieces-jointes.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.produireEnMemoire = produireEnMemoire;
const stream_1 = require("stream");
async function produireEnMemoire(ecrire) {
    const sortie = new stream_1.PassThrough();
    const morceaux = [];
    sortie.on('data', (morceau) => morceaux.push(morceau));
    const fermee = new Promise((resoudre, rejeter) => {
        sortie.on('end', () => resoudre());
        sortie.on('error', rejeter);
    });
    fermee.catch(() => { });
    let nomFichier = null;
    try {
        await ecrire((nom) => {
            nomFichier = nom;
            return sortie;
        });
    }
    catch (erreur) {
        sortie.destroy();
        throw erreur;
    }
    if (!sortie.writableEnded) {
        sortie.destroy();
        throw new Error("Le moteur d'export a rendu la main sans terminer son fichier · rien n'est rangé.");
    }
    await fermee;
    if (nomFichier === null) {
        throw new Error("Le moteur d'export n'a ouvert aucun fichier · rien n'a été produit.");
    }
    return { nomFichier, contenu: Buffer.concat(morceaux) };
}
//# sourceMappingURL=fichier-en-memoire.js.map
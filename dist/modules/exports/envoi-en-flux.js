"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETENUE_AVANT_ENVOI = exports.TYPE_XLSX = void 0;
exports.envoyerXlsxEnFlux = envoyerXlsxEnFlux;
const stream_1 = require("stream");
exports.TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
exports.RETENUE_AVANT_ENVOI = 256 * 1024;
class EnvoiRetenu extends stream_1.Writable {
    constructor(res, seuil) {
        super();
        this.res = res;
        this.seuil = seuil;
        this.retenus = [];
        this.taille = 0;
        this.raccorde = false;
    }
    get aCommence() {
        return this.raccorde;
    }
    versLaReponse(morceau, fini) {
        if (this.res.write(morceau))
            fini();
        else
            this.res.once('drain', () => fini());
    }
    lacherLaRetenue() {
        this.raccorde = true;
        const tout = Buffer.concat(this.retenus);
        this.retenus = [];
        return tout;
    }
    _write(morceau, _encodage, fini) {
        if (this.raccorde)
            return this.versLaReponse(morceau, fini);
        this.retenus.push(morceau);
        this.taille += morceau.length;
        if (this.taille < this.seuil)
            return fini();
        this.versLaReponse(this.lacherLaRetenue(), fini);
    }
    _final(fini) {
        if (!this.raccorde)
            this.res.end(this.lacherLaRetenue());
        else
            this.res.end();
        fini();
    }
}
async function envoyerXlsxEnFlux(res, ecrire, seuil = exports.RETENUE_AVANT_ENVOI) {
    const etat = {};
    const fermeeParLePoste = () => {
        if (!res.writableFinished)
            etat.envoi?.destroy(new Error('Téléchargement interrompu par le poste.'));
    };
    try {
        await ecrire((nomFichier) => {
            res.set({
                'Content-Type': exports.TYPE_XLSX,
                'Content-Disposition': `attachment; filename="${nomFichier}"`,
                'Access-Control-Expose-Headers': 'Content-Disposition',
            });
            etat.envoi = new EnvoiRetenu(res, seuil);
            res.once('close', fermeeParLePoste);
            return etat.envoi;
        });
    }
    catch (erreur) {
        const envoi = etat.envoi;
        if (!envoi)
            throw erreur;
        res.off('close', fermeeParLePoste);
        envoi.destroy();
        if (!envoi.aCommence && !res.headersSent) {
            res.removeHeader('Content-Type');
            res.removeHeader('Content-Disposition');
            res.removeHeader('Access-Control-Expose-Headers');
            throw erreur;
        }
        res.destroy(erreur instanceof Error ? erreur : undefined);
    }
}
//# sourceMappingURL=envoi-en-flux.js.map
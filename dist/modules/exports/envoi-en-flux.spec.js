"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const common_1 = require("@nestjs/common");
const ExcelJS = require("exceljs");
const envoi_en_flux_1 = require("./envoi-en-flux");
const classeur_en_flux_1 = require("./classeur-en-flux");
let serveur;
let port;
const moteurs = new Map();
const issues = new Map();
beforeAll(async () => {
    const app = express();
    app.get('/:nom', (req, res, next) => {
        const { moteur, seuil } = moteurs.get(req.params.nom);
        const issue = (0, envoi_en_flux_1.envoyerXlsxEnFlux)(res, moteur, seuil);
        issues.set(req.params.nom, issue);
        issue.catch(next);
    });
    app.use((erreur, _req, res, _next) => {
        const statut = erreur instanceof common_1.HttpException ? erreur.getStatus() : 500;
        res.status(statut).json({ statusCode: statut, message: erreur.message });
    });
    serveur = http.createServer(app);
    await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
    port = serveur.address().port;
});
afterAll(async () => {
    await new Promise((r) => serveur.close(() => r()));
});
function lire(nom) {
    return new Promise((resoudre, rejeter) => {
        http
            .get({ host: '127.0.0.1', port, path: `/${nom}` }, (r) => {
            const morceaux = [];
            r.on('data', (m) => morceaux.push(m));
            r.on('end', () => resoudre({ statut: r.statusCode, entetes: r.headers, corps: Buffer.concat(morceaux) }));
            r.on('error', rejeter);
            r.on('aborted', () => rejeter(new Error('connexion coupée')));
        })
            .on('error', rejeter);
    });
}
async function ecrireDesLignes(sortie, n, terminer) {
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, useSharedStrings: false, useStyles: true });
    const feuille = classeur.addWorksheet('Journal');
    for (let i = 0; i < n; i++) {
        feuille.addRow([`Pièce ${i}`, i * 100, `Libellé de la ligne ${i} · ${'x'.repeat(40)}`]).commit();
        await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
    }
    if (!terminer)
        return;
    feuille.commit();
    await classeur.commit();
}
describe('envoi en flux d’un livre · la décision se prend sur ce qui est parti', () => {
    it('un livre terminé part entier, nommé, en classeur', async () => {
        moteurs.set('entier', { moteur: (ouvrir) => ecrireDesLignes(ouvrir('journal-2026.xlsx'), 20, true) });
        const r = await lire('entier');
        expect(r.statut).toBe(200);
        expect(r.entetes['content-type']).toBe(envoi_en_flux_1.TYPE_XLSX);
        expect(r.entetes['content-disposition']).toBe('attachment; filename="journal-2026.xlsx"');
        const relu = new ExcelJS.Workbook();
        await relu.xlsx.load(r.corps);
        expect(relu.worksheets[0].rowCount).toBe(20);
    });
    it('le refus d’un livre qui n’a rien envoyé atteint l’écran · 409, motif, sans les en-têtes du classeur', async () => {
        moteurs.set('refus', {
            moteur: async (ouvrir) => {
                await ecrireDesLignes(ouvrir('journal-2026.xlsx'), 20, false);
                throw new common_1.ConflictException('Journal : 38 lignes lues sur 40 comptées au départ.');
            },
        });
        const r = await lire('refus');
        expect(r.statut).toBe(409);
        expect(JSON.parse(r.corps.toString()).message).toBe('Journal : 38 lignes lues sur 40 comptées au départ.');
        expect(r.entetes['content-disposition']).toBeUndefined();
        expect(r.entetes['content-type']).toMatch(/application\/json/);
    });
    it('une panne après le premier octet coupe la connexion · jamais une archive tronquée qui s’ouvrirait', async () => {
        moteurs.set('coupe', {
            seuil: 1,
            moteur: async (ouvrir) => {
                await ecrireDesLignes(ouvrir('journal-2026.xlsx'), 2000, false);
                throw new common_1.ConflictException('Journal : 3 998 lignes lues sur 4 000 comptées au départ.');
            },
        });
        await expect(lire('coupe')).rejects.toThrow();
    });
    it('le poste qui ferme le téléchargement arrête le moteur, qui n’attend pas un « drain » sans fin', async () => {
        moteurs.set('ferme', {
            seuil: 1,
            moteur: async (ouvrir) => {
                const sortie = ouvrir('journal-2026.xlsx');
                for (;;) {
                    sortie.write(Buffer.alloc(64 * 1024, 1));
                    await (0, classeur_en_flux_1.attendreLeTuyau)(sortie);
                }
            },
        });
        await new Promise((resoudre) => {
            const requete = http.get({ host: '127.0.0.1', port, path: '/ferme' }, (r) => {
                r.once('data', () => {
                    requete.destroy();
                    resoudre();
                });
            });
            requete.on('error', () => undefined);
        });
        await expect(Promise.race([issues.get('ferme').then(() => 'fini', () => 'fini'), new Promise((r) => setTimeout(() => r('pendu'), 3000))])).resolves.toBe('fini');
    });
});
//# sourceMappingURL=envoi-en-flux.spec.js.map
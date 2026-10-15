import * as express from 'express';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { ConflictException, HttpException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Writable } from 'stream';
import { TYPE_XLSX, envoyerXlsxEnFlux } from './envoi-en-flux';
import { attendreLeTuyau } from './classeur-en-flux';

/**
 * L'ENVOI EN FLUX D'UN LIVRE (relecture TypeScript, mineur 3).
 *
 * Une vraie application Express, une vraie réponse HTTP · « les en-têtes sont
 * partis » ne se simule pas. Le refus d'un livre qui n'a rien envoyé
 * (`confronterAuDecompte`, 409) atteint l'écran avec son motif ; une panne
 * après le premier octet coupe la connexion (Excel refuse l'archive
 * tronquée) ; le poste qui ferme le téléchargement arrête le moteur.
 */

type Moteur = (ouvrir: (nomFichier: string) => Writable) => Promise<unknown>;

let serveur: http.Server;
let port: number;
const moteurs = new Map<string, { moteur: Moteur; seuil?: number }>();
const issues = new Map<string, Promise<unknown>>();

beforeAll(async () => {
  const app = express();
  app.get('/:nom', (req, res, next) => {
    const { moteur, seuil } = moteurs.get(req.params.nom)!;
    const issue = envoyerXlsxEnFlux(res, moteur, seuil);
    issues.set(req.params.nom, issue);
    issue.catch(next);
  });
  // Le filtre d'exception de Nest, réduit à ce qu'il fait d'une HttpException.
  app.use((erreur: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statut = erreur instanceof HttpException ? erreur.getStatus() : 500;
    res.status(statut).json({ statusCode: statut, message: erreur.message });
  });
  serveur = http.createServer(app);
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  port = (serveur.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((r) => serveur.close(() => r()));
});

/** La réponse lue entière · statut, en-têtes, corps ; ou la panne de la connexion. */
function lire(nom: string): Promise<{ statut: number; entetes: http.IncomingHttpHeaders; corps: Buffer }> {
  return new Promise((resoudre, rejeter) => {
    http
      .get({ host: '127.0.0.1', port, path: `/${nom}` }, (r) => {
        const morceaux: Buffer[] = [];
        r.on('data', (m: Buffer) => morceaux.push(m));
        r.on('end', () => resoudre({ statut: r.statusCode!, entetes: r.headers, corps: Buffer.concat(morceaux) }));
        r.on('error', rejeter);
        r.on('aborted', () => rejeter(new Error('connexion coupée')));
      })
      .on('error', rejeter);
  });
}

/** Un classeur écrit comme les livres l'écrivent · une feuille, des lignes validées une à une. */
async function ecrireDesLignes(sortie: Writable, n: number, terminer: boolean) {
  const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, useSharedStrings: false, useStyles: true });
  const feuille = classeur.addWorksheet('Journal');
  for (let i = 0; i < n; i++) {
    feuille.addRow([`Pièce ${i}`, i * 100, `Libellé de la ligne ${i} · ${'x'.repeat(40)}`]).commit();
    await attendreLeTuyau(sortie);
  }
  if (!terminer) return;
  feuille.commit();
  await classeur.commit();
}

describe('envoi en flux d’un livre · la décision se prend sur ce qui est parti', () => {
  it('un livre terminé part entier, nommé, en classeur', async () => {
    moteurs.set('entier', { moteur: (ouvrir) => ecrireDesLignes(ouvrir('journal-2026.xlsx'), 20, true) });
    const r = await lire('entier');
    expect(r.statut).toBe(200);
    expect(r.entetes['content-type']).toBe(TYPE_XLSX);
    expect(r.entetes['content-disposition']).toBe('attachment; filename="journal-2026.xlsx"');
    const relu = new ExcelJS.Workbook();
    await relu.xlsx.load(r.corps as never);
    expect(relu.worksheets[0].rowCount).toBe(20);
  });

  it('le refus d’un livre qui n’a rien envoyé atteint l’écran · 409, motif, sans les en-têtes du classeur', async () => {
    // Le moteur a ouvert son fichier et écrit ses lignes, puis le décompte
    // de départ ne tombe pas juste · la connexion était détruite, et l'écran
    // disait un téléchargement interrompu, jamais le motif.
    moteurs.set('refus', {
      moteur: async (ouvrir) => {
        await ecrireDesLignes(ouvrir('journal-2026.xlsx'), 20, false);
        throw new ConflictException('Journal : 38 lignes lues sur 40 comptées au départ.');
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
      // Une retenue d'un octet · le classeur part dès la première ligne.
      seuil: 1,
      moteur: async (ouvrir) => {
        await ecrireDesLignes(ouvrir('journal-2026.xlsx'), 2000, false);
        throw new ConflictException('Journal : 3 998 lignes lues sur 4 000 comptées au départ.');
      },
    });
    await expect(lire('coupe')).rejects.toThrow();
  });

  it('le poste qui ferme le téléchargement arrête le moteur, qui n’attend pas un « drain » sans fin', async () => {
    moteurs.set('ferme', {
      seuil: 1,
      moteur: async (ouvrir) => {
        const sortie = ouvrir('journal-2026.xlsx');
        // Le moteur écrit sans fin · seule la fermeture par le poste l'arrête.
        for (;;) {
          sortie.write(Buffer.alloc(64 * 1024, 1));
          await attendreLeTuyau(sortie);
        }
      },
    });
    await new Promise<void>((resoudre) => {
      const requete = http.get({ host: '127.0.0.1', port, path: '/ferme' }, (r) => {
        r.once('data', () => {
          requete.destroy();
          resoudre();
        });
      });
      requete.on('error', () => undefined);
    });
    // L'issue de l'envoi se règle (la réponse est détruite), sans attendre.
    await expect(Promise.race([issues.get('ferme')!.then(() => 'fini', () => 'fini'), new Promise((r) => setTimeout(() => r('pendu'), 3000))])).resolves.toBe(
      'fini',
    );
  });
});

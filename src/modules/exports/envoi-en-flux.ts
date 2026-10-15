import { Writable } from 'stream';
import type { Response } from 'express';

export const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Ce que l'envoi RETIENT avant de raccorder le classeur à la réponse · un
 * livre dont le classeur compressé tient en deçà part en un seul envoi, à sa
 * fin, et son refus (le 409 de `confronterAuDecompte`) atteint encore
 * l'écran. Convention d'OmegaX · quatre-vingts téléchargements simultanés
 * sur une instance (`--concurrency 80`, posé par le workflow) n'y retiennent
 * que vingt mébioctets.
 */
export const RETENUE_AVANT_ENVOI = 256 * 1024;

/**
 * LE CLASSEUR VERS LA RÉPONSE, avec une RETENUE (relecture TypeScript,
 * mineur 3). Le moteur écrit dans ce tuyau, jamais dans la réponse · tant que
 * la retenue n'est pas pleine, rien ne part et les en-têtes ne sont pas
 * envoyés ; pleine, elle part d'un coup, et la suite suit au fil de l'eau,
 * réponse lente comprise (le moteur attend le « drain »).
 */
class EnvoiRetenu extends Writable {
  private retenus: Buffer[] = [];
  private taille = 0;
  private raccorde = false;

  constructor(
    private readonly res: Response,
    private readonly seuil: number,
  ) {
    super();
  }

  /** Vrai dès que le premier octet est parti vers la réponse. */
  get aCommence(): boolean {
    return this.raccorde;
  }

  private versLaReponse(morceau: Buffer, fini: (erreur?: Error | null) => void) {
    if (this.res.write(morceau)) fini();
    else this.res.once('drain', () => fini());
  }

  private lacherLaRetenue(): Buffer {
    this.raccorde = true;
    const tout = Buffer.concat(this.retenus);
    this.retenus = [];
    return tout;
  }

  override _write(morceau: Buffer, _encodage: BufferEncoding, fini: (erreur?: Error | null) => void) {
    if (this.raccorde) return this.versLaReponse(morceau, fini);
    this.retenus.push(morceau);
    this.taille += morceau.length;
    if (this.taille < this.seuil) return fini();
    this.versLaReponse(this.lacherLaRetenue(), fini);
  }

  override _final(fini: (erreur?: Error | null) => void) {
    // Un livre tenu sous la retenue part ici, entier, en un envoi.
    if (!this.raccorde) this.res.end(this.lacherLaRetenue());
    else this.res.end();
    fini();
  }
}

/**
 * ENVOI EN FLUX · le classeur part au fur et à mesure qu'il s'écrit.
 *
 * Ce que cela coûte, et qu'il faut assumer plutôt que découvrir : une fois le
 * premier octet parti, LES EN-TÊTES SONT ENVOYÉS. On ne peut plus répondre 500
 * ni poser un message d'erreur · le filtre d'exception de Nest n'a plus de
 * réponse à écrire.
 *
 * D'où le choix fait ici : en cas d'échec en cours de route, on DÉTRUIT la
 * réponse. Le client reçoit un téléchargement interrompu, et le fichier à
 * moitié écrit n'est pas une archive ZIP close · Excel le REFUSE au lieu de
 * l'ouvrir. C'est exactement ce qu'on veut d'un livre obligatoire : un
 * classeur tronqué qui s'ouvre est bien pire qu'un téléchargement qui échoue,
 * parce que personne ne voit ce qui manque.
 *
 * LA DÉCISION SE PREND SUR CE QUI EST PARTI, JAMAIS SUR L'OUVERTURE (mineur
 * 3) · elle se prenait sur « le fichier a été ouvert », si bien que le refus
 * d'un livre qui n'avait encore rien envoyé (`confronterAuDecompte`)
 * détruisait la connexion au lieu de rendre son 409 · l'écran disait un
 * téléchargement interrompu, jamais le motif. Rien n'est parti tant que la
 * retenue tient, et `res.headersSent` le confirme · l'erreur remonte alors au
 * filtre de Nest, les en-têtes du classeur retirés (une réponse JSON
 * étiquetée comme un classeur se lirait comme un fichier abîmé), et le tuyau
 * détruit avant que rien n'en sorte.
 */
export async function envoyerXlsxEnFlux(
  res: Response,
  ecrire: (ouvrir: (nomFichier: string) => Writable) => Promise<unknown>,
  seuil = RETENUE_AVANT_ENVOI,
): Promise<void> {
  const etat: { envoi?: EnvoiRetenu } = {};
  // Le poste qui ferme le téléchargement arrête le moteur · sans quoi il
  // attendrait un « drain » qui ne viendra jamais.
  const fermeeParLePoste = () => {
    if (!res.writableFinished) etat.envoi?.destroy(new Error('Téléchargement interrompu par le poste.'));
  };
  try {
    await ecrire((nomFichier) => {
      res.set({
        'Content-Type': TYPE_XLSX,
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      });
      etat.envoi = new EnvoiRetenu(res, seuil);
      res.once('close', fermeeParLePoste);
      return etat.envoi;
    });
  } catch (erreur) {
    const envoi = etat.envoi;
    if (!envoi) throw erreur;
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

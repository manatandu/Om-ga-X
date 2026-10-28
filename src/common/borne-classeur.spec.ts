import { Workbook } from 'exceljs';
import { deflateRawSync } from 'zlib';
import { MOTIF_CLASSEUR_TROP_GRAND, PLAFOND_CLASSEUR_DEPLIE_OCTETS, verifierClasseurBorne } from './borne-classeur';

/** Une archive zip d'une entrée, écrite à la main · taille annoncée au choix. */
function archive(deplie: Buffer, tailleAnnoncee = deplie.length): Buffer {
  const nom = Buffer.from('xl/worksheets/sheet1.xml');
  const donnees = deflateRawSync(deplie);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(donnees.length, 18);
  local.writeUInt32LE(tailleAnnoncee, 22);
  local.writeUInt16LE(nom.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(donnees.length, 20);
  central.writeUInt32LE(tailleAnnoncee, 24);
  central.writeUInt16LE(nom.length, 28);
  central.writeUInt32LE(0, 42);
  const debutCentral = local.length + nom.length + donnees.length;
  const finRep = Buffer.alloc(22);
  finRep.writeUInt32LE(0x06054b50, 0);
  finRep.writeUInt16LE(1, 8);
  finRep.writeUInt16LE(1, 10);
  finRep.writeUInt32LE(central.length + nom.length, 12);
  finRep.writeUInt32LE(debutCentral, 16);
  return Buffer.concat([local, nom, donnees, central, nom, finRep]);
}

describe('un classeur importé est borné une fois déplié (piste 8 de l’audit du 2026-10-25)', () => {
  it('un vrai classeur passe', async () => {
    const wb = new Workbook();
    const f = wb.addWorksheet('Balance');
    for (let i = 0; i < 500; i++) f.addRow(['411000', `Client ${i}`, i * 100]);
    const contenu = Buffer.from(await wb.xlsx.writeBuffer());
    expect(() => verifierClasseurBorne(contenu)).not.toThrow();
  });

  it('une bombe est refusée sur ce qu’elle déplie, même si elle annonce peu', () => {
    // Quatre mégaoctets de zéros sous un plafond d'un mégaoctet, annoncés pour
    // cent octets · les tailles écrites dans l'archive ne se croient pas.
    const bombe = archive(Buffer.alloc(4 * 1024 * 1024), 100);
    expect(() => verifierClasseurBorne(bombe, 1024 * 1024)).toThrow(MOTIF_CLASSEUR_TROP_GRAND.slice(0, 20));
    expect(() => verifierClasseurBorne(archive(Buffer.alloc(512 * 1024)), 1024 * 1024)).not.toThrow();
  });

  it('ce qui n’est pas une archive est dit illisible, jamais passé à la bibliothèque', () => {
    expect(() => verifierClasseurBorne(Buffer.from('ceci n’est pas un classeur, mais un texte assez long pour tout'))).toThrow(/illisible/);
  });

  it('le plafond dépasse ce que deux cent mille lignes déplient', () => {
    expect(PLAFOND_CLASSEUR_DEPLIE_OCTETS).toBeGreaterThanOrEqual(100 * 1024 * 1024);
  });
});

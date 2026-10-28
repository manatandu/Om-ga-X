import { ecartDeLaPiece, etatDuCheque, motifRefusChequier, motifRefusNumero, numeroImprime, prochainNumeroLibre } from './cheques';
import { ChequesService, filtreEnCirculation } from './cheques.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * REGISTRE DES CHÈQUES ÉMIS (ligne microfina-m2, idée 9). Ce qui casserait en
 * silence · deux carnets qui se recouvrent (deux chèques sous un numéro), un
 * chèque dit encaissé sans que la banque l'ait débité.
 */
describe('le registre des chèques émis · règles pures', () => {
  it('le numéro imprimé garde ses zéros de tête', () => {
    expect(numeroImprime(42, 7)).toBe('0000042');
  });

  it('un carnet ne chevauche aucun autre carnet du même compte', () => {
    expect(motifRefusChequier(101, 150, 7, [{ numeroDebut: 51, numeroFin: 100 }])).toBeNull();
    expect(motifRefusChequier(100, 150, 7, [{ numeroDebut: 51, numeroFin: 100 }])).toMatch(/chevauche/);
    expect(motifRefusChequier(150, 101, 7, [])).toMatch(/précède/);
    expect(motifRefusChequier(1, 100000, 4, [])).toMatch(/ne tient pas sur 4 chiffres/);
    expect(motifRefusChequier(0, 10, 4, [])).toMatch(/positifs/);
  });

  it('un numéro hors du carnet est refusé', () => {
    expect(motifRefusNumero(50, { numeroDebut: 51, numeroFin: 100 })).toMatch(/pas dans le carnet/);
    expect(motifRefusNumero(51, { numeroDebut: 51, numeroFin: 100 })).toBeNull();
  });

  it('le prochain numéro libre parcourt les numéros servis, jamais la plage', () => {
    const carnet = { numeroDebut: 51, numeroFin: 2_000_000_000 };
    expect(prochainNumeroLibre(carnet, [])).toBe(51);
    expect(prochainNumeroLibre(carnet, [51, 52, 54])).toBe(53);
    expect(prochainNumeroLibre({ numeroDebut: 1, numeroFin: 2 }, [1, 2])).toBeNull();
  });

  it("ENCAISSÉ se lit au rapprochement · toutes les lignes de banque de la pièce pointées, et rien d'autre", () => {
    expect(etatDuCheque({ etat: 'ANNULE', aUnePiece: false, lignesBanque: 0, lignesPointees: 0 })).toBe('ANNULE');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: false, lignesBanque: 0, lignesPointees: 0 })).toBe('EMIS_SANS_PIECE');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 1, lignesPointees: 0 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 2, lignesPointees: 1 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 0, lignesPointees: 0 })).toBe('EN_CIRCULATION');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, lignesBanque: 1, lignesPointees: 1 })).toBe('ENCAISSE');
  });
});

describe('routes du registre des chèques', () => {
  it('`numeros/annulation` est déclarée avant `:id/annulation` · sinon Express la lit comme le chèque « numeros »', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ChequesController } = require('./cheques.controller');
    const methodes = Object.getOwnPropertyNames(ChequesController.prototype);
    const chemin = (m: string) => Reflect.getMetadata('path', ChequesController.prototype[m]);
    expect(chemin('annulerNumero')).toBe('numeros/annulation');
    expect(chemin('annuler')).toBe(':id/annulation');
    expect(methodes.indexOf('annulerNumero')).toBeLessThan(methodes.indexOf('annuler'));
  });
});

describe('relecture · chèques émis', () => {
  it('M3 · une pièce corrigée par son négatif lié se lit ANNULÉE AU JOURNAL, jamais encaissée, même tout pointée', () => {
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, pieceCorrigee: true, lignesBanque: 1, lignesPointees: 1 })).toBe('PIECE_ANNULEE');
    expect(etatDuCheque({ etat: 'EMIS', aUnePiece: true, pieceCorrigee: true, lignesBanque: 1, lignesPointees: 0 })).toBe('PIECE_ANNULEE');
  });

  it("M3 · l'annulation du chèque reste ouverte quand l'original et son négatif sont pointés ensemble", async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      chequeEmis: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', etat: 'EMIS', ecritureId: 'e1', pieceDecrite: 'BQ · pièce 4', chequier: { rib: { journal: { compteTresorerieId: 'k52' } } } }),
        update,
      },
      ecriture: { count: jest.fn().mockResolvedValue(1) },
      ligneEcriture: { count: jest.fn().mockResolvedValue(1) },
    } as Record<string, unknown>;
    prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
    const r = await new ChequesService(prisma as unknown as PrismaService).annuler('t1', 'u1', 'c1', { motif: 'Chèque perdu' });
    expect(update).toHaveBeenCalled();
    expect(r.avertissements.join(' ')).toMatch(/déjà inscrite en négatif/);
  });

  it('M4 · la pièce retouchée après le lien se rejuge · montant et journal', () => {
    expect(ecartDeLaPiece({ journalAttenduId: 'j1', journalId: 'j1', creditCentimes: 10_000_000, montantCentimes: 10_000_000 })).toBeNull();
    expect(ecartDeLaPiece({ journalAttenduId: 'j1', journalId: 'j1', creditCentimes: 8_000_000, montantCentimes: 10_000_000 })).toMatch(/80.000,00.*100.000,00/);
    expect(ecartDeLaPiece({ journalAttenduId: 'j1', journalId: 'j2', creditCentimes: 10_000_000, montantCentimes: 10_000_000 })).toMatch(/n'est plus au journal/);
  });

  it('m9 · en circulation à une date · émis au plus tard ce jour, non annulé ni encaissé avant sa fin', () => {
    const f = filtreEnCirculation('k52', '2026-12-31') as { dateEmission: { lte: Date }; AND: unknown[] };
    expect(f.dateEmission.lte.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    const texte = JSON.stringify(f);
    expect(texte).toContain('"annuleLe":{"gte":"2026-12-31T23:00:00.000Z"}');
    expect(texte).toContain('"dateReleve":{"gt":"2026-12-31T00:00:00.000Z"}');
    expect(texte).toContain('"correction"');
    // Sans date · l'état d'aujourd'hui, la pièce corrigée écartée (M3).
    expect(JSON.stringify(filtreEnCirculation('k52'))).toContain('"correction":{"is":null}');
  });

  it('M3 · la base admet un chèque annulé qui garde sa pièce corrigée · trouvé sur vraie base (contrainte 23514, 500)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sql = require('fs').readFileSync(require('path').join(__dirname, '../../../prisma/migrations/20270192000300_cheques_emis/migration.sql'), 'utf8') as string;
    const annule = /\("etat" = 'ANNULE'[^\n]*\)/.exec(sql)?.[0] ?? '';
    expect(annule).toMatch(/motifAnnulation/);
    expect(annule).not.toMatch(/ecritureId/);
  });

  it('M2 · un carnet sur un RIB en devise est refusé, motif nommé', async () => {
    const create = jest.fn();
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      ribBanque: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', abrege: 'RAW USD', devise: 'USD', banque: { intitule: 'Rawbank' }, journal: null }) },
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
      ligneEcriture: { findFirst: jest.fn().mockResolvedValue(null) },
      chequier: { findMany: jest.fn().mockResolvedValue([]), create },
    } as Record<string, unknown>;
    prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
    await expect(
      new ChequesService(prisma as unknown as PrismaService).creerChequier('t1', 'u1', { ribId: 'r1', numeroDebut: 1, numeroFin: 50, largeur: 7, dateReception: '2026-01-05' }),
    ).rejects.toThrow(/tenu en devise \(USD\)/);
    expect(create).not.toHaveBeenCalled();
  });

  it('m1 · un jour inexistant est refusé en 400, jamais en 500', async () => {
    const service = new ChequesService({} as unknown as PrismaService);
    await expect(service.creerChequier('t1', 'u1', { ribId: 'r1', numeroDebut: 1, numeroFin: 5, largeur: 2, dateReception: '2026-13-45' })).rejects.toThrow(/AAAA-MM-JJ/);
    await expect(service.lister('t1', undefined, '2026-02-31')).rejects.toThrow(/AAAA-MM-JJ/);
  });
});

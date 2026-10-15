import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur, StatutEcriture } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTERCEPTORS_METADATA, EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';
import { PiecesJointesService } from './pieces-jointes.service';
import { RefusEnvoi } from './refus-envoi.filter';
import { empreinteDocument, entetesTelechargement } from './pieces-jointes';
import { TABLES_DES_PIECES, type RegleDesPieces } from './table-des-pieces';
import { selectPreImage } from '../audit/extension-audit';
import { COLONNES_EXCLUES_PAR_MODELE, MODELES_AUDITES } from '../audit/champs-audites';
import { MODELES_CLOISONNES } from '../cloisonnement/modeles-cloisonnes';
import { CLE_ACCES_ROLES_CANTONNES } from '../decorators/acces-roles-cantonnes.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  REGLE_PIECES_ECRITURE,
  descriptionDeLEcriture,
  motifRefusDepotEcriture,
  motifRefusRetraitEcriture,
  type EcritureDesPieces,
} from '../../modules/comptabilite/pieces-jointes-ecriture';
import { REGLE_PIECES_SECTION } from '../../modules/analytique/pieces-jointes-section';
import { REGLE_PIECES_IMMOBILISATION } from '../../modules/immobilisations/pieces-jointes-immobilisation';
import { REGLE_PIECES_SALARIE } from '../../modules/personnel/pieces-jointes-salarie';
import { PiecesJointesEcritureController } from '../../modules/comptabilite/pieces-jointes-ecriture.controller';
import { PiecesJointesSectionController } from '../../modules/analytique/pieces-jointes-section.controller';
import { PiecesJointesImmobilisationController } from '../../modules/immobilisations/pieces-jointes-immobilisation.controller';
import { PiecesJointesSalarieController } from '../../modules/personnel/pieces-jointes-salarie.controller';
import { COLONNES_QUI_RETIENNENT, ECRITURE_LAISSEE_PARTIR } from '../../modules/comptabilite/detenteurs-ecriture';

/**
 * LES PIÈCES JOINTES DES ÉCRITURES, SECTIONS, BIENS ET SALARIÉS (ligne
 * sage-l6, fonction n° 22). Ce qui casserait en silence · un binaire dans une
 * liste ou au journal d'audit, une pièce d'écriture validée retirée, un
 * retrait jugé hors de la transaction qui retire, une table sans borne de
 * dossier, une route d'écriture sans rôle, le registre du personnel ouvert à
 * l'aide-comptable par ses documents.
 */

const PDF = Buffer.from('%PDF-1.7\n%contenu');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

function ecriture(partiel: Partial<EcritureDesPieces> = {}): EcritureDesPieces {
  return {
    statut: StatutEcriture.BROUILLARD,
    estANouveauProvisoire: false,
    numeroPiece: 12,
    date: new Date('2026-03-04T00:00:00Z'),
    libelle: 'Facture SNEL mars',
    journal: { code: 'ACH' },
    ...partiel,
  };
}

/** Une table de pièces factice · elle honore `where` (dossier et identifiant). */
function tableFactice(lignes: Array<Record<string, unknown>>) {
  const appels: Record<string, any[]> = { findMany: [], findFirst: [], count: [], create: [], update: [], delete: [], deleteMany: [] };
  const cle = (a: any) => (l: Record<string, unknown>) => Object.entries(a.where ?? {}).every(([k, v]) => l[k] === v);
  return {
    appels,
    lignes,
    findMany: jest.fn(async (a: any) => (appels.findMany.push(a), lignes.filter(cle(a)))),
    findFirst: jest.fn(async (a: any) => (appels.findFirst.push(a), lignes.find(cle(a)) ?? null)),
    count: jest.fn(async (a: any) => (appels.count.push(a), lignes.filter(cle(a)).length)),
    create: jest.fn(async (a: any) => (appels.create.push(a), { id: 'nouvelle', ...a.data })),
    update: jest.fn(async (a: any) => (appels.update.push(a), { id: a.where.id })),
    delete: jest.fn(async (a: any) => (appels.delete.push(a), { id: a.where.id })),
    deleteMany: jest.fn(async (a: any) => (appels.deleteMany.push(a), { count: 0 })),
  };
}

function prismaFactice(opts: {
  statut?: StatutEcriture;
  aNouveauProvisoire?: boolean;
  ecritureExiste?: boolean;
  pieces?: Array<Record<string, unknown>>;
  conflit?: string;
} = {}) {
  const ordre: string[] = [];
  const pieces = tableFactice(opts.pieces ?? []);
  if (opts.conflit) {
    pieces.create.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('x', { code: opts.conflit!, clientVersion: 'x' });
    });
  }
  const client: any = {
    ecriture: {
      findFirst: jest.fn(async (a: any) => {
        ordre.push('lire');
        if (opts.ecritureExiste === false || a.where.tenantId !== 't') return null;
        return ecriture({ statut: opts.statut ?? StatutEcriture.BROUILLARD, estANouveauProvisoire: !!opts.aNouveauProvisoire });
      }),
    },
    $queryRaw: jest.fn(async () => {
      ordre.push('verrou');
      return [];
    }),
    pieceJointeEcriture: pieces,
    pieceJointeSection: tableFactice([]),
    pieceJointeImmobilisation: tableFactice([]),
    pieceJointeSalarie: tableFactice([]),
    evenementAudit: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
  };
  client.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    ordre.push('transaction');
    return fn(client);
  });
  return { client, pieces, ordre };
}

describe('pièces jointes · la règle de l’écriture (AUDCIF art. 17, 22 et 24)', () => {
  it('une écriture validée ne laisse plus partir sa pièce, et le refus cite ses articles', () => {
    const motif = motifRefusRetraitEcriture(ecriture({ statut: StatutEcriture.VALIDEE }));
    expect(motif).toContain('ACH n° 12');
    expect(motif).toContain('AUDCIF art. 22, 2° et 7° ; art. 24');
  });

  it('au brouillard et en situation, la pièce se retire · ni l’une ni l’autre n’est au livre-journal', () => {
    expect(motifRefusRetraitEcriture(ecriture({ statut: StatutEcriture.BROUILLARD }))).toBeNull();
    expect(motifRefusRetraitEcriture(ecriture({ statut: StatutEcriture.SITUATION }))).toBeNull();
  });

  it('toute écriture reçoit sa pièce, validée comprise · seul l’à-nouveau provisoire la refuse', () => {
    expect(motifRefusDepotEcriture(ecriture({ statut: StatutEcriture.VALIDEE }))).toBeNull();
    expect(motifRefusDepotEcriture(ecriture({ estANouveauProvisoire: true }))).toContain("l'écriture d'ouverture qui fait foi");
  });

  it('la description dit journal, numéro, date et libellé, bornée en points de code', () => {
    expect(descriptionDeLEcriture(ecriture())).toBe('ACH n° 12 du 04/03/2026 · Facture SNEL mars');
    expect(descriptionDeLEcriture(ecriture({ numeroPiece: null }))).toContain('sans numéro');
    const longue = descriptionDeLEcriture(ecriture({ libelle: '😀'.repeat(400) }));
    expect(Array.from(longue)).toHaveLength(190);
    expect(() => encodeURIComponent(longue)).not.toThrow();
  });
});

describe('pièces jointes · le service commun', () => {
  it('une liste ne transporte jamais le contenu, reste au dossier, et dit ce que l’objet permet', async () => {
    const { client, pieces } = prismaFactice({ statut: StatutEcriture.VALIDEE });
    const r = await new PiecesJointesService(client).lister('t', REGLE_PIECES_ECRITURE, 'e-1');
    expect(pieces.appels.findMany[0].where).toEqual({ tenantId: 't', ecritureId: 'e-1' });
    expect(pieces.appels.findMany[0].select.contenu).toBeUndefined();
    expect(pieces.appels.findMany[0].take).toBeGreaterThan(0);
    expect(r).toMatchObject({ depot: { permis: true, motif: null }, retrait: { permis: false }, total: 0, tronque: false });
    expect(r.retrait.motif).toContain('validée');
    expect(client.ecriture.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e-1', tenantId: 't' } }));
  });

  it('un objet d’un autre dossier est introuvable', async () => {
    const { client } = prismaFactice({ ecritureExiste: false });
    await expect(new PiecesJointesService(client).lister('t', REGLE_PIECES_ECRITURE, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('le dépôt sur une écriture fige ce qu’elle justifie, avec le type lu, l’empreinte et l’auteur', async () => {
    const { client, pieces } = prismaFactice();
    await new PiecesJointesService(client).deposer('t', REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'facture.pdf', buffer: PDF }, ' mars ', 'a@b.cd');
    const { data, select } = pieces.appels.create[0];
    expect(data).toMatchObject({
      tenantId: 't',
      ecritureId: 'e-1',
      ecritureDecrite: 'ACH n° 12 du 04/03/2026 · Facture SNEL mars',
      nomFichier: 'facture.pdf',
      typeMime: 'application/pdf',
      empreinte: empreinteDocument(PDF),
      commentaire: 'mars',
      deposePar: 'a@b.cd',
    });
    expect(select.contenu).toBeUndefined();
  });

  it('refuse sans rien écrire · à-nouveau provisoire, contenu qui contredit l’extension, envoi vide', async () => {
    const provisoire = prismaFactice({ aNouveauProvisoire: true });
    await expect(
      new PiecesJointesService(provisoire.client).deposer('t', REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: PDF }, null, 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const faux = prismaFactice();
    await expect(
      new PiecesJointesService(faux.client).deposer('t', REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: HTML }, null, 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(new PiecesJointesService(faux.client).deposer('t', REGLE_PIECES_ECRITURE, 'e-1', undefined, null, 'x')).rejects.toThrow(
      'Aucun fichier reçu.',
    );
    expect(provisoire.pieces.appels.create).toHaveLength(0);
    expect(faux.pieces.appels.create).toHaveLength(0);
  });

  it('la même pièce deux fois au même objet est un conflit nommé, l’objet retiré pendant le dépôt aussi', async () => {
    for (const code of ['P2002', 'P2003']) {
      const { client } = prismaFactice({ conflit: code });
      await expect(
        new PiecesJointesService(client).deposer('t', REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: PDF }, null, 'x'),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('LE RETRAIT SE JUGE DANS SA TRANSACTION, APRÈS LE VERROU · validée, la pièce reste', async () => {
    const piece = { id: 'p-1', tenantId: 't', ecritureId: 'e-1' };
    const validee = prismaFactice({ statut: StatutEcriture.VALIDEE, pieces: [piece] });
    await expect(new PiecesJointesService(validee.client).retirer('t', REGLE_PIECES_ECRITURE, 'p-1')).rejects.toBeInstanceOf(ConflictException);
    expect(validee.ordre).toEqual(['transaction', 'verrou', 'lire']);
    expect(validee.pieces.appels.delete).toHaveLength(0);

    const brouillard = prismaFactice({ statut: StatutEcriture.BROUILLARD, pieces: [piece] });
    await new PiecesJointesService(brouillard.client).retirer('t', REGLE_PIECES_ECRITURE, 'p-1');
    // Une à une, par identifiant · le journal d'audit garde la pré-image.
    expect(brouillard.pieces.appels.delete).toEqual([{ where: { id: 'p-1' } }]);
    expect(brouillard.pieces.appels.deleteMany).toHaveLength(0);
  });

  it('une pièce détachée (écriture retirée au brouillard) se retire sans objet à consulter', async () => {
    const { client, pieces, ordre } = prismaFactice({ pieces: [{ id: 'p-2', tenantId: 't', ecritureId: null }] });
    await new PiecesJointesService(client).retirer('t', REGLE_PIECES_ECRITURE, 'p-2');
    expect(ordre).toEqual(['transaction']);
    expect(pieces.appels.delete).toEqual([{ where: { id: 'p-2' } }]);
  });

  it('une pièce d’un autre dossier est introuvable au téléchargement, au commentaire et au retrait', async () => {
    const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-3', tenantId: 'autre', ecritureId: 'e-1' }] });
    const s = new PiecesJointesService(client);
    await expect(s.telecharger('t', 'ECRITURE', 'p-3')).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.modifierCommentaire('t', 'ECRITURE', 'p-3', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.retirer('t', REGLE_PIECES_ECRITURE, 'p-3')).rejects.toBeInstanceOf(NotFoundException);
    expect(pieces.appels.findFirst.every((a: any) => a.where.tenantId === 't')).toBe(true);
    expect(pieces.appels.delete).toHaveLength(0);
  });

  it('le téléchargement est la seule lecture qui porte le contenu', async () => {
    const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-4', tenantId: 't', ecritureId: 'e-1' }] });
    await new PiecesJointesService(client).telecharger('t', 'ECRITURE', 'p-4');
    expect(pieces.appels.findFirst[0]).toEqual({ where: { id: 'p-4', tenantId: 't' }, select: { nomFichier: true, typeMime: true, contenu: true } });
  });

  it('le commentaire se retouche, vidé il redevient null, trop long il est refusé', async () => {
    const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-5', tenantId: 't', ecritureId: 'e-1' }] });
    const s = new PiecesJointesService(client);
    await s.modifierCommentaire('t', 'ECRITURE', 'p-5', '   ');
    expect(pieces.appels.update[0].data).toEqual({ commentaire: null });
    await expect(s.modifierCommentaire('t', 'ECRITURE', 'p-5', 'x'.repeat(70))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('les pièces détachées et le décompte restent au dossier, bornés', async () => {
    const { client, pieces } = prismaFactice();
    const groupBy = jest.fn(async () => [{ ecritureId: 'e-1', _count: { _all: 2 } }]);
    client.pieceJointeEcriture.groupBy = groupBy;
    const s = new PiecesJointesService(client);
    await s.listerDetachees('t');
    expect(pieces.appels.findMany[0].where).toEqual({ tenantId: 't', ecritureId: null });
    expect(pieces.appels.findMany[0].select.contenu).toBeUndefined();
    expect(await s.decompteParEcriture('t', 'ex-1')).toEqual({ parEcriture: { 'e-1': 2 }, tronque: false });
    expect((groupBy.mock.calls[0] as any)[0].where).toEqual({ tenantId: 't', ecriture: { is: { tenantId: 't', exerciceId: 'ex-1' } } });
  });
});

describe('pièces jointes · quatre objets, quatre tables, une règle chacun chez lui', () => {
  const regles: RegleDesPieces[] = [REGLE_PIECES_ECRITURE, REGLE_PIECES_SECTION, REGLE_PIECES_IMMOBILISATION, REGLE_PIECES_SALARIE];

  it('chaque règle vise sa table et cherche son objet DANS le dossier', async () => {
    for (const regle of regles) {
      const vu: any[] = [];
      const db: any = new Proxy({}, { get: (_c, nom) => ({ findFirst: async (a: any) => (vu.push([nom, a.where]), null) }) });
      expect(await regle.lireObjet(db, 't', 'o-1')).toBeNull();
      expect(vu[0][1]).toEqual({ id: 'o-1', tenantId: 't' });
      expect(TABLES_DES_PIECES[regle.objet]).toBeDefined();
    }
  });

  it('section, bien et salarié · le document se dépose et se retire à tout moment', async () => {
    const lignes: Record<string, any> = {
      sectionAnalytique: { code: 'P01', intitule: 'Santé', plan: { code: 'PROJ' } },
      immobilisation: { designation: 'Véhicule', numeroInventaire: 'V-001' },
      salarie: { matricule: 'M-1', nom: 'KABILA', postNom: null, prenoms: 'Jean' },
    };
    const db: any = new Proxy({}, { get: (_c, nom) => ({ findFirst: async () => lignes[nom as string] }) });
    expect(await REGLE_PIECES_SECTION.lireObjet(db, 't', 'x')).toEqual({ description: 'PROJ · P01 Santé', motifRefusDepot: null, motifRefusRetrait: null });
    expect(await REGLE_PIECES_IMMOBILISATION.lireObjet(db, 't', 'x')).toEqual({ description: 'V-001 · Véhicule', motifRefusDepot: null, motifRefusRetrait: null });
    expect(await REGLE_PIECES_SALARIE.lireObjet(db, 't', 'x')).toEqual({ description: 'M-1 · KABILA Jean', motifRefusDepot: null, motifRefusRetrait: null });
  });

  it('les quatre tables sont cloisonnées, auditées sans le binaire, et le salarié sans son nom de fichier ni son commentaire', () => {
    for (const modele of ['PieceJointeEcriture', 'PieceJointeSection', 'PieceJointeImmobilisation', 'PieceJointeSalarie']) {
      expect([modele, MODELES_CLOISONNES.has(modele)]).toEqual([modele, true]);
      expect([modele, MODELES_AUDITES.has(modele)]).toEqual([modele, true]);
      expect(COLONNES_EXCLUES_PAR_MODELE[modele]).toContain('contenu');
      expect(selectPreImage(modele).select?.contenu).toBeUndefined();
    }
    expect(COLONNES_EXCLUES_PAR_MODELE.PieceJointeSalarie).toEqual(expect.arrayContaining(['nomFichier', 'commentaire']));
  });

  it('l’écriture laisse partir sa pièce, détachée · jamais un détenteur qui bloquerait la saisie', () => {
    expect(Object.keys(ECRITURE_LAISSEE_PARTIR)).toContain('PieceJointeEcriture.ecritureId');
    expect(COLONNES_QUI_RETIENNENT).not.toContain('PieceJointeEcriture.ecritureId');
  });
});

describe('pièces jointes · les routes', () => {
  const controleurs = [PiecesJointesEcritureController, PiecesJointesSectionController, PiecesJointesImmobilisationController, PiecesJointesSalarieController];
  const metadonnee = (cle: string, cible: object) => Reflect.getMetadata(cle, cible);

  it('chaque dépôt passe par la même réception · 5 Mo en mémoire, refus en français', () => {
    for (const c of controleurs) {
      const deposer = (c.prototype as any).deposer;
      expect([c.name, (metadonnee(INTERCEPTORS_METADATA, deposer) ?? []).length]).toEqual([c.name, 1]);
      expect([c.name, metadonnee(EXCEPTION_FILTERS_METADATA, deposer)]).toEqual([c.name, [RefusEnvoi]]);
    }
  });

  it('dépôt, commentaire et retrait portent un rôle · le salarié aux droits du registre', () => {
    for (const c of controleurs) {
      for (const m of ['deposer', 'commenter', 'retirer']) {
        expect([c.name, m, metadonnee(ROLES_KEY, (c.prototype as any)[m])]).toEqual([
          c.name,
          m,
          [RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE],
        ]);
      }
    }
    expect(metadonnee(CLE_ACCES_ROLES_CANTONNES, PiecesJointesSalarieController)).toEqual({ aideComptable: false, gestionnairePaie: true });
    for (const c of [PiecesJointesEcritureController, PiecesJointesSectionController, PiecesJointesImmobilisationController]) {
      expect([c.name, metadonnee(CLE_ACCES_ROLES_CANTONNES, c)]).toEqual([c.name, undefined]);
    }
  });

  it('le téléchargement sert attachment et nosniff, jamais inline', () => {
    const entetes = entetesTelechargement({ nomFichier: 'Société.pdf', typeMime: 'application/pdf' });
    expect(entetes['X-Content-Type-Options']).toBe('nosniff');
    expect(entetes['Content-Disposition']).toMatch(/^attachment; /);
    for (const fichier of [
      '../../modules/comptabilite/pieces-jointes-ecriture.controller.ts',
      '../../modules/analytique/pieces-jointes-section.controller.ts',
      '../../modules/immobilisations/pieces-jointes-immobilisation.controller.ts',
      '../../modules/personnel/pieces-jointes-salarie.controller.ts',
    ]) {
      const source = readFileSync(join(__dirname, fichier), 'utf8');
      expect([fichier, /servirLaPiece\(res, await this\.pieces\.telecharger\(/.test(source)]).toEqual([fichier, true]);
    }
  });
});

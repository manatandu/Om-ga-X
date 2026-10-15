import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditionModele, Prisma, SautEdition } from '@prisma/client';
import { ModelesEditionService } from './modeles-edition.service';
import { COLONNES_PAR_EDITION, modeleOuMotif } from './modeles-edition';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreerModeleEditionDto, RemplacerModeleEditionDto } from './dto/modele-edition.dto';

/**
 * LES MODÈLES D'ÉDITION (ligne sage-l7, fonction 59 ; décision L7-1) · trois
 * éditions de travail, les colonnes qui identifient jamais retirées, le
 * catalogue tenu en miroir de l'écran.
 */

const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';

type Ligne = Record<string, unknown> & { id: string; tenantId: string; edition: EditionModele; nom: string };

function nouveauFaux() {
  const lignes: Ligne[] = [];
  let n = 0;
  const filtre = (l: Ligne, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => l[k] === v);
  const prisma = {
    modeleEdition: {
      findMany: async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
        lignes.filter((l) => filtre(l, where)).sort((a, b) => a.nom.localeCompare(b.nom)).slice(0, take).map((l) => ({ ...l })),
      count: async ({ where }: { where: Record<string, unknown> }) => lignes.filter((l) => filtre(l, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) => lignes.find((l) => filtre(l, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (lignes.some((l) => l.tenantId === data.tenantId && l.edition === data.edition && l.nom === data.nom)) {
          throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
        }
        const l = { id: `mod-${++n}`, ...data } as unknown as Ligne;
        lignes.push(l);
        return { ...l };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(lignes.find((l) => l.id === where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => lignes.splice(lignes.findIndex((l) => l.id === where.id), 1)[0],
    },
  };
  return { service: new ModelesEditionService(prisma as never), lignes };
}

describe('modèles d’édition · au dossier', () => {
  it('un modèle garde ses colonnes facultatives dans l’ordre de l’édition, jamais une colonne qui identifie', async () => {
    const f = nouveauFaux();
    const m = await f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_COMPTABLE, {
      nom: ' Liste courte ',
      colonnes: ['etat', 'numero', 'nature'],
      saut: SautEdition.PAGE,
    });
    expect([m.nom, m.colonnes, m.saut]).toEqual(['Liste courte', ['nature', 'etat'], SautEdition.PAGE]);
    expect((await f.service.lister(DOSSIER, EditionModele.PLAN_COMPTABLE)).total).toBe(1);
    expect((await f.service.lister(DOSSIER, EditionModele.PLAN_TIERS)).total).toBe(0);
    expect((await f.service.lister(AUTRE, EditionModele.PLAN_COMPTABLE)).total).toBe(0);
  });

  it('refuse le nom du modèle intégré, un nom en double, une colonne d’une autre édition, un saut inconnu', async () => {
    const f = nouveauFaux();
    await expect(f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_TIERS, { nom: 'standard', colonnes: [] })).rejects.toThrow(/modèle intégré/);
    await f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_TIERS, { nom: 'Annuaire', colonnes: ['ville', 'telephone'] });
    await expect(f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_TIERS, { nom: 'Annuaire', colonnes: [] })).rejects.toThrow(
      /porte déjà le nom « Annuaire » · remplacez-le ou choisissez un autre nom/,
    );
    await expect(f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_TIERS, { nom: 'X', colonnes: ['lettrable'] })).rejects.toThrow(/Colonne inconnue/);
    await expect(f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_TIERS, { nom: 'X', colonnes: [], saut: 'COLONNE' })).rejects.toThrow(/Saut inconnu/);
  });

  it('remplacer change colonnes et saut, jamais l’édition ni le nom ; supprimer, du seul dossier', async () => {
    const f = nouveauFaux();
    const m = await f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_ANALYTIQUE, { nom: 'Bailleurs', colonnes: ['bailleur'] });
    await f.service.remplacer(DOSSIER, m.id, { colonnes: ['bailleur', 'debut', 'fin'], saut: SautEdition.LIGNE });
    expect(f.lignes[0]).toMatchObject({ nom: 'Bailleurs', edition: EditionModele.PLAN_ANALYTIQUE, colonnes: ['bailleur', 'debut', 'fin'], saut: SautEdition.LIGNE });
    await expect(f.service.supprimer(AUTRE, m.id)).rejects.toThrow(/introuvable/);
    await f.service.supprimer(DOSSIER, m.id);
    expect(f.lignes).toHaveLength(0);
  });
});

describe('modèles d’édition · le saut absent n’est pas le saut nul (mineur 5)', () => {
  it('un remplacement sans saut garde le saut de page du modèle', async () => {
    const f = nouveauFaux();
    const m = await f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_ANALYTIQUE, { nom: 'Par page', colonnes: [], saut: SautEdition.PAGE });
    await f.service.remplacer(DOSSIER, m.id, { colonnes: ['bailleur'] });
    // Il posait AUCUN · le modèle perdait son saut au premier changement de colonnes.
    expect(f.lignes[0]).toMatchObject({ colonnes: ['bailleur'], saut: SautEdition.PAGE });
  });

  it('un saut nul est refusé, à la porte comme au service, jamais lu comme « Aucun »', async () => {
    const remplacement = await validate(plainToInstance(RemplacerModeleEditionDto, { colonnes: [], saut: null }));
    expect(remplacement.map((e) => e.property)).toEqual(['saut']);
    const creation = await validate(plainToInstance(CreerModeleEditionDto, { edition: EditionModele.PLAN_ANALYTIQUE, nom: 'X', colonnes: [], saut: null }));
    expect(creation.map((e) => e.property)).toEqual(['saut']);
    // Absent, il passe la porte.
    expect(await validate(plainToInstance(RemplacerModeleEditionDto, { colonnes: [] }))).toHaveLength(0);
    const f = nouveauFaux();
    const m = await f.service.creer(DOSSIER, 'u1', EditionModele.PLAN_ANALYTIQUE, { nom: 'Par page', colonnes: [], saut: SautEdition.PAGE });
    await expect(f.service.remplacer(DOSSIER, m.id, { colonnes: [], saut: null })).rejects.toThrow(/Saut inconnu/);
    expect(f.lignes[0]).toMatchObject({ saut: SautEdition.PAGE });
  });
});

describe('modèles d’édition · règles et miroir', () => {
  it('chaque édition a ses deux colonnes qui identifient, en tête', () => {
    for (const cat of Object.values(COLONNES_PAR_EDITION)) {
      expect(cat.slice(0, 2).every((c) => c.identifiante)).toBe(true);
      expect(cat.slice(2).every((c) => !c.identifiante)).toBe(true);
    }
  });

  it('le catalogue de l’écran est celui du serveur, relu dans sa source', () => {
    const source = readFileSync(join(__dirname, '../../../../client/src/lib/modeles-edition.ts'), 'utf8');
    for (const edition of Object.values(EditionModele)) {
      const debut = source.indexOf(`  ${edition}: [`);
      expect(debut).toBeGreaterThan(0);
      const bloc = source.slice(debut, source.indexOf('  ],', debut));
      const lues = [...bloc.matchAll(/\{ cle: '(\w+)', libelle: '[^']*', identifiante: (true|false) \}/g)].map((m) => ({
        cle: m[1],
        identifiante: m[2] === 'true',
      }));
      expect([edition, lues]).toEqual([edition, COLONNES_PAR_EDITION[edition]]);
    }
  });

  it('un nom vide ou trop long, des colonnes illisibles ou en double sont refusés', () => {
    expect(modeleOuMotif(EditionModele.PLAN_COMPTABLE, { nom: '', colonnes: [] })).toEqual({ motif: 'Le nom du modèle est exigé.' });
    expect(modeleOuMotif(EditionModele.PLAN_COMPTABLE, { nom: 'x'.repeat(61), colonnes: [] })).toEqual({
      motif: 'Le nom du modèle tient en 60 caractères au plus.',
    });
    expect(modeleOuMotif(EditionModele.PLAN_COMPTABLE, { nom: 'X', colonnes: 'etat' })).toEqual({ motif: 'Les colonnes du modèle sont illisibles.' });
    expect(modeleOuMotif(EditionModele.PLAN_COMPTABLE, { nom: 'X', colonnes: ['etat', 'etat'] })).toEqual({ motif: 'Colonne en double · « etat ».' });
  });
});

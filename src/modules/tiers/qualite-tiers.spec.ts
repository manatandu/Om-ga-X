import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreerTiersDto, ModifierTiersDto } from './dto/tiers.dto';
import { coordonneesAComblement, type FicheTiers } from './fusion-tiers';
import { LONGUEUR_QUALITE, normaliserQualite, QUALITES_PROPOSEES } from './qualite-tiers';
import { TiersService } from './tiers.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * LA QUALITÉ DU TIERS (ligne sage-l2, fonction 24) · ce qui casserait en
 * silence · une qualité effacée par un blanc qui se garde « » (et s'imprime
 * vide), une qualité perdue à la fusion, une colonne plus courte que ce que
 * le DTO admet (la base refuserait au milieu d'une création).
 */
describe('la qualité, un libellé', () => {
  it('se range sans blancs de bord, un blanc vide l’efface, l’absence ne change rien', () => {
    expect(normaliserQualite('  Société   anonyme ')).toBe('Société anonyme');
    expect(normaliserQualite('   ')).toBeNull();
    expect(normaliserQualite(null)).toBeNull();
    expect(normaliserQualite(undefined)).toBeUndefined();
  });

  it('la liste proposée tient dans la colonne, sans doublon', () => {
    expect(new Set(QUALITES_PROPOSEES).size).toBe(QUALITES_PROPOSEES.length);
    for (const q of QUALITES_PROPOSEES) expect(q.length).toBeLessThanOrEqual(LONGUEUR_QUALITE);
  });

  it('la colonne et les deux DTO disent la même longueur', async () => {
    const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain(`qualite String? @db.VarChar(${LONGUEUR_QUALITE})`);
    const trop = 'x'.repeat(LONGUEUR_QUALITE + 1);
    const c = await validate(plainToInstance(CreerTiersDto, { type: 'CLIENT', code: 'C1', nom: 'Client', qualite: trop }));
    expect(c.map((e) => e.property)).toEqual(['qualite']);
    const m = await validate(plainToInstance(ModifierTiersDto, { qualite: trop }));
    expect(m.map((e) => e.property)).toEqual(['qualite']);
    expect(await validate(plainToInstance(ModifierTiersDto, { qualite: null }))).toEqual([]);
  });

  it('la fusion comble une qualité manquante, jamais celle de la fiche conservée', () => {
    const fiche = (id: string, qualite: string | null): FicheTiers => ({
      id,
      code: id,
      type: 'CLIENT',
      adresse: null,
      boitePostale: null,
      ville: null,
      pays: null,
      telephone: null,
      email: null,
      numeroImpot: null,
      contact: null,
      qualite,
    });
    expect(coordonneesAComblement(fiche('a', 'Société'), fiche('b', null))).toEqual({ qualite: 'Société' });
    expect(coordonneesAComblement(fiche('a', 'Société'), fiche('b', 'Particulier'))).toEqual({});
  });
});

describe('la qualité à la création et à la modification', () => {
  function monter() {
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 't1', ...data }));
    const prisma = {
      tiers: {
        findFirst: jest.fn(async () => ({ id: 't1', tenantId: 'd', type: 'CLIENT', comptesRattaches: [] })),
        update,
      },
    } as unknown as PrismaService;
    return { service: new TiersService(prisma), update };
  }

  it('un blanc efface, un libellé se range, l’absence ne touche pas la colonne', async () => {
    const { service, update } = monter();
    await service.modifier('d', 't1', { qualite: '   ' });
    expect(update.mock.calls[0][0].data).toEqual({ qualite: null });
    await service.modifier('d', 't1', { qualite: ' Établissement   public ' });
    expect(update.mock.calls[1][0].data).toEqual({ qualite: 'Établissement public' });
    await service.modifier('d', 't1', { nom: 'Autre nom' });
    expect(update.mock.calls[2][0].data).toEqual({ nom: 'Autre nom' });
  });
});

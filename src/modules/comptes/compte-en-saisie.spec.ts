import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
import { CompteService } from './compte.service';
import { collectifDeTiers, MOTIF_OPTION_FERMEE, motifRefusCompteEnSaisie } from './compte-en-saisie';
import { compteSemeSubdivise } from './subdivisions-du-plan';
import { PANOPLIES_TIERS } from '../tiers/collectifs-tiers';

/**
 * CRÉER UN COMPTE PENDANT LA SAISIE (ligne sage-l1, fonction 14). Sous
 * l'option du dossier, le numéro tapé devient un SOUS-COMPTE d'un compte
 * d'imputation du plan, par la création ordinaire · jamais un numéro hors
 * plan, jamais sous un collectif de tiers, jamais sans l'option.
 */
const DETAIL_ACTIF = { typeCompte: TypeCompteDetailTotal.DETAIL, estActif: true };

describe('compte créé en saisie · le motif', () => {
  const base = {
    referentiel: Referentiel.SYSCOHADA,
    numero: '62210005',
    longueurCompte: 8,
    existe: false,
    numeroDuPlan: compteSemeSubdivise(Referentiel.SYSCOHADA, '62210005'),
    compteDuPlan: { numero: '62210000', intitule: 'Intitulé du plan', ...DETAIL_ACTIF },
  };

  it('le numéro subdivise le compte d’imputation du plan qui le préfixe le plus longuement', () => {
    expect(base.numeroDuPlan).toBe('62210000');
    expect(motifRefusCompteEnSaisie(base)).toBeNull();
  });

  it('refuse un compte existant, un numéro trop long, hors plan, un compte du plan absent, total ou en sommeil', () => {
    expect(motifRefusCompteEnSaisie({ ...base, existe: true })).toMatch(/existe déjà dans ce dossier/);
    expect(motifRefusCompteEnSaisie({ ...base, numero: '622100051' })).toMatch(/dépasse la longueur .* \(8 chiffres\)/);
    expect(motifRefusCompteEnSaisie({ ...base, numeroDuPlan: null })).toMatch(/ne subdivise aucun compte d'imputation du plan/);
    expect(motifRefusCompteEnSaisie({ ...base, compteDuPlan: null })).toMatch(/n'existe plus dans ce dossier/);
    expect(motifRefusCompteEnSaisie({ ...base, compteDuPlan: { ...base.compteDuPlan, typeCompte: TypeCompteDetailTotal.TOTAL } })).toMatch(
      /n'est pas un compte d'imputation/,
    );
    expect(motifRefusCompteEnSaisie({ ...base, compteDuPlan: { ...base.compteDuPlan, estActif: false } })).toMatch(/est en sommeil/);
    expect(motifRefusCompteEnSaisie({ ...base, numero: '6221A' })).toMatch(/chiffres seuls/);
  });

  it('un numéro semé n’est la subdivision d’aucun compte · il se personnalise au Plan comptable', () => {
    expect(compteSemeSubdivise(Referentiel.SYSCOHADA, '62210000')).toBeNull();
  });

  it('jamais sous un collectif de tiers, aux deux référentiels · tout compte de chaque panoplie', () => {
    for (const referentiel of [Referentiel.SYSCOHADA, Referentiel.SYCEBNL]) {
      for (const panoplie of Object.values(PANOPLIES_TIERS[referentiel])) {
        for (const c of panoplie ?? []) {
          const numero = `${c.collectif.slice(0, 7)}9`;
          const numeroDuPlan = compteSemeSubdivise(referentiel, numero);
          // Le numéro tapé sous le collectif le subdivise bien.
          expect({ numero, numeroDuPlan }).toEqual({ numero, numeroDuPlan: c.collectif });
          expect(collectifDeTiers(referentiel, c.collectif)).toBe(c.collectif);
          expect(
            motifRefusCompteEnSaisie({
              referentiel,
              numero,
              longueurCompte: 8,
              existe: false,
              numeroDuPlan,
              compteDuPlan: { numero: c.collectif, intitule: 'x', ...DETAIL_ACTIF },
            }),
          ).toMatch(new RegExp(`sous le collectif ${c.collectif} des tiers · le compte d'un tiers naît avec sa fiche`));
        }
      }
    }
  });
});

describe('compte créé en saisie · le service', () => {
  function monde(options: { option?: boolean; existe?: boolean; conflit?: boolean } = {}) {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (options.conflit) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
      return { id: 'nouveau', ...data };
    });
    const p = {
      tenant: {
        findUniqueOrThrow: jest.fn(async () => ({
          id: 't1',
          referentiel: Referentiel.SYSCOHADA,
          longueurCompte: 8,
          creationCompteEnSaisie: options.option ?? true,
        })),
      },
      compte: {
        findUnique: jest.fn(async ({ where }: { where: { tenantId_numero: { numero: string } } }) => {
          const n = where.tenantId_numero.numero;
          if (n === '62210000') return { id: 'plan', numero: n, intitule: 'Intitulé du plan', ...DETAIL_ACTIF, lettrable: false };
          if (n === '62210005' && options.existe) return { id: 'deja' };
          return null;
        }),
        create,
      },
      natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
    };
    return { svc: new CompteService(p as never), create };
  }

  it('la proposition nomme le compte du plan et reprend son intitulé, sans rien créer', async () => {
    const { svc, create } = monde();
    expect(await svc.propositionEnSaisie('t1', ' 62210005 ')).toEqual({
      numero: '62210005',
      intitule: 'Intitulé du plan',
      compteDuPlan: { numero: '62210000', intitule: 'Intitulé du plan' },
      motif: null,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('sans l’option du dossier · 403 nommé, rien n’est créé, et la proposition le dit', async () => {
    const { svc, create } = monde({ option: false });
    await expect(svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'Terrain du dépôt' })).rejects.toBeInstanceOf(ForbiddenException);
    expect((await svc.propositionEnSaisie('t1', '62210005')).motif).toBe(MOTIF_OPTION_FERMEE);
    expect(create).not.toHaveBeenCalled();
  });

  it('crée par la création ordinaire · DÉTAIL, réglages repris du compte du plan, personnalisé par défaut', async () => {
    const { svc, create } = monde();
    const c = await svc.creerEnSaisie('t1', { numero: '62210005', intitule: '  Terrain du dépôt ' });
    expect(c).toMatchObject({ id: 'nouveau', numero: '62210005', intitule: 'Terrain du dépôt', typeCompte: 'DETAIL' });
    // Rien n'écrit « non retenu » · le schéma le rend personnalisé (« créé retenu »).
    expect(create.mock.calls[0][0].data).not.toHaveProperty('estRetenu');
    // Le lettrage vient du compte du plan qu'il subdivise.
    expect(create.mock.calls[0][0].data.lettrable).toBe(false);
  });

  it('refuse un numéro existant, un intitulé vide, et dit le conflit de deux créations simultanées', async () => {
    await expect(monde({ existe: true }).svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'x' })).rejects.toThrow(/existe déjà/);
    await expect(monde().svc.creerEnSaisie('t1', { numero: '62210005', intitule: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(monde({ conflit: true }).svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});

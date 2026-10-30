import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreerTiersDto } from './dto/tiers.dto';
import { copieDuTiers, type TiersADupliquer } from './duplication-tiers';
import { TiersService } from './tiers.service';

/**
 * DUPLICATION D'UN TIERS (ligne sage-l2, fonction 32) · ce qui casserait en
 * silence · un RIB ou un Numéro Impôt recopié (le virement ou la liste des
 * fournisseurs partiraient sous l'identité d'un autre), un champ de la copie
 * que le DTO de création ne connaît pas (la création refuserait tout le
 * corps), un mode en sommeil recopié (refusé à la création).
 */
const source = (x: Partial<TiersADupliquer> = {}): TiersADupliquer => ({
  code: 'FRS-01',
  type: 'FOURNISSEUR',
  nom: 'Fournisseur source',
  qualite: 'Société',
  adresse: 'Av. du Commerce 12',
  boitePostale: null,
  ville: 'Kinshasa',
  pays: 'RD Congo',
  telephone: '+243 81',
  email: 'achats@source.cd',
  contact: 'M. Kabila',
  numeroImpot: 'A1234567B',
  celluleGroupeId: null,
  autoriseTvaDebits: true,
  horsRelance: false,
  validationAutomatiqueEcheances: true,
  modeleReglement: { id: 'm1', estActif: true },
  modeReglement: { id: 'vir', estActif: true },
  modeleImpressionExtraitId: null,
  modeleImpressionReglementId: null,
  modeleImpressionRappelId: null,
  representant: null,
  devise: null,
  encoursMaximum: null,
  ...x,
});

describe('la copie d’un tiers', () => {
  it('reprend nom, qualité, coordonnées et règlement ; laisse le code à saisir', () => {
    const c = copieDuTiers(source(), { ribs: 0, documents: 0, lieux: 0 });
    expect(c.origine).toBe('FRS-01');
    expect(c.corps).toEqual({
      type: 'FOURNISSEUR',
      code: '',
      nom: 'Fournisseur source',
      qualite: 'Société',
      adresse: 'Av. du Commerce 12',
      ville: 'Kinshasa',
      pays: 'RD Congo',
      telephone: '+243 81',
      email: 'achats@source.cd',
      contact: 'M. Kabila',
      modeleReglementId: 'm1',
      modeReglementId: 'vir',
      validationAutomatiqueEcheances: true,
    });
  });

  it('ne reprend ni Numéro Impôt, ni RIB, ni documents, ni lieux, ni autorisation aux débits, et le dit', () => {
    const c = copieDuTiers(source({ celluleGroupeId: 'cel', horsRelance: true }), { ribs: 2, documents: 1, lieux: 3 });
    expect(c.corps).not.toHaveProperty('numeroImpot');
    expect(c.nonRepris.map((n) => n.champ)).toEqual([
      'Code',
      'Comptes',
      'Numéro Impôt',
      'Coordonnées bancaires',
      'Documents',
      'Lieux de livraison',
      'Cellule du groupe',
      'Autorisation aux débits',
      'Exclusion des relances',
    ]);
  });

  it('les modèles d’impression sont repris (fonction 27) · un choix de présentation', () => {
    const c = copieDuTiers(source({ modeleImpressionRappelId: 'r1', modeleImpressionReglementId: 'a1' }), { ribs: 0, documents: 0, lieux: 0 });
    expect(c.corps).toEqual(expect.objectContaining({ modeleImpressionRappelId: 'r1', modeleImpressionReglementId: 'a1' }));
    expect(c.corps).not.toHaveProperty('modeleImpressionExtraitId');
  });

  it('un modèle ou un mode en sommeil n’est pas repris · la création le refuserait', () => {
    const c = copieDuTiers(source({ modeleReglement: { id: 'm1', estActif: false }, modeReglement: { id: 'esp', estActif: false } }), {
      ribs: 0,
      documents: 0,
      lieux: 0,
    });
    expect(c.corps).not.toHaveProperty('modeleReglementId');
    expect(c.corps).not.toHaveProperty('modeReglementId');
    expect(c.corps).not.toHaveProperty('validationAutomatiqueEcheances');
    expect(c.nonRepris).toEqual(expect.arrayContaining([{ champ: 'Modèle de règlement', motif: 'en sommeil' }, { champ: 'Mode de règlement', motif: 'en sommeil' }]));
  });

  // LIGNE RESTES-L8-IMMOS · la règle de la fusion (`fusion-tiers.ts`) · le
  // représentant et la devise se reprennent, l'encours maximum JAMAIS.
  it('reprend le représentant et la devise habituelle, jamais l’encours maximum, et le dit', () => {
    const c = copieDuTiers(
      source({
        type: 'CLIENT',
        representant: { id: 'col1', refus: null },
        devise: { id: 'usd', code: 'USD', estActive: true },
        encoursMaximum: '5000000.00',
      }),
      { ribs: 0, documents: 0, lieux: 0 },
    );
    expect(c.corps).toEqual(expect.objectContaining({ representantId: 'col1', deviseId: 'usd' }));
    expect(c.corps).not.toHaveProperty('encoursMaximum');
    expect(c.nonRepris).toContainEqual({
      champ: 'Encours maximum',
      motif: 'crédit consenti à ce client · il ne s’ouvre pas au nouveau tiers sans décision',
    });
  });

  it('un représentant que la création refuserait, une devise en sommeil · non repris, motif dit', () => {
    const c = copieDuTiers(
      source({
        representant: { id: 'col1', refus: 'Jean Kasa est en sommeil · il ne représente plus de tiers.' },
        devise: { id: 'eur', code: 'EUR', estActive: false },
      }),
      { ribs: 0, documents: 0, lieux: 0 },
    );
    expect(c.corps).not.toHaveProperty('representantId');
    expect(c.corps).not.toHaveProperty('deviseId');
    expect(c.nonRepris).toEqual(
      expect.arrayContaining([
        { champ: 'Représentant', motif: 'Jean Kasa est en sommeil · il ne représente plus de tiers.' },
        { champ: 'Devise habituelle', motif: 'EUR en sommeil' },
      ]),
    );
    // Un encours absent n'est pas nommé · rien n'était consenti.
    expect(c.nonRepris.map((n) => n.champ)).not.toContain('Encours maximum');
  });

  // Relecture indépendante, m2 · posé mais introuvable · nommé, jamais tu.
  it('un représentant ou une devise introuvables dans le dossier sont nommés', () => {
    const c = copieDuTiers(source({ representantIntrouvable: true, deviseIntrouvable: true }), { ribs: 0, documents: 0, lieux: 0 });
    expect(c.corps).not.toHaveProperty('representantId');
    expect(c.corps).not.toHaveProperty('deviseId');
    expect(c.nonRepris).toEqual(
      expect.arrayContaining([
        { champ: 'Représentant', motif: 'introuvable dans le dossier' },
        { champ: 'Devise habituelle', motif: 'introuvable dans le dossier' },
      ]),
    );
  });

  it('le corps de la copie passe le DTO de création, une fois le code saisi', async () => {
    const c = copieDuTiers(
      source({ representant: { id: '8f1c2a9e-1b2c-4d3e-8f9a-0b1c2d3e4f5a', refus: null }, devise: { id: '9f1c2a9e-1b2c-4d3e-8f9a-0b1c2d3e4f5a', code: 'USD', estActive: true } }),
      { ribs: 0, documents: 0, lieux: 0 },
    );
    const erreurs = await validate(plainToInstance(CreerTiersDto, { ...c.corps, code: 'FRS-02', modeleReglementId: '6f1c2a9e-1b2c-4d3e-8f9a-0b1c2d3e4f5a', modeReglementId: '7f1c2a9e-1b2c-4d3e-8f9a-0b1c2d3e4f5a' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(erreurs).toEqual([]);
  });
});

describe('le service · la copie se lit, rien ne s’écrit', () => {
  it('compte RIB, documents et lieux du tiers de CE dossier, et n’écrit rien', async () => {
    const compter = jest.fn(async () => 1);
    const ecrire = jest.fn();
    const prisma = {
      tiers: {
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
          where.tenantId === 'd' ? { ...source(), id: 't1', comptesRattaches: [] } : null,
        ),
        create: ecrire,
        update: ecrire,
      },
      ribTiers: { count: compter },
      documentTiers: { count: compter },
      lieuLivraison: { count: compter },
    };
    const c = await new TiersService(prisma as never).duplication('d', 't1');
    expect(compter).toHaveBeenCalledWith({ where: { tenantId: 'd', tiersId: 't1' } });
    expect(c.nonRepris.map((n) => n.champ)).toEqual(expect.arrayContaining(['Coordonnées bancaires', 'Documents', 'Lieux de livraison']));
    expect(ecrire).not.toHaveBeenCalled();
    await expect(new TiersService(prisma as never).duplication('autre', 't1')).rejects.toThrow();
  });

  it('lit le représentant et la devise dans CE dossier, et juge le représentant comme la création', async () => {
    const lireCollaborateur = jest.fn(async () => ({
      id: 'col1', nom: 'Kasa', prenom: 'Jean', actif: true, vendeur: false, caissier: false, acheteur: true, controleur: false, financier: false, recouvrement: false,
    }));
    const lireDevise = jest.fn(async () => ({ id: 'usd', code: 'USD', estActive: true }));
    const prisma = {
      tiers: {
        findFirst: jest.fn(async () => ({
          ...source(),
          id: 't1',
          type: 'FOURNISSEUR',
          representantId: 'col1',
          deviseId: 'usd',
          encoursMaximum: null,
          comptesRattaches: [],
        })),
      },
      ribTiers: { count: jest.fn(async () => 0) },
      documentTiers: { count: jest.fn(async () => 0) },
      lieuLivraison: { count: jest.fn(async () => 0) },
      collaborateur: { findFirst: lireCollaborateur },
      devise: { findFirst: lireDevise },
    };
    const c = await new TiersService(prisma as never).duplication('d', 't1');
    expect(lireCollaborateur).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'col1', tenantId: 'd' } }));
    expect(lireDevise).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'usd', tenantId: 'd' } }));
    expect(c.corps).toEqual(expect.objectContaining({ representantId: 'col1', deviseId: 'usd' }));
  });

  it('un représentant ou une devise qui ne se lisent plus dans ce dossier se disent introuvables', async () => {
    const prisma = {
      tiers: {
        findFirst: jest.fn(async () => ({ ...source(), id: 't1', representantId: 'col1', deviseId: 'usd', encoursMaximum: null, comptesRattaches: [] })),
      },
      ribTiers: { count: jest.fn(async () => 0) },
      documentTiers: { count: jest.fn(async () => 0) },
      lieuLivraison: { count: jest.fn(async () => 0) },
      collaborateur: { findFirst: jest.fn(async () => null) },
      devise: { findFirst: jest.fn(async () => null) },
    };
    const c = await new TiersService(prisma as never).duplication('d', 't1');
    expect(c.nonRepris.map((n) => [n.champ, n.motif])).toEqual(
      expect.arrayContaining([
        ['Représentant', 'introuvable dans le dossier'],
        ['Devise habituelle', 'introuvable dans le dossier'],
      ]),
    );
  });
});

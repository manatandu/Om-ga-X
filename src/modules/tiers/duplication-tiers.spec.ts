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

  it('le corps de la copie passe le DTO de création, une fois le code saisi', async () => {
    const c = copieDuTiers(source(), { ribs: 0, documents: 0, lieux: 0 });
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
});

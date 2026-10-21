import { readFileSync } from 'fs';
import { join } from 'path';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  AVERTISSEMENT_AUTEUR_INCONNU,
  COORDONNEES_VISEES,
  MOTIF_RIB_CHANGE_DEPUIS_LA_LECTURE,
  MOTIF_VISA_PAR_SON_AUTEUR,
  coordonneesChangees,
  estVise,
  motifRefusVisa,
  presenterVisa,
} from './visa-rib';
import { RibsTiersService } from './ribs-tiers.service';
import { RibsSalariesService } from '../personnel/ribs-salaries.service';

const saisiLe = new Date('2026-10-21T08:00:00.000Z');
const ribSaisi = { saisiPar: 'u1', saisiLe, visePar: null, viseLe: null };

describe('visa des RIB · les règles (tiers/visa-rib.ts)', () => {
  it('le visa porte sur les coordonnées, jamais sur le commentaire ni sur la marque de principal', () => {
    const avant = { banque: 'Rawbank', numeroCompte: '0001', iban: null, devise: 'CDF' };
    expect(coordonneesChangees(avant, { ...avant })).toBe(false);
    expect(coordonneesChangees(avant, { ...avant, numeroCompte: '0002' })).toBe(true);
    expect(coordonneesChangees(avant, { ...avant, devise: 'USD' })).toBe(true);
    // Une absence et un vide disent la même chose · aucun visa ne tombe pour rien.
    expect(coordonneesChangees({ banque: 'B', cle: null }, { banque: 'B' })).toBe(false);
    expect(COORDONNEES_VISEES).not.toContain('commentaire');
    expect(COORDONNEES_VISEES).not.toContain('estPrincipal');
  });

  it("l'auteur ne vise pas son propre RIB · un autre utilisateur le peut", () => {
    expect(motifRefusVisa(ribSaisi, 'u1', saisiLe.toISOString())).toBe(MOTIF_VISA_PAR_SON_AUTEUR);
    expect(motifRefusVisa(ribSaisi, 'u2', saisiLe.toISOString())).toBeNull();
  });

  it('le visa vise ce qui a été lu · un RIB changé depuis la lecture est refusé', () => {
    expect(motifRefusVisa(ribSaisi, 'u2', '2026-10-21T07:59:59.000Z')).toBe(MOTIF_RIB_CHANGE_DEPUIS_LA_LECTURE);
    expect(motifRefusVisa(ribSaisi, 'u2', null)).toBe(MOTIF_RIB_CHANGE_DEPUIS_LA_LECTURE);
  });

  it("un RIB d'avant la règle (auteur inconnu) se vise, une seule fois", () => {
    const ancien = { saisiPar: null, saisiLe: null, visePar: null, viseLe: null };
    expect(motifRefusVisa(ancien, 'u1', null)).toBeNull();
    const vise = { ...ancien, visePar: 'u2', viseLe: new Date() };
    expect(motifRefusVisa(vise, 'u1', null)).toMatch(/déjà visé/);
  });

  it("visé, c'est les deux traces posées · jamais l'une sans l'autre", () => {
    expect(estVise({ ...ribSaisi, visePar: 'u2', viseLe: new Date() })).toBe(true);
    expect(estVise({ ...ribSaisi, visePar: 'u2', viseLe: null })).toBe(false);
    expect(estVise({ ...ribSaisi, visePar: null, viseLe: new Date() })).toBe(false);
  });

  it('nomme les auteurs par leur courriel, et un utilisateur retiré comme tel', () => {
    const courriels = new Map([['u1', 'a@cabinet.cd']]);
    const p = presenterVisa({ ...ribSaisi, visePar: 'u9', viseLe: saisiLe }, true, 'u1', courriels);
    expect(p).toMatchObject({ exige: true, vise: true, saisiPar: 'a@cabinet.cd', visePar: 'utilisateur retiré du dossier', saisiParVous: true });
  });
});

/** Une doublure qui tient UN RIB, relu dans la transaction comme en base. */
function monterTiers(rib: Record<string, unknown>) {
  const etat = { ...rib };
  const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(etat, data));
  const tx = {
    $queryRaw: jest.fn(async () => []),
    ribTiers: {
      findFirst: jest.fn(async () => ({ ...etat })),
      updateMany: jest.fn(async () => ({ count: 1 })),
      update,
    },
  };
  const prisma = {
    ribTiers: { findFirst: jest.fn(async () => ({ ...etat })) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new RibsTiersService(prisma as never), tx, update, etat };
}

const ribTiers = {
  id: 'r1',
  tenantId: 't',
  tiersId: 'ti',
  banque: 'Rawbank',
  titulaire: null,
  codeBanque: null,
  codeGuichet: null,
  numeroCompte: '0001',
  cle: null,
  iban: null,
  codeBic: null,
  devise: null,
  commentaire: null,
  estPrincipal: true,
  saisiPar: 'u1',
  saisiLe,
  visePar: 'u2',
  viseLe: new Date('2026-10-21T09:00:00.000Z'),
};

describe('RibsTiersService · le visa tombe, se pose, se refuse', () => {
  it('changer le numéro fait tomber le visa et nomme le nouvel auteur', async () => {
    const { service, update } = monterTiers(ribTiers);
    await service.modifier('t', 'r1', { banque: 'Rawbank', numeroCompte: '0002' }, 'u3');
    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ numeroCompte: '0002', saisiPar: 'u3', visePar: null, viseLe: null });
    expect(data.saisiLe).toBeInstanceOf(Date);
  });

  it('changer le seul commentaire garde le visa', async () => {
    const { service, update } = monterTiers(ribTiers);
    await service.modifier('t', 'r1', { banque: 'Rawbank', numeroCompte: '0001', commentaire: 'compte salaires' }, 'u3');
    const data = update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('visePar');
    expect(data).not.toHaveProperty('saisiPar');
  });

  it('relit le RIB sous verrou avant de juger le changement', async () => {
    const { service, tx } = monterTiers(ribTiers);
    await service.modifier('t', 'r1', { banque: 'Rawbank', numeroCompte: '0002' }, 'u3');
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.ribTiers.findFirst.mock.invocationCallOrder[0]);
  });

  it("refuse le visa à l'auteur (403) et sur un RIB changé depuis la lecture (409)", async () => {
    const nonVise = { ...ribTiers, visePar: null, viseLe: null };
    await expect(monterTiers(nonVise).service.viser('t', 'r1', 'u1', saisiLe.toISOString())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(monterTiers(nonVise).service.viser('t', 'r1', 'u2', '2026-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(ConflictException);
  });

  it("pose le visa par une mise à jour unitaire, et dit quand l'auteur est inconnu", async () => {
    const { service, update } = monterTiers({ ...ribTiers, saisiPar: null, saisiLe: null, visePar: null, viseLe: null });
    const r = await service.viser('t', 'r1', 'u2', null);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { visePar: 'u2', viseLe: expect.any(Date) } });
    expect(r.avertissement).toBe(AVERTISSEMENT_AUTEUR_INCONNU);
  });
});

describe('RibsSalariesService · mêmes règles pour le RIB du salarié', () => {
  function monter(rib: Record<string, unknown>) {
    const etat = { ...rib };
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(etat, data));
    const tx = { $queryRaw: jest.fn(async () => []), ribSalarie: { findFirst: jest.fn(async () => ({ ...etat })), updateMany: jest.fn(), update } };
    const prisma = {
      ribSalarie: { findFirst: jest.fn(async () => ({ ...etat })) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { service: new RibsSalariesService(prisma as never), update };
  }
  const ribSalarie = { ...ribTiers, salarieId: 's1', tiersId: undefined };

  it("refuse le visa à l'auteur, l'accorde à un autre", async () => {
    const nonVise = { ...ribSalarie, visePar: null, viseLe: null };
    await expect(monter(nonVise).service.viser('t', 'r1', 'u1', saisiLe.toISOString())).rejects.toBeInstanceOf(ForbiddenException);
    const { service, update } = monter(nonVise);
    const r = await service.viser('t', 'r1', 'u2', saisiLe.toISOString());
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { visePar: 'u2', viseLe: expect.any(Date) } });
    expect(r.avertissement).toBeNull();
  });

  it('changer la devise fait tomber le visa', async () => {
    const { service, update } = monter(ribSalarie);
    await service.modifier('t', 'r1', { banque: 'Rawbank', numeroCompte: '0001', devise: 'USD' }, 'u3');
    expect(update.mock.calls[0][0].data).toMatchObject({ devise: 'USD', visePar: null, saisiPar: 'u3' });
  });
});

describe('les routes du visa · qui peut viser', () => {
  const lire = (chemin: string) => readFileSync(join(__dirname, '..', '..', '..', chemin), 'utf8');
  /** Le bloc de décorateurs qui précède la méthode nommée, jusqu'à la méthode précédente. */
  const decorateursDe = (source: string, methode: string) => {
    const fin = source.indexOf(`  ${methode}(`);
    const debut = source.lastIndexOf('\n  }\n', fin);
    return source.slice(debut, fin);
  };

  it.each([
    ['src/modules/tiers/ribs-tiers.controller.ts', 'viser'],
    ['src/modules/personnel/paiement-salaires.controller.ts', 'viserRib'],
  ])("%s · administrateur ou comptable, jamais un rôle cantonné", (fichier, methode) => {
    const bloc = decorateursDe(lire(fichier), methode);
    expect(bloc).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)');
    expect(bloc).toContain('@ReserveAuComptable()');
  });

  it("l'option se pose par l'administrateur seul", () => {
    const bloc = decorateursDe(lire('src/modules/tenant/tenant.controller.ts'), 'async modifierVisaRibs');
    expect(bloc).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET)');
  });
});

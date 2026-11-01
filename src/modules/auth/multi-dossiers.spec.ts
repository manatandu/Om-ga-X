import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { appartenanceDeConnexion, idDuCompteDeConnexion } from './compte-de-connexion';
import { demandeDeReemission, sessionDuJeton, ChargeJeton } from './session-longue';
import { MOTIF_DOSSIER_CHANGE, motifDossierChange } from './jwt-auth.guard';
import { MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE } from './compte-de-connexion';
import { InvitationsService, MOTIF_ADRESSE_DU_DOSSIER, MOTIF_PLAFOND_INVITATIONS, PLAFOND_INVITATIONS_EN_ATTENTE } from '../utilisateurs/invitations.service';
import { seulementDesColonnesSansEvenement } from '../../common/audit/champs-audites';
import { empreinteSession } from './sessions-fermees';
import { MOTIF_MESSAGERIE_REQUISE, UtilisateurService } from '../utilisateurs/utilisateur.service';

/**
 * UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, 2026-11-01).
 * Chaque garantie ici casserait en silence · une session ouverte sur le
 * mauvais dossier ne lève aucune erreur, elle écrit chez l'autre client.
 *
 * Le monde · Awa a son compte de connexion dans le dossier A (SYCEBNL) et une
 * appartenance rattachée dans le dossier B (SYSCOHADA). Bertin, d'un autre
 * cabinet, est seul dans le dossier C.
 */
type Ligne = Record<string, any>;

async function monde() {
  const hache = await bcrypt.hash('mot-de-passe-awa', 4);
  const base = { motDePasse: hache, estOperateurPlateforme: false, tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null,
    secretDoubleAuth: null, doubleAuthActiveDepuis: null, dernierPasDoubleAuth: null, codesSecoursDoubleAuth: [], sessionsFermees: [],
    sessionsInvalidesAvant: null, sessionsDuCompteInvalidesAvant: null, doitChangerMotDePasse: false, restreindreFonctions: false, fonctionsAutorisees: [],
    restreindreJournaux: false, journauxAutorises: [], restreindreLogiciels: false, logicielsAutorises: [] };
  const lignes: Ligne[] = [
    { ...base, id: 'awa-a', tenantId: 'A', email: 'awa@cabinet.cd', role: 'ADMIN_CABINET', estActif: true, compteDeConnexionId: null, createdAt: new Date('2026-01-01') },
    { ...base, id: 'awa-b', tenantId: 'B', email: 'awa@cabinet.cd', role: 'AIDE_COMPTABLE', estActif: true, compteDeConnexionId: 'awa-a', createdAt: new Date('2026-06-01'),
      motDePasse: await bcrypt.hash('jamais-lu', 4) },
    { ...base, id: 'bertin-c', tenantId: 'C', email: 'bertin@autre.cd', role: 'ADMIN_CABINET', estActif: true, compteDeConnexionId: null, createdAt: new Date('2026-02-01') },
  ];
  const dossiers = [
    { id: 'A', nom: 'Association Lumière', referentiel: 'SYCEBNL', licence: { type: 'PERPETUEL_SAAS', statut: 'ACTIVE' } },
    { id: 'B', nom: 'Société Kivu', referentiel: 'SYSCOHADA', licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateExpiration: new Date('2020-01-01') } },
    { id: 'C', nom: 'Cabinet voisin', referentiel: 'SYCEBNL', licence: { type: 'PERPETUEL_SAAS', statut: 'ACTIVE' } },
  ];
  const parId = (id: string) => lignes.find((l) => l.id === id) ?? null;
  const invitations: Ligne[] = [];
  const confirmations: Ligne[] = [];
  const correspond = (l: Ligne, w: any): boolean =>
    !w ||
    Object.entries(w).every(([k, v]: [string, any]) =>
      k === 'OR' ? v.some((x: any) => correspond(l, x)) : v && typeof v === 'object' && 'in' in v ? v.in.includes(l[k]) : l[k] === v,
    );
  const prisma: any = {
    user: {
      findUnique: async ({ where, include }: any) => {
        const l = where.id ? parId(where.id) : lignes.find((x) => x.compteDeConnexionId === null && x.email === where.courrielDeConnexion) ?? null;
        if (!l) return null;
        const r: Ligne = { ...l };
        if (include?.tenant) r.tenant = { ...dossiers.find((d) => d.id === l.tenantId), _count: { cellules: 0 } };
        if (include?.compteDeConnexion) r.compteDeConnexion = l.compteDeConnexionId ? { ...parId(l.compteDeConnexionId) } : null;
        return r;
      },
      findMany: async ({ where }: any) => lignes.filter((l) => correspond(l, where)).map((l) => ({ ...l })),
      findFirst: async ({ where }: any) => {
        const l = lignes.find((x) => correspond(x, where));
        return l ? { ...l } : null;
      },
      groupBy: async ({ where }: any) =>
        [...new Set(lignes.filter((l) => correspond(l, where)).map((l) => l.compteDeConnexionId))].map((compteDeConnexionId) => ({ compteDeConnexionId })),
      count: async ({ where }: any) => lignes.filter((l) => correspond(l, where)).length,
      update: async ({ where, data }: any) => Object.assign(parId(where.id)!, data),
      updateMany: async ({ where, data }: any) => {
        const vises = lignes.filter((l) => correspond(l, where));
        vises.forEach((l) => Object.assign(l, data));
        return { count: vises.length };
      },
      create: async ({ data }: any) => {
        const l = { ...base, ...data, id: `nouveau-${lignes.length}`, estActif: true, createdAt: new Date(), compteDeConnexionId: data.compteDeConnexionId ?? null };
        lignes.push(l);
        return { id: l.id, email: l.email, role: l.role, estActif: true, doitChangerMotDePasse: l.doitChangerMotDePasse };
      },
    },
    tenant: {
      findMany: async ({ where }: any) => dossiers.filter((d) => where.id.in.includes(d.id)),
      findFirst: async ({ where }: any) => dossiers.find((d) => d.id === where.id) ?? null,
    },
    invitationDossier: {
      findMany: async ({ where }: any) =>
        invitations
          .filter((i) => (where.tenantId === undefined || i.tenantId === where.tenantId) && (where.email === undefined || i.email === where.email) && (where.statut === undefined || i.statut === where.statut))
          .filter((i) => !where.expireLe || i.expireLe > where.expireLe.gt)
          .map((i) => ({ ...i, tenant: { nom: dossiers.find((d) => d.id === i.tenantId)!.nom } })),
      count: async ({ where }: any) => invitations.filter((i) => i.tenantId === where.tenantId).length,
      findUnique: async ({ where }: any) => invitations.find((i) => (where.id ? i.id === where.id : i.empreinteJeton === where.empreinteJeton)) ?? null,
      updateMany: async ({ where, data }: any) => {
        const vises = invitations.filter((i) => (!where.id || i.id === where.id) && (!where.tenantId || i.tenantId === where.tenantId) && (!where.email || i.email === where.email) && i.statut === where.statut);
        vises.forEach((i) => Object.assign(i, data));
        return { count: vises.length };
      },
      create: async ({ data }: any) => {
        const i = { ...data, id: `inv-${invitations.length}`, statut: 'EN_ATTENTE', createdAt: new Date(), decideLe: null };
        invitations.push(i);
        return { id: i.id, email: i.email, role: i.role, statut: i.statut, expireLe: i.expireLe, createdAt: i.createdAt, decideLe: null };
      },
    },
    confirmationAdresse: {
      findUnique: async ({ where }: any) => confirmations.find((c) => c.empreinteJeton === where.empreinteJeton) ?? null,
      updateMany: async ({ where, data }: any) => {
        const vises = confirmations.filter((c) => (!where.id || c.id === where.id) && (!where.userId || c.userId === where.userId) && c.utiliseLe === null && (where.annuleLe === undefined || c.annuleLe === null));
        vises.forEach((c) => Object.assign(c, data));
        return { count: vises.length };
      },
      create: async ({ data }: any) => {
        const c = { ...data, id: `conf-${confirmations.length}`, utiliseLe: null, annuleLe: null };
        confirmations.push(c);
        return c;
      },
    },
    exercice: {
      findMany: async ({ where }: any) =>
        [{ tenantId: 'A', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }].filter((e) => where.tenantId.in.includes(e.tenantId)),
    },
    $executeRaw: async () => 0,
    $queryRaw: async (_t: unknown, id: string) => [{ sessionsFermees: parId(id)?.sessionsFermees ?? [] }],
    clientNu: { $transaction: async () => undefined },
  };
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma);
  const jwt = new JwtService({ secret: 'secret-de-test', signOptions: { expiresIn: '8h' } });
  const none = undefined as never;
  const auth = new AuthService(prisma, jwt, none, none, none, none, none, none, none, none);
  const facteur = courrier();
  const authAvecCourrier = new AuthService(prisma, jwt, none, none, none, none, none, none, none, none, undefined, facteur.service as never);
  const strategie = new JwtStrategy({ getOrThrow: () => 'secret-de-test' } as never, prisma, jwt);
  const requete = (jeton: string, method = 'GET', csrf?: string) =>
    ({ method, headers: csrf ? { 'x-csrf-token': csrf } : {}, cookies: { __session: jeton } }) as never;
  const valider = (jeton: string) => strategie.validate(requete(jeton), jwt.verify<ChargeJeton>(jeton));
  return { lignes, prisma, auth, jwt, valider, parId, invitations, authAvecCourrier, facteur, confirmations };
}

/** Une messagerie configurée · garde ce qui part, rien ne sort. */
function courrier() {
  const envois: { destinataire: string; corps: string; corpsGarde: string }[] = [];
  return {
    envois,
    service: {
      etatDuTransport: () => ({ configure: true }),
      envoyerUnSecret: async (_t: string, m: { destinataire: string; corps: string }, corpsGarde: string) => {
        envois.push({ destinataire: m.destinataire, corps: m.corps, corpsGarde });
        return { id: 'm', statut: 'ENVOYE', erreur: null };
      },
    },
  };
}

describe('la connexion · un compte de connexion, plusieurs appartenances', () => {
  it('la session s’ouvre sur le compte de connexion, et dit qu’il y a plusieurs dossiers', async () => {
    const { auth, jwt } = await monde();
    const r: any = await auth.login({ email: 'AWA@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    expect(jwt.verify<ChargeJeton>(r.accessToken).sub).toBe('awa-a');
    expect(r.plusieursDossiers).toBe(true);
  });

  it('un seul dossier · rien ne change, pas de liste', async () => {
    const { auth, jwt } = await monde();
    const r: any = await auth.login({ email: 'bertin@autre.cd', motDePasse: 'mot-de-passe-awa' } as never);
    expect(jwt.verify<ChargeJeton>(r.accessToken).sub).toBe('bertin-c');
    expect(r.plusieursDossiers).toBe(false);
  });

  it('le compte de connexion retiré de son dossier, la session s’ouvre sur l’appartenance restante', async () => {
    const { auth, jwt, parId } = await monde();
    parId('awa-a')!.estActif = false;
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    expect(jwt.verify<ChargeJeton>(r.accessToken).sub).toBe('awa-b');
    expect(r.plusieursDossiers).toBe(false);
  });

  it('retirée de tous ses dossiers, la personne ne se connecte plus', async () => {
    const { auth, parId } = await monde();
    parId('awa-a')!.estActif = false;
    parId('awa-b')!.estActif = false;
    await expect(auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never)).rejects.toThrow(/désactivé/);
  });

  it('le mot de passe d’une appartenance rattachée n’ouvre rien · seul le compte de connexion se compare', async () => {
    const { auth } = await monde();
    await expect(auth.login({ email: 'awa@cabinet.cd', motDePasse: 'jamais-lu' } as never)).rejects.toThrow(UnauthorizedException);
  });

  it('le choix de la session · compte de connexion actif d’abord, sinon la plus ancienne active', () => {
    const a = (id: string, estActif: boolean, t: string) => ({
      id, tenantId: t, role: 'COMPTABLE' as never, estActif, sessionsInvalidesAvant: null, doitChangerMotDePasse: false, compteDeConnexionId: null, createdAt: new Date(t),
    });
    expect(appartenanceDeConnexion('c', [a('x', true, '2026-01-01'), a('c', true, '2026-02-01')])?.id).toBe('c');
    expect(appartenanceDeConnexion('c', [a('c', false, '2026-01-01'), a('x', true, '2026-02-01')])?.id).toBe('x');
    expect(appartenanceDeConnexion('c', [a('c', false, '2026-01-01')])).toBeNull();
    expect(idDuCompteDeConnexion({ id: 'b', compteDeConnexionId: 'a' })).toBe('a');
    expect(idDuCompteDeConnexion({ id: 'a', compteDeConnexionId: null })).toBe('a');
  });
});

describe('la session · le dossier de la ligne du jeton, et rien d’autre', () => {
  it('dans le dossier B, la session porte le dossier, le rôle et le référentiel de B', async () => {
    const { auth, valider } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const changement = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(new JwtService({ secret: 'secret-de-test' }).verify(r.accessToken), Math.floor(Date.now() / 1000)));
    const u = await valider(changement.session!.accessToken);
    expect([u.tenantId, u.role, u.referentiel]).toEqual(['B', 'AIDE_COMPTABLE', 'SYSCOHADA']);
  });

  it('la révocation de la PERSONNE ferme la session dans l’autre dossier, celle du seul dossier d’origine non', async () => {
    const { auth, valider, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    await expect(valider(session!.accessToken)).resolves.toMatchObject({ tenantId: 'B' });
    // La révocation du seul dossier d'origine (rôle, journaux, déconnexion par
    // son administrateur) n'éjecte pas la personne de B (relecture, m2).
    parId('awa-a')!.sessionsInvalidesAvant = new Date(Date.now() + 2000);
    await expect(valider(session!.accessToken)).resolves.toMatchObject({ tenantId: 'B' });
    // Celle de la PERSONNE, si.
    parId('awa-a')!.sessionsDuCompteInvalidesAvant = new Date(Date.now() + 2000);
    await expect(valider(session!.accessToken)).rejects.toThrow(/Session close/);
  });

  it('le mot de passe provisoire et le second facteur se lisent sur le compte de connexion', async () => {
    const { auth, valider, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    parId('awa-a')!.doitChangerMotDePasse = true;
    parId('awa-a')!.doubleAuthActiveDepuis = new Date('2026-01-01');
    parId('awa-b')!.doitChangerMotDePasse = false;
    await expect(valider(session!.accessToken)).resolves.toMatchObject({ doitChangerMotDePasse: true, doubleAuthentificationActive: true });
  });

  it('l’appartenance retirée par l’administrateur de B coupe la session dans B aussitôt ; la session d’origine, fermée par le changement, ne rouvre rien', async () => {
    const { auth, valider, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const sessionA = r.accessToken;
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    parId('awa-b')!.estActif = false;
    await expect(valider(session!.accessToken)).rejects.toThrow(/désactivé/);
    // La session d'origine a été FERMÉE par le changement · une copie ne rouvre rien.
    await expect(valider(sessionA)).rejects.toThrow(/déconnecté/);
  });
});

describe('changer de dossier · un geste, parmi les seuls dossiers de la personne', () => {
  it('un dossier qui n’est pas le sien est introuvable, sans rien dire de plus', async () => {
    const { auth } = await monde();
    await expect(auth.changerDeDossier('awa-a', 'C', null)).rejects.toThrow(NotFoundException);
    await expect(auth.changerDeDossier('bertin-c', 'A', null)).rejects.toThrow(NotFoundException);
  });

  it('une appartenance retirée n’est plus un dossier où entrer', async () => {
    const { auth, parId } = await monde();
    parId('awa-b')!.estActif = false;
    await expect(auth.changerDeDossier('awa-a', 'B', null)).rejects.toThrow(NotFoundException);
  });

  it('une appartenance dont les sessions ont été fermées après l’authentification est refusée, reconnexion demandée', async () => {
    const { auth, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    parId('awa-b')!.sessionsInvalidesAvant = new Date(Date.now() + 2000);
    await expect(auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('la session neuve vise la ligne de B sous un jeton CSRF NEUF, recopie le régime et l’authentification, et ferme l’ancienne', async () => {
    const { auth, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa', resterConnecte: true } as never);
    const avant = jwt.verify<ChargeJeton>(r.accessToken);
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(avant, Math.floor(Date.now() / 1000)));
    const apres = jwt.verify<ChargeJeton>(session!.accessToken);
    expect(apres.sub).toBe('awa-b');
    expect(apres.csrf).not.toBe(avant.csrf);
    expect([apres.longue, apres.origine, apres.authentification, apres.connexionComplete]).toEqual([true, avant.origine, avant.authentification, avant.connexionComplete]);
    expect(JSON.stringify(parId('awa-a')!.sessionsFermees)).toContain(empreinteSession(avant.csrf!));
  });

  it('le dossier de la session · rien n’est émis, rien n’est fermé', async () => {
    const { auth, parId } = await monde();
    const r = await auth.changerDeDossier('awa-a', 'A', null);
    expect(r).toEqual({ dossierId: 'A', session: null });
    expect(parId('awa-a')!.sessionsFermees).toEqual([]);
  });

  it('la liste · SES dossiers, référentiel, exercice ouvert, rôle et état de la licence, bornée, jamais celui d’un autre', async () => {
    const { auth } = await monde();
    const liste = await auth.mesDossiers('awa-b');
    expect(liste.dossiers.map((d) => [d.dossierId, d.nom, d.referentiel, d.role, d.exercice?.dateDebut.toISOString().slice(0, 10) ?? null, d.courant, d.acces])).toEqual([
      ['A', 'Association Lumière', 'SYCEBNL', 'ADMIN_CABINET', '2026-01-01', false, 'NORMAL'],
      ['B', 'Société Kivu', 'SYSCOHADA', 'AIDE_COMPTABLE', null, true, 'LECTURE_SEULE'],
    ]);
    expect([liste.total, liste.tronque, liste.introuvables]).toEqual([2, false, 0]);
    expect((await auth.mesDossiers('bertin-c')).dossiers.map((d) => d.dossierId)).toEqual(['C']);
  });
});

describe('le compte de la personne se tient depuis n’importe lequel de ses dossiers', () => {
  it('changer son mot de passe depuis B écrit sur le compte de connexion, pas sur la ligne de B', async () => {
    const { auth, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    const ligneB = parId('awa-b')!.motDePasse;
    const reemis: any = await auth.changerMotDePasse('awa-b', 'mot-de-passe-awa', 'nouveau-mot-de-passe', sessionDuJeton(jwt.verify(session!.accessToken), Math.floor(Date.now() / 1000)));
    expect(await bcrypt.compare('nouveau-mot-de-passe', parId('awa-a')!.motDePasse)).toBe(true);
    expect(parId('awa-b')!.motDePasse).toBe(ligneB);
    expect(parId('awa-a')!.sessionsInvalidesAvant).toBeInstanceOf(Date);
    // La session réémise reste dans B.
    expect(jwt.verify<ChargeJeton>(reemis.accessToken).sub).toBe('awa-b');
  });

  it('changer son adresse la recopie sur les appartenances de ses autres dossiers', async () => {
    const { auth, parId } = await monde();
    await auth.changerAdresse('awa-b', 'mot-de-passe-awa', 'Awa.Nouvelle@cabinet.cd', null, true);
    expect([parId('awa-a')!.email, parId('awa-b')!.email]).toEqual(['awa.nouvelle@cabinet.cd', 'awa.nouvelle@cabinet.cd']);
  });

  it('/auth/me dit plusieursDossiers, et le mot de passe provisoire du compte', async () => {
    const { auth, parId } = await monde();
    parId('awa-a')!.doitChangerMotDePasse = true;
    const me = await auth.me('awa-b');
    expect([me.plusieursDossiers, me.doitChangerMotDePasse, me.tenant.id]).toEqual([true, true, 'B']);
    expect((await auth.me('bertin-c')).plusieursDossiers).toBe(false);
  });
});

describe('C1, E2 · aucun administrateur n’agit sur la connexion d’une personne qui a d’autres dossiers', () => {
  it('l’administrateur du dossier d’ORIGINE ne réinitialise ni ne déverrouille un compte que d’autres dossiers pointent', async () => {
    const { prisma, parId } = await monde();
    const s = new UtilisateurService(prisma);
    const avant = parId('awa-a')!.motDePasse;
    await expect(s.reinitialiserMotDePasse('A', 'awa-a', 'Choisi-par-A-2026!')).rejects.toThrow(MOTIF_CONNEXION_TENUE_PAR_LA_PERSONNE);
    await expect(s.deverrouiller('A', 'awa-a')).rejects.toThrow(ForbiddenException);
    expect(parId('awa-a')!.motDePasse).toBe(avant);
  });

  it('sur une ligne rattachée, réinitialiser ou déverrouiller est refusé, jamais un « réinitialisé » qui ne touche rien', async () => {
    const { prisma, parId } = await monde();
    const s = new UtilisateurService(prisma);
    await expect(s.reinitialiserMotDePasse('B', 'awa-b', 'Choisi-par-B-2026!')).rejects.toThrow(ForbiddenException);
    await expect(s.deverrouiller('B', 'awa-b')).rejects.toThrow(ForbiddenException);
    expect(parId('awa-b')!.doitChangerMotDePasse).toBe(false);
  });

  it('une personne d’un seul dossier se réinitialise comme avant', async () => {
    const { prisma, parId } = await monde();
    await new UtilisateurService(prisma).reinitialiserMotDePasse('C', 'bertin-c', 'Provisoire-2026-xyz!');
    expect(await bcrypt.compare('Provisoire-2026-xyz!', parId('bertin-c')!.motDePasse)).toBe(true);
  });

  it('la liste du dossier dit la connexion tenue par la personne, second facteur lu sur son compte, verrou non servi', async () => {
    const { prisma, parId } = await monde();
    parId('awa-a')!.doubleAuthActiveDepuis = new Date('2026-03-01');
    parId('awa-b')!.verrouilleJusqua = new Date('2099-01-01');
    const listeB = await new UtilisateurService(prisma).lister('B');
    expect(listeB).toEqual([expect.objectContaining({ id: 'awa-b', connexionTenueParLaPersonne: true, verrouilleJusqua: null, doubleAuthActiveDepuis: new Date('2026-03-01') })]);
    expect(listeB[0]).not.toHaveProperty('compteDeConnexionId');
    expect((await new UtilisateurService(prisma).lister('A'))[0]).toMatchObject({ id: 'awa-a', connexionTenueParLaPersonne: true });
    expect((await new UtilisateurService(prisma).lister('C'))[0]).toMatchObject({ id: 'bertin-c', connexionTenueParLaPersonne: false });
  });
});

describe('E1 · la création directe ne pose jamais le mot de passe de l’administrateur sur une adresse connue', () => {
  it('en ligne sans messagerie · l’adresse connue est refusée « messagerie requise », rien n’est créé ni haché', async () => {
    const { prisma, lignes } = await monde();
    const nombre = lignes.length;
    await expect(new UtilisateurService(prisma).creer('C', { email: 'Awa@Cabinet.cd', motDePasse: 'Choisi-par-C-2026!', role: 'COMPTABLE' } as never, false)).rejects.toThrow(
      MOTIF_MESSAGERIE_REQUISE,
    );
    expect(lignes.length).toBe(nombre);
  });

  it('sur site · l’adresse connue est INVITÉE sans courriel (MAJEUR 3) · rien n’est rattaché avant qu’elle accepte depuis sa session', async () => {
    const { prisma, lignes, auth, invitations } = await monde();
    const inv = new InvitationsService(prisma);
    const nombre = lignes.length;
    const r: any = await new UtilisateurService(prisma).creer('C', { email: 'awa@cabinet.cd', motDePasse: 'Choisi-par-C-2026!', role: 'COMPTABLE' } as never, true, (email) =>
      inv.inviterSurPlace('C', 'bertin-c', email, 'COMPTABLE' as never),
    );
    expect(r.invitation.statut).toBe('EN_ATTENTE');
    expect(lignes.length).toBe(nombre);
    expect((await auth.mesInvitations('awa-a')).map((i) => [i.dossier, i.sansCode])).toEqual([['Cabinet voisin', true]]);
    // Un autre compte ne l'accepte pas ; une invitation à code, jamais sans lui.
    await expect(auth.accepterUneInvitationSurPlace('bertin-c', invitations[0].id)).rejects.toThrow(NotFoundException);
    await expect(auth.accepterUneInvitationSurPlace('awa-a', invitations[0].id)).resolves.toEqual({ dossierId: 'C' });
    const ligne = lignes.find((l) => l.tenantId === 'C' && l.email === 'awa@cabinet.cd')!;
    expect([ligne.compteDeConnexionId, ligne.role, ligne.doitChangerMotDePasse]).toEqual(['awa-a', 'COMPTABLE', false]);
    expect(await bcrypt.compare('Choisi-par-C-2026!', ligne.motDePasse)).toBe(false);
  });

  it('une invitation partie par courriel ne s’accepte jamais sans son code', async () => {
    const { prisma, auth, invitations, facteur } = await monde();
    await new InvitationsService(prisma, facteur.service as never).inviter('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    await expect(auth.accepterUneInvitationSurPlace('awa-a', invitations[0].id)).rejects.toThrow(NotFoundException);
  });

  it('une seconde acceptation, ou une personne déjà dans le dossier · 409 nommé, jamais un 500 (mineur 5)', async () => {
    const { prisma, auth, invitations, lignes } = await monde();
    const inv = new InvitationsService(prisma);
    await inv.inviterSurPlace('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    // La personne entre dans C par un autre chemin entre l'invitation et l'acceptation.
    lignes.push({ ...lignes[1], id: 'awa-c', tenantId: 'C' });
    await expect(auth.accepterUneInvitationSurPlace('awa-a', invitations[0].id)).rejects.toThrow(ConflictException);
    // La course que seule la contrainte voit · rendue en 409 elle aussi.
    lignes.pop();
    await inv.inviterSurPlace('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    const create = prisma.user.create;
    prisma.user.create = async () => {
      throw Object.assign(new Error('unique'), { code: 'P2002' });
    };
    await expect(auth.accepterUneInvitationSurPlace('awa-a', invitations[1].id)).rejects.toThrow(ConflictException);
    prisma.user.create = create;
  });

  it('le plafond des invitations en attente d’un dossier (mineur 7)', async () => {
    const { prisma, invitations } = await monde();
    for (let k = 0; k < PLAFOND_INVITATIONS_EN_ATTENTE; k++) invitations.push({ id: `x${k}`, tenantId: 'C', email: `p${k}@x.cd`, statut: 'EN_ATTENTE', expireLe: new Date('2099-01-01') });
    await expect(new InvitationsService(prisma).inviterSurPlace('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never)).rejects.toThrow(MOTIF_PLAFOND_INVITATIONS);
  });
});

describe('BLOQUANT 1 · une personne à plusieurs dossiers se dépanne, sans qu’aucun administrateur ne connaisse son mot de passe', () => {
  it('l’administrateur de B réinitialise par courriel · tiré au sort, envoyé au seul titulaire, jamais rendu, second facteur gardé', async () => {
    const { prisma, parId, facteur } = await monde();
    parId('awa-a')!.doubleAuthActiveDepuis = new Date('2026-03-01');
    parId('awa-a')!.secretDoubleAuth = 'SECRET';
    const r = await new UtilisateurService(prisma).reinitialiserParCourriel('B', 'awa-b', 'admin-b', facteur.service as never);
    expect(JSON.stringify(r)).not.toMatch(/motDePasse/);
    expect(facteur.envois.map((e) => e.destinataire)).toEqual(['awa@cabinet.cd']);
    const mot = /Mot de passe provisoire · (\S+)/.exec(facteur.envois[0].corps)![1];
    expect(facteur.envois[0].corpsGarde).not.toContain(mot);
    const compte = parId('awa-a')!;
    expect(await bcrypt.compare(mot, compte.motDePasse)).toBe(true);
    expect([compte.doitChangerMotDePasse, compte.secretDoubleAuth, compte.sessionsDuCompteInvalidesAvant instanceof Date]).toEqual([true, 'SECRET', true]);
    expect(parId('awa-b')!.sessionsInvalidesAvant).toBeInstanceOf(Date);
  });

  it('sans messagerie, rien ne change · 503 nommé, sur site renvoyé à l’administrateur de l’installation', async () => {
    const { prisma, parId } = await monde();
    const avant = parId('awa-a')!.motDePasse;
    await expect(new UtilisateurService(prisma).reinitialiserParCourriel('B', 'awa-b', 'admin-b', undefined, false)).rejects.toThrow(MOTIF_MESSAGERIE_REQUISE);
    await expect(new UtilisateurService(prisma).reinitialiserParCourriel('B', 'awa-b', 'admin-b', undefined, true)).rejects.toThrow(/administrateur de l'installation/);
    expect(parId('awa-a')!.motDePasse).toBe(avant);
  });

  it('sur site, l’administrateur de l’installation réinitialise · par courriel s’il y en a, sinon le provisoire lui est rendu ; le second facteur tombe', async () => {
    const { auth, authAvecCourrier, parId, facteur } = await monde();
    parId('awa-a')!.secretDoubleAuth = 'SECRET';
    const sans: any = await auth.reinitialiserCompteSurSite('Awa@Cabinet.cd', 'admin-installation');
    expect(sans.parCourriel).toBe(false);
    expect(await bcrypt.compare(sans.motDePasseProvisoire, parId('awa-a')!.motDePasse)).toBe(true);
    expect(parId('awa-a')!.secretDoubleAuth).toBeNull();
    const avec: any = await authAvecCourrier.reinitialiserCompteSurSite('awa@cabinet.cd', 'admin-installation');
    expect(avec).not.toHaveProperty('motDePasseProvisoire');
    expect(facteur.envois[0].destinataire).toBe('awa@cabinet.cd');
  });
});

describe('MAJEUR 2 · la nouvelle adresse ne se pose qu’avec le code reçu à cette adresse', () => {
  it('la demande ne change rien ; le code, depuis la même session, la pose ; une seule fois', async () => {
    const { authAvecCourrier, parId, facteur } = await monde();
    const r: any = await authAvecCourrier.changerAdresse('awa-b', 'mot-de-passe-awa', 'Awa.Neuve@cabinet.cd', null);
    expect(r).toEqual({ confirmationEnvoyee: true, adresse: 'awa.neuve@cabinet.cd' });
    expect(parId('awa-a')!.email).toBe('awa@cabinet.cd');
    expect(facteur.envois[0].destinataire).toBe('awa.neuve@cabinet.cd');
    const code = /Code de confirmation · (\S+)/.exec(facteur.envois[0].corps)![1];
    expect(facteur.envois[0].corpsGarde).not.toContain(code);
    await expect(authAvecCourrier.confirmerAdresse('bertin-c', code, null)).rejects.toThrow(NotFoundException);
    await authAvecCourrier.confirmerAdresse('awa-b', code, null);
    expect([parId('awa-a')!.email, parId('awa-b')!.email]).toEqual(['awa.neuve@cabinet.cd', 'awa.neuve@cabinet.cd']);
    await expect(authAvecCourrier.confirmerAdresse('awa-b', code, null)).rejects.toThrow(NotFoundException);
  });

  it('une seconde demande annule la première · son code ne pose plus rien', async () => {
    const { authAvecCourrier, parId, facteur } = await monde();
    await authAvecCourrier.changerAdresse('awa-a', 'mot-de-passe-awa', 'un@cabinet.cd', null);
    await authAvecCourrier.changerAdresse('awa-a', 'mot-de-passe-awa', 'deux@cabinet.cd', null);
    const premier = /Code de confirmation · (\S+)/.exec(facteur.envois[0].corps)![1];
    await expect(authAvecCourrier.confirmerAdresse('awa-a', premier, null)).rejects.toThrow(NotFoundException);
    expect(parId('awa-a')!.email).toBe('awa@cabinet.cd');
  });

  it('en ligne sans messagerie, refus ; rien ne change', async () => {
    const { auth, parId } = await monde();
    await expect(auth.changerAdresse('awa-a', 'mot-de-passe-awa', 'x@cabinet.cd', null, false)).rejects.toThrow(/messagerie est requise/);
    expect(parId('awa-a')!.email).toBe('awa@cabinet.cd');
  });
});

describe('mineur 8 · le changement de dossier ne pose aucun maillon vide dans le dossier quitté', () => {
  it('une mise à jour qui n’écrit que les sessions fermées ne fait pas d’événement ; une autre colonne, si', () => {
    expect(seulementDesColonnesSansEvenement('User', { sessionsFermees: [] })).toBe(true);
    expect(seulementDesColonnesSansEvenement('User', { sessionsFermees: [], sessionsInvalidesAvant: new Date() })).toBe(false);
    expect(seulementDesColonnesSansEvenement('User', { motDePasse: 'x' })).toBe(false);
    expect(seulementDesColonnesSansEvenement('Ecriture', { sessionsFermees: [] })).toBe(false);
  });
});

describe('l’invitation · rien n’est créé avant que la personne accepte, et l’administrateur ne lit pas si l’adresse existait', () => {
  const jetonDe = (corps: string) => /saisissez ce code : (\S+)/.exec(corps)![1];

  it('adresse connue ou neuve · même réponse, même courriel gardé, aucune ligne créée, le jeton jamais dans la file', async () => {
    const { prisma, lignes } = await monde();
    const { service, envois } = courrier();
    const inv = new InvitationsService(prisma, service as never);
    expect(inv.mode()).toBe('INVITATION');
    const nombre = lignes.length;
    const connue = await inv.inviter('C', 'bertin-c', 'Awa@Cabinet.cd', 'COMPTABLE' as never);
    const neuve = await inv.inviter('C', 'bertin-c', 'neuve@exemple.cd', 'COMPTABLE' as never);
    expect(Object.keys(connue).sort()).toEqual(Object.keys(neuve).sort());
    expect([connue.statut, neuve.statut]).toEqual(['EN_ATTENTE', 'EN_ATTENTE']);
    expect(lignes.length).toBe(nombre);
    expect(envois[0].corpsGarde).toBe(envois[1].corpsGarde.replace(/neuve@exemple\.cd/g, 'awa@cabinet.cd'));
    for (const e of envois) expect(e.corpsGarde).not.toContain(jetonDe(e.corps));
  });

  it('la personne accepte avec le jeton ET sa session · une fois ; un autre compte avec le même jeton n’entre pas', async () => {
    const { prisma, auth, lignes } = await monde();
    const { service, envois } = courrier();
    await new InvitationsService(prisma, service as never).inviter('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    const jeton = jetonDe(envois[0].corps);
    expect((await auth.mesInvitations('awa-b')).map((i) => [i.dossier, i.role])).toEqual([['Cabinet voisin', 'COMPTABLE']]);
    await expect(auth.accepterUneInvitation('bertin-c', jeton)).rejects.toThrow(NotFoundException);
    await expect(auth.accepterUneInvitation('awa-b', jeton)).resolves.toEqual({ dossierId: 'C' });
    const ligne = lignes.find((l) => l.tenantId === 'C' && l.email === 'awa@cabinet.cd')!;
    expect([ligne.compteDeConnexionId, ligne.role, ligne.doitChangerMotDePasse]).toEqual(['awa-a', 'COMPTABLE', false]);
    await expect(auth.accepterUneInvitation('awa-a', jeton)).rejects.toThrow(NotFoundException);
  });

  it('le compte sans la boîte n’accepte rien · sans le jeton reçu, aucun chemin', async () => {
    const { prisma, auth } = await monde();
    const { service } = courrier();
    await new InvitationsService(prisma, service as never).inviter('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    await expect(auth.accepterUneInvitation('awa-a', 'un-code-devine-au-hasard-0000000000')).rejects.toThrow(NotFoundException);
  });

  it('une adresse neuve crée son compte avec SON mot de passe ; une adresse connue est renvoyée à la connexion', async () => {
    const { prisma, auth, lignes } = await monde();
    const { service, envois } = courrier();
    const inv = new InvitationsService(prisma, service as never);
    await inv.inviter('C', 'bertin-c', 'neuve@exemple.cd', 'LECTURE_SEULE' as never);
    await inv.inviter('C', 'bertin-c', 'awa@cabinet.cd', 'COMPTABLE' as never);
    await auth.creerMonCompteParInvitation(jetonDe(envois[0].corps), 'Son-mot-de-passe-2026');
    const neuve = lignes.find((l) => l.email === 'neuve@exemple.cd')!;
    expect([neuve.tenantId, neuve.role, neuve.compteDeConnexionId]).toEqual(['C', 'LECTURE_SEULE', null]);
    expect(await bcrypt.compare('Son-mot-de-passe-2026', neuve.motDePasse)).toBe(true);
    await expect(auth.creerMonCompteParInvitation(jetonDe(envois[1].corps), 'Autre-mot-de-passe-2026')).rejects.toThrow(/déjà un compte/);
  });

  it('une adresse déjà utilisatrice du dossier se refuse, comme avant · le dossier la voit déjà', async () => {
    const { prisma } = await monde();
    const { service } = courrier();
    await expect(new InvitationsService(prisma, service as never).inviter('B', 'x', 'awa@cabinet.cd', 'COMPTABLE' as never)).rejects.toThrow(MOTIF_ADRESSE_DU_DOSSIER);
  });
});

describe('B1 · un onglet resté sur un autre dossier n’écrit pas dans celui de la session', () => {
  const req = (method: string, dossier?: string) => ({ method, headers: dossier ? { 'x-dossier': dossier } : {} });
  it('un dossier annoncé différent de la session est refusé en 409 nommé, sur toute modification', () => {
    expect(motifDossierChange(req('POST', 'A'), 'B', false, true)).toBe(MOTIF_DOSSIER_CHANGE);
    expect(motifDossierChange(req('DELETE', 'A'), 'B', true, true)).toBe(MOTIF_DOSSIER_CHANGE);
    expect(motifDossierChange(req('POST', 'B'), 'B', true, true)).toBeNull();
  });
  it('l’en-tête est exigé de la session d’une personne qui a plusieurs dossiers ; une lecture, un jeton par en-tête, un seul dossier passent', () => {
    expect(motifDossierChange(req('POST'), 'B', true, true)).toBe(MOTIF_DOSSIER_CHANGE);
    expect(motifDossierChange(req('POST'), 'B', false, true)).toBeNull();
    expect(motifDossierChange(req('GET', 'A'), 'B', true, true)).toBeNull();
    expect(motifDossierChange(req('POST', 'A'), 'B', true, false)).toBeNull();
  });
  it('la garde lève le 409 marqué que l’écran lit, avant de prolonger la session', () => {
    const garde = readFileSync(join(__dirname, 'jwt-auth.guard.ts'), 'utf8');
    const corps = garde.slice(garde.indexOf('async canActivate'));
    const refus = corps.indexOf('throw new ConflictException({ statusCode: 409, error: \'Conflict\', message: motifDossier, dossierChange: true })');
    expect(refus).toBeGreaterThan(0);
    expect(corps.indexOf('poserCookieSession(')).toBeGreaterThan(refus);
  });
  it('la connexion qui constate plusieurs dossiers, et le changement de dossier, posent la claim que la prolongation recopie', async () => {
    const { auth, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    expect(jwt.verify<ChargeJeton>(r.accessToken).plusieursDossiers).toBe(true);
    const seul: any = await auth.login({ email: 'bertin@autre.cd', motDePasse: 'mot-de-passe-awa' } as never);
    expect(jwt.verify<ChargeJeton>(seul.accessToken).plusieursDossiers).toBeUndefined();
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    expect(jwt.verify<ChargeJeton>(session!.accessToken).plusieursDossiers).toBe(true);
    expect(demandeDeReemission(sessionDuJeton(jwt.verify(session!.accessToken), 0)).plusieursDossiers).toBe(true);
  });
});

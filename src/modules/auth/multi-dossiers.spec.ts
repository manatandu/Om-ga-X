import 'reflect-metadata';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { appartenanceDeConnexion, idDuCompteDeConnexion } from './compte-de-connexion';
import { sessionDuJeton, ChargeJeton } from './session-longue';
import { empreinteSession } from './sessions-fermees';
import { UtilisateurService } from '../utilisateurs/utilisateur.service';

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
    sessionsInvalidesAvant: null, doitChangerMotDePasse: false, restreindreFonctions: false, fonctionsAutorisees: [],
    restreindreJournaux: false, journauxAutorises: [], restreindreLogiciels: false, logicielsAutorises: [] };
  const lignes: Ligne[] = [
    { ...base, id: 'awa-a', tenantId: 'A', email: 'awa@cabinet.cd', role: 'ADMIN_CABINET', estActif: true, compteDeConnexionId: null, createdAt: new Date('2026-01-01') },
    { ...base, id: 'awa-b', tenantId: 'B', email: 'awa@cabinet.cd', role: 'AIDE_COMPTABLE', estActif: true, compteDeConnexionId: 'awa-a', createdAt: new Date('2026-06-01'),
      motDePasse: await bcrypt.hash('jamais-lu', 4) },
    { ...base, id: 'bertin-c', tenantId: 'C', email: 'bertin@autre.cd', role: 'ADMIN_CABINET', estActif: true, compteDeConnexionId: null, createdAt: new Date('2026-02-01') },
  ];
  const dossiers = [
    { id: 'A', nom: 'Association Lumière', referentiel: 'SYCEBNL', licence: null },
    { id: 'B', nom: 'Société Kivu', referentiel: 'SYSCOHADA', licence: null },
    { id: 'C', nom: 'Cabinet voisin', referentiel: 'SYCEBNL', licence: null },
  ];
  const parId = (id: string) => lignes.find((l) => l.id === id) ?? null;
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
    tenant: { findMany: async ({ where }: any) => dossiers.filter((d) => where.id.in.includes(d.id)) },
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
  const strategie = new JwtStrategy({ getOrThrow: () => 'secret-de-test' } as never, prisma, jwt);
  const requete = (jeton: string, method = 'GET', csrf?: string) =>
    ({ method, headers: csrf ? { 'x-csrf-token': csrf } : {}, cookies: { __session: jeton } }) as never;
  const valider = (jeton: string) => strategie.validate(requete(jeton), jwt.verify<ChargeJeton>(jeton));
  return { lignes, prisma, auth, jwt, valider, parId };
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
    const a = (id: string, estActif: boolean, t: string) => ({ id, tenantId: t, role: 'COMPTABLE' as never, estActif, sessionsInvalidesAvant: null, createdAt: new Date(t) });
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

  it('la révocation du COMPTE (mot de passe changé) ferme aussi la session ouverte dans l’autre dossier', async () => {
    const { auth, valider, parId, jwt } = await monde();
    const r: any = await auth.login({ email: 'awa@cabinet.cd', motDePasse: 'mot-de-passe-awa' } as never);
    const { session } = await auth.changerDeDossier('awa-a', 'B', sessionDuJeton(jwt.verify(r.accessToken), Math.floor(Date.now() / 1000)));
    await expect(valider(session!.accessToken)).resolves.toMatchObject({ tenantId: 'B' });
    parId('awa-a')!.sessionsInvalidesAvant = new Date(Date.now() + 2000);
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

  it('la liste · SES dossiers, leur référentiel, leur exercice ouvert et son rôle, jamais celui d’un autre', async () => {
    const { auth } = await monde();
    const liste = await auth.mesDossiers('awa-b');
    expect(liste.map((d) => [d.dossierId, d.nom, d.referentiel, d.role, d.exercice?.dateDebut.toISOString().slice(0, 10) ?? null, d.courant])).toEqual([
      ['A', 'Association Lumière', 'SYCEBNL', 'ADMIN_CABINET', '2026-01-01', false],
      ['B', 'Société Kivu', 'SYSCOHADA', 'AIDE_COMPTABLE', null, true],
    ]);
    expect((await auth.mesDossiers('bertin-c')).map((d) => d.dossierId)).toEqual(['C']);
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
    await auth.changerAdresse('awa-b', 'mot-de-passe-awa', 'Awa.Nouvelle@cabinet.cd', null);
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

describe('rattacher une personne · l’administrateur d’un dossier, et rien sur ses autres dossiers', () => {
  it('une adresse déjà compte de connexion AILLEURS devient une appartenance de CE dossier, réponse identique à une création', async () => {
    const { prisma, lignes } = await monde();
    const s = new UtilisateurService(prisma);
    const rattache = await s.creer('C', { email: 'Awa@Cabinet.cd', motDePasse: 'choisi-par-c', role: 'COMPTABLE' } as never);
    const nouveau = await s.creer('C', { email: 'inconnu@neuf.cd', motDePasse: 'choisi-par-c', role: 'COMPTABLE' } as never);
    expect(Object.keys(rattache).sort()).toEqual(Object.keys(nouveau).sort());
    expect(rattache).not.toHaveProperty('compteDeConnexionId');
    const ligne = lignes.find((l) => l.tenantId === 'C' && l.email === 'awa@cabinet.cd')!;
    expect([ligne.compteDeConnexionId, ligne.role, ligne.doitChangerMotDePasse]).toEqual(['awa-a', 'COMPTABLE', true]);
    // Le mot de passe du compte de la personne n'a pas changé.
    expect(await bcrypt.compare('mot-de-passe-awa', lignes.find((l) => l.id === 'awa-a')!.motDePasse)).toBe(true);
    const inconnu = lignes.find((l) => l.email === 'inconnu@neuf.cd')!;
    expect(inconnu.compteDeConnexionId).toBeNull();
  });
});

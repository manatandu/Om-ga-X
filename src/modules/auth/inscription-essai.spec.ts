import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Referentiel, RoleUtilisateur } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES,
  avisInscriptionEssai,
  FENETRE_RENVOI_HEURES,
  finDeLEssai,
  JOURS_ESSAI,
  renvoiPossible,
  estUnDossierDEssai,
} from './inscription-essai';

/**
 * L'INSCRIPTION AVEC ESSAI · ce qui casserait en silence : un dossier d'essai
 * SANS échéance (le produit gratuit à vie), un mot de passe écrit dans la file
 * des courriels, une session rendue, ou une porte ouverte qu'on croyait fermée.
 */
const MINUTE = 60_000;
const HEURE = 3_600_000;

function monter(options: { transport?: boolean; utilisateur?: Record<string, unknown> | null; envoiEchoue?: boolean; licence?: Record<string, unknown> | null; conflit?: boolean } = {}) {
  const envois: { tenantId: string; message: { destinataire: string; corps: string }; corpsGarde: string }[] = [];
  const mises: Record<string, unknown>[] = [];
  const courrier = {
    etatDuTransport: () => ({ configure: options.transport ?? true }),
    envoyerUnSecret: async (tenantId: string, message: { destinataire: string; corps: string }, corpsGarde: string) => {
      if (options.envoiEchoue) throw new Error('SMTP hors service');
      envois.push({ tenantId, message, corpsGarde });
      return { id: 'm1', statut: 'ENVOYE', erreur: null };
    },
  };
  const debut = new Date('2026-10-10T08:00:00Z');
  const prisma = {
    licence: {
      findUnique: async () =>
        options.licence === undefined
          ? { type: 'ABONNEMENT', dateDebut: debut, dateExpiration: new Date(debut.getTime() + 30 * 86_400_000) }
          : options.licence,
    },
    user: {
      findUnique: async () => options.utilisateur ?? null,
      update: async (arg: { data: Record<string, unknown> }) => {
        mises.push(arg.data);
        return {};
      },
    },
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, undefined, courrier as never);
  const appels: { dto: Record<string, unknown>; options: Record<string, unknown> }[] = [];
  jest.spyOn(service, 'register').mockImplementation((async (dto: never, opts: never) => {
    appels.push({ dto, options: opts });
    if (options.conflit) throw new ConflictException('Un compte existe déjà avec cet email');
    return { tenant: { id: 'T-neuf' }, exercice: {}, accessToken: 'NE-DOIT-JAMAIS-SORTIR' };
  }) as never);
  return { service, envois, mises, appels };
}

const demande = { nomEntite: '  Association Espoir ', referentiel: Referentiel.SYCEBNL, email: 'Nouveau@Exemple.cd' } as never;

describe('briques pures', () => {
  it("l'essai dure trente jours, le même nombre que la facturation des abonnements", () => {
    expect(JOURS_ESSAI).toBe(30);
    expect(finDeLEssai(new Date('2026-10-17T08:00:00Z')).toISOString()).toBe('2026-11-16T08:00:00.000Z');
    expect(finDeLEssai(new Date('2026-12-20T08:00:00Z')).toISOString()).toBe('2027-01-19T08:00:00.000Z');
  });

  it('le courriel porte le mot de passe, le corps gardé ne le porte pas et ne contient pas le corps', () => {
    const { corps, corpsGarde, sujet } = avisInscriptionEssai('Zz9-secret-Zz9', new Date('2026-11-16T12:00:00Z'), true);
    expect(corps).toContain('Zz9-secret-Zz9');
    expect(corps).toContain('16 novembre 2026');
    expect(corpsGarde).not.toContain('Zz9-secret-Zz9');
    expect(corpsGarde.includes(corps)).toBe(false);
    expect(sujet).toMatch(/essai/i);
    expect(avisInscriptionEssai('x1', new Date(), false).sujet).not.toMatch(/dossier d'essai/);
  });

  it("seul un dossier à licence d'essai de trente jours se rouvre", () => {
    const d = new Date('2026-10-10T08:00:00Z');
    const fin = (jours: number) => new Date(d.getTime() + jours * 86_400_000);
    expect(estUnDossierDEssai({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: fin(30) })).toBe(true);
    expect(estUnDossierDEssai({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: fin(365) })).toBe(false);
    expect(estUnDossierDEssai({ type: 'ABONNEMENT', dateDebut: d, dateExpiration: null })).toBe(false);
    expect(estUnDossierDEssai({ type: 'PROPRIETAIRE', dateDebut: d, dateExpiration: fin(30) })).toBe(false);
    expect(estUnDossierDEssai(null)).toBe(false);
  });

  it('le renvoi : titulaire à changer, né depuis moins de 72 h, dernier envoi il y a 10 minutes au moins', () => {
    const maintenant = new Date('2026-10-17T12:00:00Z');
    const compte = (o: Partial<Parameters<typeof renvoiPossible>[0]>) => ({
      doitChangerMotDePasse: true,
      createdAt: new Date(maintenant.getTime() - HEURE),
      sessionsInvalidesAvant: null,
      ...o,
    });
    expect(renvoiPossible(compte({}), maintenant)).toBe(true);
    // mot de passe déjà changé · le compte est ouvert, aucun renvoi
    expect(renvoiPossible(compte({ doitChangerMotDePasse: false }), maintenant)).toBe(false);
    // né il y a plus de 72 h
    expect(renvoiPossible(compte({ createdAt: new Date(maintenant.getTime() - (FENETRE_RENVOI_HEURES + 1) * HEURE) }), maintenant)).toBe(false);
    // né il y a neuf minutes
    expect(renvoiPossible(compte({ createdAt: new Date(maintenant.getTime() - 9 * MINUTE) }), maintenant)).toBe(false);
    // renvoyé il y a neuf minutes, puis il y a dix
    expect(renvoiPossible(compte({ sessionsInvalidesAvant: new Date(maintenant.getTime() - 9 * MINUTE) }), maintenant)).toBe(false);
    expect(renvoiPossible(compte({ sessionsInvalidesAvant: new Date(maintenant.getTime() - ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES * MINUTE) }), maintenant)).toBe(true);
  });
});

describe('AuthService.inscrireEnEssai', () => {
  it('sans messagerie, RIEN n est créé', async () => {
    const { service, appels } = monter({ transport: false });
    await expect(service.inscrireEnEssai(demande)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(appels).toHaveLength(0);
  });

  it('une adresse neuve crée un dossier d ESSAI à échéance, au mot de passe provisoire, sans session', async () => {
    const { service, envois, appels } = monter();
    const avant = Date.now();
    const r = await service.inscrireEnEssai(demande);
    expect(appels).toHaveLength(1);
    const { dto, options } = appels[0];
    expect(dto.email).toBe('nouveau@exemple.cd');
    expect(dto.nomEntite).toBe('Association Espoir');
    expect(dto).not.toHaveProperty('typeLicence');
    expect(options.motDePasseProvisoire).toBe(true);
    const fin = (options.dateExpirationLicence as Date).getTime();
    expect(fin - avant).toBeGreaterThanOrEqual(JOURS_ESSAI * 24 * HEURE - 5_000);
    expect(fin - avant).toBeLessThanOrEqual(JOURS_ESSAI * 24 * HEURE + 5_000);
    // le mot de passe envoyé est celui du dossier, au seul courriel donné
    expect(envois).toHaveLength(1);
    expect(envois[0].tenantId).toBe('T-neuf');
    expect(envois[0].message.destinataire).toBe('nouveau@exemple.cd');
    expect(envois[0].message.corps).toContain(dto.motDePasse as string);
    expect(envois[0].corpsGarde).not.toContain(dto.motDePasse as string);
    expect((dto.motDePasse as string).length).toBeGreaterThanOrEqual(10);
    // aucune session, aucun jeton
    expect(JSON.stringify(r)).not.toContain('NE-DOIT-JAMAIS-SORTIR');
    expect(r).not.toHaveProperty('accessToken');
    expect(r.joursEssai).toBe(30);
    // la réponse commune guide celui qui a déjà un dossier SANS dire que l'adresse est connue
    expect(r.message).toContain('déjà un dossier');
  });

  it('une adresse déjà prise rend la MÊME réponse et ne crée ni n envoie rien', async () => {
    const neuve = monter();
    const rNeuve = await neuve.service.inscrireEnEssai(demande);
    const prise = monter({
      utilisateur: { id: 'u1', tenantId: 't1', role: RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: false, createdAt: new Date('2026-01-01'), sessionsInvalidesAvant: null },
    });
    const rPrise = await prise.service.inscrireEnEssai(demande);
    expect(rPrise).toEqual(rNeuve);
    expect(prise.appels).toHaveLength(0);
    expect(prise.envois).toHaveLength(0);
    expect(prise.mises).toHaveLength(0);
  });

  it('un titulaire qui n a rien reçu reçoit un NOUVEAU mot de passe, à sa seule adresse, et ses sessions sont fermées', async () => {
    const { service, envois, mises, appels } = monter({
      utilisateur: {
        id: 'u1', tenantId: 't1', role: RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true,
        createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null,
      },
    });
    await service.inscrireEnEssai(demande);
    expect(appels).toHaveLength(0);
    expect(envois).toHaveLength(1);
    expect(envois[0].tenantId).toBe('t1');
    expect(envois[0].message.destinataire).toBe('nouveau@exemple.cd');
    expect(mises).toHaveLength(1);
    expect(mises[0].doitChangerMotDePasse).toBe(true);
    expect(mises[0].sessionsInvalidesAvant).toBeInstanceOf(Date);
    expect(String(mises[0].motDePasse)).toMatch(/^\$2[aby]\$/);
  });

  it('un renvoi trop rapproché, ou vers un compte qui n est pas un administrateur, ne part pas', async () => {
    for (const utilisateur of [
      { id: 'u1', tenantId: 't1', role: RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - 2 * MINUTE), sessionsInvalidesAvant: null },
      { id: 'u2', tenantId: 't1', role: RoleUtilisateur.COMPTABLE, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null },
    ]) {
      const { service, envois, mises } = monter({ utilisateur });
      await service.inscrireEnEssai(demande);
      expect(envois).toHaveLength(0);
      expect(mises).toHaveLength(0);
    }
  });

  it("un cabinet ouvert autrement (licence qui n'est pas un essai de trente jours) n'est jamais touché", async () => {
    const utilisateur = { id: 'u1', tenantId: 't1', role: RoleUtilisateur.ADMIN_CABINET, doitChangerMotDePasse: true, createdAt: new Date(Date.now() - HEURE), sessionsInvalidesAvant: null };
    const { service, envois, mises } = monter({ utilisateur, licence: { type: 'ABONNEMENT', dateDebut: new Date('2026-10-10'), dateExpiration: new Date('2027-10-10') } });
    await service.inscrireEnEssai(demande);
    expect(envois).toHaveLength(0);
    expect(mises).toHaveLength(0);
  });

  it("deux demandes simultanées pour la même adresse neuve · la perdante reçoit la réponse commune, pas un refus", async () => {
    const { service } = monter({ conflit: true });
    const neutre = await monter().service.inscrireEnEssai(demande);
    await expect(service.inscrireEnEssai(demande)).resolves.toEqual(neutre);
  });

  it('un courriel qui ne part pas laisse un refus qui dit de recommencer, jamais un succès', async () => {
    const { service } = monter({ envoiEchoue: true });
    await expect(service.inscrireEnEssai(demande)).rejects.toThrow(/Recommencez dans une dizaine de minutes/);
  });
});

describe('AuthController · la porte est fermée à clé', () => {
  const controleur = (valeur: string | undefined) => {
    const service = { inscrireEnEssai: jest.fn(async () => ({ message: 'ok', joursEssai: 30 })) };
    const c = new AuthController(service as never, { get: (k: string) => (k === 'INSCRIPTION_ESSAI' ? valeur : undefined) } as never);
    return { c, service };
  };

  it('sans INSCRIPTION_ESSAI, le serveur refuse et l écran n offre rien', async () => {
    for (const valeur of [undefined, '', 'false', 'oui', 'TRUE']) {
      const { c, service } = controleur(valeur);
      expect(c.etatInscriptionEssai().ouverte).toBe(false);
      await expect(c.inscrireEnEssai(demande)).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.inscrireEnEssai).not.toHaveBeenCalled();
    }
  });

  it('avec INSCRIPTION_ESSAI=true, elle sert', async () => {
    const { c, service } = controleur('true');
    expect(c.etatInscriptionEssai()).toEqual({ ouverte: true, joursEssai: 30 });
    await c.inscrireEnEssai(demande);
    expect(service.inscrireEnEssai).toHaveBeenCalledTimes(1);
  });

  it('la route est limitée en débit : cinq par heure', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.inscrireEnEssai)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', AuthController.prototype.inscrireEnEssai)).toBe(3_600_000);
  });

  it('POST /auth/register reste fermé sans INSCRIPTION_PUBLIQUE', async () => {
    const c = new AuthController({ register: jest.fn() } as never, { get: () => undefined } as never);
    await expect(c.register({} as never, {} as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StatutMessage } from '@prisma/client';
import { ORIGINE_INSCRIPTION_ESSAI } from '../../auth/inscription-essai';
import { ORIGINE_RAPPEL_SUPPRESSION_ESSAI } from '../../courrier/courrier.service';
import { EssaisEchusService } from './essais-echus.service';
import { planDePurge } from './purger-dossier';

/**
 * LE SERVICE DES ESSAIS ÉCHUS, SUR UNE DOUBLURE · ce qui casserait en silence :
 * un rappel parti deux fois, un rappel compté parti alors que son message ne
 * l'est pas, une suppression qui se fie à la liste, une trace qui garde une
 * donnée du client, une purge lancée avant les contrôles.
 *
 * La doublure honore ce que le service lit (elle rend ce qu'on lui donne ·
 * CLAUDE.md § 6, « la doublure doit honorer la requête ») ; l'exécution réelle
 * (ordre des clés étrangères, cascade, verrous) est rejouée sur vraie base par
 * `scripts/rejouer-suppression-essais.cjs`.
 */
const MAINTENANT = new Date('2026-07-10T08:00:00Z');
const jours = (n: number) => new Date(MAINTENANT.getTime() + n * 86_400_000);
const T = 'dossier-essai-1';

interface Scenario {
  /** Jours entre le terme et maintenant (positif = terme passé). */
  termeIlYa?: number;
  rappel?: { envoyeLeIlYa: number | null; messageId?: string; statut?: StatutMessage; misEnFileIlYaMinutes?: number } | null;
  abonnement?: boolean;
  groupe?: boolean;
  inscrit?: boolean;
  transport?: boolean;
  admin?: { email: string } | null;
  envoi?: { statut: StatutMessage; erreur?: string | null };
  dossierExiste?: boolean;
  reservationDejaPrise?: boolean;
}

function monter(s: Scenario = {}) {
  const fin = jours(-(s.termeIlYa ?? 160));
  const debut = new Date(fin.getTime() - 30 * 86_400_000);
  const rappelLigne =
    s.rappel === undefined || s.rappel === null
      ? []
      : [
          {
            id: 'r-1',
            cabinetId: T,
            messageId: s.rappel.messageId ?? 'm-rappel',
            misEnFileLe:
              s.rappel.misEnFileIlYaMinutes !== undefined
                ? new Date(MAINTENANT.getTime() - s.rappel.misEnFileIlYaMinutes * 60_000)
                : s.rappel.envoyeLeIlYa === null ? jours(-1) : jours(-s.rappel.envoyeLeIlYa),
            envoyeLe: s.rappel.envoyeLeIlYa === null ? null : jours(-s.rappel.envoyeLeIlYa),
            supprimableLe: jours(30),
            parOperateur: 'op@exemple.invalid',
            createdAt: jours(-1),
          },
        ];
  const appels: string[] = [];
  // eslint-disable-next-line prefer-const
  let lecteur: any;
  lecteur = {
    $queryRaw: jest
      .fn()
      // 1 candidats, 2 total · puis, en transaction, le verrou de la ligne du dossier.
      .mockImplementation(async (...args: unknown[]) => {
        const texte = String((args[0] as string[]).join('?'));
        if (texte.includes('FOR UPDATE')) return s.dossierExiste === false ? [] : [{ id: T }];
        if (texte.includes('count(*)')) return [{ n: BigInt(1) }];
        return [{ tenantId: T }];
      }),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $executeRawUnsafe: jest.fn(async (sql: string) => {
      appels.push(sql);
      return sql.startsWith('DELETE FROM "tenants"') ? 1 : 3;
    }),
    tenant: {
      findMany: jest.fn(async (args: { where: Record<string, unknown> }) =>
        'id' in args.where ? [{ id: T, estDemonstration: false, dossierMereId: null, dossierCombinaisonId: null }] : s.groupe ? [{ dossierMereId: T, dossierCombinaisonId: null }] : [],
      ),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue({ createdAt: new Date('2026-01-01T10:00:00Z') }),
    },
    licence: { findMany: jest.fn().mockResolvedValue([{ tenantId: T, type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: debut, dateExpiration: fin }]) },
    abonnementCabinet: { findMany: jest.fn().mockResolvedValue(s.abonnement ? [{ cabinetId: T }] : []), count: jest.fn().mockResolvedValue(0) },
    tiers: { findMany: jest.fn().mockResolvedValue([]) },
    message: {
      findMany: jest.fn(async (args: { where: { origine?: string; id?: { in: string[] } } }) =>
        args.where.origine === ORIGINE_INSCRIPTION_ESSAI
          ? s.inscrit === false ? [] : [{ tenantId: T, origineId: T }]
          : (args.where.id?.in ?? []).map((id) => ({ id, statut: s.rappel?.statut ?? StatutMessage.ENVOYE, erreur: null })),
      ),
      findFirst: jest.fn(async (args: { where: { origine?: string } }) =>
        args.where.origine === ORIGINE_RAPPEL_SUPPRESSION_ESSAI ? null : { statut: s.rappel?.statut ?? StatutMessage.ENVOYE, envoyeAt: jours(-31), erreur: null },
      ),
    },
    rappelSuppressionEssai: {
      findMany: jest.fn().mockResolvedValue(rappelLigne),
      create: jest.fn(async () => {
        if (s.reservationDejaPrise) throw Object.assign(new Error('doublon'), { code: 'P2002' });
        appels.push('RESERVATION');
        return { id: 'r-nouveau' };
      }),
      update: jest.fn(async () => {
        appels.push('MISE_A_JOUR_RAPPEL');
        return {};
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    dossierEssaiSupprime: {
      create: jest.fn(async () => {
        appels.push('TRACE');
        return {};
      }),
    },
    user: {
      groupBy: jest.fn().mockResolvedValue([{ tenantId: T, _count: { _all: 2 } }]),
      findFirst: jest.fn().mockResolvedValue(s.admin === undefined ? { email: 'admin@client.invalid' } : s.admin),
    },
    exercice: { groupBy: jest.fn().mockResolvedValue([{ tenantId: T, _count: { _all: 3 } }]) },
    ecriture: { groupBy: jest.fn().mockResolvedValue([{ tenantId: T, _count: { _all: 41 } }]) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(lecteur)),
  };
  const courrier = {
    etatDuTransport: jest.fn().mockReturnValue({ configure: s.transport !== false, manques: [], expediteur: 'x@y.z' }),
    mettreEnFile: jest.fn(async () => {
      appels.push('ENVOI');
      return { id: 'm-nouveau', statut: s.envoi?.statut ?? StatutMessage.ENVOYE, erreur: s.envoi?.erreur ?? null };
    }),
    retenter: jest.fn().mockResolvedValue({ id: 'm-rappel', statut: StatutMessage.ENVOYE, erreur: null }),
  };
  const service = new EssaisEchusService(lecteur as never, courrier as never);
  return { service, lecteur, courrier, appels };
}

const OPERATEUR = { userId: 'u-op', email: 'op@exemple.invalid' };

describe('lister · identifiants, dates, état et nombres, JAMAIS une donnée du client', () => {
  it('rend l’état et les dates, sans nom, sans adresse, sans montant', async () => {
    const { service } = monter();
    const r = await service.lister(MAINTENANT);
    expect(r.essais).toHaveLength(1);
    const ligne = r.essais[0];
    expect(ligne).toMatchObject({ tenantId: T, etat: 'RAPPEL_A_ENVOYER', nombreUtilisateurs: 2, nombreExercices: 3, nombreEcritures: 41 });
    expect(ligne.termeLe).toBe('2026-01-31');
    expect(ligne.conserveJusquAu).toBe('2026-07-30');
    // La forme est FERMÉE · ces clés et aucune autre (ni nom d'entité, ni adresse, ni montant).
    expect(Object.keys(ligne).sort()).toEqual(
      ['conserveJusquAu', 'etat', 'nombreEcritures', 'nombreExercices', 'nombreUtilisateurs', 'rappel', 'rappelDepuisLe', 'supprimableLe', 'tenantId', 'termeLe'].sort(),
    );
    expect(JSON.stringify(r)).not.toMatch(/@client\.invalid|@/);
  });

  it('un dossier non concerné n’est pas proposé (abonnement, groupe, hors inscription en libre-service)', async () => {
    for (const s of [{ abonnement: true }, { groupe: true }, { inscrit: false }]) {
      const { service } = monter(s);
      expect((await service.lister(MAINTENANT)).essais).toEqual([]);
    }
  });

  it('un essai qui court encore n’est pas proposé', async () => {
    const { service } = monter({ termeIlYa: -5 });
    expect((await service.lister(MAINTENANT)).essais).toEqual([]);
  });

  it('dit sa tranche (total compté par la base)', async () => {
    const { service } = monter();
    const r = await service.lister(MAINTENANT);
    expect(r).toMatchObject({ total: 1, tronque: false });
  });
});

describe('envoyerRappels', () => {
  it('SANS MESSAGERIE, RIEN N’EST FAIT · 409 avant toute lecture', async () => {
    const { service, lecteur, courrier } = monter({ transport: false });
    await expect(service.envoyerRappels(OPERATEUR, MAINTENANT)).rejects.toBeInstanceOf(ConflictException);
    expect(lecteur.$queryRaw).not.toHaveBeenCalled();
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('la ligne de suivi est RÉSERVÉE avant l’envoi, le message part à l’administrateur, la ligne dit « parti »', async () => {
    const { service, courrier, lecteur, appels } = monter();
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats).toEqual([{ tenantId: T, issue: 'ENVOYE', detail: null }]);
    // Une tranche qui se dit · « aucun rappel » ne couvre jamais des dossiers non examinés.
    expect(r).toMatchObject({ total: 1, tronque: false });
    expect(appels).toEqual(['RESERVATION', 'ENVOI', 'MISE_A_JOUR_RAPPEL']);
    const [tenantId, message] = courrier.mettreEnFile.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(tenantId).toBe(T);
    expect(message).toMatchObject({ destinataire: 'admin@client.invalid', origine: ORIGINE_RAPPEL_SUPPRESSION_ESSAI, origineId: T, createdBy: 'u-op' });
    expect(message.corps).toContain('Restituer le dossier complet');
    // L'administrateur le plus ancien et actif, et lui seul.
    const choix = lecteur.user.findFirst.mock.calls[0][0] as { where: Record<string, unknown>; orderBy: unknown };
    expect(choix.where).toMatchObject({ tenantId: T, role: 'ADMIN_CABINET', estActif: true });
    expect(choix.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    // « parti » = message constaté envoyé · la ligne reçoit une date d'envoi.
    const maj = lecteur.rappelSuppressionEssai.update.mock.calls[0][0] as { data: { messageId: string; envoyeLe: Date | null } };
    expect(maj.data.messageId).toBe('m-nouveau');
    expect(maj.data.envoyeLe).toEqual(MAINTENANT);
  });

  it('UN RAPPEL MIS EN FILE MAIS PAS PARTI N’EST PAS « PARTI » · pas de date d’envoi, et c’est dit', async () => {
    const { service, lecteur } = monter({ envoi: { statut: StatutMessage.EN_ATTENTE, erreur: 'Connexion refusée' } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ tenantId: T, issue: 'EN_FILE' });
    expect(r.resultats[0].detail).toContain('Connexion refusée');
    expect((lecteur.rappelSuppressionEssai.update.mock.calls[0][0] as { data: { envoyeLe: Date | null } }).data.envoyeLe).toBeNull();
    expect(r.enFile).toBe(1);
  });

  it('JAMAIS EN DOUBLON · la réservation prise par un autre envoi arrête celui-ci avant tout courriel', async () => {
    const { service, courrier } = monter({ reservationDejaPrise: true });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0].issue).toBe('EN_COURS');
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('une réservation récente sans message (envoi en cours ailleurs) est respectée', async () => {
    const { service, courrier } = monter({ rappel: { envoyeLeIlYa: null, messageId: '', misEnFileIlYaMinutes: 3 } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0].issue).toBe('EN_COURS');
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('une réservation ORPHELINE (processus tombé, plus de quinze minutes) est reprise comme un premier envoi', async () => {
    const { service, courrier, lecteur } = monter({ rappel: { envoyeLeIlYa: null, messageId: '', misEnFileIlYaMinutes: 45 } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(lecteur.rappelSuppressionEssai.deleteMany).toHaveBeenCalled();
    expect(courrier.mettreEnFile).toHaveBeenCalledTimes(1);
    expect(r.resultats[0].issue).toBe('ENVOYE');
  });

  it('un rappel en file se RETENTE (ce message précis), il ne s’écrit pas une seconde fois', async () => {
    const { service, courrier, lecteur } = monter({ rappel: { envoyeLeIlYa: null, statut: StatutMessage.ECHEC } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(courrier.retenter).toHaveBeenCalledWith(T, 'm-rappel');
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    expect(r.resultats[0].issue).toBe('ENVOYE');
    expect((lecteur.rappelSuppressionEssai.update.mock.calls[0][0] as { data: { envoyeLe: Date } }).data.envoyeLe).toBeInstanceOf(Date);
  });

  it('un message abandonné lève la réservation et le DIT, au lieu de laisser croire que le préavis court', async () => {
    const { service, lecteur } = monter({ rappel: { envoyeLeIlYa: null, statut: StatutMessage.ABANDONNE } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0].issue).toBe('ECHEC');
    expect(lecteur.rappelSuppressionEssai.deleteMany).toHaveBeenCalled();
  });

  it('sans administrateur actif, le rappel ne part pas et le dit', async () => {
    const { service, courrier } = monter({ admin: null });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0].issue).toBe('SANS_ADMINISTRATEUR');
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    expect(r.echecs).toBe(1);
  });

  it('un échec d’écriture du message LIBÈRE la réservation et remonte dans le compte rendu, sans arrêter les autres', async () => {
    const { service, courrier, lecteur } = monter();
    courrier.mettreEnFile.mockRejectedValueOnce(new BadRequestException('Adresse de destinataire inutilisable'));
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ issue: 'ECHEC' });
    expect(r.resultats[0].detail).toContain('Adresse de destinataire inutilisable');
    expect(lecteur.rappelSuppressionEssai.deleteMany).toHaveBeenCalled();
  });

  it('un dossier dont le rappel est déjà parti n’est pas rappelé', async () => {
    const { service, courrier } = monter({ rappel: { envoyeLeIlYa: 5 } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats).toEqual([]);
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('un dossier qui n’est pas encore dans la fenêtre du rappel n’est pas rappelé', async () => {
    const { service, courrier } = monter({ termeIlYa: 100 });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats).toEqual([]);
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });
});

describe('supprimer', () => {
  const pret: Scenario = { termeIlYa: 200, rappel: { envoyeLeIlYa: 31 } };

  it('exige que l’identifiant soit retapé · rien n’est lu, rien n’est ouvert', async () => {
    const { service, lecteur } = monter(pret);
    await expect(service.supprimer(T, OPERATEUR, 'un-autre', MAINTENANT)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.supprimer(T, OPERATEUR, '', MAINTENANT)).rejects.toBeInstanceOf(BadRequestException);
    expect(lecteur.$transaction).not.toHaveBeenCalled();
  });

  it('REFUSE (409) tant que l’état n’est pas SUPPRIMABLE, sans toucher une ligne', async () => {
    for (const s of [
      { termeIlYa: 200, rappel: null }, // rappel jamais parti
      { termeIlYa: 160, rappel: { envoyeLeIlYa: 5 } }, // préavis de trente jours non écoulé
      { termeIlYa: 100, rappel: { envoyeLeIlYa: 40 } }, // conservation de 180 jours non écoulée
      { termeIlYa: -3 }, // essai en cours
      { termeIlYa: 200, rappel: { envoyeLeIlYa: 31 }, abonnement: true }, // souscrit depuis l'affichage de la liste
      { termeIlYa: 200, rappel: { envoyeLeIlYa: 31 }, groupe: true },
      { termeIlYa: 200, rappel: { envoyeLeIlYa: 31 }, inscrit: false },
    ] as Scenario[]) {
      const { service, appels } = monter(s);
      await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toBeInstanceOf(ConflictException);
      expect(appels.filter((a) => a.startsWith('DELETE') || a === 'TRACE')).toEqual([]);
    }
  });

  it('REFUSE si le message du rappel n’est pas constaté envoyé, quoi que dise la ligne de suivi', async () => {
    const { service, appels } = monter({ ...pret, rappel: { envoyeLeIlYa: 31, statut: StatutMessage.EN_ATTENTE } });
    await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toThrow(/pas constaté envoyé/);
    expect(appels.filter((a) => a.startsWith('DELETE'))).toEqual([]);
  });

  it('REFUSE un dossier visé par un groupe ou un abonnement, relu DANS la transaction', async () => {
    const { service, lecteur, appels } = monter(pret);
    lecteur.abonnementCabinet.count.mockResolvedValueOnce(1);
    await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toThrow(/visé par un groupe ou un abonnement/);
    expect(appels.filter((a) => a.startsWith('DELETE'))).toEqual([]);
  });

  it('un dossier déjà supprimé (verrou sans ligne) est 404, jamais une erreur de base', async () => {
    const { service } = monter({ ...pret, dossierExiste: false });
    await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SUPPRIME · verrou d’abord, purge de tout le plan, dossier, PUIS la trace (nombres seulement)', async () => {
    const { service, lecteur, appels } = monter(pret);
    const r = await service.supprimer(T, OPERATEUR, T, MAINTENANT);
    expect(lecteur.$executeRaw).toHaveBeenCalledTimes(1); // le verrou consultatif du dossier
    const plan = planDePurge();
    const suppressions = appels.filter((a) => a.startsWith('DELETE') || a.startsWith('UPDATE'));
    expect(suppressions).toHaveLength(plan.length + 1);
    expect(appels.indexOf('TRACE')).toBeGreaterThan(appels.findIndex((a) => a.startsWith('DELETE FROM "tenants"')));
    expect(r).toMatchObject({ supprime: true, tenantId: T, nombreUtilisateurs: 2, nombreExercices: 3, nombreEcritures: 41 });
    const trace = (lecteur.dossierEssaiSupprime.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(Object.keys(trace).sort()).toEqual(
      ['ancienTenantId', 'creeLe', 'nombreEcritures', 'nombreExercices', 'nombreLignesSupprimees', 'nombreUtilisateurs', 'parOperateur', 'rappelEnvoyeLe', 'supprimeLe', 'termeLe'].sort(),
    );
    expect(trace).toMatchObject({ ancienTenantId: T, parOperateur: 'op@exemple.invalid', nombreUtilisateurs: 2, nombreExercices: 3, nombreEcritures: 41 });
  });

  it('une seule transaction · la base annule tout si la purge échoue (rien n’est attrapé)', async () => {
    const { service, lecteur } = monter(pret);
    lecteur.$executeRawUnsafe.mockRejectedValueOnce(new Error('violation de clé étrangère'));
    await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toThrow('violation de clé étrangère');
    expect(lecteur.dossierEssaiSupprime.create).not.toHaveBeenCalled();
    expect(lecteur.$transaction).toHaveBeenCalledTimes(1);
  });
});

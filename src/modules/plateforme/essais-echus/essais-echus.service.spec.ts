import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { StatutMessage } from '@prisma/client';
import { ORIGINE_INSCRIPTION_ESSAI } from '../../auth/inscription-essai';
import { ORIGINE_RAPPEL_SUPPRESSION_ESSAI } from '../../courrier/courrier.service';
import { EssaisEchusService } from './essais-echus.service';
import { planDePurge } from './purger-dossier';
import { dateDeSuppression, termeDeLaLicence } from './essais-echus';
import { RAPPELS_PAR_APPEL } from './essais-echus.service';

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
  rappel?: {
    envoyeLeIlYa: number | null;
    messageId?: string;
    statut?: StatutMessage;
    /** Le texte brut que le transport a laissé sur le message (porte souvent l'adresse du client). */
    erreur?: string | null;
    misEnFileIlYaMinutes?: number;
    /** Le rappel annonçait un AUTRE terme (essai redonné depuis) · jours entre ce terme ancien et le terme courant. */
    termeAnterieurDe?: number;
  } | null;
  abonnement?: boolean;
  groupe?: boolean;
  inscrit?: boolean;
  /** Le courriel d'inscription porte l'identifiant d'un UTILISATEUR (renvoi), et non celui du dossier. */
  preuve?: { origineId: string };
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
            termeLe: termeDeLaLicence(new Date(fin.getTime() - (s.rappel.termeAnterieurDe ?? 0) * 86_400_000)),
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
          ? s.inscrit === false ? [] : [{ tenantId: T, origineId: s.preuve?.origineId ?? T }]
          : (args.where.id?.in ?? []).map((id) => ({ id, statut: s.rappel?.statut ?? StatutMessage.ENVOYE, erreur: s.rappel?.erreur ?? null })),
      ),
      findFirst: jest.fn(async (args: { where: { origine?: string } }) =>
        args.where.origine === ORIGINE_RAPPEL_SUPPRESSION_ESSAI
          ? null
          : { statut: s.rappel?.statut ?? StatutMessage.ENVOYE, envoyeAt: jours(-31), erreur: s.rappel?.erreur ?? null },
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
      findMany: jest.fn().mockResolvedValue([
        { id: 'u-admin', tenantId: T },
        { id: 'u-autre-dossier', tenantId: 'dossier-voisin' },
      ]),
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

  it('LA PREUVE D’INSCRIPTION · le courriel du renvoi (origineId = un utilisateur du dossier) prouve la porte', async () => {
    const { service } = monter({ preuve: { origineId: 'u-admin' } });
    expect((await service.lister(MAINTENANT)).essais.map((e) => e.etat)).toEqual(['RAPPEL_A_ENVOYER']);
  });

  it('un courriel d’inscription portant l’utilisateur d’un AUTRE dossier, ou rien de connu, ne prouve rien', async () => {
    for (const origineId of ['u-autre-dossier', 'inconnu']) {
      const { service } = monter({ preuve: { origineId } });
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
    // Tout est examiné, et ce qui reste dû au-delà de la borne de l'appel est compté.
    expect(r).toMatchObject({ examines: 1, restants: 0, parAppel: 50 });
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
    const { service, lecteur } = monter({ envoi: { statut: StatutMessage.EN_ATTENTE, erreur: 'Error · connect ECONNREFUSED 10.0.0.5:587' } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ tenantId: T, issue: 'EN_FILE', cause: 'RESEAU' });
    expect(r.resultats[0].detail).toContain('injoignable');
    expect(r.resultats[0].detail).not.toContain('ECONNREFUSED');
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

  it('LA DATE ANNONCÉE EST UN MINIMUM · un message parti plus tard que sa réservation repousse la date réelle, jamais l’inverse', async () => {
    // Réservé et écrit il y a dix jours, retenté et parti aujourd'hui.
    const { service, lecteur } = monter({ rappel: { envoyeLeIlYa: null, statut: StatutMessage.ECHEC, misEnFileIlYaMinutes: 10 * 24 * 60 } });
    await service.envoyerRappels(OPERATEUR, MAINTENANT);
    const maj = lecteur.rappelSuppressionEssai.update.mock.calls[0][0] as { data: Record<string, unknown> };
    // Seule la date d'envoi est posée · la date annoncée au client n'est pas réécrite.
    expect(Object.keys(maj.data)).toEqual(['envoyeLe']);
    const annoncee = dateDeSuppression(termeDeLaLicence(jours(-160)), jours(-10));
    const reelle = dateDeSuppression(termeDeLaLicence(jours(-160)), maj.data.envoyeLe as Date);
    expect(reelle.getTime()).toBeGreaterThanOrEqual(annoncee.getTime());
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
    courrier.mettreEnFile.mockRejectedValueOnce(new BadRequestException('Adresse de destinataire inutilisable · « jean@client.cd ». Le message n’a pas été mis en file.'));
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ issue: 'ECHEC', cause: 'REFUS_DESTINATAIRE' });
    expect(lecteur.rappelSuppressionEssai.deleteMany).toHaveBeenCalled();
  });
});

describe('L’ADRESSE D’UN CLIENT NE REMONTE JAMAIS À LA CONSOLE NI AU JOURNAL DU SERVEUR (CLAUDE.md § 8)', () => {
  const ADRESSE = 'jean@client.cd';
  const REFUS_SMTP = `550 5.1.1 <${ADRESSE}>: Recipient address rejected: User unknown in virtual mailbox table`;
  let erreursJournal: string[];
  beforeEach(() => {
    erreursJournal = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      erreursJournal.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      erreursJournal.push(String(message));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('liste · la catégorie seule, jamais le texte du transport', async () => {
    const { service } = monter({ rappel: { envoyeLeIlYa: null, statut: StatutMessage.ECHEC, erreur: REFUS_SMTP } });
    const r = await service.lister(MAINTENANT);
    expect(r.essais[0].rappel).toMatchObject({ statutCourrier: StatutMessage.ECHEC, causeEchec: 'REFUS_DESTINATAIRE' });
    expect(JSON.stringify(r)).not.toContain(ADRESSE);
    expect(JSON.stringify(r)).not.toContain('@');
  });

  it('retour de /rappels · message en file avec un refus qui cite l’adresse', async () => {
    const { service } = monter({ envoi: { statut: StatutMessage.ECHEC, erreur: REFUS_SMTP } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ issue: 'EN_FILE', cause: 'REFUS_DESTINATAIRE' });
    expect(JSON.stringify(r)).not.toContain('@');
  });

  it('retour de /rappels · message retenté puis abandonné, la cause seule', async () => {
    const { service } = monter({ rappel: { envoyeLeIlYa: null, statut: StatutMessage.ABANDONNE, erreur: REFUS_SMTP } });
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ issue: 'ECHEC', cause: 'REFUS_DESTINATAIRE' });
    expect(JSON.stringify(r)).not.toContain('@');
  });

  it('exception levée qui cite l’adresse · ni la console ni le journal du serveur ne la reçoivent', async () => {
    const { service, courrier } = monter();
    courrier.mettreEnFile.mockRejectedValueOnce(new BadRequestException(`Adresse de destinataire inutilisable · « ${ADRESSE} ».`));
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0]).toMatchObject({ issue: 'ECHEC', cause: 'REFUS_DESTINATAIRE' });
    expect(JSON.stringify(r)).not.toContain('@');
    expect(erreursJournal.length).toBeGreaterThan(0);
    expect(erreursJournal.join('\n')).not.toContain('@');
  });

  it('un échec de libération de la réservation ne journalise pas non plus le texte', async () => {
    const { service, courrier, lecteur } = monter();
    courrier.mettreEnFile.mockRejectedValueOnce(new Error(REFUS_SMTP));
    lecteur.rappelSuppressionEssai.deleteMany.mockRejectedValueOnce(new Error(`clé ${ADRESSE}`));
    await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(erreursJournal.join('\n')).not.toContain('@');
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

describe('UN RAPPEL ANCIEN NE VAUT PAS PRÉAVIS POUR UN TERME NOUVEAU (essai redonné)', () => {
  // Terme ancien 200 jours avant le courant, rappel parti il y a 120 jours · avant la fenêtre du terme courant.
  const ancien = { termeIlYa: 160, rappel: { envoyeLeIlYa: 120, termeAnterieurDe: 200 } } as Scenario;

  it('la liste repasse par RAPPEL_A_ENVOYER et ne montre pas le rappel ancien', async () => {
    const { service } = monter(ancien);
    const [ligne] = (await service.lister(MAINTENANT)).essais;
    expect(ligne.etat).toBe('RAPPEL_A_ENVOYER');
    expect(ligne.rappel).toBeNull();
  });

  it('un nouveau rappel est RÉSERVÉ pour le terme courant, et le message ancien n’est pas adopté', async () => {
    const { service, lecteur, courrier } = monter(ancien);
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(r.resultats[0].issue).toBe('ENVOYE');
    const reservation = lecteur.rappelSuppressionEssai.create.mock.calls[0][0] as { data: { cabinetId: string; termeLe: Date } };
    expect(reservation.data.termeLe).toEqual(termeDeLaLicence(jours(-160)));
    // L'adoption ne lit que les messages écrits depuis l'ouverture de la fenêtre du terme courant.
    const adoption = lecteur.message.findFirst.mock.calls[0][0] as { where: { createdAt: { gte: Date } } };
    expect(adoption.where.createdAt.gte.getTime()).toBeGreaterThan(jours(-120).getTime());
    expect(courrier.mettreEnFile).toHaveBeenCalledTimes(1);
  });

  it('le message que tient le rappel d’un AUTRE terme n’est jamais adopté, même écrit après l’ouverture de la fenêtre', async () => {
    // Rejeu sur vraie base · essai redonné avec un terme déjà échu, sa fenêtre s'ouvre AVANT le rappel de l'ancien terme.
    const { service, lecteur } = monter({ termeIlYa: 160, rappel: { envoyeLeIlYa: 2, termeAnterieurDe: 30, messageId: 'm-ancien' } });
    lecteur.rappelSuppressionEssai.findMany.mockImplementation(async (a: { where: { messageId?: unknown } }) =>
      // La lecture du calendrier ne voit que le rappel du terme courant (aucun ici) ; la recherche des
      // messages tenus voit celui de l'ancien terme.
      a.where.messageId ? [{ messageId: 'm-ancien' }] : [],
    );
    await service.envoyerRappels(OPERATEUR, MAINTENANT);
    const adoption = lecteur.message.findFirst.mock.calls[0][0] as { where: { id: { notIn: string[] } } };
    expect(adoption.where.id.notIn).toEqual(['m-ancien']);
  });

  it('la suppression est REFUSÉE (409) sur le seul rappel de l’ancien terme', async () => {
    const { service, appels } = monter({ termeIlYa: 200, rappel: { envoyeLeIlYa: 31, termeAnterieurDe: 60 } });
    await expect(service.supprimer(T, OPERATEUR, T, MAINTENANT)).rejects.toBeInstanceOf(ConflictException);
    expect(appels.filter((a) => a.startsWith('DELETE') || a === 'TRACE')).toEqual([]);
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

  it('la LICENCE est verrouillée (FOR UPDATE, paramétrée) après le dossier et AVANT la lecture du calendrier', async () => {
    const { service, lecteur } = monter(pret);
    const ordre: string[] = [];
    const brut = lecteur.$queryRaw.getMockImplementation();
    lecteur.$queryRaw.mockImplementation(async (...args: unknown[]) => {
      const texte = (args[0] as string[]).join('?');
      if (texte.includes('FOR UPDATE')) ordre.push(texte.includes('"licences"') ? 'VERROU_LICENCE' : 'VERROU_DOSSIER');
      return brut(...args);
    });
    lecteur.licence.findMany.mockImplementation(async () => {
      ordre.push('LECTURE_LICENCE');
      const fin = jours(-200);
      return [{ tenantId: T, type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: new Date(fin.getTime() - 30 * 86_400_000), dateExpiration: fin }];
    });
    await service.supprimer(T, OPERATEUR, T, MAINTENANT);
    expect(ordre.slice(0, 3)).toEqual(['VERROU_DOSSIER', 'VERROU_LICENCE', 'LECTURE_LICENCE']);
    const appel = lecteur.$queryRaw.mock.calls.find((c: unknown[]) => (c[0] as string[]).join('?').includes('"licences"'));
    // Le dossier est un PARAMÈTRE lié, jamais concaténé dans le texte de la requête.
    expect((appel[0] as string[]).join('?')).toBe('SELECT 1 FROM "licences" WHERE "tenantId" = ? FOR UPDATE');
    expect(appel[1]).toBe(T);
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

/**
 * PLUS DE DOSSIERS QU'UNE FENÊTRE · une doublure qui sert N dossiers d'essai, tous
 * concernés et dus, et HONORE la pagination par la clé (le curseur de la requête
 * brute) et les `in` de la lecture. Ce qui casserait en silence · une fenêtre figée
 * sur les cinq cents premiers, des rappels dus au-delà jamais envoyés, un compte
 * qui ne dit que la tranche.
 */
function monterPlusieurs(n: number) {
  const fin = jours(-160);
  const debut = new Date(fin.getTime() - 30 * 86_400_000);
  const ids = Array.from({ length: n }, (_, i) => `essai-${String(i).padStart(5, '0')}`);
  const requetes: string[] = [];
  const dansIn = (w: unknown): string[] => ((w as { in?: string[] })?.in ?? []);
  const lecteur: any = {
    $queryRaw: jest.fn(async (...args: unknown[]) => {
      const texte = (args[0] as string[]).join('?');
      requetes.push(texte);
      const curseur = args.slice(1).find((a) => a && typeof a === 'object' && Array.isArray((a as { values?: unknown[] }).values)) as
        | { values: unknown[] }
        | undefined;
      const apres = curseur && curseur.values.length === 2 ? String(curseur.values[1]) : null;
      const reste = apres ? ids.filter((id) => id > apres) : ids;
      const limite = Number(args[args.length - 1]);
      return reste.slice(0, limite).map((tenantId) => ({ tenantId, dateExpiration: fin }));
    }),
    tenant: {
      findMany: jest.fn(async (a: { where: Record<string, unknown> }) =>
        'id' in a.where ? dansIn(a.where.id).map((id) => ({ id, estDemonstration: false, dossierMereId: null, dossierCombinaisonId: null })) : [],
      ),
    },
    licence: {
      findMany: jest.fn(async (a: { where: { tenantId: unknown } }) =>
        dansIn(a.where.tenantId).map((tenantId) => ({ tenantId, type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: debut, dateExpiration: fin })),
      ),
    },
    abonnementCabinet: { findMany: jest.fn().mockResolvedValue([]) },
    tiers: { findMany: jest.fn().mockResolvedValue([]) },
    message: {
      findMany: jest.fn(async (a: { where: { tenantId: unknown; origine?: string } }) =>
        a.where.origine === ORIGINE_INSCRIPTION_ESSAI ? dansIn(a.where.tenantId).map((tenantId) => ({ tenantId, origineId: tenantId })) : [],
      ),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    rappelSuppressionEssai: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async () => ({ id: 'r' })),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ email: 'admin@client.invalid' }),
    },
    exercice: { groupBy: jest.fn().mockResolvedValue([]) },
    ecriture: { groupBy: jest.fn().mockResolvedValue([]) },
  };
  const courrier = {
    etatDuTransport: jest.fn().mockReturnValue({ configure: true, manques: [], expediteur: 'x@y.z' }),
    mettreEnFile: jest.fn(async () => ({ id: 'm', statut: StatutMessage.ENVOYE, erreur: null })),
    retenter: jest.fn(),
  };
  return { service: new EssaisEchusService(lecteur as never, courrier as never), lecteur, courrier, requetes };
}

describe('AU-DELÀ D’UNE FENÊTRE · tout est lu, compté, et dit', () => {
  it('la sélection écarte EN SQL ce qui n’est pas concerné et se lit en base', async () => {
    const { service, requetes } = monterPlusieurs(1);
    await service.lister(MAINTENANT);
    const sql = requetes[0];
    for (const fragment of [
      `"statut" <> 'SUSPENDUE'`,
      '"estDemonstration" = false',
      '"dossierMereId" IS NULL',
      '"dossierCombinaisonId" IS NULL',
      '"celluleGroupeId" = t."id"',
      '"abonnements_cabinets"',
      `"type" = 'ABONNEMENT'`,
    ]) {
      expect(sql).toContain(fragment);
    }
    // Par la clé (échéance, dossier), jamais par un décalage.
    expect(sql).not.toMatch(/OFFSET/i);
  });

  it('liste · 1 203 dossiers concernés, trois pages lues, cinq cents lignes rendues, les comptes sur TOUS', async () => {
    const { service, requetes } = monterPlusieurs(1203);
    const r = await service.lister(MAINTENANT);
    expect(requetes).toHaveLength(3);
    expect(r.essais).toHaveLength(500);
    expect(r).toMatchObject({ total: 1203, tronque: true, aRappeler: 1203, supprimables: 0 });
  });

  it('rappels · cinquante tentés par appel, les rappels dus au-delà COMPTÉS (restants), tous les dossiers examinés', async () => {
    const { service, courrier } = monterPlusieurs(620);
    const r = await service.envoyerRappels(OPERATEUR, MAINTENANT);
    expect(RAPPELS_PAR_APPEL).toBe(50);
    expect(courrier.mettreEnFile).toHaveBeenCalledTimes(50);
    expect(r).toMatchObject({ envoyes: 50, restants: 570, examines: 620, parAppel: 50 });
  });
});

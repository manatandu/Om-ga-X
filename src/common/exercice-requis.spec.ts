import 'reflect-metadata';
import { BadRequestException, NotFoundException, ParseUUIDPipe, PipeTransform } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { getMetadataStorage } from 'class-validator';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  EXERCICE_D_UNE_CELLULE,
  EXERCICE_FACULTATIF,
  EXERCICE_REQUIS,
  MESSAGE_EXERCICE_HORS_DOSSIER,
  MESSAGE_EXERCICE_ILLISIBLE,
  MESSAGE_EXERCICE_REQUIS,
  exigerExercice,
} from './exercice-requis';
import { JOURNAL_FACULTATIF, MESSAGE_JOURNAL_HORS_DOSSIER, MESSAGE_JOURNAL_ILLISIBLE } from './journal-du-dossier';
import { COMPTE_FACULTATIF, MESSAGE_COMPTE_HORS_DOSSIER, MESSAGE_COMPTE_ILLISIBLE } from './compte-du-dossier';
import { dansContexteAudit } from './audit/contexte-audit';
import type { PrismaService } from './prisma.service';
import { JwtAuthGuard } from '../modules/auth/jwt-auth.guard';

/**
 * UN SEUL PORTEUR POUR L'EXERCICE EXIGÉ.
 *
 * Le pipe vivait en huit copies, et la huitième disait déjà autre chose que
 * les sept autres. Ce spec relit les MÉTADONNÉES que Nest lit lui-même pour
 * câbler une route (ROUTE_ARGS_METADATA), contrôleur par contrôleur : tout
 * `ParseUUIDPipe` posé sur un paramètre `exerciceId`, en requête comme en
 * chemin, doit être l'instance du porteur. Une copie locale, même au message
 * identique, fait tomber le test · c'est ce que le code FAIT qui est lu, pas
 * la forme de sa source, si bien qu'un commentaire ou un saut de ligne ne le
 * trompe pas.
 *
 * ET AUCUN `exerciceId` NE PASSE SANS PORTEUR (audit final F234, suite). Dix-
 * neuf contrôleurs lisaient encore `@Query('exerciceId')` ou
 * `@Param('exerciceId')` nu · un scalaire échappe au ValidationPipe global,
 * l'identifiant absent arrivait `undefined` à Prisma, qui IGNORE le champ, et
 * la lecture portait sur tous les exercices du dossier. Chaque paramètre
 * porte désormais le porteur REQUIS, ou le FACULTATIF sur une route de la
 * liste fermée ci-dessous, chacune avec son motif · un paramètre nouveau sans
 * l'un ni l'autre fait tomber le test, et un facultatif posé ailleurs aussi.
 *
 * ET L'EXERCICE D'UN AUTRE DOSSIER EST INTROUVABLE (paquet 1, C3). Lisible ne
 * veut pas dire « du dossier » · les porteurs vérifient l'appartenance au
 * dossier de la SESSION et rendent le 404 nommé. Les pipes de chaque route
 * sont donc instanciés comme Nest les instancie (avec le client Prisma, ici
 * une doublure qui HONORE la requête, `tenantId` compris) et JOUÉS dans le
 * contexte d'une session. Une seule route lit l'exercice d'un autre dossier
 * que la session, la balance d'une cellule du groupe · elle porte le porteur
 * de FORMAT seul, sur une liste fermée avec son motif.
 */

type Arg = { index: number; data?: unknown; pipes?: unknown[] };

function fichiersControleurs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersControleurs(chemin));
    else if (nom.endsWith('.controller.ts')) trouves.push(chemin);
  }
  return trouves;
}

type RouteExercice = { route: string; type: 'query' | 'param'; pipes: unknown[]; gardes: unknown[] };

/** Un `@Query()` entier, lu par un DTO · la classe et les champs qu'elle admet. */
type DtoEnRequete = { route: string; dto: string; proprietes: string[] };

/**
 * Les champs qu'un DTO admet en requête · ceux que class-validator décore. Le
 * ValidationPipe global (`whitelist`, `forbidNonWhitelisted`) refuse tout
 * autre champ, si bien que cette liste est exactement ce que la requête peut
 * porter.
 */
function proprietesDuDto(classe: unknown): string[] {
  if (typeof classe !== 'function' || [String, Number, Boolean, Object, Array].includes(classe as never)) return [];
  const metadonnees = getMetadataStorage().getTargetValidationMetadatas(classe, '', true, false);
  return [...new Set(metadonnees.map((m) => m.propertyName))].sort();
}

/**
 * Les routes qui lisent `exerciceId` (et, pour C3, `journalId` en requête),
 * avec leurs pipes et leurs gardes · celles de la classe et celles de la
 * méthode, lues sur les métadonnées que Nest lit.
 */
function routesExercice(): {
  fichiers: number;
  sansControleur: string[];
  routes: RouteExercice[];
  routesJournal: RouteExercice[];
  routesCompte: RouteExercice[];
  dtosEnRequete: DtoEnRequete[];
} {
  const racine = join(__dirname, '..');
  const fichiers = fichiersControleurs(racine);
  const sansControleur: string[] = [];
  const routes: RouteExercice[] = [];
  const routesJournal: RouteExercice[] = [];
  const routesCompte: RouteExercice[] = [];
  const dtosEnRequete: DtoEnRequete[] = [];
  for (const fichier of fichiers) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exports = require(fichier) as Record<string, unknown>;
    let controleurs = 0;
    for (const exporte of Object.values(exports)) {
      if (typeof exporte !== 'function' || Reflect.getMetadata(PATH_METADATA, exporte) === undefined) continue;
      controleurs++;
      const prototype = (exporte as { prototype: Record<string, unknown> }).prototype;
      const gardesClasse = (Reflect.getMetadata(GUARDS_METADATA, exporte) ?? []) as unknown[];
      for (const methode of Object.getOwnPropertyNames(prototype)) {
        if (methode === 'constructor') continue;
        const gardesMethode = (Reflect.getMetadata(GUARDS_METADATA, prototype[methode] as object) ?? []) as unknown[];
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, exporte, methode) ?? {}) as Record<string, Arg>;
        const typesDesParametres = (Reflect.getMetadata('design:paramtypes', prototype, methode) ?? []) as unknown[];
        for (const [cle, arg] of Object.entries(args)) {
          const type = Number(cle.split(':')[0]);
          // UN `@Query()` ENTIER, LU PAR UN DTO (premier tour de relecture du
          // paquet 1, constat 5) · son `exerciceId` échappait à ce recensement,
          // qui ne lisait que les paramètres nommés.
          if (type === RouteParamtypes.QUERY && arg.data === undefined) {
            const classe = typesDesParametres[arg.index] as { name?: string } | undefined;
            dtosEnRequete.push({
              route: `${relative(racine, fichier)} ${methode}`,
              dto: classe?.name ?? '?',
              proprietes: proprietesDuDto(classe),
            });
          }
          if (type !== RouteParamtypes.QUERY && type !== RouteParamtypes.PARAM) continue;
          const route = {
            route: `${relative(racine, fichier)} ${methode}`,
            type: (type === RouteParamtypes.QUERY ? 'query' : 'param') as 'query' | 'param',
            pipes: arg.pipes ?? [],
            gardes: [...gardesClasse, ...gardesMethode],
          };
          if (arg.data === 'exerciceId') routes.push(route);
          if (arg.data === 'journalId') routesJournal.push(route);
          if (arg.data === 'compteId') routesCompte.push(route);
        }
      }
    }
    if (controleurs === 0) sansControleur.push(relative(racine, fichier));
  }
  return { fichiers: fichiers.length, sansControleur, routes, routesJournal, routesCompte, dtosEnRequete };
}

/**
 * LES SEULES ROUTES OÙ L'EXERCICE EST FACULTATIF, chacune avec son motif. La
 * liste est FERMÉE · une route qui a besoin d'un exercice pour que sa lecture
 * ait un sens porte le porteur requis, et y poser le facultatif « pour ne rien
 * casser » rouvrirait exactement la lecture de tous les exercices que F234
 * ferme. Ajouter une ligne ici oblige à écrire pourquoi la route a un sens
 * sans exercice.
 */
const ROUTES_A_EXERCICE_FACULTATIF: Record<string, string> = {
  'modules/comptabilite/ecriture.controller.ts lister':
    "le journal se filtre aussi par dates, et `perimetreJournal` n'ajoute le filtre d'exercice que s'il est nommé",
  'modules/exports/export.controller.ts journal':
    "même périmètre que la fenêtre du journal · sans exercice, le classeur se titre « Toutes périodes »",
  'modules/questionnaire/questionnaire.controller.ts lister':
    'la liste des questionnaires du dossier, chacun portant son exercice',
  'modules/inventaire/inventaire.controller.ts lister':
    "la liste des campagnes d'inventaire du dossier, chacune portant son exercice",
  'modules/faiblesses/faiblesses.controller.ts lister':
    'la liste des registres de faiblesses du dossier, chacun portant son exercice',
  'modules/circularisation/circularisation.controller.ts lister':
    'la liste des campagnes de circularisation du dossier, chacune portant son exercice',
};

/**
 * LA SEULE ROUTE OÙ L'EXERCICE N'EST PAS CELUI DU DOSSIER DE LA SESSION · le
 * siège lit la balance d'une de ses cellules, sur l'exercice de la CELLULE.
 * Le porteur du dossier la refuserait à tort ; elle porte le FORMAT seul, et
 * le service juge l'appartenance (cellule du groupe, puis exercice de la
 * cellule, 404 nommés). Liste FERMÉE · y ajouter une route rouvrirait C3 pour
 * elle.
 */
const ROUTES_A_EXERCICE_D_UNE_CELLULE: Record<string, string> = {
  'modules/groupe/groupe.controller.ts balanceCellule':
    "l'exercice est celui de la cellule lue par le siège · GroupeService.balanceCellule borne la cellule au groupe et l'exercice à la cellule",
};

/**
 * LES ROUTES QUI FILTRENT PAR UN JOURNAL EN REQUÊTE (C3) · toutes portent
 * JOURNAL_FACULTATIF. Une route nouvelle qui lirait `journalId` nu fait tomber
 * le test, comme un exercice nu.
 */
const ROUTES_A_JOURNAL_EN_FILTRE = [
  'modules/comptabilite/ecriture.controller.ts brouillard',
  'modules/comptabilite/ecriture.controller.ts lister',
  'modules/exports/export.controller.ts journal',
  'modules/modeles-saisie/modele-saisie.controller.ts lister',
];

/**
 * LES ROUTES QUI FILTRENT PAR UN COMPTE EN REQUÊTE (premier tour de relecture
 * du paquet 1, constat 4) · toutes portent COMPTE_FACULTATIF. Une route
 * nouvelle qui lirait `compteId` nu en requête fait tomber le test, sauf à
 * figurer, avec son motif, dans la liste fermée qui suit.
 */
const ROUTES_A_COMPTE_EN_FILTRE = [
  'modules/rapprochement/rapprochement.controller.ts lister',
  'modules/relances/relances.controller.ts historique',
];

/**
 * LE COMPTE EN REQUÊTE QUI N'EST PAS UN FILTRE · il est REQUIS et le service
 * le juge déjà dans le dossier (404 nommé avant toute lecture). Liste FERMÉE.
 */
const ROUTES_A_COMPTE_JUGE_PAR_LE_SERVICE: Record<string, string> = {
  'modules/inventaire/inventaire.controller.ts apercuPvCaisse':
    "la caisse du procès-verbal est requise · InventaireService.apercuPvCaisse la lit bornée au dossier et rend 404 « Compte introuvable pour ce dossier. »",
};

/**
 * UN IDENTIFIANT PORTÉ PAR UN DTO DE REQUÊTE (premier tour de relecture du
 * paquet 1, constat 5). Un `@Query()` entier échappe aux porteurs, qui se
 * posent sur un paramètre nommé · un `exerciceId`, un `journalId` ou un
 * `compteId` déclaré dans le DTO n'est jugé que par le SERVICE. Liste FERMÉE,
 * chaque ligne avec la preuve que le service juge l'appartenance au dossier ·
 * un DTO nouveau qui déclarerait l'un de ces champs fait tomber le test tant
 * qu'il n'est pas passé au porteur ou écrit ici.
 */
const IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE: Record<string, string> = {
  'modules/registre-donateurs/donation.controller.ts lister FiltreRegistreDto exerciceId':
    "@IsUUID('4') refuse l'illisible (400) ; DonationService.lister lit l'exercice borné au dossier et rend 404 « Exercice introuvable pour ce dossier. »",
};

const IDENTIFIANTS_A_PORTEUR = ['exerciceId', 'journalId', 'compteId'];

const DOSSIER = 'dossier-de-la-session';
const VOISIN = 'dossier-voisin';
const ID = '0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30';
/** Un identifiant bien formé, porté par un AUTRE dossier · le cas de C3. */
const ID_DU_VOISIN = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

/**
 * LA DOUBLURE HONORE LA REQUÊTE (règlement, F4b) · elle ne rend la ligne que
 * si l'identifiant ET le dossier demandés sont les siens. Un porteur qui
 * oublierait le `tenantId` de la session lirait l'exercice du voisin, et ce
 * spec le verrait.
 */
function doublurePrisma() {
  const lignes = [
    { id: ID, tenantId: DOSSIER },
    { id: ID_DU_VOISIN, tenantId: VOISIN },
  ];
  const requetes: Array<{ modele: string; where: Record<string, unknown> }> = [];
  const modele = (nom: string) => ({
    findFirst: async (args: { where: Record<string, unknown> }) => {
      requetes.push({ modele: nom, where: args.where });
      const trouve = lignes.find((l) => l.id === args.where.id && l.tenantId === args.where.tenantId);
      return trouve ? { id: trouve.id } : null;
    },
  });
  return {
    prisma: { exercice: modele('exercice'), journal: modele('journal'), compte: modele('compte') } as unknown as PrismaService,
    requetes,
  };
}

/** Les pipes comme Nest les instancie · une classe reçoit le client Prisma, une instance sert telle quelle. */
function instancier(pipes: unknown[], prisma: PrismaService): PipeTransform[] {
  return pipes.map((p) =>
    typeof p === 'function' ? new (p as new (prisma: PrismaService) => PipeTransform)(prisma) : (p as PipeTransform),
  );
}

/** Joue les pipes de la route comme Nest les joue, dans l'ordre, dans la session du dossier. */
async function jouer(
  pipes: unknown[],
  valeur: unknown,
  type: 'query' | 'param',
  data = 'exerciceId',
  prisma = doublurePrisma().prisma,
): Promise<unknown> {
  return dansContexteAudit({ acteurEmail: 'comptable@dossier.test', tenantId: DOSSIER }, async () => {
    let courant = valeur;
    for (const pipe of instancier(pipes, prisma)) {
      courant = await pipe.transform(courant, { type, data });
    }
    return courant;
  });
}

const messageDe = (e: unknown) =>
  e instanceof BadRequestException || e instanceof NotFoundException ? `${e.getStatus()} ${e.message}` : e;

describe('EXERCICE_REQUIS · un seul porteur', () => {
  // Chargé une fois · les contrôleurs tirent la plupart des services.
  let lecture: ReturnType<typeof routesExercice>;
  beforeAll(() => {
    lecture = routesExercice();
  }, 120_000);

  const PORTEURS: unknown[] = [EXERCICE_REQUIS, EXERCICE_FACULTATIF, EXERCICE_D_UNE_CELLULE];

  it('le recensement lit chaque fichier de contrôleur et trouve des routes gardées (un garde-fou vide ne garde rien)', () => {
    // Un fichier `.controller.ts` dont aucun export ne porte @Controller
    // échapperait à la lecture sans rien dire · il est nommé.
    expect(lecture.sansControleur).toEqual([]);
    expect(lecture.fichiers).toBeGreaterThan(60);
    const gardees = lecture.routes.filter((r) => r.pipes.includes(EXERCICE_REQUIS));
    // Cent vingt au 2026-09-28, soixante-dix-sept avant la suite de F234 ·
    // le plancher dit seulement que la lecture des métadonnées rend encore
    // quelque chose, et qu'aucune route gardée n'a perdu son porteur.
    expect(gardees.length).toBeGreaterThanOrEqual(120);
    expect(lecture.routes.filter((r) => r.pipes.includes(EXERCICE_FACULTATIF)).length).toBeGreaterThan(0);
    expect(lecture.routesJournal.length).toBeGreaterThan(0);
  });

  it('aucun contrôleur ne redéclare un ParseUUIDPipe pour exerciceId hors des porteurs', () => {
    const copies = lecture.routes
      .filter((r) =>
        r.pipes.some((p) => !PORTEURS.includes(p) && (p === ParseUUIDPipe || p instanceof ParseUUIDPipe)),
      )
      .map((r) => r.route);
    expect(copies).toEqual([]);
    // Les porteurs contrôlent la forme par un ParseUUIDPipe · celui d'avant
    // C3, gardé tel quel sous l'appartenance.
    expect(EXERCICE_REQUIS.format).toBeInstanceOf(ParseUUIDPipe);
    expect(EXERCICE_FACULTATIF.format).toBeInstanceOf(ParseUUIDPipe);
    expect(EXERCICE_D_UNE_CELLULE).toBeInstanceOf(ParseUUIDPipe);
  });

  it('aucun exerciceId, en requête comme en chemin, ne passe sans porteur', () => {
    const nus = lecture.routes.filter((r) => !r.pipes.some((p) => PORTEURS.includes(p))).map((r) => r.route);
    expect(nus).toEqual([]);
    // Et jamais deux à la fois · le facultatif laisserait passer l'absence
    // que le requis refuse, selon l'ordre des pipes.
    expect(lecture.routes.filter((r) => r.pipes.filter((p) => PORTEURS.includes(p)).length > 1)).toEqual([]);
  });

  it('le porteur facultatif ne vit que sur la liste fermée de ses routes, et jamais sur un chemin', () => {
    const facultatives = lecture.routes.filter((r) => r.pipes.includes(EXERCICE_FACULTATIF));
    // Un paramètre de chemin est toujours présent · le dire facultatif
    // laisserait passer « undefined » écrit en toutes lettres dans l'adresse.
    expect(facultatives.filter((r) => r.type === 'param').map((r) => r.route)).toEqual([]);
    expect(facultatives.map((r) => r.route).sort()).toEqual(Object.keys(ROUTES_A_EXERCICE_FACULTATIF).sort());
    for (const motif of Object.values(ROUTES_A_EXERCICE_FACULTATIF)) expect(motif.length).toBeGreaterThan(20);
  });

  it('le porteur de format seul ne vit que sur la liste fermée des exercices de cellule (C3)', () => {
    const cellules = lecture.routes.filter((r) => r.pipes.includes(EXERCICE_D_UNE_CELLULE));
    expect(cellules.map((r) => r.route).sort()).toEqual(Object.keys(ROUTES_A_EXERCICE_D_UNE_CELLULE).sort());
    for (const motif of Object.values(ROUTES_A_EXERCICE_D_UNE_CELLULE)) expect(motif.length).toBeGreaterThan(20);
  });

  it('chaque route qui juge un identifiant au dossier est derrière JwtAuthGuard (le dossier jugé est celui de la session)', () => {
    // Sans la garde, aucun contexte de session n'est posé, et le porteur
    // tomberait en panne (voir `dossierDeLaSession`) · la lecture le dit ici,
    // avant la production.
    const sansGarde = [...lecture.routes, ...lecture.routesJournal]
      .filter((r) => !r.gardes.includes(JwtAuthGuard))
      .map((r) => r.route);
    expect(sansGarde).toEqual([]);
  });

  it('chaque route, jouée comme Nest la joue, refuse un identifiant illisible par un 400 nommé', async () => {
    // Le refus est VÉRIFIÉ sur les pipes de la route, pas seulement leur
    // présence · « undefined » est ce qu'un écran envoie quand il interpole un
    // exercice pas encore choisi.
    for (const r of lecture.routes) {
      const facultative = r.pipes.includes(EXERCICE_FACULTATIF);
      const message = facultative ? MESSAGE_EXERCICE_ILLISIBLE : MESSAGE_EXERCICE_REQUIS;
      for (const v of ['undefined', '', 'ex-2026']) {
        const refus = await jouer(r.pipes, v, r.type).catch((e: unknown) => e);
        expect({ route: r.route, v, refus: refus instanceof BadRequestException ? refus.message : refus }).toEqual({
          route: r.route,
          v,
          refus: message,
        });
      }
      const absent = await jouer(r.pipes, undefined, r.type).catch((e: unknown) => e);
      expect({ route: r.route, absent: absent instanceof BadRequestException ? absent.message : absent }).toEqual({
        route: r.route,
        absent: facultative ? undefined : MESSAGE_EXERCICE_REQUIS,
      });
      await expect(jouer(r.pipes, ID, r.type)).resolves.toBe(ID);
    }
  });

  it('chaque route, jouée comme Nest la joue, dit introuvable (404 nommé) l’exercice d’un autre dossier (C3)', async () => {
    // LE test de C3. Avant correction, l'identifiant du voisin passait le
    // format, et la route rendait une liste vide, un état à zéro, un 400, ou
    // écrivait (POST /provisions/:exerciceId).
    for (const r of lecture.routes) {
      const refus = await jouer(r.pipes, ID_DU_VOISIN, r.type).catch((e: unknown) => e);
      if (r.pipes.includes(EXERCICE_D_UNE_CELLULE)) {
        // L'exercice d'une cellule n'est pas celui de la session · le service
        // le juge, la route le laisse passer.
        expect({ route: r.route, refus }).toEqual({ route: r.route, refus: ID_DU_VOISIN });
        continue;
      }
      expect({ route: r.route, refus: messageDe(refus) }).toEqual({
        route: r.route,
        refus: `404 ${MESSAGE_EXERCICE_HORS_DOSSIER}`,
      });
    }
  });

  it('refuse un exercice absent, vide ou illisible par un 400 nommé, laisse passer un identifiant du dossier', async () => {
    for (const v of [undefined, '', 'ex-2026', '1']) {
      const refus = await jouer([EXERCICE_REQUIS], v, 'query').catch((e: unknown) => e);
      expect(refus).toBeInstanceOf(BadRequestException);
      expect((refus as BadRequestException).message).toBe(MESSAGE_EXERCICE_REQUIS);
    }
    await expect(jouer([EXERCICE_REQUIS], ID, 'query')).resolves.toBe(ID);
  });

  it('le porteur facultatif laisse passer l’absence, jamais un identifiant illisible ni celui d’un autre dossier', async () => {
    await expect(jouer([EXERCICE_FACULTATIF], undefined, 'query')).resolves.toBeUndefined();
    for (const v of ['', 'undefined', 'ex-2026', '1']) {
      const refus = await jouer([EXERCICE_FACULTATIF], v, 'query').catch((e: unknown) => e);
      expect(refus).toBeInstanceOf(BadRequestException);
      expect((refus as BadRequestException).message).toBe(MESSAGE_EXERCICE_ILLISIBLE);
    }
    await expect(jouer([EXERCICE_FACULTATIF], ID, 'query')).resolves.toBe(ID);
    const voisin = await jouer([EXERCICE_FACULTATIF], ID_DU_VOISIN, 'query').catch((e: unknown) => e);
    expect(messageDe(voisin)).toBe(`404 ${MESSAGE_EXERCICE_HORS_DOSSIER}`);
  });

  it('le dossier jugé est celui de la SESSION, borné par sa valeur · jamais un dossier reçu du client', async () => {
    const { prisma, requetes } = doublurePrisma();
    await jouer([EXERCICE_REQUIS], ID, 'query', 'exerciceId', prisma);
    expect(requetes).toEqual([{ modele: 'exercice', where: { id: ID, tenantId: DOSSIER } }]);
    // Un format refusé ne lit rien.
    requetes.length = 0;
    await jouer([EXERCICE_REQUIS], 'ex-2026', 'query', 'exerciceId', prisma).catch(() => undefined);
    expect(requetes).toEqual([]);
  });

  it('sans dossier de session, le porteur tombe en panne au lieu de laisser passer (un contexte absent n’est pas un « tout est permis »)', async () => {
    const { prisma } = doublurePrisma();
    const [porteur] = instancier([EXERCICE_REQUIS], prisma);
    const panne = await porteur.transform(ID, { type: 'query', data: 'exerciceId' }).catch((e: unknown) => e);
    expect(panne).toBeInstanceOf(Error);
    expect(panne).not.toBeInstanceOf(NotFoundException);
    expect(String((panne as Error).message)).toMatch(/JwtAuthGuard/);
  });

  it('exigerExercice refuse au service ce que la route aurait refusé', () => {
    for (const v of [undefined, null, '', '   ', 3]) {
      expect(() => exigerExercice(v)).toThrow(MESSAGE_EXERCICE_REQUIS);
    }
    expect(() => exigerExercice('0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30')).not.toThrow();
  });
});

describe('JOURNAL_FACULTATIF · le journal en filtre, du dossier ou introuvable (C3)', () => {
  let lecture: ReturnType<typeof routesExercice>;
  beforeAll(() => {
    lecture = routesExercice();
  }, 120_000);

  it('toute route qui lit journalId en requête porte le porteur, et la liste est celle-ci', () => {
    const enRequete = lecture.routesJournal.filter((r) => r.type === 'query');
    expect(enRequete.map((r) => r.route).sort()).toEqual([...ROUTES_A_JOURNAL_EN_FILTRE].sort());
    expect(enRequete.filter((r) => !r.pipes.includes(JOURNAL_FACULTATIF)).map((r) => r.route)).toEqual([]);
  });

  it('joué sur chaque route · absent reste absent, illisible 400, d’un autre dossier 404, du dossier passe', async () => {
    for (const r of lecture.routesJournal.filter((x) => x.type === 'query')) {
      await expect(jouer(r.pipes, undefined, 'query', 'journalId')).resolves.toBeUndefined();
      const illisible = await jouer(r.pipes, 'abc', 'query', 'journalId').catch((e: unknown) => e);
      expect({ route: r.route, refus: messageDe(illisible) }).toEqual({ route: r.route, refus: `400 ${MESSAGE_JOURNAL_ILLISIBLE}` });
      const voisin = await jouer(r.pipes, ID_DU_VOISIN, 'query', 'journalId').catch((e: unknown) => e);
      expect({ route: r.route, refus: messageDe(voisin) }).toEqual({ route: r.route, refus: `404 ${MESSAGE_JOURNAL_HORS_DOSSIER}` });
      await expect(jouer(r.pipes, ID, 'query', 'journalId')).resolves.toBe(ID);
    }
  });

  it('le journal est cherché dans le dossier de la session', async () => {
    const { prisma, requetes } = doublurePrisma();
    await jouer([JOURNAL_FACULTATIF], ID, 'query', 'journalId', prisma);
    expect(requetes).toEqual([{ modele: 'journal', where: { id: ID, tenantId: DOSSIER } }]);
  });
});

describe('COMPTE_FACULTATIF · le compte en filtre, du dossier ou introuvable (constat 4)', () => {
  let lecture: ReturnType<typeof routesExercice>;
  beforeAll(() => {
    lecture = routesExercice();
  }, 120_000);

  it('toute route qui lit compteId en requête porte le porteur, ou figure avec son motif dans la liste fermée', () => {
    const enRequete = lecture.routesCompte.filter((r) => r.type === 'query');
    expect(enRequete.map((r) => r.route).sort()).toEqual(
      [...ROUTES_A_COMPTE_EN_FILTRE, ...Object.keys(ROUTES_A_COMPTE_JUGE_PAR_LE_SERVICE)].sort(),
    );
    expect(enRequete.filter((r) => ROUTES_A_COMPTE_EN_FILTRE.includes(r.route) && !r.pipes.includes(COMPTE_FACULTATIF)).map((r) => r.route)).toEqual([]);
    // Toutes derrière JwtAuthGuard · le porteur lit le dossier de la session.
    expect(enRequete.filter((r) => !r.gardes.includes(JwtAuthGuard)).map((r) => r.route)).toEqual([]);
  });

  it('joué sur chaque route · absent reste absent, illisible 400, d’un autre dossier 404, du dossier passe', async () => {
    const routes = lecture.routesCompte.filter((x) => x.type === 'query' && ROUTES_A_COMPTE_EN_FILTRE.includes(x.route));
    expect(routes).toHaveLength(ROUTES_A_COMPTE_EN_FILTRE.length);
    for (const r of routes) {
      await expect(jouer(r.pipes, undefined, 'query', 'compteId')).resolves.toBeUndefined();
      const illisible = await jouer(r.pipes, 'abc', 'query', 'compteId').catch((e: unknown) => e);
      expect({ route: r.route, refus: messageDe(illisible) }).toEqual({ route: r.route, refus: `400 ${MESSAGE_COMPTE_ILLISIBLE}` });
      const voisin = await jouer(r.pipes, ID_DU_VOISIN, 'query', 'compteId').catch((e: unknown) => e);
      expect({ route: r.route, refus: messageDe(voisin) }).toEqual({ route: r.route, refus: `404 ${MESSAGE_COMPTE_HORS_DOSSIER}` });
      await expect(jouer(r.pipes, ID, 'query', 'compteId')).resolves.toBe(ID);
    }
  });

  it('le compte est cherché dans le dossier de la session', async () => {
    const { prisma, requetes } = doublurePrisma();
    await jouer([COMPTE_FACULTATIF], ID, 'query', 'compteId', prisma);
    expect(requetes).toEqual([{ modele: 'compte', where: { id: ID, tenantId: DOSSIER } }]);
  });
});

describe('Un identifiant porté par un DTO de requête (constat 5)', () => {
  let lecture: ReturnType<typeof routesExercice>;
  beforeAll(() => {
    lecture = routesExercice();
  }, 120_000);

  it('le recensement lit les DTO de requête et leurs champs (un garde-fou vide ne garde rien)', () => {
    expect(lecture.dtosEnRequete.length).toBeGreaterThan(0);
    expect(lecture.dtosEnRequete.filter((d) => d.dto === '?').map((d) => d.route)).toEqual([]);
    expect(lecture.dtosEnRequete.every((d) => d.proprietes.length > 0)).toBe(true);
  });

  it('aucun DTO de requête ne porte exerciceId, journalId ou compteId hors de la liste fermée, et la liste est celle-ci', () => {
    const portes = lecture.dtosEnRequete.flatMap((d) =>
      d.proprietes.filter((p) => IDENTIFIANTS_A_PORTEUR.includes(p)).map((p) => `${d.route} ${d.dto} ${p}`),
    );
    expect(portes.sort()).toEqual(Object.keys(IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE).sort());
  });
});

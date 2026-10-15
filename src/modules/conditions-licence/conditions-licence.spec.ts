import { readFileSync } from 'fs';
import { join } from 'path';
import { ConflictException } from '@nestjs/common';
import {
  A_ARRETER,
  articlesDesConditions,
  EDITEUR,
  FORMULES_DU_CONTRAT,
  ElementsDeLOffre,
  IdentiteEditeur,
  mentionsAArreter,
  OFFRE,
  RECLAMATIONS,
  texteBrutDesConditions,
  VERSION_CONDITIONS_LICENCE,
} from './conditions-de-licence';
import { ContexteAcceptation, detailCommande, etatConditions, motifAcceptationFermee, motifRefusAcceptation } from './acceptation-conditions';
import { accuseReceptionConditions, nomPieceJointeConditions } from './accuse-reception-conditions';
import { FORMULES_INITIALES } from '../plateforme/abonnements/abonnements.service';
import { DELAI_PAIEMENT_JOURS, JOURS_ESSAI } from '../plateforme/abonnements/facturation-abonnements';

/**
 * LES CONDITIONS DE LICENCE ET LEUR ACCEPTATION EN LIGNE (ligne
 * pages-legales). Ce qui casserait en silence · une offre acceptée alors
 * qu'elle ne dit pas ce que la loi exige, une version acceptée qui ne serait
 * pas celle lue, un contrat qui dirait une durée d'essai que le moteur de
 * facturation ne tient pas, une grille recopiée qui aurait dérivé de la
 * console.
 */

const SOURCE = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const IDENTITE_COMPLETE: IdentiteEditeur = {
  denomination: 'VMG Consulting',
  siege: '1, avenue Exemple, Kinshasa',
  courriel: 'contact@exemple.cd',
  telephone: '+243 000 000 000',
  immatriculation: 'NON_ASSUJETTIE',
};
const RECLAMATIONS_COMPLETES = { courriel: 'reclamations@exemple.cd', telephone: '+243 000 000 001', modalites: 'Réponse sous trois jours ouvrables.' };
const OFFRE_COMPLETE: ElementsDeLOffre = {
  modalitesPaiement: 'Virement bancaire au compte indiqué sur la facture.',
  droitRetractation: 'Exemple de clause de rétractation.',
  garantiesLegales: 'Exemple de clause de garanties légales.',
};

const formule = (prixMensuelUsd: number | null) => ({ code: 'ESSENTIEL', libelle: 'Essentiel', type: 'FORMULE' as const, prixMensuelUsd, prixAnnuelUsd: null });
const abonnement = (prix: number | null) => ({
  formule: formule(prix),
  options: [],
  dossiersSupplementaires: 0,
  periodicite: 'MENSUELLE' as const,
  debut: '2026-10-01',
  finEssai: '2026-10-31',
  actif: true,
});
/** Un abonnement au prix fixé · ce qu'un dossier en ligne doit avoir pour accepter (relecture M4). */
const COMMANDE = detailCommande(abonnement(25));

const contexte = (c: Partial<ContexteAcceptation> = {}): ContexteAcceptation => ({
  mentions: [],
  typeLicence: 'ABONNEMENT',
  estDemonstration: false,
  surSite: false,
  commande: COMMANDE,
  ...c,
});

describe('l’offre dit ce que la loi exige, sinon elle ne s’accepte pas (Code du numérique, art. 52 à 54)', () => {
  it('aujourd’hui, l’identité de l’éditeur et le contact des réclamations ne sont pas arrêtés · rien n’est inventé', () => {
    // VMG Consulting n'a arrêté ni son siège, ni ses contacts · la politique
    // de confidentialité le dit déjà. Un contact inventé dirigerait les
    // réclamations vers le vide.
    expect(EDITEUR.siege).toBeNull();
    expect(EDITEUR.courriel).toBeNull();
    expect(EDITEUR.telephone).toBeNull();
    expect(EDITEUR.immatriculation).toBeNull();
    expect(RECLAMATIONS).toEqual({ courriel: null, telephone: null, modalites: null });
    expect(OFFRE).toEqual({ modalitesPaiement: null, droitRetractation: null, garantiesLegales: null });
    const manque = mentionsAArreter();
    expect(manque.length).toBe(9);
    expect(manque.join(' ')).toContain('art. 52, 3°');
    expect(manque.join(' ')).toContain('art. 53, 13°');
    expect(manque.join(' ')).toContain('art. 53, 14°');
  });

  it('l’offre dit aussi le paiement, la rétractation et les garanties légales (art. 53, 6°, 16° et 20°) · relecture M3', () => {
    // La garde de l'art. 54, al. 2 ne lisait que l'identité et les
    // réclamations · une identité complète ouvrait l'acceptation sur une offre
    // muette sur ces trois points que l'art. 53 énumère.
    const reste = mentionsAArreter(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES);
    expect(reste).toEqual([
      'les modalités de paiement, notamment les moyens de paiement acceptés (art. 53, 6°)',
      'l’existence ou l’absence d’un droit de rétractation et ses conditions d’exercice (art. 53, 16°)',
      'les garanties légales de conformité, des vices cachés et d’éviction (art. 53, 20°)',
    ]);
    const texte = texteBrutDesConditions();
    expect(texte).toContain(`Les modalités de paiement, notamment les moyens de paiement acceptés · (${A_ARRETER})`);
    expect(texte).toContain(`L’existence ou l’absence d’un droit de rétractation pour le présent contrat, et ses conditions d’exercice · (${A_ARRETER}) (art. 53, 16°).`);
    expect(texte).toContain(`Les garanties légales de conformité, des vices cachés et d’éviction · (${A_ARRETER})`);
    expect(motifAcceptationFermee(contexte({ mentions: reste }))).toContain('art. 53, 6°');
  });

  it('complétées, plus rien ne manque · l’immatriculation peut être déclarée sans objet (art. 52, 4°, « si elle est assujettie »)', () => {
    expect(mentionsAArreter(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES, OFFRE_COMPLETE)).toEqual([]);
    const complet = texteBrutDesConditions(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES, OFFRE_COMPLETE);
    expect(complet).toContain('Virement bancaire au compte indiqué sur la facture.');
    expect(complet).not.toContain(`moyens de paiement acceptés · (${A_ARRETER})`);
  });

  it('le texte écrit « à arrêter » à la place de chaque inconnue, et rien d’autre', () => {
    const texte = texteBrutDesConditions();
    expect(texte).toContain(`Siège social · (${A_ARRETER})`);
    expect(texte).toContain(`Téléphone · (${A_ARRETER})`);
    const complet = texteBrutDesConditions(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES);
    expect(complet).toContain('Siège social · 1, avenue Exemple, Kinshasa.');
    expect(complet).toContain('n’est pas assujettie aux formalités d’inscription au registre du commerce');
    expect(complet).toContain('Réponse sous trois jours ouvrables.');
  });

  it('l’acceptation reste fermée tant qu’une mention manque, et le motif cite l’art. 54, al. 2', () => {
    const m = motifAcceptationFermee(contexte({ mentions: mentionsAArreter() }));
    expect(m).toContain('art. 54, al. 2');
    expect(motifAcceptationFermee(contexte())).toBeNull();
  });
});

describe('qui peut accepter, et quoi', () => {
  it('le dossier de l’éditeur et une vitrine ne contractent pas', () => {
    expect(motifAcceptationFermee(contexte({ typeLicence: 'PROPRIETAIRE' }))).toContain('éditeur');
    expect(motifAcceptationFermee(contexte({ estDemonstration: true }))).toContain('démonstration');
    // Sur site, le fichier signé décide, jamais la ligne du dossier.
    expect(motifAcceptationFermee(contexte({ typeLicence: 'PROPRIETAIRE', surSite: true }))).toBeNull();
  });

  it('en ligne, sans abonnement rattaché, l’acceptation est fermée et le dit · le prix précède l’acceptation (relecture M4)', () => {
    // Anciens dossiers, cellules, dossiers d'un paquet Cabinet · aucun
    // abonnement à eux, et l'acceptation s'ouvrait sans aucun prix à vérifier.
    expect(motifAcceptationFermee(contexte({ commande: null }))).toContain('Aucun abonnement n’est rattaché à ce dossier, ni à son siège');
    expect(motifAcceptationFermee(contexte({ commande: null }))).toContain('art. 53, 5°');
    // Sur site, le fichier signé tient la licence · aucun abonnement n'y est lu.
    expect(motifAcceptationFermee(contexte({ commande: null, surSite: true }))).toBeNull();
  });

  it('une licence perpétuelle hébergée n’a pas d’offre dans le contrat · fermée, nommée (relecture M4)', () => {
    const m = motifAcceptationFermee(contexte({ typeLicence: 'PERPETUEL_SAAS' }));
    expect(m).toContain('licence perpétuelle hébergée');
    expect(m).toContain('à arrêter par VMG Consulting');
    expect(motifAcceptationFermee(contexte({ typeLicence: 'PERPETUEL_SAAS', surSite: true }))).toBeNull();
  });

  it('seule la version en vigueur s’accepte · une page restée ouverte sur une autre ne fait rien accepter', () => {
    const v = VERSION_CONDITIONS_LICENCE.numero;
    expect(motifRefusAcceptation(v, contexte())).toBeNull();
    expect(motifRefusAcceptation(v + 1, contexte())).toContain('n’est pas la version en vigueur');
    expect(motifRefusAcceptation(Number.NaN, contexte())).toContain('n’est pas la version en vigueur');
  });

  it('l’état ne demande l’acceptation que si elle est ouverte et pas déjà faite', () => {
    const ouverte = { typeLicence: 'ABONNEMENT', estDemonstration: false, surSite: false, commande: COMMANDE, mentions: [] };
    expect(etatConditions(null, ouverte).aAccepter).toBe(true);
    const faite = { version: VERSION_CONDITIONS_LICENCE.numero, le: '2026-10-15T09:00:00.000Z', par: 'admin@exemple.cd' };
    expect(etatConditions(faite, ouverte)).toMatchObject({ aJour: true, aAccepter: false });
    // Une version antérieure acceptée ne vaut pas la version en vigueur.
    expect(etatConditions({ ...faite, version: 0 }, ouverte)).toMatchObject({ aJour: false, aAccepter: true });
    // Fermée, rien n'est demandé, et le motif est servi.
    const fermee = etatConditions(null, { ...ouverte, mentions: ['x'] });
    expect(fermee.aAccepter).toBe(false);
    expect(fermee.motifFermeture).toContain('art. 54');
  });
});

describe('les détails de la commande viennent du moteur de la facture (art. 53, 5° ; art. 55, al. 1er)', () => {

  it('un prix fixé rend les lignes et le total de la première période facturable', () => {
    const d = detailCommande(abonnement(25));
    expect(d.lignes).toEqual([{ designation: 'Abonnement OmegaX · Essentiel · 2026-11', quantite: 1, prixUnitaireUsd: 25 }]);
    expect(d.totalUsd).toBe(25);
    expect(motifAcceptationFermee(contexte({ commande: d }))).toBeNull();
  });

  it('un prix non fixé ferme l’acceptation · l’offre doit dire le prix', () => {
    const d = detailCommande(abonnement(null));
    expect(d.lignes).toBeNull();
    expect(d.motifPrix).toContain('Prix mensuel non fixé');
    expect(motifAcceptationFermee(contexte({ commande: d }))).toContain('art. 53, 5°');
  });

  it('un abonnement suspendu se montre quand même, prix compris', () => {
    const d = detailCommande({ ...abonnement(25), actif: false });
    expect(d.totalUsd).toBe(25);
    expect(d.actif).toBe(false);
  });
});

describe('le contrat dit ce que le code fait', () => {
  it('la grille recopiée est celle que la console sème, libellé et contenu', () => {
    expect(FORMULES_DU_CONTRAT).toEqual(FORMULES_INITIALES.map((f) => ({ code: f.code, libelle: f.libelle, contenu: f.contenu })));
  });

  it('l’essai et le délai de paiement sont ceux du moteur de facturation', () => {
    const enLettres: Record<number, string> = { 15: 'quinze', 30: 'trente' };
    const texte = texteBrutDesConditions();
    expect(texte).toContain(`essai gratuit de ${enLettres[JOURS_ESSAI]} jours`);
    expect(texte).toContain(`Le client dispose de ${enLettres[DELAI_PAIEMENT_JOURS]} jours après la fin de l’essai`);
  });

  it('la lecture seule dite au contrat est celle de LicenceGuard · téléchargements ouverts, impression numérotée du journal refusée (relecture, mineur 4)', () => {
    const garde = readFileSync(join(__dirname, '..', 'licence', 'licence.guard.ts'), 'utf8');
    expect(garde).toContain("const METHODES_DE_LECTURE = new Set(['GET', 'HEAD'])");
    // L'impression du journal s'enregistre par un POST derrière LicenceGuard ·
    // le contrat disait « ils l'impriment », ce que la garde refuse.
    const impressions = readFileSync(join(__dirname, '..', 'journaux', 'impressions-journal.controller.ts'), 'utf8');
    expect(impressions).toContain('@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)');
    expect(impressions).toContain('@Post()');
    const texte = texteBrutDesConditions();
    expect(texte).toContain('passe en LECTURE SEULE · ses utilisateurs le consultent et en téléchargent les états et les livres');
    expect(texte).toContain('aucune impression numérotée du journal n’y est plus admise');
  });

  it('la restitution est dite avec ses cinq réserves, celles que l’écran de restitution écrit (relecture, mineur 10)', () => {
    // « Copie intégrale » promettait plus que l'archive ne vaut · elle-même se
    // présente sous cinq réserves (docs/restitution-du-dossier.md).
    const ecran = readFileSync(join(__dirname, '..', '..', '..', 'client', 'src', 'pages', 'RestitutionPage.tsx'), 'utf8');
    for (const r of ['Elle ne remplace pas la conservation.', 'Elle n\'a pas la force probante de l\'écrit papier légalisé.', 'Ce n\'est pas une réversibilité.', 'Ce n\'est pas un instantané.', 'Les CSV ne sont pas le livre-journal.']) {
      expect(ecran).toContain(r);
    }
    const texte = texteBrutDesConditions();
    expect(texte).not.toContain('copie intégrale');
    expect(texte).toContain(
      'Cette archive porte cinq réserves, qu’elle écrit elle-même · elle ne remplace pas la conservation des pièces justificatives, n’a pas la force probante d’un écrit légalisé, ne se recharge pas entière dans OmegaX, n’est pas un instantané pris d’un seul coup, et ses fichiers ne sont pas le livre-journal.',
    );
  });

  it('cite les textes lus, chacun par son article · Code du numérique, droit d’auteur, Code civil', () => {
    const texte = texteBrutDesConditions().replace(/\s+/g, ' ');
    expect(texte).toContain('ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 47');
    expect(texte).toContain('ordonnance-loi n° 86-033, art. 1er');
    expect(texte).toContain('ordonnance-loi n° 86-033, art. 96');
    expect(texte).toContain('art. 229');
    expect(texte).toContain('art. 30, al. 3');
    expect(texte).toContain('Code civil, Livre III, art. 46');
    expect(texte).toContain('(art. 34)');
  });

  it('ne tranche aucun choix commercial que ni la loi ni le dépôt ne tranchent', () => {
    const texte = texteBrutDesConditions();
    for (const choix of ['Un plafond de responsabilité', 'La résiliation à l’initiative de chaque partie et son préavis', 'La juridiction compétente en cas de litige']) {
      expect(texte).toContain(`${choix} · (${A_ARRETER})`);
    }
    // Aucun chiffre de plafond, aucune juridiction nommée.
    expect(texte).not.toMatch(/tribunal de (commerce|grande instance)\s+de\s+[A-Z]/);
  });

  it('numérote ses articles sans trou ni doublon, et aucun titre n’est une référence juridique', () => {
    const a = articlesDesConditions();
    expect(a.map((x) => x.numero)).toEqual(a.map((_, i) => i + 1));
    for (const x of a) expect(x.titre).not.toMatch(/\b(art\.|article)\s*\d|§\s*\d/i);
  });

  it('dit la pratique de VMG Consulting sur les données des dossiers et nomme ses accès techniques, jamais une impossibilité (relecture B1)', () => {
    const texte = texteBrutDesConditions();
    expect(texte).toContain('Elle ne consulte pas le contenu des dossiers · ses accès techniques à la base se limitent à la sauvegarde chiffrée');
    expect(texte).toContain('la restauration de contrôle automatique qui l’éprouve');
    expect(texte).toContain('aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres');
  });

  it('dit la langue du contrat, le français seul (art. 53, 8°)', () => {
    expect(texteBrutDesConditions()).toContain('langue du contrat · français');
    expect(texteBrutDesConditions()).toContain('en français, seule langue proposée');
  });
});

describe('l’accusé de réception (art. 55, al. 2) et la copie du contrat (art. 56, al. 1er)', () => {
  const acceptation = { version: 1, le: '2026-10-15T09:30:00.000Z', par: 'admin@exemple.cd' };

  it('porte la version, le dossier, l’auteur, la date, et le texte accepté en pièce jointe', () => {
    const a = accuseReceptionConditions(acceptation, 'Association Exemple');
    expect(a.sujet).toContain('version 1');
    expect(a.corps).toContain('Dossier · Association Exemple');
    expect(a.corps).toContain('Acceptées par · admin@exemple.cd');
    expect(a.corps).toContain('(heure de Kinshasa)');
    expect(a.pieceJointe).toEqual({ nom: nomPieceJointeConditions(1), texte: texteBrutDesConditions() });
  });
});

/** Un service sur une base factice · l'acceptation ouverte en complétant les mentions. */
jest.mock('./conditions-de-licence', () => {
  const vrai = jest.requireActual('./conditions-de-licence');
  return { ...vrai, mentionsAArreter: jest.fn(vrai.mentionsAArreter) };
});

describe('le service d’acceptation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('./conditions-de-licence') as { mentionsAArreter: jest.Mock };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ConditionsLicenceService } = require('./conditions-licence.service') as typeof import('./conditions-licence.service');

  /** Une ligne d'abonnement telle que Prisma la rend · prix fixé, sauf `null` passé. */
  const LIGNE_ABONNEMENT = {
    periodicite: 'MENSUELLE',
    debut: new Date('2026-10-01T00:00:00Z'),
    finEssai: new Date('2026-10-31T00:00:00Z'),
    actif: true,
    dossiersSupplementaires: 0,
    formule: { code: 'ESSENTIEL', libelle: 'Essentiel', type: 'FORMULE', prixMensuelUsd: { toString: () => '25' }, prixAnnuelUsd: null },
    options: [],
  };

  function monde(
    tenant: Record<string, unknown> = {},
    courrier?: { mettreEnFile: jest.Mock },
    abonnementLu: Record<string, unknown> | null = LIGNE_ABONNEMENT,
  ) {
    const t: Record<string, unknown> = {
      nom: 'Association Exemple',
      estDemonstration: false,
      conditionsLicenceVersion: null,
      conditionsLicenceAccepteesLe: null,
      conditionsLicenceAccepteesPar: null,
      licence: { type: 'ABONNEMENT' },
      dossierMereId: null,
      ...tenant,
    };
    const tx = {
      $executeRaw: jest.fn(async () => 1),
      tenant: {
        findUnique: jest.fn(async () => ({ ...t })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(t, data)),
      },
    };
    const prisma = {
      tenant: { findUnique: jest.fn(async () => ({ ...t })) },
      abonnementCabinet: { findUnique: jest.fn(async () => abonnementLu) },
      $transaction: jest.fn(async (fn: (x: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const s = new ConditionsLicenceService(prisma as never, courrier as never);
    return { s, t, tx, prisma };
  }

  afterEach(() => module.mentionsAArreter.mockImplementation(jest.requireActual('./conditions-de-licence').mentionsAArreter));

  it('refuse tant que l’offre est incomplète · rien n’est écrit, aucun courriel', async () => {
    const courrier = { mettreEnFile: jest.fn() };
    const m = monde({}, courrier);
    await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(m.tx.tenant.update).not.toHaveBeenCalled();
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('ouverte, écrit l’acceptation par une mise à jour UNITAIRE, sous verrou du dossier, et accuse réception', async () => {
    module.mentionsAArreter.mockReturnValue([]);
    const courrier = { mettreEnFile: jest.fn(async () => ({ id: 'm1', statut: 'SANS_TRANSPORT', erreur: null })) };
    const m = monde({}, courrier);
    const r = await m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1);
    expect(m.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(m.tx.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { conditionsLicenceVersion: 1, conditionsLicenceAccepteesLe: expect.any(Date), conditionsLicenceAccepteesPar: 'admin@exemple.cd' },
    });
    expect(r.deja).toBe(false);
    expect(r.etat).toMatchObject({ aJour: true, aAccepter: false, acceptation: { version: 1, par: 'admin@exemple.cd' } });
    expect(r.accuse).toEqual({ statut: 'SANS_TRANSPORT' });
    const [tenantId, message] = courrier.mettreEnFile.mock.calls[0] as unknown as [string, { destinataire: string; origine: string; pieceJointe: { nom: string } }];
    expect(tenantId).toBe('t1');
    expect(message.destinataire).toBe('admin@exemple.cd');
    expect(message.origine).toBe('CONDITIONS_LICENCE');
    expect(message.pieceJointe.nom).toBe(nomPieceJointeConditions(1));
  });

  it('déjà acceptée, ne réécrit rien · la date et l’auteur d’origine sont rendus', async () => {
    module.mentionsAArreter.mockReturnValue([]);
    const courrier = { mettreEnFile: jest.fn() };
    const le = new Date('2026-10-15T08:00:00Z');
    const m = monde({ conditionsLicenceVersion: 1, conditionsLicenceAccepteesLe: le, conditionsLicenceAccepteesPar: 'premier@exemple.cd' }, courrier);
    const r = await m.s.accepter('t1', { userId: 'u2', email: 'second@exemple.cd' }, 1);
    expect(r.deja).toBe(true);
    expect(r.etat.acceptation).toEqual({ version: 1, le: le.toISOString(), par: 'premier@exemple.cd' });
    expect(m.tx.tenant.update).not.toHaveBeenCalled();
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('un échec de mise en file ne défait JAMAIS l’acceptation, et se dit', async () => {
    module.mentionsAArreter.mockReturnValue([]);
    const courrier = { mettreEnFile: jest.fn(async () => { throw new Error('Adresse inutilisable'); }) };
    const m = monde({}, courrier);
    const r = await m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1);
    expect(m.t.conditionsLicenceVersion).toBe(1);
    expect(r.accuse).toEqual({ statut: 'NON_MIS_EN_FILE' });
  });

  it('une cellule lit l’abonnement de son siège, et le dit (relecture M4)', async () => {
    module.mentionsAArreter.mockReturnValue([]);
    const m = monde({ dossierMereId: 'siege-1' });
    const e = await m.s.etat('cellule-1');
    expect((m.prisma.abonnementCabinet.findUnique.mock.calls[0] as unknown as [{ where: unknown }])[0].where).toEqual({ cabinetId: 'siege-1' });
    expect(e.commande).toMatchObject({ duSiege: true, totalUsd: 25 });
    expect(e.aAccepter).toBe(true);
  });

  it('sans abonnement, ni à lui ni à son siège, l’acceptation est refusée · rien n’est écrit (relecture M4)', async () => {
    module.mentionsAArreter.mockReturnValue([]);
    const courrier = { mettreEnFile: jest.fn() };
    const m = monde({}, courrier, null);
    await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1)).rejects.toThrow('Aucun abonnement n’est rattaché');
    expect(m.tx.tenant.update).not.toHaveBeenCalled();
    expect(courrier.mettreEnFile).not.toHaveBeenCalled();
  });

  it('l’état lu sert la commande sans le tiers facturé du dossier de l’éditeur', async () => {
    const m = monde();
    await m.s.etat('t1');
    const select = (m.prisma.abonnementCabinet.findUnique.mock.calls[0] as unknown as [{ select: Record<string, unknown> }])[0].select;
    expect(select).not.toHaveProperty('tiers');
    expect(select).not.toHaveProperty('tiersId');
  });
});

describe('le contrôleur', () => {
  const source = SOURCE('conditions-licence.controller.ts');

  it('l’acceptation est réservée à l’administrateur du dossier', () => {
    const avant = source.slice(0, source.indexOf("@Post('acceptation')"));
    expect(avant.slice(avant.lastIndexOf('@Roles(')).startsWith('@Roles(RoleUtilisateur.ADMIN_CABINET)')).toBe(true);
  });

  it('reste hors de LicenceGuard · un dossier en lecture seule doit pouvoir accepter', () => {
    expect(source).toContain('@UseGuards(JwtAuthGuard, RolesGuard)');
    expect(source).not.toContain('LicenceGuard)');
  });
});

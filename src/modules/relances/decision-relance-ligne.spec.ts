import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Referentiel, StatutEcriture, TypeRelance } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CourrierService } from '../courrier/courrier.service';
import { RelancesService } from './relances.service';
import { decisionDeLaLigne, motifRefusDecalage, motifRefusLigne, motifRefusMotif } from './decision-relance-ligne';

/**
 * Ligne gl-saisie, fonction 33 · exclure UNE ligne de la relance, décaler son
 * échéance. L'exclusion porte sur le courrier, jamais sur la créance ; le
 * décalage recule le terme (Code civil, Livre III, art. 84 et 85).
 */
const DOSSIER = 'd-1';
const JOUR = 86_400_000;
const NIVEAU = {
  id: 'n-2',
  tenantId: DOSSIER,
  niveau: 2,
  libelle: 'Premier rappel',
  type: TypeRelance.RAPPEL,
  joursApresEcheance: 15,
  modeleTexte: 'Cher {tiers}, {montant} au {date}.\n{detail}',
  estActif: true,
};

function ligne(id: string, montant: number, echeanceIlYa: number) {
  return {
    id,
    debit: montant,
    credit: 0,
    lettre: null,
    lettrageId: null,
    libelle: `Facture ${id}`,
    dateEcheance: new Date(Date.now() - echeanceIlYa * JOUR),
    compte: {
      id: 'c-411',
      numero: '41110001',
      intitule: 'Client',
      tiersCompte: { tiers: { id: 't1', nom: 'SARL Amani', type: 'CLIENT', email: 'a@example.cd', horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null } },
    },
    ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
  };
}

function service(lignes: ReturnType<typeof ligne>[], decisions: object[]) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA }) },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
    decisionRelanceLigne: { findMany: jest.fn().mockResolvedValue(decisions) },
    niveauRelance: { findMany: jest.fn().mockResolvedValue([NIVEAU]) },
    relance: { findMany: jest.fn().mockResolvedValue([]) },
    lettrage: { findMany: jest.fn(async () => []) },
    imputationPaiement: { findMany: jest.fn(async () => []) },
  } as unknown as PrismaService;
  return new RelancesService(prisma, {} as CourrierService);
}

describe('décision de relance sur une ligne · les positions', () => {
  it('la ligne exclue se montre, ne se réclame pas, et le reste du compte se relance', async () => {
    const svc = service([ligne('l1', 100_000, 60), ligne('l2', 40_000, 60)], [
      { ligneEcritureId: 'l2', exclue: true, motifExclusion: 'Facture contestée', echeanceAccordee: null, motifEcheance: null },
    ]);
    const [p] = await svc.positions(DOSSIER, { exerciceId: 'x1' });
    expect(p.montantDu).toBe(100_000);
    expect(p.lignes.map((l) => l.ligneId)).toEqual(['l1']);
    expect(p.lignesExclues).toEqual([expect.objectContaining({ ligneId: 'l2', montant: 40_000, motif: 'Facture contestée' })]);
    expect(p.niveauSuggere).toBe(2);
  });

  it('un compte dont toutes les lignes sont exclues reste montré, sans dû ni niveau', async () => {
    const svc = service([ligne('l1', 100_000, 60)], [
      { ligneEcritureId: 'l1', exclue: true, motifExclusion: 'Litige', echeanceAccordee: null, motifEcheance: null },
    ]);
    const positions = await svc.positions(DOSSIER, { exerciceId: 'x1' });
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ montantDu: 0, niveauSuggere: null, retardMaxJours: 0 });
    expect(positions[0].lignesExclues).toHaveLength(1);
  });

  it('l’échéance accordée recule le retard · une facture échue depuis 60 jours, reportée dans 10, ne se rappelle plus', async () => {
    const accordee = new Date(Date.now() + 10 * JOUR);
    const svc = service([ligne('l1', 100_000, 60)], [
      { ligneEcritureId: 'l1', exclue: false, motifExclusion: null, echeanceAccordee: accordee, motifEcheance: 'Échéancier convenu' },
    ]);
    expect(await svc.positions(DOSSIER, { exerciceId: 'x1', type: TypeRelance.RAPPEL })).toEqual([]);
    const [preventive] = await svc.positions(DOSSIER, { exerciceId: 'x1', type: TypeRelance.PREVENTIVE });
    expect(preventive.lignes[0]).toMatchObject({ echeance: accordee.toISOString().slice(0, 10), motifEcheance: 'Échéancier convenu' });
    expect(preventive.lignes[0].echeanceDeLaPiece).not.toBeNull();
  });
});

describe('décision de relance sur une ligne · les règles', () => {
  it('sur une facture validée non lettrée d’un 40 ou d’un 41, seulement', () => {
    const base = { numero: '41110001', debit: 100, credit: 0, statut: StatutEcriture.VALIDEE, lettre: null };
    expect(motifRefusLigne(base)).toBeNull();
    expect(motifRefusLigne({ ...base, numero: '40110001', debit: 0, credit: 100 })).toBeNull();
    expect(motifRefusLigne({ ...base, numero: '60110000' })).toMatch(/fournisseur ou de client/);
    expect(motifRefusLigne({ ...base, debit: 0, credit: 100 })).toMatch(/règlement ou un avoir/);
    expect(motifRefusLigne({ ...base, statut: StatutEcriture.BROUILLARD })).toMatch(/brouillard/);
    expect(motifRefusLigne({ ...base, lettre: 'AB' })).toMatch(/lettrée/);
  });

  it('un motif écrit est exigé', () => {
    expect(motifRefusMotif('  ', 'L’exclusion')).toMatch(/motif écrit/);
    expect(motifRefusMotif('Litige', 'L’exclusion')).toBeNull();
  });

  it('un décalage recule le terme, jamais ne l’avance (art. 85)', () => {
    const piece = new Date('2026-03-31T00:00:00Z');
    expect(motifRefusDecalage(new Date('2026-04-30T00:00:00Z'), piece)).toBeNull();
    expect(motifRefusDecalage(new Date('2026-03-31T00:00:00Z'), piece)).toMatch(/art\. 85/);
    expect(motifRefusDecalage(new Date('2026-02-28T00:00:00Z'), piece)).toMatch(/postérieure/);
  });

  it('la décision de la ligne prime, sinon celle de sa pièce d’origine', () => {
    const d = (motif: string) => ({ exclue: true, motifExclusion: motif, echeanceAccordee: null, motifEcheance: null });
    const decisions = new Map([
      ['origine', d('à l’origine')],
      ['report', d('sur le report')],
    ]);
    expect(decisionDeLaLigne('report', 'origine', decisions)?.motifExclusion).toBe('sur le report');
    expect(decisionDeLaLigne('autre-report', 'origine', decisions)?.motifExclusion).toBe('à l’origine');
    expect(decisionDeLaLigne('seule', undefined, decisions)).toBeNull();
  });
});

describe('décision de relance sur une ligne · les gestes', () => {
  function gestes(ligneLue: object | null) {
    const ecrites: { op: string; arg: unknown }[] = [];
    const tx = {
      decisionRelanceLigne: {
        create: jest.fn(async (arg: unknown) => ecrites.push({ op: 'create', arg })),
        update: jest.fn(async (arg: unknown) => ecrites.push({ op: 'update', arg })),
        delete: jest.fn(async (arg: unknown) => ecrites.push({ op: 'delete', arg })),
      },
    };
    const prisma = {
      ligneEcriture: { findFirst: jest.fn().mockResolvedValue(ligneLue) },
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)),
    } as unknown as PrismaService;
    return { svc: new RelancesService(prisma, {} as CourrierService), ecrites, prisma };
  }
  const facture = (decision: object | null = null) => ({
    id: 'l1',
    debit: 100,
    credit: 0,
    lettre: null,
    dateEcheance: new Date('2026-03-31T00:00:00Z'),
    compte: { numero: '41110001' },
    ecriture: { statut: StatutEcriture.VALIDEE, date: new Date('2026-03-01T00:00:00Z') },
    decisionRelance: decision,
  });

  it('exclure crée la décision, auteur et date posés par le serveur ; sans motif, refus', async () => {
    const { svc, ecrites } = gestes(facture());
    await expect(svc.definirExclusionLigne(DOSSIER, 'u1', 'l1', { exclue: true })).rejects.toThrow(BadRequestException);
    await svc.definirExclusionLigne(DOSSIER, 'u1', 'l1', { exclue: true, motif: ' Litige ' });
    expect(ecrites).toEqual([
      { op: 'create', arg: { data: expect.objectContaining({ tenantId: DOSSIER, ligneEcritureId: 'l1', exclue: true, motifExclusion: 'Litige', exclueePar: 'u1', exclueLe: expect.any(Date) }) } },
    ]);
  });

  it('lever l’exclusion d’une ligne sans échéance accordée retire la décision, par son identifiant', async () => {
    const { svc, ecrites } = gestes(facture({ id: 'd1', exclue: true, echeanceAccordee: null }));
    await svc.definirExclusionLigne(DOSSIER, 'u1', 'l1', { exclue: false });
    expect(ecrites).toEqual([{ op: 'delete', arg: { where: { id: 'd1' } } }]);
  });

  it('lever ce qui n’est pas posé est dit · une ligne d’un autre dossier est introuvable', async () => {
    await expect(gestes(facture()).svc.definirExclusionLigne(DOSSIER, 'u1', 'l1', { exclue: false })).rejects.toThrow(NotFoundException);
    const { svc, prisma } = gestes(null);
    await expect(svc.definirEcheanceAccordee(DOSSIER, 'u1', 'l9', { echeanceAccordee: '2026-05-31', motif: 'Accord' })).rejects.toThrow(NotFoundException);
    expect((prisma.ligneEcriture.findFirst as jest.Mock).mock.calls[0][0].where).toMatchObject({ id: 'l9', ecriture: { tenantId: DOSSIER } });
  });

  it('décaler garde l’exclusion posée et retouche la décision par son identifiant ; plus tôt que la pièce, refus', async () => {
    const { svc, ecrites } = gestes(facture({ id: 'd1', exclue: true, echeanceAccordee: null }));
    await expect(svc.definirEcheanceAccordee(DOSSIER, 'u1', 'l1', { echeanceAccordee: '2026-03-15', motif: 'Accord' })).rejects.toThrow(/postérieure/);
    await svc.definirEcheanceAccordee(DOSSIER, 'u1', 'l1', { echeanceAccordee: '2026-05-31', motif: 'Accord du 2 avril' });
    expect(ecrites).toEqual([
      { op: 'update', arg: { where: { id: 'd1' }, data: expect.objectContaining({ echeanceAccordee: new Date('2026-05-31T00:00:00Z'), motifEcheance: 'Accord du 2 avril', accordeePar: 'u1' }) } },
    ]);
  });
});

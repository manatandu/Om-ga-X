import { Referentiel, StatutMessage, TypeRelance } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CourrierService, MessageAMettreEnFile } from '../courrier/courrier.service';
import { RelancesService } from './relances.service';

/**
 * LE MODÈLE D'IMPRESSION DU TIERS HABILLE SA LETTRE (ligne sage-l2, fonction
 * 27) · ce qui casserait en silence · une lettre envoyée sans l'habillage que
 * le tiers attend, un historique qui garderait la lettre nue quand le
 * courriel est parti habillé (l'historique ne ferait plus foi), le modèle du
 * rappel posé sur un relevé, ou celui d'un tiers posé sur la lettre d'un
 * autre.
 *
 * LA DOUBLURE HONORE LA REQUÊTE · les tiers lus sont ceux demandés, les
 * modèles ceux de la nature demandée et des identifiants demandés.
 */

const DOSSIER = 'd-1';
const JOUR = 86_400_000;

const niveau = (type: TypeRelance) => ({
  id: `n-${type}`,
  tenantId: DOSSIER,
  niveau: 2,
  libelle: type === TypeRelance.RELEVE ? 'Relevé' : 'Premier rappel',
  type,
  joursApresEcheance: type === TypeRelance.RAPPEL ? 15 : 0,
  modeleTexte: 'Cher {tiers}, {montant} reste dû.\n{entite}',
  estActif: true,
});

function ligne(numero: string, tiersId: string, nom: string) {
  return {
    debit: 150_000,
    credit: 0,
    lettre: null,
    libelle: `Facture ${numero}`,
    dateEcheance: new Date(Date.now() - 60 * JOUR),
    compte: {
      id: `c-${numero}`,
      numero,
      intitule: 'Client',
      tiersCompte: { tiers: { id: tiersId, nom, type: 'CLIENT', email: `${tiersId}@client.cd`, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null } },
    },
    ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente' },
  };
}

const FICHES = [
  {
    id: 't-1',
    nom: 'Brasserie du Fleuve',
    code: 'CLI-001',
    qualite: null,
    contact: 'Mme Mbuyi',
    adresse: null,
    boitePostale: null,
    ville: 'Kinshasa',
    pays: null,
    modeleImpressionExtraitId: 'm-extrait',
    modeleImpressionReglementId: null,
    modeleImpressionRappelId: 'm-rappel',
  },
  {
    id: 't-2',
    nom: 'Hôtel Kivu',
    code: 'CLI-002',
    qualite: null,
    contact: null,
    adresse: null,
    boitePostale: null,
    ville: null,
    pays: null,
    modeleImpressionExtraitId: null,
    modeleImpressionReglementId: null,
    modeleImpressionRappelId: null,
  },
];
const MODELES = [
  { id: 'm-rappel', nature: 'RAPPEL', intitule: 'Contrat cadre', texte: 'À l’attention de {contact}\n\n{document}\n\nRéf. contrat 2026-07' },
  { id: 'm-extrait', nature: 'EXTRAIT', intitule: 'Relevé contrat', texte: 'Relevé pour {tiers} ({code})\n{document}\nFin du relevé' },
];

function service(n: ReturnType<typeof niveau>) {
  const lignes = [ligne('41100001', 't-1', 'Brasserie du Fleuve'), ligne('41100002', 't-2', 'Hôtel Kivu')];
  const ecrites: { compteId: string; texte: string }[] = [];
  const lireTiers = jest.fn(async ({ where }: { where: { tenantId: string; id: { in: string[] } } }) =>
    where.tenantId === DOSSIER ? FICHES.filter((f) => where.id.in.includes(f.id)) : [],
  );
  const lireModeles = jest.fn(async ({ where }: { where: { tenantId: string; nature: string; id: { in: string[] } } }) =>
    where.tenantId === DOSSIER ? MODELES.filter((m) => m.nature === where.nature && where.id.in.includes(m.id)) : [],
  );
  const prisma = {
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA }),
      findUnique: jest.fn().mockResolvedValue({ nom: 'SARL Kin' }),
    },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
    niveauRelance: { findFirst: jest.fn().mockResolvedValue(n), findMany: jest.fn().mockResolvedValue([n]) },
    relance: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(async ({ data }: { data: { compteId: string; texte: string }[] }) => {
        ecrites.push(...data);
        return { count: data.length };
      }),
    },
    compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })) },
    tiers: { findMany: lireTiers },
    modeleImpressionTiers: { findMany: lireModeles },
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;
  const ecrireEnFileSansTenter = jest.fn(async (_tx: unknown, _d: string, lot: MessageAMettreEnFile[]) =>
    lot.map(() => ({ id: 'm-1', statut: StatutMessage.SANS_TRANSPORT, motif: null })),
  );
  const svc = new RelancesService(prisma, { ecrireEnFileSansTenter } as unknown as CourrierService);
  return { svc, ecrites, ecrireEnFileSansTenter, lireModeles };
}

describe('le rappel habillé du modèle du tiers', () => {
  it('la lettre du niveau est le document · le modèle du tiers l’entoure, et l’historique garde la lettre qui part', async () => {
    const n = niveau(TypeRelance.RAPPEL);
    const { svc, ecrites, ecrireEnFileSansTenter, lireModeles } = service(n);
    const r = await svc.emettre(DOSSIER, 'u-1', { exerciceId: 'ex-1', niveauId: n.id, compteIds: ['c-41100001', 'c-41100002'] });

    const habillee = r.lettres.find((l) => l.compteId === 'c-41100001')!;
    expect(habillee.modeleImpression).toBe('Contrat cadre');
    expect(habillee.texte.startsWith('À l’attention de Mme Mbuyi\n\nCher Brasserie du Fleuve,')).toBe(true);
    expect(habillee.texte.endsWith('SARL Kin\n\nRéf. contrat 2026-07')).toBe(true);
    // Le tiers sans modèle reçoit la lettre du niveau, nue.
    const nue = r.lettres.find((l) => l.compteId === 'c-41100002')!;
    expect(nue.modeleImpression).toBeNull();
    expect(nue.texte.startsWith('Cher Hôtel Kivu,')).toBe(true);
    // L'historique et le courriel portent le MÊME texte · l'historique fait foi.
    expect(ecrites.find((e) => e.compteId === 'c-41100001')?.texte).toBe(habillee.texte);
    const lot = ecrireEnFileSansTenter.mock.calls[0][2] as MessageAMettreEnFile[];
    expect(lot.map((m) => m.corps)).toContain(habillee.texte);
    // Seuls les modèles de RAPPEL sont lus pour un rappel.
    expect(lireModeles.mock.calls.every(([a]) => a.where.nature === 'RAPPEL')).toBe(true);
  });

  it('le relevé prend le modèle d’EXTRAIT du tiers, jamais celui du rappel', async () => {
    const n = niveau(TypeRelance.RELEVE);
    const { svc } = service(n);
    const r = await svc.emettre(DOSSIER, 'u-1', { exerciceId: 'ex-1', niveauId: n.id, compteIds: ['c-41100001'] });
    expect(r.lettres[0].modeleImpression).toBe('Relevé contrat');
    expect(r.lettres[0].texte).toMatch(/^Relevé pour Brasserie du Fleuve \(CLI-001\)\nCher Brasserie du Fleuve,[\s\S]*\nFin du relevé$/);
  });

  it('le relevé de compte imprimé à l’écran reçoit le cadre de l’extrait, coupé autour du tableau', async () => {
    const { svc } = service(niveau(TypeRelance.RELEVE));
    const r = await svc.releve(DOSSIER, 'c-41100001', 'ex-1');
    expect(r.cadre).toEqual({ modele: 'Relevé contrat', avant: 'Relevé pour Brasserie du Fleuve (CLI-001)\n', apres: '\nFin du relevé' });
    const sans = await svc.releve(DOSSIER, 'c-41100002', 'ex-1');
    expect(sans.cadre).toBeNull();
  });
});

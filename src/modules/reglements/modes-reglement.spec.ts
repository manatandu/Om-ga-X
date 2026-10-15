import { NatureModeReglement } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import {
  ENTREE_EN_VIGUEUR_ART_59_BIS,
  MODES_USUELS,
  NATURES_ADMISES_ART_59_BIS,
  PLAFOND_MODES_REGLEMENT,
  avertissementArt59Bis,
  motifRefusIdentiteMode,
  natureLueSurLeCompte,
} from './modes-reglement';
import { ModesReglementService, modeDuDossier } from './modes-reglement.service';

/**
 * MODES DE RÈGLEMENT (ligne sage-l2, fonction 1) · ce que ces tests empêchent ·
 * un paiement en espèces d'une facture de 1 500 000 FC passé sans un mot, alors
 * que l'O.-L. n° 10/001, art. 59 bis et 74 bis, retire la déduction de sa TVA ;
 * un mode d'un autre dossier rattaché par un appel direct ; un mode porté par
 * des lignes supprimé en dénouant le lien.
 */

const base = {
  sens: 'FOURNISSEUR' as const,
  date: new Date('2026-05-10'),
  dossierAssujetti: true as boolean | null,
  nature: NatureModeReglement.ESPECES as NatureModeReglement | null,
  source: 'MODE' as const,
  compte: '40110001',
  factures: [{ reference: 'pièce 12', montant: 1_500_000 }],
};

describe('art. 59 bis · la liste fermée du texte', () => {
  it('chèque, virement et carte bancaire, et eux seuls', () => {
    expect([...NATURES_ADMISES_ART_59_BIS].sort()).toEqual(['CARTE_BANCAIRE', 'CHEQUE', 'VIREMENT']);
  });

  it('une facture de 1 500 000 payée en espèces à un fournisseur · avertie, articles et issue nommés', () => {
    const a = avertissementArt59Bis(base);
    expect(a).toContain('pièce 12');
    expect(a).toContain('art. 59 bis');
    expect(a).toContain('art. 74 bis');
    expect(a).toContain('par espèces');
  });

  it('le seuil se juge au centime · 999 999,99 ne dit rien, 1 000 000 avertit', () => {
    expect(avertissementArt59Bis({ ...base, factures: [{ reference: 'p', montant: 999_999.99 }] })).toBeNull();
    expect(avertissementArt59Bis({ ...base, factures: [{ reference: 'p', montant: 1_000_000 }] })).not.toBeNull();
  });

  it.each([NatureModeReglement.CHEQUE, NatureModeReglement.VIREMENT, NatureModeReglement.CARTE_BANCAIRE])('%s satisfait le texte', (nature) => {
    expect(avertissementArt59Bis({ ...base, nature })).toBeNull();
  });

  it('la monnaie électronique, que le texte ne nomme pas, est avertie', () => {
    expect(avertissementArt59Bis({ ...base, nature: NatureModeReglement.MONNAIE_ELECTRONIQUE })).not.toBeNull();
  });

  it('un CLIENT qui paie en espèces ne coûte rien au dossier · la sanction frappe celui qui déduit', () => {
    expect(avertissementArt59Bis({ ...base, sens: 'CLIENT' })).toBeNull();
  });

  it('un dossier DÉCLARÉ non assujetti n’est pas visé ; sans réponse, il est averti (sous condition)', () => {
    expect(avertissementArt59Bis({ ...base, dossierAssujetti: false })).toBeNull();
    expect(avertissementArt59Bis({ ...base, dossierAssujetti: null })).not.toBeNull();
  });

  it('avant l’entrée en vigueur (27 mai 2013), rien ne se reproche', () => {
    expect(ENTREE_EN_VIGUEUR_ART_59_BIS.toISOString().slice(0, 10)).toBe('2013-05-27');
    expect(avertissementArt59Bis({ ...base, date: new Date('2013-05-26') })).toBeNull();
    expect(avertissementArt59Bis({ ...base, date: new Date('2013-05-27') })).not.toBeNull();
  });

  // RELECTURE « ÉCHECS SILENCIEUX », M3 · ce que la pièce ne dit pas ne
  // s'affirme pas · la pièce à plusieurs lignes est avertie sous condition,
  // l'à-nouveau sans facture retrouvée nommé « seuil non jugé ».
  it('la pièce à plusieurs lignes est avertie SOUS CONDITION, l’à-nouveau sans origine NON JUGÉ', () => {
    const conditionnelle = avertissementArt59Bis({ ...base, factures: [], sousCondition: [{ reference: 'pièce 8', montant: 1_200_000 }] });
    expect(conditionnelle).toMatch(/pièce 8 \(1\s200\s000,00, si ses lignes au compte sont les échéances d’une même facture\)/);
    const nonJugee = avertissementArt59Bis({ ...base, factures: [], nonJugees: [{ reference: 'pièce 1', montant: 3_000_000 }] });
    expect(nonJugee).toContain('facture d’origine non retrouvée');
    expect(nonJugee).toContain('seuil de l’art. 59 bis non jugé');
    expect(nonJugee).not.toMatch(/est une transaction/);
    // Sous le seuil, une pièce conditionnelle ne dit rien.
    expect(avertissementArt59Bis({ ...base, factures: [], sousCondition: [{ reference: 'p', montant: 999_999.99 }] })).toBeNull();
  });

  it('sans mode ni compte qui dise la nature, rien n’est présumé', () => {
    expect(avertissementArt59Bis({ ...base, nature: null })).toBeNull();
  });

  it('la nature se lit sur le compte du journal · 57 espèces, 55 monnaie électronique, 52 rien', () => {
    expect(natureLueSurLeCompte('57110000')).toBe(NatureModeReglement.ESPECES);
    expect(natureLueSurLeCompte('55100000')).toBe(NatureModeReglement.MONNAIE_ELECTRONIQUE);
    expect(natureLueSurLeCompte('52110000')).toBeNull();
    expect(natureLueSurLeCompte(null)).toBeNull();
    expect(avertissementArt59Bis({ ...base, source: 'COMPTE' })).toContain('compte du journal');
  });
});

describe('identité d’un mode', () => {
  it('code court sans espace, intitulé de 35 caractères au plus', () => {
    expect(motifRefusIdentiteMode('CHQ', 'Chèque')).toBeNull();
    expect(motifRefusIdentiteMode('CH Q', 'Chèque')).toContain('sans espace');
    expect(motifRefusIdentiteMode('ABCDEFGHIJK', 'Chèque')).toContain('1 à 10');
    expect(motifRefusIdentiteMode('CHQ', '  ')).toContain('obligatoire');
    expect(motifRefusIdentiteMode('CHQ', 'x'.repeat(36))).toContain('35');
  });
});

type ModeLu = { id: string; tenantId: string; code: string; intitule: string; nature: NatureModeReglement; estActif: boolean; journalId: string | null };

function prismaFactice(modes: ModeLu[], journaux: Array<{ id: string; tenantId: string; code: string; type: string }> = []) {
  const tx = {
    $executeRaw: jest.fn(async () => 1),
    modeReglement: {
      count: jest.fn(async ({ where }: { where: { tenantId: string } }) => modes.filter((m) => m.tenantId === where.tenantId).length),
      findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) => modes.filter((m) => m.tenantId === where.tenantId)),
      create: jest.fn(async ({ data }: { data: Omit<ModeLu, 'id' | 'estActif' | 'journalId'> & { journalId?: string | null } }) => {
        const m = { id: `m${modes.length + 1}`, estActif: true, journalId: data.journalId ?? null, ...data };
        modes.push(m as ModeLu);
        return m;
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    modeReglement: {
      ...tx.modeReglement,
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        modes.find((m) => m.id === where.id && m.tenantId === where.tenantId) ?? null,
      ),
      delete: jest.fn(async () => ({})),
    },
    journal: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        journaux.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null,
      ),
    },
  };
  return prisma;
}

describe('modeDuDossier · le mode désigné par une autre structure', () => {
  const modes: ModeLu[] = [
    { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: NatureModeReglement.CHEQUE, estActif: true, journalId: null },
    { id: 'b', tenantId: 't', code: 'ESP', intitule: 'Espèces', nature: NatureModeReglement.ESPECES, estActif: false, journalId: null },
    { id: 'c', tenantId: 'autre', code: 'VIR', intitule: 'Virement', nature: NatureModeReglement.VIREMENT, estActif: true, journalId: null },
  ];
  const prisma = prismaFactice(modes) as unknown as PrismaService;

  it('le mode d’un autre dossier est introuvable · la clé étrangère ne juge que l’existence', async () => {
    await expect(modeDuDossier(prisma, 't', 'c')).rejects.toThrow('introuvable');
  });

  it('un mode en sommeil ne se pose plus, et le refus dit l’issue', async () => {
    await expect(modeDuDossier(prisma, 't', 'b')).rejects.toThrow('en sommeil');
  });

  it('un mode actif du dossier passe', async () => {
    await expect(modeDuDossier(prisma, 't', 'a')).resolves.toMatchObject({ code: 'CHQ', nature: NatureModeReglement.CHEQUE });
  });
});

describe('ModesReglementService', () => {
  it('le journal proposé est un journal de trésorerie du dossier', async () => {
    const prisma = prismaFactice([], [{ id: 'ach', tenantId: 't', code: 'ACH', type: 'ACHATS' }]);
    const service = new ModesReglementService(prisma as unknown as PrismaService);
    await expect(
      service.creer('t', 'u', { code: 'VIR', intitule: 'Virement', nature: NatureModeReglement.VIREMENT, journalId: 'ach' }),
    ).rejects.toThrow("n'est pas un journal de trésorerie");
  });

  it(`au-delà de ${PLAFOND_MODES_REGLEMENT} modes, refusé · le plafond de Sage, compté sous le verrou du dossier`, async () => {
    const modes: ModeLu[] = Array.from({ length: PLAFOND_MODES_REGLEMENT }, (_, i) => ({
      id: `x${i}`,
      tenantId: 't',
      code: `M${i}`,
      intitule: `Mode ${i}`,
      nature: NatureModeReglement.AUTRE,
      estActif: true,
      journalId: null,
    }));
    const prisma = prismaFactice(modes);
    const service = new ModesReglementService(prisma as unknown as PrismaService);
    await expect(service.creer('t', 'u', { code: 'NEUF', intitule: 'Neuf', nature: NatureModeReglement.AUTRE })).rejects.toThrow(
      String(PLAFOND_MODES_REGLEMENT),
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('les modes usuels · ceux déjà présents ne sont pas recréés, et c’est dit', async () => {
    const modes: ModeLu[] = [
      { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: NatureModeReglement.CHEQUE, estActif: true, journalId: null },
    ];
    const prisma = prismaFactice(modes);
    const service = new ModesReglementService(prisma as unknown as PrismaService);
    const r = await service.creerUsuels('t', 'u');
    expect(r.dejaPresents).toEqual(['Chèque']);
    expect(r.crees).toHaveLength(MODES_USUELS.length - 1);
    expect(modes.filter((m) => m.tenantId === 't')).toHaveLength(MODES_USUELS.length);
  });

  it('un mode porté par une ligne ne se supprime pas · le refus nomme l’usage et renvoie à la mise en sommeil', async () => {
    const modes: ModeLu[] = [
      { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: NatureModeReglement.CHEQUE, estActif: true, journalId: null },
    ];
    const prisma = {
      ...prismaFactice(modes),
      // Les relations vers le mode sont lues dans le schéma (references.ts) ·
      // la doublure compte deux lignes d'écriture, rien ailleurs.
      ligneEcriture: { count: jest.fn(async ({ where }: { where: { modeReglementId: string } }) => (where.modeReglementId === 'a' ? 2 : 0)) },
      tiers: { count: jest.fn(async () => 0) },
      modeleReglement: { count: jest.fn(async () => 0) },
      echeanceReglement: { count: jest.fn(async () => 0) },
    };
    const service = new ModesReglementService(prisma as unknown as PrismaService);
    await expect(service.supprimer('t', 'a')).rejects.toThrow(/lignes d'écriture portant ce mode \(2\).*sommeil/);
    expect(prisma.modeReglement.delete).not.toHaveBeenCalled();
  });
});

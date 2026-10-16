import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException } from '@nestjs/common';
import {
  JETONS_MODELE_IMPRESSION,
  LONGUEUR_TEXTE_MODELE,
  adresseDuTiers,
  cadreDuModele,
  habiller,
  motifRefusAttribution,
  motifRefusIntituleModele,
  motifRefusTexteModele,
  natureDuNiveau,
  type IdentiteDuTiers,
} from './modeles-impression';
import { ModelesImpressionService, cadresDesTiers, modeleDuDossierPourLaZone } from './modeles-impression.service';
import { ModifierModeleImpressionDto } from './dto/modeles-impression.dto';
import { TiersService } from './tiers.service';

/**
 * MODÈLES D'IMPRESSION DU TIERS (ligne sage-l2, fonction 27) · ce qui
 * casserait en silence · un modèle sans {document} (la lettre partirait sans
 * ce qu'elle réclame), un jeton mal écrit imprimé tel quel chez le tiers, un
 * libellé de facture qui écrirait « {tiers} » remplacé dans le document, un
 * modèle d'avis de règlement posé dans la zone du rappel, un modèle choisi
 * par un tiers supprimé sous lui.
 */

const TIERS: IdentiteDuTiers = {
  nom: 'Brasserie du Fleuve',
  code: 'CLI-001',
  qualite: 'Société',
  contact: 'Mme Mbuyi',
  adresse: 'Av. du Commerce 12',
  boitePostale: 'B.P. 1234',
  ville: 'Kinshasa',
  pays: null,
};
const JOUR = new Date('2026-10-15T00:00:00Z');

describe('le texte d’un modèle', () => {
  it('porte {document} une fois et une seule', () => {
    expect(motifRefusTexteModele('Service comptable\n{document}')).toBeNull();
    expect(motifRefusTexteModele('Service comptable')).toMatch(/sans ce qu'elle réclame ou acquitte/);
    expect(motifRefusTexteModele('{document}\n{document}')).toMatch(/une fois et une seule · le document s'imprimerait 2 fois/);
  });

  it('refuse un jeton inconnu, qui s’imprimerait tel quel, et nomme les jetons admis', () => {
    const motif = motifRefusTexteModele('À {contct}\n{document}');
    expect(motif).toMatch(/Jeton inconnu : \{contct\}/);
    for (const j of JETONS_MODELE_IMPRESSION) expect(motif).toContain(`{${j.jeton}}`);
  });

  // RELECTURE « ÉCHECS SILENCIEUX », m7 · la lecture des jetons s'arrêtait aux
  // espaces · « {montant total} » passait, puis s'imprimait tel quel.
  it('refuse tout ce qui est entre accolades sans être un nom admis, espaces et vide compris', () => {
    expect(motifRefusTexteModele('Solde {montant total}\n{document}')).toMatch(/Jeton inconnu : \{montant total\}/);
    expect(motifRefusTexteModele('À { tiers }\n{document}')).toMatch(/Jeton inconnu : \{ tiers \}/);
    expect(motifRefusTexteModele('Vide {}\n{document}')).toMatch(/Jeton inconnu : \{\}/);
  });

  it('est exigé et borné', () => {
    expect(motifRefusTexteModele('   ')).toMatch(/obligatoire/);
    expect(motifRefusTexteModele(`{document}${'x'.repeat(LONGUEUR_TEXTE_MODELE)}`)).toMatch(/au plus/);
  });
});

describe('l’intitulé d’un modèle', () => {
  it('est unique dans sa nature, sans égard à la casse ; le modèle retouché ne se gêne pas lui-même', () => {
    const autres = [{ id: 'a', intitule: 'Contrat cadre' }];
    expect(motifRefusIntituleModele('CONTRAT CADRE', autres, null)).toMatch(/déjà un modèle « Contrat cadre »/);
    expect(motifRefusIntituleModele('Contrat cadre', autres, 'a')).toBeNull();
    expect(motifRefusIntituleModele('', autres, null)).toMatch(/obligatoire/);
  });
});

describe('le cadre et le document', () => {
  const MODELE = { intitule: 'Contrat cadre', texte: 'À l’attention de {contact}\n{tiers} ({code})\n{adresse}\nLe {date}\n\n{document}\n\nRéf. contrat 2026-07 · {entite}' };

  it('remplace les jetons du modèle et coupe au document', () => {
    const cadre = cadreDuModele(MODELE, TIERS, { entite: 'SARL Kin', jour: JOUR });
    expect(cadre.modele).toBe('Contrat cadre');
    expect(cadre.avant).toBe('À l’attention de Mme Mbuyi\nBrasserie du Fleuve (CLI-001)\nAv. du Commerce 12\nB.P. 1234\nKinshasa\nLe 15/10/2026\n\n');
    expect(cadre.apres).toBe('\n\nRéf. contrat 2026-07 · SARL Kin');
  });

  it('le document ne passe jamais par le remplacement · un libellé qui écrit « {tiers} » reste tel quel', () => {
    const cadre = cadreDuModele(MODELE, TIERS, { entite: 'SARL Kin', jour: JOUR });
    const lettre = habiller(cadre, 'Facture {tiers} 2026 · 150 000,00');
    expect(lettre).toContain('Facture {tiers} 2026 · 150 000,00');
    expect(lettre.startsWith('À l’attention de Mme Mbuyi')).toBe(true);
  });

  it('sans modèle, le document part tel qu’OmegaX le compose', () => {
    expect(habiller(null, 'Cher client')).toBe('Cher client');
  });

  it('l’adresse saute les éléments vides', () => {
    expect(adresseDuTiers({ adresse: ' Av. 1 ', boitePostale: null, ville: '', pays: 'RD Congo' })).toBe('Av. 1\nRD Congo');
  });
});

describe('la nature', () => {
  it('le relevé est l’extrait du compte ; la préventive et le rappel sont des rappels', () => {
    expect(natureDuNiveau('RELEVE')).toBe('EXTRAIT');
    expect(natureDuNiveau('RAPPEL')).toBe('RAPPEL');
    expect(natureDuNiveau('PREVENTIVE')).toBe('RAPPEL');
  });

  it('un modèle se choisit dans la zone de sa nature', () => {
    expect(motifRefusAttribution('RAPPEL', { intitule: 'Avis', nature: 'RAPPEL' })).toBeNull();
    expect(motifRefusAttribution('RAPPEL', { intitule: 'Avis', nature: 'REGLEMENT' })).toBe(
      'Le modèle « Avis » habille l’avis de règlement, pas le rappel · choisissez un modèle de cette nature.',
    );
  });
});

describe('la porte', () => {
  it('le texte et l’intitulé ne s’effacent pas par null', async () => {
    const erreurs = await validate(plainToInstance(ModifierModeleImpressionDto, { texte: null }));
    expect(erreurs.map((e) => Object.values(e.constraints ?? {})).flat()).toContain("Le texte du modèle ne s'efface pas.");
  });
});

describe('le service', () => {
  function monter(existants: Array<{ id: string; nature: 'EXTRAIT' | 'REGLEMENT' | 'RAPPEL'; intitule: string; tenantId?: string }> = []) {
    const ecrit = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'nouveau', ...data }));
    const tx = {
      $executeRaw: jest.fn(async () => 0),
      modeleImpressionTiers: {
        count: jest.fn(async () => existants.length),
        findMany: jest.fn(async ({ where }: { where: { nature: string } }) => existants.filter((m) => m.nature === where.nature)),
        create: ecrit,
        update: ecrit,
      },
    };
    const prisma = {
      modeleImpressionTiers: {
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
          existants.find((m) => m.id === where.id && (m.tenantId ?? 'd') === where.tenantId) ?? null,
        ),
        delete: jest.fn(),
      },
      tiers: { count: jest.fn(async () => 0) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { service: new ModelesImpressionService(prisma as never), ecrit, prisma, tx };
  }

  it('refuse un texte sans {document} AVANT toute écriture', async () => {
    const { service, ecrit } = monter();
    await expect(service.creer('d', 'u', { nature: 'RAPPEL', intitule: 'Contrat', texte: 'Bonjour' })).rejects.toThrow(/sans ce qu'elle réclame/);
    expect(ecrit).not.toHaveBeenCalled();
  });

  it('refuse un intitulé déjà pris dans la nature, sous le verrou du dossier ; le même intitulé passe dans une autre nature', async () => {
    const { service, ecrit, tx } = monter([{ id: 'a', nature: 'RAPPEL', intitule: 'Contrat' }]);
    await expect(service.creer('d', 'u', { nature: 'RAPPEL', intitule: ' contrat ', texte: '{document}' })).rejects.toThrow(/déjà un modèle « Contrat »/);
    expect(tx.$executeRaw).toHaveBeenCalled();
    await service.creer('d', 'u', { nature: 'EXTRAIT', intitule: 'Contrat', texte: '{document}' });
    expect(ecrit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'd', nature: 'EXTRAIT', intitule: 'Contrat', createdBy: 'u' }) }));
  });

  it('un modèle choisi par un tiers ne se supprime pas, et le refus dit le geste qui le lève', async () => {
    const { service, prisma } = monter([{ id: 'a', nature: 'RAPPEL', intitule: 'Contrat' }]);
    prisma.tiers.count.mockResolvedValue(2);
    const refus = service.supprimer('d', 'a');
    await expect(refus).rejects.toBeInstanceOf(ConflictException);
    await expect(service.supprimer('d', 'a')).rejects.toThrow(/tiers \(modèle du rappel\) \(2\).*sur la fiche de ces tiers/);
    expect(prisma.modeleImpressionTiers.delete).not.toHaveBeenCalled();
  });

  it('le modèle d’un autre dossier est introuvable', async () => {
    const { service } = monter([{ id: 'a', nature: 'RAPPEL', intitule: 'Contrat', tenantId: 'autre' }]);
    await expect(service.supprimer('d', 'a')).rejects.toThrow(/introuvable/);
  });
});

describe('le modèle choisi sur la fiche', () => {
  const lecteur = (modele: { id: string; intitule: string; nature: 'EXTRAIT' | 'REGLEMENT' | 'RAPPEL'; tenantId: string } | null) => ({
    modeleImpressionTiers: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        modele && modele.id === where.id && modele.tenantId === where.tenantId ? modele : null,
      ),
    },
  });

  it('du dossier, et de la nature de sa zone', async () => {
    const modele = { id: 'm', intitule: 'Avis', nature: 'REGLEMENT' as const, tenantId: 'd' };
    await expect(modeleDuDossierPourLaZone(lecteur(modele) as never, 'd', 'm', 'REGLEMENT')).resolves.toEqual(modele);
    await expect(modeleDuDossierPourLaZone(lecteur(modele) as never, 'd', 'm', 'RAPPEL')).rejects.toThrow(/habille l’avis de règlement, pas le rappel/);
    await expect(modeleDuDossierPourLaZone(lecteur(modele) as never, 'autre', 'm', 'REGLEMENT')).rejects.toThrow(/introuvable/);
  });

  it('le câblage · la fiche refuse un modèle de l’autre nature AVANT d’écrire', async () => {
    const update = jest.fn();
    const prisma = {
      ...lecteur({ id: 'm', intitule: 'Avis', nature: 'REGLEMENT', tenantId: 'd' }),
      tiers: { findFirst: jest.fn(async () => ({ id: 't1', tenantId: 'd', comptesRattaches: [] })), update },
    };
    await expect(new TiersService(prisma as never).modifier('d', 't1', { modeleImpressionRappelId: 'm' })).rejects.toThrow(/pas le rappel/);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('les cadres d’un lot de tiers', () => {
  function lecteur(tiers: Array<Partial<Record<string, string | null>> & { id: string }>, modeles: Array<{ id: string; nature: string; intitule: string; texte: string }>) {
    const lireModeles = jest.fn(async ({ where }: { where: { tenantId: string; nature: string; id: { in: string[] } } }) =>
      modeles.filter((m) => m.nature === where.nature && where.id.in.includes(m.id)),
    );
    return {
      lireModeles,
      prisma: {
        tiers: {
          findMany: jest.fn(async ({ where }: { where: { tenantId: string; id: { in: string[] } } }) =>
            tiers.filter((t) => where.id.in.includes(t.id)).map((t) => ({ ...TIERS, modeleImpressionExtraitId: null, modeleImpressionReglementId: null, modeleImpressionRappelId: null, ...t })),
          ),
        },
        modeleImpressionTiers: { findMany: lireModeles },
      },
    };
  }

  it('chaque tiers reçoit le modèle de SA zone, en deux lectures pour le lot', async () => {
    const { prisma, lireModeles } = lecteur(
      [
        { id: 't1', modeleImpressionRappelId: 'r1', modeleImpressionExtraitId: 'e1' },
        { id: 't2' },
      ],
      [
        { id: 'r1', nature: 'RAPPEL', intitule: 'Rappel contrat', texte: 'Réf. A\n{document}' },
        { id: 'e1', nature: 'EXTRAIT', intitule: 'Extrait contrat', texte: '{document}' },
      ],
    );
    const cadres = await cadresDesTiers(prisma as never, 'd', ['t1', 't2', 't1'], 'RAPPEL', { entite: 'SARL Kin', jour: JOUR });
    expect([...cadres.keys()]).toEqual(['t1']);
    expect(cadres.get('t1')).toEqual({ modele: 'Rappel contrat', avant: 'Réf. A\n', apres: '' });
    expect(lireModeles).toHaveBeenCalledTimes(1);
    expect(prisma.tiers.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'd', id: { in: ['t1', 't2'] } } }));
  });

  it('le cadre par défaut d’un document vaut pour le tiers sans modèle, jamais à la place du sien', async () => {
    const { prisma } = lecteur(
      [{ id: 't1', modeleImpressionReglementId: 'a1' }, { id: 't2' }],
      [{ id: 'a1', nature: 'REGLEMENT', intitule: 'Avis groupe', texte: 'Groupe Kin\n{document}' }],
    );
    const cadres = await cadresDesTiers(prisma as never, 'd', ['t1', 't2'], 'REGLEMENT', { entite: 'SARL Kin', jour: JOUR }, '{tiers}\n{document}');
    expect(cadres.get('t1')?.modele).toBe('Avis groupe');
    expect(cadres.get('t2')).toEqual({ modele: null, avant: 'Brasserie du Fleuve\n', apres: '' });
  });
});

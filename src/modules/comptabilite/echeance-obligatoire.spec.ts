import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { TypeJournal } from '@prisma/client';
import { exigeUneEcheance, lignesSansEcheance, motifEcheanceManquante } from './echeance-obligatoire';
import { EcritureService } from './ecriture.service';

/**
 * Ligne gl-saisie, fonction 2 · l'échéance obligatoire sur la ligne d'une
 * facture de tiers, option du dossier.
 */
describe('échéance obligatoire · la ligne jugée', () => {
  const ACHATS = TypeJournal.ACHATS;

  it('la facture du fournisseur (crédit au 40) et celle du client (débit au 41) exigent une échéance', () => {
    expect(exigeUneEcheance({ numero: '40110001', credit: 116000 }, ACHATS)).toBe(true);
    expect(exigeUneEcheance({ numero: '41110001', debit: 116000 }, TypeJournal.VENTES)).toBe(true);
  });

  it('un avoir, un règlement, une charge, une avance ou une facture non parvenue n’en exigent pas', () => {
    expect(exigeUneEcheance({ numero: '40110001', debit: 116000 }, ACHATS)).toBe(false);
    expect(exigeUneEcheance({ numero: '60110000', debit: 100000 }, ACHATS)).toBe(false);
    for (const n of ['40810000', '40910000', '41810000', '41910000', '41610000']) {
      expect(exigeUneEcheance({ numero: n, debit: 1, credit: 1 }, ACHATS)).toBe(false);
    }
  });

  it('un journal de trésorerie enregistre un règlement · rien n’y est exigé', () => {
    expect(exigeUneEcheance({ numero: '41110001', debit: 50000 }, TypeJournal.TRESORERIE)).toBe(false);
  });

  it('le refus nomme chaque compte une fois, et l’issue', () => {
    const lignes = [
      { numero: '60110000', debit: 100000 },
      { numero: '40110001', credit: 60000 },
      { numero: '40110001', credit: 40000 },
      { numero: '40110002', credit: 10000, dateEcheance: '2026-12-31' },
    ];
    expect(lignesSansEcheance(lignes, ACHATS)).toEqual(['40110001', '40110001']);
    const motif = motifEcheanceManquante(lignes, ACHATS) ?? '';
    expect(motif).toContain('40110001');
    expect(motif).not.toContain('40110002');
    expect(motif).toContain('Paramètres du dossier');
    expect(motifEcheanceManquante([{ numero: '40110002', credit: 1, dateEcheance: '2026-12-31' }], ACHATS)).toBeNull();
  });
});

describe('échéance obligatoire · le service', () => {
  function service(option: boolean, typeJournal: TypeJournal = TypeJournal.ACHATS) {
    const prisma = {
      tenant: { findFirst: jest.fn().mockResolvedValue({ echeanceObligatoireTiers: option }) },
      journal: { findFirst: jest.fn().mockResolvedValue({ type: typeJournal }) },
      compte: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c401', numero: '40110001' },
          { id: 'c601', numero: '60110000' },
        ]),
      },
    };
    const svc = Object.create(EcritureService.prototype) as EcritureService;
    (svc as unknown as { prisma: unknown }).prisma = prisma;
    return { svc, prisma };
  }
  const lignes = [
    { compteId: 'c601', debit: 100000 },
    { compteId: 'c401', credit: 100000 },
  ];

  it('option fermée · rien n’est lu au-delà du dossier, rien n’est refusé', async () => {
    const { svc, prisma } = service(false);
    await expect(svc.verifierEcheancesObligatoires('t1', lignes, { journalId: 'j1' })).resolves.toBeUndefined();
    expect(prisma.compte.findMany).not.toHaveBeenCalled();
  });

  it('option ouverte · la facture sans échéance est refusée en 400 nommé, celle qui la porte passe', async () => {
    const { svc } = service(true);
    await expect(svc.verifierEcheancesObligatoires('t1', lignes, { journalId: 'j1' })).rejects.toThrow(BadRequestException);
    await expect(
      svc.verifierEcheancesObligatoires('t1', [lignes[0], { ...lignes[1], dateEcheance: '2026-12-31' }], { journalId: 'j1' }),
    ).resolves.toBeUndefined();
  });

  it('à la modification, le journal est celui de la pièce, lu dans le dossier', async () => {
    const { svc, prisma } = service(true, TypeJournal.TRESORERIE);
    await expect(svc.verifierEcheancesObligatoires('t1', lignes, { ecritureId: 'e1' })).resolves.toBeUndefined();
    expect(prisma.journal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', ecritures: { some: { id: 'e1', tenantId: 't1' } } } }),
    );
  });
});

describe('échéance obligatoire · le câblage', () => {
  const source = readFileSync(join(__dirname, 'ecriture.controller.ts'), 'utf8');
  function corps(nom: string): string {
    const debut = source.indexOf(`async ${nom}(`);
    const fin = source.indexOf('\n  }\n', debut);
    return source.slice(debut, fin);
  }
  it('la création et la modification du brouillard la jugent, au contrôleur', () => {
    expect(corps('creer')).toContain('verifierEcheancesObligatoires(user.tenantId, dto.lignes, { journalId: dto.journalId })');
    expect(corps('modifier')).toContain('verifierEcheancesObligatoires(user.tenantId, dto.lignes, { ecritureId: id })');
  });
});

// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  corpsReglement,
  duDesFactures,
  ETAPES_REGLEMENT,
  manqueDeLEtape,
  nomDuTiers,
  saisieEnchainee,
  saisieVierge,
  type SaisieReglement,
  type TiersARegler,
} from './assistant-reglement';

/**
 * L'ASSISTANT DE RÈGLEMENT (ligne sage-l2, fonction 18) · ce qui casserait en
 * silence · un corps qui ne serait plus celui que le serveur lit (le
 * règlement partirait sans un champ, ou serait refusé en entier par la liste
 * blanche), un montant tapé avec ses espaces lu faux, une facture en devise
 * réglée en francs sans cours ni écart de change, un ordre de virement pour
 * un client.
 */
const TIERS: TiersARegler = {
  compteId: 'c-401',
  numero: '40110001',
  intitule: 'Fournisseur',
  tiers: 'FRS-01 · Imprimerie du Fleuve',
  lignes: [
    { id: 'l1', echeance: '2026-03-31', date: '2026-03-01', libelle: 'Facture 1', montant: 1_160_000 },
    { id: 'l2', echeance: '2026-04-30', date: '2026-04-01', libelle: 'Facture 2', montant: 500_000.5 },
    { id: 'l3', echeance: '2026-05-31', date: '2026-05-01', libelle: 'Facture USD', montant: 2_800_000, deviseId: 'usd', deviseCode: 'USD' },
  ],
};
const saisie = (x: Partial<SaisieReglement> = {}): SaisieReglement => ({ ...saisieVierge('2026-10-15'), ...x });

describe('les étapes', () => {
  it('six, dans l’ordre de Sage · sens, trésorerie, tiers, factures, montant, récapitulatif', () => {
    expect(ETAPES_REGLEMENT.map((e) => e.cle)).toEqual(['sens', 'tresorerie', 'tiers', 'factures', 'montant', 'recapitulatif']);
  });

  it('chaque étape ne dit que ce qui manque', () => {
    expect(manqueDeLEtape('tresorerie', saisie(), null)).toMatch(/journal de trésorerie/);
    expect(manqueDeLEtape('tresorerie', saisie({ journalId: 'bq', date: '' }), null)).toMatch(/date/);
    expect(manqueDeLEtape('tiers', saisie({ compteId: 'c-401' }), null)).toMatch(/tiers/);
    expect(manqueDeLEtape('factures', saisie({ compteId: 'c-401' }), TIERS)).toMatch(/au moins une facture/);
    expect(manqueDeLEtape('factures', saisie({ ligneIds: ['l1'] }), TIERS)).toBeNull();
    expect(manqueDeLEtape('montant', saisie({ montant: '0' }), TIERS)).toMatch(/positif/);
    expect(manqueDeLEtape('montant', saisie({ montant: '1 160 000,50' }), TIERS)).toBeNull();
  });

  it('une facture en devise renvoie au formulaire complet, qui seul en tient le cours et l’écart', () => {
    expect(manqueDeLEtape('factures', saisie({ ligneIds: ['l1', 'l3'] }), TIERS)).toMatch(/« Facture USD » est en USD .* formulaire Règlement des tiers/);
  });
});

describe('le corps', () => {
  it('est celui du formulaire · un tiers, ses factures, le montant lu avec ses espaces', () => {
    const corps = corpsReglement(saisie({ journalId: 'bq', compteId: 'c-401', ligneIds: ['l1', 'l2'], montant: '1 660 000,50', reference: ' VIR-9 ', modeReglementId: 'vir', ordreVirement: true }), 'ex-1', true);
    expect(corps).toEqual({
      sens: 'FOURNISSEUR',
      exerciceId: 'ex-1',
      journalId: 'bq',
      date: '2026-10-15',
      modeReglementId: 'vir',
      ordreVirement: true,
      reglements: [{ compteId: 'c-401', ligneIds: ['l1', 'l2'], montant: 1_660_000.5, reference: 'VIR-9' }],
    });
  });

  it('jamais d’ordre de virement pour un client, ni pour un dossier qui ne le sert pas', () => {
    expect(corpsReglement(saisie({ sens: 'CLIENT', ordreVirement: true }), 'ex-1', true)).not.toHaveProperty('ordreVirement');
    expect(corpsReglement(saisie({ ordreVirement: true }), 'ex-1', false)).not.toHaveProperty('ordreVirement');
  });

  it('chaque champ envoyé est un champ que le DTO du serveur connaît', () => {
    const dto = readFileSync(join(__dirname, '../../../src/modules/reglements/reglements.dto.ts'), 'utf8');
    const corps = corpsReglement(saisie({ journalId: 'bq', compteId: 'c', ligneIds: ['l1'], montant: '1', reference: 'R', modeReglementId: 'm', ordreVirement: true }), 'ex', true);
    for (const cle of [...Object.keys(corps), ...Object.keys(corps.reglements[0])]) expect([cle, new RegExp(`\\n  ${cle}[!?]:`).test(dto)]).toEqual([cle, true]);
  });
});

describe('le dû, le nom, l’enchaînement', () => {
  it('le dû des factures choisies, au centime', () => {
    expect(duDesFactures(TIERS, ['l1', 'l2'])).toBe(1_660_000.5);
    expect(duDesFactures(null, ['l1'])).toBe(0);
  });

  it('le tiers se nomme par son compte et sa fiche', () => {
    expect(nomDuTiers(TIERS)).toBe('40110001 · FRS-01 · Imprimerie du Fleuve');
    expect(nomDuTiers({ ...TIERS, tiers: null })).toBe('40110001 · Fournisseur');
  });

  it('régler un autre tiers garde la séance, vide le tiers', () => {
    const suite = saisieEnchainee(saisie({ journalId: 'bq', modeReglementId: 'vir', ordreVirement: true, compteId: 'c', ligneIds: ['l1'], montant: '10', reference: 'R' }));
    expect(suite).toEqual(saisie({ journalId: 'bq', modeReglementId: 'vir', ordreVirement: true }));
  });
});

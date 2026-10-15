import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpsDuLieu, LIEU_VIDE, saisieDuLieu, type LieuLivraison } from './lieux-livraison';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LIEUX DE LIVRAISON À L'ÉCRAN (ligne sage-l2, fonction 31) · un courriel
 * vide envoyé « » serait refusé comme invalide ; un champ que le DTO du
 * serveur ne connaît pas ferait refuser tout le corps (whitelist).
 */
describe('le corps d’un lieu', () => {
  it('les champs vides partent null, l’intitulé tel quel', () => {
    expect(corpsDuLieu({ ...LIEU_VIDE, intitule: ' Siège ', ville: ' Kinshasa ', email: '  ' })).toEqual({
      intitule: ' Siège ',
      adresse: null,
      complement: null,
      boitePostale: null,
      ville: 'Kinshasa',
      pays: null,
      contact: null,
      telephone: null,
      email: null,
    });
  });

  it('un lieu existant remplit le formulaire, null en champ vide', () => {
    const l = { id: 'a', intitule: 'Siège', adresse: null, complement: null, boitePostale: null, ville: 'Goma', pays: null, contact: null, telephone: null, email: null, estPrincipal: true, estActif: true } as LieuLivraison;
    expect(saisieDuLieu(l)).toEqual({ ...LIEU_VIDE, intitule: 'Siège', ville: 'Goma' });
  });

  it('chaque champ du corps est un champ du DTO du serveur', () => {
    const dto = readFileSync(join(__dirname, '../../../src/modules/tiers/dto/lieux-livraison.dto.ts'), 'utf8');
    for (const k of Object.keys(LIEU_VIDE)) expect(dto).toMatch(new RegExp(`\\b${k}[!?]:`));
  });
});

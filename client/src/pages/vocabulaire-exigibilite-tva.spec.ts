import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LIGNE TVA 24-26 · LE FAIT GÉNÉRATEUR FAIT NAÎTRE LA TAXE, L'EXIGIBILITÉ DIT
 * QUAND L'ADMINISTRATION PEUT LA RÉCLAMER (O.-L. n° 10/001, art. 24 et 25).
 * Une prestation exécutée et non encaissée porte une taxe NÉE et pas encore
 * EXIGIBLE · les écrans disaient « pas due » et « taxe due au règlement ». On
 * gèle ce que les écrans disent désormais, jamais l'absence d'un mot.
 */
const declaration = readFileSync(join(__dirname, 'DeclarationTvaPage.tsx'), 'utf8');
const parametres = readFileSync(join(__dirname, 'ParametresDossierPage.tsx'), 'utf8');

describe('vocabulaire de l’exigibilité de la TVA', () => {
  it('la déclaration dit « pas encore exigible » et nomme les encaissements à imputer', () => {
    expect(declaration).toContain('TVA facturée sur la période, pas encore exigible');
    expect(declaration).toContain('tvaEnAttenteImputationIndeterminee');
    expect(declaration).toContain('titre="TVA pas encore exigible"');
  });

  it('le paramètre du dossier dit « exigible », et son aide dit qu’au SYSCOHADA la nature lue à la contrepartie commande', () => {
    expect(parametres).toContain('Livraisons · taxe exigible à la date de la facture');
    expect(parametres).toContain('Encaissements · taxe exigible à l’encaissement');
    expect(parametres).toContain('Au SYSCOHADA, OmegaX lit la nature de chaque opération sur sa contrepartie');
    expect(parametres).toContain('il ne sert que de repli');
  });
});

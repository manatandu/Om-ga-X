import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aucun import de « vitest » · convention du dépôt, le spec lit une source.

/**
 * LE TEXTE DE L'INSCRIPTION EST CELUI DU DOSSIER (passe D3, A1 et B2). La bulle
 * d'aide servait « SYCEBNL art. 20 » à toute société · une SARL lisait qu'un
 * texte qui ne la régit pas lui imposait l'inscription. Le serveur sert le
 * fondement (`fondementInscription`), l'écran le montre.
 */
const page = readFileSync(join(__dirname, 'MandatAuditeurPage.tsx'), 'utf8');

describe('Mandat du contrôleur · l’écran lit ce que le serveur sert', () => {
  it('la bulle de l’inscription cite le fondement servi', () => {
    expect(page).toContain('source={fondement.source}');
  });

  it('l’organe que la SA ne connaît pas est dit et bloque l’envoi (art. 703)', () => {
    expect(page).toContain('{duree.organeRefuse}');
    expect(page).toContain('disabled={Boolean(duree?.organeRefuse)');
  });

  it('le rang n’est envoyé que saisi par le cabinet, et le rang retenu par le serveur est affiché', () => {
    // Compté à l'écran d'après le NOM, quand le serveur le compte sur
    // l'INSCRIPTION au tableau, il faisait refuser un enregistrement juste.
    const debut = page.indexOf('async function enregistrer()');
    const corps = page.slice(debut, page.indexOf('async function', debut + 10));
    expect(corps).toContain("...(rangSaisi.trim() ? { rang: Number(rangSaisi) } : {})");
    expect(corps).not.toMatch(/rang:\s*mandats/);
    expect(corps).toContain('setRangRetenu(cree.rang)');
    expect(page).toContain('Mandat enregistré au rang {rangRetenu}.');
  });

  it('le remplacement et le suppléant se déclarent avec le mandat continué (art. 706 et 728)', () => {
    expect(page).toContain("natureSuccession: succession, mandatOrigineId");
  });
});

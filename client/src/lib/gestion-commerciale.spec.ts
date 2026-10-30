import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireNombre, montantHTPropose, roleExigePour, ROLES_COLLABORATEUR } from './gestion-commerciale';

describe('gestion commerciale · aides de l’écran (ligne commercial-l8)', () => {
  it('le montant HT proposé est quantité × prix net, au centime', () => {
    expect(montantHTPropose(2, 27_000)).toBe(54_000);
    expect(montantHTPropose(3, 0.335)).toBe(1.01);
  });
  it('« 500.000 » est ambigu, vide efface', () => {
    expect(lireNombre('500.000')).toBeUndefined();
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('1 500,25')).toBe(1500.25);
  });
  it('le rôle exigé du représentant et la liste des rôles sont ceux du serveur, en miroir', () => {
    const serveur = readFileSync(join(__dirname, '..', '..', '..', 'src', 'modules', 'commercial', 'collaborateurs.ts'), 'utf8');
    expect(serveur).toContain(`export const ROLES_COLLABORATEUR = [${ROLES_COLLABORATEUR.map((r) => `'${r}'`).join(', ')}] as const;`);
    expect([roleExigePour('CLIENT'), roleExigePour('ADHERENT'), roleExigePour('FOURNISSEUR'), roleExigePour('SALARIE')]).toEqual(['vendeur', 'vendeur', 'acheteur', null]);
  });
});

describe('fonction 25 · la devise proposée en saisie ne suit pas un autre compte', () => {
  it('choisirCompte propose la devise habituelle et retire celle qu’il avait proposée', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'SaisiePage.tsx'), 'utf8');
    const corps = page.slice(page.indexOf('const choisirCompte = (c: Compte) => {'), page.indexOf('const focusMontantConseille'));
    expect(corps).toContain('devisesDesComptes?.get(c.id)');
    expect(corps).toContain("choisirDevise('');");
    expect(corps).toContain('choisirDevise(habituelle.deviseId)');
    expect(page).toContain("'/tiers/devises-des-comptes'");
  });
});

describe('relecture indépendante · la taxe suit sa base, le compte des articles se propose', () => {
  it('M1 · taux × HT au centime, vide sans taux ou non imposable', async () => {
    const { taxeProposee } = await import('./gestion-commerciale');
    expect(taxeProposee(54_000, 16, true)).toBe(8_640);
    expect(taxeProposee(333.33, 16, true)).toBe(53.33);
    expect(taxeProposee(54_000, 16, false)).toBe('');
    expect(taxeProposee(54_000, '', true)).toBe('');
  });
  it('M1 · l’écran repropose la taxe à chaque changement de base, de taux ou d’exonération', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'FacturationPage.tsx'), 'utf8');
    expect(page).toContain('setMontantTva(taxeProposee(montantHT, tauxApplique, imposable));');
    expect(page).toContain('}, [montantHT, tauxApplique, imposable]);');
    // mineur 5 · la réponse périmée est jetée, le tarif relu au changement de client.
    expect(page).toContain('if (jeton !== jetonArticle.current) return;');
    expect(page).toContain('if (articleId) void choisirArticle(articleId, tiersId);');
  });
  it('mineur 9 · le compte commun à toutes les lignes, sinon aucun', async () => {
    const { compteDesArticles } = await import('./gestion-commerciale');
    const articles = [
      { id: 'a', compteVenteId: 'k7', compteAchatId: 'k6' },
      { id: 'b', compteVenteId: 'k7', compteAchatId: null },
      { id: 'c', compteVenteId: 'k8', compteAchatId: null },
    ];
    expect(compteDesArticles('VENTE', [{ articleId: 'a' }, { articleId: 'b' }], articles)).toBe('k7');
    expect(compteDesArticles('VENTE', [{ articleId: 'a' }, { articleId: 'c' }], articles)).toBeNull();
    expect(compteDesArticles('VENTE', [{ articleId: 'a' }, { articleId: null }], articles)).toBeNull();
    expect(compteDesArticles('ACHAT', [{ articleId: 'b' }], articles)).toBeNull();
  });
});

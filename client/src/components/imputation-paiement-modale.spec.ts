// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RELECTURE DU 2026-10-07, M2 · l'imputation déclarée d'un paiement a sa
 * fenêtre, ouverte depuis le groupe de lettrage d'une ligne au 40 ou au 41.
 * Tout est servi par le serveur (groupe, imputation retenue, déclarées) ;
 * déclarer et retirer sont au comptable, comme au serveur.
 */
const modale = readFileSync(join(__dirname, 'ImputationPaiementModale.tsx'), 'utf8');
const lettrage = readFileSync(join(__dirname, '../pages/LettragePage.tsx'), 'utf8');

describe('M2 · la fenêtre de l’imputation des paiements', () => {
  it('lit le groupe sur le serveur, jamais recalculé à l’écran', () => {
    expect(modale).toContain('api.get<GroupeImputation>(`/imputations-paiements/groupe/${ligneId}`)');
    expect(modale).not.toMatch(/imputerPaiements|art154|prorata\(/);
  });

  it('déclare et retire par les routes du serveur, au comptable seulement', () => {
    expect(modale).toContain("api.post<{ liquidation?: { message: string } | null }>('/imputations-paiements', {");
    expect(modale).toContain('`/imputations-paiements/${retrait.paiementId}/retirer`');
    expect(modale).toContain('const peutDeclarer = peutEcrire && peutValider;');
    expect(modale).toContain('{peutDeclarer && p.designable && p.validee && (');
    // La facture se désigne par la ligne que le serveur nomme (le report pour une facture de N).
    expect(modale).toContain('factures.push({ ligneFactureId: f.ligneADesigner, montant: v });');
    // L'effet sur une période liquidée se dit, tel que le serveur l'écrit.
    expect(modale).toContain('r?.liquidation?.message');
  });

  it('second tour · pourquoi un paiement ne se déclare pas d’ici est la phrase du serveur (report, exercice clôturé, autre groupe)', () => {
    expect(modale).toContain('motifNonDesignable?: string;');
    expect(modale).toContain('{p.motifNonDesignable ?? "Paiement d\'un autre groupe, lu avec son report · il se déclare depuis son groupe."}');
    // Le groupe que le moteur lit en bloc est dit par le serveur, et rien ne s'y déclare.
    expect(modale).toContain('{groupe.nonServi && <div className="text-text-dim">{groupe.nonServi}</div>}');
  });

  it('s’ouvre depuis le groupe d’une ligne au 40 ou au 41 de l’interrogation', () => {
    expect(lettrage).toContain("{l.lettrageId && compte && /^4[01]/.test(compte.numero) && (");
    expect(lettrage).toContain('<ImputationPaiementModale ligneId={imputationLigne} onFermer={() => setImputationLigne(null)} />');
  });
});

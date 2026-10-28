import { dateLue, detentionsLisiblesPar, salarieRetenu } from './detention-bien';
import { ongletPermis } from './onglets-immobilisations';

describe('détenteur d’un bien · côté écran (ligne Microfina M4)', () => {
  it('le volet suit le serveur · ni l’aide-comptable ni le gestionnaire de paie', () => {
    expect(detentionsLisiblesPar('ADMIN_CABINET')).toBe(true);
    expect(detentionsLisiblesPar('COMPTABLE')).toBe(true);
    expect(detentionsLisiblesPar('LECTURE_SEULE')).toBe(true);
    expect(detentionsLisiblesPar('AIDE_COMPTABLE')).toBe(false);
    expect(detentionsLisiblesPar('GESTIONNAIRE_PAIE')).toBe(false);
    expect(detentionsLisiblesPar(undefined)).toBe(false);
  });

  it('un onglet Détenteurs mémorisé retombe sur Biens pour qui ne le lit pas', () => {
    expect(ongletPermis('detenteurs', true, false)).toBe('biens');
    expect(ongletPermis('detenteurs', false, true)).toBe('detenteurs');
  });

  it('une date absente se dit, jamais par un vide', () => {
    expect(dateLue('2026-03-01')).toBe('01/03/2026');
    expect(dateLue(null)).toBe('·');
  });
});

describe('le volet Détenteur ne se redessine pas sans fin', () => {
  it('le rappel de la fiche passe par une référence, jamais en dépendance de l’effet', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, '../components/DetentionsBiens.tsx'), 'utf8');
    expect(source).toContain('useEffect(() => surEtat.current?.({ occupe, nonEnregistre }), [occupe, nonEnregistre]);');
    expect(source).not.toContain('onEtatTravail]');
  });

  it('m9 · la fiche reçoit l’état de travail du volet, saisie entamée comprise (fermeture gardée, F177)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fiche = readFileSync(join(__dirname, '../components/FicheImmobilisation.tsx'), 'utf8');
    expect(fiche).toContain('<DetenteurImmobilisation bien={bien} onFait={onFait} onEtatTravail={setTravail} />');
    const source = readFileSync(join(__dirname, '../components/DetentionsBiens.tsx'), 'utf8');
    expect(source).toMatch(/const nonEnregistre =\s*\(geste !== null/);
  });

  it('m6, m7, m8 · lieu remis à zéro, historique relu après un refus, réponse rattachée au reçu', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, '../components/DetentionsBiens.tsx'), 'utf8');
    const ouvrir = source.slice(source.indexOf('const ouvrir = '), source.indexOf('const envoyer = '));
    expect(ouvrir).toContain("setLieuId('')");
    const envoyer = source.slice(source.indexOf('const envoyer = '), source.indexOf('const annuler = '));
    expect(envoyer.slice(envoyer.indexOf('catch (err)'))).toContain('charger();');
    const declarer = source.slice(source.indexOf('const declarer = '), source.indexOf('if (erreur && !recu)'));
    expect(declarer).toContain('if (recuCourant.current === vise) setRecu(r);');
  });
});

describe('m5 · le salarié choisi suit la date', () => {
  it('vidé s’il n’est plus sous contrat à la nouvelle date, présélectionné s’il est seul', () => {
    expect(salarieRetenu('s-1', [{ id: 's-1' }, { id: 's-2' }])).toBe('s-1');
    expect(salarieRetenu('s-1', [{ id: 's-2' }, { id: 's-3' }])).toBe('');
    expect(salarieRetenu('s-1', [{ id: 's-2' }])).toBe('s-2');
    expect(salarieRetenu('', [])).toBe('');
  });
});

import { avisRappelSuppression } from './courriel-rappel';
import { JOURS_CONSERVATION_ESSAI } from './essais-echus';

/**
 * LE RAPPEL DIT CE QUE LE CODE FAIT, ET RIEN DE PLUS · la date de suppression
 * du calendrier, la voie d'exportation de l'écran, la trace des sauvegardes.
 * Il ne porte ni secret, ni nom du dossier, ni caractère interdit du dépôt.
 */
const avis = avisRappelSuppression({ termeLe: new Date('2026-01-31T00:00:00Z'), supprimableLe: new Date('2026-07-31T00:00:00Z') });

describe('le courriel de rappel avant suppression', () => {
  it('annonce la date de suppression et le terme de l’essai en toutes lettres', () => {
    expect(avis.sujet).toContain('31 juillet 2026');
    expect(avis.corps).toContain('31 janvier 2026');
    expect(avis.corps).toContain('31 juillet 2026');
  });

  it('dit les cent quatre-vingts jours de conservation avec le nombre du calendrier', () => {
    expect(avis.corps).toContain(`${JOURS_CONSERVATION_ESSAI} jours après la fin de l'essai`);
  });

  it('rappelle comment exporter (l’écran existe) et comment souscrire', () => {
    expect(avis.corps).toContain('Fichier > Restituer le dossier complet');
    expect(avis.corps).toContain('admin@vmgconsulting.net');
  });

  it('dit que la suppression est irréversible et que les sauvegardes gardent une trace jusqu’à leur terme', () => {
    expect(avis.corps).toContain('irréversible');
    expect(avis.corps).toMatch(/sauvegardes chiffrées de la nuit gardent une trace du dossier jusqu'à leur propre terme/);
  });

  it('ne porte ni secret, ni mot de passe, ni donnée du dossier', () => {
    expect(avis.corps).not.toMatch(/mot de passe|motdepasse|secret|jeton/i);
    expect(avis.corps).not.toMatch(/\d{6,}/); // aucun montant, aucun identifiant long
  });

  it('respecte l’interdit du dépôt · aucun tiret cadratin', () => {
    const cadratin = String.fromCharCode(0x2014);
    expect(avis.corps.includes(cadratin) || avis.sujet.includes(cadratin)).toBe(false);
  });
});

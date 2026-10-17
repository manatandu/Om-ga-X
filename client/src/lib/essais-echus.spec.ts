import { dateDuJour, etatEssai, libelleIssueRappel, statutDuRappel, type EssaiEchu } from './essais-echus';

// Aucun import de « vitest » (globales) · convention du dépôt.

const base: EssaiEchu = {
  tenantId: 'd-1',
  etat: 'ECHU_CONSERVE',
  termeLe: '2026-01-31',
  conserveJusquAu: '2026-07-30',
  supprimableLe: '2026-07-31',
  rappelDepuisLe: '2026-06-01',
  rappel: null,
  nombreUtilisateurs: 1,
  nombreExercices: 2,
  nombreEcritures: 3,
};

describe('dateDuJour · un jour AAAA-MM-JJ, jamais décalé par le fuseau du poste', () => {
  it('rend JJ/MM/AAAA tel quel', () => {
    expect(dateDuJour('2026-07-31')).toBe('31/07/2026');
    expect(dateDuJour('2026-01-01T00:00:00.000Z')).toBe('01/01/2026');
  });

  it('une date absente ou illisible se dit « · », jamais une date inventée', () => {
    expect(dateDuJour(null)).toBe('·');
    expect(dateDuJour('')).toBe('·');
    expect(dateDuJour('pas une date')).toBe('·');
  });
});

describe('état et issue du rappel', () => {
  it('les trois états ont leur libellé ; un état inconnu se dit tel quel', () => {
    expect(etatEssai('SUPPRIMABLE').libelle).toBe('SUPPRIMABLE');
    expect(etatEssai('RAPPEL_A_ENVOYER').libelle).toBe('RAPPEL À ENVOYER');
    expect(etatEssai('ECHU_CONSERVE').libelle).toBe('CONSERVÉ');
    expect(etatEssai('AUTRE').libelle).toBe('AUTRE');
    expect(libelleIssueRappel('EN_FILE')).toBe('en file, pas encore parti');
    expect(libelleIssueRappel('INCONNUE')).toBe('INCONNUE');
  });
});

describe('statutDuRappel · « en file » n’est pas « parti »', () => {
  it('sans rappel : à envoyer quand il est dû, sinon la date où il le devient', () => {
    expect(statutDuRappel({ ...base, etat: 'RAPPEL_A_ENVOYER' })).toMatchObject({ libelle: 'à envoyer', alerte: false });
    expect(statutDuRappel(base).libelle).toBe('dû dès le 01/06/2026');
  });

  it('parti seulement quand le serveur a constaté l’envoi', () => {
    const parti = statutDuRappel({ ...base, rappel: { misEnFileLe: '2026-06-10T10:00:00Z', envoyeLe: '2026-06-10T10:00:01Z', statutCourrier: 'ENVOYE', erreur: null } });
    expect(parti.libelle).toBe('parti le 10/06/2026');
    const enFile = statutDuRappel({ ...base, rappel: { misEnFileLe: '2026-06-10T10:00:00Z', envoyeLe: null, statutCourrier: 'EN_ATTENTE', erreur: null } });
    expect(enFile).toMatchObject({ libelle: 'en file, pas parti', alerte: false });
  });

  it('un échec d’envoi se montre en alerte avec sa cause', () => {
    const echec = statutDuRappel({ ...base, rappel: { misEnFileLe: '2026-06-10T10:00:00Z', envoyeLe: null, statutCourrier: 'ECHEC', erreur: 'Connexion refusée' } });
    expect(echec).toMatchObject({ libelle: 'en échec', alerte: true, detail: 'Connexion refusée' });
  });
});

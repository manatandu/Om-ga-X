import * as bcrypt from 'bcryptjs';
import 'reflect-metadata';
import { AuthController } from './auth.controller';
import { CLE_SORTIE_MOT_DE_PASSE } from '../../common/decorators/sortie-mot-de-passe.decorator';
import { AuthService } from './auth.service';

/**
 * Changer sa propre adresse de connexion · demandé par Manasse le 2026-09-25
 * (une adresse du cabinet qui change de domaine). Aucun écran ne le permettait, et le
 * seul chemin restant était une modification à la main dans la base.
 */
function service(user: Record<string, unknown>, echec?: { code: string }) {
  const update = jest.fn(async () => {
    if (echec) throw echec;
    return {};
  });
  // L'acte passe dans une transaction · verrou du dossier, ligne du compte
  // relue sous verrou, puis la mise à jour (`revoquerEtFermerLaSession`).
  const client: Record<string, unknown> = { $executeRaw: async () => 1, $queryRaw: async () => [{ sessionsFermees: [] }], user: { findUnique: async () => user, update } };
  client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
  const s = new AuthService(
    client as never,
    { sign: () => 'jeton' } as never,
    ...([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined] as [never, never, never, never, never, never, never, never]),
  );
  return { s, update };
}

describe('changer son adresse de connexion', () => {
  let hash: string;
  beforeAll(async () => {
    hash = await bcrypt.hash('le-bon', 4);
  });
  const utilisateur = () => ({ id: 'u1', email: 'admin@ancien.cd', motDePasse: hash });

  it('exige le mot de passe actuel, sans rien écrire sinon', async () => {
    const { s, update } = service(utilisateur());
    await expect(s.changerAdresse('u1', 'faux', 'admin@nouveau.cd')).rejects.toThrow(/mot de passe actuel est incorrect/);
    expect(update).not.toHaveBeenCalled();
  });

  it('change l’adresse, ferme les sessions et en repose une neuve', async () => {
    const { s, update } = service(utilisateur());
    const r = await s.changerAdresse('u1', 'le-bon', '  admin@nouveau.cd ');
    const appel = (update.mock.calls[0] as unknown as [{ where: unknown; data: Record<string, unknown> }])[0];
    expect(appel.where).toEqual({ id: 'u1' });
    expect(appel.data.email).toBe('admin@nouveau.cd');
    expect(appel.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
    expect(r).toMatchObject({ adresse: 'admin@nouveau.cd', accessToken: 'jeton' });
    // Le drapeau d'opérateur et le rôle sont sur le compte · rien ne les touche.
    expect(Object.keys(appel.data).sort()).toEqual(['email', 'sessionsInvalidesAvant']);
  });

  it('une adresse déjà prise est refusée sans dire à qui elle appartient', async () => {
    const { s } = service(utilisateur(), { code: 'P2002' });
    await expect(s.changerAdresse('u1', 'le-bon', 'autre@exemple.cd')).rejects.toThrow('Cette adresse est déjà utilisée par un autre compte.');
  });

  it('refuse l’adresse actuelle', async () => {
    const { s } = service(utilisateur());
    await expect(s.changerAdresse('u1', 'le-bon', 'admin@ancien.cd')).rejects.toThrow(/déjà votre adresse/);
  });

  it('la route n’est PAS une sortie de mot de passe provisoire · on lit la métadonnée, pas le texte', () => {
    const lire = (m: object) => Reflect.getMetadata(CLE_SORTIE_MOT_DE_PASSE, m);
    // Présence de la marque là où elle doit être, pour que l'absence ci-dessous veuille dire quelque chose.
    expect(lire(AuthController.prototype.changerMotDePasse)).toBe(true);
    expect(lire(AuthController.prototype.changerAdresse)).toBeUndefined();
  });
});

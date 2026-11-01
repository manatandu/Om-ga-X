import 'reflect-metadata';
import { ServiceUnavailableException, UnsupportedMediaTypeException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { PrismaService } from '../../common/prisma.service';
import { CourrierService } from '../courrier/courrier.service';
import { DemandeInformationController } from './demande-information.controller';
import { DemandeInformationDto } from './demande-information.dto';
import { DemandeInformationService, MOTIF_NON_ENREGISTREE, MOTIF_SANS_MESSAGERIE, REPONSE_DEMANDE_RECUE } from './demande-information.service';
import { ORIGINE_DEMANDE_INFORMATION, composerDemande, destinatairesDesDemandes, surUneLigne } from './demande-information';

const DEMANDE = {
  nom: 'Ruth Kabeya',
  organisation: 'ASBL Lumière',
  email: 'Ruth@Exemple.cd',
  telephone: '+243 81 000 00 00',
  message: 'Nous voulons tenir notre comptabilité SYCEBNL avec OmegaX.',
  consentement: true,
};

describe('les règles pures de la demande', () => {
  it('lit les opérateurs comme la promotion · virgules, casse, doublons, vide', () => {
    expect(destinatairesDesDemandes(' Ops@Omegax.cd, ops@omegax.cd ,, autre@omegax.cd ')).toEqual(['ops@omegax.cd', 'autre@omegax.cd']);
    expect(destinatairesDesDemandes(undefined)).toEqual([]);
    expect(destinatairesDesDemandes('  ,  ')).toEqual([]);
  });

  it('le sujet tient sur une ligne · une organisation à retours à la ligne n’écrit aucun en-tête', () => {
    const { sujet } = composerDemande({ ...DEMANDE, organisation: 'X\r\nBcc: pirate@exemple.cd' }, new Date('2026-11-01T10:00:00Z'));
    expect(sujet).not.toMatch(/[\r\n]/);
    expect(surUneLigne('a\u0000b\tc')).toBe('a b c');
  });

  it('le corps porte les champs, l’heure de Kinshasa, et la preuve du consentement (art. 196)', () => {
    const { sujet, corps } = composerDemande(DEMANDE, new Date('2026-11-01T10:05:00Z'));
    expect(sujet).toBe("Demande d'information · ASBL Lumière");
    expect(corps).toContain('Adresse de réponse · ruth@exemple.cd');
    expect(corps).toContain('Téléphone · +243 81 000 00 00');
    expect(corps).toContain('01/11/2026 à 11 h 05 (heure de Kinshasa)');
    expect(corps).toContain('Consentement · la personne a coché la case');
    expect(corps).toContain('art. 192 et 196');
    expect(composerDemande({ ...DEMANDE, telephone: null }, new Date()).corps).toContain('Téléphone · non donné');
  });
});

describe('le service', () => {
  function monter(options: { transport?: boolean; operateurs?: string; editeur?: boolean } = {}) {
    const mettreEnFile = jest.fn(async () => ({ id: 'm1', statut: 'ENVOYE', erreur: null }));
    const courrier = { etatDuTransport: () => ({ configure: options.transport ?? true }), mettreEnFile };
    const findFirst = jest.fn(async () => (options.editeur === false ? null : { tenantId: 'editeur' }));
    const prisma = { licence: { findFirst } };
    const config = { get: (k: string) => (k === 'OPERATEURS_PLATEFORME' ? (options.operateurs ?? 'ops@omegax.cd') : undefined) };
    const s = new DemandeInformationService(prisma as unknown as PrismaService, config as unknown as ConfigService, courrier as unknown as CourrierService);
    return { s, mettreEnFile, findFirst };
  }

  it('met la demande en file dans le dossier de l’éditeur, une par opérateur, et ne rend aucune adresse', async () => {
    const { s, mettreEnFile } = monter({ operateurs: 'a@omegax.cd,b@omegax.cd' });
    const r = await s.transmettre(DEMANDE as DemandeInformationDto);
    expect(r).toEqual({ recue: true, message: REPONSE_DEMANDE_RECUE });
    expect(JSON.stringify(r)).not.toContain('omegax.cd');
    expect(mettreEnFile).toHaveBeenCalledTimes(2);
    expect(mettreEnFile).toHaveBeenCalledWith('editeur', expect.objectContaining({ destinataire: 'a@omegax.cd', origine: ORIGINE_DEMANDE_INFORMATION }));
  });

  it('un destinataire que la file refuse ne remonte jamais son adresse au visiteur', async () => {
    const { s, mettreEnFile } = monter({ operateurs: 'faute@omegax' });
    mettreEnFile.mockRejectedValueOnce(new Error('Adresse de destinataire inutilisable · « faute@omegax »') as never);
    const e = await s.transmettre(DEMANDE as DemandeInformationDto).catch((x: Error) => x);
    expect(e).toBeInstanceOf(ServiceUnavailableException);
    expect((e as Error).message).toBe(MOTIF_NON_ENREGISTREE);
    expect((e as Error).message).not.toContain('omegax');
  });

  it('un destinataire refusé sur deux n’empêche pas la demande d’arriver à l’autre', async () => {
    const { s, mettreEnFile } = monter({ operateurs: 'a@omegax.cd,b@omegax.cd' });
    mettreEnFile.mockRejectedValueOnce(new Error('refus') as never);
    await expect(s.transmettre(DEMANDE as DemandeInformationDto)).resolves.toEqual({ recue: true, message: REPONSE_DEMANDE_RECUE });
  });

  it('la réponse ne promet aucun délai', () => {
    expect(REPONSE_DEMANDE_RECUE).not.toMatch(/heure|jour|délai|sous \d|rapidement|bientôt/i);
  });

  it.each([
    ['sans messagerie', { transport: false }],
    ['sans opérateur', { operateurs: '' }],
    ['sans dossier d’éditeur', { editeur: false }],
  ])('%s · 503 nommé, et rien d’écrit', async (_cas, options) => {
    const { s, mettreEnFile } = monter(options);
    await expect(s.transmettre(DEMANDE as DemandeInformationDto)).rejects.toThrow(ServiceUnavailableException);
    await expect(s.transmettre(DEMANDE as DemandeInformationDto)).rejects.toThrow(MOTIF_SANS_MESSAGERIE);
    expect(mettreEnFile).not.toHaveBeenCalled();
  });
});

describe('la porte', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const valider = (corps: unknown) => pipe.transform(corps, { type: 'body', metatype: DemandeInformationDto });

  it('refuse une case de consentement non cochée, un champ de plus, un courriel invalide', async () => {
    await expect(valider({ ...DEMANDE, consentement: false })).rejects.toBeDefined();
    await expect(valider({ ...DEMANDE, consentement: 'oui' })).rejects.toBeDefined();
    await expect(valider({ ...DEMANDE, piege: 1 })).rejects.toBeDefined();
    await expect(valider({ ...DEMANDE, email: 'pas-une-adresse' })).rejects.toBeDefined();
    await expect(valider({ ...DEMANDE, telephone: '<script>' })).rejects.toBeDefined();
    await expect(valider({ ...DEMANDE, message: 'x'.repeat(3001) })).rejects.toBeDefined();
  });

  it('admet le téléphone absent, et normalise l’adresse', async () => {
    const { telephone: _t, ...sans } = DEMANDE;
    const v = (await valider(sans)) as DemandeInformationDto;
    expect(v.email).toBe('ruth@exemple.cd');
  });

  it('refuse un corps qui n’est pas du JSON (formulaire d’un autre site)', () => {
    const c = new DemandeInformationController({ transmettre: jest.fn() } as unknown as DemandeInformationService);
    expect(() => c.transmettre(DEMANDE as DemandeInformationDto, { is: () => false } as never)).toThrow(UnsupportedMediaTypeException);
  });

  it('est limitée en débit · cinq par heure', () => {
    const limite = new Reflector().get(`${THROTTLER_LIMIT}default`, DemandeInformationController.prototype.transmettre);
    expect(limite).toBe(5);
  });
});

import { useEffect, useRef, useState } from 'react';
import {
  AUTEUR_NON_ENREGISTRE,
  empreinteCommande,
  type EtatConditions,
  type StatutAccuse,
} from '../../../src/modules/conditions-licence/acceptation-conditions';
import { VERSION_CONDITIONS_LICENCE } from '../../../src/modules/conditions-licence/conditions-de-licence';
import { empreinteEnVigueur, versionPubliee } from '../../../src/modules/conditions-licence/versions-publiees';
import { dateEnLettres, ecartDeTexte, phraseAccuse, phraseEcartDeTexte } from '../lib/acceptation-conditions-ecran';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';
import { telechargerTexteDeVersion } from './telechargerContrat';

/**
 * L'ACCEPTATION DES CONDITIONS DE LICENCE PAR LE DOSSIER · Code du numérique
 * (ordonnance-loi n° 23/10 du 13 mars 2023), art. 55. L'état est SERVI par le
 * serveur (`GET /conditions-licence`) · la version qu'il tient en vigueur et
 * l'empreinte de son texte, l'acceptation enregistrée, le motif qui ferme
 * l'acceptation, l'abonnement et son prix, le dernier accusé de réception.
 * L'écran ne recalcule rien, sans quoi il pourrait ouvrir une acceptation que
 * le serveur refuse, ou montrer un prix que la facture ne portera pas.
 *
 * LE TEXTE ACCEPTÉ EST CELUI QUE L'ÉCRAN AFFICHE (relecture « échecs
 * silencieux », M1) · le numéro et l'empreinte envoyés sont ceux du code
 * chargé dans CETTE page, jamais ceux que le serveur rend · une page restée
 * ouverte pendant une mise en production aurait sinon fait accepter un texte
 * qu'elle n'affichait pas. Quand les deux diffèrent, rien ne s'accepte, et
 * l'écran demande de recharger la page, ou d'attendre le service quand c'est
 * la page qui est la plus récente (second tour, m-2).
 *
 * L'ABONNEMENT AFFICHÉ EST CELUI QUI S'ACCEPTE (second tour, M-a) · l'écran
 * envoie l'empreinte de la commande qu'il montre, le serveur la confronte à
 * celle qu'il relit sous le verrou. Refusée, l'acceptation relit l'état, et
 * la case est décochée · l'administrateur revoit le prix avant de reprendre.
 *
 * QUATRE ÉTATS, CHACUN DIT · pas encore lu (rien n'est affiché comme « aucune
 * acceptation » avant la réponse), lecture en échec (le motif), acceptation
 * fermée (le motif du serveur), acceptation à faire (l'administrateur seul).
 * L'accusé de réception s'affiche aussitôt (art. 55, al. 2) · c'est l'accusé
 * électronique que la loi demande, le courriel en file n'en est que la copie.
 */

/** Le texte que CETTE page affiche · son numéro et son empreinte, calculée sur lui. */
const VERSION_AFFICHEE = VERSION_CONDITIONS_LICENCE.numero;
const EMPREINTE_AFFICHEE = empreinteEnVigueur();

export function AcceptationConditionsLicence() {
  const { estAdmin, utilisateur } = useAuth();
  const [etat, setEtat] = useState<EtatConditions | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [lu, setLu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<{ deja: boolean; statut: StatutAccuse | null } | null>(null);
  const jeton = useRef(0);
  const refAccuse = useRef<HTMLDivElement>(null);

  /** Lit l'état servi · au montage, après un refus, et sur « Réessayer ». Une réponse périmée est jetée par jeton. */
  function relire() {
    const n = ++jeton.current;
    setErreurLecture(null);
    api
      .get<EtatConditions>('/conditions-licence')
      .then((e) => n === jeton.current && setEtat(e))
      .catch((e) => n === jeton.current && setErreurLecture(e instanceof ApiError ? e.message : 'Lecture impossible.'));
  }

  useEffect(relire, []);

  // L'accusé reçoit le focus quand il paraît (second tour, mineur 7) · la case
  // et le bouton d'acceptation disparaissent avec l'acte, le focus serait perdu.
  useEffect(() => {
    if (accuse) refAccuse.current?.focus();
  }, [accuse]);

  async function accepter() {
    if (!etat || !lu) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ etat: EtatConditions; deja: boolean; accuse: { statut: StatutAccuse } | null }>('/conditions-licence/acceptation', {
        version: VERSION_AFFICHEE,
        empreinte: EMPREINTE_AFFICHEE,
        empreinteCommande: empreinteCommande(etat.commande),
        lu: true,
      });
      setEtat(r.etat);
      setAccuse({ deja: r.deja, statut: r.accuse?.statut ?? null });
      // La bannière de l'espace de travail relit l'état à cet événement.
      window.dispatchEvent(new Event('omegax:conditions-acceptees'));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Acceptation impossible.');
      // L'état a pu changer (prix, version, acceptation faite ailleurs) · il
      // est relu, et la case décochée, pour que rien ne se reprenne sur ce
      // que l'écran montrait avant le refus (second tour, mineur 3).
      setLu(false);
      relire();
    } finally {
      setEnvoi(false);
    }
  }

  async function renvoyerAccuse() {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ etat: EtatConditions; accuse: { statut: StatutAccuse } | null }>('/conditions-licence/accuse', {});
      setEtat(r.etat);
      setAccuse({ deja: false, statut: r.accuse?.statut ?? null });
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Renvoi impossible.');
      relire();
    } finally {
      setEnvoi(false);
    }
  }

  const horodatage = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' });

  // Le texte de cette page est-il celui que le service tient en vigueur ?
  const ecart = etat ? ecartDeTexte(etat.version, { numero: VERSION_AFFICHEE, empreinte: EMPREINTE_AFFICHEE }) : null;
  const texteAJour = ecart === 'A_JOUR';
  // Une version acceptée qui n'est plus celle affichée reste lisible (contrat, article 18).
  const accepteeArchivee =
    etat?.acceptation && etat.acceptation.version !== VERSION_AFFICHEE ? versionPubliee(etat.acceptation.version) : null;
  const statutAccuse = accuse ? accuse.statut : etat?.accuse?.statut ?? null;

  return (
    <section className="ecran-seul mt-5 border border-border bg-surface px-3.5 py-3 text-[11.5px]" aria-label="Acceptation des conditions par ce dossier">
      <h2 className="text-[12px] font-bold mb-1.5 flex items-center gap-1.5">
        Acceptation par ce dossier
        <Aide
          titre="Acceptation en ligne"
          texte="L’administrateur du dossier accepte les conditions au nom de l’entité, après avoir vérifié la version et l’abonnement du dossier. L’acceptation est enregistrée avec la version et l’empreinte du texte accepté, son auteur, sa date et l’adresse réseau au journal d’audit. OmegaX en accuse réception aussitôt à l’écran, et met en file un courriel qui porte l’accusé et le texte accepté. Sans acceptation, l’accès au dossier n’est pas interrompu."
          source="Code du numérique, art. 30, al. 3 ; art. 53 à 56."
        />
      </h2>

      {erreurLecture && <p role="alert" className="text-danger">{erreurLecture}</p>}
      {!etat && !erreurLecture && <p className="text-text-dim">Chargement…</p>}

      {etat && (
        <>
          {etat.acceptation ? (
            <p className="mb-1.5">
              Acceptées · version {etat.acceptation.version}, le {horodatage(etat.acceptation.le)} (heure de Kinshasa), par{' '}
              {etat.acceptation.par ?? AUTEUR_NON_ENREGISTRE}.
            </p>
          ) : (
            <p className="mb-1.5">Aucune acceptation enregistrée pour ce dossier.</p>
          )}
          {etat.acceptation && !etat.aJour && (
            <p className="mb-1.5 text-warning">La version en vigueur ({etat.version.numero}) n’a pas encore été acceptée.</p>
          )}
          {accepteeArchivee && (
            <button
              type="button"
              onClick={() => telechargerTexteDeVersion(accepteeArchivee.numero, accepteeArchivee.texte)}
              className="text-sel underline mb-1.5"
            >
              Télécharger le texte accepté (version {accepteeArchivee.numero})
            </button>
          )}

          {ecart && ecart !== 'A_JOUR' && (
            <div role="alert" className="mb-2 text-warning">
              <p>{phraseEcartDeTexte(ecart, etat.version.numero, VERSION_AFFICHEE, estAdmin)}</p>
              {ecart === 'SERVICE_EN_RETARD' ? (
                <button type="button" onClick={relire} className="text-sel underline font-semibold">
                  Réessayer
                </button>
              ) : (
                <button type="button" onClick={() => window.location.reload()} className="text-sel underline font-semibold">
                  Recharger la page
                </button>
              )}
            </div>
          )}

          {etat.commande && (
            <div className="mb-2">
              <p className="font-semibold mb-1">{etat.commande.duSiege ? 'Abonnement du siège du groupe' : 'Abonnement du dossier'}</p>
              <p>
                {etat.commande.formule}
                {etat.commande.options.length > 0 ? ` · options ${etat.commande.options.join(', ')}` : ''} ·{' '}
                {etat.commande.periodicite === 'ANNUELLE' ? 'annuel' : 'mensuel'} · depuis le {dateEnLettres(etat.commande.debut)}
                {etat.commande.finEssai ? ` · essai jusqu’au ${dateEnLettres(etat.commande.finEssai)}` : ''}
                {etat.commande.actif ? '' : ' · suspendu'}.
              </p>
              {etat.commande.lignes ? (
                <table className="mt-1">
                  <thead>
                    <tr>
                      <th scope="col" className="pr-3 text-left">Désignation</th>
                      <th scope="col" className="pr-3 text-right">Quantité</th>
                      <th scope="col" className="text-right">Prix unitaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etat.commande.lignes.map((l, i) => (
                      <tr key={i}>
                        <td className="pr-3">{l.designation}</td>
                        <td className="pr-3 text-right">{l.quantite}</td>
                        <td className="text-right">{montant(l.prixUnitaireUsd)} USD</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pr-3 font-semibold">Total d’une période</td>
                      <td />
                      <td className="text-right font-semibold">{montant(etat.commande.totalUsd)} USD</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-warning">{etat.commande.motifPrix}</p>
              )}
            </div>
          )}

          {etat.motifFermeture && <p className="text-text-dim">{etat.motifFermeture}</p>}

          {etat.aAccepter && !estAdmin && <p className="text-text-dim">Seul l’administrateur du dossier accepte les conditions au nom de l’entité.</p>}

          {etat.aAccepter && estAdmin && texteAJour && (
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} className="mt-0.5" />
                <span>
                  J’ai lu les conditions de licence, version {VERSION_AFFICHEE} du {VERSION_CONDITIONS_LICENCE.dateLisible}, et je les accepte au nom de{' '}
                  {utilisateur?.tenant.nom ?? 'ce dossier'}.
                </span>
              </label>
              <div>
                <button
                  type="button"
                  disabled={!lu || envoi}
                  onClick={accepter}
                  className="bg-sel text-white rounded-full px-4 py-1 font-semibold disabled:opacity-50"
                >
                  {envoi ? 'Un instant…' : 'Accepter les conditions'}
                </button>
              </div>
            </div>
          )}

          {erreur && (
            <p role="alert" className="mt-2 text-danger">
              {erreur}
            </p>
          )}

          {etat.acceptation && etat.aJour && (accuse || etat.accuse || etat.renvoiAccusePossible) && (
            <div ref={refAccuse} tabIndex={-1} role="status" className="mt-2 border border-sel/30 bg-sel-soft px-3 py-2">
              <p className="font-semibold">Accusé de réception</p>
              {accuse && (
                <p>
                  {accuse.deja ? 'Ces conditions étaient déjà acceptées' : 'Conditions acceptées'} · version {etat.acceptation.version}, le{' '}
                  {horodatage(etat.acceptation.le)} (heure de Kinshasa), par {etat.acceptation.par ?? AUTEUR_NON_ENREGISTRE}.
                </p>
              )}
              {!(accuse && accuse.deja) && <p>{phraseAccuse(statutAccuse, estAdmin)}</p>}
              {estAdmin && etat.renvoiAccusePossible && (
                <button type="button" disabled={envoi} onClick={renvoyerAccuse} className="mt-1 text-sel underline font-semibold disabled:opacity-50">
                  Renvoyer l’accusé
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

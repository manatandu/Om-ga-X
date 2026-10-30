import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Aide } from '../components/chrome/Aide';
import { messageOuDefaut } from '../lib/message-refus';
import {
  LIBELLE_ROLE_COURT,
  objetDeLaReponse,
  type BoiteEnvoyes,
  type BoiteRecus,
  type Destinataire,
  type MessageLu,
} from '../lib/messagerie';

/**
 * MESSAGES · Fichier > Messages (ligne dossier-l9, fonction 95 ; Sage,
 * messagerie entre utilisateurs du fichier). Entre utilisateurs d'un MÊME
 * dossier, jamais au-delà · chacun ne lit que ce qu'il a envoyé ou reçu.
 */

/** Diffusé quand un message est lu ou retiré · la cloche se relit. */
export const EVENEMENT_MESSAGES = 'omegax:messages';

function dateHeure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

type Boite = 'recus' | 'envoyes';

export function MessagesPage() {
  const [boite, setBoite] = useState<Boite>('recus');
  const [recus, setRecus] = useState<BoiteRecus | null>(null);
  const [envoyes, setEnvoyes] = useState<BoiteEnvoyes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<MessageLu | null>(null);
  const [erreurMessage, setErreurMessage] = useState<string | null>(null);
  const [redaction, setRedaction] = useState<{ objet: string; corps: string; destinataires: string[]; repondAId?: string } | null>(null);
  const [destinataires, setDestinataires] = useState<Destinataire[] | null>(null);
  // La liste servie est bornée · au-delà, l'écran le dit (relecture « échecs silencieux »).
  const [destinatairesTronques, setDestinatairesTronques] = useState(false);
  const [erreurRedaction, setErreurRedaction] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<string | null>(null);
  const jeton = useRef(0);

  const charger = useCallback(async (b: Boite) => {
    const mien = ++jeton.current;
    setErreur(null);
    try {
      if (b === 'recus') {
        const r = await api.get<BoiteRecus>('/messages/recus');
        if (mien === jeton.current) setRecus(r);
      } else {
        const r = await api.get<BoiteEnvoyes>('/messages/envoyes');
        if (mien === jeton.current) setEnvoyes(r);
      }
    } catch (e) {
      if (mien === jeton.current) setErreur(messageOuDefaut(e, "La boîte n'a pas pu être lue."));
    }
  }, []);

  useEffect(() => {
    void charger(boite);
  }, [boite, charger]);

  async function ouvrir(id: string, nonLu: boolean) {
    setErreurMessage(null);
    setOuvert(null);
    try {
      const m = await api.get<MessageLu>(`/messages/${id}`);
      setOuvert(m);
      if (nonLu) {
        await api.post(`/messages/${id}/lu`, {});
        window.dispatchEvent(new Event(EVENEMENT_MESSAGES));
        void charger('recus');
      }
    } catch (e) {
      setErreurMessage(messageOuDefaut(e, "Le message n'a pas pu être lu."));
    }
  }

  async function retirer(id: string) {
    setErreurMessage(null);
    try {
      await api.post(`/messages/${id}/retirer`, {});
      setOuvert(null);
      window.dispatchEvent(new Event(EVENEMENT_MESSAGES));
      void charger(boite);
    } catch (e) {
      setErreurMessage(messageOuDefaut(e, "Le message n'a pas pu être retiré."));
    }
  }

  async function rediger(depart: { objet: string; corps: string; destinataires: string[]; repondAId?: string }) {
    setFait(null);
    setErreurRedaction(null);
    setRedaction(depart);
    if (destinataires === null) {
      try {
        const lus = await api.get<{ destinataires: Destinataire[]; tronque: boolean }>('/messages/destinataires');
        setDestinataires(lus.destinataires);
        setDestinatairesTronques(lus.tronque);
      } catch (e) {
        setErreurRedaction(messageOuDefaut(e, "La liste des utilisateurs du dossier n'a pas pu être lue."));
      }
    }
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!redaction) return;
    setEnvoi(true);
    setErreurRedaction(null);
    try {
      await api.post('/messages', {
        objet: redaction.objet,
        corps: redaction.corps,
        destinataireIds: redaction.destinataires,
        ...(redaction.repondAId ? { repondAId: redaction.repondAId } : {}),
      });
      setRedaction(null);
      setFait('Message envoyé.');
      if (boite === 'envoyes') void charger('envoyes');
    } catch (err) {
      setErreurRedaction(messageOuDefaut(err, "Le message n'a pas pu être envoyé."));
    } finally {
      setEnvoi(false);
    }
  }

  const basculer = (id: string) =>
    setRedaction((r) => (r ? { ...r, destinataires: r.destinataires.includes(id) ? r.destinataires.filter((x) => x !== id) : [...r.destinataires, id] } : r));

  return (
    <div className="p-2 max-w-[1040px] text-[11.5px] flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex">
          {(['recus', 'envoyes'] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={boite === b}
              onClick={() => setBoite(b)}
              className={`border border-border px-3 py-1 ${boite === b ? 'bg-sel-soft font-semibold' : 'hover:bg-sel-soft'}`}
            >
              {b === 'recus' ? `Reçus${recus && recus.nonLus > 0 ? ` (${recus.nonLus})` : ''}` : 'Envoyés'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void rediger({ objet: '', corps: '', destinataires: [] })} className="bg-sel text-white font-semibold px-3 py-1">
          Nouveau message
        </button>
        <Aide
          titre="Messages"
          texte="Les messages vont aux utilisateurs actifs de ce dossier, jamais au-delà. Chacun ne lit que ce qu'il a envoyé ou reçu · l'administrateur ne lit pas les messages des autres, et le journal d'audit ne garde de l'envoi que son auteur et sa date. Retirer un message l'enlève de votre boîte seule ; retiré par tous, il est supprimé."
          source="Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 193, 2° et 3°."
        />
      </div>
      {fait && (
        <p role="status" className="text-success">
          {fait}
        </p>
      )}

      {redaction && (
        <form onSubmit={(e) => void envoyer(e)} className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="font-semibold">Destinataires</legend>
            {destinataires === null && !erreurRedaction && <p className="text-text-dim">Chargement…</p>}
            {destinataires && destinataires.length === 0 && <p className="text-text-dim">Aucun autre utilisateur actif dans ce dossier.</p>}
            {destinatairesTronques && <p className="text-warning">Les {destinataires?.length} premiers utilisateurs actifs, par adresse, sont proposés.</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {destinataires?.map((d) => (
                <label key={d.id} className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={redaction.destinataires.includes(d.id)} onChange={() => basculer(d.id)} />
                  {d.email} <span className="text-text-dim">({LIBELLE_ROLE_COURT[d.role]})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-0.5">
            Objet
            <input
              value={redaction.objet}
              maxLength={150}
              onChange={(e) => setRedaction({ ...redaction, objet: e.target.value })}
              className="border border-border px-2 py-1"
              required
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Message
            <textarea
              value={redaction.corps}
              maxLength={5000}
              rows={6}
              onChange={(e) => setRedaction({ ...redaction, corps: e.target.value })}
              className="border border-border px-2 py-1"
              required
            />
          </label>
          {erreurRedaction && (
            <p role="alert" className="text-danger">
              {erreurRedaction}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={envoi || redaction.destinataires.length === 0} className="bg-sel text-white font-semibold px-3 py-1.5 disabled:opacity-40">
              {envoi ? 'Envoi…' : 'Envoyer'}
            </button>
            <button type="button" onClick={() => setRedaction(null)} disabled={envoi} className="border border-border px-3 py-1.5 hover:bg-sel-soft">
              Annuler
            </button>
          </div>
        </form>
      )}

      {erreur && (
        <p role="alert" className="text-danger">
          {erreur}
        </p>
      )}

      <section className="border border-border bg-surface">
        {boite === 'recus' && (
          <>
            {!recus && !erreur && <p className="px-3.5 py-2.5 text-text-dim">Chargement…</p>}
            {recus && recus.messages.length === 0 && <p className="px-3.5 py-2.5 text-text-dim">Aucun message reçu.</p>}
            {recus?.tronque && <p className="px-3.5 pt-2 text-warning">Les {recus.messages.length} plus récents sur {recus.total} sont affichés.</p>}
            {recus && recus.messages.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1">De</th>
                    <th className="text-left px-2 py-1">Objet</th>
                    <th className="text-left px-2 py-1 w-[140px]">Reçu le</th>
                  </tr>
                </thead>
                <tbody>
                  {recus.messages.map((m) => (
                    <tr key={m.id} onClick={() => void ouvrir(m.id, !m.lu)} className={`cursor-pointer hover:bg-sel-soft ${m.lu ? '' : 'font-semibold'}`}>
                      <td className="px-2 py-1">{m.de}</td>
                      <td className="px-2 py-1">{m.objet}</td>
                      <td className="px-2 py-1">{dateHeure(m.envoyeLe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {boite === 'envoyes' && (
          <>
            {!envoyes && !erreur && <p className="px-3.5 py-2.5 text-text-dim">Chargement…</p>}
            {envoyes && envoyes.messages.length === 0 && <p className="px-3.5 py-2.5 text-text-dim">Aucun message envoyé.</p>}
            {envoyes?.tronque && <p className="px-3.5 pt-2 text-warning">Les {envoyes.messages.length} plus récents sur {envoyes.total} sont affichés.</p>}
            {envoyes && envoyes.messages.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1">À</th>
                    <th className="text-left px-2 py-1">Objet</th>
                    <th className="text-left px-2 py-1 w-[90px]">Lu par</th>
                    <th className="text-left px-2 py-1 w-[140px]">Envoyé le</th>
                  </tr>
                </thead>
                <tbody>
                  {envoyes.messages.map((m) => (
                    <tr key={m.id} onClick={() => void ouvrir(m.id, false)} className="cursor-pointer hover:bg-sel-soft">
                      <td className="px-2 py-1">{m.a.join(', ')}</td>
                      <td className="px-2 py-1">{m.objet}</td>
                      <td className="px-2 py-1">
                        {m.lusPar} sur {m.a.length}
                      </td>
                      <td className="px-2 py-1">{dateHeure(m.envoyeLe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {erreurMessage && (
        <p role="alert" className="text-danger">
          {erreurMessage}
        </p>
      )}
      {ouvert && (
        <article className="border border-border bg-surface px-3.5 py-2.5 flex flex-col gap-1.5">
          <h2 className="text-[12px] font-bold">{ouvert.objet}</h2>
          <p className="text-text-dim">
            De {ouvert.de} · à {ouvert.a.map((x) => `${x.email}${x.lu === undefined ? '' : x.lu ? ' (lu)' : ' (non lu)'}`).join(', ')} · {dateHeure(ouvert.envoyeLe)}
          </p>
          {ouvert.repondA && <p className="text-text-dim">En réponse à « {ouvert.repondA.objet} »</p>}
          <p className="whitespace-pre-wrap">{ouvert.corps}</p>
          <div className="flex gap-2">
            {!ouvert.estExpediteur && (
              <button
                type="button"
                onClick={() => void rediger({ objet: objetDeLaReponse(ouvert.objet), corps: '', destinataires: [ouvert.deId], repondAId: ouvert.id })}
                className="border border-border px-3 py-1 hover:bg-sel-soft"
              >
                Répondre
              </button>
            )}
            <button type="button" onClick={() => void retirer(ouvert.id)} className="border border-border px-3 py-1 hover:bg-sel-soft">
              Retirer de ma boîte
            </button>
            <button type="button" onClick={() => setOuvert(null)} className="border border-border px-3 py-1 hover:bg-sel-soft">
              Fermer
            </button>
          </div>
        </article>
      )}
    </div>
  );
}

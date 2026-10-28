import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Aide } from '../chrome/Aide';
import { jourFr } from '../../lib/jour-fr';
import * as montants from '../../lib/montants';
import { BoutonsPaie, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie } from '../paie/ModalePaie';
import {
  cleApercu,
  journalPropose,
  liaisonProposee,
  receveurPreselectionne,
  receveursPossibles,
  type BienTransferable,
  type ContexteTransfert,
  type MontantsTransfert,
  type TransfertListe,
} from '../../lib/transfert-groupe';

/**
 * LIGNE SAGE-L4, N° 73 · LE TRANSFERT D'UN BIEN ENTRE DEUX DOSSIERS DU GROUPE,
 * depuis le siège (SYSCOHADA seul, le serveur le refuse ailleurs). Le geste
 * est réservé au comptable et à l'administrateur (`peutValider`), comme la
 * liasse du groupe · les montants ne se saisissent pas, l'aperçu les rend tels
 * que le serveur les passera.
 */
export function TransfertsBiensGroupe() {
  const { peutValider } = useAuth();
  const [contexte, setContexte] = useState<ContexteTransfert | null>(null);
  const [liste, setListe] = useState<{ transferts: TransfertListe[]; total: number; tronque: boolean } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<TransfertListe | null>(null);
  const jeton = useRef(0);

  const charger = () => {
    const j = ++jeton.current;
    setErreur(null);
    Promise.all([
      api.get<ContexteTransfert>('/immobilisations/transferts-groupe/contexte'),
      api.get<{ transferts: TransfertListe[]; total: number; tronque: boolean }>('/immobilisations/transferts-groupe'),
    ])
      .then(([c, l]) => {
        if (j !== jeton.current) return;
        setContexte(c);
        setListe(l);
      })
      .catch((e) => {
        if (j !== jeton.current) return;
        setContexte(null);
        setListe(null);
        setErreur(e instanceof ApiError ? e.message : 'Impossible de lire les transferts du groupe.');
      });
  };

  useEffect(() => {
    charger();
  }, []);

  return (
    <div className="max-w-[1120px]">
      <div className="flex items-center justify-end gap-2 mb-2">
        {peutValider && contexte && (
          <button type="button" onClick={() => setNouveau(true)} className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold rounded-full">
            Transférer un bien
          </button>
        )}
        <Aide
          titre="Transfert d'un bien dans le groupe"
          texte={
            "Le bien passe d'un dossier à l'autre à sa valeur d'entrée, avec ses amortissements et ses dépréciations, par les comptes de liaison 184 ou 185 · " +
            "une pièce dans chaque comptabilité, à la même date et sous la même référence, égales et de sens contraire, sans cession (aucun 81 ni 82). " +
            "Celui qui cède dote le bien jusqu'au mois du transfert compris ; celui qui reçoit le dote à partir du mois qui suit, sur le plan inchangé. " +
            "Le transfert relie le siège à une cellule, jamais deux cellules entre elles. Il s'annule des deux côtés avec son motif, tant que le dossier " +
            "qui a reçu le bien ne l'a pas traité."
          }
          source="AUDCIF Titre VII, compte 18 ; art. 35 et 36"
        />
      </div>

      {erreur && <div role="alert" className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}

      <div className="border border-border bg-surface shadow-posee overflow-x-auto">
        <table className="w-full min-w-[960px] text-[11.5px]">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Date</th>
              <th className="text-left px-2 py-1">Bien</th>
              <th className="text-left px-2 py-1">Cédé par</th>
              <th className="text-left px-2 py-1">Reçu par</th>
              <th className="text-left px-2 py-1">Pièce</th>
              <th className="text-right px-2 py-1">Valeur d'entrée</th>
              <th className="text-right px-2 py-1">Amortissements</th>
              <th className="text-right px-2 py-1">Dépréciations</th>
              <th className="text-right px-2 py-1">Valeur nette</th>
              <th className="text-left px-2 py-1">État</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {liste === null && !erreur && (
              <tr>
                <td colSpan={11} className="px-2 py-2 text-text-dim">Chargement…</td>
              </tr>
            )}
            {liste?.transferts.length === 0 && (
              <tr>
                <td colSpan={11} className="px-2 py-2 text-text-dim">Aucun transfert de bien dans ce groupe.</td>
              </tr>
            )}
            {liste?.transferts.map((t) => (
              <tr key={t.transfertId}>
                <td className="px-2 py-1">{jourFr(t.date)}</td>
                <td className="px-2 py-1">{t.designation}</td>
                <td className="px-2 py-1">{t.dossierCedant}</td>
                <td className="px-2 py-1">{t.dossierReceveur}</td>
                <td className="px-2 py-1">{t.referencePiece}</td>
                <td className="px-2 py-1 text-right tabular-nums">{montants.montant(t.valeurOrigine)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{montants.montant(t.amortissements)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{montants.montant(t.depreciations)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{montants.montant(t.valeurNette)}</td>
                <td className="px-2 py-1" title={t.motifAnnulation ?? undefined}>{t.annuleLe ? 'Annulé' : 'Passé'}</td>
                <td className="px-2 py-1">
                  {peutValider && !t.annuleLe && (
                    <button type="button" className="text-sel" onClick={() => setAAnnuler(t)}>
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {liste?.tronque && <div className="px-2 py-1 text-[11px] text-text-dim">Les {liste.transferts.length} plus récents sur {liste.total}.</div>}
      </div>

      {nouveau && contexte && (
        <ModaleTransfert
          contexte={contexte}
          onFermer={() => setNouveau(false)}
          onFait={() => {
            setNouveau(false);
            charger();
          }}
        />
      )}
      {aAnnuler && (
        <ModaleAnnulation
          transfert={aAnnuler}
          onFermer={() => setAAnnuler(null)}
          onFait={() => {
            setAAnnuler(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

function ModaleTransfert({ contexte, onFermer, onFait }: { contexte: ContexteTransfert; onFermer: () => void; onFait: () => void }) {
  const siege = contexte.dossiers.find((d) => d.siege);
  const [cedantId, setCedantId] = useState(siege?.id ?? '');
  const receveurs = receveursPossibles(contexte.dossiers, cedantId);
  const [receveurId, setReceveurId] = useState(receveurPreselectionne(contexte.dossiers, siege?.id ?? ''));
  const cedant = contexte.dossiers.find((d) => d.id === cedantId);
  const receveur = contexte.dossiers.find((d) => d.id === receveurId);
  const [biens, setBiens] = useState<{ biens: BienTransferable[]; tronque: boolean } | null>(null);
  const [erreurBiens, setErreurBiens] = useState<string | null>(null);
  const [f, setF] = useState({ immobilisationId: '', date: '', referencePiece: '', datePiece: '', journalCedantId: '', journalReceveurId: '', compteLiaisonCedantId: '', compteLiaisonReceveurId: '' });
  const [apercu, setApercu] = useState<MontantsTransfert | null>(null);
  const [enApercu, setEnApercu] = useState(false);
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const jetonBiens = useRef(0);
  // La clé du formulaire tel qu'il est · relue au retour de l'aperçu, et
  // l'aperçu montré porte la sienne · le transfert n'envoie que ce qui a été
  // montré.
  const cleCourante = useRef('');
  const [cleMontree, setCleMontree] = useState<string | null>(null);

  // Le dossier qui cède change · ses biens, son journal et sa liaison se
  // relisent. L'effet ne dépend que de `cedantId` · `cedant` en est tiré au
  // même rendu, et `journalPropose`, `liaisonProposee` sont des fonctions
  // pures du module ; les ajouter relancerait la lecture des biens à chaque
  // rendu.
  useEffect(() => {
    setBiens(null);
    setErreurBiens(null);
    setApercu(null);
    setF((x) => ({ ...x, immobilisationId: '', journalCedantId: journalPropose(cedant), compteLiaisonCedantId: liaisonProposee(cedant) }));
    if (!cedantId) return;
    const j = ++jetonBiens.current;
    api
      .get<{ biens: BienTransferable[]; tronque: boolean }>(`/immobilisations/transferts-groupe/dossiers/${cedantId}/biens`)
      .then((r) => {
        if (j === jetonBiens.current) setBiens(r);
      })
      .catch((e) => {
        if (j === jetonBiens.current) setErreurBiens(e instanceof ApiError ? e.message : 'Impossible de lire les biens de ce dossier.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedantId]);

  // Même raison · `receveur` est tiré de `receveurId` au même rendu.
  useEffect(() => {
    setApercu(null);
    setF((x) => ({ ...x, journalReceveurId: journalPropose(receveur), compteLiaisonReceveurId: liaisonProposee(receveur) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receveurId]);

  const champ = (cle: keyof typeof f, valeur: string) => {
    setApercu(null);
    setF((x) => ({ ...x, [cle]: valeur }));
  };
  const corps = () => ({ dossierCedantId: cedantId, dossierReceveurId: receveurId, ...f, referencePiece: f.referencePiece.trim() });
  cleCourante.current = cleApercu(corps());
  const complet = !!(cedantId && receveurId && f.immobilisationId && f.date && f.referencePiece.trim() && f.datePiece && f.journalCedantId && f.journalReceveurId && f.compteLiaisonCedantId && f.compteLiaisonReceveurId);

  const valider = () => {
    if (!complet) {
      setErreur('Tous les champs se renseignent · les deux dossiers, le bien, la date, la pièce, les deux journaux et les deux comptes de liaison.');
      return;
    }
    if (enApercu) return;
    if (!apercu || cleMontree !== cleCourante.current) {
      const envoye = corps();
      const cleEnvoyee = cleApercu(envoye);
      void (async () => {
        setErreur(null);
        setApercu(null);
        setEnApercu(true);
        try {
          const r = await api.post<{ montants: MontantsTransfert }>('/immobilisations/transferts-groupe/apercu', envoye);
          if (cleEnvoyee !== cleCourante.current) return;
          setApercu(r.montants);
          setCleMontree(cleEnvoyee);
        } catch (e) {
          if (cleEnvoyee !== cleCourante.current) return;
          setErreur(e instanceof ApiError ? e.message : 'Aperçu refusé.');
        } finally {
          setEnApercu(false);
        }
      })();
      return;
    }
    void envoyer(() => api.post('/immobilisations/transferts-groupe', corps()));
  };

  return (
    <ModalePaie
      titre="Transférer un bien dans le groupe"
      envoi={envoi || enApercu}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi || enApercu} onFermer={onFermer} valider={apercu && cleMontree === cleCourante.current ? 'Transférer' : 'Aperçu'} />}
    >
      <ChampPaie libelle="Dossier qui cède">
        <select
          value={cedantId}
          onChange={(e) => {
            setCedantId(e.target.value);
            setReceveurId(receveurPreselectionne(contexte.dossiers, e.target.value));
          }}
          className={CHAMP_PAIE}
        >
          {contexte.dossiers.map((d) => (
            <option key={d.id} value={d.id}>{d.nom}{d.siege ? ' (siège)' : ''}</option>
          ))}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Dossier qui reçoit">
        <select value={receveurId} onChange={(e) => setReceveurId(e.target.value)} className={CHAMP_PAIE}>
          <option value="">Choisir…</option>
          {receveurs.map((d) => (
            <option key={d.id} value={d.id}>{d.nom}{d.siege ? ' (siège)' : ''}</option>
          ))}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Bien">
        <select value={f.immobilisationId} onChange={(e) => champ('immobilisationId', e.target.value)} className={CHAMP_PAIE} disabled={!biens}>
          <option value="">{biens === null ? (erreurBiens ? 'Biens non lus' : 'Lecture…') : biens.biens.length === 0 ? 'Aucun bien en service dans ce dossier' : 'Choisir…'}</option>
          {biens?.biens.map((b) => (
            <option key={b.id} value={b.id}>{b.compte} · {b.designation}{b.numeroInventaire ? ` (${b.numeroInventaire})` : ''}</option>
          ))}
        </select>
      </ChampPaie>
      {erreurBiens && <div role="alert" className="text-danger">{erreurBiens}</div>}
      {biens?.tronque && <div className="text-text-dim">Liste tronquée · seuls les premiers biens sont proposés.</div>}
      <ChampPaie libelle="Date du transfert">
        <input type="date" value={f.date} onChange={(e) => champ('date', e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Pièce commune">
        <input maxLength={60} value={f.referencePiece} onChange={(e) => champ('referencePiece', e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Date de la pièce">
        <input type="date" value={f.datePiece} onChange={(e) => champ('datePiece', e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
      <ChampPaie libelle="Journal du dossier qui cède">
        <select value={f.journalCedantId} onChange={(e) => champ('journalCedantId', e.target.value)} className={CHAMP_PAIE}>
          <option value="">{cedant && cedant.journaux.length === 0 ? "Aucun journal d'opérations diverses" : 'Choisir…'}</option>
          {cedant?.journaux.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.intitule}</option>)}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Liaison du dossier qui cède">
        <select value={f.compteLiaisonCedantId} onChange={(e) => champ('compteLiaisonCedantId', e.target.value)} className={CHAMP_PAIE}>
          <option value="">{cedant && cedant.comptesLiaison.length === 0 ? 'Aucun compte 184 ou 185 · ouvrez-le dans le plan comptable' : 'Choisir…'}</option>
          {cedant?.comptesLiaison.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.intitule}</option>)}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Journal du dossier qui reçoit">
        <select value={f.journalReceveurId} onChange={(e) => champ('journalReceveurId', e.target.value)} className={CHAMP_PAIE} disabled={!receveur}>
          <option value="">{!receveur ? "Choisissez d'abord le dossier qui reçoit" : receveur.journaux.length === 0 ? "Aucun journal d'opérations diverses" : 'Choisir…'}</option>
          {receveur?.journaux.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.intitule}</option>)}
        </select>
      </ChampPaie>
      <ChampPaie libelle="Liaison du dossier qui reçoit">
        <select value={f.compteLiaisonReceveurId} onChange={(e) => champ('compteLiaisonReceveurId', e.target.value)} className={CHAMP_PAIE} disabled={!receveur}>
          <option value="">{!receveur ? "Choisissez d'abord le dossier qui reçoit" : receveur.comptesLiaison.length === 0 ? 'Aucun compte 184 ou 185 · ouvrez-le dans le plan comptable' : 'Choisir…'}</option>
          {receveur?.comptesLiaison.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.intitule}</option>)}
        </select>
      </ChampPaie>
      {apercu && cleMontree === cleCourante.current && (
        <div role="status" aria-live="polite" className="border border-border">
          <div className="grid grid-cols-2 gap-x-3 px-2 py-1">
            <span className="text-text-dim">Valeur d'entrée</span>
            <span className="text-right tabular-nums">{montants.montant(apercu.valeurOrigine)}</span>
            <span className="text-text-dim">Dotation jusqu'au transfert</span>
            <span className="text-right tabular-nums">{montants.montant(apercu.complementDotation)}</span>
            <span className="text-text-dim">Amortissements transférés</span>
            <span className="text-right tabular-nums">{montants.montant(apercu.amortissements)}</span>
            <span className="text-text-dim">Dépréciations transférées</span>
            <span className="text-right tabular-nums">{montants.montant(apercu.depreciations)}</span>
            <span className="font-semibold">Valeur nette aux comptes de liaison</span>
            <span className="text-right tabular-nums font-semibold">{montants.montant(apercu.valeurNette)}</span>
          </div>
        </div>
      )}
    </ModalePaie>
  );
}

function ModaleAnnulation({ transfert, onFermer, onFait }: { transfert: TransfertListe; onFermer: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const valider = () => {
    if (motif.trim().length < 3) {
      setErreur("Un transfert s'annule avec son motif.");
      return;
    }
    void envoyer(() => api.post(`/immobilisations/transferts-groupe/${transfert.transfertId}/annulation`, { motif: motif.trim() }));
  };
  return (
    <ModalePaie
      titre={`Annuler le transfert · ${transfert.designation}`}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi} onFermer={onFermer} valider="Annuler le transfert" />}
    >
      <ChampPaie libelle="Motif">
        <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP_PAIE} />
      </ChampPaie>
    </ModalePaie>
  );
}

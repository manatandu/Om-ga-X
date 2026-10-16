import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { ecouterEchap } from '../../lib/echap';
import type { EtatSurSite } from '../../lib/sur-site';
import { identiteConstruction, ligneLangue, ligneMiseEnProduction, ligneVersion } from '../../lib/version';
import { BlocMarqueOmegaX } from './Logo';
import { PortailModale } from '../PortailModale';

/**
 * DIVISION SYCEBNL / SYSCOHADA · la boîte annonçait « référentiel SYCEBNL »
 * à tout dossier, y compris à une société commerciale tenue en SYSCOHADA.
 * OmegaX sert les deux référentiels de l'OHADA · la ligne nomme celui du
 * dossier ouvert, et se contente de « OHADA » tant qu'aucun dossier ne l'est.
 */
const LIBELLE_REFERENTIEL: Record<string, string> = {
  SYCEBNL: 'référentiel SYCEBNL (entités à but non lucratif)',
  SYSCOHADA: 'référentiel SYSCOHADA révisé (entités à but lucratif)',
};

export function AProposModale({ onFermer }: { onFermer: () => void }) {
  const { utilisateur } = useAuth();
  const referentiel = utilisateur?.tenant.referentiel;
  // La date du paquet, que seul un poste sur site connaît (audit final F180).
  const [datePaquet, setDatePaquet] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    api
      .get<EtatSurSite>('/sur-site/etat')
      .then((e) => vivant && e.surSite && setDatePaquet(e.dateVersion ?? null))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);
  // UNE BOÎTE DE DIALOGUE (second tour de relecture, mineur 10) · Échap la
  // ferme, elle seule (`ecouterEchap`, la couche la plus haute), et le focus va
  // à « Fermer » à l'ouverture, sans quoi le clavier restait sur la fenêtre
  // derrière le voile.
  const refFermer = useRef<HTMLButtonElement>(null);
  // La dernière fonction de fermeture, lue au moment d'Échap · les appelants
  // la passent en flèche, nouvelle à chaque rendu, et l'effet ne doit pas
  // reprendre le focus à chaque rendu du parent.
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    refFermer.current?.focus({ preventScroll: true });
    return ecouterEchap(() => {
      fermer.current();
      return true;
    });
  }, []);
  return (
    <PortailModale>
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onFermer}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apropos-titre"
          className="bg-surface border border-border-dark w-[360px] shadow-none modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-chrome border-b border-border px-3 py-2 flex items-center justify-between">
            <span id="apropos-titre" className="text-[11.5px] font-bold">
              À propos d'OmegaX
            </span>
            <button onClick={onFermer} aria-label="Fermer la boîte À propos" className="text-text-dim hover:text-text text-[12px] leading-none px-1">
              ✕
            </button>
          </div>
          <div className="p-4 text-[11.5px] space-y-2">
            {/*
              La boîte « À propos » est le seul écran dont le SUJET est le
              logiciel lui-même : c'est la place du bloc complet, signe et mot
              dans leur rapport figé. Ailleurs le signe suffit, le nom étant
              déjà écrit à côté.
            */}
            <BlocMarqueOmegaX hauteur={26} className="text-[color:var(--a-900)] mb-3" />
            {/* Le filet de clôture · il sépare la marque de ce qui la décrit. */}
            <hr className="filet-cloture text-text-dim !mb-3" />
            <p className="text-text-dim">
              Logiciel de comptabilité OHADA
              {referentiel && LIBELLE_REFERENTIEL[referentiel] ? ` · ${LIBELLE_REFERENTIEL[referentiel]}` : ''}.
            </p>
            <p className="text-text-dim">{ligneVersion(identiteConstruction(), datePaquet)}</p>
            {/* Mise en production et langue (demande de Manasse du
                2026-10-15) · comme la page « À propos » d'Odoo, qui dit
                l'édition, la version et l'échéance de la base, et la boîte
                « About » de Frappe, qui dit chaque version installée · ce
                qui n'est pas connu est dit, jamais remplacé. */}
            <p className="text-text-dim">{ligneMiseEnProduction(identiteConstruction())}</p>
            <p className="text-text-dim">{ligneLangue()}</p>
            <p className="text-text-dim">© VMG Consulting · logiciel protégé par le droit d’auteur.</p>
          </div>
          <div className="border-t border-border px-3 py-2 flex justify-end">
            <button ref={refFermer} onClick={onFermer} className="bg-sel text-white text-[11.5px] font-semibold px-3 py-1">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </PortailModale>
  );
}

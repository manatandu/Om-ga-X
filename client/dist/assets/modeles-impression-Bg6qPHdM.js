const n={EXTRAIT:"Extrait de compte",REGLEMENT:"Avis de règlement",RAPPEL:"Rappel"},a=Object.keys(n),o=100,r=35,l=4e3,d={EXTRAIT:"Le relevé de Rappel et relevé, à l’écran et en courrier.",REGLEMENT:"L’avis de règlement d’un ordre de virement imprimé.",RAPPEL:"La relance préventive et les rappels."},i={EXTRAIT:"modeleImpressionExtraitId",REGLEMENT:"modeleImpressionReglementId",RAPPEL:"modeleImpressionRappelId"};function c(t,s){return t.filter(e=>e.nature===s).sort((e,E)=>e.intitule.localeCompare(E.intitule,"fr"))}const L=`À l’attention de {contact}
{tiers}
{adresse}

{document}`,m="{document} le document composé par OmegaX, exigé une fois · {tiers} le nom du tiers · {code} son code · {qualite} sa qualité · {contact} la personne à qui la lettre s’adresse · {adresse} l’adresse de la fiche · {entite} le nom du dossier · {date} le jour du document.";export{m as A,n as L,a as N,d as O,o as P,L as T,i as Z,r as a,l as b,c as m};

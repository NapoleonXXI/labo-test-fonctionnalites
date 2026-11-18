import { sb } from '../sb.js?v=1795024118';
import { state, assigneeName, isManager, isRealAdmin, memberName, role, ROLE_NAMES, compactName, roleKind } from '../state.js?v=1795024118';
import { $, $$, esc, errMsg, statusPill, fmtCreated, fmtAgo, fmtDate, fmtDateTime, PRIORITY, WRENCH, BRIEFCASE, STATUS, ROLES, CLOCK, confirmBox, toast, n2, stackSticky, ACTMSG } from '../ui.js?v=1795024118';
import { go, render } from '../app.js?v=1795024118';
import * as form from './form.js?v=1795024118';

// Liste unique (lot 13) : mes interventions, signalées, prises par les autres, brouillons, puis terminées repliées.
const STATUSES = ['publiee', 'prise_en_charge', 'resolue', 'validee'];

// Filtres de la recherche développée (aucun coché = tous les champs).
const SF = { titre: 'Titre', lieu: 'Lieu', desc: 'Description', tech: 'Technicien', rep: 'Signalé par', statut: 'Statut', date: 'Date' };
const RKEY = 'gi-recent-search';
const recent = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch { return []; } };
const remember = t => { if (t.length < 2) return; localStorage.setItem(RKEY, JSON.stringify([t, ...recent().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))); };

let DONE = false;
// Lot 89 : mobile, liste gardée en mémoire et position de défilement restaurée au retour du détail.
let LASTF = null, MCACHE = {}, MY = null;
// Lot 106 : rechargement de la liste demandé par le volet (changement de statut) ; et nouveau rendu quand la disposition change (colonnes ↔ liste), cause des cartes pleine largeur.
addEventListener('gi:reload', () => { if (LASTF && $('#rows')) load(...LASTF); });
{ let lay = null; const L = () => !document.body.classList.contains('tech') && innerWidth > 600; addEventListener('resize', () => { const v = L(); if (lay !== null && v !== lay && LASTF && $('#rows')) load(...LASTF); lay = v; }); new MutationObserver(() => { const v = L(); if (lay !== null && v !== lay && LASTF && $('#rows')) load(...LASTF); lay = v; }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); lay = L(); }
const mscr = () => (innerWidth > 600 && document.getElementById('app')) || document.scrollingElement; // Lot 98 : en mobile simulé, #app défile (pied de page fixe).
export async function view(app, { q, done = false }) {
  CLOSED = { resolue: true, prog: done || document.body.classList.contains('tech') || innerWidth <= 600 || role() === 'client' };
  DONE = done;
  const searching = !done && q.has('recherche') && role() !== 'client';
  const f = { texte: q.get('texte') || '', sf: (q.get('sf') || '').split(',').filter(k => SF[k]) };

  app.innerHTML = `
    <div class="page">
      <div class="head${role() === 'client' ? ' hcli' : ''}">
        <h1>${done ? 'Interventions terminées' : 'Interventions'}</h1>
        ${done ? '' : '<a class="btn primary" href="#/nouvelle">Nouvelle intervention</a>'}
      </div>
      ${searching ? `<div class="tsearch" id="zq" contenteditable="plaintext-only" role="textbox" aria-label="Rechercher" data-ph="Rechercher" inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true">${esc(f.texte)}</div>
      <div class="sfilters" role="group" aria-label="Filtres de recherche">${Object.entries(SF).map(([k, v]) => `<button type="button" class="sf${f.sf.includes(k) ? ' on' : ''}" data-sf="${k}" aria-pressed="${f.sf.includes(k)}">${v}</button>`).join('')}</div>` : ''}
      ${searching ? '<p class="shint">Plusieurs mots : toutes les interventions qui contiennent chacun d\'eux. Accents et majuscules ignorés.</p><div class="scount" id="scount"></div>' : ''}
      <div id="rows">${searching && !f.texte ? '' : (!searching && document.body.classList.contains('tech') && MCACHE[+done]) || '<p class="muted">Chargement…</p>'}</div>
    </div>`;

  let t;
  const apply = () => {
    const p = new URLSearchParams();
    if (searching) p.set('recherche', '1');
    if (f.texte) p.set('texte', f.texte);
    if (f.sf.length) p.set('sf', f.sf.join(','));
    history.replaceState(null, '', '#/interventions?' + p);
    load(f, searching);
  };
  const ts = $('#zq');
  if (ts) {
    ts.oninput = () => { if (!ts.textContent) ts.innerHTML = ''; f.texte = ts.textContent.trim(); clearTimeout(t); t = setTimeout(apply, 250); };
    ts.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); remember(f.texte); ts.blur(); } };
    ts.onblur = () => remember(f.texte);
    if (!f.texte) ts.focus();
    $$('.sfilters .sf').forEach(bt => (bt.onclick = () => {
      const k = bt.dataset.sf, on = !f.sf.includes(k);
      f.sf = on ? [...f.sf, k] : f.sf.filter(x => x !== k);
      bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', String(on));
      apply();
    }));
  }
  if (MY != null && $('#rows .group')) mscr().scrollTop = MY;
  await load(f, searching);
  // Lot 127 : après une actualisation pendant une création, formulaire remis à zéro et avertissement.
  sessionStorage.removeItem('gi:nwlost'); // Lot 130 : plus de message ni de réouverture après une actualisation.
}

// Dates en français : « 14 novembre », « 14 nov », « novembre », « 14/11 », « 14/11/2026 »…
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
function dateForms(iso) {
  const x = new Date(iso), d = x.getDate(), m = x.getMonth() + 1, y = x.getFullYear(), M = MOIS[m - 1];
  const p = n => String(n).padStart(2, '0');
  return [`${d} ${M} ${y}`, `${p(d)} ${M} ${y}`, `${d} ${M.slice(0, 3)} ${y}`, `${p(d)}/${p(m)}/${y}`, `${d}/${m}/${y}`, `${p(d)}-${p(m)}-${y}`, `${y}-${p(m)}-${p(d)}`, `${d}/${p(m)}/${y}`, `${p(d)}/${m}/${y}`];
}

// Texte replié (minuscules, sans accents) caractère par caractère : mêmes positions que l'original.
const fold = t => Array.from(String(t || ''), c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()[0] || c).join('');
const terms = txt => fold(txt).split(/\s+/).filter(Boolean);
const STATUT_TXT = { brouillon: 'brouillon', publiee: 'signale nouveau nouvelle a prendre', prise_en_charge: 'en cours pris', resolue: 'termine resolu', validee: 'valide termine' };
// Champs consultables d'une intervention.
function fields(r) {
  const e = REP[r.id];
  return {
    titre: r.title, lieu: r.location, desc: r.description,
    tech: r.assignee_id ? who(r) : '',
    rep: e ? `${e.actor_name || ''} ${ROLES[e.actor_role] || ''}` : '',
    statut: `${STATUS[r.status] || ''} ${STATUT_TXT[r.status] || ''}`,
  };
}
function dateHit(r, q) {
  const qn = norm(q).replace(/\b1er\b/, '1');
  return [r.created_at, r.updated_at, r.validated_at].filter(Boolean).some(d => dateForms(d).some(x => x.startsWith(qn) || x.includes(' ' + qn) || x.includes('/' + qn)));
}
function termHit(r, t, sf, F) {
  const on = k => !sf.length || sf.includes(k);
  if (Object.keys(F).some(k => on(k) && fold(F[k]).includes(t))) return true;
  if (on('lieu') && /^\d+$/.test(t) && (String(r.location || '').match(/\d+/g) || []).includes(t)) return true;
  return on('date') && dateHit(r, t);
}
// Correspondance : la phrase entière (utile pour les dates) ou chacun des mots.
function matches(r, txt, sf) {
  const F = fields(r), ts = terms(txt);
  if (!ts.length) return true;
  if ((!sf.length || sf.includes('date')) && dateHit(r, txt)) return true;
  return ts.every(t => termHit(r, t, sf, F));
}

// Volet « Terminées » replié par défaut à chaque ouverture de la liste.
let CLOSED = { resolue: true, prog: true };
async function load(f, searching) {
  const box = $('#rows'); LASTF = [f, searching];
  if (searching && !f.texte) {
    const sc = $('#scount'); if (sc) sc.textContent = '';
    const rc = recent();
    if (box) {
      box.classList.remove('srch');
      box.innerHTML = rc.length ? `<div class="srecent">Recherches récentes ${rc.map(x => `<button type="button" data-r="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
      $$('.srecent button').forEach(bt => (bt.onclick = () => { const z = $('#zq'); z.textContent = bt.dataset.r; z.dispatchEvent(new Event('input')); }));
    }
    return;
  }
  const cols = 'id, title, location, description, status, priority, assignee_id, assignee_role, proposed_to, assigned_by, available_from, available_until, remind_minutes, created_at, updated_at, validated_at, resolved_at, created_by';
  const me = (await sb.auth.getUser()).data.user.id; ME = me;
  let { data, error } = await sb.from('interventions').select(cols).in('status', STATUSES).order('created_at', { ascending: false }).limit(500);
  if (!error && (isManager() || role() === 'technicien')) {
    let q = sb.from('interventions').select(cols).eq('status', 'brouillon'); if (!isManager()) q = q.eq('created_by', me);
    const r = await q.order('created_at', { ascending: false }).limit(300);
    if (r.error) error = r.error; else data = data.concat(r.data);
  }
  if (!box || !$('#rows')) return;
  box.classList.toggle('dn', DONE);
  if (error) { box.innerHTML = `<p class="err">${esc(errMsg(error))}</p>`; return; }
  // Client : uniquement ses propres signalements (la RLS le garantit aussi).
  if (role() === 'client') data = (data || []).filter(r => r.created_by === me);
  // Auteur du signalement (étiquette du haut + recherche « Signalé par »).
  const { data: phr } = await sb.from('intervention_photos').select('intervention_id').limit(5000);
  PHI = new Set((phr || []).map(x => x.intervention_id));
  REP = {};
  const { data: ev } = await sb.from('intervention_events').select('intervention_id, type, actor_name, actor_role').in('type', ['creee', 'publiee']).order('created_at').limit(5000);
  (ev || []).forEach(e => { if (!REP[e.intervention_id] || e.type === 'creee') REP[e.intervention_id] = e; });
  // Lot 64 : messages non lus du tchat par intervention (même règle que le détail).
  UNR = {}; TOT = {};
  { const { data: rd } = await sb.from('intervention_reads').select('intervention_id, last_read_at').eq('user_id', me);
    const lr = Object.fromEntries((rd || []).map(x => [x.intervention_id, x.last_read_at]));
    const { data: ce } = await sb.from('intervention_events').select('intervention_id, type, body, created_at, actor_id, actor_role').in('type', ['commentaire', 'photo']).limit(5000);
    // Lot 88 : la bulle de création (description, photos envoyées avec le formulaire) n'est pas un commentaire.
    const IR = Object.fromEntries((data || []).map(r => [r.id, r]));
    const isCrea = e => { const r = IR[e.intervention_id]; if (!r || e.actor_id !== r.created_by) return false; return e.type === 'commentaire' ? !!String(r.description || '').trim() && String(e.body || '').trim() === String(r.description).trim() : new Date(e.created_at) - new Date(r.created_at) < 120000; };
    (ce || []).filter(e => !isCrea(e)).forEach(e => { TOT[e.intervention_id] = (TOT[e.intervention_id] || 0) + 1; if (e.actor_id === me && (!isRealAdmin() || !e.actor_role || e.actor_role === role())) return; const l = lr[e.intervention_id]; if (!l || e.created_at > l) UNR[e.intervention_id] = (UNR[e.intervention_id] || 0) + 1; }); }
  if (!$('#rows')) return;
  // Heure de passage : les interventions programmées restent visibles ; seul « Commencer » attend le déverrouillage.
  if (searching) {
    data = data.filter(r => matches(r, f.texte, f.sf));
  }
  // Compte admin : « à moi » seulement sous le profil qui a pris l'intervention.
  const mine = r => r.assignee_id === me && (!isRealAdmin() || r.assignee_role === role());
  // Assignée à moi, pas encore acceptée (compte admin : au profil simulé du même rôle).
  // Lot 83 : mobile, seules les programmées des jours suivants restent dans leur onglet ; le jour J elles rejoignent les autres piles.
  const mob = document.body.classList.contains('tech') || innerWidth <= 600;
  const S = r => mob ? future(r) : sched(r);
  const pmine = r => r.status === 'publiee' && !S(r) && !!r.proposed_to && ['technicien', 'responsable_tech'].includes(role()) && (r.proposed_to === me || (isRealAdmin() && ROLE_OF(r.proposed_to) === role()));
  const open = data.filter(r => !['resolue', 'validee'].includes(r.status));
  // Directeur / RT : interventions qu'ils ont assignées à quelqu'un.
  const dem = ['directeur', 'responsable_tech'].includes(role());
  const asked = r => dem && r.assigned_by === me && !mine(r) && !pmine(r) && !S(r);
  // Lot 54 : programmée assignée, le jour venu → « En cours » pour les autres profils.
  const sOn = () => false; // Lot 61 : les programmées restent dans leur colonne.
  const groups = [
    ['mes', 'Mes interventions', open.filter(r => (r.status === 'prise_en_charge' && mine(r)) || pmine(r)).sort(byArrival)],
    ['dem', 'Mes demandes d\'intervention', open.filter(asked)],
    ['publiee', 'Nouvelles interventions', open.filter(r => r.status === 'publiee' && !S(r) && !pmine(r) && !asked(r)).sort(byArrival)],
    ['prog', 'Présence client requise', open.filter(S).sort((a, b) => future(a) !== future(b) ? (future(a) ? 1 : -1) : future(a) ? new Date(a.available_from) - new Date(b.available_from) : byArrival(a, b))],
    ['prise_en_charge', ['technicien', 'responsable_tech'].includes(role()) ? 'Autres interventions en cours' : 'En cours', open.filter(r => (r.status === 'prise_en_charge' && !mine(r) && !asked(r)) || sOn(r)).sort(byArrival)],
    ['brouillon', 'Brouillons', open.filter(r => r.status === 'brouillon')],
    // Lot 60 : les terminées ont leur propre page (restent trouvables par la recherche).
    ...(searching ? [['resolue', 'Terminées', data.filter(r => ['resolue', 'validee'].includes(r.status))]] : []),
  ].filter(([k, , rows]) => (k !== 'mes' || rows.length) && k !== 'prog' && (k !== 'dem' || dem) && (k !== 'brouillon' || isManager() || role() === 'technicien'));
  // Lot 83 : mobile, l'onglet des programmées tout en bas du feed.
  if (mob) { const i = groups.findIndex(g => g[0] === 'prog'); if (i >= 0) groups.push(...groups.splice(i, 1)); }
  if (DONE) {
    const fin = r => new Date(r.resolved_at || r.validated_at || r.updated_at);
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const all = data.filter(r => ['resolue', 'validee'].includes(r.status)).sort((a, b) => fin(b) - fin(a));
    // Lot 114 : « Terminées cette semaine » (lundi → hier) entre aujourd'hui et les autres.
    const w0 = new Date(d0); w0.setDate(w0.getDate() - (w0.getDay() + 6) % 7);
    groups.splice(0, groups.length, ['auj', 'Terminé aujourd\'hui', all.filter(r => fin(r) >= d0)], ['sem', 'Terminées cette semaine', all.filter(r => fin(r) < d0 && fin(r) >= w0)], ['avant', 'Autres interventions terminées', all.filter(r => fin(r) < w0)]);
  }
  // Client : une seule catégorie, ses propres commandes.
  if (role() === 'client' && !DONE) groups.splice(0, groups.length, ['dem', 'Mes demandes d\'intervention', data]);
  const hl = searching ? f.texte : '';
  // Recherche : une seule liste, sans titres de volets.
  if (searching) {
    const all = groups.flatMap(g => g[2]);
    box.innerHTML = all.length ? table(all, hl, f.sf) : '';
    box.classList.add('srch');
    const sc = $('#scount'); if (sc) sc.textContent = all.length ? `${all.length} résultat${all.length > 1 ? 's' : ''}` : 'Aucun résultat';
  } else {
    box.classList.remove('srch');
    // Lot 55 : version standard, 3 colonnes (Nouvelles | En cours | Programmées + Terminées) ; seule « Terminées » se plie.
    const std = !DONE && !document.body.classList.contains('tech') && innerWidth > 600 && role() !== 'client';
    const fold = k => document.body.classList.contains('tech') || (DONE && ['auj', 'sem', 'avant'].includes(k)); // Lot 96 : sous-catégories des terminées pliables partout. // Lot 91 : catégories pliables seulement sur mobile.
    const sec = ([k, label, rows]) => `<section class="group${fold(k) && CLOSED[k] ? ' closed' : ''}" data-g="${k}"><h2${fold(k) ? ` role="button" tabindex="0" aria-expanded="${!CLOSED[k]}"` : ''}><span class="glab">${label}</span>${DONE ? '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' : ` <span class="count">${rows.length}</span>`}</h2>
      ${!rows.length ? '' : k === 'sem' ? days(rows) : table(rows)}</section>`;
    const shown = groups.filter(g => g[2].length || DONE || (std && g[0] === 'prog'));
    const COL = { mes: 0, dem: 0, publiee: 0, prise_en_charge: 1, brouillon: 1, prog: 2, resolue: 2 };
    box.innerHTML = std ? `<div class="gcols">${[0, 1, 2].map(c => `<div class="gcol">${shown.filter(g => COL[g[0]] === c).map(sec).join('')}</div>`).join('')}</div>` : DONE && !document.body.classList.contains('tech') && innerWidth > 600 ? `<div class="gcols gdone">${['auj', 'sem', 'avant'].map(k => `<div class="gcol">${shown.filter(g => g[0] === k).map(sec).join('')}</div>`).join('')}</div>` : shown.map(sec).join(''); // Lot 102 : terminées, défilement interne comme les colonnes.
    // Lot 65 : vue standard, bouton « Nouvelle intervention » au-dessus de « Nouvelles interventions », sans titre de page.
    { const hd = $('.page > .head'), hb = hd && hd.querySelector('.btn'); if (hd) hd.style.display = ''; if (hb) hb.style.display = ''; // Lot 97 : titre et bouton sur la même ligne. // Lot 94 : titre « Interventions » réaffiché.
    }
    // Lot 74 : hauteur des colonnes = bas de l'écran (défilement propre à chaque colonne).
    { const g = $('.gcol'); if (g) document.documentElement.style.setProperty('--gtop', Math.round(g.getBoundingClientRect().top + window.scrollY + 16) + 'px'); }
    $$('.gcol').forEach(c => stackSticky(c, '.group > h2', 8));
    gsbars();
    $$('#rows .group h2[role=button]').forEach(h => (h.onclick = h.onkeydown = e => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      // Lot 83 : seuls le texte et la pastille plient / déplient.
      if (e.type === 'click' && !e.target.closest('.glab, .count, .chev')) return;
      e.preventDefault();
      const g = h.parentElement, k = g.dataset.g;
      CLOSED[k] = !g.classList.contains('closed');
      g.classList.toggle('closed', CLOSED[k]);
      h.setAttribute('aria-expanded', String(!CLOSED[k]));
    }));
  }
  // Mobile : gris tant que le doigt est sur la ligne (survol souris en version standard).
  $$('#rows tr[data-id]').forEach(tr => {
    let t = null, x0 = 0, y0 = 0; const off = () => { clearTimeout(t); tr.classList.remove('press'); };
    // Gris différé (comme iOS) : un défilement qui démarre ne repeint pas la ligne.
    tr.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; clearTimeout(t); t = setTimeout(() => tr.classList.add('press'), 90); }, { passive: true });
    // Petit tremblement du doigt toléré ; un vrai défilement annule.
    tr.addEventListener('touchmove', e => { if (Math.hypot(e.touches[0].clientX - x0, e.touches[0].clientY - y0) > 10) off(); }, { passive: true });
    ['touchend', 'touchcancel'].forEach(k => tr.addEventListener(k, off, { passive: true }));
    // Lot 84 : survol souris (iPad avec trackpad compris) → carte mise en évidence.
    tr.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') tr.classList.add('hov'); });
    tr.addEventListener('pointerleave', () => tr.classList.remove('hov'));
  });
  // Lot 61 : vue standard, le détail se déplie sous sa carte (même largeur) au lieu d'ouvrir une page.
  const inl = !searching && !document.body.classList.contains('tech') && innerWidth > 600 && role() !== 'client';
  // Lot 71 : module du détail préchargé, données lancées dès l'appui (pointerdown).
  const dmod = import('./detail.js?v=1795024118');
  $$('#rows tr[data-id]').forEach(tr => tr.addEventListener('pointerdown', () => { if (!tr.classList.contains('xopen')) dmod.then(m => m.prefetch(tr.dataset.id)); }));
  { const ids = $$('#rows tr[data-id]').map(t => t.dataset.id); setTimeout(() => dmod.then(m => m.warm(ids)), 300); }
  qaInit();
  if (document.body.classList.contains('tech')) { if (MY != null) { mscr().scrollTop = MY; MY = null; } if (!searching) MCACHE[+DONE] = box.innerHTML; }
  // Lot 82 : « Nouvelle intervention » s'ouvre en fenêtre par-dessus la liste (reste grisé).
  $$('#rows tr[data-id]').forEach(tr => (tr.onclick = async () => {
    if (inl) {
      const was = tr.classList.contains('xopen'), y = scrollY;
      // Lot 89c : colonne qui défile seule ; la fermeture laisse tout en place, l'ouverture remonte le fil pour montrer la carte entière.
      const col = tr.closest('.gcol'), cy = col ? col.scrollTop : 0;
      // Lot 65 : la page garde sa hauteur à la fermeture, sinon le navigateur la remonte (recentrage).
      // Lot 93 : la fermeture se replie (même durée que l'ouverture), rien d'autre ne bouge.
      if (was) { const xr = tr.nextElementSibling, xd = xr?.querySelector('.xdet'); if (!xd || tr._anim) return; const H = xd.offsetHeight; tr._anim = 1;
        fold3(XDUR, k => (xd.style.height = H * (1 - k) + 'px'), () => { xr.remove(); tr.classList.remove('xopen'); tr._anim = 0; }); return; }
      const t0 = tr.getBoundingClientRect().top, xo = $('#rows tr.xrow'), xoh = xo && col && xo.closest('.gcol') === col ? xo.offsetHeight : 0;
      // Lot 92 : plus d'espace ajouté en bas ; le défilement reste borné à la dernière carte.
      $$('#rows tr.xrow').forEach(x => x.remove()); $$('#rows tr.xopen').forEach(x => x.classList.remove('xopen'));
      if (col) { col.scrollTop = cy; const dt = tr.getBoundingClientRect().top - t0; if (dt) col.scrollTop += dt; }
      tr.classList.add('xopen');
      { const tb = tr.closest('table'); if (tb && tb.style.tableLayout !== 'fixed') { const r0 = tb.rows[0]; const ws = [...r0.cells].map(c => c.getBoundingClientRect().width); [...r0.cells].forEach((c, i) => c.style.width = ws[i] + 'px'); tb.style.width = tb.getBoundingClientRect().width + 'px'; tb.style.tableLayout = 'fixed'; } }
      tr.insertAdjacentHTML('afterend', '<tr class="xrow"><td colspan="4"><div class="xdet"></div></td></tr>');
      const { view: dv, prefetch } = await dmod; prefetch(tr.dataset.id);
      const xr = tr.nextElementSibling; await dv(xr.querySelector('.xdet'), { id: tr.dataset.id, inline: true });
      if (col && tr.classList.contains('xopen')) requestAnimationFrame(() => { const xd = xr.querySelector('.xdet'), H = xd.offsetHeight, c = col.getBoundingClientRect(), t = tr.getBoundingClientRect(), b = xr.getBoundingClientRect(), gs = [...col.querySelectorAll('.group')], gi = gs.indexOf(tr.closest('.group')), top = c.top + gs.slice(0, gi + 1).reduce((n, g) => n + (g.querySelector(':scope > h2')?.offsetHeight || 0) + 8, 0);
        const d = b.bottom - c.bottom > 0 ? Math.min(b.bottom - c.bottom + 8, t.top - top - 8) : t.top < top ? t.top - top - 8 : 0; const s0 = col.scrollTop; xd.style.height = '0px';
        fold3(XDUR, k => { xd.style.height = H * k + 'px'; if (d) col.scrollTop = s0 + d * k; }, () => (xd.style.height = '')); });
      return;
    }
    MY = mscr().scrollTop; MCACHE[+DONE] = $('#rows').innerHTML;
    go('intervention/' + tr.dataset.id);
  }));
}

// Lot 93 : dépliage / repliage du détail, une seule courbe (hauteur et défilement ensemble).
const XDUR = 320;
function fold3(ms, step, done) { const t0 = performance.now(); const f = now => { const x = Math.min(1, (now - t0) / ms), k = x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; step(k); if (x < 1) requestAnimationFrame(f); else done && done(); }; requestAnimationFrame(f); }

// Met en évidence chacun des mots recherchés (sans tenir compte des accents).
function mark(txt, q) {
  const s = String(txt || ''), ts = q ? terms(q) : [];
  if (!ts.length) return esc(s);
  const f = fold(s), on = new Array(s.length).fill(false);
  ts.forEach(t => { let i = f.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) on[k] = true; i = f.indexOf(t, i + t.length); } });
  let out = '', open = false;
  for (let k = 0; k < s.length; k++) {
    if (on[k] !== open) { out += on[k] ? '<mark>' : '</mark>'; open = on[k]; }
    out += esc(s[k]);
  }
  return out + (open ? '</mark>' : '');
}
// Extrait de description autour du premier mot trouvé.
function snippet(d, q) {
  const s = String(d || ''), f = fold(s), i = Math.min(...terms(q).map(t => f.indexOf(t)).filter(x => x >= 0));
  if (!isFinite(i)) return '';
  const a = Math.max(0, i - 30), b = Math.min(s.length, i + 80);
  return (a ? '…' : '') + mark(s.slice(a, b), q) + (b < s.length ? '…' : '');
}
// Recherche : ligne des autres champs trouvés (signalé par, technicien, statut).
function extra(r, q, sf) {
  const F = fields(r), ts = terms(q), on = k => !sf.length || sf.includes(k), out = [];
  const hit = v => ts.some(t => fold(v).includes(t));
  const e = REP[r.id];
  if (on('rep') && e && hit(F.rep)) out.push(`<span class="lbl">Signalé par</span> ${mark(compactName(e.actor_name), q)}`);
  if (on('tech') && F.tech && hit(F.tech)) out.push(`<span class="lbl">Technicien</span> ${mark(F.tech, q)}`);
  if (on('statut') && hit(F.statut)) out.push(`<span class="lbl">Statut</span> <mark>${esc(STATUS[r.status] || r.status)}</mark>`);
  if (on('date') && (dateHit(r, q) || ts.some(t => dateHit(r, t)))) out.push(`<span class="lbl">Créée le</span> ${esc(fmtDate(r.created_at))}`);
  return out.join(' · ');
}

function nextDay(d) {
  const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1);
  return x.toISOString().slice(0, 10);
}

export function table(rows, hl = '', sf = []) {
  const sn = r => hl && (!sf.length || sf.includes('desc')) ? snippet(r.description, hl) : '';
  const ex = r => hl ? extra(r, hl, sf) : '';
  return `<table class="list">
    <thead><tr><th>Statut</th><th>Intervention</th><th>Lieu</th><th>Signalement</th></tr></thead>
    <tbody>${rows.map(r => `
            <tr data-id="${r.id}" tabindex="0" class="r-${r.status}${['resolue', 'validee'].includes(r.status) ? ' done' : ''}">
        <td></td>
        <td>${qa(r)}<span class="tl"><span class="t">${mark(r.title, hl)}</span>${PHI.has(r.id) ? CAMI : ''}${chatIco(r.id)}${prio(r) !== 'normale' && prio(r) !== 'basse' ? `<span class="prio p-${prio(r)}">${PRIORITY[prio(r)]}</span>` : ''}</span><span class="sub lago">${r.location ? place(r.location, hl) : ''}${tag(r)}<span class="sdt">${new Date(r.created_at).toDateString() === new Date().toDateString() ? fmtAgo(r.created_at) : fmtCreated(r.created_at)}</span></span>${r.available_from ? `<span class="sub sdl"><span class="sched">${CLOCK}${slot(r)}</span></span>` : ''}${r.scheduled_date ? `<span class="sub">Prévue le ${fmtDate(r.scheduled_date)}</span>` : ''}${sn(r) ? `<span class="sub">${sn(r)}</span>` : ''}${ex(r) ? `<span class="sub">${ex(r)}</span>` : ''}</td>
        <td>${r.location ? place(r.location, hl) : '<span class="muted">—</span>'}</td>
        <td class="tend"></td>
      </tr>`).join('')}</tbody>
  </table>`;
}
// Compte admin : nom du profil qui a pris l'intervention.
const who = r => { const n = assigneeName(r); return r.assignee_role && Object.values(ROLE_NAMES).includes(n) ? ROLE_NAMES[r.assignee_role] : n; };
let REP = {}, UNR = {}, TOT = {};
// Lot 74 : bulle de discussion « … » avec pastille (non lus en rouge, sinon total des commentaires).
const BUB = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><circle cx="8.5" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="15.5" cy="12" r=".6" fill="currentColor"/></svg>';
const cnt = n => n > 99 ? '99+' : n;
const chatIco = id => TOT[id] ? `<span class="cbub${UNR[id] ? ' unr' : ''}" aria-label="${UNR[id] ? UNR[id] + ' non lus' : TOT[id] + ' commentaires'}">${BUB}<b>${cnt(UNR[id] || TOT[id])}</b></span>` : '';
// Version J : signaleur en retrait (petit, en haut) ; dessous, décalée, le technicien en charge, « Nouveau », sinon le statut.
function tag(r) {
  let main;
  if (['prise_en_charge', 'resolue', 'validee'].includes(r.status) && r.assignee_id) main = `<span class="cwho cw-tech st-tag tk">${ico(r.assignee_role || mrole(r.assignee_id))}<span>${esc(who(r))}</span></span>`;
  else if (r.status === 'publiee') main = `${r.proposed_to ? assTag(r.proposed_to) : ''}<span class="pill st-publiee">Nouveau</span>`;
  else main = statusPill(r.status);
  return main; // Lot 73 : commanditaire retiré des listes
}
// Lieu en étiquette : mobil-home → « MH 12 », lieux communs prédéfinis tels quels ; texte libre sans étiquette.
const COMMON = ['réception', 'camp saisonnier', 'sanitaire 1', 'sanitaire 2', 'scène', 'restaurant', 'bar', 'piscine', 'aire de jeux', 'parking', 'local technique'];
function place(l, hl) {
  const v = String(l).trim(), m = v.match(/^(?:mobil[- ]?home|mh)?\s*(\d+)$/i);
  if (m) return `<span class="ltag">${mark(n2(m[1]), hl)}</span>`;
  if (COMMON.includes(v.toLowerCase())) return `<span class="ltag">${mark(v, hl)}</span>`;
  return mark(v, hl);
}
const hm = d => { const x = new Date(d); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
// « Aujourd'hui entre 10:00 et 11:00 », « Demain… », « Après-demain… », sinon la date.
const PHONE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>';
const CAMI = '<span class="tcam" aria-label="Photos"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></span>';
let PHI = new Set();
// Lot 53 : « Aujourd'hui / Demain / Hier entre 17 et 18 h », « Le 20 novembre entre … », plus ancien « Le 12 novembre ».
const hh = d => { const x = new Date(d); return x.getMinutes() ? `${x.getHours()} h ${String(x.getMinutes()).padStart(2, '0')}` : `${x.getHours()}`; };
export const slotTxt = r => slot(r);
const slot = r => {
  const f = new Date(r.available_from), t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(f).setHours(0, 0, 0, 0) - t0) / 864e5);
  const le = `Le ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  if (n < -1) return le;
  const day = { '-1': 'Hier', 0: 'Aujourd\'hui', 1: 'Demain' }[n] || le;
  const a = hh(f), b = r.available_until ? hh(r.available_until) : '';
  const H = x => /h/.test(x) ? x : `${x} h`;
  if (!b) return `${day} à partir de ${H(a)}`;
  return /h/.test(a) || /h/.test(b) ? `${day} entre ${H(a)} et ${H(b)}` : `${day} entre ${a} et ${b} h`;
};
// Lot 54 : programmée dont le jour n'est pas encore arrivé → « Interventions programmées ».
const day0 = d => new Date(d).setHours(0, 0, 0, 0);
// Lot 61 : toute intervention programmée non prise va dans « Interventions programmées » ; celles du jour en tête.
const sched = r => r.status === 'publiee' && !!r.available_from;
const future = r => r.status === 'publiee' && !!r.available_from && day0(r.available_from) > Date.now();
// Arrivée en haut de pile : création, puis (programmées) jour J, H-1 et H-30 min.
const arrival = r => { const c = new Date(r.created_at).getTime(); if (!r.available_from) return c; const f = new Date(r.available_from).getTime(), n = Date.now(); return Math.max(c, ...[day0(f), f - 36e5, f - 18e5].filter(t => t <= n)); };
const byArrival = (a, b) => arrival(b) - arrival(a);
const prio = r => r.priority;
// Trois points : une description a été saisie au signalement.
const DOTS = ' <svg class="dots" width="18" height="6" viewBox="0 0 18 6" aria-label="Description"><circle cx="3" cy="3" r="2"/><circle cx="9" cy="3" r="2"/><circle cx="15" cy="3" r="2"/></svg>';
const ROLE_OF = id => (state.members || []).find(x => x.user_id === id)?.role;
const mrole = id => (state.members || []).find(x => x.user_id === id)?.role;
const ico = ro => roleKind(ro) === 'tech' ? WRENCH : BRIEFCASE;
const assTag = id => `<span class="cwho">${ico(mrole(id))}<span>${esc(memberName(id))}</span></span>`;
const firstName = n => String(n || '').split(/[\s@]/)[0];

// Lot 114 : sous-catégories par jour dans « Terminées cette semaine ».
function days(rows) {
  const fin = r => new Date(r.resolved_at || r.validated_at || r.updated_at), by = new Map();
  rows.forEach(r => { const d = fin(r), k = d.toDateString(); if (!by.has(k)) by.set(k, [d, []]); by.get(k)[1].push(r); });
  return [...by.values()].map(([d, rs]) => { const l = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return `<h3 class="gday">${l[0].toUpperCase() + l.slice(1)}</h3>${table(rs)}`; }).join('');
}

// Lot 76 : barre de défilement fine, dessinée par l'appli (toujours visible quand la colonne déborde, même sur iPad).
function gsbars() {
  const wrap = $('.gcols'); if (!wrap) return;
  wrap.querySelectorAll('.gsb').forEach(x => x.remove());
  $$('.gcol', wrap).forEach(g => {
    const t = document.createElement('i'); t.className = 'gsb'; t.innerHTML = '<b></b>'; wrap.appendChild(t);
    const upd = () => {
      const sh = g.scrollHeight, ch = g.clientHeight;
      if (!g.isConnected || sh <= ch + 1) { t.hidden = true; return; }
      t.hidden = false;
      // Lot 78 : rail limité aux cartes (du haut de la première au bas de la dernière visible).
      const cs = $$('tr[data-id]', g).filter(c => c.getClientRects().length); if (!cs.length) { t.hidden = true; return; } // Lot 115.1 : pas de barre pour une colonne pliée.
      const gr = g.getBoundingClientRect(), f = cs[0].getBoundingClientRect(), l = cs[cs.length - 1].getBoundingClientRect();
      // Lot 91 : jamais à hauteur des titres empilés (sous le bas de la pile + sa bande de masquage).
      // Lot 105.11 : seulement les titres réellement empilés en ce moment (au repos, la barre part du haut de la 1re carte).
      const stk = $$('.group > h2', g).reduce((m, h) => { const r = h.getBoundingClientRect(), st = parseFloat(getComputedStyle(h).top) || 0; return g.scrollTop > 0 && r.top - gr.top <= st + 1 ? Math.max(m, r.bottom - gr.top + 24) : m; }, 0);
      const top = Math.max(stk, f.top - gr.top + g.scrollTop), bot = Math.min(ch, l.bottom - gr.top + g.scrollTop), h = Math.max(30, bot - top);
      t.style.left = (g.offsetLeft + g.offsetWidth - 23) + 'px'; t.style.top = (g.offsetTop + top) + 'px'; t.style.height = h + 'px';
      const th = Math.max(20, h * ch / sh); t.firstChild.style.height = th + 'px';
      // Rebond : le curseur raccourcit d'autant que le dépassement, sans sortir de sa barre.
      const mx = sh - ch, st = g.scrollTop, ov = st < 0 ? -st : st > mx ? st - mx : 0, tk = Math.max(8, th - ov);
      t.firstChild.style.height = tk + 'px';
      t.firstChild.style.transform = `translateY(${st <= 0 ? 0 : st >= mx ? h - tk : (st / mx) * (h - th)}px)`;
    };
    g.addEventListener('scroll', upd, { passive: true });
    g.addEventListener('pointerenter', () => t.classList.add('on')); g.addEventListener('pointerleave', () => t.classList.remove('on'));
    // Lot 105.10 : mesure dynamique ; la barre se recalcule dès qu'une carte, un groupe ou la colonne change de taille.
    let raf = 0; const sch = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
    const ro = new ResizeObserver(sch), obs = () => { ro.disconnect(); ro.observe(g); [...g.children, ...$$('.group, tr[data-id]', g)].forEach(e => ro.observe(e)); };
    new MutationObserver(() => { obs(); sch(); }).observe(g, { childList: true, subtree: true });
    obs(); upd();
  });
}

// Lot 80 : vue mobile, bouton d'action rapide sur la carte (main = prendre ; neutre = actions de l'intervention).
let ME = null;
const TECHR = () => ['technicien', 'responsable_tech'].includes(role());
const isMine = r => r.assignee_id === ME && (!isRealAdmin() || r.assignee_role === role());
const canTake = r => TECHR() && r.status === 'publiee' && !r.assignee_id && (!r.proposed_to || r.proposed_to === ME || (isRealAdmin() && (state.members || []).find(x => x.user_id === r.proposed_to)?.role === role()));
const qActs = r => { // Lot 132 : toutes les options de l'intervention, par appui long sur la carte.
  if (!r) return [];
  const a = [], mgr = isManager(), mine = isMine(r), author = r.created_by === ME, R = role(), closed = ['resolue', 'validee'].includes(r.status);
  if (r.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(R) && author))) a.push(['publier', 'Publier', 'primary']);
  if (canTake(r)) a.push(['prendre', 'Prendre l\'intervention', 'primary']);
  if (r.status === 'prise_en_charge') {
    if (mine || ['directeur', 'responsable_tech'].includes(R)) a.push(['resoudre', 'Terminer l\'intervention', 'primary']);
    if (mine) a.push(['liberer', 'Ne plus prendre l\'intervention', 'ghost']);
    if (TECHR() && r.assignee_id && !mine) a.push(['demander', 'Demander l\'intervention', 'ghost']);
  }
  if (closed && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active', 'ghost']);
  if ((author || !!r.available_from) && ['brouillon', 'publiee'].includes(r.status) && !r.assignee_id) a.push(['modifier', 'Modifier l\'intervention', 'ghost']);
  if (mgr) a.push(['supprimer', 'Supprimer l\'intervention', 'ghost danger']);
  return a;
};
const ROWS = new Map();
function qa(r) { ROWS.set(r.id, r); return ''; } // Lot 132 : plus de main ni de clé.
const qRun = async (id, a, quiet) => {
  if (a === 'modifier') return go('intervention/' + id + '/modifier');
  if (a === 'supprimer') {
    if (!(await confirmBox('Voulez-vous vraiment supprimer cette intervention ?', 'Supprimer'))) return;
    const { data: ph } = await sb.from('intervention_photos').select('path').eq('intervention_id', id);
    if (ph?.length) await sb.storage.from('photos').remove(ph.map(p => p.path));
    const { error } = await sb.from('interventions').delete().eq('id', id);
    if (error) return toast(errMsg(error), true);
    toast('Intervention supprimée.'); return render();
  }
  const { error } = a === 'demander' ? await sb.rpc('request_transfer', { p_id: id }) : await sb.rpc('transition', { p_id: id, p_action: a, p_comment: '' });
  if (error) return toast(errMsg(error), true);
  // Lot 111 : « Intervention terminée » animée aussi depuis les étiquettes de la carte.
  if (a === 'resoudre') return (await import('./detail.js?v=1795024118')).doneScreen('Intervention terminée', render);
  if (!quiet && a !== 'prendre') toast(ACTMSG(a)); render(); // Lot 116 : prise par appui long sans message.
};
function qaInit() { // Lot 132 : appui long sur toute la carte (vue mobile, réelle et simulée).
  if (!document.body.classList.contains('tech')) return;
  $$('#rows tr[data-id]').forEach(tr => {
    const id = tr.dataset.id; if (!qActs(ROWS.get(id)).length) return;
    let tm = null, ctl = null, x0 = 0, y0 = 0, fired = false;
    const stop = () => { clearTimeout(tm); tm = null; tr.classList.remove('press'); };
    tr.addEventListener('pointerdown', e => { fired = false; x0 = e.clientX; y0 = e.clientY; tr.classList.add('press'); clearTimeout(tm); tm = setTimeout(() => { tm = null; tr.classList.remove('press'); fired = true; try { tr.setPointerCapture(e.pointerId); } catch {} ctl = qTags(tr, id); }, 450); });
    tr.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) stop(); if (ctl) ctl.move(e.clientX, e.clientY); });
    tr.addEventListener('pointerup', e => { stop(); if (ctl) { const c = ctl; ctl = null; c.up(e.clientX, e.clientY); } });
    tr.addEventListener('pointercancel', () => { stop(); if (ctl) { ctl.up(-1, -1); ctl = null; } });
    tr.addEventListener('click', e => { if (fired) { fired = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    tr.addEventListener('contextmenu', e => e.preventDefault());
  });
}

const cellBox = tr => { const q = [...tr.children].map(x => x.getBoundingClientRect()).filter(x => x.height); return { left: Math.min(...q.map(x => x.left)), top: Math.min(...q.map(x => x.top)), bottom: Math.max(...q.map(x => x.bottom)), width: Math.max(...q.map(x => x.right)) - Math.min(...q.map(x => x.left)) }; };
function qTags(b, id, o = {}) {
  const tr = b.closest('tr');
  navigator.vibrate?.(10);
  const c = document.createElement('div'); c.className = 'qcatch qgrey'; document.body.append(c);
  const cl = cloneAt(tr, c, tr.getBoundingClientRect());
  const t = document.createElement('div'); t.className = 'qtags';
  { const bt = (o.items || qActs(ROWS.get(id))).map(([a, l, k]) => `<button class="${k}" data-a="${a}">${l}</button>`).join(''); t.innerHTML = o.q ? `<span class="qq">${o.q}</span>${bt}` : bt; if (o.q) t.classList.add('qline'); }
  document.body.append(t);
  // Position calculée sur la copie réellement affichée (identique en mobile réel et simulé).
  const r = cellBox(cl.querySelector('tr'));
  if (o.q && !document.body.classList.contains('tech')) t.style.width = r.width + 'px'; // Lot 97 : question + Oui/Non dans un seul bouton long, largeur de la carte.
  const h = t.offsetHeight, up = r.bottom + 8 + h > innerHeight - 8;
  t.style.left = Math.max(8, Math.min(r.left, innerWidth - t.offsetWidth - 8)) + 'px';
  t.style.top = (up ? Math.max(8, r.top - 8 - h) : r.bottom + 8) + 'px';
  if (up) t.classList.add('up');
  requestAnimationFrame(() => { c.classList.add('in'); t.classList.add('in'); });
  const at = (x, y) => $$('button', t).find(k => { const q = k.getBoundingClientRect(); return x >= q.left - 6 && x <= q.right + 6 && y >= q.top - 4 && y <= q.bottom + 4; });
  let shut = false;
  const sw = e => { e.preventDefault(); e.stopPropagation(); };
  const out = e => { if (!t.contains(e.target)) { sw(e); close(); } };
  const close = () => {
    if (shut) return; shut = true;
    t.classList.remove('in'); t.style.pointerEvents = 'none'; setTimeout(() => t.remove(), 160);
    // Le voile reste un instant (transparent) pour absorber la fin du tap : rien dessous n'est touché ni sélectionné.
    cl.remove(); c.classList.remove('in');
    removeEventListener('scroll', close, true); ['pointerdown', 'touchstart', 'mousedown'].forEach(k => document.removeEventListener(k, out, true));
    const ev = ['click', 'mouseup', 'touchend', 'contextmenu', 'selectstart'];
    ev.forEach(k => document.addEventListener(k, sw, { capture: true, passive: false }));
    setTimeout(() => { c.remove(); ev.forEach(k => document.removeEventListener(k, sw, true)); getSelection?.().removeAllRanges(); }, 450);
  };
  const run = async a => { close(); if (o.pick) return o.pick(a); if (a === 'liberer' && !(await confirmBox('Se retirer de l\'intervention ?', 'Oui', { cancel: 'Non' }))) return; qRun(id, a); };
  t.addEventListener('pointerdown', e => { if (!e.target.closest('button')) e.preventDefault(); });
  // Lot 83 : activation au relâcher du doigt (le click n'arrive pas toujours sur iOS après l'appui long).
  t.onclick = e => { const k = e.target.closest('button'); if (k && !shut) run(k.dataset.a); };
  t.addEventListener('pointerup', e => { const k = e.target.closest('button') || at(e.clientX, e.clientY); if (k && !shut) { e.preventDefault(); run(k.dataset.a); } });
  t.addEventListener('touchend', e => { const p = e.changedTouches[0], k = p && at(p.clientX, p.clientY); if (k && !shut) { e.preventDefault(); run(k.dataset.a); } }, { passive: false });
  setTimeout(() => { if (shut) return; addEventListener('scroll', close, true); ['pointerdown', 'touchstart', 'mousedown'].forEach(k => document.addEventListener(k, out, { capture: true, passive: false })); }, 50);
  return {
    move: (x, y) => { const k = at(x, y); $$('button', t).forEach(z => z.classList.toggle('hot', z === k)); },
    up: (x, y) => { $$('button', t).forEach(z => z.classList.remove('hot')); const k = at(x, y); if (k) run(k.dataset.a); },
  };
}

function cloneAt(tr, par, r) {
  const tb = document.createElement('table'); tb.className = 'list qclone';
  tb.innerHTML = '<tbody></tbody>'; tb.firstChild.appendChild(tr.cloneNode(true));
  Object.assign(tb.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
  par.appendChild(tb);
  const cr = tb.querySelector('tr').getBoundingClientRect();
  tb.style.left = (2 * r.left - cr.left) + 'px'; tb.style.top = (2 * r.top - cr.top) + 'px'; tb.style.width = (r.width + tb.offsetWidth - cr.width) + 'px';
  return tb;
}

document.addEventListener('click', e => { const a = e.target.closest?.('a[href="#/nouvelle"]'); const app = document.getElementById('app'); if (!a || !app?.querySelector('#rows') || a.closest('.nwin')) return; e.preventDefault(); newWin(app); });
async function newWin(app) {
  const c = document.createElement('div'); c.className = 'qcatch qgrey nwin';
  const w = document.createElement('div'); w.className = 'nwbox'; c.append(w); app.append(c);
  const close = () => { c.remove(); sessionStorage.removeItem('gi:nwlost'); document.documentElement.classList.remove('nwlock', 'kbo'); removeEventListener('hashchange', close); };
  // Lot 125.1 : arrière-plan verrouillé tant que la fenêtre est ouverte (plus de défilement ni de glissement latéral de la page sur iPhone/iPad).
  document.documentElement.classList.add('nwlock');
  c.addEventListener('touchmove', e => { for (let el = e.target; el && el !== c; el = el.parentElement) { const cs = getComputedStyle(el), o = cs.overflowY, ox = cs.overflowX; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return; if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return; } e.preventDefault(); }, { passive: false });
  // Lot 89 : fermeture sans rechargement ; après enregistrement, liste mise à jour en arrière-plan.
  c._done = changed => { close(); if (changed && LASTF && $('#rows')) load(...LASTF); };
  addEventListener('hashchange', close);
  c.addEventListener('click', e => { if (e.target.closest('a[href="#/"]')) { // Lot 125.2 : un appui hors du formulaire ne le ferme plus.
  e.preventDefault(); close(); } });
  await form.view(w, {});
  // Lot 125 : fenêtre ancrée par le haut (position figée à l'ouverture) : un changement de hauteur du contenu ne la fait plus sauter.
  const cs = getComputedStyle(c), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom), mt = document.body.classList.contains('tech') ? 0 : Math.max(0, (c.clientHeight - pt - pb - w.offsetHeight) / 2); /* Lot 134 : en mobile, ancrée en haut pour garder toute la hauteur */
  c.style.alignItems = document.body.classList.contains('tech') ? 'flex-end' : 'flex-start'; /* Lot 4 : en mobile, fenêtre en bas d'écran (actions à portée du pouce) */ w.style.marginTop = mt + 'px'; w.style.maxHeight = (c.clientHeight - pt - pb - mt) + 'px';
  // Lot 7 : clavier ouvert (iPad/iPhone) : la fenêtre suit la partie visible de l'écran (visualViewport) et reste défilable, sans contenu masqué.
  const vv = window.visualViewport, frame = document.body.classList.contains('tech') && matchMedia('(min-width: 601px)').matches;
  if (vv && !frame) { const H0 = c.clientHeight, vfit = () => { if (!c.isConnected) { vv.removeEventListener('resize', vfit); vv.removeEventListener('scroll', vfit); return; } const kb = vv.height < H0 - 80; document.documentElement.classList.toggle('kbo', kb); if (!kb) { c.style.top = c.style.height = c.style.bottom = ''; w.style.marginTop = mt + 'px'; w.style.maxHeight = (H0 - pt - pb - mt) + 'px'; return; } c.style.top = vv.offsetTop + 'px'; c.style.bottom = 'auto'; c.style.height = vv.height + 'px'; w.style.marginTop = '0px'; w.style.maxHeight = Math.max(120, vv.height - pt - pb) + 'px'; };
    vv.addEventListener('resize', vfit); vv.addEventListener('scroll', vfit); }
  requestAnimationFrame(() => c.classList.add('in'));
}

// Lot 107 : l'en-tête de la carte (appareil photo, bulle) se met à jour dès l'envoi d'un message ou d'une photo.
addEventListener('gi:bump', ({ detail: { id, n, ph } }) => {
  const tl = document.querySelector(`tr[data-id="${id}"] .tl`); TOT[id] = (TOT[id] || 0) + (n || 1); if (ph) PHI.add(id); if (!tl) return;
  if (ph && !tl.querySelector('.tcam')) tl.querySelector('.t')?.insertAdjacentHTML('afterend', CAMI);
  const old = tl.querySelector('.cbub'), h = chatIco(id);
  if (old) old.outerHTML = h; else (tl.querySelector('.tcam') || tl.querySelector('.t'))?.insertAdjacentHTML('afterend', h);
});

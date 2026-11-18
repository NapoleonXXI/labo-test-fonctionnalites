// Labo : point d'entrée réduit à la fonctionnalité « Nouvelle intervention » (liste + fenêtre de création).
import { state, loadMember } from './state.js?v=1795025337';
import { sb } from './sb.js?v=1795025337';
import * as list from './views/list.js?v=1795025337';

const app = document.getElementById('app');
const MOB = new URLSearchParams(location.search).get('m') === '1';
document.body.classList.toggle('tech', MOB);

export function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
export async function render() {
  await list.view(app, { q: new URLSearchParams(), done: false });
}
// Seule la liste existe dans le labo : toute autre route (fiche, modification) revient à la liste.
addEventListener('hashchange', () => { if (location.hash === '#/nouvelle') return; history.replaceState(null, '', location.pathname + location.search); render(); });

(async () => {
  state.user = (await sb.auth.getUser()).data.user;
  state.session = { user: state.user };
  await loadMember();
  render();
})();

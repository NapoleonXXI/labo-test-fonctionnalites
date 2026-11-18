// Labo : la fiche détaillée n'est pas reproduite (seule la création est testée ici).
export const prefetch = () => {};
export const warm = () => {};
export async function view(el) { el.innerHTML = '<p class="muted pad">Fiche non reproduite dans le labo.</p>'; }
export async function doneScreen(_t, render) { render && render(); }

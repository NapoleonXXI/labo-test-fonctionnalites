// Labo : client Supabase factice, tout reste en mémoire (aucun appel réseau).
const ME = { id: 'u-julien', email: 'julien@labo.local' };
const ORG = 'org-labo';
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
const db = {
  organizations: [{ id: ORG, name: 'Camping Labo' }],
  members: [
    { user_id: 'u-julien', org_id: ORG, role: 'responsable_tech', acting_role: null, full_name: 'Julien', email: 'julien@labo.local', created_at: '2026-01-01T08:00:00Z' },
    { user_id: 'u-thomas', org_id: ORG, role: 'technicien', acting_role: null, full_name: 'Thomas', email: 'thomas@labo.local', created_at: '2026-01-02T08:00:00Z' },
    { user_id: 'u-antoine', org_id: ORG, role: 'technicien', acting_role: null, full_name: 'Antoine', email: 'antoine@labo.local', created_at: '2026-01-03T08:00:00Z' },
  ],
  places: [['Accueil', null], ['Aire de jeux', null], ['Piscine', null], ['Sanitaires A', null], ['Restaurant', null], ['MH 01', 1], ['MH 02', 2], ['MH 12', 12]].map(([label, num]) => ({ label, num })),
  interventions: [], intervention_photos: [], intervention_events: [], intervention_reads: [],
};
const URLS = {};
const ev = (id, type, body = '') => db.intervention_events.push({ id: uid(), intervention_id: id, type, body, actor_id: ME.id, actor_name: 'Julien', actor_role: 'responsable_tech', created_at: now() });

class Q {
  constructor(t) { this.t = t; this.op = 'select'; this.f = []; this.o = []; this.n = null; this.one = null; this.ret = false; }
  select() { if (this.op !== 'select') this.ret = true; return this; }
  insert(v) { this.op = 'insert'; this.v = v; return this; }
  update(v) { this.op = 'update'; this.v = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) { this.f.push(r => r[k] === v); return this; }
  neq(k, v) { this.f.push(r => r[k] !== v); return this; }
  in(k, a) { this.f.push(r => a.includes(r[k])); return this; }
  is(k, v) { this.f.push(r => (r[k] ?? null) === v); return this; }
  order(k, { ascending = true } = {}) { this.o.push([k, ascending]); return this; }
  limit(n) { this.n = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  run() {
    const T = db[this.t] || (db[this.t] = []);
    let rows;
    if (this.op === 'insert') {
      rows = [].concat(this.v).map(x => {
        const r = { id: uid(), created_at: now(), updated_at: now(), ...x };
        if (this.t === 'interventions') { Object.assign(r, { status: 'brouillon', created_by: ME.id, assignee_id: null, assignee_role: null, proposed_to: null, assigned_by: null, remind_minutes: null, priority: x.priority || 'normale', ...x }); ev(r.id, 'creee'); }
        T.push(r); return r;
      });
      if (!this.ret) return { data: null, error: null };
    } else {
      rows = T.filter(r => this.f.every(f => f(r)));
      if (this.op === 'update') rows.forEach(r => Object.assign(r, this.v, { updated_at: now() }));
      if (this.op === 'delete') { db[this.t] = T.filter(r => !rows.includes(r)); }
      if (this.op !== 'select' && !this.ret) return { data: null, error: null };
      for (const [k, a] of [...this.o].reverse()) rows = [...rows].sort((x, y) => ((x[k] ?? '') > (y[k] ?? '') ? 1 : (x[k] ?? '') < (y[k] ?? '') ? -1 : 0) * (a ? 1 : -1));
      if (this.n != null) rows = rows.slice(0, this.n);
    }
    rows = rows.map(r => ({ ...r }));
    if (this.one) { if (!rows.length && this.one === 'single') return { data: null, error: { message: 'Introuvable.' } }; return { data: rows[0] || null, error: null }; }
    return { data: rows, error: null };
  }
  then(ok, ko) { return Promise.resolve().then(() => this.run()).then(ok, ko); }
}

const STEP = { publier: 'publiee', prendre: 'prise_en_charge', resoudre: 'resolue', liberer: 'publiee', renvoyer: 'publiee', cloturer: 'validee' };
export const sb = {
  auth: {
    getUser: async () => ({ data: { user: ME }, error: null }),
    getSession: async () => ({ data: { session: { user: ME } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: t => new Q(t),
  rpc: async (fn, p = {}) => {
    const it = db.interventions.find(r => r.id === p.p_id);
    if (fn === 'transition' && it) {
      const s = STEP[p.p_action]; if (s) it.status = s;
      if (p.p_action === 'prendre') { it.assignee_id = ME.id; it.assignee_role = 'responsable_tech'; }
      if (p.p_action === 'liberer') { it.assignee_id = null; it.assignee_role = null; }
      if (p.p_action === 'resoudre') it.resolved_at = now();
      if (p.p_action === 'publier') ev(it.id, 'publiee');
      it.updated_at = now();
    }
    if (fn === 'assign_tech' && it) { it.proposed_to = p.p_tech || null; it.assigned_by = p.p_tech ? ME.id : null; }
    if (fn === 'add_comment' && it) ev(it.id, 'commentaire', p.p_body);
    return { data: null, error: null };
  },
  storage: {
    from: () => ({
      upload: async (path, file) => { URLS[path] = URL.createObjectURL(file); return { data: { path }, error: null }; },
      remove: async paths => { paths.forEach(p => { if (URLS[p]) URL.revokeObjectURL(URLS[p]); delete URLS[p]; }); return { data: null, error: null }; },
      createSignedUrl: async path => ({ data: { signedUrl: URLS[path] || '' }, error: null }),
      createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: URLS[path] || '' })), error: null }),
    }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
};
export const APP_URL = location.origin + location.pathname;

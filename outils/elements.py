# Génère elements/*.png + elements/manifest.json (boutons, typographies, marges) à partir de la copie du labo
# (app/lab.html, servie en local) et d'un spécimen chargeant le vrai app.css de gestion-interventions (lecture seule).
# Usage : serveur local sur le dossier du labo, puis  python3 outils/elements.py http://127.0.0.1:8783 /workspace/gi/css/app.css
import asyncio, json, sys, os, re, html
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8783'
GICSS = sys.argv[2] if len(sys.argv) > 2 else '/workspace/gi/css/app.css'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'elements')
ROLES = {'responsable_tech': 'Responsable technique', 'technicien': 'Technicien', 'reception': 'Réceptionniste'}
VUES = {'0': ('Standard', 1180, 820), '1': ('Mobile', 390, 844)}
PHOTO = '/tmp/labo-photo.png'

COLLECT = r"""(ctxState) => {
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const cls = e => (typeof e.className === 'string' ? e.className : '').trim();
  const desc = e => { const c = cls(e).split(/\s+/).filter(Boolean).slice(0, 3).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : '') + (e.id ? '#' + e.id : ''); };
  const zone = e => e.closest('.qtags') ? 'Menu de la carte' : e.closest('.modal') ? 'Fenêtre de confirmation' : e.closest('.wsheet') ? 'Roue des créneaux' : e.closest('.nwin') ? 'Fenêtre Nouvelle intervention' : e.closest('#rows') ? 'Liste' : e.closest('.head') ? 'En-tête de page' : 'Page';
  // Boutons et éléments cliquables
  const sel = 'button, a.btn, a.back, [role=button], label:has(> input[type=radio]), label:has(> input[type=checkbox]), .ltag';
  const btns = [...document.querySelectorAll(sel)].filter(vis).map(e => {
    const r = e.getBoundingClientRect();
    const txt = (e.innerText || '').replace(/\s+/g, ' ').trim();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { cls: cls(e), tag: e.tagName.toLowerCase(), txt: txt.slice(0, 60), aria: e.getAttribute('aria-label') || '', zone: zone(e), desc: desc(e),
      inform: !!e.closest('#f'), radio: e.matches('label') , primary: e.matches('.primary'), ghost: e.matches('.ghost'), danger: e.matches('.danger'),
      covered: !!top && !e.contains(top) && !top.contains(e), x: r.left, y: r.top, w: r.width, h: r.height };
  });
  // Typographies (éléments avec du texte propre ou champs éditables)
  const typo = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || ['SCRIPT', 'STYLE', 'svg', 'path'].includes(e.tagName)) continue;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
    const ph = e.matches('.cef') && !own ? (e.dataset.ph || '') : '';
    if (!own && !ph) continue;
    const cs = getComputedStyle(e);
    typo.push({ fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: cs.fontSize, weight: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, color: cs.color, sample: (own || ph).slice(0, 48), desc: desc(e), zone: zone(e) });
  }
  // Marges, espacements, rayons
  const sp = [];
  for (const e of document.querySelectorAll('#app *, .nwin *, .qtags, .qtags *, .modal *, .wsheet *')) {
    if (!vis(e) || e.closest('svg')) continue;
    const cs = getComputedStyle(e), d = desc(e), z = zone(e);
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    if (pad.some(v => v !== '0px')) sp.push({ k: 'padding', v: (pad[0] === pad[2] && pad[1] === pad[3]) ? (pad[0] === pad[1] ? pad[0] : pad[0] + ' ' + pad[1]) : pad.join(' '), desc: d, zone: z });
    if (/flex|grid/.test(cs.display)) { const rg = cs.rowGap, cg = cs.columnGap; if (rg !== 'normal' && rg !== '0px' || cg !== 'normal' && cg !== '0px') sp.push({ k: 'gap', v: rg === cg ? rg : (rg === 'normal' ? '0px' : rg) + ' / ' + (cg === 'normal' ? '0px' : cg), desc: d, zone: z }); }
    const mar = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft];
    if (mar.some(v => v !== '0px' && !e.style.marginTop)) { const m = mar.map(v => v); if (m.some(v => v !== '0px')) sp.push({ k: 'margin', v: (m[0] === m[2] && m[1] === m[3]) ? (m[0] === m[1] ? m[0] : m[0] + ' ' + m[1]) : m.join(' '), desc: d, zone: z }); }
    const rad = cs.borderTopLeftRadius;
    if (rad !== '0px') sp.push({ k: 'radius', v: rad === cs.borderBottomRightRadius ? rad : [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].join(' '), desc: d, zone: z });
  }
  return { btns, typo, sp };
}"""

def cat_of(b):
    if b['zone'] == 'Menu de la carte': return 'Menu d’actions de la carte (appui long)'
    if b['zone'] == 'Fenêtre de confirmation': return 'Fenêtres de confirmation'
    if b['zone'] == 'Roue des créneaux': return 'Roue des créneaux'
    if b['inform'] and (b['primary'] or b['ghost']) and b['tag'] == 'button': return 'Boutons d’étape du formulaire'
    if b['primary']: return 'Actions principales'
    if b['ghost']: return 'Actions secondaires'
    if b['radio'] or re.search(r'\b(prb|asgb|ltag|pill|seg|cwho|anone|sf)\b', b['cls']): return 'Pastilles, sélecteurs et choix'
    if not b['txt'] or len(b['txt']) <= 2: return 'Boutons icône'
    return 'Zones cliquables (résumés, titres de groupe)'

CATS = ['Actions principales', 'Actions secondaires', 'Pastilles, sélecteurs et choix', 'Boutons icône', 'Boutons d’étape du formulaire', 'Menu d’actions de la carte (appui long)', 'Fenêtres de confirmation', 'Roue des créneaux', 'Zones cliquables (résumés, titres de groupe)', 'Navigation (autres écrans)', 'Autres boutons']

BTN = {}   # clé -> entrée
TYPO = {}
SP = {}
N = [0]

async def harvest(pg, vue, role, state, src='Copie du labo (app/, code actuel de gestion-interventions)'):
    d = await pg.evaluate(COLLECT, state)
    for b in d['btns']:
        key = (vue, b['tag'], b['cls'], b['txt'] or b['aria'])
        e = BTN.get(key)
        if e:
            e['roles'].add(ROLES.get(role, role)); e['etats'].add(state)
            if not e.get('file') and not b['covered']: e['_pending'] = b
            continue
        e = BTN[key] = {'vue': vue, 'label': b['txt'] or b['aria'] or '(sans texte)', 'classe': b['desc'], 'cat': cat_of(b), 'zone': b['zone'], 'roles': {ROLES.get(role, role)}, 'etats': {state}, 'source': src}
        if not b['covered']: e['_pending'] = b
    # captures des nouveaux boutons
    for e in BTN.values():
        b = e.pop('_pending', None)
        if not b or e.get('file'): continue
        N[0] += 1; fn = f"b{N[0]:03d}.png"; m = 6
        clip = {'x': max(0, b['x'] - m), 'y': max(0, b['y'] - m), 'width': b['w'] + 2 * m, 'height': b['h'] + 2 * m}
        try:
            await pg.screenshot(path=os.path.join(OUT, fn), clip=clip, animations='disabled'); e['file'] = fn
        except Exception: N[0] -= 1
    for t in d['typo']:
        key = (t['fam'], t['size'], t['weight'], t['lh'], t['ls'])
        e = TYPO.setdefault(key, {'uses': {}, 'vues': set(), 'samples': [], 'color': t['color']})
        e['vues'].add(vue); e['uses'].setdefault(t['desc'] + ' — ' + t['zone'], 0); e['uses'][t['desc'] + ' — ' + t['zone']] += 1
        if t['sample'] not in e['samples'] and len(e['samples']) < 3: e['samples'].append(t['sample'])
    for s in d['sp']:
        e = SP.setdefault((s['k'], s['v']), {'uses': {}, 'vues': set()})
        e['vues'].add(vue); u = s['desc'] + ' — ' + s['zone']; e['uses'][u] = e['uses'].get(u, 0) + 1

async def walk(b, m, role):
    vue, W, H = VUES[m]
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg = await ctx.new_page()
    errs = []; pg.on('pageerror', lambda x: errs.append(str(x)))
    await pg.goto(f'{BASE}/app/lab.html?m={m}&r={role}'); await pg.wait_for_timeout(1200)
    H_ = lambda s: harvest(pg, vue, role, s)
    async def click(sel, t=500):
        loc = pg.locator(sel).first
        if await loc.count() and await loc.is_visible(): await loc.click(); await pg.wait_for_timeout(t); return True
        return False
    async def typ(sel, s):
        await pg.locator(sel).first.click(); await pg.keyboard.type(s); await pg.wait_for_timeout(400)
    await H_('Liste vide')
    await click('a[href="#/nouvelle"]', 800); await H_('Formulaire, étape 1')
    if await click('#f .prb'): await H_('Priorité')
    await typ('#f [data-name=title]', 'Fuite d’eau'); await typ('#f [data-name=location]', 'Sani'); await H_('Suggestions de lieu')
    await click('.ac-list li'); await H_('Lieu choisi')
    await click('#f button.primary:visible'); await H_('Formulaire, étape 2')
    await typ('#f [data-name=description]', 'Fuite visible sous le lavabo.')
    await click('#f button.primary:visible', 700); await H_('Formulaire, étape 3')
    if await click('#hp label:has-text("Présence")', 700):
        await H_('Roue des créneaux'); await click('.wsheet button:has-text("Valider")')
        await H_('Créneau choisi')
    if await click('#f .asgb', 600):
        await H_('Assignation'); await click('.nwin :is(label,button):has-text("Thomas")'); await H_('Technicien assigné')
    inp = pg.locator('#f input[type=file]')
    if await inp.count(): await inp.first.set_input_files([PHOTO]); await pg.wait_for_timeout(600); await H_('Photo ajoutée')
    if await click('#f .pt-x', 500): await H_('Suppression de photo'); await click('.modal button:has-text("Non")')
    if await click('.nwin .fx', 500): await H_('Quitter la création'); await click('.modal button[data-r=""]')
    await click('#f button[value=publier]', 900)
    if await pg.locator('.modal').count(): await H_('Rappel'); await click('.modal button:has-text("Non")', 800)
    await click('a[href="#/nouvelle"]', 800); await typ('#f [data-name=title]', 'Ampoule grillée'); await typ('#f [data-name=location]', 'Accueil')
    await pg.keyboard.press('Escape'); await click('#f button.ghost:has-text("Brouillon")', 900)
    if await pg.locator('.modal').count(): await click('.modal button:has-text("Non")', 600)
    await H_('Liste avec cartes')
    if m == '1':
        for i in range(await pg.locator('#rows tr[data-id]').count()):
            tr = pg.locator('#rows tr[data-id]').nth(i); bb = await tr.bounding_box()
            if not bb: continue
            x, y = bb['x'] + 30, bb['y'] + bb['height'] / 2
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.wait_for_timeout(800)
            await H_('Menu de la carte'); await pg.mouse.up(); await pg.wait_for_timeout(300)
            await pg.mouse.click(5, H - 5); await pg.wait_for_timeout(700)
    await ctx.close(); return errs

SPEC = """<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap"><link rel="stylesheet" href="file://GICSS"></head>
<body class="BODY"><div id="shell"><header id="top"><div class="bar"><span class="brand">Camping</span><nav><a href="#/" class="on" data-s="Barre du haut (standard)" data-v="s">Interventions</a><a href="#/terminees" data-s="Barre du haut (standard)" data-v="s">Terminées</a><a href="#/routines" data-s="Barre du haut (standard)" data-v="s">Routines</a><a href="#/parametres" data-s="Barre du haut (standard)" data-v="s">Profils</a><a href="#/interventions?recherche=1" class="ico" aria-label="Rechercher" data-s="Barre du haut (standard)" data-v="s">ICO_search</a></nav>
<div class="who"><button class="ghost" id="logout" data-s="Barre du haut" data-v="s">Déconnexion</button></div></div></header>
<main id="app"><div class="page"><div style="max-width:420px">
<div class="dact"><div class="actions solo"><a class="btn ghost" data-s="Fiche intervention" data-v="s">Modifier</a><button class="primary" data-s="Fiche intervention" data-v="s">Publier</button></div></div>
<div class="dact"><div class="actions solo"><button class="primary" data-s="Fiche intervention" data-v="s">Commencer l'intervention</button></div></div>
<div class="dact"><div class="actions solo"><button class="primary" data-s="Fiche intervention" data-v="s">Terminer l'intervention</button><a class="btn ghost ibtn" aria-label="Modifier" data-s="Fiche intervention" data-v="s">ICO_edit</a></div></div>
<div class="dact"><div class="actions solo"><button class="ghost" data-s="Fiche intervention" data-v="s">Demander l'intervention</button><button class="ghost" data-s="Fiche intervention" data-v="s">Renvoyer active</button></div></div>
<div class="dact"><div class="actions solo"><button class="ghost danger" data-s="Fiche intervention" data-v="s">Supprimer l'intervention</button></div></div>
<div class="head"><div class="hl"><a class="back" aria-label="Retour" data-s="Fiche intervention" data-v="sm">ICO_back</a><h1>Fiche</h1></div></div>
<div style="display:flex;gap:8px;align-items:center;margin:12px 0"><button class="csend" aria-label="Envoyer" data-s="Fiche intervention, tchat" data-v="sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>
<form class="card" onsubmit="return false" style="display:flex;flex-direction:column;gap:10px;max-width:420px"><button class="primary" data-s="Connexion" data-v="sm">Se connecter</button><button class="primary" data-s="Connexion" data-v="sm">Recevoir un lien</button><button class="primary" data-s="Inscription" data-v="sm">Créer le compte</button><button class="primary" data-s="Invitation" data-v="sm">Accepter l'invitation</button></form>
<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="primary" data-s="Équipe" data-v="s">Créer l'invitation</button><button class="ghost" data-s="Équipe" data-v="s">Copier le lien</button><button class="ghost danger" data-s="Équipe" data-v="s">Retirer</button></div>
</div></main>
<nav id="bnav"><a href="#/" class="on" aria-label="Interventions" data-s="Barre du bas (mobile)" data-v="m">ICO_list</a><a aria-label="Interventions terminées" data-s="Barre du bas (mobile)" data-v="m">ICO_done</a><a aria-label="Rechercher" data-s="Barre du bas (mobile)" data-v="m">ICO_search</a></nav>
<div class="modal" style="position:static;background:none"><div class="mbox"><p class="mq">Clôturer l'intervention ?</p><div class="mbtns"><button class="ghost" data-r="0" data-s="Fiche, confirmation" data-v="sm">Annuler</button><button class="primary" data-r="1" data-s="Fiche, confirmation" data-v="sm">Clôturer</button></div></div></div>
</div></body></html>"""
ICO = {'list': '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', 'done': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.8"/>', 'search': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
       'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 'back': '<path d="M19 12H5M12 19l-7-7 7-7"/>', 'send': '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'}

async def specimen(b):
    for m, (vue, W, H) in VUES.items():
        h = SPEC.replace('GICSS', GICSS).replace('BODY', 'tech' if m == '1' else '')
        for k, v in ICO.items(): h = h.replace('ICO_' + k, f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{v}</svg>')
        p = f'/tmp/labo-spec-{m}.html'; open(p, 'w').write(h)
        ctx = await b.new_context(viewport={'width': W, 'height': 1600}, device_scale_factor=2); pg = await ctx.new_page()
        await pg.goto('file://' + p); await pg.wait_for_timeout(1500)
        items = await pg.evaluate("""() => [...document.querySelectorAll('[data-s]')].map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { v: e.dataset.v || 'sm', ok: r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden', s: e.dataset.s, txt: (e.innerText || '').trim(), aria: e.getAttribute('aria-label') || '', cls: (e.className || '').trim(), tag: e.tagName.toLowerCase(), primary: e.matches('.primary'), ghost: e.matches('.ghost'), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })""")
        for i, it in enumerate(items):
            key = (vue, 'spec', it['cls'], it['txt'] or it['aria'], it['s'])
            if not it['ok'] or key in BTN or ('s' if m == '0' else 'm') not in it['v']: continue
            cat = 'Actions principales' if it['primary'] else 'Actions secondaires' if it['ghost'] else 'Boutons icône' if not it['txt'] or len(it['txt']) <= 2 else 'Navigation' if 'Barre' in it['s'] else 'Autres boutons'
            if 'Barre' in it['s']: cat = 'Navigation (autres écrans)'
            N[0] += 1; fn = f"b{N[0]:03d}.png"; mg = 6
            try: await pg.locator('[data-s]').nth(i).screenshot(path=os.path.join(OUT, fn), animations='disabled')
            except Exception: N[0] -= 1; continue
            BTN[key] = {'vue': vue, 'label': it['txt'] or it['aria'], 'classe': it['tag'] + ('.' + '.'.join(it['cls'].split()) if it['cls'] else ''), 'cat': cat, 'zone': it['s'], 'roles': set(), 'etats': {it['s']}, 'file': fn,
                        'source': 'Spécimen : vraies classes d’app.css de gestion-interventions, balisage reconstitué (écran absent du labo)'}
        await ctx.close()

def table_html(title, head, rows, note):
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f"""<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap">
<style>body{{margin:0;background:#EDEDED;color:#1A1A1A;font:14px/1.4 Geist,sans-serif;padding:20px;width:1100px}}h2{{font-size:18px;font-weight:600;margin:0 0 4px}}p{{margin:0 0 14px;color:#6B6B6B;font-size:13px}}
table{{border-collapse:collapse;width:100%}}th{{text-align:left;font-size:12px;font-weight:600;color:#6B6B6B;padding:6px 8px;border-bottom:1px solid #CFCFCF}}td{{vertical-align:top;padding:8px;border-bottom:1px solid #D9D9D9}}code{{font:12px 'Geist Mono',monospace;white-space:nowrap}}td:nth-child(2){{white-space:nowrap}}.u{{font-size:12.5px;color:#3A3A3A}}</style></head>
<body><h2>{title}</h2><p>{note}</p><table><thead><tr>{''.join(f'<th>{h}</th>' for h in head)}</tr></thead><tbody>{tr}</tbody></table></body></html>"""

async def shot_html(b, h, fn):
    ctx = await b.new_context(viewport={'width': 1140, 'height': 800}, device_scale_factor=2); pg = await ctx.new_page()
    await pg.set_content(h); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=os.path.join(OUT, fn), full_page=True); await ctx.close()

def uses(d, n=6):
    u = sorted(d.items(), key=lambda x: -x[1]); s = ', '.join(html.escape(k) for k, _ in u[:n])
    return f'<span class="u">{s}{f" … (+{len(u) - n})" if len(u) > n else ""}</span>'

async def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (1200, 800), '#2F6FB3'); dr = ImageDraw.Draw(im); dr.ellipse((420, 220, 780, 580), fill='#E2483D'); dr.rectangle((0, 700, 1200, 800), fill='#F2C230'); im.save(PHOTO)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for m in VUES:
            for r in ROLES: errs += await walk(b, m, r)
        await specimen(b)
        # Typographies
        rows = []
        for (fam, size, w, lh, ls), e in sorted(TYPO.items(), key=lambda x: (-float(x[0][1][:-2]), -int(x[0][2]))):
            st = f"font-family:{fam},sans-serif;font-size:{size};font-weight:{w};line-height:{lh};letter-spacing:{ls}"
            rows.append([f'<div style="{st};max-width:300px">{html.escape(e["samples"][0])}</div>', f'<code>{fam}<br>{size} · {w}<br>interligne {lh}{"<br>approche " + ls if ls != "normal" else ""}</code>', ', '.join(sorted(e['vues'])), uses(e['uses'])])
        note = 'Valeurs calculées par le navigateur (getComputedStyle) sur la copie du labo, qui charge app.css de gestion-interventions. Liste, fenêtre Nouvelle intervention (3 étapes), menus et confirmations ; standard 1180 px et mobile 390 px ; 3 rôles.'
        T = []
        for i in range(0, len(rows), 14):
            fn = f't{i // 14 + 1:02d}.png'; await shot_html(b, table_html('Typographies' + (f' ({i // 14 + 1})' if len(rows) > 14 else ''), ['Exemple', 'Famille · taille · graisse', 'Vues', 'Où (élément — zone)'], rows[i:i + 14], note), fn); T.append(fn)
        # Marges
        S = []
        names = {'padding': 'Marges intérieures (padding)', 'gap': 'Espacements entre éléments (gap)', 'margin': 'Marges extérieures (margin)', 'radius': 'Rayons d’arrondi (border-radius)'}
        for k, nm in names.items():
            items = sorted([(v, e) for (kk, v), e in SP.items() if kk == k], key=lambda x: (float(re.findall(r'-?[\d.]+', x[0])[0]) if re.findall(r'-?[\d.]+', x[0]) else 0, x[0]))
            rows = [[f'<code>{html.escape(v)}</code>', ', '.join(sorted(e['vues'])), uses(e['uses'], 8)] for v, e in items]
            for i in range(0, len(rows), 22):
                fn = f's-{k}-{i // 22 + 1}.png'; await shot_html(b, table_html(nm + (f' ({i // 22 + 1})' if len(rows) > 22 else ''), ['Valeur', 'Vues', 'Où (élément — zone)'], rows[i:i + 22], note), fn); S.append({'titre': nm, 'file': fn})
        await b.close()
    btns = [dict(e, roles=sorted(e['roles']), etats=sorted(e['etats'])) for e in BTN.values() if e.get('file')]
    btns.sort(key=lambda e: (CATS.index(e['cat']) if e['cat'] in CATS else 99, e['source'][:4] != 'Copi', e['vue'], e['label']))
    man = {'boutons': btns, 'typographies': T, 'marges': S, 'sans_capture': [e['label'] + ' (' + e['vue'] + ')' for e in BTN.values() if not e.get('file')]}
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print('boutons', len(btns), 'typo', len(TYPO), 'marges', len(SP), 'sans capture', len(man['sans_capture']), 'erreurs', errs)
asyncio.run(main())

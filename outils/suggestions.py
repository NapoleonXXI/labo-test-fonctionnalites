# Visuels « suggestion » (zone corrigée par une retouche CSS) pour les constats existants : captures/sNNN.png
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8783'
OUT = 'captures/'
from PIL import Image, ImageDraw
im = Image.new('RGB', (1200, 800), '#2F6FB3'); d = ImageDraw.Draw(im); d.ellipse((420, 220, 780, 580), fill='#E2483D'); d.rectangle((0, 700, 1200, 800), fill='#F2C230'); im.save('/tmp/labo-photo.png')

async def open_form(b, m, r, W, H):
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2); pg = await ctx.new_page()
    await pg.goto(f'{BASE}/app/lab.html?m={m}&r={r}'); await pg.wait_for_timeout(1000)
    await pg.click('a[href="#/nouvelle"]'); await pg.wait_for_timeout(700)
    return ctx, pg
async def typ(pg, sel, s): await pg.locator(sel).first.click(); await pg.keyboard.type(s); await pg.wait_for_timeout(400)
async def to3(pg):
    await typ(pg, '#f [data-name=title]', "Fuite d'eau"); await typ(pg, '#f [data-name=location]', 'Sanitaires A'); await pg.keyboard.press('Escape')
    await pg.click('#f button.primary:visible'); await pg.wait_for_timeout(500)
    await typ(pg, '#f [data-name=description]', 'Fuite visible sous le lavabo.')
    await pg.click('#f button.primary:visible'); await pg.wait_for_timeout(700)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # Constat 2 : actions en bas d'écran, 44 px de haut (mobile 390)
        ctx, pg = await open_form(b, 1, 'responsable_tech', 390, 844)
        await typ(pg, '#f [data-name=title]', "Fuite d'eau"); await typ(pg, '#f [data-name=location]', 'Sanitaires A'); await pg.keyboard.press('Escape')
        await pg.add_style_tag(content='.nwin{align-items:flex-end!important}.nwin .nwbox{margin-top:auto!important;margin-bottom:0!important;border-bottom-left-radius:0;border-bottom-right-radius:0}.nform .nactions>*{min-height:44px!important}')
        await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + 's003.png'); await ctx.close()
        # Constat 3 : photo entière (mobile)
        ctx, pg = await open_form(b, 1, 'responsable_tech', 390, 844); await to3(pg)
        await pg.locator('#f input[type=file]').first.set_input_files(['/tmp/labo-photo.png']); await pg.wait_for_timeout(600)
        await pg.add_style_tag(content='.ptray .pt img{object-fit:contain!important;background:#F4F4F4}')
        await pg.wait_for_timeout(300); bb = await pg.locator('#f .pstrip').bounding_box()
        await pg.screenshot(path=OUT + 's004.png', clip={'x': bb['x'] - 8, 'y': bb['y'] - 8, 'width': bb['width'] + 16, 'height': bb['height'] + 16}); await ctx.close()
        # Constat 5 : menu d'assignation lisible, sous le bouton (mobile, responsable technique)
        ctx, pg = await open_form(b, 1, 'responsable_tech', 390, 844); await to3(pg)
        await pg.click('#f .asgb'); await pg.wait_for_timeout(600)
        await pg.add_style_tag(content='.nform .assign label{opacity:1!important}.nform .assign label:not(.wc) .cwho{color:#4A4A4A!important}.nform .assign label.wc .cwho{font-weight:600}')
        await pg.evaluate("""() => { const a = document.querySelector('#f .assign'), g = document.querySelector('#f .asgb'); a.style.setProperty('display', 'none', 'important');
          const row = document.createElement('div'); row.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin:2px 0';
          row.innerHTML = [['Non assigné', 0], ['Thomas', 1], ['Antoine', 0]].map(([n, on]) => `<span style="font:500 13px/1 Geist,sans-serif;padding:7px 12px;border-radius:999px;border:1px solid ${on ? '#1A1A1A' : '#C8C8C8'};background:${on ? '#1A1A1A' : '#fff'};color:${on ? '#fff' : '#3A3A3A'}">${n}</span>`).join('');
          g.after(row); }""")
        await pg.wait_for_timeout(300); await pg.locator('.nwbox').screenshot(path=OUT + 's006.png'); await ctx.close()
        # Constat 6 : suggestions de lieu dans la fenêtre, Suivant en dessous (standard 1024, technicien)
        ctx, pg = await open_form(b, 0, 'technicien', 1024, 768)
        await pg.add_style_tag(content='.nform .ac-list{position:static!important;max-height:96px;overflow:auto;margin-top:8px!important}')
        await typ(pg, '#f [data-name=location]', 'Sani'); await pg.wait_for_timeout(400)
        await pg.locator('.nwbox').screenshot(path=OUT + 's007.png'); await ctx.close()
        # Constat 7 : priorité en standard = valeur choisie + petite flèche
        ctx, pg = await open_form(b, 0, 'responsable_tech', 1024, 768)
        await pg.evaluate("""() => { const p = document.querySelector('#f .prb'); p.className = 'prb pk p-normale'; p.style.flexDirection = 'row'; p.style.gap = '4px';
          p.innerHTML = 'Normale<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }""")
        await pg.wait_for_timeout(300); bb = await pg.locator('#f .nbox').bounding_box(); hb = await pg.locator('.nwbox').bounding_box()
        await pg.screenshot(path=OUT + 's008.png', clip={'x': hb['x'], 'y': hb['y'], 'width': hb['width'], 'height': bb['y'] + bb['height'] + 8 - hb['y']}); await ctx.close()
        await b.close()
asyncio.run(main())

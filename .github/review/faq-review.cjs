const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const expectedMenu = ['Receiving','Invoicing','LPO Management','FAQ','How-Tos'];
(async () => {
  const live = process.env.REVIEW_LIVE === '1';
  const root = live ? 'https://fuckederful.com' : 'http://127.0.0.1:4173';
  const prefix = live ? 'live-' : '';
  const out = 'faq-review-results';
  fs.mkdirSync(out, {recursive:true});
  if (live) {
    let matched = false;
    for (let n=0;n<18;n++) {
      try {
        const checks = await Promise.all(['faq.css','site.js'].map(async name => {
          const r = await fetch(`${root}/${name}?verify=${process.env.GITHUB_SHA}`, {signal:AbortSignal.timeout(10000)});
          return r.ok && hash(Buffer.from(await r.arrayBuffer())) === hash(fs.readFileSync(name));
        }));
        // Wait for the HTML deletion too; unchanged CSS/JS alone cannot identify this release.
        const htmlResponse = await fetch(`${root}/faq.html?verify=${process.env.GITHUB_SHA}`, {signal:AbortSignal.timeout(10000)});
        const html = await htmlResponse.text();
        const htmlReady = htmlResponse.ok && html.includes('id="faq-heading"') && !html.includes('faq-guides') && !html.includes('View How-Tos');
        if (checks.every(Boolean) && htmlReady) {matched=true;break;}
      } catch (_) {}
      await new Promise(r=>setTimeout(r,5000));
    }
    assert(matched,'Live FAQ assets do not match the tested commit');
  }
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
  const results = [], pages = [];
  for (const width of (live?[1536,390]:[1536,1440,1024,800,600,430,390,360,320])) {
    const page = await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const r=await page.goto(`${root}/faq.html?verify=${process.env.GITHUB_SHA}`,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const m=await page.evaluate(()=>({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      headings:document.querySelectorAll('h1').length,questions:document.querySelectorAll('.faq-item').length,
      menu:[...document.querySelectorAll('nav .dropmenu>a')].map(a=>a.textContent),
      top:[...document.querySelectorAll('nav>a')].map(a=>a.textContent),
      active:document.querySelector('nav [aria-current="page"]')?.textContent,
      featureActive:document.querySelector('nav .drop>a')?.classList.contains('is-active'),
      underline:getComputedStyle(document.querySelector('nav [aria-current="page"]')).textDecorationColor,
      headerColor:getComputedStyle(document.querySelector('header')).backgroundColor,
      headerLogo:document.querySelector('.brand img')?.getAttribute('src'),
      footerText:document.querySelector('footer')?.innerText.replace(/\s+/g,' ').trim(),
      images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),
      bottomGuides:document.querySelectorAll('main .faq-guides, main a[href*="howtos"]').length
    }));
    assert(r.ok()&&!errors.length&&m.width===m.scrollWidth&&m.images&&m.headings===1&&m.questions===8,`FAQ render failed at ${width}`);
    assert(JSON.stringify(m.menu)===JSON.stringify(expectedMenu)&&!m.top.includes('How-Tos')&&m.active==='FAQ'&&m.featureActive&&m.underline==='rgb(215, 25, 32)',`Navigation failed at ${width}`);
    assert(m.headerColor==='rgb(255, 255, 255)'&&m.headerLogo==='graphics/SCANAPP_COLOR.png','Shared branding changed');
    assert(m.bottomGuides===0,'The removed bottom How-Tos block must not return');
    // Native details must work with keyboard and pointer, and expanded answers must fit.
    const second=page.locator('.faq-item').nth(1);
    await second.locator('summary').focus();await page.keyboard.press('Enter');
    assert(await second.evaluate(e=>e.open),'Keyboard did not expand FAQ');
    await second.locator('summary').click();assert(!(await second.evaluate(e=>e.open)),'Pointer did not collapse FAQ');
    await page.locator('.faq-item').evaluateAll(es=>es.forEach(e=>e.open=true));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Expanded FAQ overflow');
    assert(await page.locator('#receiving-process li').count()===5,'Receiving statuses were lost');
    await page.locator('.faq-item').evaluateAll(es=>es.forEach((e,i)=>e.open=i===0));
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});
    await page.screenshot({path:`${out}/${prefix}faq-${width}.png`,fullPage:true});
    if(width<=800){
      await page.locator('.menu').click();assert(await page.locator('.dropmenu a[href="faq.html"]').isVisible(),'Mobile FAQ hidden');
      assert(await page.locator('.dropmenu a[href="howtos.html"]').isVisible(),'Mobile How-Tos hidden');
      if(width===390)await page.screenshot({path:`${out}/${prefix}faq-menu-390.png`});
      await page.keyboard.press('Escape');assert(await page.locator('.menu').getAttribute('aria-expanded')==='false','Shared menu escape failed');
    } else if(width===1536){
      await page.locator('nav .drop').hover();await page.screenshot({path:`${out}/${prefix}faq-menu-1536.png`});
    }
    results.push({...m,ok:true,errors});
    if(width===1536||width===390){
      for(const name of ['index','features','receiving','invoicing','lpo','results','howtos','contact']){
        const response=await page.goto(`${root}/${name}.html?verify=${process.env.GITHUB_SHA}`,{waitUntil:'networkidle'});
        const state=await page.evaluate(()=>({menu:[...document.querySelectorAll('nav .dropmenu>a')].map(a=>a.textContent),top:[...document.querySelectorAll('nav>a')].map(a=>a.textContent),headerColor:getComputedStyle(document.querySelector('header')).backgroundColor,logo:document.querySelector('.brand img')?.getAttribute('src'),footer:document.querySelector('footer')?.innerText.replace(/\s+/g,' ').trim(),active:document.querySelector('nav [aria-current="page"]')?.textContent,featureActive:document.querySelector('nav .drop>a')?.classList.contains('is-active')}));
        const ok=response.ok()&&JSON.stringify(state.menu)===JSON.stringify(expectedMenu)&&!state.top.includes('How-Tos')&&state.headerColor===m.headerColor&&state.logo===m.headerLogo&&state.footer===m.footerText&&(name!=='howtos'||(state.active==='How-Tos'&&state.featureActive));
        pages.push({width,page:name,ok});assert(ok,`Shared menu mismatch on ${name} at ${width}`);
      }
    }
    await page.close();
  }
  if(live){const p=await browser.newPage();const r=await p.goto(root+'/faq',{waitUntil:'networkidle'});assert(r.ok()&&await p.locator('.faq-item').count()===8,'Clean FAQ URL failed');await p.close();}
  await browser.close();
  const result={verified:true,commit:process.env.GITHUB_SHA,url:root+'/faq',checkedAt:new Date().toISOString(),screens:results,pages};
  fs.writeFileSync(`${out}/${prefix}verification.json`,JSON.stringify(result,null,2));
  console.log((live?'LIVE_VERIFIED ':'REVIEW_VERIFIED ')+JSON.stringify(result));
})().catch(e=>{console.error(e);process.exit(1)});

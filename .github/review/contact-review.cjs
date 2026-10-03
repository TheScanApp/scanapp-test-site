const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
// Compare actual computed shared UI, not just duplicated markup. Ignore only active-link state.
async function sharedSnapshot(page, open = false) {
  return page.evaluate(open => {
    const header = document.querySelector('[data-site-header] header');
    const footer = document.querySelector('[data-site-footer] footer');
    if (!header || !footer) return null;
    const round = n => Math.round(n * 100) / 100;
    const sample = (element, parent) => {
      const s = getComputedStyle(element), r = element.getBoundingClientRect(), p = parent.getBoundingClientRect();
      return {x:round(r.x-p.x),y:round(r.y-p.y),width:round(r.width),height:round(r.height),styles:Object.fromEntries(['backgroundColor','color','paddingTop','paddingRight','paddingBottom','paddingLeft','fontFamily','fontSize','fontWeight','lineHeight','borderTopWidth','borderTopColor','borderBottomWidth','borderBottomColor','display','position','top','gap','alignItems','justifyContent'].map(k=>[k,s[k]])),src:element.getAttribute('src'),href:element.getAttribute('href')};
    };
    return {
      header:sample(header,header),headerX:round(header.getBoundingClientRect().x),
      parts:[...header.querySelectorAll('.brand,.brand img,.menu,nav,nav a')].map(e=>sample(e,header)),
      footer:sample(footer,footer),footerX:round(footer.getBoundingClientRect().x),
      footerParts:[...footer.querySelectorAll('img,div,a')].map(e=>sample(e,footer)),
      footerText:footer.innerText.replace(/\s+/g,' ').trim(),
      menuExpanded:header.querySelector('.menu')?.getAttribute('aria-expanded'),
      menuControls:header.querySelector('.menu')?.getAttribute('aria-controls'),
      navigationId:header.querySelector('nav')?.id,open
    };
  }, open);
}
(async () => {
  const live = process.env.REVIEW_LIVE === '1';
  const root = live ? 'https://fuckederful.com' : 'http://127.0.0.1:4173';
  const portrait = fs.readFileSync('graphics/ChatGPT Image Oct 3, 2026, 02_49_44 PM-1.png');
  const portraitSha = crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${portrait.length}\0`), portrait])).digest('hex');
  assert(portraitSha === '7c493a0306ad1fa757a923be928ac8d8d214c86f', 'Portrait/shirt asset must remain unchanged');
  if (live) {
    let matched = false;
    for (let n = 0; n < 18; n++) {
      try {
        const checks = await Promise.all(['contact.css','contact.js','site.js'].map(async name => {
          const response = await fetch(`${root}/${name}?verify=${process.env.GITHUB_SHA}`, {signal:AbortSignal.timeout(10000)});
          return response.ok && hash(Buffer.from(await response.arrayBuffer())) === hash(fs.readFileSync(name));
        }));
        if (checks.every(Boolean)) {matched=true;break;}
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert(matched, 'Published CSS/JS does not match the reviewed revision');
  }
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_BIN || undefined, args:['--no-sandbox']});
  const results = [], sharedResults = [];
  fs.mkdirSync('review-results', {recursive:true});
  for (const width of (live ? [1536,390] : [1536,1440,1024,800,600,430,390,360,320])) {
    const page = await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(`${root}/contact.html?verify=${process.env.GITHUB_SHA}`, {waitUntil:'networkidle',timeout:45000});
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('svg image')].map(e => {const image=new Image();image.src=e.href.baseVal;return image.decode();}));
    });
    const m = await page.evaluate(() => {
      const rect = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const actions=[...document.querySelectorAll('.contact-cta')];
      const buttons=actions.map(a=>({text:a.innerText.replace(/\s+/g,' ').trim(),href:a.href,...rect(a)}));
      const portrait=rect(document.querySelector('.contact-portrait')),counter=rect(document.querySelector('.contact-desktop'));
      const details=[...document.querySelectorAll('.contact-detail')].map(e=>e.innerText.replace(/\s+/g,' ').trim());
      const title=document.querySelector('.contact-person-title');
      const titleRect=title && rect(title),nameRect=rect(document.querySelector('.contact-person strong'));
      const bodyText=document.body.innerText;
      const active=document.querySelector('nav [aria-current="page"]');
      return {
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headingCount:document.querySelectorAll('h1').length,
        active:active?.textContent,underline:getComputedStyle(active).textDecorationColor,
        images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),details,buttons,
        labelsFit:actions.every(a=>[...a.children].every(c=>rect(c).right<=rect(a).right-1)),
        clickable:actions.every(a=>{const r=rect(a);return document.elementFromPoint(r.x+r.width/2,Math.min(r.y+r.height/2,innerHeight-1))?.closest('a')===a||r.y>=innerHeight;}),
        personIcon:!!document.querySelector('.contact-person .contact-symbol svg'),
        founder:title?.textContent,founderPlaced:!!titleRect&&titleRect.y>=nameRect.bottom&&titleRect.bottom<buttons[0].y&&titleRect.right<=innerWidth,
        // Keep both actions fully above the portrait, not over the raised thumb.
        buttonsClearOfPortrait:innerWidth>800||buttons.every(b=>b.bottom+11.9<=portrait.y),
        mobileActionRow:innerWidth>800||(Math.abs(buttons[0].y-buttons[1].y)<1&&buttons[0].right+11.9<=buttons[1].x),
        raisedCounter:counter.y>portrait.y+portrait.height*.5&&counter.y<portrait.bottom&&counter.bottom>=portrait.bottom,
        removedCopy:!bodyText.includes('We’re here to help.')&&!bodyText.includes('Same Parts.')&&!bodyText.includes('A Smarter Way.'),
        noPropLogos:document.querySelectorAll('.contact-wall-brand,.contact-wall-words,.contact-props image[href*="SCANAPP"]').length===0,
        phone:document.querySelector('.contact-phone')?.href,email:document.querySelector('.contact-email a')?.href,
        headerBackground:getComputedStyle(document.querySelector('header')).backgroundColor,
        headerLogo:document.querySelector('[data-site-header] .brand img')?.getAttribute('src')
      };
    });
    m.ok=response.ok()&&!errors.length&&m.width===m.scrollWidth&&m.images&&m.headingCount===1&&m.active==='Contact'&&m.labelsFit&&m.clickable&&m.personIcon&&m.founderPlaced&&m.founder==='Founder, ScanApp / Power Systems Inc.'&&m.buttonsClearOfPortrait&&m.mobileActionRow&&m.raisedCounter&&m.removedCopy&&m.noPropLogos&&m.details[2]==='Ottawa, Ontario Canada'&&m.details[3]==='Dave Power Founder, ScanApp / Power Systems Inc.'&&m.buttons[0].text==='Request a Demo'&&m.buttons[1].text==='in LinkedIn'&&m.buttons[0].width===m.buttons[1].width&&m.buttons[0].height===m.buttons[1].height&&m.phone==='tel:+16132823283'&&m.email==='mailto:info@powersystemsinc.ca'&&m.buttons[0].href==='mailto:info@powersystemsinc.ca?subject=ScanApp%20Demo%20Request'&&m.buttons[1].href==='https://www.linkedin.com/in/thedavepower/'&&m.headerBackground==='rgb(255, 255, 255)'&&m.headerLogo==='graphics/SCANAPP_COLOR.png';
    const expectedClosed=await sharedSnapshot(page);
    let expectedOpen=null;
    if(width<=800){
      await page.locator('.menu').click();expectedOpen=await sharedSnapshot(page,true);
      if(width===390)await page.screenshot({path:`review-results/${live?'live-':''}menu-390.png`});
      await page.keyboard.press('Escape');m.menuWorks=await page.locator('.menu').getAttribute('aria-expanded')==='false';m.ok=m.ok&&m.menuWorks;await page.locator('.menu').blur();
    }
    await page.screenshot({path:`review-results/${live?'live-':''}contact-${width}.png`,fullPage:true});
    if([1536,1024,390].includes(width)){
      for(const name of ['index','features','receiving','invoicing','lpo','results','howtos']){
        const r=await page.goto(`${root}/${name}.html?verify=${process.env.GITHUB_SHA}`,{waitUntil:'networkidle',timeout:45000});
        await page.evaluate(()=>document.fonts.ready);
        const actual=await sharedSnapshot(page);
        let same=r.ok()&&JSON.stringify(actual)===JSON.stringify(expectedClosed);
        if(width<=800){
          await page.locator('.menu').click();
          same=same&&JSON.stringify(await sharedSnapshot(page,true))===JSON.stringify(expectedOpen);
          await page.keyboard.press('Escape');same=same&&await page.locator('.menu').getAttribute('aria-expanded')==='false';
          await page.locator('.menu').blur();
        }
        if(name==='features')await page.locator('[data-site-header]').screenshot({path:`review-results/${live?'live-':''}shared-header-${width}.png`});
        sharedResults.push({width,page:name,same,...(!same?{expected:expectedClosed,actual}:{})});
      }
    }
    results.push({...m,errors});await page.close();
  }
  await browser.close();
  const result={verified:results.every(r=>r.ok)&&sharedResults.every(r=>r.same),commit:process.env.GITHUB_SHA,url:root+'/contact',portraitSha,checkedAt:new Date().toISOString(),screens:results,sharedLayout:sharedResults};
  fs.writeFileSync(`review-results/${live?'live-verification':'test-results'}.json`,JSON.stringify(result,null,2));
  console.log((live?'LIVE_VERIFIED ':'REVIEW_RESULTS ')+JSON.stringify(result));
  assert(result.verified,'Contact/shared-layout review failed; see results');
})().catch(e=>{console.error(e);process.exit(1)});

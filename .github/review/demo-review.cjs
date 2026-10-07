const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = 'http://127.0.0.1:4173';
const out = process.env.REVIEW_OUTPUT || 'demo-review-results';
async function fill(page) {
  for (const [name,value] of Object.entries({name:'Review Tester',dealership:'Test Dealership',email:'review@example.com',phone:'6135550100','province-state':'Ontario'})) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.selectOption('[name="dms"]','Quorum');
  await page.getByLabel('Receiving',{exact:true}).check();
  await page.getByLabel('Invoicing',{exact:true}).check();
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});
  const report={layouts:[],flow:[],submission:'Responses mocked locally; no live submission or notification verified.'};
  try {
    for (const width of [1440,1200,1024,800,600,390,320]) {
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://www.googletagmanager.com/**',r=>r.abort());
      await page.goto(`${root}/request-demo.html`);
      assert.equal(await page.locator('h1').count(),1);
      assert.equal(await page.locator('input[required]').count(),5);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
      if(width<=1150){await page.getByRole('button',{name:'Menu',exact:true}).click();}
      const nav=page.locator('nav .demo-nav');assert(await nav.isVisible());
      assert.equal(await nav.getAttribute('aria-current'),'page');
      assert(await nav.evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'Navigation clipped');
      if(width<=1150){await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'false');}
      const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));assert.deepEqual(broken,[]);
      assert.deepEqual(errors,[]);
      if([1440,390].includes(width))await page.screenshot({path:path.join(out,`demo-${width}.png`),fullPage:true});
      report.layouts.push({width,overflow:false,menu:'pass'});await page.close();
    }
    const page=await browser.newPage();
    await page.route('https://www.googletagmanager.com/**',r=>r.abort());
    await page.goto(`${root}/request-demo.html`);
    await page.evaluate(()=>{window.reviewEvents=[];window.gtag=(...args)=>window.reviewEvents.push(args);});
    let posts=[];let mode='error';
    await page.route('**/request-demo.html',async route=>{
      if(route.request().method()!=='POST')return route.continue();
      posts.push(route.request().postData());
      if(mode==='network')return route.abort();
      if(mode==='redirect')return route.fulfill({status:302,headers:{location:'/index.html'},body:''});
      if(mode==='pending')await new Promise(r=>setTimeout(r,400));
      return route.fulfill({status:mode==='error'?500:200,contentType:'text/plain',body:'OK'});
    });
    await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();assert.equal(posts.length,0);
    await fill(page);
    await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();
    await page.waitForFunction(()=>document.querySelector('#demo-status').dataset.state==='error');
    assert.equal(await page.locator('[name="email"]').inputValue(),'review@example.com');
    assert.equal(await page.evaluate(()=>reviewEvents.filter(x=>x[1]==='demo_request').length),0);
    mode='network';await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();
    await page.waitForFunction(()=>!document.querySelector('form').hasAttribute('aria-busy'));
    assert.equal(await page.evaluate(()=>reviewEvents.filter(x=>x[1]==='demo_request').length),0);
    mode='redirect';await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();
    await page.waitForFunction(()=>!document.querySelector('form').hasAttribute('aria-busy'));
    assert.equal(await page.evaluate(()=>reviewEvents.filter(x=>x[1]==='demo_request').length),0);
    mode='pending';await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();
    assert(await page.locator('.demo-submit').isDisabled());
    await page.evaluate(()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await page.waitForFunction(()=>document.querySelector('#demo-status').dataset.state==='success');
    assert.equal(posts.length,4);
    assert.equal(await page.locator('#demo-status').textContent(),'Thank you. Dave will contact you directly to arrange your ScanApp demo.');
    const events=await page.evaluate(()=>reviewEvents.filter(x=>x[1]==='demo_request'));assert.equal(events.length,1);
    assert(!JSON.stringify(events).includes('review@example.com'));assert(!JSON.stringify(events).includes('Review Tester'));
    const body=new URLSearchParams(posts[3]);assert.equal(body.get('form-name'),'demo-request');assert.deepEqual(body.getAll('interested-in[]'),['Receiving','Invoicing']);assert.equal(body.get('bot-field'),'');
    await page.evaluate(()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(posts.length,4);
    report.flow=['required fields block POST','HTTP error preserves entries and emits no event','network failure emits no event','pending/accepted guard prevents duplicates','success emits exactly one event with no personal data','Netlify payload includes multi-select interests and honeypot'];
    await page.goto(`${root}/request-demo.html`);await fill(page);await page.evaluate(()=>window.gtag=()=>{throw Error('analytics blocked')});
    mode='success';await page.getByRole('button',{name:'REQUEST MY DEMO'}).click();await page.waitForFunction(()=>document.querySelector('#demo-status').dataset.state==='success');report.flow.push('analytics exception cannot block success');
    for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){
      const html=fs.readFileSync(file,'utf8');
      for(const tag of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g))if(tag[0].includes('SEE IT IN ACTION'))assert(tag[0].includes('href="request-demo.html"'),file+' CTA destination');
    }
    await page.goto(`${root}/contact.html`);assert(await page.locator('.contact-phone').isVisible());assert.equal(await page.locator('.contact-demo').getAttribute('href'),'request-demo.html');
    report.flow.push('all SEE IT IN ACTION links target demo; Contact phone retained');
    const native=await browser.newPage({javaScriptEnabled:false});await native.goto(`${root}/request-demo.html`);await fill(native);
    let nativePost;
    await native.route('**/request-demo.html',r=>{if(r.request().method()==='POST'){nativePost=r.request().postData();return r.fulfill({status:200,contentType:'text/html',body:'<p>Netlify confirmation fixture</p>'});}return r.continue()});
    await native.getByRole('button',{name:'REQUEST MY DEMO'}).click();await native.getByText('Netlify confirmation fixture').waitFor();assert.equal(new URLSearchParams(nativePost).get('form-name'),'demo-request');await native.close();
    report.flow.push('redirected response emits no event; native no-JavaScript POST works with fixture');
    fs.writeFileSync(path.join(out,'test-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

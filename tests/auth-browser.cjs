/* Synthetic Chromium regression: no production Auth or RTDB access. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless:true,
    ...(process.env.CHROMIUM_PATH ? { executablePath:process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport:{ width:1100, height:800 } });
    await page.route('**/*', route => route.abort());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const html = fs.readFileSync('public/index.html', 'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html);
    for (const file of ['public/css/legacy/001-root.css',
      'public/css/legacy/006-waiting-for-approval-gate.css', 'public/css/account-access.css']) {
      await page.addStyleTag({ path:file });
    }
    await page.addScriptTag({ content: `
      (() => {
        const data={},subs={};
        window.Toast={ok(){},info(){},warn(){},err(){}};
        window.Session={role:null,actor:''};
        window.EntRbac={myRecord:null};
        window.EntAuth={user:{role:null}};
        window.__testData=data;
        window.__errors={};
        const emit=path=>(subs[path]||[]).slice().forEach(fn=>
          queueMicrotask(()=>fn({val:()=>data[path]||null})));
        window.__seed=(path,value)=>{data[path]=value;emit(path);};
        const database={ref(path){return {
          async once(){
            if(window.__errors[path])throw new Error('synthetic error');
            return {val:()=>data[path]||null};
          },
          async set(value){data[path]=value;emit(path);},
          async update(change){data[path]={...(data[path]||{}),...change};emit(path);},
          on(_type,fn){
            (subs[path] ||= []).push(fn);
            queueMicrotask(()=>fn({val:()=>data[path]||null}));
            return fn;
          },
          off(_type,fn){subs[path]=(subs[path]||[]).filter(x=>x!==fn);}
        }}};
        const auth={
          currentUser:null, cb:null,
          onAuthStateChanged(cb){this.cb=cb;queueMicrotask(()=>cb(this.currentUser));},
          async signOut(){this.currentUser=null;this.cb(null);}
        };
        window.__auth=auth;
        window.__signIn=(uid,verified)=>{
          auth.currentUser={
            uid,email:uid+'@example.test',displayName:uid,
            isAnonymous:false,emailVerified:verified,
            async reload(){},async getIdToken(){return 'synthetic';},
            async sendEmailVerification(){window.__emailCount=(window.__emailCount||0)+1;}
          };
          if(auth.cb)auth.cb(auth.currentUser);
        };
        window.firebase={apps:[{}],auth:()=>auth,database:()=>database};
      })();
    ` });
    await page.addScriptTag({ path:'public/js/legacy/015-accountapprovalv260.js' });
    await page.waitForSelector('#entAuthGate.open');
    const appVisibility=()=>page.locator('.app').evaluate(el=>getComputedStyle(el).visibility);
    assert.equal(await appVisibility(),'hidden');

    await page.evaluate(()=>window.__signIn('new',false));
    await page.waitForSelector('#entVerifyGate.open');
    assert.equal(await appVisibility(),'hidden');
    assert.equal(await page.evaluate(()=>window.__testData['safwat/pendingUsers/new'].status),'pending');
    await page.waitForFunction(()=>window.__emailCount === 1);

    await page.evaluate(()=>{
      window.__auth.currentUser.emailVerified=true;
      document.getElementById('entVerifyCheck').click();
    });
    await page.waitForSelector('#entWaitingGate.open');
    assert.equal(await appVisibility(),'hidden');

    await page.evaluate(()=>window.__seed('safwat/users/new',{
      uid:'new',email:'new@example.test',role:'viewer',disabled:false
    }));
    await page.waitForFunction(()=>document.body.classList.contains('ent-authenticated'));
    assert.equal(await appVisibility(),'visible');
    assert.equal(await page.evaluate(()=>window.Session.role),'viewer');

    await page.evaluate(()=>window.__seed('safwat/users/new',{
      uid:'new',email:'new@example.test',role:'viewer',disabled:true
    }));
    await page.waitForSelector('#entDisabledGate.open');
    assert.equal(await appVisibility(),'hidden');

    await page.evaluate(()=>{
      window.__seed('safwat/pendingUsers/rejected',{
        uid:'rejected',status:'rejected',rejectionReason:'Synthetic rejection'
      });
      window.__signIn('rejected',true);
    });
    await page.waitForSelector('#entRejectedGate.open');

    await page.evaluate(()=>{
      window.__seed('safwat/users/offline',{uid:'offline',role:'viewer',disabled:false});
      window.__errors['safwat/users/offline']=true;
      window.__signIn('offline',true);
    });
    await page.waitForSelector('#entAccessErrorGate.open');
    assert.equal(await appVisibility(),'hidden');
    await page.evaluate(()=>{
      delete window.__errors['safwat/users/offline'];
      document.getElementById('entAccessRetry').click();
    });
    await page.waitForFunction(()=>document.body.classList.contains('ent-authenticated'));
    await page.evaluate(()=>window.__auth.signOut());
    await page.waitForSelector('#entAuthGate.open');
    assert.equal(await appVisibility(),'hidden');
    assert.deepEqual(errors,[]);
    console.log('Synthetic Chromium new-account approval, verification, revocation and retry PASS.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

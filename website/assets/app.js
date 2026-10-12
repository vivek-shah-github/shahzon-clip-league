
(function(){
"use strict";
/* ---------- defaults from the operating doc ---------- */
const DEFAULTS={season:"Season 01",startDate:"",endDate:"",resultsDate:"",channelUrl:"",communityUrl:"",communityName:"",
  applyFormUrl:"",submitFormUrl:"",contact:"",platforms:"YouTube Shorts, Instagram Reels",prizes:[500,300,200],weeklyLimit:3,
  budget:{prizes:1000,community:500,tools:500,reserve:1000},resultsStatus:"live"};
const CATS=["Clutch","Funny reaction","Squad","Challenge","Other"];
const STATUSES=["pending","eligible","incomplete","rejected"];
const BUDGET_LINES=[["prizes","Clipper prizes"],["community","Community event"],["tools","Tools / assets"],["reserve","Reserve"]];
const CHECKLIST=["Programme rules finalized and checked against current platform policies","Prize pool funded and exact amounts/timeline published","One community space selected","Submission form created and tested","Tracking set up: participants, submissions, scores, leaderboard, expenses, monthly metrics","Clip permission and credit guidelines written","Recruitment announcement published","First 10 participants onboarded","Weekly review time blocked in calendar","Baseline channel metrics recorded before launch","Month-end review and winner announcement date scheduled"];
const PHASES=[
  {from:1,to:7,name:"Set up",items:["Rules and one-page clipper guide","Community space, form and tracker","Branding assets and credit instructions","Recruit 10 pilot clippers","Publish prizes, scoring and deadlines"]},
  {from:8,to:14,name:"Test content",items:["A small number of clips each","Test clutch, personality, squad, challenge","Check credit and links work","Share examples of improvements"]},
  {from:15,to:21,name:"Improve",items:["Double down on the best formats","Clear feedback, no promised wins","Check channel visits and subscribers","Stop low-effort repeat submissions"]},
  {from:22,to:30,name:"Close the pilot",items:["Score eligible entries","Provisional results + 48h error window","Final results and prizes","Compare metrics to baseline; decide next season"]}];

/* ---------- state ---------- */
const S={settings:clone(DEFAULTS),clippers:[],clips:[],expenses:[],metrics:[],contacts:{},inbox:[],checklist:{},payouts:{},myInbox:null};
const API_URL=((window.SZ_CONFIG||{}).apiUrl||"").trim();
function ssGet(k){try{return sessionStorage.getItem(k)||""}catch(e){return ""}}
function ssSet(k,v){try{v?sessionStorage.setItem(k,v):sessionStorage.removeItem(k)}catch(e){}}
let adminToken=ssGet("szAdmin");
let isAdmin=!!adminToken,canSubmitInPage=!!API_URL,submitBlocked=false;
let adminTab="overview";
/* ---------- Google Apps Script API ---------- */
async function api(action,body){
  if(!API_URL){const err=new Error("The site isn't connected to its Google Sheet yet.");err.status=503;throw err}
  let r;
  if(body===undefined){r=await fetch(API_URL+(API_URL.includes("?")?"&":"?")+"action="+encodeURIComponent(action),{redirect:"follow"})}
  else{r=await fetch(API_URL,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({},body,{action,adminToken}))})}
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok||!j||!j.ok){const err=new Error((j&&j.error)||"Request failed");err.status=(j&&j.status)||r.status||500;throw err}
  return j}
function put(col,id,data){return api("put",{col,id,data})}
function del(col,id){return api("del",{col,id})}
const db=true; // writes go through the API; kept so guard() stays unchanged
function visitorToken(){let t="";try{t=localStorage.getItem("szToken")||""}catch(e){}
  if(t.length<16){t=Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,"0")).join("");try{localStorage.setItem("szToken",t)}catch(e){}}
  return t}
const TOKEN=visitorToken();

/* ---------- helpers ---------- */
function clone(o){return JSON.parse(JSON.stringify(o))}
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.from((r||document).querySelectorAll(s))}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeUrl(u){try{const x=new URL(String(u||"").trim());return (x.protocol==="https:"||x.protocol==="http:")?x.href:""}catch(e){return ""}}
function link(u,label){const s=safeUrl(u);return s?`<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(label||shortUrl(s))}</a>`:`<span class="muted">${esc(label||u||"—")}</span>`}
function shortUrl(u){try{const x=new URL(u);return (x.hostname.replace(/^www\./,"")+x.pathname).slice(0,38)+((x.hostname+x.pathname).length>38?"…":"")}catch(e){return u}}
function num(v){const n=Number(v);return isFinite(n)?n:0}
function rs(n){return "₹"+Math.round(num(n)).toLocaleString("en-IN")}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fmtDate(s){if(!s)return "—";const d=new Date(s+"T00:00:00");if(isNaN(d))return s;return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
function dayDiff(a,b){return Math.floor((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000)}
function isoWeek(s){const d=new Date(s+"T00:00:00");if(isNaN(d))return "";const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return t.getUTCFullYear()+"-W"+Math.ceil(((t-y)/86400000+1)/7)}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2600)}
function setting(k){const v=S.settings[k];return v===undefined?DEFAULTS[k]:v}
function prizes(){const p=setting("prizes");return Array.isArray(p)?p.map(num):DEFAULTS.prizes}
function clipperById(id){return S.clippers.find(c=>c.clipperId===id)}
async function copyText(text,btn){try{await navigator.clipboard.writeText(text);toast("Copied")}catch(e){const pre=btn&&btn.closest(".panel")&&btn.closest(".panel").querySelector("pre");if(pre){const r=document.createRange();r.selectNodeContents(pre);const s=getSelection();s.removeAllRanges();s.addRange(r)}toast("Copy blocked here. The text is selected; press Ctrl/Cmd+C.")}}
function newId(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- scoring ---------- */
const SK=[["hook","Editing & hook",35],["reach","Reach & retention",30],["orig","Originality",20],["comp","Compliance",15]];
function scored(c){const s=c.scores||{};return SK.every(([k])=>s[k]!==undefined&&s[k]!==null&&s[k]!=="")}
function total(c){const s=c.scores||{};return SK.reduce((a,[k])=>a+num(s[k]),0)}
function weeklyOverflow(){ // ids of eligible clips beyond the weekly limit (by publish date order)
  const lim=num(setting("weeklyLimit"))||3,over=new Set(),groups={};
  S.clips.filter(c=>c.status==="eligible").slice().sort((a,b)=>(a.publishDate||"").localeCompare(b.publishDate||"")||(a.createdAt||0)-(b.createdAt||0))
   .forEach(c=>{const k=c.clipperId+"|"+isoWeek(c.publishDate||"");groups[k]=(groups[k]||0)+1;if(groups[k]>lim)over.add(c.id)});
  return over}
function leaderboard(){
  const over=weeklyOverflow(),by={};
  S.clips.forEach(c=>{if(c.status!=="eligible"||over.has(c.id))return;(by[c.clipperId]=by[c.clipperId]||[]).push(c)});
  const rows=Object.keys(by).map(id=>{const cl=by[id],sc=cl.filter(scored);
    let best=null;sc.forEach(c=>{if(!best||cmpClip(c,best)<0)best=c});
    const avg=sc.length?sc.reduce((a,c)=>a+total(c),0)/sc.length:0;const p=clipperById(id)||{};
    return {clipperId:id,handle:p.handle||id,platform:p.platform||"",eligible:cl.length,scoredCount:sc.length,avg,best,bestScore:best?total(best):0}});
  rows.sort((a,b)=>{if(!a.best&&!b.best)return b.eligible-a.eligible;if(!a.best)return 1;if(!b.best)return -1;return cmpClip(a.best,b.best)});
  const pz=prizes();rows.forEach((r,i)=>{r.rank=i+1;r.prize=(r.best&&i<3)?pz[i]:0});return rows}
function cmpClip(a,b){const s=x=>x.scores||{};const d=total(b)-total(a);if(d)return d;
  const t1=(num(s(b).hook)+num(s(b).orig))-(num(s(a).hook)+num(s(a).orig));if(t1)return t1;return num(s(b).comp)-num(s(a).comp)}

/* ---------- routing ---------- */
const VIEWS=["home","rules","guide","leaderboard","submit","admin","login"];
function route(){let h=(location.hash||"#home").slice(1);if(!VIEWS.includes(h))h="home";if(h==="admin"&&!isAdmin)h="login";if(h==="login"&&isAdmin)h="admin";
  const at=document.getElementById("adminTab");if(at)at.hidden=!isAdmin;
  VIEWS.forEach(v=>{$("#v-"+v).hidden=v!==h});$$("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.tab===h?"page":"false"));
  if(h==="admin")renderAdmin();window.scrollTo(0,0)}
window.addEventListener("hashchange",route);

/* ---------- public render ---------- */
function renderPublic(){
  const st=S.settings,pz=prizes();
  $$("[data-bind=season]").forEach(e=>e.textContent=setting("season"));
  $$("[data-bind=seasonLong]").forEach(e=>e.textContent="SHAHZON CLIP LEAGUE · "+setting("season"));
  $$("[data-bind=platforms]").forEach(e=>e.textContent=setting("platforms"));
  $$("[data-bind=weeklyLimit]").forEach(e=>e.textContent=setting("weeklyLimit"));
  $("#pz1").textContent=rs(pz[0]);$("#pz2").textContent=rs(pz[1]);$("#pz3").textContent=rs(pz[2]);
  $("#poolTotal").textContent=rs(pz[0]+pz[1]+pz[2]);
  $("#seasonDates").textContent=st.startDate?fmtDate(st.startDate)+" → "+fmtDate(st.endDate||addDays(st.startDate,29)):"30-day pilot";
  $("#prizeTable").innerHTML=["1st","2nd","3rd"].map((p,i)=>`<tr><td><b>${p}</b></td><td class="num">${rs(pz[i])}</td><td>${i===0?"Highest eligible score under the published criteria":i===1?"Second-highest eligible score":"Third-highest eligible score"}</td></tr>`).join("");
  renderPhases();renderBoard();renderGuideLinks();renderSubmit()}
function addDays(s,n){const d=new Date(s+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function renderPhases(){const start=setting("startDate");let day=0;
  if(start){day=dayDiff(start,today())+1}
  const title=$("#phaseTitle"),sub=$("#phaseSub");
  if(!start){title.textContent="30-day pilot";sub.textContent="Dates are announced at launch."}
  else if(day<1){title.textContent="Starts in "+(1-day)+" day"+(1-day===1?"":"s");sub.textContent="Season begins "+fmtDate(start)+"."}
  else if(day>30){title.textContent="Pilot complete";sub.textContent="Day 30 passed on "+fmtDate(addDays(start,29))+"."}
  else{const ph=PHASES.find(p=>day>=p.from&&day<=p.to);title.textContent="Day "+day+" of 30 · "+ph.name;sub.textContent=(30-day)+" day"+(30-day===1?"":"s")+" left in the pilot."}
  $("#dayFill").style.width=Math.max(0,Math.min(100,(day/30)*100))+"%";
  $("#phases").innerHTML=PHASES.map(p=>{const cls=start&&day>=p.from&&day<=p.to?"now":(start&&day>p.to?"done":"");
    return `<div class="phase ${cls}"><span class="d">Days ${p.from}–${p.to}${cls==="now"?" · now":""}</span><h3>${esc(p.name)}</h3><ul>${p.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul></div>`}).join("")}
function boardTable(rows,limit){
  if(!rows.length)return `<div class="tbl-wrap"><div class="empty"><b>No eligible clips yet</b><span>Standings appear here once the first clips are reviewed and scored.</span><a class="btn sm primary" href="#submit">Submit a clip</a></div></div>`;
  const r=limit?rows.slice(0,limit):rows;
  return `<div class="tbl-wrap"><table><thead><tr><th>Rank</th><th>Clipper</th><th class="num">Eligible clips</th><th class="num">Avg score</th><th class="num">Best clip</th><th class="num">Prize</th></tr></thead><tbody>${
    r.map(x=>`<tr><td class="rank ${x.rank<=3&&x.best?"r"+x.rank:""}">${x.best?x.rank:"–"}</td><td><div class="handle">${esc(x.handle)}</div><div class="sub">${esc(x.clipperId)}${x.platform?" · "+esc(x.platform):""}</div></td><td class="num">${x.eligible}</td><td class="num">${x.scoredCount?x.avg.toFixed(1):"—"}</td><td class="num"><b>${x.best?x.bestScore:"—"}</b>${x.best?" / 100":""}</td><td class="num">${x.prize?rs(x.prize):"—"}</td></tr>`).join("")}</tbody></table></div>`}
function renderBoard(){const rows=leaderboard();
  $("#homeBoardBody").innerHTML=boardTable(rows,5);$("#boardBody").innerHTML=boardTable(rows);
  const status=setting("resultsStatus"),rd=setting("resultsDate");
  const label={live:["Live standings","warn","Scores update as clips are reviewed. Standings are not final."],provisional:["Provisional results","warn","You have 48 hours to flag factual scoring errors."],final:["Final results","ok","Winners will be contacted privately. We never ask for passwords or OTPs."]}[status]||["Live standings","warn",""];
  $("#resultsBanner").innerHTML=`<span class="chip ${label[1]}">${label[0]}</span><span>${esc(label[2])}${rd?" Results announced "+esc(fmtDate(rd))+".":""}</span>`;
  const best=S.clips.filter(c=>c.status==="eligible"&&scored(c)).sort(cmpClip).slice(0,6);
  $("#topClips").innerHTML=best.length?`<div class="clipgrid">${best.map(c=>{const p=clipperById(c.clipperId)||{};const s=c.scores||{};
    return `<div class="clipcard"><div class="row" style="justify-content:space-between"><span class="chip">${esc(c.category||"Other")}</span><span class="mono"><b>${total(c)}</b>/100</span></div>
    <div><div class="handle">${esc(p.handle||c.clipperId)}</div><div class="sub">${esc(c.platform||"")} · ${esc(fmtDate(c.publishDate))}</div></div>
    <div class="mini">${SK.map(([k,l,m])=>`<div><span class="muted">${l.split(" ")[0]}</span><span class="b"><i style="width:${Math.min(100,num(s[k])/m*100)}%"></i></span><span class="mono">${num(s[k])}</span></div>`).join("")}</div>
    ${c.publicNote?`<p class="muted" style="font-size:14px">${esc(c.publicNote)}</p>`:""}
    <div>${link(c.url,"Watch clip ↗")}</div></div>`}).join("")}</div>`:`<div class="tbl-wrap"><div class="empty"><b>Nothing scored yet</b><span>The highest-scoring eligible clips will be featured here.</span></div></div>`}
function renderGuideLinks(){const ch=safeUrl(setting("channelUrl")),cm=safeUrl(setting("communityUrl"));
  $("#channelLinks").innerHTML=(ch?`<a class="btn sm primary" href="${esc(ch)}" target="_blank" rel="noopener noreferrer">Official SHAHZON channel ↗</a>`:"")+(cm?`<a class="btn sm" href="${esc(cm)}" target="_blank" rel="noopener noreferrer">${esc(setting("communityName")||"Community")} ↗</a>`:"")}

/* ---------- submit ---------- */
function renderSubmit(){
  const body=$("#submitBody");if(!body)return;
  const applyU=safeUrl(setting("applyFormUrl")),subU=safeUrl(setting("submitFormUrl")),cm=safeUrl(setting("communityUrl"));
  const formsLinks=(applyU||subU||cm)?`<div class="row">${applyU?`<a class="btn primary" href="${esc(applyU)}" target="_blank" rel="noopener noreferrer">Apply via form ↗</a>`:""}${subU?`<a class="btn" href="${esc(subU)}" target="_blank" rel="noopener noreferrer">Submit a clip via form ↗</a>`:""}${cm?`<a class="btn ghost" href="${esc(cm)}" target="_blank" rel="noopener noreferrer">Join ${esc(setting("communityName")||"the community")} ↗</a>`:""}</div>`:"";
  if(!(canSubmitInPage&&!submitBlocked)){
    body.innerHTML=`<div class="panel"><h3>How to enter</h3><p class="muted">${formsLinks?"Use the official forms below. Keep your clip public until judging is complete.":"Entry forms open at launch. Check back soon or ask in SHAHZON's live chat."}</p>${formsLinks}${submitBlocked?`<p class="msg info">This link doesn't let you save entries here. Use the forms above instead.</p>`:""}</div>${minimalNote()}`;return}
  if(document.activeElement&&body.contains(document.activeElement)&&document.activeElement.matches("input,select,textarea"))return; // don't wipe while typing
  const mine=(S.myInbox&&S.myInbox.entries)||[];
  body.innerHTML=`<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><label>Website<input id="hp-website" tabindex="-1" autocomplete="off"></label></div><div class="two">
   <form class="panel" id="applyForm" novalidate><h3>1 · Apply to join</h3>
    <div class="grid-form">
     <label class="f">Display name / handle<input id="ap-handle" required maxlength="60" placeholder="@yourhandle"></label>
     <label class="f">Platform<select id="ap-platform">${platformOpts()}</select></label>
     <label class="f wide">Contact for league updates<input id="ap-contact" required maxlength="120" placeholder="Discord, Instagram or Telegram username"></label>
     <label class="f wide">Your channel or profile URL<input id="ap-profile" maxlength="300" placeholder="https://…"></label>
    </div>
    <label class="check"><input type="checkbox" id="ap-rules">I've read the rules and will only use permitted footage.</label>
    <label class="check"><input type="checkbox" id="ap-fair">I won't buy views or engagement, or copy anyone's edit.</label>
    <div id="ap-msg">${flash.ap}</div><div class="row"><button class="btn primary" type="submit">Send application</button></div></form>
   <form class="panel" id="clipForm" novalidate><h3>2 · Submit a clip</h3>
    <div class="grid-form">
     <label class="f">Clipper ID<input id="cl-id" required maxlength="10" placeholder="SZ001" class="mono"></label>
     <label class="f">Platform<select id="cl-platform">${platformOpts()}</select></label>
     <label class="f wide">Published clip URL<input id="cl-url" required maxlength="300" placeholder="https://youtube.com/shorts/…"></label>
     <label class="f wide">Source stream URL<input id="cl-src" required maxlength="300" placeholder="https://youtube.com/live/…"></label>
     <label class="f">Timestamp in stream<input id="cl-ts" required maxlength="12" placeholder="1:23:45" class="mono"></label>
     <label class="f">Category<select id="cl-cat">${CATS.map(c=>`<option>${c}</option>`).join("")}</select></label>
     <label class="f">Publish date<input id="cl-date" type="date" required value="${today()}"></label>
     <label class="f">Public metrics (optional)<input id="cl-metrics" maxlength="120" placeholder="e.g. 4.2k views, 61% viewed"></label>
    </div>
    <label class="check"><input type="checkbox" id="cl-rights">I confirm I read the rules, credited SHAHZON, and have permission to use this footage.</label>
    <div id="cl-msg">${flash.cl}</div><div class="row"><button class="btn primary" type="submit">Submit clip</button></div></form>
  </div>
  ${formsLinks?`<div class="panel"><h3>Prefer the forms?</h3>${formsLinks}</div>`:""}
  <div class="panel"><h3>Your entries</h3>${mine.length?`<div class="tbl-wrap"><table><thead><tr><th>Sent</th><th>Type</th><th>Details</th><th>Status</th></tr></thead><tbody>${mine.slice().reverse().map(e=>`<tr><td class="mono">${esc(fmtDate((e.at||"").slice(0,10)))}</td><td>${e.type==="apply"?"Application":"Clip"}</td><td>${e.type==="apply"?esc(e.handle):link(e.url)}</td><td>${statusChip(e.status||"new",e)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">Nothing sent yet. Your applications and clips show up here with their review status.</p>`}</div>
  ${minimalNote()}`;
  $("#applyForm").addEventListener("submit",onApply);$("#clipForm").addEventListener("submit",onClip)}
function minimalNote(){return `<p class="note">We only collect what's needed to run the league. We never ask for passwords, OTPs or account access. Submitting doesn't guarantee eligibility or a prize.</p>`}
function platformOpts(){return setting("platforms").split(",").map(s=>s.trim()).filter(Boolean).concat(["Other"]).map(p=>`<option>${esc(p)}</option>`).join("")}
function statusChip(s,e){const m={new:["Received","warn"],accepted:["Accepted","ok"],rejected:["Not accepted","bad"]}[s]||[s,""];return `<span class="chip ${m[1]}">${m[0]}</span>${e&&e.assignedId?` <span class="mono">${esc(e.assignedId)}</span>`:""}`}
let inboxWriting=false;const flash={ap:"",cl:""};
async function pushEntry(entry,msgEl){
  if(inboxWriting)return false;inboxWriting=true;
  const hp=document.getElementById("hp-website");
  try{await api("submit",Object.assign({},entry,{token:TOKEN,website:hp?hp.value:""}));loadMine();return true}
  catch(e){msgEl.innerHTML=`<p class="msg bad">${esc(e.status>=500||!e.status?"Couldn't send right now. Please try again in a moment.":e.message)}</p>`;return false}
  finally{inboxWriting=false}}
async function onApply(ev){ev.preventDefault();const m=$("#ap-msg");const h=$("#ap-handle").value.trim(),c=$("#ap-contact").value.trim(),p=$("#ap-profile").value.trim();
  if(!h||!c){m.innerHTML=`<p class="msg bad">Add your handle and a contact so we can reach you.</p>`;return}
  if(p&&!safeUrl(p)){m.innerHTML=`<p class="msg bad">The profile link needs to start with https://</p>`;return}
  if(!$("#ap-rules").checked||!$("#ap-fair").checked){m.innerHTML=`<p class="msg bad">Tick both boxes to confirm you accept the rules.</p>`;return}
  const ok=await pushEntry({type:"apply",handle:h,contact:c,profileUrl:p,platform:$("#ap-platform").value,rulesAccepted:true,fairPlay:true},m);
  if(ok){ev.target.reset();m.innerHTML=flash.ap=`<p class="msg ok">Application received. You'll get your Clipper ID once it's reviewed.</p>`}}
async function onClip(ev){ev.preventDefault();const m=$("#cl-msg");
  const f={clipperId:$("#cl-id").value.trim().toUpperCase(),platform:$("#cl-platform").value,url:$("#cl-url").value.trim(),sourceUrl:$("#cl-src").value.trim(),timestamp:$("#cl-ts").value.trim(),category:$("#cl-cat").value,publishDate:$("#cl-date").value,metrics:$("#cl-metrics").value.trim()};
  if(!/^SZ\d{3,}$/.test(f.clipperId)){m.innerHTML=`<p class="msg bad">Clipper ID looks like SZ001. Apply first if you don't have one.</p>`;return}
  if(!safeUrl(f.url)||!safeUrl(f.sourceUrl)){m.innerHTML=`<p class="msg bad">Both links need to be full URLs starting with https://</p>`;return}
  if(!f.timestamp||!f.publishDate){m.innerHTML=`<p class="msg bad">Add the stream timestamp and the date you published.</p>`;return}
  if(!$("#cl-rights").checked){m.innerHTML=`<p class="msg bad">Confirm the rules and footage permission to submit.</p>`;return}
  const ok=await pushEntry(Object.assign({type:"clip",rights:true},f),m);
  if(ok){ev.target.reset();$("#cl-date").value=today();m.innerHTML=flash.cl=`<p class="msg ok">Thanks for submitting your clip to SHAHZON Clip League. Your entry has been received, but it is not yet confirmed as eligible. Please keep the clip public and the submitted information accurate until judging is complete.${setting("resultsDate")?" Results will be announced on "+esc(fmtDate(setting("resultsDate")))+".":""} Submitting an entry does not guarantee a prize.</p>`}}

/* ---------- admin ---------- */
const ATABS=[["overview","Overview"],["inbox","Inbox"],["clippers","Clippers"],["clips","Clips & scoring"],["budget","Budget"],["metrics","Metrics"],["templates","Templates"],["checklist","Launch checklist"],["settings","Settings"]];
function newInboxCount(){return S.inbox.filter(e=>(e.status||"new")==="new").length}
function renderAdmin(){if(!isAdmin)return;
  const nc=newInboxCount(),pend=S.clips.filter(c=>c.status==="pending").length;
  $("#adminNav").innerHTML=ATABS.map(([k,l])=>`<button type="button" data-at="${k}" aria-pressed="${k===adminTab}">${l}${k==="inbox"&&nc?`<span class="count">${nc}</span>`:""}${k==="clips"&&pend?`<span class="count">${pend}</span>`:""}</button>`).join("");
  const a=document.activeElement;if(a&&$("#adminBody").contains(a)&&a.matches("input,select,textarea")&&!renderAdmin.force)return;renderAdmin.force=false;
  const fn={overview:aOverview,inbox:aInbox,clippers:aClippers,clips:aClips,budget:aBudget,metrics:aMetrics,templates:aTemplates,checklist:aChecklist,settings:aSettings}[adminTab];
  $("#adminBody").innerHTML=fn();bindAdmin()}
$("#adminNav").addEventListener("click",e=>{const b=e.target.closest("button[data-at]");if(!b)return;adminTab=b.dataset.at;renderAdmin.force=true;renderAdmin()});
function spentBy(){const o={prizes:0,community:0,tools:0,reserve:0};S.expenses.forEach(x=>{o[x.category]=(o[x.category]||0)+num(x.amount)});return o}
function aOverview(){
  const rows=leaderboard(),active=new Set(S.clips.filter(c=>c.status==="eligible").map(c=>c.clipperId)).size;
  const elig=S.clips.filter(c=>c.status==="eligible"),sc=elig.filter(scored),avg=sc.length?(sc.reduce((a,c)=>a+total(c),0)/sc.length).toFixed(1):"—";
  const sp=spentBy(),spent=Object.values(sp).reduce((a,b)=>a+b,0),cap=BUDGET_LINES.reduce((a,[k])=>a+num((setting("budget")||{})[k]),0);
  const done=CHECKLIST.filter((_,i)=>S.checklist["i"+i]).length;const over=weeklyOverflow();
  const top=rows.filter(r=>r.best).slice(0,3);
  return `<div class="kpis">
    <div class="kpi"><b>${S.clippers.filter(c=>c.active!==false).length}</b><span>Clippers on roster (target 10)</span></div>
    <div class="kpi"><b>${active}</b><span>Active clippers (≥1 eligible clip)</span></div>
    <div class="kpi"><b>${elig.length}</b><span>Eligible clips · ${S.clips.filter(c=>c.status==="pending").length} pending</span></div>
    <div class="kpi"><b>${avg}</b><span>Average score of scored clips</span></div>
    <div class="kpi"><b>${rs(spent)}</b><span>Spent of ${rs(cap)} cap</span></div>
    <div class="kpi"><b>${done}/${CHECKLIST.length}</b><span>Launch checklist done</span></div></div>
  ${over.size?`<div class="rule-hit"><b>${over.size} eligible clip${over.size>1?"s are":" is"} over the weekly limit</b><span>They're left out of the leaderboard. Review them in Clips &amp; scoring.</span></div>`:""}
  <div class="panel"><div class="row" style="justify-content:space-between"><h3>Results &amp; payouts</h3>
    <label class="f" style="min-width:200px">Results status<select id="resStatus">${["live","provisional","final"].map(s=>`<option value="${s}" ${setting("resultsStatus")===s?"selected":""}>${s[0].toUpperCase()+s.slice(1)}</option>`).join("")}</select></label></div>
    ${top.length?`<div class="tbl-wrap"><table><thead><tr><th>Rank</th><th>Clipper</th><th>Contact (private)</th><th class="num">Score</th><th class="num">Prize</th><th>Paid on</th><th>Payment ref</th><th></th></tr></thead><tbody>${top.map(r=>{const p=S.payouts[r.clipperId]||{};const c=S.contacts[r.clipperId]||{};
      return `<tr data-pay="${esc(r.clipperId)}"><td class="rank r${r.rank}">${r.rank}</td><td><div class="handle">${esc(r.handle)}</div><div class="sub">${esc(r.clipperId)}</div></td><td>${esc(c.contact||"—")}</td><td class="num">${r.bestScore}</td><td class="num">${rs(r.prize)}</td><td><input type="date" class="pay-date" value="${esc(p.date||"")}"></td><td><input class="pay-ref" maxlength="80" value="${esc(p.ref||"")}" placeholder="UPI ref"></td><td><button class="btn sm" data-act="savepay" type="button">${p.paid?"Update":"Mark paid"}</button>${p.paid?' <span class="chip ok">Paid</span>':""}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="muted">No scored eligible clips yet. Winners appear here once clips are scored.</p>`}
    <p class="note">Contact winners privately. Never ask for passwords, OTPs or account access. Record the date, amount and confirmation of each payout.</p></div>
  <div class="panel"><h3>Weekly review (30–45 min)</h3><ul class="rules">
    <li>Check new submissions in Inbox and mark each eligible / incomplete / rejected.</li>
    <li>Look for duplicates, suspicious view patterns and broken links.</li>
    <li>Score a small shortlist instead of every entry in depth.</li>
    <li>Post one community update with the best clip or current standings.</li>
    <li>Record one learning: which hook, category or format worked best.</li></ul></div>`}
function aInbox(){
  const entries=S.inbox.map(e=>Object.assign({_doc:e.id},e));
  entries.sort((a,b)=>(b.at||"").localeCompare(a.at||""));
  const nw=entries.filter(e=>(e.status||"new")==="new"),old=entries.filter(e=>(e.status||"new")!=="new");
  const row=e=>`<tr data-doc="${esc(e._doc)}" data-eid="${esc(e.id)}"><td class="mono">${esc(fmtDate((e.at||"").slice(0,10)))}</td><td>${e.type==="apply"?"Application":"Clip"}</td>
    <td>${e.type==="apply"?`<div class="handle">${esc(e.handle)}</div><div class="sub">${esc(e.platform)} · ${esc(e.contact)}</div>${e.profileUrl?link(e.profileUrl):""}`
      :`<div class="handle mono">${esc(e.clipperId)} ${clipperById(e.clipperId)?"":'<span class="chip bad">Unknown ID</span>'}</div><div class="sub">${esc(e.platform)} · ${esc(e.category)} · ${esc(fmtDate(e.publishDate))} · @${esc(e.timestamp)}</div>${link(e.url,"Clip ↗")} · ${link(e.sourceUrl,"Source ↗")}${e.metrics?`<div class="sub">${esc(e.metrics)}</div>`:""}`}</td>
    <td>${(e.status||"new")==="new"?`<div class="row"><button class="btn sm primary" type="button" data-act="accept">Accept</button><button class="btn sm danger" type="button" data-act="reject">Reject</button></div>`:statusChip(e.status,e)}</td></tr>`;
  const tbl=list=>`<div class="tbl-wrap"><table><thead><tr><th>Sent</th><th>Type</th><th>Entry</th><th>Action</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>`;
  return `<p class="muted">Entries sent from the Join &amp; Submit page. Accepting an application creates a Clipper ID (share it with the clipper on your community channel). Accepting a clip adds it to Clips &amp; scoring as pending.</p>
  ${nw.length?tbl(nw):`<div class="tbl-wrap"><div class="empty"><b>Inbox clear</b><span>New applications and clip submissions land here.</span></div></div>`}
  ${old.length?`<h3>Processed</h3>${tbl(old.slice(0,40))}`:""}`}
function nextClipperId(){let n=0;S.clippers.forEach(c=>{const m=/^SZ(\d+)$/.exec(c.clipperId||"");if(m)n=Math.max(n,+m[1])});return "SZ"+String(n+1).padStart(3,"0")}
function aClippers(){
  return `<form class="panel" id="addClipper"><h3>Add clipper <span class="mono muted" style="font-size:14px">${nextClipperId()}</span></h3><div class="grid-form">
   <label class="f">Handle<input id="ac-handle" required maxlength="60"></label>
   <label class="f">Platform<select id="ac-platform">${platformOpts()}</select></label>
   <label class="f">Contact (private)<input id="ac-contact" maxlength="120"></label>
   <label class="f">Join date<input id="ac-date" type="date" value="${today()}"></label></div>
   <label class="check"><input type="checkbox" id="ac-rules" checked>Rules accepted</label>
   <div class="row"><button class="btn primary" type="submit">Add clipper</button></div></form>
  ${S.clippers.length?`<div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Handle</th><th>Platform</th><th>Contact (private)</th><th>Joined</th><th>Rules</th><th class="num">Clips</th><th>Status</th><th></th></tr></thead><tbody>${S.clippers.slice().sort((a,b)=>a.clipperId.localeCompare(b.clipperId)).map(c=>`<tr data-cid="${esc(c.clipperId)}"><td class="mono"><b>${esc(c.clipperId)}</b></td><td class="handle">${esc(c.handle)}</td><td>${esc(c.platform)}</td><td>${esc((S.contacts[c.clipperId]||{}).contact||"—")}</td><td class="mono">${esc(fmtDate(c.joinDate))}</td><td>${c.rulesAccepted?'<span class="chip ok">Yes</span>':'<span class="chip bad">No</span>'}</td><td class="num">${S.clips.filter(x=>x.clipperId===c.clipperId).length}</td><td><button class="btn sm ghost" type="button" data-act="toggleActive">${c.active===false?"Inactive":"Active"}</button></td><td><button class="btn sm danger" type="button" data-act="delClipper">Remove</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="tbl-wrap"><div class="empty"><b>No clippers yet</b><span>Recruit 10 for the pilot. Expect 3–5 to stay consistently active.</span></div></div>`}`}
let clipFilter="all";
function aClips(){const over=weeklyOverflow();
  const list=S.clips.filter(c=>clipFilter==="all"||c.status===clipFilter).sort((a,b)=>(b.publishDate||"").localeCompare(a.publishDate||""));
  return `<form class="panel" id="addClip"><h3>Add clip</h3><div class="grid-form">
   <label class="f">Clipper<select id="ak-cid">${S.clippers.map(c=>`<option value="${esc(c.clipperId)}">${esc(c.clipperId)} · ${esc(c.handle)}</option>`).join("")||'<option value="">Add a clipper first</option>'}</select></label>
   <label class="f">Platform<select id="ak-platform">${platformOpts()}</select></label>
   <label class="f wide">Clip URL<input id="ak-url" maxlength="300" placeholder="https://"></label>
   <label class="f">Source stream URL<input id="ak-src" maxlength="300" placeholder="https://"></label>
   <label class="f">Timestamp<input id="ak-ts" maxlength="12" class="mono" placeholder="1:23:45"></label>
   <label class="f">Category<select id="ak-cat">${CATS.map(c=>`<option>${c}</option>`).join("")}</select></label>
   <label class="f">Publish date<input id="ak-date" type="date" value="${today()}"></label></div>
   <div class="row"><button class="btn primary" type="submit">Add clip</button></div></form>
  <div class="row"><span class="eyebrow">Filter</span>${["all"].concat(STATUSES).map(s=>`<button class="btn sm ${clipFilter===s?"":"ghost"}" type="button" data-filter="${s}">${s} (${s==="all"?S.clips.length:S.clips.filter(c=>c.status===s).length})</button>`).join("")}</div>
  ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>Clip</th><th>Status</th>${SK.map(([k,l,m])=>`<th class="num" title="${l}">${l.split(" ")[0]} /${m}</th>`).join("")}<th class="num">Total</th><th>Public note</th><th></th></tr></thead><tbody>${list.map(c=>{const s=c.scores||{};const p=clipperById(c.clipperId)||{};
    return `<tr data-clip="${esc(c.id)}"><td><div class="handle">${esc(p.handle||c.clipperId)} <span class="sub">${esc(c.clipperId)}</span></div><div class="sub">${esc(c.platform)} · ${esc(c.category)} · ${esc(fmtDate(c.publishDate))} · @${esc(c.timestamp||"")}</div>${link(c.url,"Clip ↗")} · ${link(c.sourceUrl,"Source ↗")}${over.has(c.id)?' <span class="chip bad">Over weekly limit</span>':""}</td>
    <td><select class="k-status">${STATUSES.map(x=>`<option ${c.status===x?"selected":""}>${x}</option>`).join("")}</select></td>
    ${SK.map(([k,,m])=>`<td class="num scorecell"><input type="number" min="0" max="${m}" step="1" data-k="${k}" value="${s[k]===undefined||s[k]===null?"":esc(s[k])}"></td>`).join("")}
    <td class="num"><b class="k-total">${scored(c)?total(c):"—"}</b></td>
    <td><input class="k-note" maxlength="140" value="${esc(c.publicNote||"")}" placeholder="Why it ranked"></td>
    <td><div class="row" style="flex-wrap:nowrap"><button class="btn sm primary" type="button" data-act="saveClip">Save</button><button class="btn sm danger" type="button" data-act="delClip">Delete</button></div></td></tr>`}).join("")}</tbody></table></div>`:`<div class="tbl-wrap"><div class="empty"><b>No clips here</b><span>Accept clips from the Inbox or add them from your form responses.</span></div></div>`}
  <p class="note">Score a shortlist, not every entry. Reach is judged from available analytics and clip age, never from unverifiable screenshots. Totals rank by the clipper's best eligible clip; ties go to editing + originality, then compliance.</p>`}
function aBudget(){const b=Object.assign({},DEFAULTS.budget,setting("budget")||{}),sp=spentBy();
  const cap=BUDGET_LINES.reduce((a,[k])=>a+num(b[k]),0),spent=Object.values(sp).reduce((a,v)=>a+v,0);
  return `<div class="panel"><div class="row" style="justify-content:space-between"><h3>This month</h3><span class="mono"><b>${rs(spent)}</b> of ${rs(cap)}</span></div>
   ${BUDGET_LINES.map(([k,l])=>{const pct=num(b[k])?sp[k]/num(b[k])*100:0;return `<div class="meter"><div class="lab"><span>${l}</span><span class="mono">${rs(sp[k])} / ${rs(b[k])}</span></div><div class="m"><i class="${pct>100?"over":""}" style="width:${Math.min(100,pct)}%"></i></div></div>`}).join("")}
   <p class="note">Start at ₹3,000. Raise toward ₹5,000 only after a full month of data, and put the extra ₹2,000 into the best-supported need, not automatically into prizes. Never borrow or use essential money for rewards.</p></div>
  <form class="panel" id="addExpense"><h3>Log expense</h3><div class="grid-form">
   <label class="f">Date<input id="ae-date" type="date" value="${today()}"></label>
   <label class="f">Category<select id="ae-cat">${BUDGET_LINES.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></label>
   <label class="f">Amount (₹)<input id="ae-amt" type="number" min="0" step="1" class="mono"></label>
   <label class="f">Purpose<input id="ae-purpose" maxlength="120"></label>
   <label class="f">Receipt / reference<input id="ae-ref" maxlength="80"></label>
   <label class="f">Approved by<input id="ae-by" maxlength="60" value="SHAHZON"></label></div>
   <div class="row"><button class="btn primary" type="submit">Add expense</button></div></form>
  ${S.expenses.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Category</th><th class="num">Amount</th><th>Purpose</th><th>Reference</th><th>Approved by</th><th></th></tr></thead><tbody>${S.expenses.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(x=>`<tr data-exp="${esc(x.id)}"><td class="mono">${esc(fmtDate(x.date))}</td><td>${esc((BUDGET_LINES.find(l=>l[0]===x.category)||[,x.category])[1])}</td><td class="num">${rs(x.amount)}</td><td>${esc(x.purpose)}</td><td>${esc(x.ref)}</td><td>${esc(x.by)}</td><td><button class="btn sm danger" type="button" data-act="delExp">Delete</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">No expenses logged yet.</p>`}`}
const MF=[["startSubs","Start subscribers"],["endSubs","End subscribers"],["shorts","Shorts published (by clippers)"],["views","Clip views"],["subsGained","Subscribers gained"],["returning","Returning viewers"],["liveAvg","Live avg concurrent"],["livePeak","Live peak concurrent"]];
function aMetrics(){const ms=S.metrics.slice().sort((a,b)=>(b.month||"").localeCompare(a.month||""));const m0=ms[0];
  return `<form class="panel" id="addMetric"><h3>Record a month</h3><div class="grid-form">
   <label class="f">Month<input id="am-month" type="month" value="${today().slice(0,7)}"></label>
   ${MF.map(([k,l])=>`<label class="f">${l}<input id="am-${k}" type="number" min="0" step="1" class="mono"></label>`).join("")}</div>
   <div class="row"><button class="btn primary" type="submit">Save month</button></div></form>
  ${ms.length?`<div class="tbl-wrap"><table><thead><tr><th>Month</th>${MF.map(([,l])=>`<th class="num">${l}</th>`).join("")}<th class="num">Spend</th><th></th></tr></thead><tbody>${ms.map(m=>`<tr data-met="${esc(m.id)}"><td class="mono"><b>${esc(m.month)}</b></td>${MF.map(([k])=>`<td class="num">${m[k]===""||m[k]==null?"—":num(m[k]).toLocaleString("en-IN")}</td>`).join("")}<td class="num">${rs(spendFor(m.month))}</td><td><button class="btn sm danger" type="button" data-act="delMet">Delete</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">Record your baseline before launch, then the month-end numbers.</p>`}
  <div class="panel"><h3>Decision rules</h3>${decisions(m0)}</div>`}
function spendFor(month){return S.expenses.filter(x=>(x.date||"").slice(0,7)===month).reduce((a,x)=>a+num(x.amount),0)}
function decisions(m){const hits=[];const elig=S.clips.filter(c=>c.status==="eligible"),sc=elig.filter(scored);
  const avg=sc.length?sc.reduce((a,c)=>a+total(c),0)/sc.length:null;
  if(S.clips.length<10)hits.push(["Very few submissions","Improve recruitment and make submitting easier before increasing prizes."]);
  if(S.clips.length>=10&&avg!==null&&avg<55)hits.push(["Many clips, low quality","Share a clear editing guide and reduce entries allowed per clipper."]);
  if(m&&num(m.views)>0&&num(m.subsGained)/Math.max(1,num(m.views))<0.001)hits.push(["Views but little channel growth","Improve attribution, profile links, calls to action and content fit."]);
  if(m&&num(m.subsGained)>0&&num(m.returning)>0&&num(m.returning)<num(m.subsGained))hits.push(["Subscribers aren't returning","Strengthen the stream's recurring format, schedule communication and chat interaction."]);
  const base=hits.length?hits.map(([a,b])=>`<div class="rule-hit"><b>${a}</b><span>${b}</span></div>`).join(""):`<p class="msg ok">No warning signals from the current data.</p>`;
  return base+`<ul class="rules" style="margin-top:8px"><li>Management over 2–3 hours/week: simplify scoring, review a shortlist, or appoint a helper.</li><li>No evidence of value after 30–60 days: pause paid prizes and reassess.</li></ul>`}
function aTemplates(){const pz=prizes(),top=leaderboard().filter(r=>r.best).slice(0,3);
  const form=safeUrl(setting("applyFormUrl"))||"[FORM LINK]";const rd=setting("resultsDate")?fmtDate(setting("resultsDate")):"[DATE]";const contact=setting("contact")||"[OFFICIAL CONTACT]";
  const T=[["Recruitment announcement",`🎬 SHAHZON CLIP LEAGUE — ${setting("season").toUpperCase()}

I'm opening a small pilot for people who enjoy editing BGMI content. You can create original clips from eligible SHAHZON livestream moments and publish them on your own account, with clear credit and a link to my official channel.

🏆 Monthly prize pool: ${rs(pz[0]+pz[1]+pz[2])} (${rs(pz[0])} / ${rs(pz[1])} / ${rs(pz[2])})
✅ Free to join
🎮 BGMI clutch moments, funny reactions, squad moments and creative edits
📊 Winners are selected using published criteria covering editing quality, genuine reach/retention, originality and consistency.

No fake views, spam, copied edits or paid engagement. Participation does not guarantee a prize or income. Read the complete rules and submit your application here: ${form}

SHAHZON is running this as a pilot; the programme may be revised for future seasons.`],
  ["Submission confirmation",`Thanks for submitting your clip to SHAHZON Clip League. Your entry has been received, but it is not yet confirmed as eligible. Please keep the clip public and the submitted information accurate until judging is complete. Results will be announced on ${rd}. Submitting an entry does not guarantee a prize.`],
  ["Monthly results",`🏆 SHAHZON CLIP LEAGUE — MONTHLY RESULTS

1st: ${top[0]?top[0].handle:"[HANDLE]"} — ${rs(pz[0])}
2nd: ${top[1]?top[1].handle:"[HANDLE]"} — ${rs(pz[1])}
3rd: ${top[2]?top[2].handle:"[HANDLE]"} — ${rs(pz[2])}

Thanks to everyone who participated. Winners were selected using the published scoring criteria. Please contact ${contact} by ${rd} to arrange the prize. Do not send passwords or OTPs. Next season details, if any, will be announced separately.`]];
  return `<p class="muted">Filled in from your settings and current standings. Placeholders in [brackets] still need your input.</p><div class="two">${T.map(([t,b])=>`<div class="panel"><div class="row" style="justify-content:space-between"><h3>${t}</h3><button class="btn sm" type="button" data-copy>Copy</button></div><pre class="tpl">${esc(b)}</pre></div>`).join("")}</div>`}
function aChecklist(){return `<div class="panel"><h3>Launch checklist</h3><div style="display:grid;gap:10px">${CHECKLIST.map((t,i)=>`<label class="check"><input type="checkbox" data-chk="i${i}" ${S.checklist["i"+i]?"checked":""}>${esc(t)}</label>`).join("")}</div></div>`}
function aSettings(){const st=S.settings,b=Object.assign({},DEFAULTS.budget,setting("budget")||{}),pz=prizes();
  const f=(id,l,v,t,extra)=>`<label class="f">${l}<input id="${id}" type="${t||"text"}" value="${esc(v==null?"":v)}" ${extra||""}></label>`;
  return `<form class="panel" id="settingsForm"><h3>Season</h3><div class="grid-form">
   ${f("s-season","Season name",setting("season"),"text",'maxlength="40"')}${f("s-start","Start date",st.startDate,"date")}${f("s-end","End date",st.endDate,"date")}${f("s-results","Results announcement date",st.resultsDate,"date")}
   ${f("s-weekly","Eligible entries per clipper per week",setting("weeklyLimit"),"number",'min="1" max="20"')}${f("s-platforms","Approved platforms (comma separated)",setting("platforms"),"text",'maxlength="160"')}</div>
   <h3>Links</h3><div class="grid-form">
   ${f("s-channel","Official channel URL",st.channelUrl,"url")}${f("s-community","Community URL (Discord / WhatsApp / Telegram)",st.communityUrl,"url")}${f("s-communityName","Community name",st.communityName)}
   ${f("s-apply","Application Google Form URL",st.applyFormUrl,"url")}${f("s-submit","Clip submission Google Form URL",st.submitFormUrl,"url")}${f("s-contact","Official contact (for winners)",st.contact,"text",'maxlength="120"')}</div>
   <h3>Prizes &amp; budget (₹)</h3><div class="grid-form">
   ${f("s-p1","1st prize",pz[0],"number",'min="0"')}${f("s-p2","2nd prize",pz[1],"number",'min="0"')}${f("s-p3","3rd prize",pz[2],"number",'min="0"')}
   ${BUDGET_LINES.map(([k,l])=>f("s-b-"+k,l+" cap",b[k],"number",'min="0"')).join("")}</div>
   <p class="note">Don't retroactively change rules or prizes for a running season. Publish exact dates, scoring and payout timeline before launch, and only announce prizes you can fund.</p>
   <div id="s-msg"></div><div class="row"><button class="btn primary" type="submit">Save settings</button></div></form>`}

/* ---------- admin actions ---------- */
let busy=false;
async function guard(fn){if(busy)return;busy=true;try{await fn();await load()}catch(e){toast(e&&e.status===401?"Signed out. Sign in again from the Organiser link.":(e&&e.message)||"Couldn't save. Try again.")}finally{busy=false}}
function bindAdmin(){const body=$("#adminBody");
  const af=$("#addClipper");if(af)af.onsubmit=e=>{e.preventDefault();const h=$("#ac-handle").value.trim();if(!h)return toast("Add a handle");const id=nextClipperId();
    guard(async()=>{await put("clippers",id,{clipperId:id,handle:h,platform:$("#ac-platform").value,joinDate:$("#ac-date").value,rulesAccepted:$("#ac-rules").checked,active:true,createdAt:Date.now()});
      const c=$("#ac-contact").value.trim();if(c)await put("contacts",id,{contact:c});toast(id+" added");renderAdmin.force=true})};
  const ak=$("#addClip");if(ak)ak.onsubmit=e=>{e.preventDefault();const cid=$("#ak-cid").value;if(!cid)return toast("Add a clipper first");const url=$("#ak-url").value.trim();if(!safeUrl(url))return toast("Clip URL must start with https://");
    guard(async()=>{const id=newId("k");await put("clips",id,{id,clipperId:cid,platform:$("#ak-platform").value,url,sourceUrl:$("#ak-src").value.trim(),timestamp:$("#ak-ts").value.trim(),category:$("#ak-cat").value,publishDate:$("#ak-date").value,status:"pending",scores:{},createdAt:Date.now()});toast("Clip added as pending");renderAdmin.force=true})};
  const ae=$("#addExpense");if(ae)ae.onsubmit=e=>{e.preventDefault();const amt=num($("#ae-amt").value);if(amt<=0)return toast("Enter an amount");
    guard(async()=>{const id=newId("e");await put("expenses",id,{id,date:$("#ae-date").value,category:$("#ae-cat").value,amount:amt,purpose:$("#ae-purpose").value.trim(),ref:$("#ae-ref").value.trim(),by:$("#ae-by").value.trim()});toast("Expense logged");renderAdmin.force=true})};
  const am=$("#addMetric");if(am)am.onsubmit=e=>{e.preventDefault();const month=$("#am-month").value;if(!/^\d{4}-\d{2}$/.test(month))return toast("Pick a month");const d={id:month,month};MF.forEach(([k])=>{const v=$("#am-"+k).value;d[k]=v===""?"":num(v)});
    guard(async()=>{await put("metrics",month,d);toast("Saved "+month);renderAdmin.force=true})};
  const sf=$("#settingsForm");if(sf)sf.onsubmit=e=>{e.preventDefault();const v=id=>$("#"+id).value.trim();
    const urls=["s-channel","s-community","s-apply","s-submit"].filter(i=>v(i)&&!safeUrl(v(i)));if(urls.length){$("#s-msg").innerHTML=`<p class="msg bad">Links must start with https://</p>`;return}
    const d={season:v("s-season")||"Season 01",startDate:v("s-start"),endDate:v("s-end"),resultsDate:v("s-results"),weeklyLimit:num(v("s-weekly"))||3,platforms:v("s-platforms")||DEFAULTS.platforms,
      channelUrl:v("s-channel"),communityUrl:v("s-community"),communityName:v("s-communityName"),applyFormUrl:v("s-apply"),submitFormUrl:v("s-submit"),contact:v("s-contact"),
      prizes:[num(v("s-p1")),num(v("s-p2")),num(v("s-p3"))],budget:{},resultsStatus:setting("resultsStatus")};
    BUDGET_LINES.forEach(([k])=>d.budget[k]=num(v("s-b-"+k)));
    guard(async()=>{await put("settings","season",d);renderAdmin.force=true;toast("Settings saved. The public pages are updated.")})};
  const rsel=$("#resStatus");if(rsel)rsel.onchange=()=>guard(async()=>{await put("settings","season",Object.assign({},S.settings,{resultsStatus:rsel.value}));toast("Results status: "+rsel.value)});
  $$("[data-chk]",body).forEach(cb=>cb.onchange=()=>guard(async()=>{const items=Object.assign({},S.checklist,{[cb.dataset.chk]:cb.checked});await put("ops","checklist",{items})}));
  $$("[data-filter]",body).forEach(b=>b.onclick=()=>{clipFilter=b.dataset.filter;renderAdmin.force=true;renderAdmin()});
  $$("[data-copy]",body).forEach(b=>b.onclick=()=>copyText(b.closest(".panel").querySelector("pre").textContent,b));
  $$(".scorecell input",body).forEach(inp=>inp.oninput=()=>{const tr=inp.closest("tr");const vals=$$(".scorecell input",tr).map(i=>i.value);const t=tr.querySelector(".k-total");t.textContent=vals.every(x=>x!=="")?vals.reduce((a,x)=>a+num(x),0):"—"});
  body.onclick=e=>{const b=e.target.closest("button[data-act]");if(!b)return;const act=b.dataset.act,tr=b.closest("tr");
    if(act==="saveClip"){const id=tr.dataset.clip,c=S.clips.find(x=>x.id===id);if(!c)return;const scores={};let bad=false;
      $$(".scorecell input",tr).forEach(i=>{const k=i.dataset.k,m=SK.find(s=>s[0]===k)[2];if(i.value==="")return;const n=num(i.value);if(n<0||n>m)bad=true;scores[k]=Math.round(n)});
      if(bad)return toast("A score is above its maximum");
      guard(async()=>{await put("clips",id,Object.assign({},c,{status:tr.querySelector(".k-status").value,scores,publicNote:tr.querySelector(".k-note").value.trim(),reviewedAt:Date.now()}));toast("Saved");renderAdmin.force=true})}
    else if(act==="delClip"||act==="delClipper"||act==="delExp"||act==="delMet"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Confirm?";setTimeout(()=>{if(b.isConnected){b.dataset.armed="";b.textContent=act==="delClipper"?"Remove":"Delete"}},3000);return}
      guard(async()=>{if(act==="delClip")await del("clips",tr.dataset.clip);if(act==="delClipper"){await del("clippers",tr.dataset.cid);await del("contacts",tr.dataset.cid)}
        if(act==="delExp")await del("expenses",tr.dataset.exp);if(act==="delMet")await del("metrics",tr.dataset.met);toast("Deleted");renderAdmin.force=true})}
    else if(act==="toggleActive"){const c=clipperById(tr.dataset.cid);guard(async()=>{await put("clippers",c.clipperId,Object.assign({},c,{active:c.active===false}));renderAdmin.force=true})}
    else if(act==="savepay"){const id=tr.dataset.pay,r=leaderboard().find(x=>x.clipperId===id);const date=tr.querySelector(".pay-date").value,ref=tr.querySelector(".pay-ref").value.trim();
      guard(async()=>{const by=Object.assign({},S.payouts,{[id]:{paid:!!date,date,ref,amount:r?r.prize:0}});await put("ops","payouts",{byClipper:by});toast(date?"Payout recorded":"Saved");renderAdmin.force=true})}
    else if(act==="accept"||act==="reject"){processEntry(tr.dataset.eid,act)}};
}
function processEntry(eid,act){const src=S.inbox.find(x=>x.id===eid);if(!src)return;const e=Object.assign({},src);
  guard(async()=>{if(act==="accept"){if(e.type==="apply"){const id=nextClipperId();await put("clippers",id,{clipperId:id,handle:e.handle,platform:e.platform,joinDate:today(),rulesAccepted:!!e.rulesAccepted,active:true,createdAt:Date.now()});
        await put("contacts",id,{contact:e.contact||"",profileUrl:e.profileUrl||""});e.assignedId=id}
      else{const id=newId("k");await put("clips",id,{id,clipperId:e.clipperId,platform:e.platform,url:e.url,sourceUrl:e.sourceUrl,timestamp:e.timestamp,category:e.category,publishDate:e.publishDate,metrics:e.metrics||"",status:"pending",scores:{},createdAt:Date.now()})}
      e.status="accepted"}else e.status="rejected";
    delete e._doc;await put("inbox",eid,e);toast(act==="accept"?(e.assignedId?"Accepted as "+e.assignedId:"Clip added as pending"):"Rejected");renderAdmin.force=true})}

/* ---------- data loading ---------- */
function setLive(on,text){const el=$("#liveState");el.classList.toggle("on",on);el.querySelector("span").textContent=text}
function renderAll(){renderPublic();if(isAdmin&&!$("#v-admin").hidden)renderAdmin()}
let rq=0;function schedule(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;renderAll()})}
async function load(){
  try{
    if(isAdmin){
      const j=await api("admin_state",{});
      const season=(j.settings||[]).find(d=>d.id==="season");S.settings=Object.assign(clone(DEFAULTS),season||{});
      S.clippers=j.clippers||[];S.clips=j.clips||[];S.expenses=j.expenses||[];S.metrics=j.metrics||[];S.inbox=j.inbox||[];
      S.contacts={};(j.contacts||[]).forEach(x=>S.contacts[x.id]=x);
      const ops=j.ops||[];const ck=ops.find(d=>d.id==="checklist"),po=ops.find(d=>d.id==="payouts");
      S.checklist=(ck&&ck.items)||{};S.payouts=(po&&po.byClipper)||{};
    }else{
      const j=await api("public_state");S.settings=Object.assign(clone(DEFAULTS),j.settings||{});S.clippers=j.clippers||[];S.clips=j.clips||[];
    }
    setLive(true,isAdmin?"Organiser":"Live");
  }catch(e){
    if(e.status===401&&isAdmin){signOut();return load()}
    setLive(false,API_URL?"Offline":"Not connected")}
  schedule()}
async function loadMine(){if(!API_URL)return;try{const j=await api("my_entries",{token:TOKEN});S.myInbox={entries:j.entries||[]};schedule()}catch(e){}}
function signOut(){adminToken="";ssSet("szAdmin","");isAdmin=false;S.inbox=[];S.contacts={};S.expenses=[];S.metrics=[];if(location.hash==="#admin")location.hash="#home";route()}
$("#logoutBtn").addEventListener("click",()=>{signOut();load();toast("Signed out")});
$("#loginForm").addEventListener("submit",async ev=>{ev.preventDefault();const m=$("#lg-msg"),p=$("#lg-pass").value;
  if(!p){m.innerHTML=`<p class="msg bad">Enter the organiser password.</p>`;return}
  m.innerHTML=`<p class="msg info">Signing in…</p>`;
  try{const j=await api("login",{password:p});adminToken=j.adminToken;ssSet("szAdmin",adminToken);isAdmin=true;$("#lg-pass").value="";m.innerHTML="";await load();location.hash="#admin";route()}
  catch(e){m.innerHTML=`<p class="msg bad">${esc(e.message)}</p>`}});
let pollT=0;
function boot(){
  renderPublic();route();load().then(()=>route());loadMine();
  pollT=setInterval(()=>{if(document.visibilityState==="visible"&&!busy&&API_URL)load()},30000)}
boot();
})();

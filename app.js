const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const qs=new URLSearchParams(location.search);let section=qs.get("section")||"main";const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function pointsAt(rank,points){return Number(points[Math.max(0,Number(rank||1)-1)]||0)}
function sectionLabel(x){return x==='main'?'MAIN':x==='extended'?'EXTENDED':'LEGACY'}
async function data(){
 if(!sb){$('notice').textContent="Demo mode: connect Supabase in config.js to use live data.";return{settings:{list_name:"DIDDY DEMON LIST",tagline:"The most scientifically questionable demon list on Earth."},levels:[],players:[],records:[],points:Array.from({length:100},(_,i)=>Math.max(1,Math.round(100-99*Math.pow(i/99,.62))))};}
 const q=await Promise.all([
  sb.from('list_settings').select('*').limit(1).single(),sb.from('levels').select('*').order('section').order('rank'),
  sb.from('players').select('*').order('name'),sb.from('records').select('*'),sb.from('point_values').select('rank,points').order('rank')
 ]);
 const bad=q.find(x=>x.error);if(bad?.error){$('notice').innerHTML=`<div class="panel error">${esc(bad.error.message)}</div>`}
 return{settings:q[0].data,levels:q[1].data||[],players:q[2].data||[],records:q[3].data||[],points:(q[4].data||[]).map(x=>x.points)};
}
function render(d){
 $('listName').textContent=d.settings?.list_name||'DIDDY DEMON LIST';$('tagline').textContent=d.settings?.tagline||'';
 $('levelCount').textContent=d.levels.length;$('playerCount').textContent=d.players.length;
 const search=($('search').value||'').toLowerCase().trim(),sort=$('sort').value;
 let arr=d.levels.filter(x=>x.section===section&&[x.name,x.creator,x.verifier,x.holder,x.difficulty,x.status,x.aliases,x.notes].join(' ').toLowerCase().includes(search));
 arr.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='points'?pointsAt(b.rank,d.points)-pointsAt(a.rank,d.points):a.rank-b.rank);
 $('notice').innerHTML=`<div class="listSummary"><span><b>${arr.length}</b> shown</span><span><b>${sectionLabel(section)}</b> section</span>${search?`<span>search: <b>${esc(search)}</b></span>`:''}</div>`;
 let html='';
 arr.forEach((l,i)=>{
  const wins=d.records.filter(r=>r.level_id===l.id).length,pts=pointsAt(l.rank,d.points),max=Math.max(...d.points,1),pct=Math.max(3,Math.round(pts/max*100));
  const thumb=l.thumbnail_url?`<img src="${esc(l.thumbnail_url)}" alt="">`:`<span class="thumbPlaceholder">${String(l.name||'?').slice(0,1).toUpperCase()}</span>`;
  const tags=[l.difficulty,l.status].filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
  html+=`<article class="levelCard polishedLevelCard"><a class="thumb" href="level.html?id=${encodeURIComponent(l.id)}">${thumb}</a><div class="levelMain"><div class="levelTop"><span class="rank">#${l.rank}</span><span class="sectionPill">${sectionLabel(l.section)}</span>${tags}</div><a class="levelTitle" href="level.html?id=${encodeURIComponent(l.id)}">${esc(l.name)}</a><div class="meta">Creator: ${esc(l.creator||'—')} · Verifier: <span class="victor">${esc(l.verifier||'—')}</span></div><div class="meta">Holder: ${esc(l.holder||'—')} · <b>${wins}</b> victor${wins===1?'':'s'}</div><div class="rankMeter"><span style="width:${pct}%"></span></div></div><div class="points"><strong>${pts}</strong><small>points</small></div></article>`;
 });
 $('list').innerHTML=html||"<div class='panel emptyState'><div>💀</div><h2>No levels found</h2><p>Try another search or add a level from Admin.</p></div>";
}
async function boot(){const sel=$('section');sel.value=section;sel.onchange=()=>location.search='?section='+sel.value;$('search').oninput=()=>render(window.D);$('sort').onchange=()=>render(window.D);window.D=await data();render(window.D);}boot();

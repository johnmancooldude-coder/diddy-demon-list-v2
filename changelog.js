const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function renderReleaseNotes(){
  const el=document.getElementById('releaseNotes');
  if(!el)return;
  const releases=Array.isArray(window.DIDDY_RELEASE_NOTES)?window.DIDDY_RELEASE_NOTES:[];
  el.innerHTML=releases.map((x,i)=>`<article class="changeCard"><div class="changeMarker">${i===0?'NEW':'↳'}</div><div><div class="eyebrow">${esc(new Date(x.date).toLocaleString())}</div><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p></div></article>`).join('')||'<div class="panel emptyState"><div>📜</div><h2>No release notes yet</h2><p>Add the next release to release-notes.js.</p></div>';
}

async function boot(){
  renderReleaseNotes();
  const el=document.getElementById('changes');
  if(!el)return;
  if(!sb){el.innerHTML='<div class="panel">Connect Supabase to see the live changelog entries.</div>';return}
  const {data,error}=await sb.from('changelog').select('*').order('created_at',{ascending:false});
  if(error){el.innerHTML=`<div class="panel error">${esc(error.message)}</div>`;return}
  const rows=data||[];
  el.innerHTML=rows.map((x,i)=>`<article class="changeCard"><div class="changeMarker">${i===0?'LIVE':'↳'}</div><div><div class="eyebrow">${esc(new Date(x.created_at).toLocaleString())}</div><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p></div></article>`).join('')||'<div class="panel emptyState"><div>🗃️</div><h2>No live entries yet</h2><p>Admin-published announcements will appear here.</p></div>';
}
boot();

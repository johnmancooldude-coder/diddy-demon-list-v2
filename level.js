const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const id=new URLSearchParams(location.search).get('id');
const $=id=>document.getElementById(id);const esc=s=>String(s??'');
async function boot(){
 if(!sb){$('levelPage').innerHTML='<div class="panel"><h1>Demo mode</h1><p>Connect Supabase in config.js first.</p></div>';return}
 const q=await Promise.all([sb.from('levels').select('*').eq('id',id).single(),sb.from('records').select('*,players(name)').eq('level_id',id),sb.from('placement_history').select('*').eq('level_id',id).order('recorded_at',{ascending:false}),sb.from('point_values').select('*')]);
 const l=q[0].data;if(q[0].error){$('levelPage').innerHTML='<div class="panel">Level not found.</div>';return}
 const points=Object.fromEntries((q[3].data||[]).map(x=>[x.rank,x.points])),wins=q[1].data||[],hist=q[2].data||[];
 let victorHtml='';wins.forEach(x=>{victorHtml+=`<div class="adminRow row between"><a href="player.html?id=${x.player_id}"><strong>${esc(x.players?.name||'Unknown')}</strong></a><span class="meta">${x.progress||100}% · ${x.video_url?'video':'no video'}</span></div>`});if(!victorHtml)victorHtml='<p class="muted">No victors yet.</p>';
 let histHtml='';hist.forEach(h=>{histHtml+=`<div><strong>#${h.rank}</strong> · ${h.points} pts <span class="muted">· ${new Date(h.recorded_at).toLocaleString()}</span><div class="small muted">${esc(h.note||'Placement update')}</div></div>`});if(!histHtml)histHtml='<p class="muted">No history yet.</p>';
 const video=l.video_url?'<a class="btn" target="_blank" href="'+l.video_url+'">Verification video</a>':'No verification video added.';
 $('levelPage').innerHTML=`<section class="hero"><div><p class="eyebrow">#${l.rank} · ${l.section.toUpperCase()}</p><h1>${esc(l.name)}</h1><p>${esc(l.description||'No description added yet.')}</p></div><div class="heroStats"><div><b>${points[l.rank]||0}</b><span>points</span></div><div><b>${wins.length}</b><span>victors</span></div></div></section><section class="panel"><div class="grid"><div class="stat"><span class="muted">Creator</span><strong>${esc(l.creator||'—')}</strong></div><div class="stat"><span class="muted">Verifier</span><strong>${esc(l.verifier||'—')}</strong></div><div class="stat"><span class="muted">Holder</span><strong>${esc(l.holder||'—')}</strong></div><div class="stat"><span class="muted">Times ranked</span><strong>${hist.length||1}</strong></div></div><p>${video}</p><p class="meta">Difficulty: ${esc(l.difficulty||'—')} · Status: ${esc(l.status||'—')} · Aliases: ${esc(l.aliases||'—')}</p><p>${esc(l.notes||'')}</p></section><section class="panel"><h2>Victors</h2><div class="list">${victorHtml}</div></section><section class="panel"><h2>Placement history</h2><div class="history">${histHtml}</div></section>`;
}
boot();

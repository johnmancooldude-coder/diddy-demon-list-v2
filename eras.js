const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const dayMs=86400000;
function dayKey(v){const d=new Date(v);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
function rankAtTime(levelId,when,history,levels){
  const rows=history.filter(x=>x.level_id===levelId&&new Date(x.recorded_at).getTime()<=when).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));
  return rows[0]?.rank ?? levels.find(x=>x.id===levelId)?.rank ?? 999;
}
function titleFor(cluster,dominant){
  if(dominant?.name) return 'THE '+String(dominant.name).toUpperCase()+' ERA';
  if(cluster.hasOne) return 'THE #1 ERA';
  if(cluster.events>=12) return 'THE CHAOS ERA';
  return 'THE DIDDY ERA';
}
async function boot(){
  const el=document.getElementById('eras');
  if(!sb){el.innerHTML='<div class="panel error">Configure Supabase first.</div>';return}
  const [phRes,recRes,plRes,lvRes]=await Promise.all([
    sb.from('placement_history').select('*').order('recorded_at'),
    sb.from('records').select('id,player_id,level_id,created_at,attempts,completion_seconds'),
    sb.from('players').select('id,name'),
    sb.from('levels').select('id,name,rank,section')
  ]);
  const firstErr=[phRes,recRes,plRes,lvRes].find(x=>x.error);
  if(firstErr){el.innerHTML='<div class="panel error">'+esc(firstErr.error.message)+'</div>';return}
  const history=phRes.data||[], records=recRes.data||[], players=plRes.data||[], levels=lvRes.data||[], pMap=Object.fromEntries(players.map(p=>[p.id,p])), lMap=Object.fromEntries(levels.map(l=>[l.id,l]));
  const byDay={};
  history.forEach(x=>{const k=dayKey(x.recorded_at);(byDay[k]??=[]).push(x)});
  records.forEach(r=>{const k=dayKey(r.created_at);(byDay[k]??=[]).push({...r,__victory:true})});
  const activeDays=Object.entries(byDay).filter(([,events])=>events.length>=3||events.some(x=>Number(x.rank)===1));
  if(!activeDays.length){el.innerHTML='<div class="eraEmpty"><h2>No era-defining history yet.</h2><p class="meta">Eras form automatically when ranking activity, #1 changes, or victory activity creates a sustained historical period.</p></div>';return}
  activeDays.sort((a,b)=>Number(a[0])-Number(b[0]));
  const clusters=[];
  for(const [k,events] of activeDays){const t=Number(k);const prev=clusters.at(-1);if(prev&&t-prev.end<=dayMs*2){prev.end=t;prev.days.push(t);prev.raw.push(...events)}else clusters.push({start:t,end:t,days:[t],raw:[...events]})}
  const eras=clusters.map(c=>{
    const start=c.start,end=c.end+dayMs-1, victories=records.filter(r=>{const t=new Date(r.created_at).getTime();return t>=start&&t<=end});
    const counts={}; victories.forEach(r=>{const p=pMap[r.player_id];if(!p)return;const q=counts[r.player_id]??{id:r.player_id,name:p.name,wins:0,points:0,oneWins:0};q.wins++;const rank=rankAtTime(r.level_id,new Date(r.created_at).getTime(),history,levels);const pts=rank>0&&rank<1000?Math.max(1,Math.round(100-99*Math.pow((rank-1)/99,.62))):0;q.points+=pts;if(rank===1)q.oneWins++;counts[r.player_id]=q});
    const dominant=Object.values(counts).sort((a,b)=>b.wins-a.wins||b.points-a.points)[0];
    const movementEvents=c.raw.filter(x=>!x.__victory);const oneEvents=movementEvents.filter(x=>Number(x.rank)===1);const uniqueLevels=new Set(victories.map(x=>x.level_id));
    return {start,end,victories,dominant,movementEvents,oneEvents,uniqueLevels,title:titleFor({events:c.raw.length,hasOne:oneEvents.length>0},dominant)};
  }).sort((a,b)=>b.start-a.start).slice(0,20);
  el.innerHTML=eras.map((e,i)=>{
    const d=e.dominant;
    const player=d?`<a class="eraLink" href="player.html?id=${encodeURIComponent(d.id)}">${esc(d.name)}</a>`:'No dominant player';
    const one=e.victories.filter(r=>rankAtTime(r.level_id,new Date(r.created_at).getTime(),history,levels)===1).length;
    const points=d?.points||0;
    const span=Math.max(1,Math.round((e.end-e.start)/dayMs)+1);
    const activity=e.movementEvents.length;
    const highlight=d?`${esc(d.name)} led the era with ${d.wins} victory${d.wins===1?'':'ies'}.`:(activity+' ranking events defined this period.');
    return `<article class="eraCard ${i===0?'eraCurrent':''}"><div class="eraCardTop"><span class="eraBadge">${i===0?'CURRENT ERA':'ERA '+(i+1)}</span><span class="eraDates">${fmt(e.start)} → ${fmt(e.end)}</span></div><h2>${esc(e.title)}</h2><p class="eraLead">${highlight}</p><div class="eraStats"><div><b>${span}</b><span>days</span></div><div><b>${e.victories.length}</b><span>victories</span></div><div><b>${one}</b><span>#1-level wins</span></div><div><b>${points.toLocaleString()}</b><span>era points</span></div><div><b>${activity}</b><span>rank events</span></div><div><b>${e.uniqueLevels.size}</b><span>levels active</span></div></div><div class="eraDetails"><div><small>DOMINANT PLAYER</small><strong>${player}</strong></div><div><small>ERA MEMORY</small><strong>${e.movementEvents.length?e.movementEvents.slice(0,2).map(x=>esc(x.note||('Rank #'+x.rank+' recorded'))).join(' · '):'Victory activity created this chapter.'}</strong></div></div></article>`;
  }).join('');
}
boot();

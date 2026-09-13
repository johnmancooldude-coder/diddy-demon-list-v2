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
function pointsForRank(rank){
  const r=Number(rank);
  return r>0&&r<1000?Math.max(1,Math.round(100-99*Math.pow((r-1)/99,.62))):0;
}
function playerScore(s){
  // Multi-signal era dominance: wins matter most, but quality, #1 wins, breadth,
  // consistency, and activity all contribute. This prevents one fresh victory
  // from casually replacing an established era leader.
  return s.wins*10+s.points*0.55+s.oneWins*24+s.top10Wins*7+s.uniqueLevels*2.5+s.activityDays*1.5+s.recentWins*3;
}
function classifyEra(c,stats){
  const totalWins=c.victories.length;
  const rankEvents=c.movementEvents.length;
  const oneEvents=c.oneEvents.length;
  const top10=stats.reduce((n,s)=>n+s.top10Wins,0);
  const uniqueLevels=c.uniqueLevels.size;
  const top=stats[0], second=stats[1];
  const margin=top&&second?top.score/(second.score||1):99;
  const intensity=(rankEvents+totalWins*2)/(Math.max(1,c.days.length));
  if(oneEvents>=3 || (oneEvents>=2 && rankEvents>=5)) return {title:'THE #1 TURBULENCE ERA',reason:'Multiple #1-level events made the top of the list unstable.'};
  if(rankEvents>=14 || intensity>=5) return {title:'THE CHAOS ERA',reason:'Heavy ranking activity made this one of the most turbulent chapters.'};
  if(totalWins>=8 && uniqueLevels>=6 && margin<1.25) return {title:'THE COMPETITION ERA',reason:'Several players and levels were competing closely across the period.'};
  if(top?.wins>=4 && top?.oneWins>=1 && margin>=1.45) return {title:'THE '+String(top.name).toUpperCase()+' ERA',reason:`${top.name} led across victories, level quality, and #1 impact.`};
  if(top?.wins>=5 && margin>=1.3) return {title:'THE '+String(top.name).toUpperCase()+' DOMINANCE ERA',reason:`${top.name} led the chapter with sustained victory and points impact.`};
  if(top?.wins>=3 && top?.top10Wins>=2 && margin>=1.3) return {title:'THE '+String(top.name).toUpperCase()+' RISE',reason:`${top.name} combined multiple high-ranked victories with broad activity.`};
  if(top10>=4) return {title:'THE TOP 10 ERA',reason:'The period was defined by repeated victories across the Top 10.'};
  if(oneEvents===1 && rankEvents<=6) return {title:'THE #1 MOMENT ERA',reason:'A defining #1 event shaped this chapter.'};
  if(totalWins>=6) return {title:'THE GRIND ERA',reason:'Sustained victory activity defined this chapter more than any single player.'};
  if(rankEvents>=6) return {title:'THE RANKING SHIFT ERA',reason:'Placement movement was the main force shaping the list.'};
  return {title:'THE DIDDY ERA',reason:'A broad mix of victories and ranking activity shaped this chapter.'};
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
  if(!activeDays.length){el.innerHTML='<div class="eraEmpty"><h2>No era-defining history yet.</h2><p class="meta">Eras form automatically from sustained ranking activity, victories, #1 events, and list movement.</p></div>';return}
  activeDays.sort((a,b)=>Number(a[0])-Number(b[0]));
  const clusters=[];
  for(const [k,events] of activeDays){const t=Number(k);const prev=clusters.at(-1);if(prev&&t-prev.end<=dayMs*2){prev.end=t;prev.days.push(t);prev.raw.push(...events)}else clusters.push({start:t,end:t,days:[t],raw:[...events]})}
  const eras=clusters.map(c=>{
    const start=c.start,end=c.end+dayMs-1;
    const victories=records.filter(r=>{const t=new Date(r.created_at).getTime();return t>=start&&t<=end});
    const statsMap={};
    victories.forEach(r=>{
      const p=pMap[r.player_id];if(!p)return;
      const q=statsMap[r.player_id]??{id:r.player_id,name:p.name,wins:0,points:0,oneWins:0,top10Wins:0,uniqueLevels:new Set(),activityDays:new Set(),recentWins:0};
      q.wins++;
      const when=new Date(r.created_at).getTime();
      const rank=rankAtTime(r.level_id,when,history,levels);
      q.points+=pointsForRank(rank);
      if(rank===1)q.oneWins++;
      if(rank<=10)q.top10Wins++;
      q.uniqueLevels.add(r.level_id);
      q.activityDays.add(dayKey(r.created_at));
      if(when>=end-dayMs*2)q.recentWins++;
      statsMap[r.player_id]=q;
    });
    const stats=Object.values(statsMap).map(s=>({...s,uniqueLevels:s.uniqueLevels.size,activityDays:s.activityDays.size}));
    stats.forEach(s=>s.score=playerScore(s));
    stats.sort((a,b)=>b.score-a.score||b.points-a.points||b.wins-a.wins);
    const dominant=stats[0];
    const movementEvents=c.raw.filter(x=>!x.__victory);const oneEvents=movementEvents.filter(x=>Number(x.rank)===1);const uniqueLevels=new Set(victories.map(x=>x.level_id));
    const classified=classifyEra(c,stats);
    return {start,end,victories,dominant,stats,movementEvents,oneEvents,uniqueLevels,title:classified.title,reason:classified.reason,days:c.days};
  }).sort((a,b)=>b.start-a.start).slice(0,20);
  el.innerHTML=eras.map((e,i)=>{
    const d=e.dominant;
    const player=d?`<a class="eraLink" href="player.html?id=${encodeURIComponent(d.id)}">${esc(d.name)}</a>`:'No dominant player';
    const one=e.victories.filter(r=>rankAtTime(r.level_id,new Date(r.created_at).getTime(),history,levels)===1).length;
    const points=d?.points||0;
    const span=Math.max(1,Math.round((e.end-e.start)/dayMs)+1);
    const activity=e.movementEvents.length;
    const runner=e.stats[1];
    const margin=d&&runner?(d.score/(runner.score||1)).toFixed(2)+'×':'clear';
    const highlight=e.reason;
    const topPlayers=e.stats.slice(0,3).map(s=>`${esc(s.name)} (${s.wins} wins, ${s.points.toLocaleString()} pts)`).join(' · ');
    return `<article class="eraCard ${i===0?'eraCurrent':''}"><div class="eraCardTop"><span class="eraBadge">${i===0?'CURRENT ERA':'ERA '+(i+1)}</span><span class="eraDates">${fmt(e.start)} → ${fmt(e.end)}</span></div><h2>${esc(e.title)}</h2><p class="eraLead">${esc(highlight)}</p><div class="eraStats"><div><b>${span}</b><span>days</span></div><div><b>${e.victories.length}</b><span>victories</span></div><div><b>${one}</b><span>#1-level wins</span></div><div><b>${points.toLocaleString()}</b><span>leader points</span></div><div><b>${activity}</b><span>rank events</span></div><div><b>${e.uniqueLevels.size}</b><span>levels active</span></div></div><div class="eraDetails"><div><small>LEADING PLAYER</small><strong>${player}</strong></div><div><small>DOMINANCE MARGIN</small><strong>${margin}${runner?' over '+esc(runner.name):''}</strong></div><div><small>TOP ERA CONTRIBUTORS</small><strong>${topPlayers||'No player victory data.'}</strong></div><div><small>ERA MEMORY</small><strong>${e.movementEvents.length?e.movementEvents.slice(0,2).map(x=>esc(x.note||('Rank #'+x.rank+' recorded'))).join(' · '):'Victory activity created this chapter.'}</strong></div></div></article>`;
  }).join('');
}
boot();

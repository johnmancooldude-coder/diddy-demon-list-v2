const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const id=new URLSearchParams(location.search).get('id');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleDateString():'—';
const rankPts=r=>Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62)));
let charts=[];
function destroyCharts(){charts.forEach(c=>c.destroy());charts=[]}
function makeChart(id,type,data,options={}){const ctx=document.getElementById(id)?.getContext('2d');if(!ctx||!window.Chart)return;const c=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd0e4'}},tooltip:{mode:'index',intersect:false}},scales:type==='doughnut'?{}:{x:{ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}}},...options}});charts.push(c);return c}
function lineData(labels,values,label,fill=false){return {labels,datasets:[{label,data:values,tension:.3,fill,pointRadius:3,borderWidth:2,backgroundColor:fill?'rgba(124,108,255,.12)':'rgba(124,108,255,.02)',borderColor:'#9a8cff',pointBackgroundColor:'#c9c2ff'}]}}
async function boot(){
 const el=document.getElementById('playerPage');
 if(!sb){el.innerHTML='<div class="panel">Connect Supabase first.</div>';return}
 const q=await Promise.all([
  sb.from('players').select('*').eq('id',id).single(),
  sb.from('v17_player_stats').select('*').eq('id',id).single(),
  sb.from('records').select('*,levels(*)').eq('player_id',id).order('created_at',{ascending:true}),
  sb.from('point_values').select('*'),
  sb.from('player_leaderboard').select('*').order('total_points',{ascending:false})
 ]);
 const bad=q.find(x=>x.error);if(bad?.error){el.innerHTML=`<div class="panel error">${esc(bad.error.message)}</div>`;return}
 const p=q[0].data,s=q[1].data,R=q[2].data||[],PV=q[3].data||[],LB=q[4].data||[];if(!p){el.innerHTML='<div class="panel">Player not found.</div>';return}
 destroyCharts();
 const pts=r=>Number(PV.find(x=>Number(x.rank)===Number(r))?.points||rankPts(r));
 const rank=LB.findIndex(x=>x.id===id)+1;
 const top=R.slice().sort((a,b)=>Number(a.levels?.rank||999)-Number(b.levels?.rank||999));
 const xp=Math.round(Number(s.total_points)*1.2+Number(s.victories)*25),lvl=Math.floor(xp/100)+1;
 const power=Math.round(Number(s.total_points)*2.4+Number(s.top10_victories)*22+Number(s.top25_victories)*8+Number(s.victories)*5);
 const avgAttempts=R.filter(r=>Number(r.attempts)>0).reduce((a,r)=>a+Number(r.attempts),0)/(R.filter(r=>Number(r.attempts)>0).length||1);
 const attempts=R.filter(r=>Number(r.attempts)>0).map(r=>Number(r.attempts));
 const completions=R.filter(r=>Number(r.completion_seconds)>0).map(r=>Number(r.completion_seconds));
 const buckets={"#1–10":0,"#11–25":0,"#26–50":0,"#51–100":0,"#101+":0};
 R.forEach(r=>{const n=Number(r.levels?.rank||999);if(n<=10)buckets['#1–10']++;else if(n<=25)buckets['#11–25']++;else if(n<=50)buckets['#26–50']++;else if(n<=100)buckets['#51–100']++;else buckets['#101+']++});
 const monthly={};R.forEach(r=>{const d=new Date(r.created_at);const key=d.toLocaleDateString(undefined,{month:'short',year:'numeric'});monthly[key]=(monthly[key]||0)+pts(r.levels?.rank||999)});
 const labels=Object.keys(monthly),values=Object.values(monthly);let run=0;const cumulative=values.map(v=>run+=Number(v));
 const diff={};R.forEach(r=>{const d=r.levels?.difficulty||'Unknown';diff[d]=(diff[d]||0)+1});
 const scatter=R.filter(r=>Number(r.attempts)>0&&Number(r.completion_seconds)>0).map(r=>({x:Number(r.attempts),y:Number(r.completion_seconds),label:r.levels?.name||'Level'}));
 const hardest=top[0],recent=R.at(-1);
 const bestPoints=R.length?Math.max(...R.map(r=>pts(r.levels?.rank||999))):0;
 const consistency=R.length?Math.max(0,Math.min(100,Math.round(100-(Math.sqrt(attempts.reduce((a,b)=>a+Math.pow(b-avgAttempts,2),0)/(attempts.length||1))/(avgAttempts||1))*35))):0;
 const grindScore=attempts.length?Math.max(0,Math.min(100,Math.round(100/(1+avgAttempts/1000)*100))):0;
 el.innerHTML=`
 <section class="hero playerHero4"><div>${p.avatar_url?`<img class="avatarLarge" src="${esc(p.avatar_url)}" alt="">`:''}<p class="eyebrow">PLAYER PROFILE 4.5</p><h1>👤 ${esc(p.name)}</h1><p>#${rank||'—'} overall · Level ${lvl} · ${xp.toLocaleString()} XP</p>${p.bio?`<p>${esc(p.bio)}</p>`:''}</div></section>
 <section class="adminQuick"><div><b>${Number(s.total_points).toLocaleString()}</b><span>points</span></div><div><b>${s.victories}</b><span>victories</span></div><div><b>#${s.highest_victory??'—'}</b><span>hardest win</span></div><div><b>${power}</b><span>power</span></div></section>
 <section class="panel"><h2>📊 Career Analytics</h2><div class="statGrid"><div><span>Average placement</span><b>${s.average_placement??'—'}</b></div><div><span>Top 10 wins</span><b>${s.top10_victories}</b></div><div><span>Top 25 wins</span><b>${s.top25_victories}</b></div><div><span>Top 50 wins</span><b>${s.top50_victories}</b></div><div><span>Total attempts</span><b>${Number(s.total_attempts||0).toLocaleString()}</b></div><div><span>Avg completion</span><b>${s.avg_completion_seconds??'—'}${s.avg_completion_seconds!=null?'s':''}</b></div><div><span>First victory</span><b>${fmtDate(s.first_victory_at)}</b></div><div><span>Latest victory</span><b>${fmtDate(s.latest_victory_at)}</b></div><div><span>Best single win</span><b>${bestPoints} pts</b></div><div><span>Average attempts</span><b>${attempts.length?Math.round(avgAttempts).toLocaleString():'—'}</b></div></div></section>
 <section class="chartGrid">
  <div class="panel chartPanel"><div class="panelHead"><h2>📈 Career Points</h2><span class="meta">cumulative</span></div><div class="chartBox"><canvas id="playerPointsChart"></canvas></div></div>
  <div class="panel chartPanel"><div class="panelHead"><h2>🎯 Victory Placement</h2><span class="meta">wins by rank range</span></div><div class="chartBox"><canvas id="playerPlacementChart"></canvas></div></div>
 </section>
 <section class="chartGrid">
  <div class="panel chartPanel"><div class="panelHead"><h2>🧩 Difficulty Mix</h2><span class="meta">victories</span></div><div class="chartBox"><canvas id="playerDifficultyChart"></canvas></div></div>
  <div class="panel chartPanel"><div class="panelHead"><h2>⚡ Grind vs Completion</h2><span class="meta">each dot = a victory</span></div><div class="chartBox"><canvas id="playerScatterChart"></canvas></div></div>
 </section>
 <section class="panel"><h2>🧬 Player DNA</h2><div class="intelGrid"><div><span>Peak</span><b>${bestPoints} pts</b><small>best single victory value</small></div><div><span>Consistency</span><b>${consistency}/100</b><small>based on attempt spread</small></div><div><span>Grind</span><b>${grindScore}/100</b><small>attempt efficiency index</small></div><div><span>Depth</span><b>${s.top50_victories}</b><small>top 50 victories</small></div><div><span>XP progress</span><b>${xp%100}/100</b><small>toward level ${lvl+1}</small></div><div><span>Latest conquest</span><b>${recent?`#${recent.levels?.rank||'—'}`:'—'}</b><small>${recent?esc(recent.levels?.name):'No victories yet'}</small></div></div></section>
 <section class="panel"><h2>🏆 Victory Timeline</h2><div class="list">${top.slice().reverse().map(r=>`<div class="adminRow row between"><span><b>#${r.levels?.rank||'—'} ${esc(r.levels?.name||'Level')}</b><span class="meta"> · ${fmtDate(r.created_at)}</span></span><strong>${pts(r.levels?.rank||999)} pts</strong></div>`).join('')||'<p class="meta">No victories yet.</p>'}</div></section>
 <section class="panel"><h2>🎖️ Trophy Case</h2><div class="trophyGrid"><div class="trophy earned"><span>👑</span><b>Hardest Win</b><small>${s.highest_victory?`#${s.highest_victory}`:'Locked'}</small></div><div class="trophy ${s.top10_victories?'earned':''}"><span>🔥</span><b>Top 10 Hunter</b><small>${s.top10_victories||0} wins</small></div><div class="trophy ${s.victories>=10?'earned':''}"><span>🏆</span><b>Ten Victories</b><small>${s.victories}/10</small></div><div class="trophy ${s.victories>=25?'earned':''}"><span>💀</span><b>Demon Grinder</b><small>${s.victories}/25 wins</small></div></div></section>`;
 makeChart('playerPointsChart','line',lineData(labels,cumulative,'Career Points',true),{});
 makeChart('playerPlacementChart','bar',{labels:Object.keys(buckets),datasets:[{label:'Victories',data:Object.values(buckets),borderRadius:8}]},{});
 makeChart('playerDifficultyChart','doughnut',{labels:Object.keys(diff),datasets:[{label:'Victories',data:Object.values(diff),borderWidth:1}]},{plugins:{legend:{position:'right',labels:{color:'#cbd0e4'}}}});
 makeChart('playerScatterChart','scatter',{datasets:[{label:'Victories',data:scatter,pointRadius:5,pointHoverRadius:7}]},{scales:{x:{title:{display:true,text:'Attempts',color:'#9da4bd'},ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},y:{title:{display:true,text:'Completion seconds',color:'#9da4bd'},ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}}},plugins:{tooltip:{callbacks:{label:c=>`${c.raw.label||'Victory'} · ${c.raw.x} attempts · ${c.raw.y}s`}}}});
}
boot();

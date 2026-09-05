const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const id=new URLSearchParams(location.search).get('id');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleDateString(): '—';
const fmtNum=v=>Number(v||0).toLocaleString();
const rankPts=r=>Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62)));
let charts=[];
function destroyCharts(){charts.forEach(c=>c.destroy());charts=[]}
function makeChart(id,type,data,options={}){
  const ctx=document.getElementById(id)?.getContext('2d');
  if(!ctx||!window.Chart)return;
  const c=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd0e4'}},tooltip:{mode:'index',intersect:false}},scales:type==='doughnut'?{}:{x:{ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}}},...options}});
  charts.push(c); return c;
}
function lineData(labels,values,label){return {labels,datasets:[{label,data:values,tension:.28,fill:true,pointRadius:3,borderWidth:2,backgroundColor:'rgba(124,108,255,.12)',borderColor:'#9a8cff',pointBackgroundColor:'#c9c2ff'}]}}
async function boot(){
  const el=document.getElementById('levelPage');
  if(!sb)return el.innerHTML='<div class="panel">Configure Supabase first.</div>';
  const q=await Promise.all([
    sb.from('levels').select('*').eq('id',id).single(),
    sb.from('v17_level_stats').select('*').eq('id',id).single(),
    sb.from('records').select('*,players(name)').eq('level_id',id).order('created_at',{ascending:true}),
    sb.from('placement_history').select('*').eq('level_id',id).order('recorded_at',{ascending:true})
  ]);
  const bad=q.find(x=>x.error); if(bad?.error)return el.innerHTML=`<div class="panel error">${esc(bad.error.message)}</div>`;
  const l=q[0].data,s=q[1].data,R=q[2].data||[],H=q[3].data||[];
  if(!l)return el.innerHTML='<div class="panel">Level not found.</div>';
  destroyCharts();
  const currentRank=Number(l.rank),sectionLabel=l.section==='main'?'MAIN':l.section==='extended'?'EXTENDED':'LEGACY';
  const recent=H.at(-1),prev=H.length>1?H[H.length-2]:null;
  const delta=recent&&prev?Number(prev.rank)-Number(recent.rank):0;
  const movement=delta>0?`<span class="rankUp">▲ ${delta}</span>`:delta<0?`<span class="rankDown">▼ ${Math.abs(delta)}</span>`:'';
  const thumbs=l.thumbnail_url?`<img class="levelHeroThumb" src="${esc(l.thumbnail_url)}" alt="">`:'';
  const completions=R.map(r=>Number(r.completion_seconds)).filter(Number.isFinite).filter(x=>x>0);
  const attempts=R.map(r=>Number(r.attempts)).filter(Number.isFinite).filter(x=>x>0);
  const avgAttempts=attempts.length?Math.round(attempts.reduce((a,b)=>a+b,0)/attempts.length):0;
  const fastest=completions.length?Math.min(...completions):null;
  const slowest=completions.length?Math.max(...completions):null;
  const reignDays=H.length>=2?Math.max(0,(new Date(H.at(-1).recorded_at)-new Date(H[0].recorded_at))/86400000):0;
  const first=R[0],last=R.at(-1);
  const unique=new Set(R.map(r=>r.player_id)).size;
  const victoryDates={}; R.forEach(r=>{const d=new Date(r.created_at).toLocaleDateString();victoryDates[d]=(victoryDates[d]||0)+1});
  const vd=Object.entries(victoryDates);
  const rankHistory=H.length?H.map(x=>Number(x.rank)):[currentRank];
  const rankLabels=H.length?H.map(x=>fmtDate(x.recorded_at)):['Current'];
  const cumulative=R.map((r,i)=>({label:fmtDate(r.created_at),value:i+1}));
  const victorRows=R.slice().sort((a,b)=>(Number(a.attempts)||1e12)-(Number(b.attempts)||1e12));
  const maxAttempts=Math.max(1,...victorRows.map(r=>Number(r.attempts)||0));
  const maxCompletion=Math.max(1,...R.map(r=>Number(r.completion_seconds)||0));

  el.innerHTML=`
  <section class="hero levelHero3"><div>${thumbs}<p class="eyebrow">LEVEL PAGE 3.5 · ${sectionLabel}</p><h1>#${currentRank} · ${esc(l.name)} ${movement}</h1><p>${rankPts(currentRank)} points · ${esc(l.status||'')}</p></div></section>
  <section class="adminQuick"><div><b>${s.victor_count}</b><span>victors</span></div><div><b>${unique}</b><span>unique players</span></div><div><b>${fmtNum(s.total_attempts)}</b><span>attempts</span></div><div><b>${s.fastest_completion_seconds??'—'}${s.fastest_completion_seconds!=null?'s':''}</b><span>fastest run</span></div></section>
  <section class="panel"><h2>📊 Level Statistics 3.5</h2><div class="statGrid"><div><span>Creator</span><b>${esc(l.creator||'—')}</b></div><div><span>Verifier</span><b>${esc(l.verifier||'—')}</b></div><div><span>Holder</span><b>${esc(l.holder||'—')}</b></div><div><span>Difficulty</span><b>${esc(l.difficulty||'—')}</b></div><div><span>Average completion</span><b>${s.avg_completion_seconds??'—'}${s.avg_completion_seconds!=null?'s':''}</b></div><div><span>Average attempts</span><b>${avgAttempts?fmtNum(avgAttempts):'—'}</b></div><div><span>First victory</span><b>${fmtDate(s.first_victory_at)}</b></div><div><span>Latest victory</span><b>${fmtDate(s.latest_victory_at)}</b></div><div><span>Fastest run</span><b>${fastest!=null?fastest.toFixed(1)+'s':'—'}</b></div><div><span>Longest run</span><b>${slowest!=null?slowest.toFixed(1)+'s':'—'}</b></div><div><span>Times ranked</span><b>${H.length}</b></div><div><span>Recorded span</span><b>${reignDays?Math.round(reignDays)+' days':'—'}</b></div></div><p>${esc(l.description||'')}</p>${l.video_url?`<p><a class="button secondary" href="${esc(l.video_url)}" target="_blank" rel="noopener">▶ Verification video</a></p>`:''}</section>
  <section class="chartGrid">
    <div class="panel chartPanel"><div class="panelHead"><h2>📈 Rank History</h2><span class="meta">lower is better</span></div><div class="chartBox"><canvas id="levelRankChart"></canvas></div></div>
    <div class="panel chartPanel"><div class="panelHead"><h2>🏆 Victor Growth</h2><span class="meta">cumulative clears</span></div><div class="chartBox"><canvas id="levelVictoryChart"></canvas></div></div>
  </section>
  <section class="chartGrid">
    <div class="panel chartPanel"><div class="panelHead"><h2>⚡ Victor Attempts</h2><span class="meta">lower = cleaner</span></div><div class="chartBox tall"><canvas id="levelAttemptsChart"></canvas></div></div>
    <div class="panel chartPanel"><div class="panelHead"><h2>⏱️ Completion Times</h2><span class="meta">seconds</span></div><div class="chartBox tall"><canvas id="levelCompletionChart"></canvas></div></div>
  </section>
  <section class="panel"><h2>🧠 Level Intel</h2><div class="intelGrid"><div><span>Current value</span><b>${rankPts(currentRank)} pts</b><small>#${currentRank} on the list</small></div><div><span>Victor density</span><b>${unique?((R.length/unique).toFixed(2)):'0.00'}</b><small>victories per unique player</small></div><div><span>Grind average</span><b>${avgAttempts?fmtNum(avgAttempts):'—'}</b><small>attempts per recorded win</small></div><div><span>Rank volatility</span><b>${H.length>1?Math.abs(Number(H.at(-1).rank)-Number(H[0].rank)):'0'}</b><small>positions across history</small></div></div></section>
  <section class="panel"><h2>🏆 Victors</h2><div class="list">${R.slice().reverse().map(r=>`<div class="adminRow row between"><span><a href="player.html?id=${r.player_id}"><b>${esc(r.players?.name||'Player')}</b></a><span class="meta"> · ${fmtDate(r.created_at)}</span></span><span>${r.attempts?fmtNum(r.attempts)+' attempts':''}${r.completion_seconds?` · ${Number(r.completion_seconds).toFixed(1)}s`:''}${r.video_url?` · <a href="${esc(r.video_url)}" target="_blank" rel="noopener">video</a>`:''}</span></div>`).join('')||'<p class="meta">No victories yet.</p>'}</div></section>
  <section class="panel"><h2>📈 Placement History</h2><div class="list">${H.slice().reverse().map((x,i)=>`<div class="adminRow row between"><span>#${x.rank} · ${new Date(x.recorded_at).toLocaleString()}</span><span class="meta">${i===0?'Latest · ':''}${esc(x.note||'')}</span></div>`).join('')||'<p class="meta">No recorded history.</p>'}</div></section>`;

  makeChart('levelRankChart','line',lineData(rankLabels,rankHistory,'Rank'),{scales:{y:{reverse:true,min:1,ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},x:{ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}}}});
  makeChart('levelVictoryChart','line',lineData(cumulative.map(x=>x.label),cumulative.map(x=>x.value),'Victories'),{});
  const victorLabels=victorRows.map(r=>r.players?.name||'Player');
  makeChart('levelAttemptsChart','bar',{labels:victorLabels,datasets:[{label:'Attempts',data:victorRows.map(r=>Number(r.attempts)||0),borderRadius:8}]},{indexAxis:'y',scales:{x:{beginAtZero:true,ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'#cbd0e4'},grid:{display:false}}}});
  makeChart('levelCompletionChart','bar',{labels:victorLabels,datasets:[{label:'Seconds',data:victorRows.map(r=>Number(r.completion_seconds)||0),borderRadius:8}]},{indexAxis:'y',scales:{x:{beginAtZero:true,ticks:{color:'#9da4bd'},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'#cbd0e4'},grid:{display:false}}}});
}
boot();

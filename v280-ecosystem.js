/* DIDDY V2.8 — THE DIDDY UNIVERSE / EVENT INTELLIGENCE CORE */
(() => {
  const cfg = window.DIDDY_CONFIG || {};
  const sb = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qs = id => document.getElementById(id);
  const now = () => Date.now();
  const days = n => n * 864e5;
  const fmt = d => new Date(d).toLocaleString();
  const pts = (rank, pv) => Number((pv.find(x=>Number(x.rank)===Number(rank))||{}).points||0);
  const rankAt = (levelId, at, hist, current) => {
    const rows = hist.filter(h=>h.level_id===levelId && new Date(h.recorded_at)<=new Date(at)).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));
    return rows[0]?.rank ?? current[levelId] ?? null;
  };
  async function load() {
    if (!sb) return null;
    const q = await Promise.all([
      sb.from('levels').select('*'),
      sb.from('players').select('*'),
      sb.from('records').select('*').order('created_at',{ascending:false}),
      sb.from('placement_history').select('*').order('recorded_at',{ascending:false}),
      sb.from('point_values').select('*').order('rank'),
      sb.from('changelog').select('*').order('created_at',{ascending:false}).limit(100)
    ]);
    if (q.some(x=>x.error)) throw (q.find(x=>x.error)||{}).error;
    const [levels,players,records,history,pointValues,changelog] = q.map(x=>x.data||[]);
    return {levels,players,records,history,pointValues,changelog};
  }
  function events(d) {
    const {levels,players,records,history,changelog,pointValues}=d;
    const pm=Object.fromEntries(players.map(p=>[p.id,p])), lm=Object.fromEntries(levels.map(l=>[l.id,l]));
    const out=[];
    records.forEach(r=>{const p=pm[r.player_id],l=lm[r.level_id]; if(p&&l) out.push({at:r.created_at,type:Number(r.progress)===100?'completion':'record',icon:Number(r.progress)===100?'🏆':'📈',title:Number(r.progress)===100?`${p.name} conquered ${l.name}`:`${p.name} posted ${r.progress}% on ${l.name}`,body:`#${l.rank} · ${pts(l.rank,pointValues)} points`,href:`player.html?id=${p.id}`});});
    history.forEach(h=>{const l=lm[h.level_id]; if(!l)return; const n=String(h.note||''); const m=n.match(/#?(\d+)\s*(?:->|→)\s*(?:main|extended|legacy)?\s*#?(\d+)/i); if(m&&m[1]!==m[2]) out.push({at:h.recorded_at,type:'movement',icon:Number(m[2])<Number(m[1])?'📈':'📉',title:`${l.name} moved #${m[1]} → #${m[2]}`,body:`Placement history · ${h.section}`,href:`level.html?id=${l.id}`});});
    changelog.forEach(c=>out.push({at:c.created_at,type:'update',icon:'🛠️',title:c.title,body:c.body,href:'changelog.html'}));
    return out.sort((a,b)=>new Date(b.at)-new Date(a.at));
  }
  function stats(d) {
    const {levels,players,records,history,pointValues}=d, cutoff=now()-days(7), recent=records.filter(r=>new Date(r.created_at)>=cutoff);
    const wins=recent.filter(r=>Number(r.progress)===100), pc={}, lc={};
    recent.forEach(r=>{pc[r.player_id]=(pc[r.player_id]||0)+1;lc[r.level_id]=(lc[r.level_id]||0)+1;});
    const activePlayers=Object.entries(pc).sort((a,b)=>b[1]-a[1]), activeLevels=Object.entries(lc).sort((a,b)=>b[1]-a[1]);
    const current=Object.fromEntries(levels.map(l=>[l.id,l.rank]));
    const movement=history.filter(h=>new Date(h.recorded_at)>=cutoff).map(h=>({h,l:levels.find(x=>x.id===h.level_id)})).filter(x=>x.l);
    const rankMoves={}; movement.forEach(({h,l})=>{const n=String(h.note||'').match(/#?(\d+)\s*(?:->|→)\s*(?:main|extended|legacy)?\s*#?(\d+)/i);if(n){const delta=Number(n[1])-Number(n[2]);rankMoves[l.id]=(rankMoves[l.id]||0)+delta;}});
    const movementList=Object.entries(rankMoves).map(([id,delta])=>({level:levels.find(l=>l.id===id),delta})).filter(x=>x.level).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    return {recent,wins,activePlayers,activeLevels,movementList,current,cutoff};
  }
  function card(label,value,sub=''){return `<article class="v28Card"><span>${label}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></article>`}
  function renderEnxy(d) {
    const host=qs('enxy28'); if(!host)return;
    const s=stats(d), pm=Object.fromEntries(d.players.map(p=>[p.id,p.name])),lm=Object.fromEntries(d.levels.map(l=>[l.id,l.name]));
    const lb=d.players.map(p=>{const rs=d.records.filter(r=>r.player_id===p.id&&Number(r.progress)===100);return {p,n:rs.filter(r=>new Date(r.created_at)>=s.cutoff).length,total:rs.length}}).sort((a,b)=>b.n-a.n);
    const top1=d.levels.find(l=>Number(l.rank)===1), leader=lb[0];
    host.innerHTML=`<section class="v28Hero"><div><p class="eyebrow">V2.8 · THE DIDDY UNIVERSE</p><h2>🧠 ENXY 2.0</h2><p>Enxy now connects list movement, player activity, records, history, achievements and system events into one intelligence layer.</p></div><div class="v28Pulse">LIVE<br><b>${new Date().toLocaleTimeString()}</b></div></section><div class="v28Grid">${card('⚡ 7D ACTIVITY',s.recent.length,'records + progress updates')}${card('🏆 7D COMPLETIONS',s.wins.length,'completed records')}${card('👥 ACTIVE PLAYERS',s.activePlayers.length,'players with recent activity')}${card('📉 MOVEMENTS',s.movementList.length,'recorded rank movements')}</div><div class="v28Columns"><section class="panel"><p class="eyebrow">ENXY READOUT</p><h3>${top1?`👑 ${esc(top1.name)} remains current #1.`:'No current #1 detected.'}</h3><p class="meta">${leader?`Most active player this week: <b>${esc(leader.p.name)}</b> with ${leader.n} recorded victories.`:'No recent player activity detected.'}</p><p class="meta">${s.movementList[0]?`Largest recent movement signal: <b>${esc(s.movementList[0].level.name)}</b> (${s.movementList[0].delta>0?'+':''}${s.movementList[0].delta} rank pressure).`:'No movement signal available yet.'}</p></section><section class="panel"><p class="eyebrow">EVENT STREAM</p><div class="v28Events">${events(d).slice(0,8).map(e=>`<a class="v28Event" href="${e.href||'#'}"><b>${e.icon} ${esc(e.title)}</b><small>${esc(e.body)} · ${fmt(e.at)}</small></a>`).join('')||'<span class="meta">No events yet.</span>'}</div></section></div>`;
  }
  function renderAnalytics(d) {
    const host=qs('analytics28'); if(!host)return;
    const s=stats(d), sections={Main:0,Extended:0,Legacy:0}; d.levels.forEach(l=>{const k=(l.section||'').toLowerCase(); if(k==='main')sections.Main++;if(k==='extended')sections.Extended++;if(k==='legacy')sections.Legacy++;});
    const recent30=d.records.filter(r=>new Date(r.created_at)>=new Date(now()-days(30)));
    host.innerHTML=`<section class="panel"><div class="panelHead"><div><p class="eyebrow">📊 DIDDY ANALYTICS 2.0</p><h2>Universe Metrics</h2><p class="meta">Derived from the existing public DIDDY tables. No new database schema required.</p></div></div><div class="v28Grid">${card('👹 LEVELS',d.levels.length,'current levels')}${card('👤 PLAYERS',d.players.length,'registered players')}${card('📜 RECORDS',d.records.length,'all records')}${card('📅 30D RECORDS',recent30.length,'recent activity')}</div><div class="v28Bars">${Object.entries(sections).map(([k,v])=>`<div><span>${k}</span><b>${v}</b><i style="width:${Math.min(100,v/Math.max(1,d.levels.length)*100)}%"></i></div>`).join('')}</div></section><section class="v28Columns"><section class="panel"><p class="eyebrow">🔥 MOST ACTIVE PLAYERS · 7D</p>${s.activePlayers.slice(0,10).map(([id,n],i)=>`<div class="v28Row"><b>#${i+1} ${esc(d.players.find(p=>p.id===id)?.name||'Unknown')}</b><span>${n} records</span></div>`).join('')||'<span class="meta">No recent activity.</span>'}</section><section class="panel"><p class="eyebrow">👹 MOST ACTIVE LEVELS · 7D</p>${s.activeLevels.slice(0,10).map(([id,n],i)=>`<div class="v28Row"><b>#${i+1} ${esc(d.levels.find(l=>l.id===id)?.name||'Unknown')}</b><span>${n} records</span></div>`).join('')||'<span class="meta">No recent activity.</span>'}</section></section>`;
  }
  function renderUniverse(d) {
    const host=qs('universe28'); if(!host)return;
    const s=stats(d), eventsList=events(d).slice(0,20);
    host.innerHTML=`<section class="panel"><p class="eyebrow">🌎 DIDDY UNIVERSE 2.0</p><h2>Everything is connected.</h2><p class="meta">Players → records → levels → placements → events → history.</p><div class="v28UniverseGrid">${card('👤 PLAYERS',d.players.length,'nodes')}${card('👹 LEVELS',d.levels.length,'nodes')}${card('🏆 COMPLETIONS',d.records.filter(r=>Number(r.progress)===100).length,'records')}${card('🕰️ HISTORY',d.history.length,'placement events')}</div><div class="v28EventRail">${eventsList.map(e=>`<a href="${e.href||'#'}"><span>${e.icon}</span><div><b>${esc(e.title)}</b><small>${esc(e.body)} · ${fmt(e.at)}</small></div></a>`).join('')}</div></section>`;
  }
  function renderBattles(d) {
    const host=qs('battles28'); if(!host)return;
    const ps=d.players.map(p=>{const w=d.records.filter(r=>r.player_id===p.id&&Number(r.progress)===100);return {...p,wins:w.length,points:w.reduce((a,r)=>a+pts(d.levels.find(l=>l.id===r.level_id)?.rank,d.pointValues),0)}}).sort((a,b)=>b.points-a.points);
    host.innerHTML=`<section class="panel"><p class="eyebrow">⚔️ PLAYER BATTLES 2.0</p><h2>Head-to-Head Matrix</h2><p class="meta">Select any two players to compare career records from the current dataset.</p><div class="v28BattlePick"><select id="b28a">${ps.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><span>VS</span><select id="b28b">${ps.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div id="b28BattleOut"></div></section>`;
    const render=()=>{const a=ps.find(x=>x.id===qs('b28a').value)||ps[0],b=ps.find(x=>x.id===qs('b28b').value)||ps[1]||ps[0];qs('b28BattleOut').innerHTML=`<div class="v28CompareGrid"><div><b>${esc(a?.name||'—')}</b><strong>${a?.points||0}</strong><span>${a?.wins||0} victories</span></div><div><b>CAREER GAP</b><strong>${Math.abs((a?.points||0)-(b?.points||0))}</strong><span>points</span></div><div><b>${esc(b?.name||'—')}</b><strong>${b?.points||0}</strong><span>${b?.wins||0} victories</span></div></div>`}; qs('b28a').onchange=render;qs('b28b').onchange=render;render();
  }
  function renderMap(d) {
    const host=qs('map28'); if(!host)return;
    const nodes=[...d.players.slice(0,18).map(p=>({id:p.id,label:p.name,type:'player'})),...d.levels.slice(0,25).map(l=>({id:l.id,label:l.name,type:'level'}))];
    const pm=Object.fromEntries(d.players.map(p=>[p.id,p.name])),lm=Object.fromEntries(d.levels.map(l=>[l.id,l.name]));
    const edges=d.records.slice(0,80).map(r=>({a:pm[r.player_id],b:lm[r.level_id]})).filter(x=>x.a&&x.b);
    host.innerHTML=`<section class="panel"><p class="eyebrow">🗺️ DIDDY MAP</p><h2>Player ↔ Level Relationship Graph</h2><p class="meta">A visual relationship map generated from recorded victories. It uses existing records only.</p><div class="v28Map">${nodes.map((n,i)=>`<a class="v28Node ${n.type}" style="--x:${10+(i*37)%82}%;--y:${12+(i*61)%72}%" href="${n.type==='player'?`player.html?id=${n.id}`:`level.html?id=${n.id}`}">${n.type==='player'?'👤':'👹'} ${esc(n.label)}</a>`).join('')}</div><p class="meta">${edges.length} recent player-level connections visualized.</p></section>`;
  }
  function renderAchievements(d) {
    const host=qs('achievements28'); if(!host)return;
    const defs=[['👑','First King','Reach #1 on the official player leaderboard',p=>p.rank===1],['🏛️','Former King','Have held #1 at any point in the current leaderboard dataset',p=>p.hadRank1],['🔥','Demon Grinder','10 recorded victories',p=>p.wins>=10],['💀','Demon Legend','50 recorded victories',p=>p.wins>=50],['⚔️','Battle Tested','5 Top 10 victories',p=>p.top10>=5],['📈','Rising Star','3 victories in the last 7 days',p=>p.recent>=3],['🌎','Universe Explorer','Victories on 10 different levels',p=>p.unique>=10]];
    const rows=d.players.map(p=>{const rs=d.records.filter(r=>r.player_id===p.id&&Number(r.progress)===100), ranks=rs.map(r=>d.levels.find(l=>l.id===r.level_id)?.rank).filter(Boolean);return {p,wins:rs.length,recent:rs.filter(r=>new Date(r.created_at)>=new Date(now()-days(7))).length,top10:ranks.filter(x=>x<=10).length,unique:new Set(rs.map(r=>r.level_id)).size,rank:0,hadRank1:ranks.includes(1)}}); rows.sort((a,b)=>b.wins-a.wins);
    host.innerHTML=`<section class="panel"><p class="eyebrow">🏆 ACHIEVEMENTS 2.0</p><h2>Milestone Codex</h2><div class="v28AchievementGrid">${defs.map(d=>{const got=rows.filter(d[3]);return `<article class="v28Achievement"><b>${d[0]} ${esc(d[1])}</b><span>${got.length} unlocked</span><small>${esc(d[2])}</small><div>${got.slice(0,8).map(x=>`<a class="tag" href="player.html?id=${x.p.id}">${esc(x.p.name)}</a>`).join('')||'<i>Locked</i>'}</div></article>`}).join('')}</div></section>`;
  }
  function renderNews(d) {
    const host=qs('news28'); if(!host)return;
    host.innerHTML=`<section class="panel"><p class="eyebrow">📰 ENXY NEWS ENGINE</p><h2>Automatic DIDDY Events</h2><p class="meta">News cards are generated from records, placement history and changelog data; no extra news table is required.</p><div class="v28News">${events(d).slice(0,30).map(e=>`<article><span>${e.icon}</span><div><b>${esc(e.title)}</b><small>${esc(e.body)} · ${fmt(e.at)}</small></div></article>`).join('')||'<p class="meta">No events.</p>'}</div></section>`;
  }
  function renderHall(d) {
    const host=qs('hall28'); if(!host)return;
    const rows=d.players.map(p=>{const rs=d.records.filter(r=>r.player_id===p.id&&Number(r.progress)===100);const ranks=rs.map(r=>d.levels.find(l=>l.id===r.level_id)?.rank).filter(Boolean);return {...p,wins:rs.length,peak:ranks.length?Math.min(...ranks):999,points:ranks.reduce((a,r)=>a+pts(r,d.pointValues),0),top1:ranks.includes(1)}}).sort((a,b)=>b.points-a.points);
    host.innerHTML=`<section class="panel"><p class="eyebrow">🏛️ HALL OF FAME 2.0</p><h2>Career Milestones</h2><p class="meta">Historical recognition is descriptive and derived from recorded list data.</p><div class="v28Hall">${rows.slice(0,15).map((p,i)=>`<article><strong>#${i+1}</strong><div><h3>${esc(p.name)}</h3><span>${p.wins} wins · ${p.points} points · peak #${p.peak===999?'—':p.peak}</span></div>${p.top1?'👑':''}</article>`).join('')}</div></section>`;
  }
  function renderTimeMachine(d) {
    const host=qs('timemachine28'); if(!host)return;
    const min=d.history.length?new Date(Math.min(...d.history.map(h=>new Date(h.recorded_at)))):new Date();
    host.innerHTML=`<section class="panel"><p class="eyebrow">🕰️ TIME MACHINE 3.0</p><h2>Replay the List</h2><p class="meta">Choose a date to reconstruct the latest recorded placement for each level before that date.</p><input id="tm28date" type="date" value="${new Date().toISOString().slice(0,10)}" min="${min.toISOString().slice(0,10)}"><button class="btn" id="tm28go">RECONSTRUCT</button><div id="tm28out"></div></section>`;
    const reconstruct=()=>{const date=qs('tm28date').value;const cutoff=new Date(date+'T23:59:59');const rows=d.levels.map(l=>{const h=d.history.filter(x=>x.level_id===l.id&&new Date(x.recorded_at)<=cutoff).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at))[0];return h?{...l,rank:h.rank,section:h.section,recorded:h.recorded_at}:null}).filter(Boolean).sort((a,b)=>a.rank-b.rank);qs('tm28out').innerHTML=rows.length?`<div class="v28Timeline"><div><b>${rows.length}</b> levels reconstructed for ${esc(date)}</div>${rows.slice(0,100).map(l=>`<a href="level.html?id=${l.id}">#${l.rank} · ${esc(l.name)} <small>${esc(l.section)}</small></a>`).join('')}</div>`:'<p class="meta">No placement history exists for this date.</p>'};qs('tm28go').onclick=reconstruct;reconstruct();
  }
  async function boot(){
    const d=await load(); if(!d)return;
    try {renderEnxy(d);renderAnalytics(d);renderUniverse(d);renderBattles(d);renderMap(d);renderAchievements(d);renderNews(d);renderHall(d);renderTimeMachine(d);} catch(e){console.error('DIDDY 2.8 render error',e);}
  }
  window.DIDDY_V280={boot,load,events,stats};
  document.addEventListener('DOMContentLoaded',boot);
})();
const cfg=window.DIDDY_CONFIG||{};const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
function levelPoints(rank,map){return num(map[num(rank)],Math.max(1,101-num(rank)));}
function sectionLabel(s){return s==='main'?'Main List':s==='extended'?'Extended List':'Legacy List';}
function pct(a,b){return b?Math.round((a/b)*100):0}
function barRows(items,max,renderLabel){return items.map((x,i)=>{const value=num(x.value);const width=max?Math.max(3,Math.round(value/max*100)):0;return `<div class="barRow"><div class="barHead"><span>${renderLabel(x,i)}</span><b>${esc(x.display??value)}</b></div><div class="barTrack"><div class="barFill" style="width:${width}%"></div></div></div>`}).join('')}
async function boot(){const root=$('stats');if(!sb){root.innerHTML='<div class="panel error">Connect Supabase to calculate live statistics.</div>';return}
root.innerHTML='<div class="panel loading">Loading the absolutely unnecessary statistics... 💀</div>';
try{
 const [{data:levels,error:e1},{data:records,error:e2},{data:players,error:e3},{data:points,error:e4},{data:lb,error:e5},{data:history,error:e6}]=await Promise.all([
  sb.from('levels').select('*'),sb.from('records').select('*'),sb.from('players').select('*'),sb.from('point_values').select('rank,points'),sb.from('player_leaderboard').select('*'),sb.from('placement_history').select('*').order('changed_at',{ascending:false}).limit(12)
 ]);
 const errors=[e1,e2,e3,e4,e5,e6].filter(Boolean);if(errors.length)throw errors[0];
 const L=levels||[],R=records||[],P=players||[],LB=lb||[],H=history||[],pm=Object.fromEntries((points||[]).map(x=>[x.rank,x.points]));
 const main=L.filter(x=>x.section==='main').sort((a,b)=>a.rank-b.rank), ext=L.filter(x=>x.section==='extended'), legacy=L.filter(x=>x.section==='legacy');
 const victoryCount={};R.forEach(r=>{victoryCount[r.level_id]=(victoryCount[r.level_id]||0)+1});
 const playerVictories={};R.forEach(r=>{playerVictories[r.player_id]=(playerVictories[r.player_id]||0)+1});
 const byId=Object.fromEntries(L.map(x=>[x.id,x])); const playerById=Object.fromEntries(P.map(x=>[x.id,x]));
 const scored=L.map(l=>({...l,points:levelPoints(l.rank,pm),victors:num(victoryCount[l.id])}));
 const rankedPlayers=LB.slice().sort((a,b)=>num(b.total_points)-num(a.total_points));
 const withRecords=scored.filter(x=>x.victors>0);
 const avgPlacement=R.length?R.reduce((s,r)=>s+num(byId[r.level_id]?.rank),0)/R.length:0;
 const avgPoints=R.length?R.reduce((s,r)=>s+levelPoints(byId[r.level_id]?.rank,pm),0)/R.length:0;
 const uniqueVictorPlayers=new Set(R.map(r=>r.player_id)).size;
 const sectionStats=[['main',main.length],['extended',ext.length],['legacy',legacy.length]];
 const mostVictored=scored.slice().sort((a,b)=>b.victors-a.victors||a.rank-b.rank).slice(0,8);
 const hardest=scored.slice().sort((a,b)=>a.rank-b.rank).slice(0,8);
 const mostValuable=scored.slice().sort((a,b)=>b.points-a.points).slice(0,8);
 const playerTop=rankedPlayers.slice(0,8).map(x=>({...x,value:num(x.total_points),display:num(x.total_points)+' pts'}));
 const playerWinTop=P.map(p=>({id:p.id,name:p.name,value:num(playerVictories[p.id]),display:num(playerVictories[p.id])+' wins'})).sort((a,b)=>b.value-a.value).slice(0,8);
 const hardestWithWins=hardest.filter(x=>x.victors>0).slice(0,5);
 const emptyLevels=scored.filter(x=>!x.victors).length;
 const maxRank=Math.max(...L.map(x=>num(x.rank)),0);
 const avgVictors=L.length?R.length/L.length:0;
 const topPlayer=rankedPlayers[0];
 const recent=H.slice(0,8);
 root.innerHTML=`
 <section class="kpiGrid">
  <div class="kpi"><span>Total levels</span><strong>${L.length}</strong><small>${main.length} main · ${ext.length} extended · ${legacy.length} legacy</small></div>
  <div class="kpi"><span>Players</span><strong>${P.length}</strong><small>${uniqueVictorPlayers} have at least one victory</small></div>
  <div class="kpi"><span>Total victories</span><strong>${R.length}</strong><small>${avgVictors.toFixed(2)} average per level</small></div>
  <div class="kpi"><span>Total points awarded</span><strong>${R.reduce((s,r)=>s+levelPoints(byId[r.level_id]?.rank,pm),0).toLocaleString()}</strong><small>calculated from current placements</small></div>
  <div class="kpi"><span>Average placement</span><strong>${avgPlacement?avgPlacement.toFixed(1):'—'}</strong><small>lower is harder</small></div>
  <div class="kpi"><span>Average victory value</span><strong>${avgPoints?avgPoints.toFixed(1):'—'}</strong><small>points per victory</small></div>
 </section>
 <div class="statsGrid twoWide">
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">LEADERBOARD</p><h2>Top players</h2></div><a class="textLink" href="players.html">View all →</a></div><div class="rankList">${rankedPlayers.slice(0,10).map((p,i)=>`<a class="rankRow" href="player.html?id=${encodeURIComponent(p.id)}"><span class="miniRank">#${i+1}</span><span class="rankName">${esc(p.name)}</span><span class="rankMeta">${num(p.victors)} victories</span><b>${num(p.total_points).toLocaleString()} pts</b></a>`).join('')||'<div class="muted">No players yet.</div>'}</div></section>
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">LEVEL ACTIVITY</p><h2>Most victored levels</h2></div></div><div>${barRows(mostVictored.map(x=>({value:x.victors,display:x.victors+' victors',name:x.name,rank:x.rank})),Math.max(1,...mostVictored.map(x=>x.victors)),x=>`<span class="rank">#${x.rank}</span> ${esc(x.name)}`)}</div></section>
 </div>
 <section class="panel"><div class="sectionTitle"><div><p class="eyebrow">LIST BREAKDOWN</p><h2>Where the levels live</h2></div><span class="muted">deep list coverage</span></div><div class="sectionCards">${sectionStats.map(([s,n])=>`<div class="sectionStat"><div class="sectionIcon">${s==='main'?'①':s==='extended'?'②':'③'}</div><div><strong>${n}</strong><span>${sectionLabel(s)}</span></div><em>${pct(n,L.length)}%</em></div>`).join('')}</div><div class="coverage"><div class="coverageHead"><span>Ranks populated</span><b>${maxRank||0}</b></div><div class="barTrack big"><div class="barFill" style="width:${Math.min(100,pct(L.length,Math.max(1,maxRank)))}%"></div></div><small class="muted">${emptyLevels} levels currently have no recorded victor.</small></div></section>
 <div class="statsGrid threeWide">
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">POINT ECONOMY</p><h2>Highest-value levels</h2></div></div><div class="compactList">${mostValuable.slice(0,8).map(x=>`<a class="compactRow" href="level.html?id=${encodeURIComponent(x.id)}"><span class="rank">#${x.rank}</span><span>${esc(x.name)}</span><b>${x.points} pts</b></a>`).join('')}</div></section>
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">DIFFICULTY</p><h2>Top of the list</h2></div></div><div class="compactList">${hardest.map(x=>`<a class="compactRow" href="level.html?id=${encodeURIComponent(x.id)}"><span class="rank">#${x.rank}</span><span>${esc(x.name)}</span><b>${x.victors} ${x.victors===1?'victor':'victors'}</b></a>`).join('')}</div></section>
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">WIN COUNTS</p><h2>Most victories</h2></div></div><div>${barRows(playerWinTop,Math.max(1,...playerWinTop.map(x=>x.value)),x=>esc(x.name))}</div></section>
 </div>
 <div class="statsGrid twoWide">
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">PLAYER POINTS</p><h2>Points leaderboard</h2></div></div><div>${barRows(playerTop,Math.max(1,...playerTop.map(x=>x.value)),x=>esc(x.name))}</div></section>
  <section class="panel statPanel"><div class="sectionTitle"><div><p class="eyebrow">VICTORY DEPTH</p><h2>Hard levels with victories</h2></div></div><div class="hardGrid">${hardestWithWins.length?hardestWithWins.map(x=>`<a class="hardCard" href="level.html?id=${encodeURIComponent(x.id)}"><span>#${x.rank}</span><strong>${esc(x.name)}</strong><small>${x.victors} ${x.victors===1?'victor':'victors'} · ${x.points} pts</small></a>`).join(''):'<div class="muted">No victories recorded yet.</div>'}</div></section>
 </div>
 <section class="panel"><div class="sectionTitle"><div><p class="eyebrow">RECENT HISTORY</p><h2>Latest placement changes</h2></div></div><div class="timeline">${recent.length?recent.map(h=>`<div class="timelineItem"><div class="timelineDot"></div><div><strong>${esc(byId[h.level_id]?.name||'Unknown level')}</strong><span>#${num(h.rank)} · ${sectionLabel(h.section)} · ${num(h.points)} pts</span><small>${h.note?esc(h.note):'Placement recorded'} · ${h.changed_at?new Date(h.changed_at).toLocaleDateString():''}</small></div></div>`).join(''):'<div class="muted">No placement history yet.</div>'}</div></section>
 <section class="panel funStats"><div><p class="eyebrow">ABSOLUTELY NECESSARY</p><h2>And now, the useless statistics.</h2><div class="funGrid"><div><b>${topPlayer?esc(topPlayer.name):'Nobody'}</b><span>current #1 player</span></div><div><b>${mostVictored[0]?esc(mostVictored[0].name):'Nothing'}</b><span>most beaten level</span></div><div><b>${hardest[0]?esc(hardest[0].name):'Nothing'}</b><span>current #1 level</span></div><div><b>${L.length?Math.round(R.length/L.length*100)/100:0}</b><span>victories per level</span></div></div></div></section>`;
 }catch(err){console.error(err);root.innerHTML=`<div class="panel error"><h2>Stats failed to load</h2><p>${esc(err.message||err)}</p><p class="muted">Check that the public read permissions for levels, records, players, point_values, player_leaderboard, and placement_history are enabled.</p></div>`}}
boot();

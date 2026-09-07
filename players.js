const cfg=window.DIDDY_CONFIG||{};const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function boot(){
 const el=document.getElementById('players');
 if(!sb){el.innerHTML='<div class="panel">Connect Supabase to see live players.</div>';return}
 const q=await Promise.all([
  sb.from('player_leaderboard').select('*').order('total_points',{ascending:false}),
  sb.from('records').select('*'),
  sb.from('levels').select('id,rank,name'),
  sb.from('point_values').select('*')
 ]);
 if(q[0].error){el.innerHTML=`<div class="panel error">${esc(q[0].error.message)}</div>`;return}
 const data=q[0].data||[],records=q[1].data||[],levels=q[2].data||[],PV=q[3].data||[];
 const map=Object.fromEntries(levels.map(x=>[x.id,x])), max=Math.max(...data.map(x=>Number(x.total_points)||0),1);
 const point=r=>Number(PV.find(x=>Number(x.rank)===Number(r))?.points||Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62))));
 const DAY=86400000;
 function playerForm(wins){
  // Player form is intentionally SHORT-WINDOW because the DIDDY DEMON LIST changes fast.
  // Compare the last 24 hours against the 24 hours immediately before that.
  const now=Date.now(), recent=[], previous=[];
  wins.forEach(r=>{
   const t=new Date(r.created_at).getTime();
   if(!Number.isFinite(t))return;
   const age=(now-t)/DAY;
   if(age>=0 && age<=1)recent.push(r);
   else if(age>1 && age<=2)previous.push(r);
  });
  const recentPts=recent.reduce((sum,r)=>sum+point(map[r.level_id]?.rank||101),0);
  const previousPts=previous.reduce((sum,r)=>sum+point(map[r.level_id]?.rank||101),0);
  const lastTime=wins.map(r=>new Date(r.created_at).getTime()).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  const daysSince=lastTime==null?Infinity:Math.max(0,(now-lastTime)/DAY);
  const rw=recent.length,pw=previous.length;
  let label='💤 QUIET',cls='quiet';
  // Surging = at least 6 wins in the last 24h AND a clear acceleration vs the prior 24h.
  if(rw>=6 && (pw===0 || recentPts>=previousPts*1.5 || rw>=pw+2)) {label='🔥 SURGING';cls='surging'}
  // Rising = recent activity is ahead of the previous 24h, but not enough for Surging.
  else if(rw>=1 && (pw===0 || recentPts>previousPts*1.08 || rw>pw)) {label='📈 RISING';cls='rising'}
  // Active = at least one victory in the last 24h, with roughly stable activity.
  else if(rw>=1) {label='⚡ ACTIVE';cls='active'}
  // Cooling = no win in the last 24h after having a win during the preceding 24h.
  else if(pw>=1) {label='🧊 COOLING';cls='cooling'}
  const change=recentPts-previousPts;
  const changeText=change>0?`+${change.toLocaleString()} pts vs prior 24h`:change<0?`${change.toLocaleString()} pts vs prior 24h`:'flat vs prior 24h';
  const detail=rw?`${rw} win${rw===1?'':'s'} / 24h · ${changeText}`:pw?`0 wins / 24h · ${pw} prior-24h win${pw===1?'':'s'}`:daysSince!==Infinity?`0 wins / 24h · last win ${Math.floor(daysSince)}d ago`:'No recorded victories';
  const title=`${label.replace(/^\S+ /,'')} — ${detail}`;
  return {label,cls,detail,title,recentPts,previousPts,recentWins:rw,previousWins:pw};
 }

 el.innerHTML=`<div class="listSummary"><span><b>${data.length}</b> players ranked</span><span>Points update automatically from victories</span><span><a href="analytics.html">Open Advanced Analytics →</a></span></div>`+
 (data.map((x,i)=>{
  const wins=records.filter(r=>r.player_id===x.id), xp=Math.round(Number(x.total_points||0)*1.2+wins.length*25), lvl=Math.floor(xp/100)+1;
  const power=Math.round(Number(x.total_points||0)*3+wins.filter(r=>(map[r.level_id]?.rank||999)<=10).length*18+wins.filter(r=>(map[r.level_id]?.rank||999)<=25).length*7+wins.length*4);
  const best=x.highest_victory?`#${x.highest_victory}`:'—', pct=Math.max(4,Math.round((Number(x.total_points)||0)/max*100));
  const last=wins.map(r=>map[r.level_id]).filter(Boolean).sort((a,b)=>a.rank-b.rank)[0], form=playerForm(wins);
  return `<a class="playerRankCard" href="player.html?id=${x.id}"><div class="playerRank">#${i+1}</div><div class="playerAvatar">${esc((x.name||'?').slice(0,2).toUpperCase())}</div><div class="playerMain"><strong>${esc(x.name)}</strong><div class="meta">${wins.length} victories · best ${best} · avg ${x.average_placement??'—'}</div><div class="rankMeter"><span style="width:${pct}%"></span></div>${last?`<small class="meta">Top victory: #${last.rank} ${esc(last.name)}</small>`:''}<div class="playerBadges"><span class="tag">⚡ ${power} POWER</span><span class="tag xpTag">LV ${lvl} · ${xp} XP</span><span class="tag momentumTag ${form.cls}" title="${esc(form.title)}">${form.label}</span></div><small class="formDetail">${esc(form.detail)}</small></div><div class="playerPoints"><strong>${Number(x.total_points||0).toLocaleString()}</strong><small>points</small></div></a>`
 }).join('')||'<div class="panel emptyState"><div>👤</div><h2>No players yet</h2><p>Add players from Admin.</p></div>');
}
boot();

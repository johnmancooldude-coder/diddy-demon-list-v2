(function(){
  'use strict';
  const cfg=window.DIDDY_CONFIG||{};
  const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
  const DAY=86400000;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString():'—'};
  const dt=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString():'—'};
  const rankPoints=(rank,PV)=>Number(PV.find(x=>Number(x.rank)===Number(rank))?.points||Math.max(1,Math.round(100-99*Math.pow((Number(rank)-1)/99,.62))));
  const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n};
  const insertAfter=(anchor,node)=>{if(!anchor||!anchor.parentNode)return;anchor.parentNode.insertBefore(node,anchor.nextSibling)};
  let cache=null;
  async function data(){
    if(cache)return cache;
    if(!sb)return null;
    cache=Promise.all([
      sb.from('players').select('*'),
      sb.from('levels').select('*').order('section').order('rank'),
      sb.from('records').select('*').order('created_at',{ascending:true}),
      sb.from('placement_history').select('*').order('recorded_at',{ascending:true}),
      sb.from('point_values').select('*')
    ]).then(q=>q.some(x=>x.error)?null:{P:q[0].data||[],L:q[1].data||[],R:q[2].data||[],H:q[3].data||[],PV:q[4].data||[]});
    return cache;
  }
  function histMap(H){const m={};H.forEach(h=>(m[h.level_id]??=[]).push(h));return m}
  function rankAtFactory(d){
    const hm=histMap(d.H), current=Object.fromEntries(d.L.map(l=>[l.id,Number(l.rank)]));
    return (lid,when)=>{
      const a=hm[lid]||[];let lo=0,hi=a.length-1,best=null;
      while(lo<=hi){const mid=(lo+hi)>>1,t=new Date(a[mid].recorded_at).getTime();if(t<=when){best=a[mid];lo=mid+1}else hi=mid-1}
      return best&&Number.isFinite(Number(best.rank))?Number(best.rank):(current[lid]||101);
    };
  }
  function dailyRanks(d,onlyId){
    const rankAt=rankAtFactory(d), players=d.P, nameMap=Object.fromEntries(players.map(p=>[p.id,p.name]));
    const enriched=d.R.map(r=>({...r,historicalRank:rankAt(r.level_id,new Date(r.created_at).getTime())})).filter(r=>r.player_id&&Number.isFinite(Number(r.historicalRank)));
    if(!enriched.length)return [];
    const byDay={};enriched.forEach(r=>{const x=new Date(r.created_at);x.setHours(0,0,0,0);const k=x.toISOString().slice(0,10);(byDay[k]??=[]).push(r)});
    const totals=Object.fromEntries(players.map(p=>[p.id,{points:0,wins:0}]));
    const keys=Object.keys(byDay).sort();if(!keys.length)return [];
    const start=new Date(keys[0]+'T00:00:00'),today=new Date();today.setHours(0,0,0,0);const out=[];
    for(let cur=new Date(start);cur<=today;cur.setDate(cur.getDate()+1)){
      const k=cur.toISOString().slice(0,10);
      (byDay[k]||[]).forEach(r=>{const t=totals[r.player_id]||(totals[r.player_id]={points:0,wins:0});t.points+=rankPoints(r.historicalRank,d.PV);t.wins++});
      const board=Object.entries(totals).filter(([,v])=>v.wins>0).sort((a,b)=>b[1].points-a[1].points||b[1].wins-a[1].wins||String(nameMap[a[0]]||'').localeCompare(String(nameMap[b[0]]||'')));
      if(onlyId){const pos=board.findIndex(x=>x[0]===onlyId)+1;if(pos>0)out.push({date:k,label:cur.toLocaleDateString(undefined,{month:'short',day:'numeric'}),rank:pos,points:totals[onlyId].points})}
      else out.push({date:k,label:cur.toLocaleDateString(undefined,{month:'short',day:'numeric'}),board});
    }
    return out;
  }
  function playerStats(d,id){
    const p=d.P.find(x=>x.id===id);if(!p)return null;
    const wins=d.R.filter(r=>r.player_id===id).map(r=>({...r,l:d.L.find(x=>x.id===r.level_id)})).filter(x=>x.l).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const ranks=wins.map(x=>Number(x.l.rank)).filter(Number.isFinite);
    const points=wins.reduce((s,x)=>s+rankPoints(x.l.rank,d.PV),0);
    const attempts=wins.map(x=>Number(x.attempts||0)).filter(x=>x>0);
    const seconds=wins.map(x=>Number(x.completion_seconds||0)).filter(x=>x>0);
    const byDay={};wins.forEach(x=>{const k=new Date(x.created_at).toISOString().slice(0,10);byDay[k]=(byDay[k]||0)+1});
    const active=Object.keys(byDay).sort();let longest=0,streak=0,lastDay=null;active.forEach(k=>{const t=new Date(k+'T00:00:00').getTime();if(lastDay!=null&&t-lastDay===DAY)streak++;else streak=1;longest=Math.max(longest,streak);lastDay=t});
    const currentStreak=(()=>{if(!active.length)return 0;let n=1;for(let i=active.length-1;i>0;i--){const a=new Date(active[i]+'T00:00:00').getTime(),b=new Date(active[i-1]+'T00:00:00').getTime();if(a-b===DAY)n++;else break}return n})();
    const byMonth={};wins.forEach(x=>{const d0=new Date(x.created_at),k=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}`;(byMonth[k]??={wins:0,points:0}).wins++;byMonth[k].points+=rankPoints(x.l.rank,d.PV)});
    const bestMonth=Object.entries(byMonth).sort((a,b)=>b[1].wins-a[1].wins||b[1].points-a[1].points)[0];
    const byWeek={};wins.forEach(x=>{const z=new Date(x.created_at);const day=(z.getDay()+6)%7;z.setHours(0,0,0,0);z.setDate(z.getDate()-day);const k=z.toISOString().slice(0,10);(byWeek[k]??={wins:0,points:0}).wins++;byWeek[k].points+=rankPoints(x.l.rank,d.PV)});
    const days=dailyRanks(d,id);const bestRank=days.length?Math.min(...days.map(x=>x.rank)):null,worstRank=days.length?Math.max(...days.map(x=>x.rank)):null;
    const hardest=ranks.length?Math.min(...ranks):null, top10=wins.filter(x=>x.l.rank<=10).length, top1=wins.filter(x=>x.l.rank===1).length;
    const recent7=wins.filter(x=>Date.now()-new Date(x.created_at).getTime()<=7*DAY).length;
    const first=wins[0],last=wins[wins.length-1];
    return {p,wins,ranks,points,attempts,seconds,byDay,active,longest,currentStreak,byMonth,byWeek,bestMonth,days,bestRank,worstRank,hardest,top10,top1,recent7,first,last};
  }
  function mountOnce(id,node){const old=document.getElementById(id);if(old)old.remove();node.id=id;document.querySelector('main.wrap')?.appendChild(node)}

  async function enhancePlayer(){
    const root=document.getElementById('playerPage');if(!root||!sb)return;
    const id=new URLSearchParams(location.search).get('id');if(!id)return;
    const d=await data();if(!d)return;const s=playerStats(d,id);if(!s)return;
    const old=document.getElementById('v24PlayerIntel');if(old)old.remove();
    const milestones=[
      ['🥇','First victory',s.wins.length>=1],['🏅','5 victories',s.wins.length>=5],['🏆','10 victories',s.wins.length>=10],['💀','25 victories',s.wins.length>=25],['☢️','50 victories',s.wins.length>=50],
      ['💯','100 career points',s.points>=100],['💰','500 career points',s.points>=500],['🤑','1,000 career points',s.points>=1000],['🔥','First Top 10 victory',s.top10>=1],['👑','First #1-level victory',s.top1>=1]
    ];
    const dna={Peak:s.hardest?Math.max(0,100-(s.hardest-1)*1.1):0,Consistency:s.attempts.length?Math.max(0,Math.min(100,Math.round(100-(Math.sqrt(s.attempts.reduce((a,b)=>a+b*b,0)/s.attempts.length)/(s.attempts.reduce((a,b)=>a+b,0)/s.attempts.length||1))*20))):50,Depth:Math.min(100,s.wins.filter(x=>x.l.rank<=50).length*5),Grind:s.attempts.length?Math.min(100,Math.round(100000/(1000+s.attempts.reduce((a,b)=>a+b,0)/s.attempts.length))):0,Speed:s.seconds.length?Math.min(100,Math.round(100000/(1000+s.seconds.reduce((a,b)=>a+b,0)/s.seconds.length))):0,Momentum:Math.min(100,s.recent7*12)};
    const node=el('section','panel v24Panel',`<p class="eyebrow">🧬 V2.4 PLAYER CAREER</p><h2>Career Legacy</h2><div class="v24KpiGrid">
      <div><span>BEST RANK EVER</span><b>#${s.bestRank??'—'}</b><small>daily reconstructed</small></div><div><span>WORST RANK EVER</span><b>#${s.worstRank??'—'}</b><small>daily reconstructed</small></div><div><span>CURRENT WIN STREAK</span><b>${s.currentStreak}</b><small>active victory days</small></div><div><span>LONGEST STREAK</span><b>${s.longest}</b><small>consecutive victory days</small></div><div><span>#1-LEVEL VICTORIES</span><b>${s.top1}</b><small>beaten while ranked #1</small></div><div><span>HARDEST VICTORY</span><b>${s.hardest?'#'+s.hardest:'—'}</b><small>${s.hardest?(esc(s.wins.find(x=>x.l.rank===s.hardest)?.l.name||'')):''}</small></div></div>
      <div class="v24TwoCols"><div><h3>📍 Days Spent at Each Player Rank</h3><div class="v24MiniList">${Object.entries(s.days.reduce((m,x)=>(m[x.rank]=(m[x.rank]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([r,n])=>`<div class="adminRow row between"><span>#${r}</span><b>${n} day${n===1?'':'s'}</b></div>`).join('')||'<p class="meta">No daily rank history yet.</p>'}</div></div><div><div><h3>🏆 Career Milestones</h3><div class="v24Milestones">${milestones.map(m=>`<div class="v24Milestone ${m[2]?'unlocked':''}"><span>${m[0]}</span><b>${esc(m[1])}</b><small>${m[2]?'UNLOCKED':'LOCKED'}</small></div>`).join('')}</div></div><div><h3>🏅 Career Trophies</h3><div class="v24TrophyBox"><div>🏆 <b>${s.wins.length}</b> victories</div><div>💀 <b>#${s.hardest??'—'}</b> hardest win</div><div>📈 <b>#${s.bestRank??'—'}</b> best player rank</div><div>🔥 <b>${s.currentStreak}</b> day active streak</div><div>🥇 <b>${s.top1}</b> #1-level wins</div></div></div></div>
      <h3>📅 Monthly / Weekly Activity</h3><div class="v24ActivityGrid"><div class="v24MiniChart"><canvas id="v24PlayerActivity"></canvas></div><div class="v24MiniList"><b class="meta">MONTHS</b>${Object.entries(s.byMonth).slice(-6).reverse().map(([k,v])=>`<div class="adminRow row between"><span>${esc(k)}</span><b>${v.wins} wins · ${v.points} pts</b></div>`).join('')||'<p class="meta">No monthly activity yet.</p>'}<b class="meta" style="display:block;margin-top:10px">WEEKS</b>${Object.entries(s.byWeek).slice(-6).reverse().map(([k,v])=>`<div class="adminRow row between"><span>Week of ${esc(k)}</span><b>${v.wins} wins · ${v.points} pts</b></div>`).join('')||'<p class="meta">No weekly activity yet.</p>'}</div></div>
      <h3>💀 Hardest Victory Progression</h3><div class="v24Timeline">${s.wins.map((x,i)=>{const best=Math.min(...s.wins.slice(0,i+1).map(y=>y.l.rank));return `<div class="v23Event"><span class="v23Icon">${x.l.rank===best?'💀':'🏆'}</span><div><b>#${x.l.rank} · ${esc(x.l.name)}</b><div class="v23Muted">${date(x.created_at)} · career peak then #${best}</div></div></div>`}).join('')||'<p class="meta">No victories yet.</p>'}</div>
      <h3>🧬 DNA 7.0</h3><div class="v24DNA">${Object.entries(dna).map(([k,v])=>`<div><div class="v24DNAHead"><b>${k}</b><span>${Math.round(v)}/100</span></div><div class="v24Bar"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div></div>`).join('')}</div></section>`);
    node.id='v24PlayerIntel';insertAfter(document.getElementById('playerV23')||document.getElementById('playerPage'),node);
    const canvas=document.getElementById('v24PlayerActivity');if(canvas&&window.Chart){const labels=Object.keys(s.byMonth).slice(-12);new Chart(canvas,{type:'bar',data:{labels,datasets:[{label:'Victories',data:labels.map(k=>s.byMonth[k].wins),borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd0e4'}}},scales:{x:{ticks:{color:'#9da4bd'}},y:{beginAtZero:true,ticks:{color:'#9da4bd',precision:0}}}}});}
    enhancePlayerTimeline(d,s);
    enhancePlayerRank(d,s);
  }
  function renderTimeline(s,mode){
    const list=document.getElementById('careerTimelineList');if(!list)return;
    let w=s.wins.slice();
    if(mode==='beat')w.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    if(mode==='easy')w.sort((a,b)=>Number(b.l.rank)-Number(a.l.rank)||new Date(a.created_at)-new Date(b.created_at));
    if(mode==='hard')w.sort((a,b)=>Number(a.l.rank)-Number(b.l.rank)||new Date(a.created_at)-new Date(b.created_at));
    if(mode==='points')w.sort((a,b)=>rankPoints(b.l.rank,window.__diddyV24Data?.PV||[])-rankPoints(a.l.rank,window.__diddyV24Data?.PV||[])||new Date(a.created_at)-new Date(b.created_at));
    const PV=window.__diddyV24Data?.PV||[];
    list.innerHTML=w.map(r=>`<a class="adminRow row between" href="level.html?id=${r.l.id}"><span><b>#${r.l.rank} · ${esc(r.l.name)}</b><span class="meta"> · ${date(r.created_at)} · ${esc(r.l.difficulty||'')}</span></span><strong>${rankPoints(r.l.rank,PV)} pts</strong></a>`).join('')||'<p class="meta">No victories yet.</p>';
  }
  function enhancePlayerTimeline(d,s){
    window.__diddyV24Data=d;
    const wait=()=>{const old=document.getElementById('careerTimelineSort');if(!old){setTimeout(wait,150);return}const fresh=old.cloneNode(false);fresh.innerHTML='<option value="beat">Oldest → newest</option><option value="easy">Easiest → hardest</option><option value="hard">Hardest → easiest</option><option value="points">Highest points → lowest points</option>';old.replaceWith(fresh);fresh.onchange=()=>renderTimeline(s,fresh.value);renderTimeline(s,'beat')};wait();
  }
  function enhancePlayerRank(d,s){
    const canvas=document.getElementById('playerRankChart');if(!canvas||!window.Chart)return;
    const days=s.days;if(!days.length)return;
    if(window.__diddyV24RankChart){try{window.__diddyV24RankChart.destroy()}catch{}}
    window.__diddyV24RankChart=new Chart(canvas,{type:'line',data:{labels:days.map(x=>x.label),datasets:[{label:'Daily player rank',data:days.map(x=>x.rank),tension:.22,fill:true,pointRadius:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#cbd0e4'}},tooltip:{callbacks:{label:c=>`Rank #${c.parsed.y}`}}},scales:{x:{ticks:{color:'#9da4bd',maxTicksLimit:14}},y:{reverse:true,ticks:{color:'#9da4bd',precision:0},grid:{color:'rgba(255,255,255,.05)'}}}}});
    const panel=canvas.closest('.panel');if(panel&&!panel.querySelector('.v24RankSummary')){const ranks=days.map(x=>x.rank);const sum=el('div','v24RankSummary',`<b>Daily snapshots: ${days.length}</b><span>Best #${Math.min(...ranks)} · Worst #${Math.max(...ranks)} · ${ranks.length>1?`Movement ${ranks[0]>ranks.at(-1)?'▲ improved':'▼ declined'} ${Math.abs(ranks[0]-ranks.at(-1))} spots`: 'First recorded day'}</span>`);panel.insertBefore(sum,canvas.parentNode)}
  }

  async function enhanceLevel(){
    const root=document.getElementById('levelPage');if(!root||!sb)return;const id=new URLSearchParams(location.search).get('id');if(!id)return;const d=await data();if(!d)return;const l=d.L.find(x=>x.id===id);if(!l)return;
    const wins=d.R.filter(r=>r.level_id===id).map(r=>({...r,p:d.P.find(x=>x.id===r.player_id)})).filter(x=>x.p).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const hist=d.H.filter(h=>h.level_id===id).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));
    const times=hist.map(x=>new Date(x.recorded_at).getTime()).filter(Number.isFinite);const rankTimes={};for(let i=0;i<hist.length;i++){const start=new Date(hist[i].recorded_at).getTime(),end=hist[i+1]?new Date(hist[i+1].recorded_at).getTime():Date.now();if(Number.isFinite(start))rankTimes[hist[i].rank]=(rankTimes[hist[i].rank]||0)+Math.max(0,end-start)}
    const timeEntries=Object.entries(rankTimes).sort((a,b)=>b[1]-a[1]);
    const changes=[];for(let i=1;i<hist.length;i++){const from=Number(hist[i-1].rank),to=Number(hist[i].rank);if(Number.isFinite(from)&&Number.isFinite(to)&&from!==to)changes.push({from,to,date:hist[i].recorded_at})}
    const biggestRise=changes.filter(x=>x.to<x.from).sort((a,b)=>(b.from-b.to)-(a.from-a.to))[0],biggestFall=changes.filter(x=>x.to>x.from).sort((a,b)=>(b.to-b.from)-(a.to-a.from))[0];
    const at=wins.map(x=>Number(x.attempts||0)).filter(x=>x>0).sort((a,b)=>a-b),secs=wins.map(x=>Number(x.completion_seconds||0)).filter(x=>x>0).sort((a,b)=>a-b);
    const median=at.length?(at.length%2?at[(at.length-1)/2]:(at[at.length/2-1]+at[at.length/2])/2):null,avg=at.length?at.reduce((a,b)=>a+b,0)/at.length:null;
    const rolling=[];for(let i=0;i<wins.length;i++){const end=new Date(wins[i].created_at).getTime(),start=end-6*DAY;rolling.push({date:wins[i].created_at,count:wins.filter(x=>{const t=new Date(x.created_at).getTime();return t>=start&&t<=end}).length})}const hot=rolling.sort((a,b)=>b.count-a.count)[0];
    const first=wins[0],last=wins.at(-1),startDate=times.length?times[0]:null,endDate=times.length?times.at(-1):null;
    const node=el('section','panel v24Panel',`<p class="eyebrow">💀 V2.4 LEVEL LEGACY</p><h2>${esc(l.name)} — Career History</h2><div class="v24KpiGrid">
      <div><span>HIGHEST RANK</span><b>#${hist.length?Math.min(...hist.map(x=>Number(x.rank))):Number(l.rank)}</b></div><div><span>LOWEST RANK</span><b>#${hist.length?Math.max(...hist.map(x=>Number(x.rank))):Number(l.rank)}</b></div><div><span>BIGGEST RISE</span><b>${biggestRise?`▲ ${biggestRise.from-biggestRise.to}`:'—'}</b><small>${biggestRise?`#${biggestRise.from} → #${biggestRise.to}`:''}</small></div><div><span>BIGGEST FALL</span><b>${biggestFall?`▼ ${biggestFall.to-biggestFall.from}`:'—'}</b><small>${biggestFall?`#${biggestFall.from} → #${biggestFall.to}`:''}</small></div><div><span>FASTEST</span><b>${secs.length?secs[0].toFixed(1)+'s':'—'}</b></div><div><span>SLOWEST</span><b>${secs.length?secs.at(-1).toFixed(1)+'s':'—'}</b></div><div><span>AVG ATTEMPTS</span><b>${avg?Math.round(avg).toLocaleString():'—'}</b></div><div><span>MEDIAN ATTEMPTS</span><b>${median!=null?Math.round(median).toLocaleString():'—'}</b></div></div>
      <div class="v24TwoCols"><div><h3>⏱️ Time at Each Rank</h3><div class="v24MiniList">${timeEntries.slice(0,12).map(([r,ms])=>`<div class="adminRow row between"><span>#${r}</span><b>${Math.round(ms/DAY)} day${Math.round(ms/DAY)===1?'':'s'}</b></div>`).join('')||'<p class="meta">No placement history yet.</p>'}</div></div><div><h3>🔥 Level Era</h3><div class="v24EraBox"><div class="eyebrow">THE ${esc(l.name).toUpperCase()} ERA</div><h3>#${hist.length?hist[0].rank:l.rank} → #${l.rank}</h3><p>${startDate&&endDate?Math.max(0,Math.round((endDate-startDate)/DAY))+' days of recorded history':'History starts with the first placement event.'}</p><p>${wins.length} victories · ${hist.length} placement events · ${hot?`hottest 7-day period: ${hot.count} victories`:''}</p></div></div></div>
      <h3>🏆 Victor Growth</h3><div class="v24Timeline">${wins.slice().reverse().slice(0,25).map((x,i)=>`<a class="v23Event" href="player.html?id=${x.p.id}"><span class="v23Icon">${i===0?'🔥':'🏆'}</span><div><b>${esc(x.p.name)}</b><div class="v23Muted">${date(x.created_at)} · #${l.rank} · ${x.attempts?Number(x.attempts).toLocaleString()+' attempts':''}${x.completion_seconds?' · '+Number(x.completion_seconds).toFixed(1)+'s':''}</div></div></a>`).join('')||'<p class="meta">No victors yet.</p>'}</div>
      <h3>📈 Complete Rank History</h3><div class="chartBox v24Tall"><canvas id="v24LevelRank"></canvas></div></section>`);
    node.id='v24LevelIntel';insertAfter(document.getElementById('levelV23')||document.getElementById('levelPage'),node);
    if(window.Chart&&hist.length){new Chart(document.getElementById('v24LevelRank'),{type:'line',data:{labels:hist.map(x=>date(x.recorded_at)),datasets:[{label:'Rank',data:hist.map(x=>Number(x.rank)),tension:.2,fill:true,borderWidth:2,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#cbd0e4'}}},scales:{x:{ticks:{color:'#9da4bd',maxTicksLimit:12}},y:{reverse:true,ticks:{color:'#9da4bd',precision:0}}}}});}
  }

  function feedEvents(d){
    const events=[], levelsBy=Object.fromEntries(d.L.map(l=>[l.id,l])), playersBy=Object.fromEntries(d.P.map(p=>[p.id,p]));
    d.R.forEach(r=>{const l=levelsBy[r.level_id],p=playersBy[r.player_id];if(l&&p)events.push({type:'victory',icon:'🏆',t:new Date(r.created_at),title:`${p.name} conquered ${l.name}`,body:`#${l.rank} · ${rankPoints(l.rank,d.PV)} pts`,href:`player.html?id=${p.id}`,player:p,level:l,record:r})});
    const hm=histMap(d.H);Object.entries(hm).forEach(([lid,a])=>{const l=levelsBy[lid];if(!l)return;a.forEach((h,i)=>{if(i===0)return;const prev=a[i-1],from=Number(prev.rank),to=Number(h.rank);if(!Number.isFinite(from)||!Number.isFinite(to)||from===to)return;events.push({type:'rank',icon:to<from?'📈':'📉',t:new Date(h.recorded_at),title:`${l.name} moved ${to<from?'up':'down'}`,body:`#${from} → #${to}`,href:`level.html?id=${l.id}`,level:l,history:h})})});
    d.L.forEach(l=>{if(l.created_at)events.push({type:'level',icon:'🆕',t:new Date(l.created_at),title:`${l.name} joined the list`,body:`${l.section} #${l.rank}`,href:`level.html?id=${l.id}`,level:l})});
    const byPlayer={};d.R.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(r=>{const p=playersBy[r.player_id],l=levelsBy[r.level_id];if(!p||!l)return;const before=byPlayer[p.id]||0,after=before+rankPoints(l.rank,d.PV);for(const m of [100,500,1000])if(before<m&&after>=m)events.push({type:'player',icon:'💯',t:new Date(r.created_at),title:`${p.name} reached ${m.toLocaleString()} points`,body:'Career point milestone',href:`player.html?id=${p.id}`,player:p});byPlayer[p.id]=after});
    const chronological=d.R.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    let maxAttempts=0,fastestSeconds=Infinity,hardestRank=101;
    chronological.forEach(r=>{const l=levelsBy[r.level_id],p=playersBy[r.player_id];if(!l||!p)return;const t=new Date(r.created_at);const ar=Number(r.attempts||0),sec=Number(r.completion_seconds||0),rp=Number(l.rank)||101;if(ar>maxAttempts&&maxAttempts>0)events.push({type:'record',icon:'📚',t,title:`${p.name} broke the attempts record`,body:`${ar.toLocaleString()} attempts on ${l.name}`,href:`player.html?id=${p.id}`,player:p,level:l,record:r});if(ar>maxAttempts)maxAttempts=ar;if(sec>0&&sec<fastestSeconds&&fastestSeconds<Infinity)events.push({type:'record',icon:'⚡',t,title:`${p.name} broke the speed record`,body:`${sec.toFixed(1)}s on ${l.name}`,href:`player.html?id=${p.id}`,player:p,level:l,record:r});if(sec>0&&sec<fastestSeconds)fastestSeconds=sec;if(rp<hardestRank&&hardestRank<101)events.push({type:'record',icon:'💀',t,title:`${p.name} set a new hardest victory`,body:`#${rp} · ${l.name}`,href:`player.html?id=${p.id}`,player:p,level:l,record:r});if(rp<hardestRank)hardestRank=rp});
    const daily=dailyRanks(d);for(let i=1;i<daily.length;i++){const before=daily[i-1]?.board?.[0]?.[0],after=daily[i]?.board?.[0]?.[0];if(after&&after!==before){const p=playersBy[after];if(p)events.push({type:'player',icon:'👑',t:new Date(daily[i].date+'T23:59:59'),title:'New #1 player',body:`${p.name} took the top spot`,href:`player.html?id=${p.id}`,player:p})}}
    return events.filter(e=>Number.isFinite(e.t.getTime())).sort((a,b)=>b.t-a.t);
  }
  async function enhanceFeed(){
    const root=document.getElementById('liveFeed');if(!root||!sb)return;const d=await data();if(!d)return;const events=feedEvents(d);root.innerHTML=`<div class="v24FeedToolbar"><button class="v24Filter active" data-filter="all">ALL</button><button class="v24Filter" data-filter="victory">VICTORIES</button><button class="v24Filter" data-filter="rank">RANKS</button><button class="v24Filter" data-filter="player">PLAYERS</button><button class="v24Filter" data-filter="level">LEVELS</button><button class="v24Filter" data-filter="record">RECORDS</button></div><div id="v24FeedList" class="v24FeedList"></div>`;
    const list=document.getElementById('v24FeedList');const render=filter=>{let ev=events.filter(x=>filter==='all'||x.type===filter);if(filter==='record')ev=events.filter(x=>x.type==='victory'&&Number(x.record?.attempts||0)>0).sort((a,b)=>Number(b.record?.attempts||0)-Number(a.record?.attempts||0));list.innerHTML=ev.slice(0,40).map(x=>`<a class="v24EventCard" href="${x.href||'#'}"><div class="v24EventIcon">${x.icon}</div><div><b>${esc(x.title)}</b><p>${esc(x.body)}</p><small>${dt(x.t)}</small></div></a>`).join('')||'<p class="meta">No events for this filter.</p>'};render('all');root.querySelectorAll('.v24Filter').forEach(b=>b.onclick=()=>{root.querySelectorAll('.v24Filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.filter)});
  }

  async function enhanceSearch(){
    const root=document.getElementById('searchResults');if(!root||!sb)return;const input=document.getElementById('q');if(!input)return;const d=await data();if(!d)return;
    const fresh=input.cloneNode(true);input.replaceWith(fresh);const helper=el('div','v24SearchHelp',`<button data-q="#1">#1</button><button data-q="top 10">top 10</button><button data-q="player:riot victories:3+">player:riot victories:3+</button><button data-q="rank:1-10 difficulty:biblical">rank:1-10 difficulty:biblical</button><button data-q="points:500+">points:500+</button><button data-q="victories:10+">victories:10+</button><button data-q="difficulty:biblical">difficulty:biblical</button>`);root.parentNode.insertBefore(helper,root);
    const levels=d.L,players=d.P,records=d.R;const pm=Object.fromEntries(players.map(p=>[p.id,p])),lm=Object.fromEntries(levels.map(l=>[l.id,l]));
    function parse(q){const tokens=q.trim().split(/\s+/).filter(Boolean);const f={text:[],player:null,creator:null,rank:null,points:null,victories:null,difficulty:null};tokens.forEach(t=>{const z=t.match(/^player:(.+)$/i);if(z)f.player=z[1].toLowerCase();else if((z=t.match(/^creator:(.+)$/i)))f.creator=z[1].toLowerCase();else if((z=t.match(/^rank:(\d+)(?:-(\d+))?$/i)))f.rank=[+z[1],+(z[2]||z[1])];else if((z=t.match(/^points:(\d+)\+$/i)))f.points=+z[1];else if((z=t.match(/^victories:(\d+)\+$/i)))f.victories=+z[1];else if((z=t.match(/^difficulty:(.+)$/i)))f.difficulty=z[1].toLowerCase();else if(/^#\d+$/.test(t))f.rank=[+t.slice(1),+t.slice(1)];else f.text.push(t.toLowerCase())});return f}
    function render(q){const f=parse(q),wins={};records.forEach(r=>wins[r.player_id]=(wins[r.player_id]||0)+1);const points={};records.forEach(r=>{const l=lm[r.level_id];if(l)points[r.player_id]=(points[r.player_id]||0)+rankPoints(l.rank,d.PV)});let ps=players.filter(p=>(!f.player||p.name.toLowerCase().includes(f.player))&&(!f.victories||((wins[p.id]||0)>=f.victories))&&(!f.points||((points[p.id]||0)>=f.points)));let ls=levels.filter(l=>(!f.creator||String(l.creator||'').toLowerCase().includes(f.creator))&&(!f.difficulty||String(l.difficulty||'').toLowerCase().includes(f.difficulty))&&(!f.rank||Number(l.rank)>=f.rank[0]&&Number(l.rank)<=f.rank[1])&&(!f.text.length||f.text.every(t=>[l.name,l.creator,l.verifier,l.holder,l.difficulty,l.status].join(' ').toLowerCase().includes(t))));if(f.player)ls=[];if(f.victories||f.points)ls=[];root.innerHTML=[...ps.map(p=>`<a class="adminRow row between" href="player.html?id=${p.id}"><span><b>👤 ${esc(p.name)}</b><span class="meta"> player · ${wins[p.id]||0} victories · ${points[p.id]||0} pts</span></span><span>View →</span></a>`),...ls.map(l=>`<a class="adminRow row between" href="level.html?id=${l.id}"><span><b>#${l.rank} · ${esc(l.name)}</b><span class="meta"> ${esc(l.section)} · ${esc(l.creator||'')}</span></span><span>View →</span></a>`)].join('')||'<div class="panel">No matches.</div>';root.parentNode.insertBefore(helper,root)}
    helper.querySelectorAll('button').forEach(b=>b.onclick=()=>{fresh.value=b.dataset.q;render(fresh.value)});fresh.oninput=()=>render(fresh.value);render(fresh.value);
  }

  async function enhanceRecords(){
    const root=document.getElementById('records');if(!root||!sb)return;const d=await data();if(!d)return;const recs=d.R.map(r=>({...r,l:d.L.find(x=>x.id===r.level_id),p:d.P.find(x=>x.id===r.player_id)})).filter(x=>x.l&&x.p);if(!recs.length)return;
    const historical=[];const byP={};recs.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(r=>{const before=byP[r.p.id]||0;byP[r.p.id]=(before+1);if(before+1>1)historical.push({kind:'Most victories',value:before+1,p:r.p,r});});
    const fastest=recs.filter(x=>Number(x.completion_seconds)>0).sort((a,b)=>Number(a.completion_seconds)-Number(b.completion_seconds))[0],attempts=recs.filter(x=>Number(x.attempts)>0).sort((a,b)=>Number(b.attempts)-Number(a.attempts))[0],hardest=recs.slice().sort((a,b)=>a.l.rank-b.l.rank)[0];
    const recent24=recs.filter(x=>Date.now()-new Date(x.created_at).getTime()<=DAY),by24={};recent24.forEach(x=>by24[x.p.id]=(by24[x.p.id]||0)+1);const most24=Object.entries(by24).sort((a,b)=>b[1]-a[1])[0];
    const hm=histMap(d.H);let biggestJump=null,biggestFall=null,longest=null;Object.entries(hm).forEach(([lid,h])=>{for(let i=1;i<h.length;i++){const a=Number(h[i-1].rank),b=Number(h[i].rank);if(b<a&&(!biggestJump||a-b>biggestJump.delta))biggestJump={delta:a-b,h:h[i],lid};if(b>a&&(!biggestFall||b-a>biggestFall.delta))biggestFall={delta:b-a,h:h[i],lid}}for(const x of h){if(Number(x.rank)!==1)continue;const end=h[h.indexOf(x)+1]?new Date(h[h.indexOf(x)+1].recorded_at).getTime():Date.now(),dur=Math.max(0,end-new Date(x.recorded_at).getTime());if(!longest||dur>longest.dur)longest={dur,x,lid}}});
    const histLines=historical.slice(-20).reverse().map(x=>`<div class="adminRow row between"><span>🏆 ${esc(x.p.name)} reached <b>${x.value}</b> victories</span><span class="meta">${date(x.r.created_at)}</span></div>`).join('');
    const node=el('section','panel v24Panel',`<p class="eyebrow">🏅 V2.4 RECORD BOOK</p><h2>Historical Record Board</h2><div class="v24RecordGrid"><div><span>MOST VICTORIES</span><b>${Object.entries(byP).sort((a,b)=>b[1]-a[1])[0]?.[1]||0}</b><small>${esc(d.P.find(p=>p.id===Object.entries(byP).sort((a,b)=>b[1]-a[1])[0]?.[0])?.name||'—')}</small></div><div><span>HARDEST VICTORY</span><b>${hardest?'#'+hardest.l.rank:'—'}</b><small>${hardest?esc(hardest.p.name):''}</small></div><div><span>FASTEST</span><b>${fastest?Number(fastest.completion_seconds).toFixed(1)+'s':'—'}</b><small>${fastest?esc(fastest.p.name):''}</small></div><div><span>MOST ATTEMPTS</span><b>${attempts?Number(attempts.attempts).toLocaleString():'—'}</b><small>${attempts?esc(attempts.p.name):''}</small></div><div><span>MOST VICTORIES · 24H</span><b>${most24?.[1]||0}</b><small>${most24?esc(d.P.find(p=>p.id===most24[0])?.name||''):''}</small></div><div><span>BIGGEST RANK CLIMB</span><b>${biggestJump?.delta||'—'}</b><small>${biggestJump?esc(d.L.find(l=>l.id===biggestJump.lid)?.name||''):''}</small></div><div><span>BIGGEST RANK FALL</span><b>${biggestFall?.delta||'—'}</b><small>${biggestFall?esc(d.L.find(l=>l.id===biggestFall.lid)?.name||''):''}</small></div><div><span>LONGEST #1 REIGN</span><b>${longest?Math.round(longest.dur/DAY)+'d':'—'}</b><small>${longest?esc(d.L.find(l=>l.id===longest.lid)?.name||''):''}</small></div></div><h3>📜 Record History</h3><div class="v24MiniList">${histLines||'<p class="meta">Record history will appear as records are broken.</p>'}</div>`);node.id='v24Records';root.appendChild(node);
  }

  async function enhanceTimeMachine(){
    const root=document.getElementById('tmOut');if(!root||!sb)return;const d=await data();if(!d)return;const old=document.getElementById('v24TMIntel');if(old)old.remove();const box=el('section','panel v24Panel','<p class="eyebrow">🕰️ V2.4 TIME MACHINE</p><h2>Period Intelligence</h2><div id="v24TMPeriod" class="v24TMPeriod"><p class="meta">Choose two dates and press Compare A → B.</p></div>');box.id='v24TMIntel';insertAfter(root,box);
    const run=()=>{const a=document.getElementById('dateA')?.value,b=document.getElementById('dateB')?.value;if(!a||!b||a===b)return;const A=new Date(a+'T23:59:59').getTime(),B=new Date(b+'T23:59:59').getTime(),lo=Math.min(A,B),hi=Math.max(A,B);const periodR=d.R.filter(r=>{const t=new Date(r.created_at).getTime();return t>lo&&t<=hi});const periodP=new Set(periodR.map(r=>r.player_id));const newPlayers=d.P.filter(p=>{const t=new Date(p.created_at).getTime();return t>lo&&t<=hi});const newLevels=d.L.filter(l=>{const t=new Date(l.created_at).getTime();return t>lo&&t<=hi});const ph=d.H.filter(h=>{const t=new Date(h.recorded_at).getTime();return t>lo&&t<=hi&&String(h.note||'').toLowerCase().includes('->')});const points=periodR.reduce((s,r)=>s+rankPoints(d.L.find(l=>l.id===r.level_id)?.rank||101,d.PV),0);const pointChanges=ph.reduce((s,h)=>{const m=String(h.note||'').match(/#(\d+)\s*->\s*(?:main|extended|legacy)?\s*#(\d+)/i);return s+(m?rankPoints(Number(m[2]),d.PV)-rankPoints(Number(m[1]),d.PV):0)},0);const current=d.R.reduce((m,r)=>(m[r.player_id]=(m[r.player_id]||0)+rankPoints(d.L.find(l=>l.id===r.level_id)?.rank||101,d.PV),m),{});box.querySelector('#v24TMPeriod').innerHTML=`<div class="v24TMGrid"><div><b>${periodR.length}</b><span>victories</span></div><div><b>${ph.length}</b><span>rank changes</span></div><div><b>${newLevels.length}</b><span>new levels</span></div><div><b>${newPlayers.length}</b><span>new players</span></div><div><b>${points}</b><span>points earned</span></div><div><b>${pointChanges>=0?'+':''}${pointChanges}</b><span>point change from moves</span></div></div><h3>Victories during period</h3>${periodR.slice().reverse().slice(0,30).map(r=>`<a class="adminRow row between" href="player.html?id=${r.player_id}"><span>🏆 ${esc(d.P.find(p=>p.id===r.player_id)?.name||'Player')} · ${esc(d.L.find(l=>l.id===r.level_id)?.name||'Level')}</span><span class="meta">${date(r.created_at)}</span></a>`).join('')||'<p class="meta">No victories during this period.</p>'}`};
    const c=document.getElementById('compare');if(c)c.addEventListener('click',run);const va=document.getElementById('viewA');if(va)va.addEventListener('click',()=>setTimeout(run,50));
  }

  async function enhanceEras(){
    const root=document.getElementById('eras');if(!root||!sb)return;const d=await data();if(!d)return;const days={};d.R.forEach(r=>{const k=new Date(r.created_at).toISOString().slice(0,10);(days[k]??=[]).push(r)});const keys=Object.keys(days).sort();const eras=[];for(let i=0;i<keys.length;i+=7){const ks=keys.slice(i,i+7),rs=ks.flatMap(k=>days[k]);if(!rs.length)continue;const by={};rs.forEach(r=>by[r.player_id]=(by[r.player_id]||0)+1);const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];const p=d.P.find(x=>x.id===top?.[0]);const points=rs.reduce((s,r)=>s+rankPoints(d.L.find(l=>l.id===r.level_id)?.rank||101,d.PV),0),top1=rs.filter(r=>d.L.find(l=>l.id===r.level_id)?.rank===1).length;eras.push({start:ks[0],end:ks.at(-1),wins:rs.length,p,points,top1});}
    eras.sort((a,b)=>new Date(b.start)-new Date(a.start));root.innerHTML=eras.slice(0,24).map((e,i)=>`<article class="eraItem v24EraItem"><div class="eraDot">${i+1}</div><div><div class="eyebrow">${e.p?'👑 THE '+esc(e.p.name).toUpperCase()+' ERA':'💀 THE DIDDY ERA'} · ${date(e.start)} → ${date(e.end)}</div><h2>${e.p?esc(e.p.name):'DIDDY'} DOMINATED</h2><p class="meta">${e.wins} victories · ${e.points} points earned · ${e.top1} #1-level victories</p></div></article>`).join('')||'<p class="meta">No era-defining activity yet.</p>';
  }

  async function enhancePowerPage(){
    const root=document.getElementById('powerRankings');
    if(!root||!sb)return;
    const d=await data();
    if(!d)return;
    const rows=d.P.map(p=>{
      const wins=d.R.filter(r=>r.player_id===p.id);
      const recent=wins.filter(r=>Date.now()-new Date(r.created_at).getTime()<=7*DAY);
      const recent3=wins.filter(r=>Date.now()-new Date(r.created_at).getTime()<=3*DAY);
      const previous3=wins.filter(r=>{const age=Date.now()-new Date(r.created_at).getTime();return age>3*DAY&&age<=6*DAY});
      const ranks=recent.map(r=>d.L.find(l=>l.id===r.level_id)?.rank||101);
      const hard=ranks.length?Math.min(...ranks):101;
      const earned=recent.reduce((sum,r)=>sum+rankPoints(d.L.find(l=>l.id===r.level_id)?.rank||101,d.PV),0);
      const score=Math.max(0,Math.min(100,Math.round(recent.length*7+recent3.length*6+earned*.35+Math.max(0,101-hard)*.45+(recent3.length-previous3.length)*4)));
      return {p,recent,score,hard,earned,activity:recent.length,momentum:recent3.length-previous3.length};
    }).filter(x=>d.R.some(r=>r.player_id===x.p.id)).sort((a,b)=>b.score-a.score||b.activity-a.activity);
    root.innerHTML='';
    const intro=el('section','v24PowerIntro');
    intro.innerHTML='<p class="eyebrow">📊 CURRENT FORM · NOT OFFICIAL LEADERBOARD</p><h2>Power Rankings</h2><p class="meta">A daily-style form ranking based on recent victories, difficulty, points, momentum and activity. It can differ from the official points leaderboard.</p>';
    root.appendChild(intro);
    rows.slice(0,25).forEach((x,i)=>{
      const a=el('a','v24PowerRow');
      a.href='player.html?id='+encodeURIComponent(x.p.id);
      a.innerHTML='<div class="v24PowerRank">#'+(i+1)+'</div><div class="v24PowerMain"><b>'+esc(x.p.name)+'</b><div class="v24PowerBar"><i style="width:'+x.score+'%"></i></div><small>'+x.activity+' wins · hardest recent #'+x.hard+' · '+x.earned+' pts · '+(x.momentum>=0?'+':'')+x.momentum+' momentum</small></div><strong>'+x.score+'</strong>';
      root.appendChild(a);
    });
    if(!rows.length)root.insertAdjacentHTML('beforeend','<p class="meta">No player activity yet.</p>');
  }

  async function run(){
    try{
      await enhancePlayer();await enhanceLevel();await enhanceFeed();await enhanceSearch();await enhanceRecords();await enhanceTimeMachine();await enhanceEras();await enhancePowerPage();
    }catch(e){console.warn('V2.4 enhancement skipped:',e)}
  }
  run();
})();

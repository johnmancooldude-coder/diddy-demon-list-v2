(function(){
  'use strict';
  const cfg=window.DIDDY_CONFIG||{};
  const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
  const DAY=86400000;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString():'—'};
  const ago=(ms)=>{if(ms<60000)return 'just now';if(ms<3600000)return Math.floor(ms/60000)+'m ago';if(ms<DAY)return Math.floor(ms/3600000)+'h ago';return Math.floor(ms/DAY)+'d ago'};
  const points=(rank,PV)=>Number(PV.find(v=>Number(v.rank)===Number(rank))?.points||Math.max(1,Math.round(100-99*Math.pow((Math.max(1,Number(rank))-1)/99,.62))));
  const make=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n};
  let cache;
  async function data(){
    if(cache)return cache;
    if(!sb)return null;
    cache=Promise.all([
      sb.from('players').select('*'),
      sb.from('levels').select('*').order('section').order('rank'),
      sb.from('records').select('*').order('created_at',{ascending:true}),
      sb.from('placement_history').select('*').order('recorded_at',{ascending:true}),
      sb.from('point_values').select('*')
    ]).then(q=>q.some(x=>x.error)?null:{P:q[0].data||[],L:q[1].data||[],R:q[2].data||[],H:q[3].data||[],PV:q[4].data||[]}).catch(()=>null);
    return cache;
  }
  function maps(d){return {P:Object.fromEntries(d.P.map(x=>[x.id,x])),L:Object.fromEntries(d.L.map(x=>[x.id,x]))};}
  function rankAt(d,lid,when){
    const hist=d.H.filter(h=>h.level_id===lid&&new Date(h.recorded_at).getTime()<=when).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at))[0];
    return hist&&Number.isFinite(Number(hist.rank))?Number(hist.rank):Number(maps(d).L[lid]?.rank||101);
  }
  function enriched(d){
    const m=maps(d);
    return d.R.map(r=>({...r,p:m.P[r.player_id],l:m.L[r.level_id]})).filter(r=>r.p&&r.l);
  }
  function mount(root,id,node){const old=document.getElementById(id);if(old)old.remove();node.id=id;root.appendChild(node);return node;}
  function playerWins(rs,pid){return rs.filter(r=>r.player_id===pid).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));}
  function currentOfficialRank(d,pid){
    const totals={};d.P.forEach(p=>totals[p.id]=0);
    d.R.forEach(r=>{if(!r.player_id)return;const l=d.L.find(x=>x.id===r.level_id);totals[r.player_id]=(totals[r.player_id]||0)+points(l?.rank||101,d.PV)});
    const board=Object.entries(totals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const i=board.findIndex(x=>x[0]===pid);return i<0?null:i+1;
  }
  function windowScore(d,pid,fromDays,toDays){
    const now=Date.now(),rs=playerWins(enriched(d),pid).filter(r=>{const age=now-new Date(r.created_at).getTime();return age>fromDays*DAY&&age<=toDays*DAY});
    if(!rs.length)return 0;
    const earned=rs.reduce((s,r)=>s+points(r.l.rank,d.PV),0),hard=Math.min(...rs.map(r=>Number(r.l.rank)||101));
    return Math.max(0,Math.min(100,Math.round(rs.length*8+earned*.42+Math.max(0,101-hard)*.32)));
  }
  function formScore(d,pid,days){
    const now=Date.now(),rs=playerWins(enriched(d),pid),recent=rs.filter(r=>now-new Date(r.created_at).getTime()<=days*DAY),prev=rs.filter(r=>{const age=now-new Date(r.created_at).getTime();return age>days*DAY&&age<=days*2*DAY});
    const earned=recent.reduce((s,r)=>s+points(r.l.rank,d.PV),0),hard=recent.length?Math.min(...recent.map(r=>Number(r.l.rank)||101)):101;
    return Math.max(0,Math.min(100,Math.round(recent.length*8+earned*.42+Math.max(0,101-hard)*.32+(recent.length-prev.length)*5)));
  }
  function heatForLevel(d,lid){
    const now=Date.now(),rs=enriched(d).filter(r=>r.level_id===lid),r3=rs.filter(r=>now-new Date(r.created_at).getTime()<=3*DAY).length,r6=rs.filter(r=>{const age=now-new Date(r.created_at).getTime();return age>3*DAY&&age<=6*DAY}).length;
    const h=d.H.filter(x=>x.level_id===lid).slice().sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));
    let move=0;if(h.length>1)move=Math.abs(Number(h[0].rank)-Number(h[1].rank));
    const score=Math.max(0,Math.min(100,r3*14+Math.max(0,r3-r6)*8+move*3));
    const label=score>=80?'🔥 BURNING':score>=55?'🟠 HOT':score>=30?'🟡 WARM':score>=10?'⚪ COOL':'❄️ DEAD';
    return {score,label,recent:r3};
  }
  function addHomeIntelligence(d){
    const root=document.getElementById('homeStats')||document.getElementById('liveFeed');if(!root)return;
    const rs=enriched(d),now=Date.now(),recent=rs.filter(r=>now-new Date(r.created_at).getTime()<=DAY),prev=rs.filter(r=>{const age=now-new Date(r.created_at).getTime();return age>DAY&&age<=2*DAY});
    const byP={};recent.forEach(r=>byP[r.player_id]=(byP[r.player_id]||0)+1);const hotP=Object.entries(byP).sort((a,b)=>b[1]-a[1])[0];
    const byL={};rs.filter(r=>now-new Date(r.created_at).getTime()<=3*DAY).forEach(r=>byL[r.level_id]=(byL[r.level_id]||0)+1);const hotL=Object.entries(byL).sort((a,b)=>b[1]-a[1])[0];
    const moves=d.H.filter(h=>now-new Date(h.recorded_at).getTime()<=DAY&&String(h.note||'').includes('->')).length;
    const recPoints=recent.reduce((s,r)=>s+points(r.l.rank,d.PV),0);
    const intel=make('section','panel v242Intel',`<p class="eyebrow">🧠 DIDDY INTELLIGENCE</p><h2>What the list is saying right now</h2><div class="v242IntelGrid">
      <div><span>24H VICTORIES</span><b>${recent.length}</b><small>${recent.length>=prev.length?'activity is up':'activity is cooling'} vs previous 24h</small></div>
      <div><span>24H POINTS</span><b>${recPoints}</b><small>${moves} placement event${moves===1?'':'s'} detected</small></div>
      <div><span>HOTTEST PLAYER</span><b>${hotP?esc(d.P.find(p=>p.id===hotP[0])?.name||'Player'):'—'}</b><small>${hotP?hotP[1]+' victory'+(hotP[1]===1?'':'ies')+' in 24h':'No recent victories'}</small></div>
      <div><span>HOTTEST LEVEL</span><b>${hotL?esc(d.L.find(l=>l.id===hotL[0])?.name||'Level'):'—'}</b><small>${hotL?hotL[1]+' victories in 3 days':'No recent activity'}</small></div>
    </div>`);
    mount(document.querySelector('main.wrap')||root,'v242HomeIntel',intel);
    const list=d.L.filter(l=>l.section!=='legacy').map(l=>({...l,heat:heatForLevel(d,l.id)})).filter(x=>x.heat.score>0).sort((a,b)=>b.heat.score-a.heat.score).slice(0,8);
    const panel=make('section','panel v242Heat',`<div class="panelHead"><div><p class="eyebrow">🔥 LEVEL HEAT</p><h2>What's hot right now</h2></div><a class="btn secondary" href="search.html?q=hot:levels">Search hot levels →</a></div><div class="v242HeatGrid">${list.map(l=>`<a href="level.html?id=${l.id}" class="v242HeatCard"><div><span class="tag">${l.heat.label}</span><b>#${l.rank} · ${esc(l.name)}</b><small>${l.heat.recent} victories · heat ${l.heat.score}/100</small></div><strong>${l.heat.score}</strong></a>`).join('')||'<p class="meta">No recent heat yet.</p>'}</div>`);
    mount(document.querySelector('main.wrap')||root,'v242HeatHome',panel);
  }
  function enhancePower(d){
    const root=document.getElementById('powerRankings');if(!root)return;
    const current=d.P.map(p=>({p,score:windowScore(d,p.id,0,3)})).filter(x=>d.R.some(r=>r.player_id===x.p.id)).sort((a,b)=>b.score-a.score||a.p.name.localeCompare(b.p.name));
    const previous=d.P.map(p=>({id:p.id,score:windowScore(d,p.id,3,6)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const prevPos=Object.fromEntries(previous.map((x,i)=>[x.id,i+1]));
    root.innerHTML=`<div class="v242PowerLegend"><p class="eyebrow">🧠 POWER RANKINGS 2.0</p><h2>Current-form intelligence</h2><p class="meta">Updated from the last 3 days. Previous position compares the prior 3-day window. This is separate from official points.</p><div class="chips"><span class="tag">3D FORM</span><span class="tag">DIFFICULTY</span><span class="tag">ACTIVITY</span><span class="tag">MOMENTUM</span></div></div>`;
    current.slice(0,25).forEach((x,i)=>{const pos=i+1,prev=prevPos[x.p.id]||null,delta=prev?prev-pos:0,arrow=delta>0?'▲':delta<0?'▼':'•',recent=playerWins(enriched(d),x.p.id).filter(r=>Date.now()-new Date(r.created_at).getTime()<=3*DAY),earned=recent.reduce((s,r)=>s+points(r.l.rank,d.PV),0),hard=recent.length?Math.min(...recent.map(r=>Number(r.l.rank)||101)):101;const a=make('a','v242PowerRow');a.href='player.html?id='+encodeURIComponent(x.p.id);a.innerHTML=`<div class="v242PowerRank">#${pos}<small>${prev?' '+arrow+' '+Math.abs(delta):' NEW'}</small></div><div class="v242PowerMain"><b>${esc(x.p.name)}</b><div class="v242Bar"><i style="width:${x.score}%"></i></div><small>Power ${x.score}/100 · official ${currentOfficialRank(d,x.p.id)?'#'+currentOfficialRank(d,x.p.id):'—'} · ${recent.length} wins · hardest #${hard} · ${earned} pts</small></div><strong>${x.score}</strong>`;root.appendChild(a);});
  }
  function enhanceFeed(){
    const root=document.getElementById('news');if(!root)return;
    const old=root.parentElement?.querySelector('.v242FeedTools');if(old)old.remove();
    const tools=make('section','panel v242FeedTools','<p class="eyebrow">📰 DIDDY FEED 4.1</p><div class="chips"><button class="tag active" data-feed-filter="all">ALL</button><button class="tag" data-feed-filter="victory">VICTORIES</button><button class="tag" data-feed-filter="placement">RANKS</button><button class="tag" data-feed-filter="player">PLAYERS</button><button class="tag" data-feed-filter="level">LEVELS</button><button class="tag" data-feed-filter="record">RECORDS</button></div>');
    root.parentElement.insertBefore(tools,root);
    const apply=kind=>{root.querySelectorAll('.newsCard').forEach(card=>{const text=card.innerText.toLowerCase();let show=kind==='all';if(kind==='victory')show=text.includes('victory')||text.includes('conquer');if(kind==='placement')show=text.includes('placement')||text.includes('moved')||text.includes('rank');if(kind==='player')show=text.includes('player');if(kind==='level')show=text.includes('level')||text.includes('#');if(kind==='record')show=text.includes('record');card.style.display=show?'':'none'});tools.querySelectorAll('[data-feed-filter]').forEach(b=>b.classList.toggle('active',b.dataset.feedFilter===kind));};
    tools.querySelectorAll('[data-feed-filter]').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.feedFilter)));setTimeout(()=>apply('all'),200);
  }
  function enhanceSearch(d){
    const q=document.getElementById('q'),out=document.getElementById('searchResults');if(!q||!out)return;
    const tools=make('section','panel v242SearchGuide','<p class="eyebrow">🔎 SEARCH 5.5</p><h2>Query the DIDDY database</h2><p class="meta">Combine filters like <code>player:riot victories:10+</code> or <code>rank:1-10 difficulty:biblical</code>.</p><div class="chips"><button data-smart="player:riot">player:riot</button><button data-smart="rank:1-10">rank:1-10</button><button data-smart="points:50+">points:50+</button><button data-smart="victories:3+">victories:3+</button><button data-smart="difficulty:biblical">difficulty:biblical</button><button data-smart="hot:levels">hot:levels</button><button data-smart="most_active:24h">most_active:24h</button><button data-smart="power:top10">power:top10</button></div>');
    out.parentElement.insertBefore(tools,out);
    const render=()=>{const raw=q.value.trim(),tokens=raw.toLowerCase().split(/\s+/).filter(Boolean);if(!tokens.length)return;const rs=enriched(d);let players=d.P.slice(),levels=d.L.slice();
      tokens.forEach(t=>{let m=t.match(/^player:(.+)$/);if(m){const s=m[1];players=players.filter(p=>p.name.toLowerCase().includes(s))}m=t.match(/^level:(.+)$/);if(m){const s=m[1];levels=levels.filter(l=>l.name.toLowerCase().includes(s))}m=t.match(/^creator:(.+)$/);if(m){const s=m[1];levels=levels.filter(l=>String(l.creator||'').toLowerCase().includes(s))}m=t.match(/^rank:(\d+)-(\d+)$/);if(m){const a=+m[1],b=+m[2];levels=levels.filter(l=>+l.rank>=a&&+l.rank<=b)}m=t.match(/^rank:(\d+)$/);if(m){levels=levels.filter(l=>+l.rank===+m[1])}m=t.match(/^points:(\d+)\+$/);if(m){const n=+m[1];players=players.filter(p=>{const total=rs.filter(r=>r.player_id===p.id).reduce((s,r)=>s+points(r.l.rank,d.PV),0);return total>=n})}m=t.match(/^victories:(\d+)\+$/);if(m){const n=+m[1];players=players.filter(p=>rs.filter(r=>r.player_id===p.id).length>=n)}m=t.match(/^difficulty:(.+)$/);if(m){const s=m[1];levels=levels.filter(l=>String(l.difficulty||'').toLowerCase().includes(s))}});
      if(tokens.some(t=>t==='hot:levels'))levels=levels.map(l=>({...l,h:heatForLevel(d,l.id)})).filter(l=>l.h.score>0).sort((a,b)=>b.h.score-a.h.score);
      if(tokens.some(t=>t==='most_active:24h'))players=players.map(p=>({...p,n:rs.filter(r=>r.player_id===p.id&&Date.now()-new Date(r.created_at).getTime()<=DAY).length})).filter(p=>p.n>0).sort((a,b)=>b.n-a.n);
      if(tokens.some(t=>t==='power:top10'))players=players.map(p=>({...p,s:formScore(d,p.id,3)})).filter(p=>p.s>0).sort((a,b)=>b.s-a.s).slice(0,10);
      const html=[...players.slice(0,30).map(p=>`<a class="adminRow row between" href="player.html?id=${p.id}"><span><b>👤 ${esc(p.name)}</b><span class="meta"> player${p.n!=null?' · '+p.n+' wins 24h':''}${p.s!=null?' · power '+p.s:''}</span></span><span>View →</span></a>`),...levels.slice(0,50).map(l=>`<a class="adminRow row between" href="level.html?id=${l.id}"><span><b>#${l.rank} · ${esc(l.name)}</b><span class="meta"> ${esc(l.creator||'')}${l.h?' · '+l.h.label+' '+l.h.score:''}</span></span><span>View →</span></a>`)].join('');out.innerHTML=html||'<div class="panel">No matches.</div>';};
    q.oninput=render;tools.querySelectorAll('[data-smart]').forEach(b=>b.addEventListener('click',()=>{q.value=b.dataset.smart;render()}));if(q.value)render();
  }
  function enhanceAchievements(d){
    const root=document.getElementById('achievements');if(!root)return;const rs=enriched(d),rows=d.P.map(p=>({p,wins:rs.filter(r=>r.player_id===p.id)}));
    const trophy=make('section','panel v242Trophies','<p class="eyebrow">🏆 ACHIEVEMENT SHOWCASE 3.5</p><h2>Career Trophy Cabinet</h2><p class="meta">Players unlock these automatically from live records.</p><div class="v242TrophyGrid"></div>');
    const grid=trophy.querySelector('.v242TrophyGrid');const defs=[['🩸','FIRST BLOOD','1st recorded victory',x=>x.wins.length>=1],['💀','DEMON SLAYER','10 victories',x=>x.wins.length>=10],['👑','KING OF THE LIST','Beat a #1 level',x=>x.wins.some(r=>r.l.rank===1)],['🔥','MOMENTUM MONSTER','90+ current form',x=>formScore(d,x.p.id,3)>=90],['☢️','NUCLEAR','50 victories',x=>x.wins.length>=50],['💯','CENTURY','1,000 career points',x=>x.wins.reduce((s,r)=>s+points(r.l.rank,d.PV),0)>=1000]];
    defs.forEach(([icon,name,desc,fn])=>{const w=rows.filter(fn);const card=make('div','v242Trophy');card.innerHTML=`<span>${icon}</span><b>${name}</b><small>${desc}</small><strong>${w.length} unlocked</strong><div class="chips">${w.slice(0,8).map(x=>`<a class="tag" href="player.html?id=${x.p.id}">${esc(x.p.name)}</a>`).join('')||'<span class="meta">Nobody yet</span>'}</div>`;grid.appendChild(card)});
    root.appendChild(trophy);
  }
  function enhanceBattles(d){
    const btn=document.getElementById('battle'),out=document.getElementById('battleOut');if(!btn||!out)return;
    const old=out.parentElement?.querySelector('.v242BattleIntel');if(old)old.remove();
    btn.addEventListener('click',()=>{setTimeout(()=>{const a=document.getElementById('a')?.value,b=document.getElementById('b')?.value;if(!a||!b||a===b)return;const sa=formScore(d,a,3),sb2=formScore(d,b,3),A=d.P.find(x=>x.id===a),B=d.P.find(x=>x.id===b),rs=enriched(d);const metrics=[['Peak',Math.max(0,100-Math.min(100,(Math.min(...playerWins(rs,a).map(r=>r.l.rank),101)-1)*1.1)),Math.max(0,100-Math.min(100,(Math.min(...playerWins(rs,b).map(r=>r.l.rank),101)-1)*1.1))],['Grind',Math.min(100,playerWins(rs,a).reduce((s,r)=>s+(Number(r.attempts)||0),0)/Math.max(1,playerWins(rs,a).length)/150),Math.min(100,playerWins(rs,b).reduce((s,r)=>s+(Number(r.attempts)||0),0)/Math.max(1,playerWins(rs,b).length)/150)],['Depth',Math.min(100,playerWins(rs,a).filter(r=>r.l.rank<=50).length*4),Math.min(100,playerWins(rs,b).filter(r=>r.l.rank<=50).length*4)],['Consistency',Math.max(0,100-Math.abs(formScore(d,a,3)-formScore(d,a,6))),Math.max(0,100-Math.abs(formScore(d,b,3)-formScore(d,b,6)))],['Speed',avgSpeed(playerWins(rs,a)),avgSpeed(playerWins(rs,b))],['Momentum',sa,sb2]];function avgSpeed(w){const x=w.filter(r=>Number(r.completion_seconds)>0).map(r=>Number(r.completion_seconds));return x.length?Math.min(100,Math.round(100000/(1000+x.reduce((u,v)=>u+v,0)/x.length))):0}let aw=0,bw=0;metrics.forEach(m=>{if(m[1]>m[2])aw++;else if(m[2]>m[1])bw++});const panel=make('section','panel v242BattleIntel',`<p class="eyebrow">⚔️ BATTLE INTELLIGENCE 6.0</p><h2>Why ${esc(A?.name||'Player A')} vs ${esc(B?.name||'Player B')}?</h2><div class="v242BattleTable">${metrics.map(m=>`<div><span>${m[0]}</span><b>${m[1].toFixed(1)}</b><strong>${m[2].toFixed(1)}</strong><small>${m[1]>m[2]?esc(A.name)+' wins':m[2]>m[1]?esc(B.name)+' wins':'Draw'}</small></div>`).join('')}</div><div class="challengeBox"><h2>${aw>bw?'🏆 '+esc(A.name)+' dominates':bw>aw?'🏆 '+esc(B.name)+' dominates':'🤝 Dead even'}</h2><p>${aw} — ${bw} category wins</p></div>`);out.parentElement.appendChild(panel);},100)});
  }
  function enhanceTimeMachine(d){
    const out=document.getElementById('tmOut');if(!out)return;const box=make('section','panel v242Playback','<p class="eyebrow">▶️ TIME MACHINE 4.5</p><h2>History Playback</h2><p class="meta">Step through recorded list events between your selected dates.</p><div class="row"><input id="v242PlaySpeed" type="range" min="300" max="1500" step="100" value="700"><button id="v242Play" class="primary">▶️ Play period</button><button id="v242Stop" class="secondary">⏹ Stop</button></div><div id="v242PlaybackOut" class="v242PlaybackOut"></div>');out.parentElement.appendChild(box);let timer=null;const stop=()=>{if(timer)clearInterval(timer);timer=null};document.getElementById('v242Stop').onclick=stop;document.getElementById('v242Play').onclick=()=>{stop();const a=document.getElementById('dateA')?.value,b=document.getElementById('dateB')?.value;if(!a||!b)return;const lo=Math.min(new Date(a+'T00:00:00').getTime(),new Date(b+'T23:59:59').getTime()),hi=Math.max(new Date(a+'T00:00:00').getTime(),new Date(b+'T23:59:59').getTime());const events=[...d.R.map(r=>({t:new Date(r.created_at).getTime(),html:`🏆 <b>${esc(d.P.find(p=>p.id===r.player_id)?.name||'Player')}</b> conquered <b>${esc(d.L.find(l=>l.id===r.level_id)?.name||'Level')}</b>`})),...d.H.map(h=>({t:new Date(h.recorded_at).getTime(),html:`📈 <b>${esc(d.L.find(l=>l.id===h.level_id)?.name||'Level')}</b> · ${esc(h.note||'placement update')}`}))].filter(e=>e.t>=lo&&e.t<=hi).sort((x,y)=>x.t-y.t);let i=0;const target=document.getElementById('v242PlaybackOut');target.innerHTML='';if(!events.length){target.innerHTML='<p class="meta">No recorded events in this period.</p>';return}const speed=()=>Number(document.getElementById('v242PlaySpeed')?.value||700);const tick=()=>{if(i>=events.length){stop();return}const e=events[i++],row=make('div','v242PlaybackEvent',`<time>${fmtDate(e.t)} · ${ago(Date.now()-e.t)}</time><span>${e.html}</span>`);target.appendChild(row);row.scrollIntoView({behavior:'smooth',block:'nearest'});if(timer){clearInterval(timer);timer=setInterval(tick,speed())}};timer=setInterval(tick,speed());tick()};
  }
  function enhanceEras(d){
    const root=document.getElementById('eras');if(!root)return;const rs=enriched(d),days={};rs.forEach(r=>{const k=new Date(r.created_at).toISOString().slice(0,10);(days[k]??=[]).push(r)});const keys=Object.keys(days).sort(),blocks=[];for(let i=0;i<keys.length;i+=7){const ks=keys.slice(i,i+7),x=ks.flatMap(k=>days[k]);if(!x.length)continue;const by={};x.forEach(r=>by[r.player_id]=(by[r.player_id]||0)+1);const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0],p=d.P.find(q=>q.id===top?.[0]);const eraPoints=x.reduce((sum,r)=>sum+points(r.l.rank,d.PV),0);blocks.push({start:ks[0],end:ks.at(-1),wins:x.length,p,points:eraPoints,top1:x.filter(r=>r.l.rank===1).length})}
    const old=document.getElementById('v242EraIntel');if(old)old.remove();const node=make('section','panel v242EraIntel',`<p class="eyebrow">📜 DIDDY ERAS 3.0</p><h2>Named eras & lore</h2><div class="v242EraGrid">${blocks.slice().reverse().slice(0,18).map((e,i)=>`<article class="v242Era"><span class="tag">${e.p?'👑 THE '+esc(e.p.name).toUpperCase()+' ERA':'💀 THE DIDDY ERA'}</span><h3>${i===0?'THE CURRENT CHAPTER':e.p?esc(e.p.name)+' DOMINATED':'DIDDY HISTORY'}</h3><p class="meta">${fmtDate(e.start)} → ${fmtDate(e.end)} · ${e.wins} victories · ${e.points} points · ${e.top1} #1-level wins</p></article>`).join('')||'<p class="meta">No eras yet.</p>'}</div>`);root.parentElement.appendChild(node);
  }

  function addRecordAlerts(d){
    const root=document.getElementById('recordAlerts');if(!root)return;
    const rs=enriched(d),now=Date.now(),alerts=[],sorted=rs.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    let maxWins=0,maxAtt=0,bestRank=101,bestSpeed=Infinity;
    const winsBy={};
    sorted.forEach(r=>{
      const t=new Date(r.created_at).getTime(),recent=now-t<=7*DAY,pid=r.player_id,name=r.p?.name||'Player',lname=r.l?.name||'Level',rank=Number(r.l?.rank)||101,att=Number(r.attempts)||0,sec=Number(r.completion_seconds)||0;
      winsBy[pid]=(winsBy[pid]||0)+1;
      const total=winsBy[pid];
      if(recent&&total>maxWins)alerts.push({t,title:'🏆 NEW MOST-VICTORIES MILESTONE',body:`${name} reached ${total} recorded victories.`,value:total});
      if(recent&&att>0&&att>maxAtt)alerts.push({t,title:'💀 NEW MOST-ATTEMPTS RECORD',body:`${name} logged ${att.toLocaleString()} attempts on ${lname}.`,value:att.toLocaleString()});
      if(recent&&sec>0&&sec<bestSpeed)alerts.push({t,title:'⚡ NEW FASTEST COMPLETION',body:`${name} completed ${lname} in ${sec.toFixed(1)}s.`,value:sec.toFixed(1)+'s'});
      if(recent&&rank<bestRank)alerts.push({t,title:'👑 NEW HARDEST VICTORY',body:`${name} conquered ${lname} at #${rank}.`,value:'#'+rank});
      maxWins=Math.max(maxWins,total);maxAtt=Math.max(maxAtt,att);bestRank=Math.min(bestRank,rank);if(sec>0)bestSpeed=Math.min(bestSpeed,sec);
    });
    const last24=rs.filter(r=>now-new Date(r.created_at).getTime()<=DAY),by24={};last24.forEach(r=>by24[r.player_id]=(by24[r.player_id]||0)+1);const max24=Math.max(0,...Object.values(by24));if(max24>=2){const pid=Object.keys(by24).find(k=>by24[k]===max24);alerts.unshift({t:now,title:'🔥 24H VICTORY RECORD',body:`${d.P.find(p=>p.id===pid)?.name||'Player'} has ${max24} victories in the last 24 hours.`,value:max24});}
    const unique=[],seen=new Set();alerts.sort((x,y)=>y.t-x.t).forEach(a=>{const k=a.title+'|'+a.body;if(!seen.has(k)){seen.add(k);unique.push(a)}});
    root.innerHTML=unique.slice(0,8).map(a=>`<div class="v242RecordAlert"><div><b>${a.title}</b><small>${esc(a.body)} · ${fmtDate(a.t)}</small></div><strong>${a.value}</strong></div>`).join('')||'<p class="meta">No recent record alerts.</p>';
  }
  function enhancePlayerMomentum(d){
    const root=document.getElementById('playerPage');if(!root)return;const id=new URLSearchParams(location.search).get('id');if(!id)return;const rs=playerWins(enriched(d),id);if(!rs.length)return;
    const now=new Date();now.setHours(0,0,0,0);const vals=[];for(let i=29;i>=0;i--){const day=new Date(now);day.setDate(day.getDate()-i);const lo=day.getTime(),hi=lo+DAY;const wins=rs.filter(r=>{const t=new Date(r.created_at).getTime();return t>=lo&&t<hi}).length;vals.push(wins)}
    const max=Math.max(1,...vals);const node=make('section','panel v242Panel',`<p class="eyebrow">📈 MOMENTUM</p><h2>30-Day Player Momentum</h2><p class="meta">Victory activity by calendar day. Taller bars mean more activity.</p><div class="v242Momentum">${vals.map((v,i)=>`<i title="${v} victory${v===1?'':'ies'}" style="height:${Math.max(5,Math.round(v/max*100))}%"></i>`).join('')}</div><div class="row between"><span class="meta">${vals.reduce((a,b)=>a+b,0)} victories in 30 days</span><b>${vals.slice(-7).reduce((a,b)=>a+b,0)} in 7 days</b></div>`);mount(root,'v242PlayerMomentum',node);
  }
  async function run(){try{const active=['homeStats','recordAlerts','powerRankings','news','q','achievements','playerPage','battle','tmOut','eras'].some(id=>document.getElementById(id));if(!active)return;const d=await data();if(!d)return;addHomeIntelligence(d);addRecordAlerts(d);enhancePower(d);enhanceFeed();enhanceSearch(d);enhanceAchievements(d);enhancePlayerMomentum(d);enhanceBattles(d);enhanceTimeMachine(d);enhanceEras(d);}catch(e){console.warn('V2.4.2 enhancements skipped:',e)}}
  run();
})();

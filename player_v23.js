(function(){
 const cfg=window.DIDDY_CONFIG||{};
 const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
 const id=new URLSearchParams(location.search).get('id');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pts=r=>Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62)));
 async function boot(){
  const mount=document.getElementById('playerV23'); if(!mount||!sb||!id)return;
  const [rq,lq,pq]=await Promise.all([
   sb.from('records').select('player_id,level_id,created_at,attempts,completion_seconds').eq('player_id',id).order('created_at'),
   sb.from('levels').select('id,rank,name,difficulty'),
   sb.from('placement_history').select('*').order('recorded_at').limit(2000)
  ]);
  if(rq.error||lq.error)return;
  const R=rq.data||[], L=Object.fromEntries((lq.data||[]).map(x=>[x.id,x]));
  if(!R.length){mount.innerHTML='<section class="panel"><p class="eyebrow">V2.3 CAREER INTEL</p><h2>Career Highlights</h2><p class="meta">No recorded victories yet.</p></section>';return;}
  const wins=R.map(r=>({...r,level:L[r.level_id]})).filter(r=>r.level);
  const hardest=wins.slice().sort((a,b)=>a.level.rank-b.level.rank)[0];
  const hardestPts=hardest?pts(hardest.level.rank):0;
  const totalPts=wins.reduce((s,r)=>s+pts(r.level.rank),0);
  const attempts=wins.map(r=>Number(r.attempts||0)).filter(Number.isFinite).filter(x=>x>0);
  const times=wins.map(r=>Number(r.completion_seconds||0)).filter(Number.isFinite).filter(x=>x>0);
  const avgAtt=attempts.length?Math.round(attempts.reduce((a,b)=>a+b,0)/attempts.length):null;
  const fastest=times.length?Math.min(...times):null;
  const streaks=[];let streak=0,prev=null;
  wins.forEach(r=>{const d=new Date(r.created_at);d.setHours(0,0,0,0);const t=d.getTime();if(prev!==null&&t-prev<=86400000*1.5)streak++;else{if(streak)streaks.push(streak);streak=1}prev=t});if(streak)streaks.push(streak);
  const bestStreak=Math.max(...streaks,0);
  const months={};wins.forEach(r=>{const d=new Date(r.created_at),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;months[k]=(months[k]||0)+1});
  const bestMonth=Object.entries(months).sort((a,b)=>b[1]-a[1])[0];
  const last=wins[wins.length-1];
  const hist=(pq.data||[]).filter(x=>x.player_id===id||x.entity_id===id);
  let biggestJump=null;
  hist.forEach(x=>{const m=String(x.note||'').match(/#(\d+)\s*->\s*(?:main|extended|legacy)?\s*#(\d+)/i);if(m){const jump=Number(m[1])-Number(m[2]);if(!biggestJump||Math.abs(jump)>Math.abs(biggestJump.jump))biggestJump={jump,from:Number(m[1]),to:Number(m[2])}}});
  mount.innerHTML=`<section class="panel v23Intel"><p class="eyebrow">🧬 V2.3 CAREER INTEL</p><h2>Career Highlights</h2><div class="v23HighlightGrid">
   <div><span>HARDEST VICTORY</span><b>${hardest?`#${hardest.level.rank}`:'—'}</b><small>${hardest?esc(hardest.level.name):'—'}</small></div>
   <div><span>VICTORY POINTS</span><b>${hardestPts.toLocaleString()}</b><small>points from hardest win</small></div>
   <div><span>BEST STREAK</span><b>${bestStreak}</b><small>consecutive active days</small></div>
   <div><span>BEST MONTH</span><b>${bestMonth?bestMonth[1]:'—'}</b><small>${bestMonth?esc(bestMonth[0]):'no monthly data'}</small></div>
   <div><span>AVG ATTEMPTS</span><b>${avgAtt!=null?avgAtt.toLocaleString():'—'}</b><small>${attempts.length} recorded runs</small></div>
   <div><span>FASTEST RUN</span><b>${fastest!=null?fastest.toFixed(1)+'s':'—'}</b><small>${times.length} timed victories</small></div>
   <div><span>BIGGEST RANK JUMP</span><b>${biggestJump?`${biggestJump.jump>0?'▲':'▼'} ${Math.abs(biggestJump.jump)}`:'—'}</b><small>${biggestJump?`#${biggestJump.from} → #${biggestJump.to}`:'movement history'}</small></div>
   <div><span>CAREER VICTORIES</span><b>${wins.length}</b><small>${totalPts.toLocaleString()} victory points</small></div>
  </div><p class="meta v23Foot">Latest victory: ${last?esc(last.level.name)+' · '+new Date(last.created_at).toLocaleString():'—'}</p></section>`;
 }
 function wait(){if(document.getElementById('playerV23'))boot();else setTimeout(wait,100)}
 wait();
})();

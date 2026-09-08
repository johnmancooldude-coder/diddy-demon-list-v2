(function(){
 const cfg=window.DIDDY_CONFIG||{};
 const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
 const id=new URLSearchParams(location.search).get('id');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function boot(){
  const mount=document.getElementById('levelV23');if(!mount||!sb||!id)return;
  const [rq,hq]=await Promise.all([sb.from('records').select('player_id,created_at,attempts,completion_seconds,players(name)').eq('level_id',id).order('created_at'),sb.from('placement_history').select('*').eq('level_id',id).order('recorded_at')]);
  if(rq.error||hq.error)return;
  const R=rq.data||[],H=hq.data||[];
  const attempts=R.map(x=>Number(x.attempts||0)).filter(x=>x>0),times=R.map(x=>Number(x.completion_seconds||0)).filter(x=>x>0);
  const med=attempts.length?attempts.slice().sort((a,b)=>a-b)[Math.floor((attempts.length-1)/2)]:null;
  const now=Date.now();const recent=R.filter(x=>now-new Date(x.created_at).getTime()<=7*864e5).length;
  const prev=R.filter(x=>{const a=now-new Date(x.created_at).getTime();return a>7*864e5&&a<=14*864e5}).length;
  const first=R[0],last=R[R.length-1];
  let biggest=0,biggestFrom=null,biggestTo=null;
  H.forEach(x=>{const m=String(x.note||'').match(/#(\d+)\s*->\s*(?:main|extended|legacy)?\s*#(\d+)/i);if(m){const d=Number(m[1])-Number(m[2]);if(Math.abs(d)>Math.abs(biggest)){biggest=d;biggestFrom=Number(m[1]);biggestTo=Number(m[2])}}});
  const state=recent>=3&&recent>prev?'🔥 HOT':recent>prev?'📈 RISING':recent<prev?'📉 COOLING':recent?'⚡ STABLE':'🧊 COLD';
  mount.innerHTML=`<section class="panel v23Intel"><p class="eyebrow">🧬 V2.3 LEVEL INTEL</p><h2>Career Highlights</h2><div class="v23HighlightGrid">
   <div><span>7-DAY PULSE</span><b>${state}</b><small>${recent} wins vs ${prev} prior</small></div>
   <div><span>MEDIAN ATTEMPTS</span><b>${med!=null?med.toLocaleString():'—'}</b><small>${attempts.length} recorded runs</small></div>
   <div><span>FASTEST VICTORY</span><b>${times.length?Math.min(...times).toFixed(1)+'s':'—'}</b><small>successful completion</small></div>
   <div><span>SLOWEST VICTORY</span><b>${times.length?Math.max(...times).toFixed(1)+'s':'—'}</b><small>successful completion</small></div>
   <div><span>FIRST VICTOR</span><b>${first?esc(first.players?.name||'Player'):'—'}</b><small>${first?new Date(first.created_at).toLocaleDateString():'—'}</small></div>
   <div><span>LATEST VICTOR</span><b>${last?esc(last.players?.name||'Player'):'—'}</b><small>${last?new Date(last.created_at).toLocaleDateString():'—'}</small></div>
   <div><span>BIGGEST MOVE</span><b>${biggest?`${biggest>0?'▲':'▼'} ${Math.abs(biggest)}`:'—'}</b><small>${biggest?`#${biggestFrom} → #${biggestTo}`:'movement history'}</small></div>
   <div><span>RANK EVENTS</span><b>${H.filter(x=>String(x.note||'').includes('->')).length}</b><small>recorded placement changes</small></div>
  </div></section>`;
 }
 function wait(){if(document.getElementById('levelV23'))boot();else setTimeout(wait,100)}
 wait();
})();

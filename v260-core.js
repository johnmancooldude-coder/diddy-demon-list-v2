window.DIDDY_V260={
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 pts:r=>Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62))),
 median:a=>{const x=a.filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2},
 date:v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—'},
 dt:v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString():'—'},
 rankAt:(levelId,when,history,current)=>{const t=new Date(when).getTime();const rows=history.filter(h=>h.level_id===levelId&&new Date(h.recorded_at).getTime()<=t).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));return Number(rows[0]?.rank||current[levelId]||999)},
 buildWins:(records,levels,history)=>{const cur=Object.fromEntries(levels.map(l=>[l.id,Number(l.rank)]));return records.map(r=>{const level=levels.find(l=>l.id===r.level_id);if(!level)return null;const hRank=window.DIDDY_V260.rankAt(r.level_id,r.created_at,history,cur)||Number(level.rank);return {...r,level,hRank,currentRank:Number(level.rank),historicalPoints:window.DIDDY_V260.pts(hRank)}}).filter(Boolean)},
 top10:w=>w.filter(x=>x.hRank<=10).length,
 top3:w=>w.filter(x=>x.hRank<=3).length,
 streak:w=>{const days=[...new Set(w.map(x=>new Date(x.created_at).toISOString().slice(0,10)))].sort();if(!days.length)return{current:0,longest:0};let longest=1,run=1;for(let i=1;i<days.length;i++){const a=new Date(days[i-1]+'T00:00:00'),b=new Date(days[i]+'T00:00:00');if(Math.round((b-a)/864e5)===1)run++;else run=1;longest=Math.max(longest,run)}let current=1;for(let i=days.length-1;i>0;i--){const a=new Date(days[i-1]+'T00:00:00'),b=new Date(days[i]+'T00:00:00');if(Math.round((b-a)/864e5)===1)current++;else break}return{current,longest}},
 biggestGap:w=>{if(w.length<2)return 0;const a=w.slice().sort((x,y)=>new Date(x.created_at)-new Date(y.created_at));let best=0;for(let i=1;i<a.length;i++)best=Math.max(best,(new Date(a[i].created_at)-new Date(a[i-1].created_at))/864e5);return Math.round(best)},
 histRankEvents:(playerId,records,levels,history)=>{const wins=window.DIDDY_V260.buildWins(records.filter(r=>r.player_id===playerId),levels,history).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));let peak=999,largestClimb=0,largestFall=0;const events=wins.map((w,i)=>{const prior=i?wins[i-1].hRank:null;peak=Math.min(peak,w.hRank);if(prior!=null){largestClimb=Math.max(largestClimb,prior-w.hRank);largestFall=Math.max(largestFall,w.hRank-prior)}return{date:w.created_at,rank:w.hRank,level:w.level.name,delta:prior==null?null:prior-w.hRank}});return{wins,events,peak:peak===999?null:peak,largestClimb,largestFall}},
 achievementDefs:[
  {icon:'🏆',name:'FIRST BLOOD',desc:'Record your first list victory.',fn:w=>w.length>=1,rarity:'Common'},
  {icon:'👑',name:'KINGSLAYER',desc:'Beat a level that was #1 when you won it.',fn:w=>w.some(x=>x.hRank===1),rarity:'Legendary'},
  {icon:'🔥',name:'TOP 10',desc:'Beat a Top 10 level.',fn:w=>w.some(x=>x.hRank<=10),rarity:'Rare'},
  {icon:'💀',name:'TOP 3',desc:'Beat a Top 3 level.',fn:w=>w.some(x=>x.hRank<=3),rarity:'Epic'},
  {icon:'🗿',name:'THE GRINDER',desc:'Beat 10 list levels.',fn:w=>w.length>=10,rarity:'Uncommon'},
  {icon:'⚡',name:'SPEED DEMON',desc:'Record 3 victories within 7 days.',fn:w=>{const a=w.slice().sort((x,y)=>new Date(x.created_at)-new Date(y.created_at));for(let i=2;i<a.length;i++)if(new Date(a[i].created_at)-new Date(a[i-2].created_at)<=7*864e5)return true;return false},rarity:'Epic'},
  {icon:'📈',name:'RANK ASCENSION',desc:'Climb 10+ places between recorded victories.',fn:w=>{const h=window.DIDDY_V260.histRankEvents('',w,[],[]);return h.largestClimb>=10},rarity:'Rare'},
  {icon:'👑',name:'#1 HUNTER',desc:'Beat multiple levels that were #1 when completed.',fn:w=>w.filter(x=>x.hRank===1).length>=2,rarity:'Mythic'}
 ]
};

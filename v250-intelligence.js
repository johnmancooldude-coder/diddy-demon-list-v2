/* DIDDY DEMON LIST V2.5.0 — shared intelligence helpers */
window.DIDDY_V250={
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  pts:r=>Math.max(1,Math.round(100-99*Math.pow((Number(r)-1)/99,.62))),
  rankAt:(levelId,when,history,current)=>{const cutoff=new Date(when).getTime();const rows=(history||[]).filter(h=>h.level_id===levelId&&new Date(h.recorded_at).getTime()<=cutoff).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));return rows[0]?.rank ?? current?.[levelId] ?? null},
  playerStats:(pid,records,levels,history,points)=>{
    const current=Object.fromEntries((levels||[]).map(l=>[l.id,Number(l.rank)]));
    const wins=(records||[]).filter(r=>r.player_id===pid).map(r=>({...r,level:levels.find(l=>l.id===r.level_id)})).filter(r=>r.level);
    const rankFor=(r,at)=>DIDDY_V250.rankAt(r.level_id,at,history,current) ?? r.level.rank;
    const ranks=wins.map(r=>Number(r.level.rank));
    const histRanks=wins.map(r=>rankFor(r,r.created_at));
    const ptsAt=r=>Number(points.find(p=>Number(p.rank)===Number(r))?.points||DIDDY_V250.pts(r));
    const total=wins.reduce((s,r)=>s+ptsAt(rankFor(r,r.created_at)),0);
    const hardest=ranks.length?Math.min(...ranks):null;
    const bestWin=wins.slice().sort((a,b)=>rankFor(a,a.created_at)-rankFor(b,b.created_at))[0]||null;
    const avg=ranks.length?ranks.reduce((a,b)=>a+b,0)/ranks.length:null;
    const historyRows=(history||[]).filter(h=>h.player_id===pid);
    const peak=historyRows.length?Math.min(...historyRows.map(h=>Number(h.rank)).filter(Number.isFinite)):null;
    return {wins,ranks,histRanks,total,hardest,bestWin,avg,peak,historyRows,ptsAt};
  }
};

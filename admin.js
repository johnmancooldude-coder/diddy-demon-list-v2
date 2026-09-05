const cfg=window.DIDDY_CONFIG||{};
const sb=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let S={levels:[],players:[],records:[],points:[],settings:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function msg(t,good=true){$('auth').innerHTML=`<div class="panel ${good?'success':'error'}">${t}</div>`}
function pointsFor(level){return Number(S.points[Math.max(0,Number(level?.rank||1)-1)]||0)}
async function load(){
  const q=await Promise.all([
    sb.from('list_settings').select('*').limit(1).single(),
    sb.from('levels').select('*').order('section').order('rank'),
    sb.from('players').select('*').order('name'),
    sb.from('records').select('*,players(name)'),
    sb.from('point_values').select('*').order('rank')
  ]);
  const err=q.find(x=>x.error);
  if(err?.error){msg(`Database error: ${esc(err.error.message)}`,false);return}
  S={settings:q[0].data,levels:q[1].data||[],players:q[2].data||[],records:q[3].data||[],points:(q[4].data||[]).map(x=>x.points)};
  render();
}
function render(){
  const totalPoints=S.records.reduce((sum,r)=>sum+pointsFor(S.levels.find(l=>l.id===r.level_id)),0);
  if($('aqLevels')){$('aqLevels').textContent=S.levels.length;$('aqPlayers').textContent=S.players.length;$('aqVictories').textContent=S.records.length;$('aqPoints').textContent=totalPoints.toLocaleString();}
  $('list_name').value=S.settings?.list_name||'';$('tagline').value=S.settings?.tagline||'';
  $('pointsGrid').innerHTML=S.points.map((p,i)=>`<label class="pointInput"><span>#${i+1}</span><input data-rank="${i+1}" type="number" min="0" value="${p}"></label>`).join('');
  renderLevels();
  $('recordPlayer').innerHTML=S.players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('recordLevel').innerHTML=S.levels.map(l=>`<option value="${l.id}">#${l.rank} · ${esc(l.name)} — ${pointsFor(l)} pts</option>`).join('');
  updateRecordPoints();
  $('playerAdmin').innerHTML=S.players.map(p=>{const wins=S.records.filter(r=>r.player_id===p.id);const pts=wins.reduce((n,r)=>n+pointsFor(S.levels.find(l=>l.id===r.level_id)),0);return `<div class="adminRow row between"><span><strong>${esc(p.name)}</strong><span class="meta">${wins.length} victory${wins.length===1?'':'ies'} · ${pts} pts</span></span><button class="danger" onclick="deletePlayer('${p.id}')">Delete</button></div>`}).join('')||'<div class="meta">No players yet.</div>';
  $('recordAdmin').innerHTML=S.records.map(r=>{const l=S.levels.find(l=>l.id===r.level_id);return `<div class="adminRow row between"><span><strong>${esc(r.players?.name||'')}</strong> → #${l?.rank||'?'} ${esc(l?.name||'')} <span class="meta">· ${pointsFor(l)} pts · ${r.video_url?'video':'no video'}</span></span><button class="danger" onclick="deleteRecord('${r.id}')">Remove</button></div>`}).join('')||'<div class="meta">No victories yet.</div>';
}
function renderLevels(){
  const f=($('levelFilter').value||'').toLowerCase(),sec=$('adminSection').value;
  const a=S.levels.filter(l=>(sec==='all'||l.section===sec)&&[l.name,l.creator,l.verifier,l.holder,l.difficulty,l.status,l.aliases,l.notes].join(' ').toLowerCase().includes(f));
  $('levelEditor').innerHTML=a.map(l=>`<article class="adminRow"><div class="row between"><strong>#${l.rank} · ${esc(l.name)}</strong><div class="row"><button class="secondary" onclick="editLevel('${l.id}')">Edit</button><button class="danger" onclick="deleteLevel('${l.id}')">Delete</button></div></div><div class="meta">${esc(l.section)} · ${esc(l.creator||'')} · ${esc(l.verifier||'')} · ${esc(l.holder||'')} · ${pointsFor(l)} pts</div></article>`).join('')||'<div class="panel">No matching levels.</div>';
}
function openLevelForm(level=null){
  $('levelModalTitle').textContent=level?'Edit level':'Add new level';
  $('levelId').value=level?.id||'';
  $('levelName').value=level?.name||'';$('levelSection').value=level?.section||'main';
  $('levelRank').value=level?.rank||'';$('levelCreator').value=level?.creator||'';$('levelVerifier').value=level?.verifier||'';$('levelHolder').value=level?.holder||'';
  $('levelDescription').value=level?.description||'';$('levelVideo').value=level?.video_url||'';$('levelThumbnail').value=level?.thumbnail_url||'';
  $('levelDifficulty').value=level?.difficulty||'';$('levelStatus').value=level?.status||'';$('levelAliases').value=level?.aliases||'';$('levelNotes').value=level?.notes||'';
  $('levelModal').hidden=false;setTimeout(()=>$('levelName').focus(),0);
}
function closeLevelForm(){$('levelModal').hidden=true}
async function saveLevel(e){
  e.preventDefault();
  const id=$('levelId').value,name=$('levelName').value.trim(),section=$('levelSection').value,rank=Number($('levelRank').value);
  const verifier=$('levelVerifier').value.trim();
  if(!name||!rank||rank<1)return alert('Enter a level name and valid rank.');
  if(!verifier)return alert('Verifier is required.');
  const payload={p_section:section,p_rank:rank,p_name:name,p_creator:$('levelCreator').value.trim(),p_verifier:verifier,p_holder:$('levelHolder').value.trim(),p_description:$('levelDescription').value.trim(),p_video_url:$('levelVideo').value.trim(),p_thumbnail_url:$('levelThumbnail').value.trim()};
  const call=id?sb.rpc('move_level',{p_level_id:id,p_new_section:section,p_new_rank:rank,p_name:name,p_creator:payload.p_creator,p_verifier:payload.p_verifier,p_holder:payload.p_holder,p_description:payload.p_description,p_video_url:payload.p_video_url,p_thumbnail_url:payload.p_thumbnail_url}):sb.rpc('create_level',payload);
  const {error}=await call;if(error){alert(error.message);return}
  if(id){const {error:e2}=await sb.from('levels').update({difficulty:$('levelDifficulty').value.trim()||null,status:$('levelStatus').value.trim()||null,aliases:$('levelAliases').value.trim()||null,notes:$('levelNotes').value.trim()||null}).eq('id',id);if(e2)return alert(e2.message)}else{const {data:newLevel}=await sb.from('levels').select('id').eq('section',section).eq('rank',rank).eq('name',name).maybeSingle();if(newLevel?.id){const {error:e2}=await sb.from('levels').update({difficulty:$('levelDifficulty').value.trim()||null,status:$('levelStatus').value.trim()||null,aliases:$('levelAliases').value.trim()||null,notes:$('levelNotes').value.trim()||null}).eq('id',newLevel.id);if(e2)return alert(e2.message)}}
  closeLevelForm();await load();
}
function editLevel(id){const l=S.levels.find(x=>x.id===id);if(l)openLevelForm(l)}
function newLevel(){
  const sec=$('adminSection').value==='all'?'main':$('adminSection').value;
  const next=sec==='main'?S.levels.filter(l=>l.section==='main').length+1:sec==='extended'?46:101;
  openLevelForm({section:sec,rank:next});
}
async function deleteLevel(id){if(!confirm('Delete this level? Its victories and history will also be removed.'))return;const {error}=await sb.from('levels').delete().eq('id',id);if(error)alert(error.message);else await load()}
async function deletePlayer(id){if(!confirm('Delete player and their victories?'))return;const {error}=await sb.from('players').delete().eq('id',id);if(error)alert(error.message);else await load()}
async function deleteRecord(id){if(!confirm('Remove this victory? The points will disappear automatically.'))return;const {error}=await sb.from('records').delete().eq('id',id);if(error)alert(error.message);else await load()}
function updateRecordPoints(){const l=S.levels.find(x=>x.id===$('recordLevel').value);$('recordPoints').textContent=`Awards ${pointsFor(l)} points`;}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('list_settings').update({list_name:$('list_name').value,tagline:$('tagline').value}).eq('id',S.settings.id);if(error)alert(error.message);else await load()};
$('pointsForm').onsubmit=async e=>{e.preventDefault();for(const inp of document.querySelectorAll('#pointsGrid input')){const {error}=await sb.from('point_values').update({points:Number(inp.value)}).eq('rank',Number(inp.dataset.rank));if(error){alert(error.message);return}}await load()};
$('playerForm').onsubmit=async e=>{e.preventDefault();const name=$('playerName').value.trim();if(!name)return;const {error}=await sb.from('players').insert({name});if(error)alert(error.message);else{$('playerName').value='';await load()}};
$('recordForm').onsubmit=async e=>{e.preventDefault();const level=S.levels.find(l=>l.id===$('recordLevel').value);const player=S.players.find(p=>p.id===$('recordPlayer').value);if(!player||!level)return;const {data:earned,error}=await sb.rpc('add_victory',{p_player_id:player.id,p_level_id:level.id,p_progress:100,p_video_url:$('recordVideo').value.trim()||null});if(error)alert(error.message);else{$('recordVideo').value='';await load();msg(`🏆 ${esc(player.name)} now has the victory for #${level.rank} ${esc(level.name)} — <strong>+${Number(earned)||pointsFor(level)} points</strong> immediately.`,true)}};
$('newLevelBtn').onclick=newLevel;$('levelFilter').oninput=renderLevels;$('adminSection').onchange=renderLevels;$('recordLevel').onchange=updateRecordPoints;
$('levelForm').onsubmit=saveLevel;$('levelCancel').onclick=closeLevelForm;$('levelClose').onclick=closeLevelForm;$('levelModal').onclick=e=>{if(e.target===$('levelModal'))closeLevelForm()};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='diddy-backup.json';a.click();URL.revokeObjectURL(a.href)};
$('importBtn').onclick=()=>alert('Use the exported JSON as a backup. A transactional restore can be added later.');
async function boot(){if(!sb){msg('Put your Supabase URL + anon/publishable key into config.js first.',false);return}const {data:{user}}=await sb.auth.getUser();if(!user){$('auth').innerHTML='<div class="panel"><h2>Admin login</h2><form id="login"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Password" required><button>Sign in</button></form></div>';$('login').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)msg(error.message,false);else location.reload()};return}const {data:ok}=await sb.rpc('is_admin');if(!ok){msg('Signed in, but this account is not an admin.',false);return}$('adminApp').hidden=false;await load()}boot();

// V10 extras
async function loadFeatured(){if(!$('featuredSelect'))return;const {data}=await sb.from('featured_level').select('id').limit(1).maybeSingle();$('featuredSelect').innerHTML='<option value="">None</option>'+S.levels.map(l=>`<option value="${l.id}">#${l.rank} · ${esc(l.name)}</option>`).join('');$('featuredSelect').value=data?.id||''}
async function saveFeatured(){const id=$('featuredSelect').value||null;await sb.from('featured_level').delete().neq('id','00000000-0000-0000-0000-000000000000');if(id){const {error}=await sb.from('featured_level').insert({id});if(error)return alert(error.message)}alert('Featured level updated.');await loadFeatured()}
if($('featuredSave'))$('featuredSave').onclick=saveFeatured;
const oldLoad=load;load=async function(){await oldLoad();await loadFeatured()};
if($('importBtn'))$('importBtn').onclick=()=>{$('importFile').click()};
if($('importFile'))$('importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());for(const p of (data.players||[])){await sb.from('players').upsert({id:p.id,name:p.name},{onConflict:'id'})}for(const l of (data.levels||[])){await sb.from('levels').upsert(l,{onConflict:'id'})}for(const r of (data.records||[])){await sb.from('records').upsert(r,{onConflict:'id'})}alert('Backup imported without wiping existing data.');await load()}catch(err){alert('Import failed: '+err.message)}};

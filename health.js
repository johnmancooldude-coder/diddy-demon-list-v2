const cfg=window.DIDDY_CONFIG||{};
const url=cfg.SUPABASE_URL||'';
const key=cfg.SUPABASE_ANON_KEY||'';
const sb=url&&key&&window.supabase?supabase.createClient(url,key):null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(name,status,detail){const cls=status==='OK'?'success':status==='WARN'?'warning':'danger';return `<div class="panel"><div class="row between"><strong>${esc(name)}</strong><span class="badge ${cls}">${status}</span></div><p class="meta">${esc(detail)}</p></div>`}
async function checkTable(name){const {error}=await sb.from(name).select('*',{head:true,count:'exact'});return error?{status:'FAIL',detail:error.message}:{status:'OK',detail:'Readable.'}}
async function boot(){
 if(!sb){$('gate').innerHTML=card('Supabase configuration','FAIL','config.js is missing or the publishable key is not configured.');return}
 const {data:{user},error:authErr}=await sb.auth.getUser();
 if(authErr||!user){$('gate').innerHTML=card('Admin session','FAIL','You must be signed in to run the system check.');return}
 const {data:isAdmin,error:adminErr}=await sb.rpc('is_admin');
 if(adminErr||!isAdmin){$('gate').innerHTML=card('Admin authorization','FAIL','This account is not authorized to run the diagnostics.');return}
 $('gate').innerHTML=card('Admin authorization','OK','Authenticated as an authorized admin.');
 const checks=[['Supabase client','OK','Client initialized from config.js.']];
 for(const name of ['levels','players','records','placement_history','changelog','featured_level','list_settings','point_values','v18_activity_log','v18_backups','v18_news_posts','player_leaderboard','v18_news_feed']){const r=await checkTable(name);checks.push([name,r.status,r.detail])}
 const {data:backup,error:backupErr}=await sb.rpc('v18_get_latest_backup');
 checks.push(['Latest backup RPC',backupErr?'WARN':'OK',backupErr?backupErr.message:(backup?'Latest backup is available.':'No backup has been captured yet.')]);
 $('health').innerHTML=checks.map(x=>card(...x)).join('');
}
boot().catch(e=>{$('health').innerHTML=card('Unexpected diagnostic error','FAIL',e.message||String(e));});

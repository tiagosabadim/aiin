// aiin · BriefingPage v6
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createContentJob } from '../lib/api'
import type { Workspace, BrandProfile, Subscription, ContentType } from '../types/database'
import { CREDIT_COSTS } from '../types/database'
import { useAuth } from '../hooks/useAuth'

interface Props {
  workspace: Workspace; brand: BrandProfile
  subscription: Subscription | null; credits: number
  navigate: (r: string) => void
}
type Period = 'semana' | 'quinzena' | 'mes'
interface Item {
  id: string; position: number; scheduled_date: string
  content_type: ContentType; title: string; objective: string
  extra_context: string; hashtags: string[]; reference_files: File[]
  status: 'pending' | 'approved' | 'generating' | 'done'; editing: boolean
}
const TYPE_LABELS: Record<string,string> = {
  post_simples:'Post estático', carrossel_5:'Carrossel 5p',
  story:'Story', capa_reels:'Capa Reels',
}
const PERIOD_DAYS: Record<Period,number> = { semana:7, quinzena:14, mes:30 }

// Estilos reutilizados
const card: React.CSSProperties = { background:'#fff', border:'1px solid rgba(7,13,31,.08)', borderRadius:14, padding:'12px 16px' }
const secLabel: React.CSSProperties = { fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8, display:'block' }
const counterBtn: React.CSSProperties = { width:32, height:32, borderRadius:8, border:'1px solid rgba(7,13,31,.12)', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#374151', fontFamily:'inherit' }

export function BriefingPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const { user } = useAuth()
  const [phase, setPhase]   = useState<'plan'|'schedule'>('plan')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string|null>(null)
  const [period, setPeriod] = useState<Period>('semana')
  const [ppw, setPpw]       = useState(3)
  const [startDate, setStart] = useState(() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })
  const [theme, setTheme]   = useState('')
  const [nPost, setNPost]   = useState(2)
  const [nCar,  setNCar]    = useState(1)
  const [nSt,   setNSt]     = useState(0)
  const [campaignId, setCampaignId] = useState<string|null>(null)
  const [items, setItems]   = useState<Item[]>([])
  const [approvingAll, setApprovingAll] = useState(false)
  const fileRefs = useRef<Record<string,HTMLInputElement|null>>({})

  const total  = nPost + nCar + nSt
  const estCr  = nPost + nCar*3 + nSt
  const itemCr = items.reduce((s,i)=>s+(CREDIT_COSTS[i.content_type]??1),0)
  const nDone  = items.filter(i=>i.status==='done'||i.status==='generating').length

  const generate = async () => {
    if (!user||total===0) return
    setLoading(true); setError(null)
    try {
      const start=new Date(startDate), end=new Date(start)
      end.setDate(end.getDate()+PERIOD_DAYS[period]-1)
      const { data:camp, error:e } = await supabase.from('content_campaigns').insert({
        workspace_id:workspace.id, brand_id:brand.id, created_by:user.id,
        title:theme||`Campanha ${period} — ${start.toLocaleDateString('pt-BR')}`,
        period, start_date:start.toISOString().split('T')[0],
        end_date:end.toISOString().split('T')[0], posts_per_week:ppw, theme, status:'draft',
      }).select().single()
      if (e) throw e
      setCampaignId(camp.id)
      const mix:ContentType[] = [...Array(nPost).fill('post_simples'),...Array(nCar).fill('carrossel_5'),...Array(nSt).fill('story')]
      const fmix = mix.reduce((a:Record<string,number>,t)=>{a[t]=(a[t]??0)+1;return a},{})
      const prompt=`Estrategista de conteúdo Instagram Brasil.\nBRAND DNA:\n${brand.ai_brand_dna??''}\nMARCA: ${brand.name} | Segmento: ${brand.segment} | Tom: ${brand.tone_of_voice}\nPERÍODO: ${period} (${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}) | ${ppw} posts/sem | Mix: ${Object.entries(fmix).map(([k,v])=>`${v}× ${TYPE_LABELS[k]??k}`).join(', ')}\nTEMA: ${theme||'livre'}\nJSON:\n{"items":[{"date":"YYYY-MM-DD","format":"post_simples|carrossel_5|story|capa_reels","title":"pt-BR","objective":"obj","context":"ctx","hashtags":["#tag"]}]}`
      const res=await fetch('/api/generate-schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})})
      const data=await res.json()
      if (!res.ok) throw new Error(data.error??'Erro')
      const parsed=JSON.parse(data.content)
      const si:Item[]=parsed.items.map((it:any,idx:number)=>({
        id:`i-${idx}`,position:idx+1,scheduled_date:it.date,content_type:it.format as ContentType,
        title:it.title,objective:it.objective??'',extra_context:it.context??'',
        hashtags:it.hashtags??[],reference_files:[],status:'pending',editing:false,
      }))
      await supabase.from('campaign_items').insert(si.map(it=>({
        campaign_id:camp.id,workspace_id:workspace.id,brand_id:brand.id,
        position:it.position,scheduled_date:it.scheduled_date,content_type:it.content_type,
        title:it.title,objective:it.objective,extra_context:it.extra_context,
        hashtags:it.hashtags,required_credits:CREDIT_COSTS[it.content_type]??1,
      })))
      setItems(si); setPhase('schedule')
    } catch(e:any) { setError(e.message??'Erro') }
    finally { setLoading(false) }
  }

  const approveItem = async (itemId:string) => {
    const item=items.find(i=>i.id===itemId)
    if (!item||!campaignId||!user) return
    setItems(p=>p.map(i=>i.id===itemId?{...i,status:'generating'}:i))
    try {
      const refUrls:string[]=[]
      for (const f of item.reference_files) {
        const path=`${workspace.id}/refs/${Date.now()}_${f.name}`
        const {error}=await supabase.storage.from('assets').upload(path,f,{upsert:true})
        if (!error){const{data:u}=supabase.storage.from('assets').getPublicUrl(path);refUrls.push(u.publicUrl)}
      }
      const{data:brief}=await supabase.from('content_briefs').insert({
        workspace_id:workspace.id,brand_id:brand.id,created_by:user.id,title:item.title,
        objective:item.objective,content_type:item.content_type,quantity:1,
        extra_context:item.extra_context,hashtags:item.hashtags,
        required_credits:CREDIT_COSTS[item.content_type]??1,status:'confirmed',
      }).select().single()
      if (!brief) throw new Error('Briefing falhou')
      await createContentJob({
        workspaceId:workspace.id,briefId:brief.id,brandId:brand.id,jobType:item.content_type,quantity:1,
        inputPayload:{title:item.title,objective:item.objective,tone_of_voice:brand.tone_of_voice,
          extra_context:item.extra_context,hashtags:item.hashtags,reference_urls:refUrls,
          brand_name:brand.name,segment:brand.segment,target_audience:brand.target_audience,
          products:brand.products,color_palette:brand.color_palette,slogans:brand.slogans,
          design_rules:brand.design_rules,forbidden_words:brand.forbidden_words,
          brand_dna:brand.ai_brand_dna,logo_urls:brand.logo_urls,quantity:1,content_type:item.content_type},
      })
      await supabase.from('campaign_items').update({status:'approved'}).eq('campaign_id',campaignId).eq('position',item.position)
      setItems(p=>p.map(i=>i.id===itemId?{...i,status:'done'}:i))
    } catch(e:any){setError(e.message);setItems(p=>p.map(i=>i.id===itemId?{...i,status:'pending'}:i))}
  }

  const approveAll=async()=>{
    setApprovingAll(true)
    for(const it of items.filter(i=>i.status==='pending')) await approveItem(it.id)
    setApprovingAll(false)
  }

  return (
    <div className="page-split">

      {/* ── ESQUERDA ── */}
      <div className="page-split-left" style={{gap:14}}>

        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{color:'#F72585',fontSize:18}}>✦</span>
            <h1 style={{fontSize:20,fontWeight:700,color:'#070D1F',letterSpacing:'-.4px'}}>
              {phase==='plan'?'Planejar conteúdo':`${items.length} posts planejados`}
            </h1>
          </div>
          <p style={{fontSize:13,color:'#6B7280',lineHeight:1.5}}>
            {phase==='plan'?'Configure e a IA monta o cronograma perfeito para você.':`${items.filter(i=>i.status==='pending').length} pendentes · ${itemCr} créditos · ${credits} disponíveis`}
          </p>
        </div>

        {phase==='plan' && (
          <>
            {/* Período */}
            <div style={card}>
              <span style={secLabel}>Período</span>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {([['semana','1 semana','~5 posts'],['quinzena','2 semanas','~10 posts'],['mes','1 mês','~20 posts']] as const).map(([v,l,s])=>(
                  <button key={v} onClick={()=>setPeriod(v)} style={{
                    padding:'10px 8px',textAlign:'center',cursor:'pointer',fontFamily:'inherit',
                    border:`1.5px solid ${period===v?'#F72585':'rgba(7,13,31,.1)'}`,
                    borderRadius:12,background:period===v?'linear-gradient(135deg,rgba(255,106,0,.07),rgba(247,37,133,.07),rgba(123,44,255,.07))':'#fff',
                    position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:6,transition:'all .15s',
                  }}>
                    {period===v&&<span style={{position:'absolute',top:8,right:8,width:16,height:16,borderRadius:'50%',background:'#F72585',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'white'}}>✓</span>}
                    <div style={{width:24,height:24,borderRadius:6,background:period===v?'rgba(247,37,133,.1)':'#F7F8FA',display:'flex',alignItems:'center',justifyContent:'center',color:period===v?'#F72585':'#9CA3AF'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:period===v?'#070D1F':'#374151'}}>{l}</div>
                    <div style={{fontSize:10,color:'#9CA3AF'}}>{s}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data + freq */}
            <div style={card}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div>
                  <span style={secLabel}>Data de início</span>
                  <div style={{position:'relative'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <input type="date" value={startDate} onChange={e=>setStart(e.target.value)} style={{width:'100%',height:36,paddingLeft:32,paddingRight:10,border:'1px solid rgba(7,13,31,.1)',borderRadius:10,fontSize:13,fontFamily:'inherit',outline:'none',color:'#070D1F',background:'#F7F8FA'}} />
                  </div>
                </div>
                <div>
                  <span style={secLabel}>Posts/semana</span>
                  <div style={{display:'flex',gap:5}}>
                    {[2,3,4,5,7].map(n=>(
                      <button key={n} onClick={()=>setPpw(n)} style={{flex:1,height:36,cursor:'pointer',fontFamily:'inherit',borderRadius:8,fontSize:13,fontWeight:ppw===n?700:500,transition:'all .12s',border:`1.5px solid ${ppw===n?'#F72585':'rgba(7,13,31,.1)'}`,background:ppw===n?'linear-gradient(135deg,rgba(255,106,0,.07),rgba(247,37,133,.07),rgba(123,44,255,.07))':'#fff',color:ppw===n?'#F72585':'#6B7280'}}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mix */}
            <div style={card}>
              <span style={secLabel}>Mix de formatos</span>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {label:'Posts estáticos',sub:'1 crédito cada', color:'#7B2CFF',bg:'rgba(123,44,255,.1)',val:nPost,set:setNPost,
                   icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>},
                  {label:'Carrosséis 5p',  sub:'3 créditos cada',color:'#F72585',bg:'rgba(247,37,133,.1)',val:nCar, set:setNCar,
                   icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><rect x="18" y="8" width="4" height="8" rx="1"/></svg>},
                  {label:'Stories avulsos',sub:'1 crédito cada', color:'#FF6A00',bg:'rgba(255,106,0,.1)', val:nSt,  set:setNSt,
                   icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>},
                ].map(row=>(
                  <div key={row.label} style={{display:'flex',alignItems:'center'}}>
                    <div style={{width:30,height:30,borderRadius:8,background:row.bg,display:'flex',alignItems:'center',justifyContent:'center',color:row.color,marginRight:12,flexShrink:0}}>
                      {row.icon}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#070D1F'}}>{row.label}</div>
                      <div style={{fontSize:11,color:'#9CA3AF'}}>{row.sub}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <button onClick={()=>row.set(Math.max(0,row.val-1))} style={counterBtn}>−</button>
                      <span style={{width:20,textAlign:'center',fontSize:16,fontWeight:700,color:row.color}}>{row.val}</span>
                      <button onClick={()=>row.set(row.val+1)} style={counterBtn}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{borderTop:'1px solid rgba(7,13,31,.07)',paddingTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:'#9CA3AF'}}>{total} posts  •  {estCr} créditos estimados</span>
                  {credits<estCr&&<span style={{fontSize:11,color:'#E24B4A',fontWeight:600}}>⚠ {credits} disponíveis</span>}
                </div>
              </div>
            </div>

            {/* Tema */}
            <div>
              <span style={secLabel}>Tema <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'#C4C7CE'}}>(opcional)</span></span>
              <input value={theme} onChange={e=>setTheme(e.target.value)} placeholder="ex: coleção inverno, promoção, lançamento, dicas..." style={{width:'100%',height:38,padding:'0 12px',border:'1px solid rgba(7,13,31,.1)',borderRadius:10,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff',color:'#070D1F'}} />
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:6}}>A IA cria títulos baseados nisso para deixar tudo alinhado.</div>
            </div>

            {error&&<div style={{padding:'10px 14px',background:'#FCEBEB',border:'1px solid rgba(226,75,74,.2)',borderRadius:10,fontSize:12,color:'#E24B4A'}}>{error}</div>}

            <div style={{flex:1}} />

            <button onClick={generate} disabled={loading||total===0} style={{width:'100%',height:46,background:loading||total===0?'#e5e7eb':'linear-gradient(135deg,#FF6A00 0%,#F72585 50%,#7B2CFF 100%)',border:'none',borderRadius:12,color:loading||total===0?'#9CA3AF':'white',fontSize:15,fontWeight:700,fontFamily:'inherit',cursor:loading||total===0?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:loading||total===0?'none':'0 4px 20px rgba(247,37,133,.35)',transition:'all .2s'}}>
              {loading?(
                <><div style={{width:16,height:16,border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Gerando cronograma…</>
              ):(
                <><span style={{fontSize:18}}>✦</span> Gerar cronograma</>
              )}
            </button>
          </>
        )}

        {phase==='schedule' && (
          <>
            {error&&<div style={{padding:'10px 14px',background:'#FCEBEB',border:'1px solid rgba(226,75,74,.2)',borderRadius:10,fontSize:12,color:'#E24B4A'}}>{error}</div>}
            {nDone>0&&(
              <div style={{padding:'14px 16px',background:'linear-gradient(135deg,rgba(255,106,0,.07),rgba(247,37,133,.07),rgba(123,44,255,.07))',border:'1px solid rgba(247,37,133,.15)',borderRadius:12,textAlign:'center'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#070D1F',marginBottom:6}}>{nDone} post{nDone>1?'s':''} sendo gerado{nDone>1?'s':''} ✦</div>
                <button onClick={()=>navigate('posts')} style={{background:'none',border:'1px solid rgba(7,13,31,.12)',borderRadius:8,padding:'6px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#374151'}}>Ver em Aprovar →</button>
              </div>
            )}
            <div style={{flex:1}} />
            <button onClick={approveAll} disabled={approvingAll||credits<itemCr||items.every(i=>i.status!=='pending')} style={{width:'100%',height:46,background:'linear-gradient(135deg,#FF6A00,#F72585,#7B2CFF)',border:'none',borderRadius:12,color:'white',fontSize:15,fontWeight:700,fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 4px 20px rgba(247,37,133,.35)',opacity:approvingAll||credits<itemCr||items.every(i=>i.status!=='pending')?0.5:1}}>
              {approvingAll?<><div style={{width:16,height:16,border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Gerando…</>:`✦ Aprovar todos · ${itemCr} créditos`}
            </button>
            <button onClick={()=>setPhase('plan')} style={{width:'100%',height:44,background:'transparent',border:'1px solid rgba(7,13,31,.12)',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'#374151'}}>← Rever configuração</button>
          </>
        )}

      </div>
      {/* FIM ESQUERDA */}

      {/* ── DIREITA ── */}
      <div className="page-split-right">

        {phase==='plan' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 48px',gap:20}}>
            <div style={{position:'relative',width:180,height:160,marginBottom:8}}>
              <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',width:140,height:36,background:'rgba(123,44,255,.07)',borderRadius:'50%'}} />
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-60%)',width:88,height:88,background:'#fff',borderRadius:20,border:'1px solid rgba(7,13,31,.08)',boxShadow:'0 8px 32px rgba(7,13,31,.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:40,height:40,background:'linear-gradient(135deg,rgba(255,106,0,.15),rgba(247,37,133,.15),rgba(123,44,255,.15))',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:'#F72585'}}>✦</div>
              </div>
              <div style={{position:'absolute',top:10,right:16,width:10,height:10,borderRadius:'50%',background:'#7B2CFF',opacity:.6}} />
              <div style={{position:'absolute',top:28,left:12,width:7,height:7,borderRadius:'50%',background:'#FF6A00',opacity:.7}} />
              <div style={{position:'absolute',top:18,right:44,width:6,height:6,borderRadius:'50%',background:'#F72585',opacity:.5}} />
              <div style={{position:'absolute',bottom:22,right:20,width:8,height:8,borderRadius:'50%',background:'#7B2CFF',opacity:.4}} />
            </div>
            <div style={{textAlign:'center',maxWidth:320}}>
              <h2 style={{fontSize:20,fontWeight:700,color:'#070D1F',marginBottom:10,letterSpacing:'-.3px'}}>Seu cronograma vai aparecer aqui</h2>
              <p style={{fontSize:13,color:'#9CA3AF',lineHeight:1.6}}>Configure o período e o mix ao lado, depois clique em <strong style={{color:'#374151'}}>Gerar cronograma</strong>. A IA cria os temas, títulos e distribuição dos posts para você.</p>
            </div>
          </div>
        )}

        {phase==='schedule' && (
          <>
            <div style={{position:'sticky',top:0,zIndex:10,background:'#fff',borderBottom:'1px solid rgba(7,13,31,.07)',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'#070D1F'}}>{items.length} posts planejados</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{items.filter(i=>i.status==='pending').length} pendentes · {itemCr} créditos · {credits} disponíveis</div>
              </div>
              <span style={{fontSize:11,fontWeight:600,padding:'3px 12px',borderRadius:99,background:'linear-gradient(135deg,rgba(255,106,0,.07),rgba(247,37,133,.07),rgba(123,44,255,.07))',border:'1px solid rgba(247,37,133,.2)',color:'#F72585'}}>
                {items.filter(i=>i.status==='done').length}/{items.length} gerados
              </span>
            </div>
            <div style={{padding:'16px 28px 40px',display:'flex',flexDirection:'column',gap:10}}>
              {items.map(item=>(
                <ItemCard key={item.id} item={item} credits={credits}
                  onApprove={()=>approveItem(item.id)}
                  onUpdate={p=>setItems(prev=>prev.map(i=>i.id===item.id?{...i,...p}:i))}
                  onAddRef={f=>setItems(prev=>prev.map(i=>i.id===item.id?{...i,reference_files:[...i.reference_files,f]}:i))}
                  fileRef={el=>{fileRefs.current[item.id]=el}}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </>
        )}

      </div>
      {/* FIM DIREITA */}

    </div>
    // FIM PAGE-SPLIT
  )
}

function ItemCard({item,credits,onApprove,onUpdate,onAddRef,fileRef,onNavigate}:{
  item:Item;credits:number;onApprove:()=>void;onUpdate:(p:Partial<Item>)=>void;
  onAddRef:(f:File)=>void;fileRef:(el:HTMLInputElement|null)=>void;onNavigate:(r:string)=>void
}) {
  const fRef=useRef<HTMLInputElement|null>(null)
  const d=new Date(item.scheduled_date+'T12:00:00')
  const cr=CREDIT_COSTS[item.content_type]??1
  const ST:Record<string,{label:string;color:string;bg:string}>={
    pending:{label:'Pendente',color:'#BA7517',bg:'#FAEEDA'},
    approved:{label:'Aprovado',color:'#1D9E75',bg:'#E1F5EE'},
    generating:{label:'Gerando…',color:'#F72585',bg:'rgba(247,37,133,.1)'},
    done:{label:'Gerado ✓',color:'#1D9E75',bg:'#E1F5EE'},
  }
  const st=ST[item.status]
  return (
    <div style={{background:'#fff',borderRadius:12,overflow:'hidden',border:`1px solid ${item.status==='generating'?'rgba(247,37,133,.3)':'rgba(7,13,31,.08)'}`,boxShadow:'0 1px 3px rgba(7,13,31,.05)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px'}}>
        <div style={{width:38,textAlign:'center',flexShrink:0}}>
          <div style={{fontSize:9,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em'}}>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</div>
          <div style={{fontSize:17,fontWeight:700,color:'#070D1F',lineHeight:1.1}}>{d.toLocaleDateString('pt-BR',{day:'2-digit'})}</div>
          <div style={{fontSize:9,color:'#9CA3AF'}}>{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
        </div>
        <div style={{width:1,height:32,background:'rgba(7,13,31,.07)',flexShrink:0}} />
        <span style={{padding:'3px 10px',borderRadius:99,fontSize:10,fontWeight:600,background:'linear-gradient(135deg,rgba(255,106,0,.07),rgba(247,37,133,.07),rgba(123,44,255,.07))',border:'1px solid rgba(247,37,133,.15)',color:'#F72585',flexShrink:0,whiteSpace:'nowrap'}}>
          {TYPE_LABELS[item.content_type]??item.content_type}
        </span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:'#070D1F',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</div>
          {item.extra_context&&<div style={{fontSize:11,color:'#9CA3AF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.extra_context}</div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:st.bg,color:st.color,fontWeight:600}}>{st.label}</span>
          <span style={{fontSize:10,color:'#9CA3AF'}}>{cr}cr</span>
          {item.status==='pending'&&<>
            <button onClick={()=>onUpdate({editing:!item.editing})} style={{height:32,padding:'0 10px',border:'1px solid rgba(7,13,31,.12)',borderRadius:8,background:'transparent',cursor:'pointer',fontSize:12,fontFamily:'inherit',color:'#374151'}}>{item.editing?'Fechar':'✎'}</button>
            <button onClick={onApprove} disabled={credits<cr} style={{height:32,padding:'0 12px',border:'none',borderRadius:8,background:'#1D9E75',color:'white',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit',opacity:credits<cr?.4:1}}>✓ Aprovar</button>
          </>}
          {item.status==='generating'&&<div style={{width:14,height:14,border:'2px solid rgba(247,37,133,.3)',borderTopColor:'#F72585',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}} />}
          {item.status==='done'&&<button onClick={()=>onNavigate('posts')} style={{height:32,padding:'0 12px',border:'1px solid rgba(7,13,31,.12)',borderRadius:8,background:'transparent',cursor:'pointer',fontSize:12,fontFamily:'inherit',color:'#374151'}}>Ver →</button>}
        </div>
      </div>
      {item.editing&&(
        <div style={{padding:'14px 16px',background:'#F7F8FA',borderTop:'1px solid rgba(7,13,31,.07)',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',display:'block',marginBottom:5}}>Tema</label>
              <input style={{width:'100%',height:38,padding:'0 10px',border:'1px solid rgba(7,13,31,.1)',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none'}} value={item.title} onChange={e=>onUpdate({title:e.target.value})} />
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',display:'block',marginBottom:5}}>Data</label>
              <input type="date" style={{width:'100%',height:38,padding:'0 10px',border:'1px solid rgba(7,13,31,.1)',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none'}} value={item.scheduled_date} onChange={e=>onUpdate({scheduled_date:e.target.value})} />
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',display:'block',marginBottom:5}}>Formato</label>
            <select style={{width:'100%',height:38,padding:'0 10px',border:'1px solid rgba(7,13,31,.1)',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',background:'#fff'}} value={item.content_type} onChange={e=>onUpdate({content_type:e.target.value as ContentType})}>
              {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',display:'block',marginBottom:5}}>Contexto extra</label>
            <textarea style={{width:'100%',padding:'8px 10px',border:'1px solid rgba(7,13,31,.1)',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',minHeight:60}} value={item.extra_context} onChange={e=>onUpdate({extra_context:e.target.value})} placeholder="ex: usar foto do produto..." />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',display:'block',marginBottom:5}}>Referências</label>
            <input ref={el=>{fRef.current=el;fileRef(el)}} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>Array.from(e.target.files??[]).forEach(f=>onAddRef(f))} />
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <button onClick={()=>fRef.current?.click()} style={{height:32,padding:'0 12px',border:'1px solid rgba(7,13,31,.12)',borderRadius:8,background:'transparent',cursor:'pointer',fontSize:12,fontFamily:'inherit',color:'#374151'}}>+ Foto</button>
              {item.reference_files.map((f,i)=>(
                <div key={i} style={{position:'relative'}}>
                  <img src={URL.createObjectURL(f)} alt="" style={{width:40,height:40,objectFit:'cover',borderRadius:6,border:'1px solid rgba(7,13,31,.1)'}} />
                  <button onClick={()=>onUpdate({reference_files:item.reference_files.filter((_,j)=>j!==i)})} style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'#E24B4A',border:'none',color:'white',fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

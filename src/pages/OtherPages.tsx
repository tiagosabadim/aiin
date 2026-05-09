// ============================================================
//  InsightsPage
// ============================================================
export function InsightsPage() {
  const stats = [
    { label:'Alcance total',       value:'84.2k', delta:'↑ 18%',  up:true  },
    { label:'Engajamento médio',   value:'6.4%',  delta:'↑ 1.2pp', up:true  },
    { label:'Novos seguidores',    value:'+1.340',delta:'↑ 32%',  up:true  },
    { label:'Score IA médio',      value:'7.8/10',delta:'↑ 0.9pts',up:true  },
  ]
  const patterns = [
    { icon:'↑', bg:'#EAF3DE', color:'#27500A', text:'Legendas com pergunta geram 2.1× mais comentários',    badge:'+112%',  up:true  },
    { icon:'◷', bg:'#EAF3DE', color:'#27500A', text:'Publicar 18h–20h aumenta alcance orgânico em 38%',     badge:'+38%',   up:true  },
    { icon:'◫', bg:'#EEEDFE', color:'#3C3489', text:'Carrosseis 5–7 slides têm maior taxa de salvamento',   badge:'×2.4',   up:null  },
    { icon:'#', bg:'#FAEEDA', color:'#633806', text:'Hashtags nicho (10k–100k posts) performam 29% melhor', badge:'+29%',   up:true  },
    { icon:'↓', bg:'#FCEBEB', color:'#791F1F', text:'Posts só promocionais têm engajamento 40% menor',      badge:'-40%',   up:false },
  ]
  const posts = [
    { title:'Coleção verão ✨',     format:'Carrossel', reach:'12.4k', eng:'8.2%', score:9.1 },
    { title:'Linha eco',            format:'Carrossel', reach:'10.8k', eng:'7.9%', score:8.7 },
    { title:'Promoção relâmpago',   format:'Foto',      reach:'7.2k',  eng:'4.1%', score:5.3 },
    { title:'Looks fim de semana',  format:'Reels',     reach:'15.1k', eng:'9.4%', score:9.6 },
    { title:'Bastidores da marca',  format:'Reels',     reach:'11.3k', eng:'8.8%', score:8.9 },
  ]

  return (
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Insights</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>Últimos 30 dias · 38 posts analisados</p>
        </div>
        <select style={{ padding:'7px 12px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)',
          fontSize:13, color:'var(--text-1)', background:'var(--surface)', fontFamily:'var(--font-sans)', outline:'none' }}>
          <option>Últimos 30 dias</option><option>Últimos 90 dias</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:500, color:'var(--text-1)', lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, marginTop:5, color: s.up ? 'var(--brand)' : 'var(--red)' }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Banner IA */}
      <div style={{ border:'1px solid rgba(61,90,62,0.2)', borderRadius:'var(--radius-lg)',
        padding:'14px 16px', background:'var(--brand-light)', marginBottom:20,
        display:'flex', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, marginTop:1 }}>✦</span>
        <div>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)', marginBottom:4 }}>Análise do Claude · atualizada há 2h</div>
          <div style={{ fontSize:12, color:'var(--brand-dark)', opacity:.85, lineHeight:1.6 }}>
            Posts com <strong>tom descontraído + carrossel</strong> geram 2.4× mais salvamentos.
            Horários entre <strong>18h–20h às quartas</strong> mostram pico de alcance.
            Sua taxa de engajamento subiu 1.2pp após legendas com perguntas. Recomendo testar <strong>Reels curtos (15s)</strong>.
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        {/* Padrões */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Padrões identificados</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {patterns.map((p, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', background:'var(--surface-2)', borderRadius:'var(--radius-md)' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:p.bg, color:p.color,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>{p.icon}</div>
                <span style={{ flex:1, fontSize:12, color:'var(--text-1)', lineHeight:1.4 }}>{p.text}</span>
                <span style={{ fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:99, flexShrink:0,
                  background: p.up === true ? '#EAF3DE' : p.up === false ? '#FCEBEB' : '#EEEDFE',
                  color: p.up === true ? '#27500A' : p.up === false ? '#791F1F' : '#3C3489' }}>{p.badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Engajamento por dia */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:14 }}>Engajamento por dia da semana</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
            {[['Dom',38],['Seg',52],['Ter',60],['Qua',84],['Qui',79],['Sex',57],['Sáb',43]].map(([d, v]) => (
              <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:'100%', borderRadius:'3px 3px 0 0', transition:'height .3s',
                  background: (v as number) >= 79 ? 'var(--brand)' : (v as number) >= 55 ? 'var(--brand-mid)' : 'var(--surface-2)',
                  height: `${(v as number)}%` }} />
                <span style={{ fontSize:10, color:'var(--text-3)' }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top posts */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:500, color:'var(--text-1)' }}>
          Top posts · últimos 30 dias
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Post','Formato','Alcance','Engaj.','Score IA'].map(h => (
                <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--text-3)', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => (
              <tr key={i} style={{ borderBottom: i < posts.length-1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding:'10px 16px', fontWeight:500, color:'var(--text-1)' }}>{p.title}</td>
                <td style={{ padding:'10px 16px', color:'var(--text-2)' }}>{p.format}</td>
                <td style={{ padding:'10px 16px', color:'var(--text-1)' }}>{p.reach}</td>
                <td style={{ padding:'10px 16px', color:'var(--text-1)' }}>{p.eng}</td>
                <td style={{ padding:'10px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ flex:1, height:4, background:'var(--surface-2)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99,
                        background: p.score >= 8 ? 'var(--brand)' : p.score >= 6 ? 'var(--amber)' : 'var(--red)',
                        width:`${p.score * 10}%` }} />
                    </div>
                    <span style={{ fontSize:11, fontWeight:500, minWidth:24,
                      color: p.score >= 8 ? 'var(--brand-dark)' : p.score >= 6 ? 'var(--amber)' : 'var(--red)' }}>
                      {p.score.toFixed(1)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
//  DesignSystemPage
// ============================================================
export function DesignSystemPage() {
  const colors = [
    { name:'Verde floresta', hex:'#3B4A2F', role:'Principal'    },
    { name:'Verde suave',    hex:'#8FAF6A', role:'Secundária'   },
    { name:'Areia',          hex:'#D4C9A8', role:'Destaque'     },
    { name:'Carvão',         hex:'#2C2C2A', role:'Texto'        },
    { name:'Off-white',      hex:'#F5F2EC', role:'Fundo'        },
  ]
  const slogans = [
    { text:'Vista o que você acredita.', active:true  },
    { text:'Moda que respeita o planeta.',active:false },
    { text:'Estilo com propósito.',       active:false },
  ]
  const icons = ['🌿','❤️','☀️','🌸','💧','⛰️','🌬️','🦋','🌙','♻️','✨','📷']

  return (
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Design System</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>Identidade visual usada pela IA para criar posts coerentes</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--brand-dark)', background:'var(--brand-light)',
            border:'1px solid rgba(61,90,62,.2)', borderRadius:'var(--radius-md)', padding:'7px 14px',
            fontWeight:500 }}>✦ Contexto IA: 73%</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Logo */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Logo</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              { bg:'#3B4A2F', label:'Principal',   text:'white' },
              { bg:'#F5F2EC', label:'Claro',       text:'#3B4A2F' },
              { bg:'#2C2C2A', label:'Escuro',      text:'white' },
            ].map(v => (
              <div key={v.label} style={{ borderRadius:'var(--radius-md)', overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ height:64, background:v.bg, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22, color:v.text }}>★</div>
                <div style={{ padding:'5px 8px', fontSize:10, color:'var(--text-3)' }}>{v.label}</div>
              </div>
            ))}
          </div>
          <button style={{ ...btnSm, marginTop:10, width:'100%', justifyContent:'center' }}>↑ Subir logo</button>
        </div>

        {/* Cores */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>Paleta de cores</div>
            <button style={btnSm}>+ Adicionar</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {colors.map(c => (
              <div key={c.hex} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'6px 8px', background:'var(--surface-2)', borderRadius:'var(--radius-md)' }}>
                <div style={{ width:28, height:28, borderRadius:'var(--radius-md)', background:c.hex,
                  border: c.hex === '#F5F2EC' ? '1px solid var(--border)' : 'none', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{c.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'monospace' }}>{c.hex}</div>
                </div>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99,
                  background:'#EEEDFE', color:'#3C3489' }}>{c.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tipografia */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Tipografia</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ borderBottom:'1px solid var(--border)', paddingBottom:10 }}>
              <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:500, color:'var(--text-1)' }}>Títulos</div>
              <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>Georgia · 22px · 500</div>
            </div>
            <div style={{ borderBottom:'1px solid var(--border)', paddingBottom:10 }}>
              <div style={{ fontSize:15, color:'var(--text-1)' }}>Subtítulos e corpo</div>
              <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>DM Sans · 15px · 400</div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:500, letterSpacing:'.06em', color:'var(--text-2)', textTransform:'uppercase' }}>LABELS E TAGS</div>
              <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>DM Sans · 11px · caps</div>
            </div>
          </div>
        </div>

        {/* Slogan */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>Slogans</div>
            <button style={btnSm}>+ Adicionar</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
            {slogans.map((s, i) => (
              <div key={i} style={{ padding:'10px 12px', border:`1px solid ${s.active ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius:'var(--radius-md)', background: s.active ? 'var(--brand-light)' : 'transparent',
                display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <div style={{ width:14, height:14, borderRadius:'50%', border:`1.5px solid ${s.active ? 'var(--brand)' : 'var(--border-md)'}`,
                  background: s.active ? 'var(--brand)' : 'transparent', display:'flex', alignItems:'center',
                  justifyContent:'center', flexShrink:0 }}>
                  {s.active && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                </div>
                <span style={{ fontSize:13, color: s.active ? 'var(--brand-dark)' : 'var(--text-2)', fontWeight: s.active ? 500 : 400 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ícones */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px', gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Ícones da marca</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:8 }}>
            {icons.map((icon, i) => (
              <div key={i} style={{ border:'1px solid var(--brand)', borderRadius:'var(--radius-md)',
                background:'var(--brand-light)', padding:'10px 6px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer' }}>
                <span style={{ fontSize:20 }}>{icon}</span>
              </div>
            ))}
          </div>
          <button style={{ ...btnSm, marginTop:10 }}>+ Adicionar ícone</button>
        </div>

        {/* Ilustrações */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px', gridColumn:'1 / -1' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>Ilustrações</div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={btnSm}>↑ Subir SVG</button>
              <button style={{ ...btnSm, background:'var(--brand)', color:'white', border:'none' }}>✦ Gerar com IA</button>
            </div>
          </div>
          <div style={{ border:'1px dashed var(--border-md)', borderRadius:'var(--radius-lg)',
            padding:'32px', textAlign:'center', color:'var(--text-3)' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🖼</div>
            <div style={{ fontSize:13, marginBottom:4 }}>Nenhuma ilustração ainda</div>
            <div style={{ fontSize:12 }}>Adicione SVGs ou peça para a IA gerar ilustrações no estilo da marca</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  SettingsPage
// ============================================================
export function SettingsPage() {
  return (
    <div style={{ padding:'28px 32px', maxWidth:600 }}>
      <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Configurações</h1>
      <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:28 }}>Gerencie integrações e conta</p>

      {[
        { title:'Instagram', desc:'Conta Business conectada via Meta Graph API', status:'Desconectado', action:'Conectar' },
        { title:'n8n',       desc:'Motor de automação — orquestra os workflows', status:'Configurar', action:'Configurar' },
        { title:'Claude API',desc:'Chave da API Anthropic para geração de conteúdo', status:'Não configurado', action:'Adicionar chave' },
        { title:'OpenAI',    desc:'Chave da API OpenAI para geração de imagens (DALL-E)', status:'Não configurado', action:'Adicionar chave' },
      ].map((item, i) => (
        <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)', padding:'16px 18px', marginBottom:10,
          display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:3 }}>{item.title}</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>{item.desc}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{item.status}</span>
            <button style={{ padding:'6px 14px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)',
              background:'transparent', color:'var(--text-1)', fontSize:12, fontFamily:'var(--font-sans)', cursor:'pointer' }}>
              {item.action}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const btnSm: React.CSSProperties = { display:'inline-flex', alignItems:'center', gap:4,
  padding:'5px 10px', border:'1px solid var(--border-md)', borderRadius:'var(--radius-md)',
  background:'transparent', color:'var(--text-2)', fontSize:12,
  fontFamily:'var(--font-sans)', cursor:'pointer' }

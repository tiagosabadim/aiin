import { useState } from 'react'

const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const EVENTS: Record<number, { label: string; color: string }[]> = {
  6:  [{ label:'Coleção verão',      color:'var(--brand)'   }],
  8:  [{ label:'Linha eco',          color:'var(--brand)'   }],
  11: [{ label:'Promoção relâmpago', color:'var(--amber)'   }],
  13: [{ label:'Looks fds',          color:'#1D9E75'        }],
  18: [{ label:'Stories série',      color:'var(--brand)'   }],
  22: [{ label:'Carrossel produto',  color:'#1D9E75'        }],
}
const UPCOMING = [
  { day:'Seg, 12',  time:'10h00', label:'Coleção verão', format:'Feed 1080×1350',  status:'scheduled' },
  { day:'Qua, 14',  time:'18h00', label:'Linha eco',     format:'Carrossel 6 slides', status:'scheduled' },
  { day:'Sex, 16',  time:'12h00', label:'Promoção',      format:'Stories',         status:'approved'  },
  { day:'Dom, 18',  time:'16h00', label:'Looks fds',     format:'Feed 1080×1350',  status:'scheduled' },
]

export function SchedulePage() {
  const [selected, setSelected] = useState<number | null>(null)
  const firstDay = 3 // começa na quarta
  const totalDays = 31
  const today = 9

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ padding:'28px 32px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--text-1)', marginBottom:4 }}>Agenda</h1>
          <p style={{ fontSize:14, color:'var(--text-2)' }}>Maio 2026 · 6 posts agendados</p>
        </div>
        <button style={btnPrimary}>+ Agendar post</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>

        {/* Calendário */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>Maio 2026</span>
            <div style={{ display:'flex', gap:4 }}>
              <button style={navBtn}>←</button>
              <button style={navBtn}>→</button>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:11, color:'var(--text-3)', padding:'4px 0', fontWeight:500 }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const isToday    = day === today
              const isSel      = day === selected
              const evts       = EVENTS[day] ?? []
              return (
                <div key={idx} onClick={() => setSelected(day === selected ? null : day)} style={{
                  minHeight:52, border:`1px solid ${isSel ? 'var(--brand)' : isToday ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius:'var(--radius-md)', padding:'4px 5px', cursor:'pointer',
                  background: isToday ? 'var(--brand-light)' : isSel ? 'var(--surface-2)' : 'transparent',
                  transition:'border-color .12s',
                }}>
                  <div style={{ fontSize:11, color: isToday ? 'var(--brand-dark)' : 'var(--text-2)', fontWeight: isToday ? 600 : 400 }}>{day}</div>
                  {evts.map((ev, ei) => (
                    <div key={ei} style={{ background:ev.color, color:'white', borderRadius:3,
                      fontSize:9, padding:'1px 4px', marginTop:2,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.label}</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar direita */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Melhores horários */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Melhores horários</div>
            {[
              { range:'18h–20h', label:'Alta taxa de engajamento', dot:'var(--brand)'  },
              { range:'10h–12h', label:'Boa performance',         dot:'#1D9E75'        },
              { range:'13h–14h', label:'Baixo alcance',           dot:'var(--red)'     },
            ].map(h => (
              <div key={h.range} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0',
                borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:h.dot, flexShrink:0 }} />
                <span style={{ fontWeight:500, color:'var(--text-1)', minWidth:60 }}>{h.range}</span>
                <span style={{ color:'var(--text-3)' }}>{h.label}</span>
              </div>
            )).slice(0, 3)}
          </div>

          {/* Próximos posts */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Próximas publicações</div>
            {UPCOMING.map((u, i) => (
              <div key={i} style={{ padding:'9px 0', borderBottom: i < UPCOMING.length-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                    background: u.status === 'scheduled' ? 'var(--brand)' : '#1D9E75' }} />
                  <span style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{u.label}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', paddingLeft:12 }}>{u.day} · {u.time}</div>
                <div style={{ fontSize:10, color:'var(--text-3)', paddingLeft:12, marginTop:1 }}>{u.format}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background:'var(--brand)', color:'white', border:'none',
  borderRadius:'var(--radius-md)', padding:'9px 18px', fontSize:13, fontWeight:500,
  fontFamily:'var(--font-sans)', cursor:'pointer' }
const navBtn: React.CSSProperties = { background:'transparent', border:'1px solid var(--border-md)',
  borderRadius:'var(--radius-md)', padding:'4px 10px', fontSize:13, color:'var(--text-2)',
  fontFamily:'var(--font-sans)', cursor:'pointer' }

import type { Route } from '../App'

interface Props {
  navigate: (r: Route) => void
}

const STATS = [
  { label: 'Posts aprovados',      value: '12', delta: '+4 esta semana',    up: true  },
  { label: 'Aguardando aprovação', value: '3',  delta: 'revisar agora',     up: null  },
  { label: 'Agendados',            value: '7',  delta: 'próximos 7 dias',   up: true  },
  { label: 'Publicados este mês',  value: '38', delta: '+12 vs mês ant.',   up: true  },
]

const ACTIVITY = [
  { icon: '✦', color: '#EEEDFE', textColor: '#3C3489', text: 'Claude gerou 4 posts para "Campanha Maio"',   time: 'agora'     },
  { icon: '✓', color: '#EAF3DE', textColor: '#27500A', text: 'Post "Lançamento Produto X" aprovado',         time: 'há 1h'     },
  { icon: '◷', color: '#FAEEDA', textColor: '#633806', text: '3 posts aguardando sua aprovação',             time: 'há 2h'     },
  { icon: '↑', color: '#EAF3DE', textColor: '#27500A', text: 'Post publicado automaticamente no Instagram',  time: 'ontem 18h' },
  { icon: '✦', color: '#EEEDFE', textColor: '#3C3489', text: 'Briefing "Dia das Mães" processado pela IA',  time: 'ontem 10h' },
]

export function DashboardPage({ navigate }: Props) {
  return (
    <div style={{ padding: '28px 32px', flex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text-1)', marginBottom: 4 }}>
            Bom dia 👋
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            Aqui está o resumo da sua automação de hoje.
          </p>
        </div>
        <button
          onClick={() => navigate('briefing')}
          style={btnPrimary}
        >
          + Novo briefing
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {STATS.map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1 }}>{s.value}</div>
            <div style={{
              fontSize: 12,
              marginTop: 6,
              color: s.up === true ? 'var(--brand)' : s.up === false ? 'var(--red)' : 'var(--text-3)',
            }}>
              {s.up === true ? '↑ ' : s.up === false ? '↓ ' : ''}{s.delta}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Atividade recente */}
        <div style={card}>
          <div style={sectionTitle}>Atividade recente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: a.color,
                  color: a.textColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}>
                  {a.icon}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{a.text}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={card}>
            <div style={sectionTitle}>Atalhos rápidos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                ['briefing',  'Criar novo briefing',    'var(--brand-light)',  'var(--brand-dark)'],
                ['posts',     'Aprovar 3 posts',         '#FAEEDA',             '#633806'],
                ['assets',    'Adicionar imagens',       'var(--surface-2)',    'var(--text-2)'],
                ['insights',  'Ver insights',            'var(--surface-2)',    'var(--text-2)'],
              ] as [Route, string, string, string][]).map(([route, label, bg, color]) => (
                <button
                  key={route}
                  onClick={() => navigate(route)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: bg,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {label}
                  <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contexto IA */}
          <div style={{ ...card, background: 'var(--brand-light)', border: '1px solid rgba(61,90,62,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>✦</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-dark)' }}>Contexto da IA</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--brand)',
              }}>73%</span>
            </div>
            <div style={{
              height: 5,
              background: 'rgba(61,90,62,0.15)',
              borderRadius: 99,
              overflow: 'hidden',
              marginBottom: 10,
            }}>
              <div style={{
                height: '100%',
                width: '73%',
                background: 'var(--brand)',
                borderRadius: 99,
              }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--brand-dark)', lineHeight: 1.5, opacity: 0.8 }}>
              Adicione ilustrações ao design system para chegar a 90% e melhorar a identidade visual dos posts.
            </p>
            <button
              onClick={() => navigate('design')}
              style={{
                marginTop: 10,
                background: 'none',
                border: '1px solid rgba(61,90,62,0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--brand-dark)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Completar design system →
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '18px 20px',
  boxShadow: 'var(--shadow-sm)',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-1)',
  marginBottom: 14,
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}

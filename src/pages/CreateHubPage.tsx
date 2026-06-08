// ============================================================
//  aiin · CreateHubPage — hub unificado de criação
//  "O que você deseja criar?" → cards grandes → formulário do tipo
// ============================================================
import { useState } from 'react'
import type { Workspace, BrandProfile, Subscription } from '../types/database'
import { BriefingPage } from './BriefingPage'
import { CampaignsPage } from './CampaignsPage'

type CreateKind = 'post_simples' | 'carrossel_5' | 'story' | 'capa_reels' | 'campaign' | null

interface Props {
  workspace: Workspace
  brand: BrandProfile
  subscription: Subscription | null
  credits: number
  navigate: (r: string) => void
}

const CARDS = [
  { id: 'post_simples'   as CreateKind, label: 'Post estático',        sub: '1 crédito',  icon: '▣', color: '#7B2CFF', desc: 'Imagem única para o feed. Lançamentos, frases, promoções.' },
  { id: 'carrossel_5'    as CreateKind, label: 'Carrossel',            sub: '3 créditos', icon: '◫', color: '#F72585', desc: 'Sequência de slides. Tutoriais, listas, antes/depois.' },
  { id: 'story'          as CreateKind, label: 'Story',                sub: '1 crédito',  icon: '▯', color: '#FF6A00', desc: 'Formato 9:16. Promoções relâmpago, bastidores, CTAs.' },
  { id: 'capa_reels'     as CreateKind, label: 'Capa de Reels',        sub: '1 crédito',  icon: '▶', color: '#185FA5', desc: 'Thumbnail chamativa do seu Reels, com texto legível.' },
  { id: 'campaign'       as CreateKind, label: 'Campanha',             sub: 'cronograma', icon: '✦', color: '#1D9E75', desc: 'Planejamento completo: posts, reels e stories por período.' },
]

export function CreateHubPage({ workspace, brand, subscription, credits, navigate }: Props) {
  const [kind, setKind] = useState<CreateKind>(null)

  // Campanha usa a página própria
  if (kind === 'campaign') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setKind(null)} className="btn-back-hub">← Criar</button>
          <h1 className="page-title" style={{ margin: 0 }}>Campanha</h1>
        </div>
        <CampaignsPage workspace={workspace} brand={brand} subscription={subscription} credits={credits} navigate={navigate} />
      </div>
    )
  }

  // Tipos avulsos usam a BriefingPage, com o formato pré-selecionado
  if (kind) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setKind(null)} className="btn-back-hub">← Criar</button>
          <h1 className="page-title" style={{ margin: 0 }}>{CARDS.find(c => c.id === kind)?.label}</h1>
        </div>
        <BriefingPage workspace={workspace} brand={brand} subscription={subscription} credits={credits} navigate={navigate} initialFormat={kind} />
      </div>
    )
  }

  // Hub: cards grandes
  return (
    <div className="create-hub">
      <div className="create-hub-head">
        <h1 className="page-title">O que você deseja criar?</h1>
        <p className="create-hub-sub">Escolha um formato e a aiin cria pra você.</p>
      </div>
      <div className="create-hub-grid">
        {CARDS.map(c => (
          <button key={c.id} className="create-card" onClick={() => setKind(c.id)} style={{ '--card-color': c.color } as React.CSSProperties}>
            <div className="create-card-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
            <div className="create-card-label">{c.label}</div>
            <div className="create-card-sub" style={{ color: c.color }}>{c.sub}</div>
            <div className="create-card-desc">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

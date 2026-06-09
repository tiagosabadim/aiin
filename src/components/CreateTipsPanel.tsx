// ============================================================
//  aiin · CreateTipsPanel — painel lateral da criação
//  Estados: ocioso · gerando-texto · REVISÃO · gerando-imagem · pronto
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { approveOutput } from '../lib/api'

const TIPS = [
  { icon: '📲', title: 'Compartilhamento é o sinal #1', text: 'Em 2026, o algoritmo prioriza posts que as pessoas enviam por DM. Conteúdo que dá vontade de "marcar um amigo" alcança muito mais gente nova.' },
  { icon: '🔖', title: 'Conteúdo salvável vira referência', text: 'Posts que ensinam algo (listas, passo a passo, frameworks) são salvos — e o algoritmo entende isso como alto valor, mostrando pra mais gente.' },
  { icon: '⏱️', title: 'Os 3 primeiros segundos decidem', text: 'A capa precisa parar o scroll. Uma pergunta, um dado surpreendente ou uma promessa específica seguram a atenção e aumentam o alcance.' },
  { icon: '🎠', title: 'Carrosséis retêm mais', text: 'Cada slide deslizado conta como engajamento. Carrosséis de 7-10 slides costumam performar melhor que posts únicos pelo tempo de permanência.' },
  { icon: '🔍', title: 'Legenda com SEO vence hashtags', text: 'Palavras-chave naturais na legenda ajudam o Instagram a entender e recomendar seu post. Use poucas hashtags específicas do nicho, não 30 genéricas.' },
  { icon: '🎬', title: 'Reels trazem seguidores novos', text: 'Reels alcançam quem ainda não te segue — é o motor de crescimento. Intercale com seus posts estáticos pra crescer de verdade.' },
  { icon: '💬', title: 'CTA que gera ação', text: 'Termine pedindo pra salvar, compartilhar ou comentar. Cada interação é um sinal positivo que amplia o alcance do próximo post.' },
  { icon: '📅', title: 'Constância vale mais que volume', text: 'Postar com regularidade ensina o algoritmo a esperar seu conteúdo. Melhor 3 posts ótimos por semana que 10 atropelados.' },
]

interface Props {
  active: boolean
  textLoading?: boolean
  draft?: any | null
  result: any | null
  userId: string
  onConfirmText?: (edited: any) => void
  onApprove: () => void
  onReset: () => void
  onGoToPosts: () => void
}

export function CreateTipsPanel({ active, textLoading, draft, result, userId, onConfirmText, onApprove, onReset, onGoToPosts }: Props) {
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [edited, setEdited] = useState<any | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setIdx(i => (i + 1) % TIPS.length), 3800)
    return () => clearInterval(t)
  }, [active])

  // Quando o draft chega, copia para o estado editável
  useEffect(() => { if (draft) setEdited(JSON.parse(JSON.stringify(draft))) }, [draft])

  useEffect(() => {
    if ((active || result || draft || textLoading) && ref.current && window.innerWidth <= 768) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active, result, draft, textLoading])

  const approve = async () => {
    if (!result) return
    setBusy(true)
    try { await approveOutput(result.id, userId); onApprove() } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!result) return
    setBusy(true)
    try { await supabase.from('creative_outputs').delete().eq('id', result.id); onReset() } finally { setBusy(false) }
  }

  // Helpers de edição do draft
  const updSlide = (i: number, field: string, val: string) => {
    setEdited((e: any) => {
      const copy = JSON.parse(JSON.stringify(e))
      copy.slides[i][field] = val
      return copy
    })
  }
  const updField = (field: string, val: string) => {
    setEdited((e: any) => ({ ...e, [field]: val }))
  }

  const tip = TIPS[idx]

  // ── ESTADO: PRÉVIA PRONTA ──
  if (result) {
    return (
      <div className="create-tips create-tips--result" ref={ref}>
        <div className="create-result-badge">✓ Pronto!</div>
        <div className="create-result-preview"><img src={result.public_url} alt="Prévia" /></div>
        <div className="create-result-actions">
          <button className="create-result-btn primary" onClick={approve} disabled={busy}>✓ Aprovar</button>
          <button className="create-result-btn" onClick={onReset} disabled={busy}>↻ Gerar de novo</button>
          <button className="create-result-btn danger" onClick={remove} disabled={busy}>🗑 Excluir</button>
        </div>
        <button className="create-result-link" onClick={onGoToPosts}>Ver em Aprovar →</button>
      </div>
    )
  }

  // ── ESTADO: REVISÃO DO TEXTO ──
  if (draft && edited) {
    const slides = edited.slides ?? []
    return (
      <div className="create-tips create-tips--review" ref={ref}>
        <div className="create-review-head">
          <div className="create-review-title">✍️ Revise o texto</div>
          <div className="create-review-sub">Ajuste o que quiser. Quando gerar a imagem, o crédito é debitado.</div>
        </div>

        <div className="create-review-body">
          {slides.map((s: any, i: number) => (
            <div key={i} className="create-review-slide">
              <div className="create-review-slidenum">{slides.length > 1 ? `Slide ${i + 1}` : 'Post'}</div>
              <label className="create-review-label">Título</label>
              <textarea className="create-review-input" rows={2} value={s.headline ?? ''} onChange={e => updSlide(i, 'headline', e.target.value)} />
              <label className="create-review-label">Texto</label>
              <textarea className="create-review-input" rows={2} value={s.body ?? ''} onChange={e => updSlide(i, 'body', e.target.value)} />
              {(s.cta || i === slides.length - 1) && (<>
                <label className="create-review-label">CTA</label>
                <textarea className="create-review-input" rows={1} value={s.cta ?? ''} onChange={e => updSlide(i, 'cta', e.target.value)} />
              </>)}
              <label className="create-review-label">Conceito visual (o que a imagem vai mostrar)</label>
              <textarea className="create-review-input subtle" rows={2} value={s.visual_prompt ?? ''} onChange={e => updSlide(i, 'visual_prompt', e.target.value)} />
            </div>
          ))}

          <div className="create-review-slide">
            <label className="create-review-label">Legenda</label>
            <textarea className="create-review-input" rows={5} value={edited.caption ?? ''} onChange={e => updField('caption', e.target.value)} />
          </div>
        </div>

        <div className="create-review-actions">
          <button className="create-result-btn primary" onClick={() => onConfirmText?.(edited)}>✦ Gerar imagens</button>
          <button className="create-result-btn" onClick={() => onConfirmText?.(draft)}>Pular e gerar (texto original)</button>
        </div>
      </div>
    )
  }

  // ── ESTADO: GERANDO TEXTO ──
  if (textLoading) {
    return (
      <div className="create-tips" ref={ref}>
        <div className="create-tips-loader">
          <div className="create-tips-orb"><div className="create-tips-orb-glow" /><span>✦</span></div>
          <div className="create-tips-status">Montando o texto…</div>
          <div className="create-tips-dots">{[0,1,2].map(i => <span key={i} style={{ animationDelay: `${i*0.18}s` }} />)}</div>
        </div>
        <div className="create-tips-card"><div className="create-tips-text" style={{ textAlign: 'center' }}>Logo você vai poder revisar e ajustar antes de virar imagem.</div></div>
      </div>
    )
  }

  // ── ESTADO: GERANDO IMAGEM (dicas passando) ──
  if (active) {
    return (
      <div className="create-tips" ref={ref}>
        <div className="create-tips-loader">
          <div className="create-tips-orb"><div className="create-tips-orb-glow" /><span>✦</span></div>
          <div className="create-tips-status">A aiin está criando…</div>
          <div className="create-tips-dots">{[0,1,2].map(i => <span key={i} style={{ animationDelay: `${i*0.18}s` }} />)}</div>
        </div>
        <div className="create-tips-card" key={idx}>
          <div className="create-tips-eyebrow">Enquanto isso, uma dica</div>
          <div className="create-tips-icon">{tip.icon}</div>
          <div className="create-tips-title">{tip.title}</div>
          <div className="create-tips-text">{tip.text}</div>
        </div>
        <div className="create-tips-progress">{TIPS.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} />)}</div>
      </div>
    )
  }

  // ── ESTADO: OCIOSO ──
  return (
    <div className="create-tips" ref={ref}>
      <div className="create-tips-idle">
        <div className="create-tips-orb idle"><span>✦</span></div>
        <div className="create-tips-idle-title">Pronto pra criar algo que engaja</div>
        <div className="create-tips-idle-text">
          Preencha as informações ao lado. A aiin aplica as melhores práticas do algoritmo do Instagram pra criar conteúdo que para o scroll, gera salvamentos e compartilhamentos.
        </div>
      </div>
    </div>
  )
}

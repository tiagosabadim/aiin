// ============================================================
//  aiin · CreateTipsPanel — painel lateral da criação
//  Mostra dicas de algoritmo/boas práticas que passam durante
//  a geração. Transforma a espera em valor (o cliente aprende).
// ============================================================
import { useState, useEffect, useRef } from 'react'

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

export function CreateTipsPanel({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // No mobile, quando começa a gerar, rola até o painel pra o usuário ver o loading
  useEffect(() => {
    if (active && ref.current && window.innerWidth <= 768) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active])

  // Rotaciona as dicas enquanto está gerando
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setIdx(i => (i + 1) % TIPS.length), 3800)
    return () => clearInterval(t)
  }, [active])

  const tip = TIPS[idx]

  return (
    <div className="create-tips" ref={ref}>
      {active ? (
        <>
          {/* Loader da marca */}
          <div className="create-tips-loader">
            <div className="create-tips-orb">
              <div className="create-tips-orb-glow" />
              <span>✦</span>
            </div>
            <div className="create-tips-status">A aiin está criando…</div>
            <div className="create-tips-dots">
              {[0, 1, 2].map(i => <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />)}
            </div>
          </div>

          {/* Dica que passa */}
          <div className="create-tips-card" key={idx}>
            <div className="create-tips-eyebrow">Enquanto isso, uma dica</div>
            <div className="create-tips-icon">{tip.icon}</div>
            <div className="create-tips-title">{tip.title}</div>
            <div className="create-tips-text">{tip.text}</div>
          </div>

          {/* Progresso das dicas */}
          <div className="create-tips-progress">
            {TIPS.map((_, i) => (
              <span key={i} className={i === idx ? 'on' : ''} />
            ))}
          </div>
        </>
      ) : (
        /* Estado ocioso: motivação antes de gerar */
        <div className="create-tips-idle">
          <div className="create-tips-orb idle">
            <span>✦</span>
          </div>
          <div className="create-tips-idle-title">Pronto pra criar algo que engaja</div>
          <div className="create-tips-idle-text">
            Preencha as informações ao lado. A aiin aplica as melhores práticas do algoritmo do Instagram pra criar conteúdo que para o scroll, gera salvamentos e compartilhamentos.
          </div>
        </div>
      )}
    </div>
  )
}

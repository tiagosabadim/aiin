// ============================================================
//  aiin · Loader — componente de loading padrão da marca
//  Use em qualquer espera para experiência consistente.
//
//  <Loader />                    → inline, centralizado (padrão)
//  <Loader fullscreen />         → tela cheia (ex: carregamento de página)
//  <Loader label="Salvando..." />→ com mensagem
//  <Loader size="sm" />          → pequeno (dentro de cards menores)
//  <LoaderDots />                → só os 3 pontos (para botões/linhas)
// ============================================================

interface LoaderProps {
  fullscreen?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Loader({ fullscreen = false, label, size = 'md' }: LoaderProps) {
  const dim = size === 'sm' ? 36 : size === 'lg' ? 60 : 48
  const icon = size === 'sm' ? 16 : size === 'lg' ? 26 : 21

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: dim, height: dim }}>
        {/* halo pulsante */}
        <div className="aiin-loader-halo" style={{ position: 'absolute', inset: -6, borderRadius: '32%', background: 'var(--gradient)', opacity: .25, filter: 'blur(8px)' }} />
        {/* logo */}
        <div style={{ position: 'relative', width: dim, height: dim, borderRadius: dim * 0.32, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: icon, color: '#fff', boxShadow: '0 8px 24px rgba(247,37,133,.3)' }}>✦</div>
      </div>
      <LoaderDots />
      {label && <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500, textAlign: 'center' }}>{label}</div>}
    </div>
  )

  if (fullscreen) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        {content}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', width: '100%' }}>
      {content}
    </div>
  )
}

export function LoaderDots({ color }: { color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color ?? 'var(--accent-pink)',
          animation: `aiinLoaderPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

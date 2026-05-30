// aiin · Brazilian Marketing Calendar
// Feriados nacionais + datas comemorativas + campanhas com antecipação

export interface MarketingDate {
  date: string        // YYYY-MM-DD
  label: string
  type: 'holiday' | 'campaign' | 'awareness' | 'season' | 'profession'
  color: string
  emoji: string
  prepDays?: number  // dias antes para começar campanha (se aplicável)
  prepLabel?: string // label do início da campanha
}

// Gera datas para um ano específico
export function getBrazilianCalendar(year: number): MarketingDate[] {
  const dates: MarketingDate[] = []

  // ── FERIADOS NACIONAIS ─────────────────────────────────────
  const holidays: Omit<MarketingDate, 'date'>[] = [
    { label: 'Ano Novo',              type: 'holiday',   color: '#7B2CFF', emoji: '🎆' },
    { label: 'Tiradentes',            type: 'holiday',   color: '#6B7280', emoji: '🇧🇷' },
    { label: 'Dia do Trabalho',       type: 'holiday',   color: '#6B7280', emoji: '👷' },
    { label: 'Independência do Brasil',type:'holiday',   color: '#1D9E75', emoji: '🇧🇷' },
    { label: 'Nossa Sra. Aparecida',  type: 'holiday',   color: '#6B7280', emoji: '⛪' },
    { label: 'Finados',               type: 'holiday',   color: '#6B7280', emoji: '🕯' },
    { label: 'Proclamação da República',type:'holiday',  color: '#6B7280', emoji: '🇧🇷' },
    { label: 'Natal',                 type: 'holiday',   color: '#E24B4A', emoji: '🎄' },
  ]

  const holidayDates = [
    `${year}-01-01`, `${year}-04-21`, `${year}-05-01`,
    `${year}-09-07`, `${year}-10-12`, `${year}-11-02`,
    `${year}-11-15`, `${year}-12-25`,
  ]
  holidays.forEach((h, i) => dates.push({ ...h, date: holidayDates[i] }))

  // Carnaval (variável — calculado a partir da Páscoa)
  const easter = getEaster(year)
  const carnival = addDays(easter, -47)
  const carnival2 = addDays(easter, -46)
  dates.push({ date: fmt(carnival),  label: 'Carnaval (segunda)', type: 'holiday', color: '#FF6A00', emoji: '🎭', prepDays: 14, prepLabel: 'Início campanha Carnaval' })
  dates.push({ date: fmt(carnival2), label: 'Carnaval (terça)',   type: 'holiday', color: '#FF6A00', emoji: '🎭' })
  dates.push({ date: fmt(addDays(easter, -2)), label: 'Sexta-feira Santa', type: 'holiday', color: '#6B7280', emoji: '✝️' })
  dates.push({ date: fmt(easter),              label: 'Páscoa',            type: 'holiday', color: '#FF6A00', emoji: '🐣', prepDays: 21, prepLabel: 'Início campanha Páscoa' })
  dates.push({ date: fmt(addDays(easter, 60)), label: 'Corpus Christi',    type: 'holiday', color: '#6B7280', emoji: '⛪' })

  // ── DATAS COMERCIAIS PRINCIPAIS ───────────────────────────
  const commercial: MarketingDate[] = [
    // Janeiro
    { date: `${year}-01-15`, label: 'Férias de verão (pico)',    type: 'season',   color: '#FF6A00', emoji: '☀️' },

    // Fevereiro
    { date: `${year}-02-14`, label: 'Dia dos Namorados (BR)',    type: 'campaign', color: '#F72585', emoji: '💕',
      prepDays: 10, prepLabel: '🔔 Início campanha Namorados' },

    // Março
    { date: `${year}-03-08`, label: 'Dia da Mulher',             type: 'campaign', color: '#F72585', emoji: '👩',
      prepDays: 7, prepLabel: '🔔 Início campanha Dia da Mulher' },

    // Abril
    { date: `${year}-04-01`, label: 'Dia da Mentira',            type: 'awareness', color: '#7B2CFF', emoji: '🤥' },

    // Maio
    { date: `${year}-05-11`, label: 'Dia das Mães',              type: 'campaign', color: '#F72585', emoji: '🌸',
      prepDays: 14, prepLabel: '🔔 Início campanha Dia das Mães' },

    // Junho
    { date: `${year}-06-12`, label: 'Dia dos Namorados',         type: 'campaign', color: '#F72585', emoji: '❤️',
      prepDays: 10, prepLabel: '🔔 Início campanha Namorados' },
    { date: `${year}-06-13`, label: 'Festa Junina (Santo Antônio)',type:'awareness',color:'#FF6A00', emoji: '🎪' },
    { date: `${year}-06-24`, label: 'Festa Junina (São João)',    type: 'awareness', color: '#FF6A00', emoji: '🎪',
      prepDays: 10, prepLabel: '🔔 Início campanha Festa Junina' },

    // Julho
    { date: `${year}-07-14`, label: 'Férias escolares (pico)',   type: 'season',   color: '#1D9E75', emoji: '🏖' },

    // Agosto
    { date: `${year}-08-11`, label: 'Dia dos Pais',              type: 'campaign', color: '#185FA5', emoji: '👨',
      prepDays: 14, prepLabel: '🔔 Início campanha Dia dos Pais' },
    { date: `${year}-08-13`, label: 'Dia dos Avós',              type: 'awareness', color: '#6B7280', emoji: '👴' },

    // Setembro
    { date: `${year}-09-15`, label: 'Dia do Cliente',            type: 'campaign', color: '#1D9E75', emoji: '🤝',
      prepDays: 5, prepLabel: '🔔 Início campanha Dia do Cliente' },

    // Outubro
    { date: `${year}-10-01`, label: 'Dia das Crianças (prep)',   type: 'campaign', color: '#FF6A00', emoji: '🧸',
      prepDays: 0, prepLabel: '' },
    { date: `${year}-10-12`, label: 'Dia das Crianças',          type: 'campaign', color: '#FF6A00', emoji: '🧸',
      prepDays: 14, prepLabel: '🔔 Início campanha Crianças' },
    { date: `${year}-10-31`, label: 'Halloween',                 type: 'campaign', color: '#FF6A00', emoji: '🎃',
      prepDays: 7, prepLabel: '🔔 Início campanha Halloween' },

    // Novembro
    { date: `${year}-11-11`, label: 'Início Black Friday (prep)', type: 'campaign', color: '#070D1F', emoji: '🛒' },
    { date: `${year}-11-20`, label: 'Consciência Negra',         type: 'awareness', color: '#374151', emoji: '✊' },
    { date: `${year}-11-28`, label: 'Black Friday',              type: 'campaign', color: '#070D1F', emoji: '🛒',
      prepDays: 21, prepLabel: '🔔 Início campanha Black Friday' },
    { date: `${year}-11-29`, label: 'Sábado Black',              type: 'campaign', color: '#070D1F', emoji: '🛒' },
    { date: `${year}-12-02`, label: 'Cyber Monday',              type: 'campaign', color: '#185FA5', emoji: '💻' },

    // Dezembro
    { date: `${year}-12-01`, label: 'Dezembro Vermelho',         type: 'awareness', color: '#E24B4A', emoji: '🎗' },
    { date: `${year}-12-08`, label: 'Início temporada Natal',    type: 'season',   color: '#E24B4A', emoji: '🎅' },
    { date: `${year}-12-18`, label: 'Último final de semana compras Natal', type: 'campaign', color: '#E24B4A', emoji: '🎁' },
    { date: `${year}-12-31`, label: 'Réveillon',                 type: 'campaign', color: '#7B2CFF', emoji: '🎆',
      prepDays: 7, prepLabel: '🔔 Início campanha Réveillon' },
  ]

  dates.push(...commercial)

  // ── DATAS DE PROFISSÕES (homenagear o público da marca) ──
  const professions: MarketingDate[] = [
    { date: `${year}-01-31`, label: 'Dia do Empreendedor',          type: 'profession', color: '#7B2CFF', emoji: '💼' },
    { date: `${year}-02-09`, label: 'Dia do Zelador',               type: 'profession', color: '#1D9E75', emoji: '🧹' },
    { date: `${year}-03-04`, label: 'Dia do Vendedor',              type: 'profession', color: '#FF6A00', emoji: '🛍' },
    { date: `${year}-03-23`, label: 'Dia do Corretor de Imóveis',   type: 'profession', color: '#185FA5', emoji: '🏠' },
    { date: `${year}-04-12`, label: 'Dia do Obstetra',              type: 'profession', color: '#F72585', emoji: '🩺' },
    { date: `${year}-04-19`, label: 'Dia do Publicitário',          type: 'profession', color: '#7B2CFF', emoji: '📢' },
    { date: `${year}-04-22`, label: 'Dia do Designer',              type: 'profession', color: '#F72585', emoji: '🎨' },
    { date: `${year}-05-02`, label: 'Dia do Esteticista',           type: 'profession', color: '#F72585', emoji: '💆' },
    { date: `${year}-05-31`, label: 'Dia do Cabeleireiro',          type: 'profession', color: '#FF6A00', emoji: '💇' },
    { date: `${year}-06-15`, label: 'Dia do Personal Trainer',      type: 'profession', color: '#1D9E75', emoji: '💪' },
    { date: `${year}-07-02`, label: 'Dia do Bombeiro',              type: 'profession', color: '#E24B4A', emoji: '🚒' },
    { date: `${year}-07-25`, label: 'Dia do Motorista',             type: 'profession', color: '#374151', emoji: '🚗' },
    { date: `${year}-07-27`, label: 'Dia do Despachante',           type: 'profession', color: '#6B7280', emoji: '📋' },
    { date: `${year}-08-04`, label: 'Dia do Padre',                 type: 'profession', color: '#6B7280', emoji: '⛪' },
    { date: `${year}-08-22`, label: 'Dia do Contador',              type: 'profession', color: '#185FA5', emoji: '🧮' },
    { date: `${year}-08-25`, label: 'Dia do Feirante',              type: 'profession', color: '#1D9E75', emoji: '🥬' },
    { date: `${year}-08-31`, label: 'Dia do Nutricionista',         type: 'profession', color: '#1D9E75', emoji: '🥗' },
    { date: `${year}-09-09`, label: 'Dia do Médico Veterinário',    type: 'profession', color: '#1D9E75', emoji: '🐾' },
    { date: `${year}-09-10`, label: 'Dia do Pedagogo',              type: 'profession', color: '#7B2CFF', emoji: '📖' },
    { date: `${year}-09-27`, label: 'Dia do Encanador',             type: 'profession', color: '#185FA5', emoji: '🔧' },
    { date: `${year}-09-28`, label: 'Dia do Cabeleireiro (2)',      type: 'profession', color: '#FF6A00', emoji: '✂️' },
    { date: `${year}-09-30`, label: 'Dia da Secretária',            type: 'profession', color: '#F72585', emoji: '📇' },
    { date: `${year}-10-15`, label: 'Dia do Professor',             type: 'profession', color: '#7B2CFF', emoji: '📚' },
    { date: `${year}-10-18`, label: 'Dia do Médico',                type: 'profession', color: '#1D9E75', emoji: '⚕️' },
    { date: `${year}-10-23`, label: 'Dia do Aviador',               type: 'profession', color: '#185FA5', emoji: '✈️' },
    { date: `${year}-10-25`, label: 'Dia do Dentista',              type: 'profession', color: '#185FA5', emoji: '🦷' },
    { date: `${year}-10-28`, label: 'Dia do Servidor Público',      type: 'profession', color: '#6B7280', emoji: '🏛' },
    { date: `${year}-10-30`, label: 'Dia do Comerciário',           type: 'profession', color: '#FF6A00', emoji: '🏪' },
    { date: `${year}-11-13`, label: 'Dia do Pedreiro',              type: 'profession', color: '#FF6A00', emoji: '🧱' },
    { date: `${year}-12-09`, label: 'Dia do Fonoaudiólogo',         type: 'profession', color: '#F72585', emoji: '🗣' },
    { date: `${year}-12-10`, label: 'Dia do Arquiteto',             type: 'profession', color: '#7B2CFF', emoji: '📐' },
    { date: `${year}-12-20`, label: 'Dia do Mecânico',              type: 'profession', color: '#374151', emoji: '🔩' },
  ]
  dates.push(...professions)

  // ── ADICIONAR DATAS DE INÍCIO DE CAMPANHA ─────────────────
  const withPrep: MarketingDate[] = []
  dates.forEach(d => {
    withPrep.push(d)
    if (d.prepDays && d.prepDays > 0 && d.prepLabel) {
      const prepDate = addDays(new Date(d.date + 'T12:00:00'), -d.prepDays)
      withPrep.push({
        date: fmt(prepDate),
        label: d.prepLabel,
        type: 'campaign',
        color: d.color,
        emoji: '📣',
      })
    }
  })

  // Ordenar por data
  return withPrep.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Helpers ────────────────────────────────────────────────
function getEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Retorna datas de marketing do dia/semana (para exibição no calendário)
export function getMarketingDatesForMonth(year: number, month: number): Record<number, MarketingDate[]> {
  const all = getBrazilianCalendar(year)
  const byDay: Record<number, MarketingDate[]> = {}
  all.forEach(d => {
    const [y, m, day] = d.date.split('-').map(Number)
    if (y === year && m === month) {
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(d)
    }
  })
  return byDay
}

// Próximas datas importantes (para widget no dashboard/agenda)
export function getUpcomingDates(daysAhead: number = 30): MarketingDate[] {
  const year = new Date().getFullYear()
  const all = [...getBrazilianCalendar(year), ...getBrazilianCalendar(year + 1)]
  const today = new Date().toISOString().split('T')[0]
  const limit = new Date()
  limit.setDate(limit.getDate() + daysAhead)
  const limitStr = limit.toISOString().split('T')[0]
  return all.filter(d => d.date >= today && d.date <= limitStr)
}

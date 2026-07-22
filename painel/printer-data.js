export const SEVERITY_COLOR = {
  ok: 'oklch(72% 0.12 155)',
  warning: 'oklch(80% 0.15 85)',
  critical: 'oklch(68% 0.19 25)',
  unknown: '#8b8fa3',
  offline: '#75798c',
};

export const SEVERITY_LABEL = {
  ok: 'Normal',
  warning: 'Atenção',
  critical: 'Crítico',
  unknown: 'Sem leitura',
};

function daysSince(dateStr) {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function severityOf(p) {
  if (p.status === 'offline') return 'critical';
  if (p.wasteBox >= 95) return 'critical';
  if (p.cartridges.some((c) => !c.semLeitura && c.level <= 5)) return 'critical';
  if (p.cartridges.some((c) => c.semLeitura && c.alerta === 'critico')) return 'critical';
  if (p.wasteBox >= 80) return 'warning';
  if (p.cartridges.some((c) => !c.semLeitura && c.level <= 25)) return 'warning';
  if (p.cartridges.some((c) => c.semLeitura && (c.alerta === 'baixo' || c.alerta === 'atencao'))) return 'warning'; if (p.lastMaintenance && daysSince(p.lastMaintenance) > 180) return 'warning';
  if (p.cartridges.some((c) => c.semLeitura && c.ehToner)) return 'unknown';
  return 'ok';
}

export function severityColor(p) {
  return SEVERITY_COLOR[severityOf(p)];
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function adaptarImpressora(imp) {
  const suprimentos = imp.suprimentos || [];
  const residuos = suprimentos.find((s) => s.tipo === 'residuos');
  const consumiveis = suprimentos.filter((s) => s.tipo !== 'residuos');

  return {
    id: imp.id,
    name: imp.nome,
    sector: imp.sala,
    floor: imp.ip,
    model: imp.modelo || 'Modelo desconhecido',
    ip: imp.ip,
    status: imp.conectada ? 'online' : 'offline',
    temCaixa: !!residuos,
    wasteBox: residuos && residuos.percentual !== null ? residuos.percentual : 0,
    lastMaintenance: null,
    cartridges: consumiveis.map(function (s) {
      const ehToner = s.tipo === 'toner';
      if (s.percentual !== null) {
        return {
          name: s.descricao || 'Consumível',
          level: s.percentual,
          ehToner: ehToner,
          semLeitura: false,
          alerta: s.alerta,
        };
      }
      return {
        name: s.descricao || 'Consumível',
        level: 0,
        ehToner: ehToner,
        semLeitura: true,
        alerta: s.alerta,
      };
    }),
  };
}

export const EVENT_SEVERITY = {
  offline: 'critical',
  critico: 'critical',
  atencao: 'warning',
  'sem-leitura': 'unknown',
  normalizou: 'ok',
  troca: 'ok',
  normalizou: 'ok',
  troca: 'ok',
  estoque: 'warning',
};

export const EVENT_LABEL = {
  offline: 'Offline',
  critico: 'Crítico',
  atencao: 'Atenção',
  'sem-leitura': 'Sem leitura',
  normalizou: 'Normalizado',
  troca: 'Troca de toner',
  normalizou: 'Normalizado',
  troca: 'Troca de toner',
  estoque: 'Estoque',
};

export function allEvents() {
  return [];
}

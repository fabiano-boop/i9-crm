import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Zap,
  Globe,
  MessageSquare,
  BarChart2,
  AlertTriangle,
  CheckCircle,
  Star,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CRMStats {
  totalClients: number;
  clientsByTier: { basic: number; pro: number; premium: number };
  mrrReal: number;
  mrrGrowth: number;
  leadsCount: number;
}

interface MRRMonth {
  month: string;
  conservador: number;
  otimista: number;
  real?: number;
}

// ─── Dados estáticos de mercado (atualizar trimestralmente) ───────────────────
const MARKET_SEGMENTS = [
  { name: "Salões de beleza", presence: 83, potential: 95, color: "#00D4FF" },
  { name: "Alimentação", presence: 82, potential: 90, color: "#00B4D8" },
  { name: "Pet shops", presence: 75, potential: 88, color: "#0096B7" },
  { name: "Academias", presence: 72, potential: 85, color: "#0077A3" },
  { name: "Clínicas estética", presence: 68, potential: 92, color: "#005F8A" },
  { name: "Oficinas", presence: 45, potential: 78, color: "#004A6E" },
];

const TRENDS_2026 = [
  {
    icon: Zap,
    title: "IA como infraestrutura",
    desc: "58% das empresas já usam IA. Agências com automação entregam mais com menos custo.",
    badge: "Urgente",
    badgeColor: "bg-purple-500/20 text-purple-300",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Marketing + IA",
    desc: "Canal principal para PMEs. Automação via agente IA reduz custo de atendimento em 60%.",
    badge: "A i9 já tem",
    badgeColor: "bg-cyan-500/20 text-cyan-300",
  },
  {
    icon: Globe,
    title: "Vídeo curto domina",
    desc: "99,5% dos brasileiros consomem vídeo. TikTok Shop cresceu 4000% em 3 meses.",
    badge: "Alto ROI",
    badgeColor: "bg-green-500/20 text-green-300",
  },
  {
    icon: BarChart2,
    title: "GEO — Otimização para IA",
    desc: "Ser citado pelo ChatGPT/Gemini quando clientes pesquisam. 24% das empresas já adotam.",
    badge: "Emergente",
    badgeColor: "bg-amber-500/20 text-amber-300",
  },
];

const SERVICES_PRICING = [
  { service: "Site + Landing Page", range: "R$2k–5k", type: "Pontual", roi: 90 },
  { service: "Social Media (Instagram/TikTok)", range: "R$1,5k–3k/mês", type: "Recorrente", roi: 75 },
  { service: "Tráfego Pago (Meta + Google)", range: "R$800–2k/mês", type: "Recorrente", roi: 80 },
  { service: "Agente Maya (IA WhatsApp)", range: "R$500–1,5k/mês", type: "Add-on", roi: 95 },
  { service: "Google Meu Negócio + SEO Local", range: "R$400–800/mês", type: "Recorrente", roi: 70 },
  { service: "Relatório PDF Mensal", range: "Incluso", type: "Retenção", roi: 60 },
];

const RISKS = [
  { level: "high", title: "Banimento do número da Maya", mitigation: "Modo controlado ativo. Nunca disparar em massa. Manter backup de número secundário." },
  { level: "medium", title: "Churn nos primeiros 60 dias", mitigation: "Garantir resultado visível no mês 1. Relatório PDF automático aumenta percepção de valor." },
  { level: "medium", title: "Capacidade operacional", mitigation: "Máx. 5 clientes antes de contratar. Definir processos antes de escalar." },
  { level: "low", title: "Concorrência de freelancers", mitigation: "Diferencial: CRM + IA + relatório. Sistema difícil de copiar por freelancer solo." },
];

const TIER_PRICES = { basic: 1800, pro: 3500, premium: 7000 };

const GROWTH_PROJECTION: MRRMonth[] = [
  { month: "M1", conservador: 6000, otimista: 9000 },
  { month: "M2", conservador: 9000, otimista: 14000 },
  { month: "M3", conservador: 13000, otimista: 20000 },
  { month: "M4", conservador: 18000, otimista: 27000 },
  { month: "M5", conservador: 24000, otimista: 35000 },
  { month: "M6", conservador: 30000, otimista: 44000 },
  { month: "M7", conservador: 36000, otimista: 52000 },
  { month: "M8", conservador: 42000, otimista: 60000 },
  { month: "M9", conservador: 48000, otimista: 68000 },
  { month: "M10", conservador: 55000, otimista: 77000 },
  { month: "M11", conservador: 62000, otimista: 86000 },
  { month: "M12", conservador: 70000, otimista: 95000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1b2a] border border-cyan-500/20 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-cyan-400 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmtBRL(p.value)}</p>
      ))}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MarketIntelligence() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simulator state
  const [simBasic, setSimBasic] = useState(5);
  const [simPro, setSimPro] = useState(3);
  const [simPremium, setSimPremium] = useState(1);

  const simMRR = simBasic * TIER_PRICES.basic + simPro * TIER_PRICES.pro + simPremium * TIER_PRICES.premium;
  const simTotal = simBasic + simPro + simPremium;
  const simARR = simMRR * 12;
  const simAvgTicket = simTotal > 0 ? Math.round(simMRR / simTotal) : 0;

  const PIE_DATA = [
    { name: "Básico", value: simBasic * TIER_PRICES.basic },
    { name: "Pro", value: simPro * TIER_PRICES.pro },
    { name: "Premium", value: simPremium * TIER_PRICES.premium },
  ];
  const PIE_COLORS = ["#00D4FF", "#0077A3", "#005F8A"];

  // Busca dados reais do CRM
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const [clientsRes, leadsRes] = await Promise.all([
          fetch("/api/clients", { headers }),
          fetch("/api/leads", { headers }),
        ]);

        const clients = clientsRes.ok ? await clientsRes.json() : [];
        const leads = leadsRes.ok ? await leadsRes.json() : [];

        const clientList = Array.isArray(clients?.clients) ? clients.clients : Array.isArray(clients) ? clients : [];
        const leadList = Array.isArray(leads?.leads) ? leads.leads : Array.isArray(leads) ? leads : [];

        // Calcular MRR real baseado nos planos dos clientes
        const tierMap: Record<string, "basic" | "pro" | "premium"> = {};
        let basic = 0, pro = 0, premium = 0;

        clientList.forEach((c: any) => {
          const plan = (c.plan || c.tier || c.package || "").toLowerCase();
          if (plan.includes("premium") || plan.includes("premium")) premium++;
          else if (plan.includes("pro")) pro++;
          else basic++;
        });

        const mrrCalc = basic * TIER_PRICES.basic + pro * TIER_PRICES.pro + premium * TIER_PRICES.premium;

        setStats({
          totalClients: clientList.length,
          clientsByTier: { basic, pro, premium },
          mrrReal: mrrCalc,
          mrrGrowth: 12,
          leadsCount: leadList.length,
        });

        // Inicializar simulator com dados reais
        if (clientList.length > 0) {
          setSimBasic(Math.max(basic, 1));
          setSimPro(Math.max(pro, 1));
          setSimPremium(Math.max(premium, 0));
        }
      } catch {
        // Fallback com valores demo
        setStats({
          totalClients: 0,
          clientsByTier: { basic: 0, pro: 0, premium: 0 },
          mrrReal: 0,
          mrrGrowth: 0,
          leadsCount: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [lastUpdated]);

  const refresh = () => setLastUpdated(new Date());

  return (
    <div className="min-h-screen bg-[#0a1628] text-white p-6 space-y-8">

      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-500/70 mb-1">Módulo estratégico</p>
          <h1 className="text-2xl font-semibold text-white">Inteligência de Mercado</h1>
          <p className="text-sm text-slate-400 mt-1">
            Dados reais do CRM + análise do mercado digital para PMEs da Zona Leste · Atualizado abr/2026
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar dados
        </button>
      </div>

      {/* ── KPIs reais do CRM ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Sua operação atual</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "MRR atual",
              value: loading ? "—" : fmtBRL(stats?.mrrReal || 0),
              sub: stats?.mrrReal === 0 ? "Adicione clientes com plano" : "+12% vs mês anterior",
              icon: DollarSign,
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Clientes ativos",
              value: loading ? "—" : String(stats?.totalClients || 0),
              sub: `${stats?.clientsByTier.basic || 0} básico · ${stats?.clientsByTier.pro || 0} pro · ${stats?.clientsByTier.premium || 0} premium`,
              icon: Users,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Leads no funil",
              value: loading ? "—" : String(stats?.leadsCount || 0),
              sub: "Leads ativos no CRM",
              icon: Target,
              color: "text-purple-400",
              bg: "bg-purple-500/10",
            },
            {
              label: "TAM Zona Leste",
              value: "R$24M",
              sub: "~80k PMEs mapeadas",
              icon: Globe,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#111f35] border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <div className={`${kpi.bg} p-1.5 rounded-lg`}>
                  <kpi.icon size={14} className={kpi.color} />
                </div>
              </div>
              <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Simulador de MRR ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Simulador de receita recorrente</p>
        <div className="bg-[#111f35] border border-slate-700/50 rounded-xl p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sliders */}
            <div className="space-y-5">
              {[
                { label: "Clientes Básico", price: TIER_PRICES.basic, val: simBasic, set: setSimBasic, max: 20, color: "#00D4FF" },
                { label: "Clientes Pro", price: TIER_PRICES.pro, val: simPro, set: setSimPro, max: 15, color: "#0077A3" },
                { label: "Clientes Premium", price: TIER_PRICES.premium, val: simPremium, set: setSimPremium, max: 10, color: "#005F8A" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-300">{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{fmtBRL(s.price)}/mês</span>
                      <span className="text-sm font-medium text-white w-6 text-right">{s.val}</span>
                    </div>
                  </div>
                  <input
                    type="range" min={0} max={s.max} step={1} value={s.val}
                    onChange={(e) => s.set(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: s.color }}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { label: "MRR simulado", value: fmtBRL(simMRR), color: "text-cyan-400" },
                  { label: "ARR projetado", value: fmtBRL(simARR), color: "text-blue-400" },
                  { label: "Total clientes", value: String(simTotal), color: "text-purple-400" },
                  { label: "Ticket médio", value: fmtBRL(simAvgTicket), color: "text-amber-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                    <p className={`text-lg font-semibold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Donut */}
            <div className="flex flex-col items-center justify-center">
              <p className="text-xs text-slate-400 mb-3">Composição do MRR</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
                    {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "#0d1b2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs text-slate-400 mt-1">
                {["Básico", "Pro", "Premium"].map((l, i) => (
                  <span key={l} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: PIE_COLORS[i] }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Projeção 12 meses ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Projeção de crescimento — 12 meses</p>
        <div className="bg-[#111f35] border border-slate-700/50 rounded-xl p-5">
          <div className="flex gap-4 text-xs text-slate-400 mb-4">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" />Conservador</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded border-dashed border-b border-blue-400" />Otimista</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={GROWTH_PROJECTION} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="conservador" name="Conservador" stroke="#00D4FF" strokeWidth={2} fill="url(#gc)" />
              <Area type="monotone" dataKey="otimista" name="Otimista" stroke="#378ADD" strokeWidth={2} strokeDasharray="5 3" fill="url(#go)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Segmentos e serviços ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Segmentos prioritários */}
        <section>
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Segmentos prioritários — Zona Leste</p>
          <div className="bg-[#111f35] border border-slate-700/50 rounded-xl p-5 space-y-4">
            {MARKET_SEGMENTS.map((seg) => (
              <div key={seg.name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-slate-300">{seg.name}</span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-slate-500">Presença: {seg.presence}%</span>
                    <span style={{ color: seg.color }}>Potencial: {seg.potential}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                  <div className="h-full bg-slate-600 rounded-full" style={{ width: `${seg.presence}%` }} />
                  <div className="h-full rounded-full absolute top-0 opacity-40" style={{ width: `${seg.potential}%`, background: seg.color }} />
                </div>
                <p className="text-xs text-slate-600 mt-1">Gap de {seg.potential - seg.presence}% sem atendimento digital especializado</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tabela de serviços */}
        <section>
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Serviços e precificação</p>
          <div className="bg-[#111f35] border border-slate-700/50 rounded-xl p-5 space-y-3">
            {SERVICES_PRICING.map((s) => (
              <div key={s.service} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{s.service}</p>
                  <p className="text-xs text-slate-500">{s.range}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{s.type}</span>
                </div>
                <div className="w-20 flex-shrink-0">
                  <div className="h-1 bg-slate-800 rounded-full">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${s.roi}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 text-right mt-0.5">{s.roi}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Tendências 2026 ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Tendências críticas 2026</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRENDS_2026.map((t) => (
            <div key={t.title} className="bg-[#111f35] border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-cyan-500/10 p-2 rounded-lg">
                  <t.icon size={16} className="text-cyan-400" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.badgeColor}`}>{t.badge}</span>
              </div>
              <p className="text-sm font-medium text-white mb-2">{t.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fases de implantação ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Plano de implantação</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            {
              phase: "Fase 1", period: "Semanas 1–4", color: "border-cyan-500/50 bg-cyan-500/5",
              badge: "Fundação", badgeColor: "bg-cyan-500/20 text-cyan-300",
              items: ["2–3 clientes teste (salão/clínica)", "Montar portfólio com cases reais", "Definir pacotes Básico/Pro/Premium", "Ativar Maya para demos ao vivo"],
              target: "R$5k–8k MRR",
            },
            {
              phase: "Fase 2", period: "Meses 2–4", color: "border-blue-500/50 bg-blue-500/5",
              badge: "Escala", badgeColor: "bg-blue-500/20 text-blue-300",
              items: ["Prospecção ativa nos 80k SMBs", "Maya como canal de qualificação", "Pacote 'presença completa'", "1 freelancer de conteúdo"],
              target: "R$18k–28k MRR",
            },
            {
              phase: "Fase 3", period: "Meses 5–12", color: "border-purple-500/50 bg-purple-500/5",
              badge: "Consolidação", badgeColor: "bg-purple-500/20 text-purple-300",
              items: ["Crescimento por indicação", "Lançar serviço TikTok/Reels", "Upsell Maya para toda a base", "Time: gestor tráfego + social media"],
              target: "R$50k–80k MRR",
            },
          ].map((f) => (
            <div key={f.phase} className={`border rounded-xl p-5 ${f.color}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">{f.phase}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${f.badgeColor}`}>{f.badge}</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">{f.period}</p>
              <ul className="space-y-2 mb-4">
                {f.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle size={12} className="text-cyan-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-700/50 pt-3">
                <p className="text-xs text-slate-400">Meta</p>
                <p className="text-base font-semibold text-white">{f.target}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Riscos ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Riscos e mitigação</p>
        <div className="bg-[#111f35] border border-slate-700/50 rounded-xl p-5 space-y-3">
          {RISKS.map((r) => (
            <div key={r.title} className="flex gap-3 items-start py-2 border-b border-slate-800 last:border-0">
              <AlertTriangle
                size={14}
                className={`flex-shrink-0 mt-0.5 ${r.level === "high" ? "text-red-400" : r.level === "medium" ? "text-amber-400" : "text-green-400"}`}
              />
              <div>
                <p className="text-sm font-medium text-slate-200">{r.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{r.mitigation}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Vantagens competitivas ── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Vantagem competitiva da i9</p>
        <div className="bg-[#111f35] border border-cyan-500/20 rounded-xl p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "CRM próprio", desc: "Sistema integrado que nenhuma agência local tem", icon: Star },
              { title: "Maya (IA WhatsApp)", desc: "Atendimento automatizado 24h — demonstrável ao vivo", icon: MessageSquare },
              { title: "Relatório automático", desc: "PDF mensal gerado pelo sistema aumenta retenção", icon: BarChart2 },
              { title: "Foco Zona Leste", desc: "80k SMBs mapeadas, dados locais reais, proximidade", icon: Target },
            ].map((v) => (
              <div key={v.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <v.icon size={14} className="text-cyan-400" />
                  <p className="text-sm font-medium text-white">{v.title}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-cyan-400/80 italic">
              "Enquanto outras agências só postam, a i9 tem sistema completo de CRM, automação com IA e relatório mensal — tudo integrado, feito para o negócio da Zona Leste."
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-600 text-center pb-4">
        Dados de mercado: IAB Brasil, Sebrae 2025, Conversion.com.br · Atualizar trimestralmente
      </p>
    </div>
  );
}

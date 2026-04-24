import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { servicesApi, type Service } from '../../services/api'

const CATEGORY_LABEL: Record<string, string> = {
  site: 'Site', landing_page: 'Landing Page', trafego: 'Tráfego Pago',
  social_media: 'Social Media', criativo: 'Criativo', app: 'Aplicativo',
  consultoria: 'Consultoria',
}

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
}

export default function ServiceList() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    servicesApi.list()
      .then(({ data }) => setServices(data.services))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="p-6" style={{ background: '#061422', minHeight: '100%' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Serviços</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>
          Catálogo de serviços e histórico de vendas
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: '#7EAFC4' }}>Carregando...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: '#7EAFC4' }}>
          Nenhum serviço cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(s => (
            <div
              key={s.id}
              style={cardStyle}
              className="p-5 cursor-pointer transition-all"
              onClick={() => navigate(`/services/${s.id}`)}
              onMouseEnter={e => (e.currentTarget.style.border = '1px solid rgba(0,200,232,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.border = '1px solid rgba(0,200,232,0.14)')}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold" style={{ color: '#E8F4F8' }}>{s.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>
                    {CATEGORY_LABEL[s.category] ?? s.category}
                  </p>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={s.isActive
                    ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' }
                    : { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}
                >
                  {s.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {s.description && (
                <p className="text-xs mb-3 line-clamp-2" style={{ color: '#7EAFC4' }}>{s.description}</p>
              )}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs" style={{ color: '#7EAFC4' }}>Promo</p>
                  <p className="text-sm font-bold" style={{ color: '#00C8E8' }}>{fmt(s.promoPrice)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#7EAFC4' }}>Normal</p>
                  <p className="text-sm font-semibold" style={{ color: '#A8CCE0' }}>{fmt(s.normalPrice)}</p>
                </div>
                <span className="text-xs ml-auto" style={{ color: '#7EAFC4' }}>
                  {s.billingType === 'RECURRING' ? '🔁 Recorrente' : '⚡ Avulso'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

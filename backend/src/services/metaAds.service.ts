import axios from 'axios'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const META_GRAPH_URL = 'https://graph.facebook.com/v19.0'

export interface CampaignMetrics {
  campaignId: string
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  cpc: number
  cpm: number
  ctr: number
  leads: number
  costPerLead: number
}

export interface MetaAdsTotals {
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpc: number
  cpm: number
  ctr: number
  costPerLead: number
}

export interface MetaAdsMetrics {
  campaigns: CampaignMetrics[]
  totals: MetaAdsTotals
  datePreset: string
  generatedAt: string
}

export async function getMetaAdsCampaignMetrics(datePreset = 'last_30d'): Promise<MetaAdsMetrics> {
  const accessToken = env.META_PAGE_ACCESS_TOKEN
  const adAccountId = env.AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    throw new Error('META_PAGE_ACCESS_TOKEN e AD_ACCOUNT_ID são obrigatórios')
  }

  const url = `${META_GRAPH_URL}/act_${adAccountId}/insights`

  const response = await axios.get(url, {
    params: {
      access_token: accessToken,
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type',
      date_preset: datePreset,
      level: 'campaign',
    },
  })

  const data: any[] = response.data?.data ?? []

  const campaigns: CampaignMetrics[] = data.map((item: any) => {
    const actions: { action_type: string; value: string }[] = item.actions ?? []
    const costPerAction: { action_type: string; value: string }[] = item.cost_per_action_type ?? []

    const leads = Number(actions.find(a => a.action_type === 'lead')?.value ?? 0)
    const costPerLead = Number(costPerAction.find(a => a.action_type === 'lead')?.value ?? 0)

    return {
      campaignId:   item.campaign_id ?? '',
      campaignName: item.campaign_name ?? '',
      spend:        parseFloat((Number(item.spend ?? 0)).toFixed(2)),
      impressions:  Number(item.impressions ?? 0),
      clicks:       Number(item.clicks ?? 0),
      cpc:          parseFloat((Number(item.cpc ?? 0)).toFixed(2)),
      cpm:          parseFloat((Number(item.cpm ?? 0)).toFixed(2)),
      ctr:          parseFloat((Number(item.ctr ?? 0)).toFixed(2)),
      leads,
      costPerLead:  parseFloat(costPerLead.toFixed(2)),
    }
  })

  const rawTotals = campaigns.reduce(
    (acc, c) => ({
      spend:       acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks:      acc.clicks + c.clicks,
      leads:       acc.leads + c.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 }
  )

  const totals: MetaAdsTotals = {
    spend:       parseFloat(rawTotals.spend.toFixed(2)),
    impressions: rawTotals.impressions,
    clicks:      rawTotals.clicks,
    leads:       rawTotals.leads,
    cpc:         rawTotals.clicks > 0      ? parseFloat((rawTotals.spend / rawTotals.clicks).toFixed(2)) : 0,
    cpm:         rawTotals.impressions > 0 ? parseFloat(((rawTotals.spend / rawTotals.impressions) * 1000).toFixed(2)) : 0,
    ctr:         rawTotals.impressions > 0 ? parseFloat(((rawTotals.clicks / rawTotals.impressions) * 100).toFixed(2)) : 0,
    costPerLead: rawTotals.leads > 0       ? parseFloat((rawTotals.spend / rawTotals.leads).toFixed(2)) : 0,
  }

  logger.info({ campaigns: campaigns.length, datePreset }, '[MetaAds] Métricas buscadas com sucesso')

  return {
    campaigns,
    totals,
    datePreset,
    generatedAt: new Date().toISOString(),
  }
}

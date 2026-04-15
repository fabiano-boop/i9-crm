import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'
import type { Lead } from '@prisma/client'

// ─── Normalização de telefone ─────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  if (!phone) return ''
  // Remove: +55, código de país, espaços, traços, parênteses, pontos
  return phone
    .replace(/^\+?55/, '')      // remove código do Brasil
    .replace(/\D/g, '')          // mantém apenas dígitos
    .replace(/^0/, '')           // remove 0 inicial de DDD
}

// ─── Distância de Levenshtein ─────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = 1 + Math.min(
          matrix[i - 1]![j]!,       // delete
          matrix[i]![j - 1]!,       // insert
          matrix[i - 1]![j - 1]!,   // replace
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

// ─── Similarity Score ─────────────────────────────────────────────────────────

export function similarityScore(a: string, b: string): number {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (la === lb) return 1
  if (!la || !lb) return 0
  const maxLen = Math.max(la.length, lb.length)
  return 1 - levenshteinDistance(la, lb) / maxLen
}

// ─── Grupos de duplicatas ─────────────────────────────────────────────────────

export interface DuplicateGroup {
  leads: Pick<Lead, 'id' | 'name' | 'businessName' | 'phone' | 'whatsapp' | 'email' | 'neighborhood' | 'niche' | 'score' | 'classification' | 'importedAt'>[]
  confidence: 'certain' | 'possible'
  reason: string
}

export async function findDuplicates(): Promise<DuplicateGroup[]> {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      businessName: true,
      phone: true,
      whatsapp: true,
      email: true,
      neighborhood: true,
      niche: true,
      score: true,
      classification: true,
      importedAt: true,
    },
  })

  const groups: DuplicateGroup[] = []
  const grouped = new Set<string>() // IDs já agrupados

  // ── Passo 1: duplicatas certas por telefone normalizado ────────────────────
  const phoneMap = new Map<string, typeof leads>()
  for (const lead of leads) {
    const phone = normalizePhone(lead.phone ?? lead.whatsapp ?? '')
    if (!phone) continue
    const bucket = phoneMap.get(phone) ?? []
    bucket.push(lead)
    phoneMap.set(phone, bucket)
  }

  for (const [, bucket] of phoneMap) {
    if (bucket.length < 2) continue
    const ids = bucket.map((l) => l.id)
    if (ids.some((id) => grouped.has(id))) continue
    ids.forEach((id) => grouped.add(id))
    groups.push({ leads: bucket, confidence: 'certain', reason: 'Telefone idêntico' })
  }

  // ── Passo 2: possíveis duplicatas por nome + bairro ────────────────────────
  const ungrouped = leads.filter((l) => !grouped.has(l.id))

  for (let i = 0; i < ungrouped.length; i++) {
    for (let j = i + 1; j < ungrouped.length; j++) {
      const a = ungrouped[i]!
      const b = ungrouped[j]!

      // Mesmo bairro E nome com similaridade >= 0.85
      if (
        a.neighborhood &&
        b.neighborhood &&
        a.neighborhood.toLowerCase() === b.neighborhood.toLowerCase() &&
        similarityScore(a.businessName, b.businessName) >= 0.85
      ) {
        if (grouped.has(a.id) || grouped.has(b.id)) continue
        grouped.add(a.id)
        grouped.add(b.id)
        groups.push({
          leads: [a, b],
          confidence: 'possible',
          reason: `Nomes similares (${Math.round(similarityScore(a.businessName, b.businessName) * 100)}%) no mesmo bairro`,
        })
      }
    }
  }

  logger.info({ total: groups.length }, 'findDuplicates concluído')
  return groups
}

// ─── Merge de leads ───────────────────────────────────────────────────────────

export async function mergeLead(keepId: string, mergeIds: string[]): Promise<Lead> {
  const [keepLead, ...mergeLeads] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: keepId } }),
    ...mergeIds.map((id) => prisma.lead.findUniqueOrThrow({ where: { id } })),
  ])

  // Preenche campos vazios do keepLead com dados dos leads a mesclar
  const merged: Partial<Lead> = { ...keepLead }
  for (const src of mergeLeads) {
    for (const key of Object.keys(src) as (keyof Lead)[]) {
      if (!merged[key] && src[key]) {
        // @ts-expect-error — campos nullable variam de tipo
        merged[key] = src[key]
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Transfere todas as interações
    await tx.interaction.updateMany({
      where: { leadId: { in: mergeIds } },
      data: { leadId: keepId },
    })

    // Transfere tracking events
    await tx.trackingEvent.updateMany({
      where: { leadId: { in: mergeIds } },
      data: { leadId: keepId },
    })

    // Transfere cadências (só as que não existem para o leadId de destino)
    for (const mid of mergeIds) {
      const cadences = await tx.leadCadence.findMany({ where: { leadId: mid } })
      for (const cadence of cadences) {
        const exists = await tx.leadCadence.findFirst({
          where: { leadId: keepId, sequenceId: cadence.sequenceId },
        })
        if (!exists) {
          await tx.leadCadence.update({
            where: { id: cadence.id },
            data: { leadId: keepId },
          })
        } else {
          await tx.leadCadence.delete({ where: { id: cadence.id } })
        }
      }
    }

    // Transfere opportunity alerts
    await tx.opportunityAlert.updateMany({
      where: { leadId: { in: mergeIds } },
      data: { leadId: keepId },
    })

    // Transfere campaign leads (deduplicando)
    for (const mid of mergeIds) {
      const cls = await tx.campaignLead.findMany({ where: { leadId: mid } })
      for (const cl of cls) {
        const exists = await tx.campaignLead.findFirst({
          where: { leadId: keepId, campaignId: cl.campaignId },
        })
        if (!exists) {
          await tx.campaignLead.update({
            where: { id: cl.id },
            data: { leadId: keepId },
          })
        } else {
          await tx.campaignLead.delete({ where: { id: cl.id } })
        }
      }
    }

    // Atualiza keepLead com campos mesclados
    const { id: _id, importedAt: _importedAt, ...updateData } = merged
    await tx.lead.update({
      where: { id: keepId },
      data: updateData as Partial<Lead>,
    })

    // Remove leads mesclados
    await tx.lead.deleteMany({ where: { id: { in: mergeIds } } })
  })

  logger.info({ keepId, mergeIds }, 'mergeLead concluído')
  return prisma.lead.findUniqueOrThrow({ where: { id: keepId } })
}

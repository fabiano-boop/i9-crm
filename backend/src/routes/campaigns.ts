import { Router } from 'express'
import {
  listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign,
  addLeadsToCampaign, removeLeadFromCampaign, getCampaignStats,
  sendCampaign, pauseCampaign, getEngagedLeads,
} from '../controllers/campaigns.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(listCampaigns))
router.post('/', asyncHandler(createCampaign))
router.get('/:id', asyncHandler(getCampaign))
router.put('/:id', asyncHandler(updateCampaign))
router.delete('/:id', asyncHandler(deleteCampaign))
router.post('/:id/leads', asyncHandler(addLeadsToCampaign))
router.delete('/:id/leads/:leadId', asyncHandler(removeLeadFromCampaign))
router.get('/:id/stats', asyncHandler(getCampaignStats))
router.post('/:id/send', asyncHandler(sendCampaign))
router.post('/:id/pause', asyncHandler(pauseCampaign))
router.get('/:id/leads-engaged', asyncHandler(getEngagedLeads))

export default router

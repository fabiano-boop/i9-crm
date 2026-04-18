"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = __importDefault(require("./auth.js"));
const leads_js_1 = __importDefault(require("./leads.js"));
const sheets_js_1 = __importDefault(require("./sheets.js"));
const campaigns_js_1 = __importDefault(require("./campaigns.js"));
const tracking_js_1 = __importDefault(require("./tracking.js"));
const admin_js_1 = __importDefault(require("./admin.js"));
const cadences_js_1 = __importDefault(require("./cadences.js"));
const alerts_js_1 = __importDefault(require("./alerts.js"));
const webhooks_js_1 = __importDefault(require("./webhooks.js"));
const agent_js_1 = __importDefault(require("./agent.js"));
const setup_js_1 = __importDefault(require("./setup.js"));
const clients_js_1 = __importDefault(require("./clients.js"));
const reports_js_1 = __importDefault(require("./reports.js"));
const analytics_js_1 = __importDefault(require("./analytics.js"));
const whatsapp_js_1 = __importDefault(require("./whatsapp.js"));
const router = (0, express_1.Router)();
router.use('/auth', auth_js_1.default);
router.use('/leads', leads_js_1.default);
router.use('/sheets', sheets_js_1.default);
router.use('/campaigns', campaigns_js_1.default);
router.use('/tracking', tracking_js_1.default);
router.use('/admin', admin_js_1.default);
router.use('/cadences', cadences_js_1.default);
router.use('/alerts', alerts_js_1.default);
router.use('/webhooks', webhooks_js_1.default); // Evolution API webhooks (sem JWT)
router.use('/agent', agent_js_1.default); // Gerenciamento do agente Maya
router.use('/setup', setup_js_1.default); // TEMPORÁRIO — remover após setup inicial
router.use('/clients', clients_js_1.default); // Clientes ativos + relatórios semanais
router.use('/reports', reports_js_1.default); // Ações diretas sobre relatórios
router.use('/analytics', analytics_js_1.default); // Dashboard de métricas
router.use('/whatsapp', whatsapp_js_1.default); // Status da conexão WhatsApp
exports.default = router;
//# sourceMappingURL=index.js.map
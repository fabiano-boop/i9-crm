"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisAvailable = void 0;
exports.getRedis = getRedis;
exports.isRedisAvailable = isRedisAvailable;
const ioredis_1 = require("ioredis");
const env_js_1 = require("./env.js");
const logger_js_1 = require("../utils/logger.js");
let redisInstance = null;
let redisAvailable = false;
exports.redisAvailable = redisAvailable;
function getRedis() {
    if (!redisInstance) {
        redisInstance = new ioredis_1.Redis(env_js_1.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableOfflineQueue: false,
            retryStrategy: () => null, // não reconecta — falha silenciosamente
        });
        redisInstance.on('error', () => {
            // Silencia erros de conexão — Redis é opcional
        });
        redisInstance.on('connect', () => {
            exports.redisAvailable = redisAvailable = true;
            logger_js_1.logger.info('Redis conectado — filas BullMQ ativas');
        });
    }
    return redisInstance;
}
async function isRedisAvailable() {
    try {
        const r = getRedis();
        await r.connect().catch(() => null);
        const pong = await r.ping().catch(() => null);
        exports.redisAvailable = redisAvailable = pong === 'PONG';
    }
    catch {
        exports.redisAvailable = redisAvailable = false;
    }
    return redisAvailable;
}
//# sourceMappingURL=redis.js.map
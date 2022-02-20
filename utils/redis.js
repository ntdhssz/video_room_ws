let Redis = require('ioredis')
let env = require('./envUtil')
module.exports = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    database: env.REDIS_DATABASE
})
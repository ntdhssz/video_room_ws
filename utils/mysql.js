let mysql = require('mysql')
let env = require('../utils/envUtil')
let client = mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_NAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE
})

client.connect()
module.exports = client
const mysql = require('mysql');
require('dotenv').config();

var con1 = mysql.createConnection({
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});
con1.connect((err) => {
    if (!err) {
        console.log('connected....');
    } else {
        console.log('Error');
    }
});
module.exports = con1;
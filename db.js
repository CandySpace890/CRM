const mysql = require("mysql2/promise"); // Using mysql2/promise for async/await support
require("dotenv").config();

// Function to create MySQL connection pool
const createPool = () => {
    return mysql.createPool({
        connectionLimit: 100,
        host: process.env.MYSQL_HOST || '127.0.0.1',
        user: process.env.MYSQL_USERNAME || 'theuser',
        password: process.env.MYSQL_PASSWORD || 'mysqldb@123',
        database: process.env.MYSQL_DATABASE || 'crm',
        port: process.env.MYSQL_PORT || 3306,
        insecureAuth: true, // Note: This should ideally be avoided if possible
    });
};

module.exports = createPool;

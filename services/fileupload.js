const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your_secret_key'; 

const createPool = require("../db");
const db = createPool();
const moment = require('moment');


const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }

            req.userId = user.userId;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = req.userId; 
        const dir = `./uploads/${userId}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

router.post("/transactions/upload_csv", authenticateJWT, upload.single('csvFile'), async (req, res) => {
    const csvFilePath = req.file.path;
    let connection;

    try {
        connection = await db.getConnection();
        const searchQuery = "SELECT * FROM users WHERE id = ?";
        const [searchResults] = await connection.query(searchQuery, [req.userId]);
       
        if (searchResults.length == 0) {
            console.log("User doesnt exists",searchResults);
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'User doesnt exists'
            });
        }
        const user = searchResults[0];
        const transactions = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                transactions.push(row);
            })
            .on('end', async () => {
                try {
                    for (const transaction of transactions) {
                        const {
                            datetime,
                            saleamount
                        } = transaction;

                        const insertQuery = `
                            INSERT INTO transactions (
                                datetime,
                                saleamount,
                                user_id,
                                parent_id
                            ) VALUES ( ?, ?, ?, ?)
                        `;

                        await connection.query(insertQuery, [
                            datetime,
                            saleamount,
                            user.id,
                            user.parentId
                        ]);
                    }

                    res.status(200).json({
                        status: 200,
                        is_error: false,
                        message: 'Transactions created successfully.'
                    });

                } catch (error) {
                    console.error("Error inserting transactions:", error.message);
                    res.status(200).json({
                        status: 200,
                        is_error: true,
                        message: error.message
                    });
                } finally {
                    fs.unlink(csvFilePath, (err) => {
                        if (err) {
                            console.error("Failed to delete temporary CSV file:", err.message);
                        }
                    });

                    if (connection) {
                        connection.release();
                    }
                }
            });
    } catch (error) {
        console.error("Error processing CSV file:", error.message);
        res.status(200).json({
            status: 200,
            is_error: true,
            message: error.message
        });

        if (connection) {
            connection.release();
        }
    }
});


router.get("/transactions/sales_by_month", authenticateJWT, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        const userId = req.userId;
        const searchQuery = "SELECT * FROM users WHERE id = ?";
        const [searchResults] = await connection.query(searchQuery, [req.userId]);

        if (searchResults.length === 0) {
            console.log("User doesn't exist", searchResults);
            return res.status(200).send({
                status: 200,
                is_error: true,
                message: 'User doesn\'t exist'
            });
        }
        const user = searchResults[0];

        const currentYear = moment().year();
        const previousYear = currentYear - 1;

        let salesByMonthQuery;
        let salesByMonthResults;

        if (user.parentId === 0) {
            salesByMonthQuery = `
                SELECT
                    EXTRACT(YEAR FROM datetime) AS year,
                    EXTRACT(MONTH FROM datetime) AS month,
                    SUM(saleamount) AS total_sales
                FROM
                    transactions
                WHERE
                    (user_id = ? OR parent_id = ?) AND (EXTRACT(YEAR FROM datetime) = ? OR EXTRACT(YEAR FROM datetime) = ?)
                GROUP BY
                    EXTRACT(YEAR FROM datetime),
                    EXTRACT(MONTH FROM datetime)
                ORDER BY
                    year, month
            `;
            [salesByMonthResults] = await connection.query(salesByMonthQuery, [userId, user.parentId, currentYear, previousYear]);

        } else {
            salesByMonthQuery = `
                SELECT
                    EXTRACT(YEAR FROM datetime) AS year,
                    EXTRACT(MONTH FROM datetime) AS month,
                    SUM(saleamount) AS total_sales
                FROM
                    transactions
                WHERE
                    user_id = ? AND (EXTRACT(YEAR FROM datetime) = ? OR EXTRACT(YEAR FROM datetime) = ?)
                GROUP BY
                    EXTRACT(YEAR FROM datetime),
                    EXTRACT(MONTH FROM datetime)
                ORDER BY
                    year, month
            `;
            [salesByMonthResults] = await connection.query(salesByMonthQuery, [userId, currentYear, previousYear]);
        }

        const currentYearData = salesByMonthResults.filter(row => row.year === currentYear).map(row => ({
            month: moment().month(row.month - 1).format('MMMM'),
            year: row.year,
            total_sales: row.total_sales
        }));

        const previousYearData = salesByMonthResults.filter(row => row.year === previousYear).map(row => ({
            month: moment().month(row.month - 1).format('MMMM'),
            year: row.year,
            total_sales: row.total_sales
        }));

        res.status(200).json({
            status: 200,
            is_error: false,
            data: {
                current: currentYearData,
                previous: previousYearData
            }
        });

    } catch (error) {
        console.error("Error fetching sales by month:", error.message);
        res.status(200).json({
            status: 200,
            is_error: true,
            message: error.message
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;

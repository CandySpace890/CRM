const express = require("express");
const router = express.Router();
const createPool = require("../db");


const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your_secret_key'; 


const db = createPool();

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


router.post("/user/create", async (req, res) => {
    const { firstName, lastName, email, password,  parentId } = req.body;
    if (!firstName)
        {
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'First name is required.'
            });
           
        }
        if (!lastName ) {
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'last name is required.'
            });
        }
        if (!email)
            {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: 'email is required.'
                });
               
            }
        if (!password ) {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: 'password is required.'
                });
        }
        if (password.length < 6) {
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'Password must be at least 6 characters long.'
            });
        }
    
    let connection;
    try {
        connection = await db.getConnection();

        const searchQuery = "select * FROM users WHERE email = ?";
        const [searchResults] = await connection.query(searchQuery, [email]);
        
        if (searchResults.length > 0) {
            console.log("User already exists",searchResults);
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'User already exists'
            });
        }

        if(parentId !=0){
            const parentQuery = "select * FROM users WHERE parentId = ?";
            const [parentQueryResults] = await connection.query(parentQuery, [parentId]);
            if (parentQueryResults.length > 0) {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: "Admin doesn't exist"
                });
            }
        }
        const insertQuery = "insert into users (firstName, lastName, email, password, active, parentId) VALUES (?, ?, ?, ?, ?, ?)";
        const [result] = await connection.query(insertQuery, [firstName, lastName, email, password, true, parentId || 0 ]);
        const [user] = await connection.query(searchQuery, [email]);
        
        console.log("Created new User:", user[0].firstName);
        return res.status(200).send({
            status: 200,
            is_error:true,
            message: "successfully inserted",
            user_details:user[0]
        });
    } catch (error) {
        console.error("Error creating user:", error.message);
        return res.status(200).send({
            status: 200,
            is_error:true,
            message: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


router.post("/user/login", async (req, res) => {
    const {  email, password,  } = req.body;
        if (!email)
            {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: 'email is required.'
                });
               
            }
        if (!password ) {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: 'password is required.'
                });
        }
    
    let connection;
    try {
        connection = await db.getConnection();

        const searchQuery = "select * from users where email = ?";
        const [searchResults] = await connection.query(searchQuery, [email]);
        
        if (searchResults.length == 0) {
            console.log("User doesnt exists",searchResults);
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'User doesnt exists'
            });
        }
        const user = searchResults[0];

        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

        return res.status(200).send({
            status: 200,
            is_error:true,
            message: "sucess",
            user: searchResults[0],
            token: token,
        });
    } catch (error) {
        console.error("Error fetchinh user:", error.message);
        return res.status(200).send({
            status: 200,
            is_error:true,
            message: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


router.post("/user/change_password",authenticateJWT, async (req, res) => {
    const {   currentPassword, newPassword  } = req.body;
       
        if (!currentPassword ) {
                return res.status(200).send({
                    status: 200,
                    is_error:true,
                    message: 'currentPassword is required.'
                });
        } 
        if (!newPassword ) {
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'newPassword is required.'
            });
        }
        if(currentPassword==newPassword){
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'passwords should not be same.'
            });
        }
    
    let connection;
    try {
        connection = await db.getConnection();
        const userId = req.userId;

        const searchQuery = "SELECT * FROM users WHERE id = ?";
        const [searchResults] = await connection.query(searchQuery, [userId]);
       
        if (searchResults.length == 0) {
            console.log("User doesnt exists",searchResults);
            return res.status(200).send({
                status: 200,
                is_error:true,
                message: 'User doesnt exists'
            });
        }
        const user = searchResults[0];

        if (user.password !== currentPassword) {
            return res.status(401).json({
                status: 401,
                error: true,
                message: 'Incorrect current password.'
            });
        }

        await connection.query("update users set password = ? where id = ?", [newPassword, userId]);

        return res.status(200).json({
            status: 200,
            error: false,
            message: 'Password updated successfully.'
        });


    } catch (error) {
        console.error("Error fetchinh user:", error.message);
        return res.status(200).send({
            status: 200,
            is_error:true,
            message: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


router.get("/user/details", authenticateJWT, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        const userId = req.userId;

        const searchQuery = "SELECT * FROM users WHERE id = ?";
        const [searchResults] = await connection.query(searchQuery, [userId]);
        
        if (searchResults.length == 0) {
            return res.status(200).send({
                status: 200,
                is_error: true,
                message: 'User doesn\'t exist'
            });
        }

        const user = searchResults[0];

        return res.status(200).send({
            status: 200,
            is_error: false,
            message: "success",
            user: user
        });
    } catch (error) {
        console.error("Error fetching user:", error.message);
        return res.status(200).send({
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


router.get("/user/list", authenticateJWT, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        const userId = req.userId;

        const searchQuery = "SELECT * FROM users WHERE id = ?";
        const [searchResults] = await connection.query(searchQuery, [userId]);
        
        if (searchResults.length == 0) {
            return res.status(200).send({
                status: 200,
                is_error: true,
                message: 'User doesn\'t exist'
            });
        }


        const user = searchResults[0];
        if(user.parentId !=0){
            return res.status(200).send({
                status: 200,
                is_error: true,
                message: 'user is not admin user'
            });
        }
        const listUserQuery = "SELECT * FROM users WHERE parentId = ?";
        const [listUsersQuery] = await connection.query(listUserQuery, [userId]);
        
        return res.status(200).send({
            status: 200,
            is_error: false,
            message: "success",
            users: listUsersQuery,
            totalCount: listUsersQuery.length
        });
    } catch (error) {
        console.error("Error fetching user:", error.message);
        return res.status(200).send({
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


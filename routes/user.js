const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hotel', // Replace with your database name
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        // Handle the connection error, e.g., terminate the application or handle it gracefully.
        process.exit(1);
    } else {
        console.log('Connected to MySQL');
    }
});

const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function(req, file, cb) {
        cb(null, `${Date.now()}_${file.originalname}`);
    },
});

const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('File type not allowed'), false);
        }
        cb(null, true);
    },
});

router.use('/uploads', express.static(path.join(__dirname, 'uploads')));
router.use(bodyParser.urlencoded({
    extended: true
}));
router.use(bodyParser.json());


router.post('/signup', async(req, res) => {
    try {
        console.log(req.body);
        const {
            username,
            email,
            password,
            confirm_password
        } = req.body;

        // Check if email already exists
        const emailExistQuery = 'SELECT * FROM users WHERE email = ?';
        db.query(emailExistQuery, [email], (emailExistErr, emailExistResult) => {
            if (emailExistErr) {
                console.error('Error checking email existence:', emailExistErr);
                return res.status(500).json({
                    error: 'Internal Server Error'
                });
            }

            if (emailExistResult.length > 0) {
                return res.status(400).json({
                    error: 'Email already exists. Please use a different email.'
                });
            }

            // Password confirmation logic
            if (password !== confirm_password) {
                return res.status(400).json({
                    error: 'Password and Confirm Password do not match.'
                });
            }

            // Insert user into the database
            const insertQuery = 'INSERT INTO users(username, password, email) VALUES (?, ?, ?)';
            db.query(insertQuery, [username, password, email], (dbErr, result) => {
                if (dbErr) {
                    console.error('Error inserting into the database:', dbErr);
                    return res.status(500).json({
                        error: 'Failed to add user entry'
                    });
                } else {
                    res.status(201).json({
                        success: true,
                        message: 'User added'
                    });
                }
            });
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

router.post('/signin', (req, res) => {
    const {
        email,
        password
    } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';

    db.query(sql, [email, password], (dbErr, results) => {
        if (dbErr) {
            console.error('Error during sign-in:', dbErr);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        } else if (results.length === 0) {
            res.status(401).json({
                message: 'Invalid email or password'
            });
        } else {
            const user = results[0];
            // Generate a token
            const userId = user.id;
            const token = jwt.sign({
                userId: user.id,
                email: user.email
            }, 'your-secret-key', {
                expiresIn: '1h'
            });
            res.status(201).json({
                message: 'Login success......',
                token,
                userId
            });
        }
    });
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'login',
        user: 'muchhalsagar@gmail.com',
        pass: 'jypk vxxc npeb egcz',
    },
});

// Function to generate a random OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Function to send an email with the OTP
const sendEmail = (email, resetotp) => {
    const mailOptions = {
        from: 'muchhalsagar@gmail.com',
        to: email,
        subject: 'Atithi Hotel - Password Reset',
        html: `
    <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Atithi Hotel</h1>
      <p>Hello,</p>
      <p>We received a request to reset your password for Atithi Hotel account.</p>
      <p>Your OTP is: <strong>${resetotp}</strong></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Thank you for choosing Atithi Hotel!</p>

      <ul style="list-style-type: none; padding: 0;">
        <li>Phone: (12) 345 67890</li>
        <li>Email: atithihotel@gmail.com</li>
        <li>Address: 856 Cordia Extension Apt. 356, Lake, United State</li>
      </ul>

      <p style="text-align: center; margin-top: 20px; color: #777;">Atithi Hotel - Your Comfort, Our Priority</p>
    </div>
  `,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

router.post('/forgot-password', (req, res) => {
    const {
        email
    } = req.body;
    const resetotp = generateOTP();

    // Check if the email exists in the 'users' table
    const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailSql, [email], (checkEmailErr, checkEmailResults) => {
        if (checkEmailErr) {
            console.error('Error checking email:', checkEmailErr);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        } else if (checkEmailResults.length === 0) {
            // If the email doesn't exist, inform the user
            res.status(404).json({
                message: 'Email not found'
            });
        } else {
            // Update the user record with the generated OTP
            const updateSql = 'UPDATE users SET resetotp = ? WHERE email = ?';
            db.query(updateSql, [resetotp, email], (updateErr, updateResult) => {
                if (updateErr) {
                    console.error('Error updating OTP:', updateErr);
                    res.status(500).json({
                        message: 'Internal Server Error'
                    });
                } else {
                    // Send the OTP to the user's email
                    sendEmail(email, resetotp);
                    res.status(200).json({
                        message: 'Check your email for the OTP'
                    });
                }
            });
        }
    });
});

router.post('/verify_otp', async(req, res) => {
    try {
        const {
            otp
        } = req.body;
        if (!otp) {
            return res.status(400).json({
                message: 'OTP is required'
            });
        }
        const sql = 'SELECT * FROM users WHERE resetotp = ?';
        // Wrap the database query in a promise for better error handling
        const queryPromise = () => {
            return new Promise((resolve, reject) => {
                db.query(sql, [otp], (dbErr, results) => {
                    if (dbErr) {
                        reject(dbErr);
                    } else {
                        resolve(results);
                    }
                });
            });
        };
        const results = await queryPromise();
        if (results.length === 0) {
            res.status(401).json({
                message: 'Invalid OTP'
            });
        } else {
            res.status(201).json({
                message: 'OTP verified......'
            });
        }
    } catch (error) {
        console.error('Error during OTP Verify:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

router.put('/new_password/:email', async(req, res) => {
    try {
        const {
            new_password,
            confirm_password
        } = req.body;
        const {
            email
        } = req.params;
        // Validate presence of new_password and confirm_password
        if (!new_password || !confirm_password) {
            return res.status(400).json({
                message: 'Both new_password and confirm_password are required'
            });
        }

        // Validate that new_password matches confirm_password
        if (new_password !== confirm_password) {
            return res.status(400).json({
                message: 'New password and confirm password do not match'
            });
        }

        // Update the user's password in the database
        const updatePasswordSql = 'UPDATE users SET password = ? WHERE email = ?';
        await db.query(updatePasswordSql, [new_password, email]);
        const resetOTPSql = 'UPDATE users SET resetotp = NULL WHERE email = ?';
        await db.query(resetOTPSql, [email]);
        // You may want to invalidate the reset token or perform other cleanup tasks here
        res.status(200).json({
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

router.get('/view_users', (req, res) => {
    const query = 'SELECT * FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error while fetching Users:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).json(results);
        }
    });
});

router.delete('/delete_user/:id', (req, res) => {
    const user_id = req.params.id;
    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [user_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete User entry'
            });
        } else {
            res.status(200).json({
                message: 'User entry deleted successfully'
            });
        }
    });
});

router.post('/admin_login', async(req, res) => {
    try {
        const {
            email,
            password
        } = req.body;
        if (!email || !password) {
            res.status(500).json({
                message: 'Both Email and Password required.'
            });
        }
        if (email == 'muchhalsagar@gmail.com' && password == 'gurukul@36') {
            res.status(200).json({
                message: 'Login success......'
            });
        } else {
            res.status(401).json({
                message: 'User Not found'
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Internal Server error.'
        });
    }
});

router.post('/room_category', upload.single('img'), (req, res) => {
    const {
        category,
        price,
        size,
        capacity,
        bed,
        service
    } = req.body;

    if (req.file) {
        const img = req.file;
        const imgFileName = `${Date.now()}_${img.originalname}`;
        const imgPath = path.join(uploadDirectory, imgFileName);

        fs.rename(img.path, imgPath, (err) => {
            if (err) {
                console.error('Error saving image:', err);
                return res.status(500).json({
                    error: 'Failed to save the image'
                });
            }
            const sql = `INSERT INTO room_category (category, price, size, capacity, bed, service, img) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.query(sql, [category, price, size, capacity, bed, service, imgFileName], (dbErr, result) => {
                if (dbErr) {
                    console.error('Error inserting into the database:', dbErr);
                    res.status(500).json({
                        error: 'Failed to create room category'
                    });
                } else {
                    res.status(201).json({
                        message: 'Room category created'
                    });
                }
            });
        });
    } else {
        const sql = `INSERT INTO room_category (category, price, size, capacity, bed, service) VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(sql, [category, price, size, capacity, bed, service], (dbErr, result) => {
            if (dbErr) {
                console.error('Error inserting into the database:', dbErr);
                res.status(500).json({
                    error: 'Failed to create room category'
                });
            } else {
                res.status(201).json({
                    message: 'Room category created'
                });
            }
        });
    }
});

router.post('/add_blog', upload.single('img'), (req, res) => {
    const {
        event_name,
        event_btn,
        event_date
    } = req.body;

    if (!req.file) {
        return res.status(400).json({
            error: 'No file uploaded'
        });
    }

    if (req.fileValidationError) {
        return res.status(400).json({
            error: req.fileValidationError
        });
    }

    const imgFile = req.file;
    const imgFileName = `${Date.now()}_${imgFile.originalname}`;
    const imgPath = path.join(uploadDirectory, imgFileName);

    fs.rename(imgFile.path, imgPath, (err) => {
        if (err) {
            console.error('Error saving image:', err);
            return res.status(500).json({
                error: 'Failed to save the image'
            });
        }

        const sql = `INSERT INTO blog (event_name, event_btn, event_date, img) VALUES (?, ?, ?, ?)`;

        db.query(sql, [event_name, event_btn, event_date, imgFileName], (dbErr, result) => {
            if (dbErr) {
                console.error('Error inserting into the database:', dbErr);
                res.status(500).json({
                    error: 'Failed to add blog entry'
                });
            } else {
                res.status(201).json({
                    message: 'Blog entry added'
                });
            }
        });
    });
});


router.post('/add_services', (req, res) => {
    const {
        icon,
        name,
        description
    } = req.body;

    const sql = 'INSERT INTO services (icon, name, description) VALUES (?, ?, ?)';
    db.query(sql, [icon, name, description], (dbErr, result) => {
        if (dbErr) {
            console.error('Error inserting into the database:', dbErr);
            res.status(500).json({
                error: 'Failed to store service data'
            });
        } else {
            res.status(201).json({
                message: 'Service data stored successfully'
            });
        }
    });
});

router.get('/view_services', (req, res) => {
    const sql = 'SELECT * FROM services';

    db.query(sql, (dbErr, result) => {
        if (dbErr) {
            console.error('Error retrieving data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to retrieve services'
            });
        } else {
            res.status(200).json(result);
        }
    });
});

router.delete('/delete_services/:id', (req, res) => {
    const services_id = req.params.id;
    const sql = 'DELETE FROM services WHERE id = ?';
    db.query(sql, [services_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete services  entry'
            });
        } else {
            res.status(200).json({
                message: 'services entry deleted successfully'
            });
        }
    });
});

router.put('/update_services/:id', (req, res) => {
    const services_id = req.params.id;
    const {
        name,
        description
    } = req.body;

    const sql = 'UPDATE services SET name=?, description=? WHERE id=?';

    db.query(sql, [name, description, services_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error updating data in the database:', dbErr);
            res.status(500).json({
                error: 'Failed to update services entry'
            });
        } else {
            res.status(200).json({
                message: 'sevices entry updated successfully'
            });
        }
    });
});

// Contact.js
router.post('/add_contact', (req, res) => {
    const {
        name,
        email,
        subject,
        msg,
    } = req.body;

    const sql = 'INSERT INTO contact (name,email,subject,msg) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, subject, mgs], (dbErr, result) => {
        if (dbErr) {
            console.error('Error inserting into the database:', dbErr);
            res.status(500).json({
                error: 'Failed to store contact data'
            });
        } else {
            res.status(201).json({
                message: 'Contact data stored successfully'
            });
        }
    });
});


router.get('/view_contact', (req, res) => {
    const sql = 'SELECT * FROM contact';
    db.query(sql, (dbErr, result) => {
        if (dbErr) {
            console.error('Error retrieving data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to retrieve contact entries'
            });
        } else {
            res.status(200).json(result);
        }
    });
});

router.delete('/delete_contact/:id', (req, res) => {
    const contact_id = req.params.id;
    const sql = 'DELETE FROM contact WHERE id = ?';
    db.query(sql, [contact_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete contact  entry'
            });
        } else {
            res.status(200).json({
                message: 'Contact entry deleted successfully'
            });
        }
    });
});


router.get('/view_room_category', (req, res) => {
    const sql = 'SELECT * FROM room_category';

    db.query(sql, (dbErr, result) => {
        if (dbErr) {
            console.error('Error retrieving data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to retrieve room categories'
            });
        } else {
            res.status(200).json(result);
        }
    });
});

router.get('/view_blog', (req, res) => {
    const sql = 'SELECT * FROM blog';
    db.query(sql, (dbErr, result) => {
        if (dbErr) {
            console.error('Error retrieving data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to retrieve blog entries'
            });
        } else {
            res.status(200).json(result);
        }
    });
});

router.delete('/delete_category/:id', (req, res) => {
    const categorie_id = req.params.id;
    const sql = 'DELETE FROM room_category WHERE id = ?';
    db.query(sql, [categorie_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete room  entry'
            });
        } else {
            res.status(200).json({
                message: 'Room category entry deleted successfully'
            });
        }
    });
});

router.put('/update_category/:id', (req, res) => {
    const category_id = req.params.id;
    const {
        category,
        price,
        size,
        capacity,
        bed,
        service,
        img
    } = req.body;

    const sql = 'UPDATE room_category SET category=?, price=?, size=?, capacity=?, bed=?, service=?, img=? WHERE id=?';

    db.query(sql, [category, price, size, capacity, bed, service, img, category_id], (dbErr, result) => {
        if (dbErr) {
            console.error('Error updating data in the database:', dbErr);
            res.status(500).json({
                error: 'Failed to update category entry'
            });
        } else {
            res.status(200).json({
                message: 'Room category entry updated successfully'
            });
        }
    });
});


router.delete('/delete_blog/:id', (req, res) => {
    const blogId = req.params.id;

    const sql = 'DELETE FROM blog WHERE id = ?';

    db.query(sql, [blogId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete blog entry'
            });
        } else {
            res.status(200).json({
                message: 'Blog entry deleted successfully'
            });
        }
    });
});

router.put('/update_blog/:id', (req, res) => {
    const blogId = req.params.id;
    const {
        event_name,
        event_btn,
        event_date,
        img
    } = req.body;

    const sql = 'UPDATE blog SET event_name=?, event_btn=?, event_date=?, img=? WHERE id=?';

    db.query(sql, [event_name, event_btn, event_date, img, blogId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error updating data in the database:', dbErr);
            res.status(500).json({
                error: 'Failed to update blog entry'
            });
        } else {
            res.status(200).json({
                message: 'Blog entry updated successfully'
            });
        }
    });
});

router.post('/add_rooms', upload.single('img'), (req, res) => {
    const {
        roomNumber,
        price,
        capacity,
        category_name,
        facility
    } = req.body;

    if (req.file) {
        const img = req.file;
        const imgFileName = `${Date.now()}_${img.originalname}`;
        const imgPath = path.join(uploadDirectory, imgFileName);

        fs.rename(img.path, imgPath, (err) => {
            if (err) {
                console.error('Error saving image:', err);
                return res.status(500).json({
                    error: 'Failed to save the image'
                });
            }

            const insertQuery = 'INSERT INTO rooms (room_number, price, capacity, category_name, facility, img) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(insertQuery, [roomNumber, price, capacity, category_name, facility, imgFileName], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('Error while adding a new room:', insertErr);
                    res.status(500).send('Internal Server Error');
                } else {
                    console.log('Room added successfully');
                    res.status(201).json({
                        id: insertResult.insertId
                    });
                }
            });
        });
    } else {
        const insertQuery = 'INSERT INTO rooms (room_number, price, capacity, category_name, facility) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [roomNumber, price, capacity, category_name, facility], (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Error while adding a new room:', insertErr);
                res.status(500).send('Internal Server Error');
            } else {
                console.log('Room added successfully');
                res.status(201).json({
                    id: insertResult.insertId
                });
            }
        });
    }
});

router.get('/display_rooms', (req, res) => {
    const query = 'SELECT * FROM rooms';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error while fetching available rooms:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).json(results);
        }
    });
});


router.delete('/delete_room1/:id', (req, res) => {
    const roomId = req.params.id;

    const sql = 'DELETE FROM rooms WHERE id = ?';

    db.query(sql, [roomId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete Room entry'
            });
        } else {
            res.status(200).json({
                message: 'Room entry deleted successfully'
            });
        }
    });
});

router.put('/update_room1/:id', (req, res) => {
    const roomId = req.params.id;
    const {
        roomNumber,
        price,
        capacity,
        category_name,
        facility
    } = req.body;
    const sql = 'UPDATE rooms SET room_number=?, price=?, capacity=?, category_name=?,facility=? WHERE id=?';

    db.query(sql, [roomNumber, price, capacity, category_name, facility, roomId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error updating data in the database:', SdbErr);
            res.status(500).json({
                error: 'Failed to update room entry'
            });
        } else {
            res.status(200).json({
                message: 'Room entry updated successfully'
            });
        }
    });
});


router.get('/available-rooms', (req, res) => {
    const query = 'SELECT * FROM rooms WHERE id NOT IN (SELECT room_id FROM bookings)';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error while fetching available rooms:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).json(results);
        }
    });
});

router.get('/check-available-rooms', (req, res) => {
    const {
        checkin,
        checkout
    } = req.query;

    let query;

    if (checkin && checkout) {
        query = `
      SELECT * 
        FROM rooms 
        WHERE id NOT IN (
        SELECT room_id 
        FROM bookings 
        WHERE checkOutDate > ? 
        AND checkInDate < ?
        )`;
    } else {
        query = 'SELECT * FROM rooms WHERE id NOT IN (SELECT room_id FROM bookings)';
    }

    db.query(query, [checkin, checkout], (err, results) => {
        if (err) {
            console.error('Error while fetching available rooms:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).json(results);
        }
    });
});

router.get('/view_booking', (req, res) => {
    const query = 'SELECT * FROM bookings';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error while fetching available rooms:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).json(results);
        }
    });
});

router.delete('/delete_booking/:id', (req, res) => {
    const bookingId = req.params.id;

    const sql = 'DELETE FROM bookings WHERE id = ?';

    db.query(sql, [bookingId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({
                error: 'Failed to delete Booking entry'
            });
        } else {
            res.status(200).json({
                message: 'Booking entry deleted successfully'
            });
        }
    });
});

router.post('/room_booking', (req, res) => {
    const {
        checkInDate,
        checkOutDate,
        guests,
        room_id,
        userId,
    } = req.body;

    const sql = 'INSERT INTO bookings (checkInDate,checkOutDate,guests,room_id,userId) VALUES (?, ?, ?, ?,?)';
    db.query(sql, [checkInDate, checkOutDate, guests, room_id, userId, ], (dbErr, result) => {
        if (dbErr) {
            console.error('Error inserting into the database:', dbErr);
            res.status(500).json({
                error: 'Failed to add booking data'
            });
        } else {
            res.status(201).json({
                message: 'room booked successfully'
            });
        }
    });
});

module.exports = router;
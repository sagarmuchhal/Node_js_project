const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

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
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post('/register', async(req, res) => {
    const { username, email, password } = req.body;

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a random verification token
    const verificationToken = generateToken();

    const sql = 'INSERT INTO users (username, email, password, verification_token) VALUES (?, ?, ?, ?)';
    db.query(sql, [username, email, hashedPassword, verificationToken], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).json({ error: 'Failed to register user' });
        }

        // Send verification email
        sendVerificationEmail(email, verificationToken);

        res.status(201).json({ message: 'User registered successfully. Check your email for verification.' });
    });
});

router.get('/verify/:token', (req, res) => {
    const token = req.params.token;

    const sql = 'UPDATE users SET is_verified = true WHERE verification_token = ?';
    db.query(sql, [token], (err, result) => {
        if (err) {
            console.error('Error verifying email:', err);
            return res.status(500).json({ error: 'Failed to verify email' });
        }

        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    });
});

const sendVerificationEmail = (email, token) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'muchhalsagar@gmail.com',
            pass: 'gurukul@36',
        },
    });

    const mailOptions = {
        from: 'muchhalsagar@gmail.com',
        to: email,
        subject: 'Account Verification',
        text: `Click the link to verify your account: http://localhost:3000/verify/${token}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending verification email:', error);
            // Handle the error, e.g., return an error response to the client
        } else {
            console.log('Email sent:', info.response);
            // You might also want to handle the success case here
        }
    });
};

// Function to generate a random token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

router.post('/room_category', upload.single('img'), (req, res) => {
    const { category, price, size, capacity, bed, service } = req.body;

    if (req.file) {
        const img = req.file;
        const imgFileName = `${Date.now()}_${img.originalname}`;
        const imgPath = path.join(uploadDirectory, imgFileName);

        fs.rename(img.path, imgPath, (err) => {
            if (err) {
                console.error('Error saving image:', err);
                return res.status(500).json({ error: 'Failed to save the image' });
            }

            const sql = `INSERT INTO room_category (category, price, size, capacity, bed, service, img) VALUES (?, ?, ?, ?, ?, ?, ?)`;

            db.query(sql, [category, price, size, capacity, bed, service, imgFileName], (dbErr, result) => {
                if (dbErr) {
                    console.error('Error inserting into the database:', dbErr);
                    res.status(500).json({ error: 'Failed to create room category' });
                } else {
                    res.status(201).json({ message: 'Room category created' });
                }
            });
        });
    } else {
        const sql = `INSERT INTO room_category (category, price, size, capacity, bed, service) VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(sql, [category, price, size, capacity, bed, service], (dbErr, result) => {
            if (dbErr) {
                console.error('Error inserting into the database:', dbErr);
                res.status(500).json({ error: 'Failed to create room category' });
            } else {
                res.status(201).json({ message: 'Room category created' });
            }
        });
    }
});

router.post('/add_blog', upload.single('img'), (req, res) => {
    const { event_name, event_btn, event_date } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
    }

    const imgFile = req.file;
    const imgFileName = `${Date.now()}_${imgFile.originalname}`;
    const imgPath = path.join(uploadDirectory, imgFileName);

    fs.rename(imgFile.path, imgPath, (err) => {
        if (err) {
            console.error('Error saving image:', err);
            return res.status(500).json({ error: 'Failed to save the image' });
        }

        const sql = `INSERT INTO blog (event_name, event_btn, event_date, img) VALUES (?, ?, ?, ?)`;

        db.query(sql, [event_name, event_btn, event_date, imgFileName], (dbErr, result) => {
            if (dbErr) {
                console.error('Error inserting into the database:', dbErr);
                res.status(500).json({ error: 'Failed to add blog entry' });
            } else {
                res.status(201).json({ message: 'Blog entry added' });
            }
        });
    });
});


router.post('/add_services', (req, res) => {
    const { icon, name, description } = req.body;

    const sql = 'INSERT INTO services (icon, name, description) VALUES (?, ?, ?)';
    db.query(sql, [icon, name, description], (dbErr, result) => {
        if (dbErr) {
            console.error('Error inserting into the database:', dbErr);
            res.status(500).json({ error: 'Failed to store service data' });
        } else {
            res.status(201).json({ message: 'Service data stored successfully' });
        }
    });
});

// Contact.js
router.post('/add_contact', (req, res) => {
    const { name, email, subject, message } = req.body;

    const sql = 'INSERT INTO contact (name,email,subject,msg) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, subject, message], (dbErr, result) => {
        if (dbErr) {
            console.error('Error inserting into the database:', dbErr);
            res.status(500).json({ error: 'Failed to store contact data' });
        } else {
            res.status(201).json({ message: 'Contact data stored successfully' });
        }
    });
});


router.get('/view_room_category', (req, res) => {
    const sql = 'SELECT * FROM room_category';

    db.query(sql, (dbErr, result) => {
        if (dbErr) {
            console.error('Error retrieving data from the database:', dbErr);
            res.status(500).json({ error: 'Failed to retrieve room categories' });
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
            res.status(500).json({ error: 'Failed to retrieve blog entries' });
        } else {
            res.status(200).json(result);
        }
    });
});

router.delete('/delete_blog/:id', (req, res) => {
    const blogId = req.params.id;

    const sql = 'DELETE FROM blog WHERE id = ?';

    db.query(sql, [blogId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error deleting data from the database:', dbErr);
            res.status(500).json({ error: 'Failed to delete blog entry' });
        } else {
            res.status(200).json({ message: 'Blog entry deleted successfully' });
        }
    });
});

router.put('/update_blog/:id', (req, res) => {
    const blogId = req.params.id;
    const { event_name, event_btn, event_date, img } = req.body;

    const sql = 'UPDATE blog SET event_name=?, event_btn=?, event_date=?, img=? WHERE id=?';

    db.query(sql, [event_name, event_btn, event_date, img, blogId], (dbErr, result) => {
        if (dbErr) {
            console.error('Error updating data in the database:', dbErr);
            res.status(500).json({ error: 'Failed to update blog entry' });
        } else {
            res.status(200).json({ message: 'Blog entry updated successfully' });
        }
    });
});

module.exports = router;
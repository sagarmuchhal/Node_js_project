const express = require('express');
const cors = require('cors');
const app = express();
const port = 4000; // Choose the desired port
const userRoute = require('./routes/user'); // Import the user route

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(userRoute);
app.use('/uploads', express.static('uploads'));


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
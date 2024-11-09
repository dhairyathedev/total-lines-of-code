require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Queue } = require('bullmq');
const app = express();

app.use(express.json());

const connection = {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
};

const queue = new Queue('clone-repo', { connection });

app.post('/get-total-lines', async (req, res) => {
    const { token, userId } = req.body;

    const response = await queue.add('clone-repo', { token, userId });

    res.json({
        message: 'Cloning repositories in the background. Check your email soon for the total lines of code.',
        job: response
    });
});


app.listen(5000, '0.0.0.0', () => {
    console.log('Server is running on port 5000');
});

require('dotenv').config();
const { Worker } = require('bullmq');
const { countTotalLines, cleanup } = require('./utils/handler');

const worker = new Worker(
    'count-lines', 
    async (job) => {
        try {
            console.log(`Processing count-lines job for user ${job.data.userId}`);
            const { userId } = job.data;
            const [totalLines, error] = await countTotalLines(userId);

            if (error) {
                throw new Error(error);
            }

            await cleanup(userId);
            console.log(`Total lines of code for ${userId}: ${totalLines}`);

            return { totalLines, userId };
        } catch (error) {
            console.error(`Error processing count-lines job:`, error);
            throw error;
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST,
            port: 6379,
            password: process.env.REDIS_PASSWORD,
        }
    }
);

worker.on('completed', (jobId, result) => {
    console.log(`Total lines of code for user ${result.userId}: ${result.totalLines}`);
});

console.log('Count lines worker started');
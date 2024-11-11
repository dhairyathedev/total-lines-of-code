require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const { countTotalLines, cleanup } = require('./utils/handler');

const validateEnvironmentVars = () => {
    const requiredVars = ['REDIS_HOST', 'REDIS_PASSWORD'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};

const redisConfig = {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
};

const mailQueue = new Queue('mail-queue', {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});

const processJob = async (job) => {
    if (!job.data?.userId) {
        throw new Error('Missing required userId in job data');
    }

    const { userId } = job.data;
    
    try {
        const [totalLines, error] = await countTotalLines(userId);
        
        if (error) {
            throw new Error(`Failed to count lines: ${error}`);
        }

        await cleanup(userId);
        
        return { totalLines, userId, error: null };
    } catch (error) {
        await cleanup(userId).catch(cleanupError => {
            console.error(`Cleanup failed for ${userId}:`, cleanupError);
        });
        
        throw error;
    }
};

const worker = new Worker('count-lines', processJob, {
    connection: redisConfig,
    concurrency: 5,
    limiter: {
        max: 1000,
        duration: 5000
    }
});

worker.on('completed', async (job, result) => {
    try {
        await mailQueue.add('mail-queue', {
            email: "hello@dhairyashah.dev",
            totalLines: result.totalLines,
            error: result.error,
            userId: result.userId
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
        
        console.log(`Job completed for user ${result.userId}: ${result.totalLines} lines`);
    } catch (error) {
        console.error('Failed to add mail job:', error);
        throw error;
    }
});

worker.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed:`, error);
});

worker.on('error', error => {
    console.error('Worker error:', error);
});

process.on('SIGTERM', async () => {
    await worker.close();
    await mailQueue.close();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await worker.close();
    await mailQueue.close();
    process.exit(1);
});

try {
    validateEnvironmentVars();
    console.log('Count lines worker started');
} catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
}
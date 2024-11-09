require('dotenv').config();
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { Worker, Queue } = require('bullmq');
const { getRepositories } = require('./utils/handler');
const path = require('path');
const fs = require('fs/promises');


const connection = {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
};

async function cloneRepo(repo, token, userId) {
    try {
        // index.js is in /mnt/main_hdd/Programming/Projects/total-lines-of-code/backend/services/clone-repo
        const storagePath = path.join('..', '..', 'storage', userId);
        await fs.mkdir(storagePath, { recursive: true });

        const cloneUrl = repo.clone_url.replace('https://', `https://${token}@`);
        await execPromise(`git clone ${cloneUrl} ${path.join(storagePath, repo.name)}`);

        return null;
    } catch (error) {
        return `Failed to clone ${repo.name}: ${error.message}`;
    }
}

const worker = new Worker('clone-repo', async (job) => {
    const { token, userId } = job.data;
    try {
        const [repos, repoError] = await getRepositories(token);
        if (repoError) {
            throw new Error(`Failed to get repositories: ${repoError}`);
        }
        if (!repos?.length) {
            throw new Error('No repositories found');
        }
        for(const repo of repos) {
            const error = await cloneRepo(repo, token, userId);
            if (error) {
                console.warn(`Warning: Skipping repository ${repo.name} due to error: ${error}`);
                continue; // Skip to the next repository
            }
        }
    } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        throw error; // Trigger retry
    }
}, {
    connection,
    concurrency: 3,
    attempts: 3, // Retry up to 3 times
    backoff: {
        type: 'exponential',
        delay: 1000 // Start with 1 second delay, then exponentially increase
    },
    removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000 // Keep last 1000 completed jobs
    },
    removeOnFail: {
        age: 24 * 3600 * 7 // Keep failed jobs for 7 days
    }
});
worker.on('completed', (jobId, result) => {
    console.log(`Job ${jobId} completed with result: ${result}`);
})

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err);
});

worker.on('error', err => {
    console.error('Worker error:', err);
});


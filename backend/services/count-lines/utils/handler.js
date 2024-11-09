const path = require('path');
const fs = require('fs/promises');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const rimraf = util.promisify(require('rimraf'));

async function countTotalLines(userId) {
    let totalLines = 0;
    const storagePath = path.join('..', '..', 'storage', userId);
    console.log(`Counting lines for user ${userId} in directory ${storagePath}`);
    // list all files in the directory
    const files = await fs.readdir(storagePath);
    console.log(`Files in directory: ${files}`);

    try {
        const repos = await fs.readdir(storagePath);
        
        for (const repoName of repos) {
            const repoPath = path.join(storagePath, repoName);
            const stats = await fs.stat(repoPath);
            
            if (stats.isDirectory()) {
                try {
                    const { stdout } = await execPromise(
                        'git ls-files | xargs wc -l | tail -n 1',
                        { cwd: repoPath }
                    );

                    const match = stdout.match(/(\d+)\s+total/);
                    if (match) {
                        totalLines += parseInt(match[1], 10);
                    } else {
                        console.warn(`Warning: Could not find line count for ${repoName}. Skipping.`);
                    }
                } catch (error) {
                    console.warn(`Warning: An error occurred in repository ${repoName} while counting lines:`, error);
                }
            }
        }
        
        return [totalLines, null];
    } catch (error) {
        return [null, `Error counting lines: ${error.message}`];
    }
}

async function cleanup(userId) {
    const storagePath = path.join('..', '..', 'storage', userId);
    try {
        await rimraf(storagePath);
    } catch (error) {
        console.error(`Error during cleanup for user ${userId}:`, error);
    }
}

module.exports = { countTotalLines, cleanup };
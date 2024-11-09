const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const rimraf = util.promisify(require('rimraf'));

const app = express();
app.use(express.json());

/**
 * Fetches the list of repositories for the authenticated GitHub user.
 * @param {string} token - GitHub access token
 * @returns {Promise<[Array|null, string|null]>} - Returns [repos, error]
 */
async function getRepositories(token) {
    const repos = [];
    let page = 1;
    
    try {
        while (true) {
            const response = await axios.get('https://api.github.com/user/repos', {
                params: { page, per_page: 100 },
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            const pageRepos = response.data;
            if (!pageRepos.length) break;
            
            repos.push(...pageRepos);
            page++;
        }
        
        return [repos, null];
    } catch (error) {
        const message = error.response?.data?.message || 'Unknown error';
        return [null, `Error fetching repositories: ${message}`];
    }
}

/**
 * Clones the given repository into the storage/user_id directory.
 * @param {Object} repo - Repository object
 * @param {string} token - GitHub access token
 * @param {string} userId - User identifier
 * @returns {Promise<string|null>} - Returns error message if any
 */
async function cloneRepository(repo, token, userId) {
    try {
        const storagePath = path.join('storage', userId);
        await fs.mkdir(storagePath, { recursive: true });
        
        const cloneUrl = repo.clone_url.replace('https://', `https://${token}@`);
        await execPromise(`git clone ${cloneUrl} ${path.join(storagePath, repo.name)}`);
        
        return null;
    } catch (error) {
        return `Failed to clone ${repo.name}: ${error.message}`;
    }
}

/**
 * Counts the total lines of code in all cloned repositories.
 * @param {string} userId - User identifier
 * @returns {Promise<[number|null, string|null]>} - Returns [total lines, error]
 */
async function countTotalLines(userId) {
    let totalLines = 0;
    const storagePath = path.join('storage', userId);

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

/**
 * Deletes the storage/user_id folder to free up space.
 * @param {string} userId - User identifier
 */
async function cleanup(userId) {
    const storagePath = path.join('storage', userId);
    try {
        await rimraf(storagePath);
    } catch (error) {
        console.error(`Error during cleanup for user ${userId}:`, error);
    }
}

// Main route handler
app.post('/count-lines', async (req, res) => {
    const { USER_ID: userId, GITHUB_ACCESS_TOKEN: accessToken } = req.body;
    
    if (!userId || !accessToken) {
        return res.status(400).json({
            error: 'USER_ID and GITHUB_ACCESS_TOKEN are required'
        });
    }

    try {
        // Get repositories
        const [repos, repoError] = await getRepositories(accessToken);
        if (repoError) {
            return res.status(500).json({ error: repoError });
        }
        if (!repos?.length) {
            return res.status(404).json({ message: 'No repositories found.' });
        }

        // Clone repositories, skipping failed ones
        for (const repo of repos) {
            const error = await cloneRepository(repo, accessToken, userId);
            if (error) {
                console.warn(`Warning: Skipping repository ${repo.name} due to error: ${error}`);
                continue; // Skip to the next repository
            }
        }

        // Count lines in successfully cloned repositories
        const [totalLines, countError] = await countTotalLines(userId);
        if (countError) {
            await cleanup(userId);
            return res.status(500).json({ error: countError });
        }

        // Cleanup and return result
        await cleanup(userId);
        return res.json({ total_lines: totalLines });

    } catch (error) {
        await cleanup(userId);
        return res.status(500).json({ error: error.message });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
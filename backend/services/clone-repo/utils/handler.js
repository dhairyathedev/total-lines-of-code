const axios = require('axios');


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

module.exports = {
    getRepositories
};
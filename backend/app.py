from quart import Quart, jsonify
import aiohttp
from typing import List, Dict
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import time
import logging

# Load environment variables from .env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)

class GitHubLOCCounter:
    def __init__(self):
        self.base_url = "https://api.github.com"
        self.token = os.getenv('GITHUB_TOKEN')
        if not self.token:
            raise ValueError("GITHUB_TOKEN environment variable is required")

        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": f"token {self.token}"
        }
        self.session = None
        self.executor = ThreadPoolExecutor(max_workers=10)

    async def get_authenticated_user_repos(self) -> List[Dict]:
        """Fetch all repositories (public and private) for the authenticated user."""
        repos = []
        page = 1
        async with aiohttp.ClientSession(headers=self.headers) as session:
            while True:
                try:
                    async with session.get(
                        f"{self.base_url}/user/repos",
                        params={
                            "page": page,
                            "per_page": 100,
                            "type": "owner",  # Only repos owned by the user
                            "sort": "updated"
                        }
                    ) as response:
                        if response.status != 200:
                            text = await response.text()
                            raise Exception(f"Failed to fetch repositories: {text}")

                        current_repos = await response.json()
                        if not current_repos:
                            break

                        repos.extend(current_repos)
                        page += 1
                        logger.info(f"Fetched page {page-1} of repositories")
                except Exception as e:
                    logger.error(f"Error fetching repositories: {str(e)}")
                    raise

        return repos

    def count_file_lines(self, content: str) -> int:
        """Count the number of lines in a file."""
        return len(content.splitlines())

    def is_code_file(self, filename: str) -> bool:
        """Check if the file is a code file based on extension."""
        code_extensions = {
            '.py', '.js', '.java', '.cpp', '.c', '.h', '.cs', '.php',
            '.rb', '.go', '.rs', '.swift', '.kt', '.ts', '.jsx', '.tsx',
            '.html', '.css', '.scss', '.sass', '.less', '.sql', '.sh',
            '.bash', '.r', '.m', '.mm', '.scala', '.pl', '.pm'
        }
        return any(filename.lower().endswith(ext) for ext in code_extensions)

    async def get_repository_files(self, repo_name: str, session: aiohttp.ClientSession) -> List[Dict]:
        """Recursively get all files in a repository using async calls."""
        async def get_contents(path: str = "") -> List[Dict]:
            try:
                async with session.get(
                    f"{self.base_url}/repos/{repo_name}/contents/{path}",
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to get contents for {repo_name}/{path}: {response.status}")
                        return []

                    contents = await response.json()
                    if not isinstance(contents, list):
                        return []

                    files = []
                    tasks = []

                    for item in contents:
                        if item['type'] == 'file' and self.is_code_file(item['name']):
                            files.append(item)
                        elif item['type'] == 'dir':
                            tasks.append(get_contents(item['path']))

                    if tasks:
                        subdirectory_files = await asyncio.gather(*tasks, return_exceptions=True)
                        for subfiles in subdirectory_files:
                            if isinstance(subfiles, list):  # Only extend if not an exception
                                files.extend(subfiles)

                    return files
            except Exception as e:
                logger.error(f"Error getting contents for {repo_name}/{path}: {str(e)}")
                return []

        return await get_contents()

    async def process_file(self, file: Dict, session: aiohttp.ClientSession) -> int:
        """Process a single file and return its line count."""
        try:
            async with session.get(file['download_url']) as response:
                if response.status == 200:
                    content = await response.text()
                    return self.count_file_lines(content)
        except Exception as e:
            logger.error(f"Error processing file {file['name']}: {str(e)}")
        return 0

    async def count_repository_lines(self, repo_name: str) -> Dict:
        """Count lines of code in a repository using async operations."""
        try:
            logger.info(f"Processing repository: {repo_name}")
            async with aiohttp.ClientSession(headers=self.headers) as session:
                files = await self.get_repository_files(repo_name, session)

                if not files:
                    logger.info(f"No files found in repository: {repo_name}")
                    return {
                        'repository': repo_name,
                        'total_lines': 0,
                        'files_processed': 0
                    }

                # Process files concurrently with a semaphore to limit concurrent requests
                sem = asyncio.Semaphore(5)  # Limit concurrent file processing
                async def process_with_semaphore(file):
                    async with sem:
                        return await self.process_file(file, session)

                tasks = [process_with_semaphore(file) for file in files]
                line_counts = await asyncio.gather(*tasks, return_exceptions=True)

                # Filter out exceptions and sum valid line counts
                valid_counts = [count for count in line_counts if isinstance(count, int)]

                result = {
                    'repository': repo_name,
                    'total_lines': sum(valid_counts),
                    'files_processed': len(valid_counts)
                }
                logger.info(f"Repository {repo_name} processed: {result}")
                return result
        except Exception as e:
            logger.error(f"Error processing repository {repo_name}: {str(e)}")
            return {
                'repository': repo_name,
                'total_lines': 0,
                'files_processed': 0,
                'error': str(e)
            }

    async def process_repositories(self, repos: List[Dict]) -> Dict:
        """Process all repositories concurrently."""
        # Limit concurrent repository processing
        sem = asyncio.Semaphore(3)

        async def process_repo_with_semaphore(repo):
            async with sem:
                if not repo['fork']:
                    return await self.count_repository_lines(repo['full_name'])
                return None

        tasks = [process_repo_with_semaphore(repo) for repo in repos]
        repo_stats = await asyncio.gather(*tasks)

        total_stats = {
            'total_lines': 0,
            'total_files': 0,
            'repositories_processed': 0,
            'repository_details': []
        }

        for stats in repo_stats:
            if stats is not None:  # Skip None results (forked repos)
                total_stats['total_lines'] += stats['total_lines']
                total_stats['total_files'] += stats['files_processed']
                total_stats['repositories_processed'] += 1
                total_stats['repository_details'].append(stats)

        return total_stats

@app.route('/count-my-loc', methods=['GET'])
async def count_authenticated_user_loc():
    try:
        start_time = time.time()
        counter = GitHubLOCCounter()

        # Get all repositories for authenticated user
        repos = await counter.get_authenticated_user_repos()
        logger.info(f"Found {len(repos)} repositories")

        # Process repositories and get stats
        total_stats = await counter.process_repositories(repos)

        # Add execution time to response
        total_stats['execution_time_seconds'] = round(time.time() - start_time, 2)

        return jsonify(total_stats)  # Changed from app.make_response(jsonify())
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 500  # Changed from app.make_response(jsonify())

@app.route('/health', methods=['GET'])
async def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

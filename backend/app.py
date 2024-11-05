from flask import Flask, jsonify, request
import requests
import subprocess
import os
import re
import shutil

app = Flask(__name__)

def get_repositories(token):
    """Fetches the list of repositories for the authenticated GitHub user."""
    url = 'https://api.github.com/user/repos'
    repos = []
    page = 1
    headers = {'Authorization': f'Bearer {token}'}

    while True:
        response = requests.get(url, params={'page': page, 'per_page': 100}, headers=headers)
        if response.status_code != 200:
            return None, f"Error fetching repositories: {response.json().get('message', 'Unknown error')}"
        page_repos = response.json()
        if not page_repos:
            break
        repos.extend(page_repos)
        page += 1

    return repos, None

def clone_repository(repo, token, user_id):
    """Clones the given repository URL into the storage/user_id directory."""
    try:
        storage_path = os.path.join('storage', user_id)
        os.makedirs(storage_path, exist_ok=True)
        
        clone_url = repo['clone_url'].replace('https://', f'https://{token}@')
        subprocess.run(['git', 'clone', clone_url, os.path.join(storage_path, repo['name'])], check=True)
        
    except subprocess.CalledProcessError as e:
        return f"Failed to clone {repo['name']}: {str(e)}"
    
    return None

def count_total_lines(user_id):
    """Counts the total lines of code in all cloned repositories under storage/user_id."""
    total_lines = 0
    storage_path = os.path.join('storage', user_id)

    try:
        for repo_name in os.listdir(storage_path):
            repo_path = os.path.join(storage_path, repo_name)
            if os.path.isdir(repo_path):
                result = subprocess.run(
                    "git ls-files | xargs wc -l | tail -n 1",
                    shell=True,
                    text=True,
                    capture_output=True,
                    check=True,
                    cwd=repo_path
                )

                total_line_count = result.stdout.strip()
                match = re.search(r'(\d+)\s+total', total_line_count)
                if match:
                    total = int(match.group(1))
                    total_lines += total
                else:
                    # Log a warning and skip to the next repository if line count isn't found
                    print(f"Warning: Could not find line count for {repo_name}. Skipping.")
    except subprocess.CalledProcessError as e:
        # Log a warning and continue counting for other repositories
        print(f"Warning: An error occurred in repository {repo_name} while counting lines: {str(e)}")

    return total_lines, None


def cleanup(user_id):
    """Deletes the storage/user_id folder to free up space."""
    storage_path = os.path.join('storage', user_id)
    if os.path.exists(storage_path):
        shutil.rmtree(storage_path)

@app.route('/count-lines', methods=['POST'])
def count_lines():
    data = request.get_json()
    
    # Extract USER_ID and ACCESS_TOKEN from request body
    user_id = data.get('USER_ID')
    access_token = data.get('GITHUB_ACCESS_TOKEN')
    
    if not user_id or not access_token:
        return jsonify({'error': 'USER_ID and GITHUB_ACCESS_TOKEN are required'}), 400

    try:
        repos, error = get_repositories(access_token)
        if error:
            return jsonify({'error': error}), 500
        if not repos:
            return jsonify({'message': "No repositories found."}), 404

        # Clone each repository
        for repo in repos:
            error = clone_repository(repo, access_token, user_id)
            if error:
                cleanup(user_id)
                return jsonify({'error': error}), 500

        # Count total lines
        total_lines, error = count_total_lines(user_id)
        if error:
            cleanup(user_id)
            return jsonify({'error': error}), 500

        # Clean up after counting lines
        cleanup(user_id)
        return jsonify({'total_lines': total_lines})

    except Exception as e:
        cleanup(user_id)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
        app.run(host='0.0.0.0', port=5000, debug=True)
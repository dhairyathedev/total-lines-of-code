import subprocess
import re

# Run the command and capture the output
try:
    result = subprocess.run(
        "cd ../ && git ls-files | xargs wc -l | tail -n 1",
        shell=True,
        text=True,
        capture_output=True,
        check=True
    )

    # Extract the total line count from the output
    total_line_count = result.stdout.strip()

    # Use regex to find the numeric value
    match = re.search(r'(\d+)\s+total', total_line_count)
    if match:
        total = int(match.group(1))
        print(f'Total lines: {total}')
    else:
        print('Could not find the total line count.')

except subprocess.CalledProcessError as e:
    print(f'An error occurred: {e}')

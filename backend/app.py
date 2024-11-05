from quart import Quart, jsonify
import aiohttp
from typing import List, Dict, Optional
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import time
import logging
import uuid
from dataclasses import dataclass, asdict
from enum import Enum
from collections import deque
import threading

# Load environment variables from .env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)

class RequestStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class QueuedRequest:
    id: str
    status: RequestStatus
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Dict] = None
    error: Optional[str] = None
    position_in_queue: Optional[int] = None

class RequestQueue:
    def __init__(self, max_concurrent: int = 2):
        self.queue = deque()
        self.active_requests: Dict[str, QueuedRequest] = {}
        self.max_concurrent = max_concurrent
        self.processing_count = 0
        self.lock = threading.Lock()
        self._cleanup_threshold = 1000  # Cleanup when we have more than 1000 completed requests
        
    def add_request(self) -> QueuedRequest:
        request_id = str(uuid.uuid4())
        request = QueuedRequest(
            id=request_id,
            status=RequestStatus.QUEUED,
            created_at=time.time()
        )
        
        with self.lock:
            self.queue.append(request)
            self.active_requests[request_id] = request
            request.position_in_queue = len(self.queue) - 1
        
        return request
    
    def get_request(self, request_id: str) -> Optional[QueuedRequest]:
        return self.active_requests.get(request_id)
    
    def update_queue_positions(self):
        """Update position in queue for all queued requests"""
        with self.lock:
            queue_position = 0
            for request_id in self.queue:
                request = self.active_requests[request_id]
                if request.status == RequestStatus.QUEUED:
                    request.position_in_queue = queue_position
                    queue_position += 1
    
    def can_process_next(self) -> bool:
        return self.processing_count < self.max_concurrent
    
    def get_next_request(self) -> Optional[QueuedRequest]:
        with self.lock:
            while self.queue:
                request_id = self.queue[0]
                request = self.active_requests[request_id]
                
                if request.status == RequestStatus.QUEUED:
                    self.processing_count += 1
                    request.status = RequestStatus.PROCESSING
                    request.started_at = time.time()
                    request.position_in_queue = None
                    self.update_queue_positions()
                    return request
                else:
                    self.queue.popleft()  # Remove processed requests from queue
            return None
    
    def complete_request(self, request_id: str, result: Dict = None, error: str = None):
        with self.lock:
            if request_id in self.active_requests:
                request = self.active_requests[request_id]
                request.completed_at = time.time()
                request.result = result
                request.error = error
                request.status = RequestStatus.FAILED if error else RequestStatus.COMPLETED
                self.processing_count -= 1
                
                # Cleanup old completed requests if we've accumulated too many
                if len(self.active_requests) > self._cleanup_threshold:
                    self._cleanup_old_requests()
    
    def _cleanup_old_requests(self, max_age_hours: int = 24):
        """Remove completed/failed requests older than max_age_hours"""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        to_remove = []
        for request_id, request in self.active_requests.items():
            if request.status in (RequestStatus.COMPLETED, RequestStatus.FAILED):
                if current_time - request.completed_at > max_age_seconds:
                    to_remove.append(request_id)
        
        for request_id in to_remove:
            del self.active_requests[request_id]


        return total_stats

# Initialize the request queue
request_queue = RequestQueue(max_concurrent=2)

async def process_request(request: QueuedRequest):
    """Process a single request"""
    try:
        counter = GitHubLOCCounter()
        repos = await counter.get_authenticated_user_repos()
        total_stats = await counter.process_repositories(repos)
        total_stats['execution_time_seconds'] = round(time.time() - request.started_at, 2)
        request_queue.complete_request(request.id, result=total_stats)
    except Exception as e:
        logger.error(f"Error processing request {request.id}: {str(e)}")
        request_queue.complete_request(request.id, error=str(e))

async def queue_processor():
    """Background task to process queued requests"""
    while True:
        if request_queue.can_process_next():
            request = request_queue.get_next_request()
            if request:
                asyncio.create_task(process_request(request))
        await asyncio.sleep(1)  # Check queue every second

@app.before_serving
async def startup():
    """Start the queue processor when the application starts"""
    app.queue_processor = asyncio.create_task(queue_processor())

@app.after_serving
async def shutdown():
    """Clean up the queue processor when the application shuts down"""
    app.queue_processor.cancel()
    try:
        await app.queue_processor
    except asyncio.CancelledError:
        pass

def format_request_status(request: QueuedRequest) -> Dict:
    """Format the request status for API response"""
    status_dict = asdict(request)
    status_dict['status'] = request.status.value
    
    # Add estimated wait time for queued requests
    if request.status == RequestStatus.QUEUED and request.position_in_queue is not None:
        # Rough estimate: 5 minutes per repository scan, 2 concurrent requests
        estimated_wait = (request.position_in_queue // 2 + 1) * 5
        status_dict['estimated_wait_minutes'] = estimated_wait
    
    return status_dict

@app.route('/count-my-loc', methods=['POST'])
async def count_authenticated_user_loc():
    """Endpoint to initiate a new LOC counting request"""
    try:
        request = request_queue.add_request()
        return jsonify({
            'request_id': request.id,
            'status': format_request_status(request)
        })
    except Exception as e:
        logger.error(f"Error creating request: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/<request_id>', methods=['GET'])
async def get_request_status(request_id: str):
    """Endpoint to check the status of a specific request"""
    request = request_queue.get_request(request_id)
    if not request:
        return jsonify({'error': 'Request not found'}), 404
    
    return jsonify(format_request_status(request))

@app.route('/health', methods=['GET'])
async def health_check():
    """Health check endpoint with queue statistics"""
    return jsonify({
        'status': 'healthy',
        'queue_length': len(request_queue.queue),
        'active_requests': request_queue.processing_count
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
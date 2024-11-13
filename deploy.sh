#!/bin/bash

# Pull the latest code
git pull

# Build and deploy each service
services=("api" "clone-repo" "count-lines" "mailer")

for service in "${services[@]}"
do
    echo "Deploying $service..."
    
    # Build the new image
    docker build -t "tloc-$service" \
        $([ "$service" = "api" ] && echo "." || echo "./services/$service")
    
    # Stop and remove existing container
    docker stop "tloc-$service" || true
    docker rm "tloc-$service" || true
    
    # Run the new container with appropriate settings
    case $service in
        "api")
            docker run -d \
                --name "tloc-$service" \
                -p 5000:5000 \
                -e NODE_ENV=production \
                -e REDIS_HOST=your-redis-host \
                -e REDIS_PORT=6379 \
                -e REDIS_PASSWORD=your-redis-password \
                -v $(pwd)/storage:/app/storage \
                --restart unless-stopped \
                "tloc-$service"
            ;;
        "mailer")
            docker run -d \
                --name "tloc-$service" \
                -e NODE_ENV=production \
                -e REDIS_HOST=your-redis-host \
                -e REDIS_PORT=6379 \
                -e REDIS_PASSWORD=your-redis-password \
                -e RESEND_API_KEY=your-resend-api-key \
                --restart unless-stopped \
                "tloc-$service"
            ;;
        *)
            docker run -d \
                --name "tloc-$service" \
                -e NODE_ENV=production \
                -e REDIS_HOST=your-redis-host \
                -e REDIS_PORT=6379 \
                -e REDIS_PASSWORD=your-redis-password \
                -v $(pwd)/storage:/app/storage \
                --restart unless-stopped \
                "tloc-$service"
            ;;
    esac
done 
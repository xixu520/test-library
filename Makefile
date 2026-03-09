.PHONY: up down build logs dev

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Rebuild and start
build:
	docker-compose up -d --build

# View logs
logs:
	docker-compose logs -f

# Dev mode - start only infrastructure
dev-infra:
	docker-compose up -d postgres

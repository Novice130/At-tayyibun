# Production environment configuration
project_id  = "at-tayyibun-prod"
environment = "prod"
region      = "us-central1"

# Database - Production tier
db_tier      = "db-custom-2-4096"  # 2 vCPU, 4GB RAM
db_disk_size = 50

# Redis - Production
redis_memory_gb = 2

# Container images
api_image = "gcr.io/at-tayyibun-prod/at-tayyibun-api:latest"
web_image = "gcr.io/at-tayyibun-prod/at-tayyibun-web:latest"

# CORS
cors_origins = [
  "https://at-tayyibun.com",
  "https://www.at-tayyibun.com"
]

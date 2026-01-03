variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "at-tayyibun"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 10
}

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "api_image" {
  description = "Docker image for API"
  type        = string
  default     = "gcr.io/PROJECT_ID/at-tayyibun-api:latest"
}

variable "web_image" {
  description = "Docker image for Web"
  type        = string
  default     = "gcr.io/PROJECT_ID/at-tayyibun-web:latest"
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

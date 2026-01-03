# At-Tayyibun Infrastructure
# Google Cloud Platform Terraform Configuration

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # Configure in environments/*.tfvars
    # bucket = "at-tayyibun-terraform-state"
    # prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudscheduler.googleapis.com",
    "compute.googleapis.com",
    "identitytoolkit.googleapis.com",
  ])
  
  service            = each.key
  disable_on_destroy = false
}

# Cloud SQL (PostgreSQL)
resource "google_sql_database_instance" "main" {
  name             = "${var.project_name}-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "prod"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = var.environment == "prod"
  depends_on          = [google_project_service.services]
}

resource "google_sql_database" "main" {
  name     = "at_tayyibun"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = "tayyibun_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

# Memorystore (Redis)
resource "google_redis_instance" "cache" {
  name           = "${var.project_name}-redis-${var.environment}"
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.redis_memory_gb
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version = "REDIS_7_0"
  display_name  = "At-Tayyibun Cache"

  depends_on = [google_project_service.services]
}

# Cloud Storage Buckets
resource "google_storage_bucket" "photos" {
  name     = "${var.project_name}-photos-${var.environment}"
  location = var.region
  
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365
      with_state = "ARCHIVED"
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "PUT"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "avatars" {
  name     = "${var.project_name}-avatars-${var.environment}"
  location = var.region
  
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.project_name}-subnet"
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region

  private_ip_google_access = true
}

# VPC Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "${var.project_name}-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  
  min_instances = 2
  max_instances = var.environment == "prod" ? 10 : 3
}

# Private Service Access (for Cloud SQL and Redis)
resource "google_compute_global_address" "private_ip" {
  name          = "${var.project_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]
}

# Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_name}-db-password"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "encryption_key" {
  secret_id = "${var.project_name}-encryption-key"
  
  replication {
    auto {}
  }
}

# Cloud Tasks Queue
resource "google_cloud_tasks_queue" "main" {
  name     = "${var.project_name}-tasks"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 100
    max_concurrent_dispatches = 10
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "1s"
    max_backoff        = "120s"
    max_doublings      = 4
  }
}

# Cloud Scheduler Jobs
resource "google_cloud_scheduler_job" "request_expiry" {
  name             = "${var.project_name}-request-expiry"
  description      = "Check and expire pending info requests"
  schedule         = "*/15 * * * *"  # Every 15 minutes
  time_zone        = "America/Chicago"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.api.status[0].url}/api/jobs/request-expiry"
    
    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}

resource "google_cloud_scheduler_job" "gold_boost" {
  name             = "${var.project_name}-gold-boost"
  description      = "Weekly boost for Gold members"
  schedule         = "0 0 * * 0"  # Every Sunday midnight
  time_zone        = "America/Chicago"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.api.status[0].url}/api/jobs/gold-boost"
    
    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}

# Service Accounts
resource "google_service_account" "api" {
  account_id   = "${var.project_name}-api"
  display_name = "At-Tayyibun API Service Account"
}

resource "google_service_account" "scheduler" {
  account_id   = "${var.project_name}-scheduler"
  display_name = "At-Tayyibun Scheduler Service Account"
}

# IAM Bindings
resource "google_project_iam_member" "api_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  project  = var.project_id
  location = var.region
  service  = google_cloud_run_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

# Cloud Run - API
resource "google_cloud_run_service" "api" {
  name     = "${var.project_name}-api"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.api.email
      
      containers {
        image = var.api_image

        ports {
          container_port = 3001
        }

        env {
          name  = "NODE_ENV"
          value = var.environment
        }

        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_password.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "REDIS_URL"
          value = "redis://${google_redis_instance.cache.host}:6379"
        }

        env {
          name  = "GCS_BUCKET_NAME"
          value = google_storage_bucket.photos.name
        }

        resources {
          limits = {
            cpu    = var.environment == "prod" ? "2" : "1"
            memory = var.environment == "prod" ? "1Gi" : "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = var.environment == "prod" ? "10" : "2"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.id
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.db_password,
  ]
}

# Cloud Run - Web
resource "google_cloud_run_service" "web" {
  name     = "${var.project_name}-web"
  location = var.region

  template {
    spec {
      containers {
        image = var.web_image

        ports {
          container_port = 3000
        }

        env {
          name  = "NEXT_PUBLIC_API_URL"
          value = google_cloud_run_service.api.status[0].url
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = var.environment == "prod" ? "10" : "2"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Make web service publicly accessible
resource "google_cloud_run_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  service  = google_cloud_run_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "api_url" {
  value = google_cloud_run_service.api.status[0].url
}

output "web_url" {
  value = google_cloud_run_service.web.status[0].url
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "photos_bucket" {
  value = google_storage_bucket.photos.name
}

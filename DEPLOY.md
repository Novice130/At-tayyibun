# Deployment Guide: Google Cloud Run

This guide will help you deploy At-Tayyibun to Google Cloud Platform (GCP).

## Prerequisites

Since you are using Windows, you need to install the following tools:

1.  **Google Cloud SDK (gcloud)**
    *   Download and install: [https://cloud.google.com/sdk/docs/install#windows](https://cloud.google.com/sdk/docs/install#windows)
    *   After install, open PowerShell and run: `gcloud init` to log in and select your project.
2.  **Terraform**
    *   Download the Windows binary: [https://developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)
    *   Extract `terraform.exe` to a folder (e.g., `C:\Terraform`).
    *   Add that folder to your PATH environment variable.

## Step 1: GCP Project Setup

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a New Project (e.g., `at-tayyibun-prod`).
3.  **Enable Billing** for the project.
4.  Enable the following APIs (search for "APIs & Services" > "Library"):
    *   Cloud Run API
    *   Cloud Build API
    *   Artifact Registry API
    *   Cloud SQL Admin API
    *   Memorystore for Redis API
    *   Secret Manager API

## Step 2: Build Docker Images

We use Google Cloud Build to build the Docker images remotely.

1.  Open your terminal in the project root (`At Tayyibun`).
2.  Run the build command:
    ```powershell
    gcloud builds submit --config cloudbuild.yaml .
    ```
    *replace `PROJECT_ID` with your actual project ID if prompted or set it via `gcloud config set project YOUR_PROJECT_ID`.*

## Step 3: Deploy Infrastructure with Terraform

1.  Navigate to the terraform directory:
    ```powershell
    cd infrastructure/terraform
    ```

2.  Initialize Terraform:
    ```powershell
    terraform init
    ```

3.  Update variables (Optional):
    *   Open `environments/prod.tfvars` and check the settings. Update `project_id` to match your GCP project ID.

4.  Preview the deployment:
    ```powershell
    terraform plan -var-file="environments/prod.tfvars" -out=tfplan
    ```

5.  Apply the deployment (This will create the resources):
    ```powershell
    terraform apply "tfplan"
    ```
    *Type `yes` when prompted.*

## Step 4: Post-Deployment

1.  After Terraform finishes, it will output the `web_url` and `api_url`.
2.  Go to your `web_url` to see the live site!
3.  You may need to configure your domain name mapping in Cloud Run settings in the Google Cloud Console.

## Troubleshooting

*   **Permissions**: Ensure your local user is an "Owner" or "Editor" of the GCP project.
*   **APIs**: Terraform will fail if the required APIs are not enabled in the GCP Console.

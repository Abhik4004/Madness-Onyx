# NextGen IGA Platform: User & System Guide

Welcome to the NextGen IGA platform. This guide explains how to navigate the system and perform key identity governance tasks.

## 🏁 Getting Started
### 1. Login & Dashboard
*   **Authentication**: Log in using your corporate credentials. If MFA is enabled, you will be prompted for a verification code.
*   **User Dashboard**: Upon entry, you'll see a summary of your active access, pending requests, and any urgent tasks (like certifications) requiring your attention.

## 🔑 Requesting Access
### 1. Browse the Catalog
*   Navigate to **Access Requests** > **New Request**.
*   Browse or search for applications and roles.
*   Click **Request Access** on the desired item.

### 2. Configure Duration
*   For sensitive resources, you may choose a **Duration** (e.g., 4 hours, 1 day).
*   The system will automatically revoke this access once the time lapses.

### 3. Track Status
*   Monitor your requests in the **My Requests** tab.
*   Statuses include: `PENDING` (awaiting approval), `APPROVED`, `PROVISIONED` (active), and `EXPIRED`.

## 👥 Supervisor Tasks
### 1. Managing Approvals
*   Navigate to **Supervisor** > **Approval Queue**.
*   Review request details, including the requester's identity and the justification provided.
*   Click **Approve** or **Deny**. Approved requests are provisioned immediately.

### 2. Access Certifications
*   Periodic reviews will appear in **My Tasks**.
*   Review each team member's access and select **Certify** (keep) or **Revoke** (remove).
*   Submit the campaign once all items are reviewed.

## 🛠️ Administrative Workflows
### 1. Bulk CSV Provisioning
*   Navigate to **Admin** > **Provisioning** > **CSV Upload**.
*   Upload a CSV file (use the provided template for best results).
*   **Smart Mapping**: The system will automatically detect your columns. Review the preview for any errors (highlighted in red) before clicking **Create Users**.

### 2. Application Registration
*   Go to **Admin** > **Applications** > **Register New**.
*   Define the application name, owner, and risk level to include it in the self-service catalog.

### 3. Role Management
*   Manage organizational roles and their constituent permissions in the **Roles** section.
*   You can create "Bundled Roles" to streamline the request process for new employees.

## 🔍 Monitoring & Compliance
### 1. Audit Logs
*   The **Audit Explorer** provides a detailed, searchable history of every action taken in the system.
*   Use filters to search by User ID, Action Type (e.g., `USER_LOGIN`, `ACCESS_REVOKED`), or Date Range.

### 2. AI Assistant
*   Use the **AI Assistant** for natural language queries like:
    *   *"Show me all pending approvals older than 2 days."*
    *   *"Who revoked John Doe's access to AWS?"*
    *   *"What is the current health of the Provisioning service?"*

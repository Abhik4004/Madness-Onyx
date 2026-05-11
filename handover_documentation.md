# Project Handover Documentation: NextGen IGA Platform

**Date**: May 11, 2026  
**Subject**: Technical & Functional Overview for Panel Presentation  
**Project**: NextGen Identity Governance & Administration (IGA)

---

## 1. Executive Summary
The NextGen IGA platform is a modern, cloud-native solution designed to solve the complexities of enterprise identity management and access governance. By leveraging a microservices architecture, event-driven communication, and AI-assisted automation, the system provides a seamless experience for users, managers, and administrators while maintaining high security and compliance standards.

## 2. Technical Architecture
The system is built on a decoupled **Microservices Architecture**, ensuring high scalability and fault tolerance.

### 2.1 Service Layer
*   **API Gateway (Express.js)**: The central entry point. Handles JWT authentication, MFA verification, and intelligent request routing. It implements a **Direct HTTP Bypass** pattern for low-latency administrative operations while relaying complex tasks to the event bus.
*   **Access Management Service**: The primary business logic layer. Manages the identity lifecycle, access requests, role definitions, and certification logic.
*   **Event Manager**: Orchestrates asynchronous workflows using **NATS Messaging**. It manages service discovery and event propagation across the ecosystem.
*   **Recommendation & AI Service**: Utilizes machine learning patterns and LLM integrations to provide peer-based access suggestions and anomaly detection.
*   **Notification Service**: A dedicated engine for real-time WebSocket alerts and external email notifications.

### 2.2 Infrastructure & Communication
*   **Message Bus (NATS)**: Facilitates high-speed, asynchronous communication between services.
*   **Persistence (MySQL 8.0)**: Relational data storage for identities, governance records, and audit logs.
*   **Containerization (Docker)**: The entire stack is containerized for consistent deployment across local and cloud (AWS EC2) environments.

## 3. Core Functional Modules

### 3.1 Just-In-Time (JIT) Access & Auto-Revocation
A flagship feature allowing users to request time-bound privileged access.
*   **Dynamic Expiration**: The backend implements a robust SQL-level filtering logic using `COALESCE` across multiple timestamps (`decided_at`, `approved_at`, etc.) to ensure access is revoked exactly when it expires.
*   **Visual Lifecycle**: Users see real-time countdowns and progress bars, with expired access automatically moving to a dedicated "Expired" view for audit purposes.

### 3.2 Smart CSV Provisioning
A zero-config bulk user creation tool.
*   **Pattern Recognition**: The engine analyzes CSV content (not just headers) to intelligently map fields like Email, Full Name, and UID, even if the source file is misaligned.
*   **LDAP Integration**: Directly provisions accounts into target identity stores (e.g., OpenLDAP) with automated password generation and sync.

### 3.3 Access Certification & Compliance
*   **Campaign Lifecycle**: Admins can generate time-limited review campaigns.
*   **Manager Review Workspace**: A dedicated UI for supervisors to perform "Certify" or "Revoke" actions with integrated risk scores.
*   **Immutable Audit Trail**: Every action is captured in the Audit Log, providing a complete compliance history.

## 4. Security & Governance
*   **Stateless Authentication**: JWT-based auth ensures scalability.
*   **MFA (Multi-Factor Authentication)**: Integration with external auth providers for secure login.
*   **Role-Based Access Control (RBAC)**: Fine-grained permissions (Admin, Supervisor, User) enforced at the Gateway and Service levels.
*   **Automated Governance**: System-triggered revocations reduce the "Standing Privilege" risk.

## 5. Deployment Overview
The platform is fully containerized and deployable via **Docker Compose**.
*   **Cloud Ready**: Successfully tested for deployment on AWS EC2.
*   **Lean Architecture**: Services are optimized for low resource consumption while maintaining high throughput.

## 6. Future Roadmap
*   **Deep SCIM Integration**: Native support for provisioning into SaaS apps like Salesforce and Azure AD.
*   **Advanced AI Analytics**: Predictive risk modeling to block high-risk requests before they reach an approver.
*   **Self-Healing Identity**: Automated reconciliation jobs to detect and fix "Out-of-Band" changes in target systems.

---
**Technical Lead/Developer**: [Your Name/Team Name]  
**Corpus**: Abhik4004/Madness-Onyx

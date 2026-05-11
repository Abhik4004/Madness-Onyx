# NextGen IGA Platform: Project Overview

The NextGen IGA Platform is a distributed, microservices-based identity governance solution designed for high availability, security, and scalability. It leverages a modern event-driven architecture to handle complex identity workflows and automated provisioning.

## 🏗️ System Architecture

The platform follows a **Microservices Architecture** with a centralized API Gateway managing communication between specialized services.

### Core Components
1.  **API Gateway**: The central entry point. Handles authentication (JWT), request routing, and protocol translation. It features a "Direct Bypass" pattern for high-performance administrative queries.
2.  **Access Management Service**: The heart of the platform. Manages the core IGA logic, including access requests, certifications, roles, and the primary identity database.
3.  **Event Manager**: An event-driven orchestrator using **NATS** to coordinate asynchronous workflows and cross-service communication.
4.  **Notification Service**: Manages user alerts via WebSockets and external providers, ensuring timely responses to governance events.
5.  **Recommendation & AI Service**: Provides intelligent insights, risk scoring, and automated access suggestions using advanced analytics and LLM integrations.

## 🛠️ Technology Stack

### Frontend
*   **Framework**: React 18+ with Vite for ultra-fast development and optimized production bundles.
*   **State Management**: TanStack Query (React Query) for robust server-state synchronization.
*   **Styling**: Premium Vanilla CSS with a centralized Design System for high-fidelity aesthetics.
*   **Icons**: Lucide-React for a consistent and modern iconography.

### Backend
*   **Runtime**: Node.js 20+ with Express.js.
*   **Messaging**: NATS Messaging Bus for reliable event distribution and request/reply patterns.
*   **Database**: MySQL 8.0+ for persistent storage of identities, requests, and audit logs.
*   **Authentication**: JWT-based stateless authentication with MFA (Multi-Factor Authentication) support.

### Infrastructure & DevOps
*   **Containerization**: Docker and Docker Compose for standardized environments across development and production.
*   **Cloud Deployment**: Optimized for AWS EC2 deployment with a focus on lean resource utilization.
*   **Logging**: Centralized audit logging and system health monitoring.

## 🔄 Core Workflows

### Access Request Lifecycle
1.  **Request**: User submits a request via the frontend.
2.  **Relay**: Gateway wraps the request and publishes it to the NATS bus.
3.  **Process**: Access Management validates and stores the request as `PENDING`.
4.  **Approve**: Supervisor reviews and approves.
5.  **Provision**: System triggers automated provisioning to the target resource.
6.  **Expire**: Time-based logic automatically revokes access and notifies the user.

### Smart CSV Provisioning
The platform implements a unique **Smart Mapping** algorithm that allows administrators to upload CSV files with inconsistent headers. The system analyzes the data content to correctly identify and provision users, significantly reducing manual data prep time.

## 📈 Scalability & Performance
*   **Asynchronous Processing**: Long-running tasks (like bulk imports and campaign generation) are handled asynchronously via NATS JetStream.
*   **Stateless Services**: All microservices are designed to be stateless, allowing for horizontal scaling behind a load balancer.
*   **Optimized Queries**: Advanced SQL filtering and `COALESCE`-based timestamp fallbacks ensure consistent performance even with historical data.

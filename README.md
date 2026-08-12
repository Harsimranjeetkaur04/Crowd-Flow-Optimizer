# 🚨 CrowdFlow AI — Intelligent Crowd Safety & Venue Flow Optimizer

> **Next-Generation Real-Time Crowd Dynamics, Bottleneck Detection, and Dynamic Path Optimization for Mass Events & Smart Venues.**

[![React](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?logo=python)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📌 Problem Statement

Mass gatherings at stadiums, festivals, transit hubs, and arenas pose severe crowd management and safety challenges. Overcrowding, unexpected bottlenecks, and slow evacuation routes can lead to hazardous crowd crushing and stampedes. Standard static venue plans cannot adapt to live emergency situations or shifting crowd behavior.

**CrowdFlow AI** solves this by providing venue managers and event safety teams with a **real-time AI-powered crowd simulator, interactive visual venue layout editor, automated bottleneck predictor, and dynamic rerouting engine**.

---

## ✨ Key Features

- 🎨 **Interactive Drag & Drop Venue Layout Editor**: 
  - Graphically place and configure **Gates**, **Walkways**, **Concessions**, and **Exits**.
  - Fluid node drag-and-drop positioning with touch & pointer support.
  - Interactive edge connector tool with directional flow rates and capacity configuration.
- 🌊 **Real-Time Crowd Flow Simulator**:
  - Simulates agent movement, inflow rates, throughput capacities, and congestion levels across complex custom venue layouts.
- 🚨 **AI Bottleneck & Congestion Heatmap**:
  - Live visual overlay identifying critical pressure points, density thresholds, and high-risk stampede danger zones.
- 🧭 **Intelligent Dynamic Rerouting Engine**:
  - Computes optimal crowd dispersion routes using graph algorithms to prevent overload at main bottlenecks and redirect flow to underutilized exits.
- 📊 **Safety Dashboard & Real-Time Alerts**:
  - Instant hazard notifications, flow rate metrics, and emergency response insights for event safety operators.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, Pydantic, SQLAlchemy, NetworkX, Uvicorn |
| **Database** | SQLite (Development) / PostgreSQL-ready SQLAlchemy ORM |
| **DevOps & Containerization** | Docker, Docker Compose, CORS Security Middleware |

---

## 🏗️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │              CrowdFlow AI Frontend (React)              │
               │  - Interactive Layout Editor (HTML5 Pointer Canvas)    │
               │  - Live Heatmap & Route Overlay Visualization          │
               │  - Emergency Control Panel & Real-time Metrics         │
               └──────────────────────────┬─────────────────────────────┘
                                          │  HTTP / REST API
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │              FastAPI Backend Service                   │
               │  - Flow Simulation Engine (Graph Dynamics)             │
               │  - Bottleneck & Density Detection Module               │
               │  - Path Optimization & Rerouting Algorithms            │
               │  - SQLite / Database Persistence                     │
               └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Option 1: Docker (Recommended)

Run the complete frontend and backend services in isolated containers with a single command:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/crowd-flow-optimiser.git
   cd crowd-flow-optimiser
   ```

2. **Setup environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Spin up containers**:
   ```bash
   docker compose up --build
   ```

4. **Access the platform**:
   - 🌐 **Web Dashboard**: `http://localhost:5173`
   - 📖 **Interactive API Docs (Swagger UI)**: `http://localhost:8000/docs`

---

### Option 2: Local Manual Setup

#### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup (React + Vite)

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📄 API Reference Highlights

- `GET /api/simulation/status` - Fetch current simulation state, active bottlenecks, and node density.
- `POST /api/simulation/run` - Execute flow simulation step over a specified layout.
- `POST /api/venues/layout` - Save or update venue node/edge layout.
- `POST /api/optimize/routes` - Calculate optimized evacuation/flow paths.

---

## 👥 Hackathon Team & Acknowledgments

Developed with ❤️ for crowd safety enhancement and smart venue intelligence.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

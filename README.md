<p align="center">
  <h1 align="center">🏟️ CrowdFlow AI</h1>
  <p align="center"><strong>AI-Powered Crowd Safety Intelligence Platform</strong></p>
  <p align="center">
    Real-time crowd simulation · Bottleneck detection · Dynamic rerouting · ML risk prediction
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_18-TypeScript-3178C6?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-Python_3.10+-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/ML-Scikit--Learn-F7931E?logo=scikit-learn&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" />
</p>

---

## 🎯 The Problem

**Every year, crowd crushes at stadiums, festivals, and transit hubs injure thousands and claim hundreds of lives.** The 2022 Seoul Halloween crush (159 deaths), the 2021 Astroworld disaster (10 deaths), and the 2015 Mina stampede (2,400+ deaths) are devastating reminders that crowd management is literally a life-or-death problem.

Existing venue safety plans are **static blueprints** — they can't adapt when a gate suddenly gets overcrowded, a corridor becomes a chokepoint, or an emergency requires instant evacuation rerouting.

## 💡 Our Solution

**CrowdFlow AI** is an end-to-end intelligent platform that lets venue operators:

1. **Design** any venue layout visually with a drag-and-drop editor
2. **Simulate** realistic crowd dynamics with configurable parameters
3. **Detect** dangerous bottlenecks before they become deadly
4. **Reroute** crowd flow in real-time using graph-based optimization
5. **Predict** future congestion risk using a trained ML model

---

## ✨ Features

### 🎨 Interactive Venue Layout Editor
Build any venue from scratch — stadiums, concert halls, transit stations, convention centers.

- **Drag-and-drop** node placement (Gates, Walkways, Concessions, Exits)
- **Click-to-connect** edge drawing with flow capacity configuration
- **Fluid repositioning** — click and drag nodes to rearrange your layout
- **Right-click delete**, edge removal, and one-click layout clear
- **Export as JSON** for sharing or API integration
- **Demo Stadium** preset for instant testing

### 🌊 Crowd Flow Simulation Engine
A discrete-step simulation engine models realistic crowd behavior:

- **Agent-based groups** spawned at gates with configurable arrival schedules
- **Density-aware movement** — agents slow down in congested areas (based on real crowd dynamics research)
- **Shortest-path routing** using NetworkX graph algorithms
- **Configurable parameters**: crowd size (100–50,000+), event schedules, simulation duration

### 🔥 Real-Time Density Heatmap
Live visualization of crowd density across the venue during simulation:

- **Color-coded nodes** from green (safe) → yellow (elevated) → red (critical)
- **Edge flow indicators** showing corridor throughput intensity
- **Timestep scrubbing** — watch the crowd dynamics unfold second by second

### ⚠️ Bottleneck Detection
Automatic identification of dangerous congestion points:

- **Density threshold analysis** on every node at every timestep
- **Severity scoring** (0–100%) based on occupancy vs. capacity ratios
- **Sorted risk table** with node-level breakdown

### 🔀 Intelligent Rerouting
When bottlenecks are detected, the engine computes alternative paths:

- **Graph-based shortest path** computation avoiding congested nodes
- **Time savings comparison**: baseline vs. congested vs. rerouted
- **Per-gate recommendations** with full path visualization
- **Percentage improvement** metrics for each suggested reroute

### 🤖 ML Congestion Risk Prediction
A trained Random Forest / Gradient Boosting model predicts future congestion:

- **Trained on 50,000 synthetic simulation states**
- **Predicts 5-minute critical bottleneck probability**
- **Risk classification**: Safe / Elevated / Critical
- **Hugging Face model card** integration for transparency

### 🧪 Counterfactual "What-If" Analysis
Test alternative strategies before deploying them:

- **Simulate interventions** (open new gate, increase corridor width, redirect flow)
- **Compare outcomes** against the original simulation
- **AI-powered strategy selection** picks the best intervention automatically

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Layout   │  │ Heatmap  │  │  Route   │  │Control │  │
│  │  Editor   │  │ Overlay  │  │ Overlay  │  │ Panel  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API + WebSocket
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend                         │
│                                                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Simulation   │  │  Bottleneck  │  │  Rerouting   │  │
│  │    Engine       │  │  Detector    │  │  Engine      │  │
│  └────────────────┘  └──────────────┘  └─────────────┘  │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   ML Predictor │  │Counterfactual│  │  Decision    │  │
│  │  (Scikit-Learn) │  │  Simulator   │  │  Engine      │  │
│  └────────────────┘  └──────────────┘  └─────────────┘  │
│                                                         │
│              SQLAlchemy ORM → SQLite / PostgreSQL        │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|:------|:-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, SVG Canvas |
| **Backend** | Python 3.10+, FastAPI, Pydantic v2, Uvicorn |
| **Simulation** | NetworkX (graph algorithms), NumPy |
| **ML / AI** | Scikit-Learn (Random Forest, Gradient Boosting), Joblib |
| **Database** | SQLAlchemy ORM, SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT (JSON Web Tokens), bcrypt password hashing |
| **DevOps** | Docker, Docker Compose |

---

## 🚀 Quick Start

### Option 1: Docker (One Command)

```bash
git clone https://github.com/Harsimranjeetkaur04/Crowd-Flow-Optimizer.git
cd Crowd-Flow-Optimizer
cp .env.example .env
docker compose up --build
```

- 🌐 **Dashboard**: http://localhost:5173
- 📖 **API Docs**: http://localhost:8000/docs

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 📸 How It Works (User Flow)

| Step | Action | What Happens |
|:----:|:-------|:-------------|
| **1** | 🏗️ **Design Venue** | Use the Layout Editor to place gates, walkways, concessions, and exits. Connect them with corridors. Or load the Demo Stadium. |
| **2** | ⚙️ **Configure Simulation** | Set crowd size, arrival schedule, and simulation duration in the Control Panel. |
| **3** | ▶️ **Run Simulation** | The backend engine simulates crowd movement step-by-step. Watch the live density heatmap update in real-time. |
| **4** | 📊 **Analyze Results** | View KPI cards (crowd size, bottlenecks found, reroutes suggested), the final heatmap, bottleneck severity table, and optimized reroute paths. |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `GET` | `/` | Health check & API status |
| `POST` | `/api/simulate` | Run a full crowd simulation |
| `POST` | `/api/predict-congestion` | ML-based congestion risk prediction |
| `POST` | `/api/counterfactual` | What-if scenario analysis |
| `POST` | `/api/venues` | Save a venue layout |
| `GET` | `/api/venues` | List saved venues |
| `POST` | `/auth/register` | User registration |
| `POST` | `/auth/login` | JWT authentication |

Full interactive docs available at `/docs` (Swagger UI) when the backend is running.

---

## 📁 Project Structure

```
crowd-flow-optimiser/
├── backend/
│   ├── app/
│   │   ├── ai/                  # ML congestion predictor
│   │   │   ├── predictor.py     # Risk prediction logic
│   │   │   ├── model_trainer.py # Training pipeline
│   │   │   └── models/          # Trained model artifacts (.joblib)
│   │   ├── api/routes.py        # FastAPI endpoints
│   │   ├── auth/                # JWT authentication
│   │   ├── database/            # SQLAlchemy models & connection
│   │   ├── routing/reroute.py   # Dynamic rerouting engine
│   │   └── simulation/
│   │       ├── engine.py        # Core simulation loop
│   │       ├── bottleneck.py    # Bottleneck detection
│   │       ├── crowd.py         # Crowd group modeling
│   │       ├── movement.py      # Density-aware movement
│   │       ├── graph_builder.py # NetworkX graph construction
│   │       ├── counterfactual.py# What-if analysis
│   │       └── decision_engine.py # Strategy selection
│   ├── tests/                   # Pytest test suite
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx              # Main app with 3-step flow
│       ├── components/
│       │   ├── LayoutEditor.tsx  # Drag-and-drop venue builder
│       │   ├── VenueMap.tsx      # Venue visualization
│       │   ├── HeatmapOverlay.tsx# Density heatmap renderer
│       │   ├── RouteOverlay.tsx  # Reroute path visualization
│       │   └── ControlPanel.tsx  # Simulation config panel
│       ├── api/client.ts        # API client
│       ├── demoData.ts          # Demo stadium layout
│       └── types.ts             # TypeScript interfaces
├── scripts/                     # Utility scripts
├── data/                        # Training dataset
├── docker-compose.yml
└── .env.example
```

---

## 🧪 Testing

```bash
cd backend
python -m pytest tests -v
```

Test coverage includes:
- Simulation engine correctness
- Bottleneck detection accuracy
- Rerouting algorithm validation
- API endpoint integration tests
- Authentication flow tests
- ML predictor tests
- Counterfactual analysis tests

---

## 🌍 Real-World Applications

- **🏟️ Stadiums & Arenas** — Match-day crowd flow optimization
- **🎵 Music Festivals** — Multi-stage crowd distribution
- **🚇 Transit Hubs** — Rush hour passenger flow management
- **🏥 Emergency Evacuation** — Optimal evacuation route planning
- **🏢 Convention Centers** — Event space crowd balancing
- **🕌 Religious Gatherings** — Pilgrimage crowd safety (Hajj, Kumbh Mela)

---

## 👥 Team

Built with ❤️ for safer crowds and smarter venues.

---

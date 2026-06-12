# SmoothRoute

SmoothRoute is a route-planning and algorithm comparison app for morning smoothie delivery.

It answers one practical question:

```text
Given a depot, customer delivery locations, delivery time windows, and a few drivers,
what routes should each driver take?
```

The default depot is:

```text
Suncity School, Suncity Road, Sun City, Sector 54, Gurgaon, Gurugram, Haryana, 122002, India
```

Default coordinates:

```text
28.434364, 77.112579
```

## Why This Exists

A breakfast smoothie business has a narrow delivery window. Customers expect orders in the morning, often inside a 30-minute window. A route can look short on a map but still be bad if it reaches customers late.

SmoothRoute helps show:

- which driver should visit which customers
- what order each driver should follow
- when each driver is expected to arrive
- which deliveries are late or risky
- how different routing algorithms behave on the same scenario

The app is also an algorithm demo. It lets a reviewer see the difference between simple routing logic, savings-based routing, and an OR-Tools vehicle routing solver.

## What Problem It Solves

This is a Vehicle Routing Problem with Time Windows, often called VRPTW.

Plain English:

- There is one starting point, called the depot.
- There are many customers.
- Each customer has a delivery window, such as `06:00-06:30`.
- There are multiple drivers.
- Each stop takes a few minutes of service time.
- The app must assign stops to drivers and order those stops.
- The route should be efficient, but it should also respect customer time windows.

## Current Workflow

The app is organized as a guided 5-step research workflow.

### Step 1: Choose Depot Location

Choose where all drivers start.

You can:

- search for an address
- use current browser location
- click the map
- drag the depot marker
- view coordinates in Advanced Details

### Step 2: Create Delivery Stops

You can create customers in two ways.

Generate Scenario:

- creates random customer stops near the depot
- uses the configured radius
- creates 30-minute delivery windows
- snaps generated points to roads when road mode is enabled

Enter Manually:

- lets you add exact customer locations
- supports address search
- supports map click and marker drag
- snaps manually added points to the road network
- ignores radius, because manually entered points are treated as user-approved stops

### Step 3: Configure Simulation

Choose how the route comparison should run.

Settings include:

- number of drivers
- service time per stop
- number of simulation runs
- routing mode
- road snapping
- snap distance

Then click Run Algorithm Comparison.

### Step 4: Compare Results

The app compares the same customer scenario across all algorithms.

It shows:

- route maps
- total distance
- late deliveries
- on-time percentage
- computation time
- metric tables
- winner badges when available

### Step 5: Watch Route Playback

The playback shows how routes happen over simulated time.

It includes:

- moving driver markers
- completed and future route segments
- timeline scrubber
- play and pause controls
- speed controls
- driver status cards
- event feed

## Algorithms

SmoothRoute compares three approaches.

### Greedy Earliest Deadline + Nearest Neighbor

This is the simplest algorithm.

It tries to serve earlier deadlines first and picks nearby feasible stops. If no stop can be reached on time, it chooses the least-late option.

Good for:

- speed
- explainability
- a baseline result

### Clarke-Wright Savings with Time Window Repair

This algorithm starts with separate routes and tries to merge them when doing so saves distance.

It checks time windows before accepting route merges.

Good for:

- reducing route distance
- showing a classic routing heuristic
- comparing tradeoffs against Greedy

### OR-Tools VRPTW Solver

This uses Google OR-Tools for a more formal vehicle routing model.

It models:

- depot
- multiple vehicles
- travel time matrix
- service time
- customer time windows

Good for:

- production-style optimization
- benchmarking simpler algorithms
- showing what a real VRPTW solver can do

If OR-Tools is unavailable, the app still runs the other algorithms and shows a friendly warning.

## Road Routing

SmoothRoute can use OSRM for road-aware routing.

That means:

- customer points can snap to nearby drivable roads
- travel distance comes from road routes
- travel time comes from road routes
- displayed route lines follow roads instead of straight lines

If OSRM is unavailable, the app can fall back to Haversine distance. Haversine is a straight-line estimate, so the UI shows warnings when fallback routing is used.

## Metrics Explained

Total distance:

- total kilometers traveled by all drivers

Late deliveries:

- count of stops completed after the customer window

On-time percentage:

- percentage of deliveries completed within their windows

Average lateness:

- average minutes late across late and on-time stops

Maximum lateness:

- worst lateness for any stop

Driver utilization balance:

- how evenly work is spread across drivers

Computation time:

- how long the algorithm took to produce a route

Feasibility rate:

- how often the algorithm produced no late deliveries across repeated runs

## Tech Stack

Frontend:

- React
- Vite
- Leaflet
- Recharts

Backend:

- Python
- FastAPI
- SQLite

Routing and algorithms:

- Haversine fallback
- OSRM road network integration
- manual Greedy solver
- manual Clarke-Wright solver
- OR-Tools VRPTW solver

## Run Locally

Start the backend:

```bash
cd smoothroute/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend:

```bash
cd smoothroute/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174
```

## Demo Script

1. Open the app.
2. Confirm the depot in Step 1.
3. In Step 2, either generate a scenario or enter manual stops.
4. Review the Active Test Case.
5. Set drivers, service minutes, and runs.
6. Click Run Algorithm Comparison.
7. Compare the three algorithm cards.
8. Review the metrics table and charts.
9. Use Route Playback to watch the routes over time.

## Future Improvements

- traffic-aware routing
- private OSRM or commercial routing provider
- driver mobile view
- SMS or WhatsApp route sharing
- scheduled 5 AM optimization
- vehicle capacity limits
- order/payment integration
- saved scenarios and historical run comparison

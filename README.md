# SmoothRoute

Live app: https://smooth-route.vercel.app/

SmoothRoute is a route-planning and algorithm comparison tool for delivery routing with time windows.

## Motive

Given a depot, customer delivery locations, delivery time windows, and a fixed number of available drivers:

What routes should each driver take?

SmoothRoute lets users create a delivery scenario, run multiple routing algorithms on the same case, and compare the results visually.

## What It Does

- Select a depot location.
- Generate random delivery stops or enter stops manually.
- Set delivery windows, driver count, service time, and routing options.
- Run routing algorithms on the same scenario.
- Compare distance, lateness, on-time rate, compute time, and route shape.
- Watch routes play back over simulated time.

## Workflow

1. **Choose Depot Location**  
   Set where all drivers start.

2. **Create Delivery Stops**  
   Generate a test scenario or manually add customer locations.

3. **Configure Simulation**  
   Set drivers, service time, routing mode, road snapping, and simulation runs.

4. **Compare Results**  
   Review route maps, metrics, charts, and winner badges.

5. **Watch Route Playback**  
   See drivers move through the route over simulated time.

## Algorithms Used

SmoothRoute compares:

- Greedy Earliest Deadline + Nearest Neighbor
- Clarke-Wright Savings with Time Window Repair
- Google OR-Tools VRPTW Solver

## Routing Model

SmoothRoute supports road-aware routing through OSRM.

- Generated stops can snap to nearby drivable roads.
- Manual stops can also snap to the road network.
- Route geometry follows roads when OSRM is available.
- Haversine distance is used as a fallback if road routing is unavailable.

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
- OR-Tools
- OSRM integration

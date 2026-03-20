# Sakai PRD

## Overview
Sakai is a voice-first commute assistant for the Philippines built around a jeepney-first but multimodal routing experience. The product should help users find practical, understandable trips that may combine jeepneys, UV Express and other PUVs, trains, walking, and optional car segments instead of assuming one vehicle can take a rider from origin to destination.

The core interaction starts on a landing screen that feels more like a modern website than a dense transit app. Users are greeted with the prompt `Where to Sakai today?` They can type a destination, choose from search suggestions, or speak naturally. Sakai then interprets the request, understands the user's routing preference, and shows multiple route combinations with estimated time and total cost.

For active trips and route comparison, Sakai can also surface route-relevant MMDA area updates such as crashes, stalled vehicles, and lane obstructions so commuters can understand when a suggested route may be affected by current road incidents.

Sakai is jeepney-first in product philosophy, not jeepney-only in execution. The app should prefer routes that meaningfully use jeepneys when they are practical, but it must also support real commuting behavior in Metro Manila where a trip may look like:

- Jeepney -> train -> jeepney
- Jeepney -> walk -> jeepney
- UV Express -> walk
- Train -> jeepney -> walk
- Fully jeepney alternatives
- Optional car-first or car-last segments where relevant

## Problem
Commuting in the Philippines, especially by jeepney and other public utility vehicles, is still confusing for many riders.

- Jeepney and PUV routes are hard to discover, fragmented, and often shared informally.
- Existing map products help with destination lookup, but they do not feel jeepney-first or locally optimized.
- Real trips usually require multiple legs and transfers, but users often do not know which combination is best.
- Riders care about both travel time and travel cost, yet cost is rarely surfaced clearly before the trip.
- Riders often miss their stop because they are unfamiliar with the route, distracted, or traveling in an unfamiliar area.
- Route knowledge and fare expectations change over time, while most apps do not reflect local fare updates fast enough.
- Road incidents and lane obstructions can quickly affect real commute choices, but riders rarely get localized, trip-relevant alerts in a format that helps them decide which route to take.

## Product Vision
Sakai helps commuters ask for directions the way they naturally would, then turns that request into route combinations that are usable in the Philippine context.

The product should feel like talking to a commute-savvy local friend:

- `How do I get to MOA from here?`
- `What jeep should I ride to Quiapo?`
- `How do I get to PUP Sta. Mesa the cheapest way?`
- `Fastest route to Cubao with jeepney if possible`

Sakai is differentiated by five pillars:

1. Voice-first trip planning
2. Jeepney-first route intelligence
3. Multimodal combination routing
4. Built-in fare and cost visibility
5. Community-powered route improvement

## Target Users
- Daily commuters who regularly use jeepneys and other public transport
- Students and workers traveling across Metro Manila and nearby cities
- People unfamiliar with a route who need step-by-step transfer guidance
- Cost-conscious riders deciding between cheaper and faster options
- Riders who prefer speaking over typing while on the move

## Hackathon Goal
Build a demoable MVP that proves Sakai is more useful for Philippine commuting than a generic map search because it is jeepney-first, multimodal, and price-aware.

The hackathon version should clearly show:

- AI-assisted voice and text route search
- Google Maps-powered destination lookup and map rendering
- Multiple route combinations instead of a single generic route
- Jeepney-aware and PUV-aware route suggestions
- A built-in fare calculator for each route option
- Onboarding-based route preference selection
- Community contribution flow for missing routes
- A near-destination alert that helps users avoid missing their stop
- Route-relevant MMDA area updates that can be demonstrated during trip selection or navigation

## Core Value Proposition
Sakai answers a simple question: `How do I get there?`

It does that in a way that feels local, useful, and distinct:

- Users can search by text or voice
- Sakai interprets natural language instead of requiring rigid inputs
- Routes prioritize jeepney use where practical but include transfers across other modes when needed
- Users see several route combinations, not just one recommendation
- Each option shows estimated fare, travel time, and transfer count
- Users can choose whether Sakai should optimize for lowest cost, shortest time, or a balanced result
- Users can contribute route knowledge when data is missing
- Sakai can alert the rider when they are near their destination
- Sakai can surface route-relevant MMDA traffic incidents before and during a trip

## Product Principles
- Jeepney-first, not jeepney-only
- Explain the route in plain language
- Show cost before the user commits
- Respect real commuter tradeoffs between time, price, and convenience
- Be honest when data is partial or estimated

## MVP Scope
### In Scope
- Mobile app built with React Native
- Landing page with the prompt `Where to Sakai today?`
- Text input with autocomplete-like destination search behavior
- Voice input for trip search
- Onboarding flow that captures trip preference
- Map display using Google Maps
- Route suggestions with multimodal leg combinations
- Fare and cost breakdown per route option
- Route cards showing total estimated time, total estimated cost, and transfer count
- Jeepney-first ranking logic with alternative route sets
- Background or open-app voice trigger as a concept or prototype flow
- Community route contribution flow
- Near-destination alarm based on live user location during an active trip
- MMDA-backed area update ingestion and route-relevant incident surfacing

### Out of Scope
- Real-time tracking of all jeepneys and buses
- Driver-facing tracking application
- Fully accurate city-wide ETA prediction
- Complete nationwide route coverage at launch
- Full parity with Google Maps across all transport modes
- Production-grade always-listening wake word implementation across all devices
- Dynamic surge pricing or marketplace-based fares
- A full citywide traffic command dashboard or guaranteed coverage for every road incident

## Primary User Flows
### 1. Onboarding and Preference Capture
1. User opens Sakai for the first time.
2. Sakai explains that it can suggest routes based on time, price, or a balance of both.
3. User selects a default preference:
   - `Fastest`
   - `Cheapest`
   - `Balanced`
4. User optionally selects discount eligibility such as student, senior citizen, or PWD if supported in the MVP.
5. Sakai saves the preference but allows it to be changed per trip.

### 2. Search by Typing
1. User opens Sakai.
2. The landing screen asks, `Where to Sakai today?`
3. User types a destination.
4. Sakai shows destination suggestions similar to common map apps.
5. User selects a destination.
6. Sakai displays the map and several recommended route combinations ranked by the active preference.

### 3. Search by Voice
1. User taps voice input or speaks a supported phrase.
2. Sakai transcribes and interprets the request.
3. Sakai extracts the destination, current location context, and any stated preference such as `cheapest` or `fastest`.
4. Sakai displays route combinations on the map with fare and time estimates.

### 4. Compare Route Options
1. User views a list of route cards.
2. Sakai labels one route as `Best for your preference`.
3. Sakai also shows alternatives such as `Cheapest`, `Fastest`, and `Fewest transfers` when available.
4. User can inspect route details including each leg, transfer points, and leg-by-leg fare.
5. User selects a route and starts navigation mode.

### 5. Near-Destination Alert
1. User starts navigation mode on a selected route.
2. User enables `Notify me when I'm near my destination`.
3. Sakai monitors current location during the trip.
4. When the user is close to the destination or intended drop-off point, Sakai triggers a local notification or in-app alert.

### 6. Trip-Aware Area Updates
1. User compares route options or starts navigation on a selected route.
2. Sakai checks the latest MMDA area updates relevant to the route, origin, destination, or nearby corridor.
3. Sakai uses AI to convert the raw MMDA alert text into structured incident details and a severity level.
4. Sakai shows the rider a concise alert summary only if the update is still within its display window.
5. If a refreshed alert remains active, Sakai extends its visibility using the latest scrape time and severity policy.

### 7. Community Route Contribution
1. User cannot find a useful jeepney or PUV route or notices incomplete fare or stop data.
2. User submits a route suggestion, correction, fare update, or missing route report.
3. Sakai stores the submission for review and future route enrichment.

## Key Features
### 1. Voice-First Search
Users can speak route questions naturally instead of typing exact structured queries. The system should support conversational phrasing, destination aliases, and preference-aware prompts like `cheapest way` or `fastest route`.

### 2. Map Search and Visualization
Google Maps powers place search, map rendering, and location context. Sakai uses this as infrastructure, not as the product's main differentiator.

### 3. Jeepney-First Multimodal Route Suggestions
Sakai should present route suggestions that explicitly include jeepney legs where relevant while still supporting practical multimodal transfers. The route explanation should be easy to understand, such as where to ride, where to get off, where to walk, and when to transfer to a train, UV, or other PUV.

### 4. Fare and Cost Calculator
Each route option should show an estimated total cost and leg-by-leg fare breakdown. The calculator should use the latest available official fare guides for regulated public transport segments and clearly mark any estimated or unverified amounts.

### 5. Preference-Based Recommendation Engine
Sakai should rank and label results based on what the user cares about most:

- `Fastest`
- `Cheapest`
- `Balanced`
- Optional secondary labels such as `Fewest transfers` or `Most jeepney-friendly`

### 6. Near-Destination Alarm
This remains a signature hackathon feature. Riders often miss stops because they are unfamiliar with the route or are distracted. Sakai should let users enable a proximity alert so they are notified when nearing their destination or drop-off point.

### 7. Route-Relevant Area Updates
Sakai should ingest the latest MMDA alerts and show only the incidents that matter to the rider's current trip context. Raw MMDA alert text should be parsed into structured fields such as incident type, location, direction, lane impact, involved vehicles, reported time, severity, and display duration so the app can explain why a route may be disrupted without forcing the user to read the original alert verbatim.

Severity should be normalized into three product-facing levels with fixed visibility windows:

- `Low`: show for 1 hour
- `Medium`: show for 3 hours
- `High`: show for 5 hours

When the same incident is refreshed from MMDA, Sakai should recompute the visibility window from the newest scrape.

### 8. Community-Powered Data
If Sakai does not know a route, stop, or fare detail, users can help expand the system. This community layer helps the product become more useful over time and reduces dependence on perfect initial data coverage.

## Functional Requirements
### Search and Input
- Users must be able to search destinations by typing.
- Users must be able to search destinations by voice.
- The app must support destination suggestion behavior similar to standard map search.
- The app must use current location as a default trip origin when permission is granted.
- The system must understand optional intent modifiers such as `cheapest`, `fastest`, `jeep only if possible`, or `less walking`.

### Onboarding and Preferences
- First-time users must be asked for a default route preference: `Fastest`, `Cheapest`, or `Balanced`.
- The app should allow users to update this preference later in settings or before searching.
- The app should support a passenger type or discount profile when fare rules make that relevant.

### Route Suggestions
- The app must return at least one route suggestion for common demo destinations.
- The app should return multiple route combinations when the data supports it.
- Route output should be understandable in plain language.
- Route results should highlight jeepney legs where available.
- Route results must support mixed-mode itineraries such as jeepney plus train plus jeepney.
- Route cards must show total estimated fare, total travel time, and number of transfers.
- The system should label why a route is being recommended, such as `Cheapest option` or `Fastest option`.
- The system should degrade gracefully when jeepney-specific or fare-specific data is incomplete.

### Fare Calculation
- The app must compute an estimated fare for each regulated public-transport leg when official fare guidance is available.
- The app must compute a total trip cost by summing the included leg costs.
- The system must distinguish between official fares, rule-based estimates, and community-submitted estimates.
- Walk legs must always have zero fare.
- Car legs, if shown, should use a clearly labeled estimate rather than an official fare.
- Train legs should use stored operator fare tables.
- The app should support discount-aware fare display for eligible passengers when supported by the selected mode and ruleset.

### Navigation Assistance
- Users must be able to start a selected route.
- Users must be able to enable or disable near-destination alerts per trip.
- The app should notify users when they are close to the destination or planned drop-off point.
- The app should handle lack of notification or location permission gracefully.

### Area Updates and Incident Alerts
- The system must ingest the latest MMDA alerts from configured MMDA web or social sources.
- The system must store both the raw MMDA text and AI-extracted structured fields for each incident.
- The AI extraction layer must identify `alertType`, `location`, `direction`, `involved`, `reportedTimeText`, `laneStatus`, `trafficStatus`, and `severity`.
- Severity must be normalized to `Low`, `Medium`, or `High`.
- The system must derive a `displayUntil` value from severity using fixed visibility windows:
  - `Low`: 1 hour from the latest scrape
  - `Medium`: 3 hours from the latest scrape
  - `High`: 5 hours from the latest scrape
- If the same incident is refreshed by a new scrape, the system must recompute `displayUntil` from the newest scrape time.
- The app must show area updates only when they are relevant to the user's current route, current area, destination, or origin.
- The app should present a concise user-facing summary of the disruption and why it matters to the trip.
- Expired incidents must not continue to appear in the rider-facing experience unless refreshed again.

### Community Contributions
- Users must be able to submit missing routes, corrections, fare updates, or route notes.
- Submissions must be stored in Supabase for review or future use.

## Fare Policy and Pricing Logic
Sakai needs a pricing engine instead of hardcoded route card text.

### Fare Data Sources
- LTFRB fare matrices and official fare guides for regulated PUV and PUJ segments
- Official rail fare tables for MRT, LRT, and other supported train lines
- Internal fallback tables for demo routes
- Community-submitted fare corrections stored separately until reviewed
- Versioned metadata that stores source URL, effectivity date, and last verification date for every fare table

### Initial Pricing Rules for MVP
- The fare engine should ship with a baseline ruleset sourced from the latest LTFRB fare guides available during product build and then be refreshable without app release.
- As a concrete MVP baseline, traditional PUJ fares should start from the LTFRB guide showing `Php 13.00` regular minimum for the first 4 km and `Php 10.40` discounted, with `Php 1.80` regular and `Php 1.44` discounted for succeeding kilometers.
- As a concrete MVP baseline, modern and electric PUJ fares should be split by vehicle class: non-air-conditioned at `Php 15.00` minimum with `Php 1.80` succeeding-km add-on, and air-conditioned at `Php 15.00` minimum with `Php 2.20` succeeding-km add-on, both with corresponding 20% discount handling.
- As a concrete MVP baseline, UV Express should use the LTFRB fare guide of `Php 2.40` per km for traditional units and `Php 2.50` per km for modern units, with 20% discount support when applicable.
- Trains should use station-based fare tables from official operators.
- Walking should always be free.
- Car segments should be presented as estimated cost only and may use a simple per-kilometer configuration plus optional toll and parking inputs.

### Pricing Transparency Rules
- Every route card must show whether the total is `Official`, `Estimated`, or `Partially estimated`.
- Fare assumptions must be viewable in route details.
- If a fare table is outdated or unavailable, Sakai must say so instead of implying certainty.

## Non-Functional Requirements
- The MVP should be demoable within hackathon constraints.
- The app should feel fast and understandable within a short judge demo.
- The UI should communicate clearly even if route or fare data is partial.
- The system should be resilient to incomplete community data.
- Fare rules should be updateable without shipping a full app rewrite.
- Area-update summaries should remain understandable even when the upstream MMDA message is dense or repetitive.

## Technical Stack
- Frontend: React Native
- Backend: Express with TypeScript
- Database and Auth: Supabase
- Maps Provider: Google Maps
- Routing and Fare Layer: Sakai-owned normalization, leg scoring, and fare-calculation logic

## Proposed System Responsibilities
### React Native App
- Landing experience
- Onboarding and route preference capture
- Text and voice trip input
- Map and route UI
- Route comparison cards and detail views
- Fare display and pricing transparency UI
- Trip tracking session state
- Notification permission flow
- Near-destination local alert handling
- Route-relevant area update display during route selection and active trips

### Express API
- Route query orchestration
- Natural language parsing integration
- Route normalization and leg composition
- Fare calculation orchestration
- Route ranking based on user preference
- MMDA scraping or polling orchestration
- AI extraction of structured area-update fields and severity
- Relevance filtering for trip-aware incident surfacing
- Visibility-window computation and expiry handling
- Community submission endpoints
- Data validation and persistence

### Supabase
- User authentication
- Stored user preferences
- Route submissions and corrections
- Fare submissions and corrections
- Stored jeepney and multimodal route data
- Stored MMDA raw alerts and structured area updates
- Severity and display-expiry metadata for active incidents
- Community moderation state

### Google Maps
- Place search
- Geocoding
- Map rendering
- Geographic context for route display, proximity checking, and route-relevant incident matching

## Data Strategy
Sakai needs jeepney-specific and fare-specific data to avoid becoming a generic maps wrapper.

Initial MVP strategy:

- Seed the system using open or community-accessible jeepney and stop data where available
- Normalize route names, stops, aliases, destination labels, and transfer points
- Store each route as a sequence of legs rather than a single transport label
- Attach fare metadata per leg, not only per trip
- Keep official fare tables versioned with effectivity dates
- Store MMDA alerts with raw text, extracted structured fields, severity, `scrapedAt`, and `displayUntil`
- Keep area updates separate from rider submissions so official-source incidents and community data remain distinguishable
- Allow users to contribute missing route details and fare corrections
- Store community-contributed data separately from trusted seed data when needed

## AI Layer
The AI component should focus on practical trip understanding, not novelty for its own sake.

Core AI use cases:

- Parse natural language trip requests
- Interpret spoken commute questions
- Extract destination intent from ambiguous user phrasing
- Detect routing preference intent such as `cheapest` or `fastest`
- Return route guidance in simpler language
- Generate concise route summaries for each option
- Parse raw MMDA incident text into structured route-impact fields
- Classify MMDA incidents into `Low`, `Medium`, or `High` severity
- Generate concise rider-facing summaries for route-relevant disruptions

## Success Metrics
For the hackathon MVP, success means:

- A user can ask for directions by text or voice
- The app returns multiple route combinations for a recognizable Metro Manila destination
- At least one route visibly includes jeepney-specific guidance
- Each route option shows a total cost estimate and travel-time estimate
- The user can switch between `Fastest`, `Cheapest`, and `Balanced` preferences
- A near-destination alert can be demonstrated
- At least one route shows a relevant MMDA-derived area update with AI-extracted severity
- A community route or fare submission can be demonstrated
- Judges can understand why Sakai is better than a plain Google Maps search for this use case

## Demo Scenario
1. User opens Sakai and sees `Where to Sakai today?`
2. During onboarding, the user selects `Cheapest` as the default preference.
3. User asks: `How do I get to PUP Sta. Mesa from here?`
4. Sakai shows several route options such as:
   - Jeepney -> train -> jeepney
   - Fully jeepney route with more transfers
   - Faster but slightly more expensive route
5. Each option shows estimated time, total cost, and transfer count.
6. Sakai highlights a route-relevant MMDA update, such as a crash or stalled vehicle affecting one corridor, and explains the severity and expected visibility window.
7. User taps one route to inspect leg-by-leg instructions, fare breakdown, and the relevant area update summary.
8. User starts the route and enables the near-destination alert.
9. The demo simulates movement and triggers a notification near the destination.
10. The presenter shows how a missing route or fare update can be contributed by the community.

## Risks
- Jeepney and PUV route data may be incomplete or inconsistent
- Fare guides may change and create stale pricing if not refreshed
- Background voice activation may be difficult to fully support in hackathon time
- Accurate proximity alerts depend on location quality and permissions
- Real-time transit expectations may confuse users if the MVP is framed poorly
- Multimodal ranking may be noisy if route leg data is sparse
- MMDA alert wording may be noisy, duplicated, or ambiguous for AI extraction
- Severity classification may overstate or understate the rider-facing importance of an incident

## Mitigations
- Keep the MVP focused on common demo routes and high-confidence corridors
- Version fare tables and include effectivity dates in admin data
- Position background wake phrase support as prototype-level if needed
- Frame alerts as proximity-based assistance, not perfect turn-by-turn navigation
- Emphasize community-powered improvement as a core part of the product
- Clearly label estimated fares and partially trusted route data
- Constrain MMDA severity to fixed product bands and fixed 1-hour, 3-hour, and 5-hour visibility windows
- Only surface route-relevant incidents so users do not see a noisy citywide feed by default

## Why This Can Win
Sakai addresses a distinctly local and relatable problem with a product that is easy to understand in a live demo. It combines AI interaction, practical utility, multimodal routing, and price transparency in a way that feels relevant to daily life in the Philippines.

What makes the concept stronger is that it does not stop at `what vehicle should I ride`. It answers the fuller commuter question: `What combination should I take, how much will it cost, and which option fits my priorities?`

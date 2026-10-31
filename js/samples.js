/**
 * FormattingBuddy - Demo Sample Texts & Formatted Previews
 * 1. Process sample (workflows & Mermaid diagrams)
 * 2. Data-heavy sample (financial/metric tables & Chart.js charts)
 * 3. Places sample (cities, travel & Leaflet maps)
 */

export const SAMPLES = {
  process: {
    id: 'process',
    name: 'CI/CD & Cloud Deployment Pipeline',
    badge: 'Process & Diagram',
    rawText: `Continuous Integration and Continuous Deployment (CI/CD) Pipeline Architecture Overview

Modern software development relies heavily on automated continuous integration and delivery pipelines to ensure code stability, rapid verification, and zero-downtime releases. The workflow begins when an engineer commits code to a feature branch in version control (such as Git). 

Immediately upon commit, an automated webhook triggers the CI server. The pipeline enters the Lint and Build Stage, running static code analysis, linting checks, and compiling application bundles. If any linting error or syntax defect is detected, the build fails immediately and alerts the developer via chat notifications.

Once compilation succeeds, the system progresses to the Test Stage. This stage executes three layers of verification: first, unit tests run in parallel across isolated test containers. Next, integration tests verify database connections, cache layers, and mock third-party services. Finally, an end-to-end regression suite checks user flows.

Upon passing all test suites, the build artifact is packaged into a container image, signed cryptographically, and pushed to a secure private container registry. The deployment orchestrator detects the new container version and initiates a Canary Rollout. Traffic is initially split 95% to the existing production cluster and 5% to the canary instance. Telemetry monitors latency, error rates, and CPU saturation for 15 minutes. If anomalies stay below 0.1%, 100% of user traffic shifts to the new version, completing the automated deployment.`,
    preformattedMarkdown: `# CI/CD Pipeline Architecture & Deployment Flow

> [!SUMMARY]
> An end-to-end overview of modern automated delivery: from Git commit and static analysis to multi-stage testing, container signing, and canary deployment.

## Pipeline Workflow Stages

The continuous delivery pipeline automates code validation, testing, container creation, and zero-downtime canary deployment.

\`\`\`mermaid
flowchart TD
  A["Engineer Git Commit"] --> B["Lint & Static Analysis"]
  B --> C{"Lint Passed?"}
  C -- No --> D["Notify Developer (Alert)"]
  C -- Yes --> E["Unit & Integration Tests"]
  E --> F{"Tests Passed?"}
  F -- No --> D
  F -- Yes --> G["Build & Sign Container"]
  G --> H["Push to Container Registry"]
  H --> I["Deploy 5% Canary"]
  I --> J{"Telemetry Healthy?"}
  J -- No --> K["Automatic Rollback"]
  J -- Yes --> L["100% Production Rollout"]
\`\`\`

## Verification Stage Breakdown

| Stage | Scope | Target Duration | Gate Requirement |
| :--- | :--- | :--- | :--- |
| **Lint & Build** | Syntax, type checking, bundle compilation | < 2 minutes | Zero errors or high-severity warnings |
| **Unit Testing** | Isolated logic & module mock tests | < 3 minutes | 100% passing, > 80% coverage |
| **Integration** | DB transactions, cache, API contracts | < 5 minutes | Complete contract match |
| **Canary Monitor** | Latency p99, HTTP 5xx error rate | 15 minutes | Error rate < 0.1% |

## Automated Rollback and Safety Gates

If anomalous behavior or memory spikes are detected during the 5% canary window, routing policies immediately redirect traffic back to the baseline release. Automated post-mortems log telemetry data to persistent storage for root-cause diagnosis.`
  },

  data: {
    id: 'data',
    name: 'Quarterly Cloud Computing Growth & Revenue',
    badge: 'Data & Charts',
    rawText: `Global Enterprise Cloud Infrastructure Revenue Report (2025-2026)

Enterprise spending on cloud computing infrastructure and AI managed platforms demonstrated strong quarter-over-quarter expansion throughout the past fiscal year.

In Quarter 1, total cloud infrastructure revenue reached $64.2 billion across global providers, driven by database migrations and container hosting. By Quarter 2, spending rose to $71.8 billion as enterprise AI pilot projects began transitioning to full production workloads. Quarter 3 continued this upward momentum, recording $78.5 billion in cloud service consumption. By Quarter 4, heavy seasonal demand and widespread adoption of specialized GPU clusters pushed total revenue to $89.0 billion.

Cost optimization initiatives yielded measurable efficiency gains across key enterprise domains:
Storage tiering and cold-data archiving reduced data lake expenditures by 32%.
Serverless event-driven execution lowered idle compute costs by 24%.
Automated right-sizing and spot-instance provisioning saved an additional 18%.
Network transit routing optimizations saved 14%.

Market share analysis among major cloud service providers indicated that Google Cloud grew its enterprise footprint to 22%, AWS held 34%, Microsoft Azure captured 28%, and independent regional providers accounted for the remaining 16%.`,
    preformattedMarkdown: `# Global Enterprise Cloud Infrastructure Revenue Report

> [!SUMMARY]
> Enterprise cloud spending expanded significantly from $64.2B in Q1 to $89.0B in Q4, fueled by AI production workloads, automated cost tiering, and specialized GPU compute.

## Quarterly Revenue Growth

Total infrastructure investment across all quarters displayed continuous expansion.

\`\`\`chart
{
  "type": "bar",
  "title": "Quarterly Global Cloud Infrastructure Revenue ($B)",
  "labels": ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"],
  "datasets": [
    {
      "label": "Total Revenue ($B)",
      "data": [64.2, 71.8, 78.5, 89.0]
    }
  ]
}
\`\`\`

## Enterprise Market Share Distribution

\`\`\`chart
{
  "type": "doughnut",
  "title": "Cloud Provider Enterprise Market Share (%)",
  "labels": ["AWS", "Microsoft Azure", "Google Cloud", "Regional / Other"],
  "datasets": [
    {
      "label": "Market Share",
      "data": [34, 28, 22, 16]
    }
  ]
}
\`\`\`

## Optimization & Cost Reduction Impact

| Optimization Domain | Description | Expense Reduction |
| :--- | :--- | :--- |
| **Storage Tiering** | Cold-data archiving and lifecycle policies | 32% |
| **Serverless Execution** | Event-driven compute minimizing idle runtimes | 24% |
| **Right-Sizing & Spot** | Automated dynamic CPU/memory scaling | 18% |
| **Network Egress Optimization**| Direct peering and edge caching | 14% |`
  },

  places: {
    id: 'places',
    name: 'European Tech Hubs & Innovation Centers',
    badge: 'Places & Maps',
    rawText: `Key Innovation Hubs and Tech Ecosystems Across Europe

Europe's technology ecosystem has diversified significantly beyond traditional financial capitals, developing specialized regional hubs for artificial intelligence, fintech, hardware robotics, and quantum computing.

London continues to act as the primary capital for venture funding and fintech headquarters, housing global research labs and major institutional investors.
Across the channel, Paris has emerged as a premier European hub for foundation AI research and open-source models, anchored by research institutions and high-profile developer startups.
Berlin represents the creative epicenter for software development, consumer apps, and decentralized platforms, renowned for its developer density and affordable studio spaces.
In the north, Stockholm stands as the unicorn powerhouse of Scandinavia, having produced industry leaders in music streaming, fintech payments, and gaming.
Zurich hosts deep-tech computer science, robotics, and quantum engineering, benefiting from world-renowned engineering institutes and enterprise research facilities.
Amsterdam serves as the core networking gateway and cloud infrastructure hub, benefiting from direct transatlantic fiber connectivity and a thriving green-tech sector.`,
    preformattedMarkdown: `# European Tech Hubs & Regional Innovation Ecosystems

> [!SUMMARY]
> Europe's technology network spans specialized regional clusters: from Paris for AI research and London for venture fintech, to Zurich for deep-tech robotics and Stockholm for unicorn development.

## Innovation Centers Geographic Distribution

The primary metropolitan hubs shaping European technology, research, and venture development:

\`\`\`map
{
  "title": "Key European Innovation Centers",
  "places": [
    { "name": "London, United Kingdom", "note": "Fintech headquarters & venture financing capital" },
    { "name": "Paris, France", "note": "Foundation AI research and developer startups" },
    { "name": "Berlin, Germany", "note": "Developer density and software platforms" },
    { "name": "Stockholm, Sweden", "note": "Scandinavian unicorn and consumer tech hub" },
    { "name": "Zurich, Switzerland", "note": "Robotics, quantum engineering & deep tech" },
    { "name": "Amsterdam, Netherlands", "note": "Data infrastructure & transatlantic networking gateway" }
  ]
}
\`\`\`

## Regional Specialization Matrix

| Metropolitan Center | Primary Focus | Key Ecosystem Advantage |
| :--- | :--- | :--- |
| **London** | Fintech, Venture Capital | Deep capital markets and regulatory sandboxes |
| **Paris** | Foundation AI, Machine Learning | World-class mathematics and research talent |
| **Berlin** | Creative Software, Startups | Diverse talent pool and developer community |
| **Stockholm** | Digital Media, Gaming | High unicorn density per capita |
| **Zurich** | Robotics, Quantum Computing | Leading technical universities and research labs |
| **Amsterdam** | Cloud Infrastructure, Green-tech | Low-latency European internet exchanges |`
  }
};


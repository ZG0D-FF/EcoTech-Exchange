# 🌍 EcoTech Exchange

**EcoTech Exchange** is a scalable, distributed marketplace designed to address the $712B circular economy. It enables hardware enthusiasts and ECE students to rent out expensive tech equipment (oscilloscopes, 3D printers) or sell upcycled electronic components to prevent e-waste.

This repository serves as a portfolio piece demonstrating **Enterprise System Design**, **Advanced PWA Synchronization**, and **Scalable Backend Architecture**.

---

## 🏛️ System Architecture (SLIC FAST & RESHADED)

Our architecture is built using the **SLIC FAST** mnemonic to ensure enterprise-grade scalability and reliability. 

### Core Components
- **(S) Search Indexer:** Fast, fuzzy-search capabilities for finding niche microcontrollers and sensors.
- **(L) Load Balancer:** An NGINX layer designed to fairly distribute incoming client requests across our Python FastAPI workers to prevent server overload.
- **(I) Interaction with a CDN:** Static React.js dashboard assets and equipment images are served via a Content Delivery Network to ensure low latency for global users.
- **(C) Cache:** Redis is utilized to store frequently accessed equipment catalogs, resulting in cache hits that drastically reduce database load.
- **(F) Front-End Servers:** A Vite + React.js web dashboard that serves the UI and manages HTTP requests.
- **(A) Analytics:** Internal system tracking to monitor API response times and cache hit/miss ratios.
- **(S) Storage:** A distributed storage strategy using **Logical Sharding** (partitioning data across multiple databases based on regions) to improve read/write throughput and fault tolerance.
- **(T) Task Queue:** RabbitMQ handles asynchronous tasks like sending "Rental Confirmed" emails and encoding uploaded hardware videos behind the scenes so the user experience is never blocked.

---

## ⚖️ Engineering Trade-Offs

As a Principal Engineer, designing a system is about managing constraints and making justified trade-offs. You cannot have a perfect app that satisfies all requirements simultaneously.

Here are the specific trade-offs made in EcoTech Exchange:

1. **Storage Consistency vs. Data Structure (The Sync Architecture):**
   - *Problem:* Handling offline data creation on the mobile app.
   - *Trade-off:* We sacrificed standard auto-incrementing Integers (which cause ID collisions offline) in favor of **ULIDs** (Universally Unique Lexicographically Sortable Identifiers).
   - *Justification:* ULIDs require slightly more storage space than integers, but they guarantee mathematically unique IDs and time-based sorting, which is critical for our Distributed PWA Sync.

2. **Reliability vs. Storage (Tombstoning & LWW):**
   - *Problem:* Hard deleting data causes sync loops in offline-first apps.
   - *Trade-off:* We chose not to use `DELETE` commands. Instead, we use **Tombstoning** (`is_deleted = true`) and Last-Write-Wins (`updated_at`).
   - *Justification:* This requires more database storage over time since data is never truly deleted, but it provides absolute reliability when resolving sync conflicts across multiple offline clients.

3. **Cost vs. Scalability (Our Current Database):**
   - *Trade-off:* We are currently using SQLite over a clustered MySQL setup.
   - *Justification:* While SQLite offers lower read/write throughput for millions of users, it perfectly aligns with our $0 budget constraint for the MVP phase while still supporting relational data schemas.

---

## 🛡️ Outage Mitigation & Regional Failover

You cannot code against natural disasters. If a hurricane hits our primary data center, the hardware goes down. To mitigate this and limit the impact of unforeseen circumstances:

- **Regional Failover:** Our cloud architecture is designed so that if the US-East server goes down, traffic is immediately rerouted to our backup servers in Europe.
- **Offline-First PWA:** Because our React Native app uses Service Workers and local IndexedDB, users can still view cached equipment and queue up rentals even if the central API suffers a prolonged system outage. When the servers come back online, the Background Sync queue pushes the data.

---

## 📋 System Requirements

### Functional Requirements
- Users can generate a secure account via JWT authentication.
- Users can browse, search, and filter hardware components.
- Users can list equipment for sale or for daily rental.

### Non-Functional Requirements
- **Availability:** The system must remain usable even during network drops (Offline PWA).
- **Security:** Passwords must be hashed using `bcrypt` and endpoints secured.
- **Scalability:** The API layer must be stateless to allow horizontal scaling behind the Load Balancer.

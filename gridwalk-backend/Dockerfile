# Build stage
FROM rust:1.81-bullseye AS builder

# Install build dependencies including Node.js
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create a new empty shell project
WORKDIR /usr/src/app
COPY . .

# Build for release
RUN cargo build --release

# Final stage
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl1.1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the build artifact from builder
COPY --from=builder /usr/src/app/target/release/gridwalk-backend /usr/local/bin/gridwalk-backend

# Set the startup command
CMD ["gridwalk-backend"]

# LLMObservatory 

LLMObservatory is an ML observability system designed to detect behavioral drift in Large Language Models (LLMs) over time.

## Motivation
LLMs deployed in production can change silently due to safety tuning, model updates, or backend routing. This project aims to detect such changes by repeatedly probing models with fixed prompts and statistically analyzing shifts in their behavior.

## Core Idea
- Use fixed, versioned probe prompts
- Collect LLM responses over time
- Convert responses into embeddings and interpretable behavioral features
- Learn a baseline behavior distribution
- Detect and explain behavioral drift without labels

## Current Status
- Project skeleton initialized
- Backend setup complete (Node.js)
- Architecture and feature set finalized

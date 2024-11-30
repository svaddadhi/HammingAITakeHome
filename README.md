# HammingAITakeHome

A system for automatically discovering and mapping conversation scenarios for AI voice agents. This tool helps test and validate voice agent implementations by systematically exploring possible conversation paths and documenting the agent's capabilities.

## Overview

This system automatically calls AI voice agents, engages in conversations, and maps out all possible interaction scenarios. It's particularly useful for:

- Testing voice agent implementations
- Documenting conversation capabilities
- Identifying gaps in voice agent responses
- Validating business logic implementation

## Features

- Automated conversation discovery
- Concurrent call handling
- Real-time conversation visualization
- Speech-to-text transcription
- AI-powered conversation analysis
- Progress tracking and metrics
- Comprehensive error handling
- Detailed logging and monitoring

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- ngrok or similar tool for webhook forwarding
- Valid API credentials for:
  - Deepgram
  - OpenAI
  - Hamming AI API

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/HammingAITakeHome.git
cd HammingAITakeHome
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following configuration:

```env
BASE_URL='https://app.hamming.ai/api/rest/exercise'
API_TOKEN='your-hamming-api-token'
DEEPGRAM_API_KEY='your-deepgram-api-key'
PORT=3000
TARGET_PHONE_NUMBER='+14153580761'
WEBHOOK_URL='your-ngrok-url'
OPENAI_API_KEY='your-openai-api-key'
SERVER_BASE_URL='http://localhost:3000'
```

## Running the Application

1. Start ngrok to create a webhook endpoint:

```bash
ngrok http 3000
```

2. Update the `WEBHOOK_URL` in your `.env` file with the ngrok URL

3. Start the application:

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Architecture

The system consists of several key components:

1. **Discovery Orchestrator**

   - Manages the overall discovery process
   - Coordinates concurrent calls
   - Tracks exploration progress

2. **Call Manager**

   - Handles API interactions
   - Manages call retries
   - Processes recordings

3. **Response Analyzer**

   - Analyzes voice agent responses
   - Identifies conversation paths
   - Generates follow-up scenarios

4. **Conversation Tree**

   - Tracks explored paths
   - Manages conversation state
   - Prevents redundant exploration

5. **Transcription Service**

   - Converts recordings to text
   - Provides confidence scores
   - Handles audio processing

6. **Progress Visualizer**
   - Shows real-time progress
   - Visualizes conversation tree
   - Displays metrics

## Configuration

Key configuration parameters:

| Parameter             | Description                      | Default |
| --------------------- | -------------------------------- | ------- |
| `maxDepth`            | Maximum conversation depth       | 5       |
| `maxConcurrentCalls`  | Maximum parallel calls           | 3       |
| `minTimeBetweenCalls` | Minimum delay between calls (ms) | 500     |
| `maxCallDuration`     | Maximum call duration (ms)       | 600000  |
| `retryDelayMs`        | Delay between retries (ms)       | 1000    |

## Error Handling

The system implements several layers of error handling:

1. **Call Level**

   - Automatic retries for failed calls
   - Exponential backoff
   - Circuit breaker for API protection

2. **State Level**
   - Progress preservation
   - Recovery mechanisms
   - Error state tracking

## Monitoring

Real-time monitoring includes:

- Conversation tree visualization
- Success/failure metrics
- API call statistics
- Resource usage tracking
- Error logging
- Performance metrics

## Logging

Logs are written to:

- `logs/combined.log`: All log entries
- `logs/error.log`: Error-level entries only
- Console: Formatted, colorized output

## Limitations

- Maximum 20 concurrent calls recommended
- 10-minute maximum call duration
- Requires stable internet connection
- Webhook endpoint must be publicly accessible

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

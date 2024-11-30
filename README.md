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

## System Architecture Diagram

<img width="781" alt="image" src="https://github.com/user-attachments/assets/b1c87d4a-d913-4549-ab8f-4b2922691036">

## Known Issues and Future Improvements

### Current Limitations

1. **Test Suite Issues**
   - Not all tests are passing
   - Missing integration tests for full conversation flow
   - Need more comprehensive error case coverage
   - Mock service improvements needed

**Fix**:

- Add more test cases for edge scenarios
- Implement proper cleanup in test teardown
- Add integration test suite with mock API responses
- Improve test isolation

2. **Process Termination**
   - Application doesn't gracefully terminate
   - No proper cleanup of active calls
   - Webhook server remains running

**Fix**:

- Implement proper shutdown hooks
- Add signal handlers (SIGTERM, SIGINT)
- Clean up active calls before shutdown
- Close webhook server properly

3. **Memory Management**
   - Conversation tree can grow indefinitely
   - No cleanup of completed branches
   - Potential memory leaks in long-running sessions

**Fix**:

- Implement periodic tree pruning
- Add memory usage monitoring
- Implement cleanup for completed conversations
- Add resource usage limits

4. **Error Recovery**
   - Limited recovery from API failures
   - No persistent storage of conversation state
   - Lost progress on crashes

**Fix**:

- Add persistent storage for conversation tree
- Implement checkpoint/restore functionality
- Better error recovery strategies
- Add session resumption capability

5. **Scalability Issues**
   - Single instance limitations
   - No distributed call handling
   - Local file system logging

**Fix**:

- Implement distributed architecture
- Add queue-based call handling
- Use centralized logging service
- Add horizontal scaling capability

### Future Improvements

1. **Monitoring and Observability**

   - Add comprehensive metrics collection
   - Implement proper APM integration
   - Add detailed performance tracking
   - Better visualization of system state

2. **Voice Agent Analysis**

   - Add sentiment analysis
   - Implement conversation quality metrics
   - Add automated test case generation
   - Better path similarity detection

3. **System Resilience**

   - Add circuit breakers for all external services
   - Implement proper rate limiting
   - Add request queuing
   - Better concurrent call management

4. **Developer Experience**
   - Add better debugging tools
   - Improve logging clarity
   - Add development mode with mock services
   - Better configuration management

### Implementation Priorities

For immediate stability:

1. Fix test suite (High Priority)
2. Implement graceful shutdown (High Priority)
3. Add memory management (Medium Priority)
4. Improve error recovery (Medium Priority)
5. Add basic monitoring (Low Priority)

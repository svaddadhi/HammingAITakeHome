# API Documentation

## Webhook Endpoints

### POST /webhook/callback

Receives call status updates and recording notifications from the voice agent system.

**Request Body:**

```json
{
  "id": "string", // Call ID
  "status": "string", // Call status
  "recording_available": "boolean" // Whether recording is ready
}
```

**Status Values:**

- `initiated` - Call has been started
- `in-progress` - Call is currently active
- `completed` - Call has finished successfully
- `failed` - Call has failed
- `event_phone_call_connected` - Phone connection established
- `event_phone_call_ended` - Phone call ended
- `event_recording` - Recording is available

**Response:**

```json
{
  "received": true
}
```

**Error Response:**

```json
{
  "error": {
    "message": "string",
    "status": number
  }
}
```

## External APIs Used

### Hamming Phone API

#### POST /start-call

Initiates a new phone call.

**Request:**

```json
{
  "phone_number": "string", // Target phone number
  "prompt": "string", // System prompt for the call
  "webhook_url": "string" // Callback URL for updates
}
```

**Headers:**

```
Authorization: Bearer <api_token>
Content-Type: application/json
```

#### GET /media/exercise

Retrieves call recording.

**Query Parameters:**

- `id` (string, required) - Call ID

**Headers:**

```
Authorization: Bearer <api_token>
```

**Response:**

- Content-Type: audio/wav
- Binary audio data

### Rate Limits and Constraints

1. **Call Limits**

   - Maximum 20 concurrent calls
   - 10-minute maximum call duration
   - 500ms minimum time between calls

2. **Retry Logic**

   - 3 retry attempts for failed calls
   - Exponential backoff starting at 1 second
   - Circuit breaker after 3 consecutive failures

3. **Recording Retrieval**

   - 15-second timeout for recording retrieval
   - Automatic retry on failure
   - Binary audio data in WAV format

4. **Error Handling**
   - 400 for invalid requests
   - 401 for authentication failures
   - 429 for rate limit exceeded
   - 500 for internal server errors

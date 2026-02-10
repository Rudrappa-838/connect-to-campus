
# AI Question Paper Generator Setup

To enable the AI Question Paper Generator feature, you must configure a Google Gemini API Key.

## Prerequisites
1.  **Google Cloud Project**: You need a Google Cloud Project with billing enabled (free tier available).
2.  **Enable API**: Enable the **"Generative Language API"** in your Google Cloud Console.
    *   Go to [Google Cloud Console > APIs & Services > Enabled APIs](https://console.cloud.google.com/apis/dashboard)
    *   Click "+ ENABLE APIS AND SERVICES"
    *   Search for "Generative Language API" and enable it.
3.  **API Key**: Create an API Key in [Google AI Studio](https://aistudio.google.com/app/apikey) or use an existing Google Cloud API Key with access to the Generative Language API.

## Configuration
### Global Configuration (For all schools)
Add the API Key to your backend `.env` file:
```env
GEMINI_API_KEY=AIzaSy...YourKeyHere...
```

### Per-School Configuration
You can also set a specific API Key for each school in the `schools` table (`gemini_api_key` column) via the Super Admin dashboard. This will override the global key.

## Troubleshooting
*   **Error: "AI Model not found or API Key not authorized"**:
    *   This means your API Key is valid but does not have permission to access the Gemini models.
    *   Ensure "Generative Language API" is enabled for the project associated with the key.
    *   If using an API Key restricted by IP address, ensure your server's IP is allowed.
*   **Error: "404 Not Found"**: same as above.

## Usage
1.  Log in as **School Admin** or **Teacher**.
2.  Navigate to **Academics > AI Question Paper**.
3.  Select "Topic Based" mode.
4.  Enter Subject and Class.
5.  Type instructions (e.g., "Create a test on Photosynthesis. 10 MCQs.").
6.  Click "Generate Paper".

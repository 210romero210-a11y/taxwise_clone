# Ollama Document Extraction (OCR) Skill

This skill provides instructions for extracting structured tax data from document images using Ollama Cloud or any OpenAI-compatible Vision API.

## Core Capabilities
- Extracting W-2, 1099, and Schedule C data from images.
- Mapping extracted text to IRS `fieldKey` standards.
- Validating extraction confidence.

## Usage
1. Provide the image as a Base64 encoded string.
2. Use the following structured prompt for the model:
   ```text
   Extract all numerical and text data from this tax form. 
   Format the output as a JSON object with a 'formType' (e.g., 'W2', '1099-INT') 
   and a 'fields' array where each object has 'fieldKey' and 'value'.
   ```

## Production Guidelines
- **Always** use `process.env.OLLAMA_API_URL` for the endpoint.
- **Never** use simulated data; use real-time model inference.
- **Retry Logic**: Implement at least 3 retries for transient API failures.

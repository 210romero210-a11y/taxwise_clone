---
description: how to use the phoenix AI taxpayer assistant
---
1. Ensure Ollama is running locally on your machine.
2. Install the necessary model:
   ```bash
   ollama run llama3.1
   ```
3. Start the application:
   ```bash
   npm run dev
   ```
4. In the side panel of the Form 1040 viewport, paste a natural language description like:
   *"John Doe is Married Filing Jointly with 2 children. He earned $120,000 in wages and had $1,500 in interest income."*
5. Click **Parse & Synchronize**.
6. Watch as the "Taxpayer Metadata" and "Income" sections update in real-time, triggering the Convex Dependency Engine to recalculate AGI, Taxable Income, and Total Tax.

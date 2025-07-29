# AI DB Search

A AI-powered database search tool built with OpenAI. This tool allows you to search a database using natural language, and it will generate a SQL query to retrieve and visualize the results.

## Quick Start

### Option 1: Using DevContainer

1. **Prerequisites**

   - Docker and Docker Compose
   - Visual Studio Code with Remote - Containers extension

2. **Setup**

   ```bash
   # Clone the repository
   git clone <repository-url>
   cd ai-db-search
   ```

3. **Launch DevContainer**

   - When prompted by VS Code, click "Reopen in Container"
   - Or use the command palette (F1) and select "Dev Containers: Reopen in Container"

4. **Inside the DevContainer**
   The container will automatically:

   - Set up environment
   - Install dependencies
   - Configure development tools

5. **Environment Variables**
   Make sure to set up these environment variables in your `.env` file:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

6. **Start the Application**

   ```bash
   npm run dev
   ```

7. **Access the Application**
   Open your browser and navigate to http://localhost:3000

### Option 2: Local Development

1. **Prerequisites**

   - Node.js 20 or later
   - npm or yarn
   - PostgreSQL database (for data storage)

2. **Setup**

   ```bash
   # Clone the repository
   git clone <repository-url>
   cd ai-db-search

   # Create .env file
   cp .env.template .env

   # Install dependencies
   npm install

   ```

3. **Environment Variables**
   Make sure to set up these environment variables in your `.env` file:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the Application**

   ```bash
   npm run dev
   ```

5. **Access the Application**
   Open your browser and navigate to http://localhost:3000

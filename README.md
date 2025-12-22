# Agentforce UI Demo

A modern Next.js application showcasing a custom chat interface for Salesforce Agentforce Agents using the Agent API. This demo provides a clean, responsive UI foundation for interacting with AI agents powered by Salesforce's Agentforce platform.

## Launch Your Own

Deploy this application to Heroku with one click:

<a href="https://deploy.herokuapps.ai?template=https://github.com/heroku-reference-apps/agentforce-ui">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
</a>

## Features

- 🤖 **Real-time Chat Interface**: Interactive chat UI with streaming responses
- 🎨 **Modern Design**: Clean, responsive interface built with Tailwind CSS
- ⚡ **Server-Sent Events**: Real-time message streaming for smooth user experience
- 🔧 **Configurable**: Customizable app title, description, and welcome messages
- 📱 **Responsive**: Mobile-friendly design that works across all devices
- 🚀 **One-Click Deploy**: Easy deployment to Heroku with environment configuration

## Tech Stack

- **Framework**: Next.js w/ App Router
- **Runtime**: Node.js
- **Package Manager**: pnpm
- **AI Agent**: Salesforce Agentforce (Agent API)
- **Styling**: Tailwind CSS w/ Typography plugin
- **HTTP Client**: Axios
- **Validation**: Zod
- **Markdown**: React Markdown for rich message formatting

## Prerequisites

Before getting started, you'll need to set up your Salesforce Agentforce Agent. Follow the [Get Started guide](https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html) in the Agentforce developer documentation to obtain the required credentials:

- **AGENT_ID**: The unique identifier (copilotId) of your Agentforce Agent.
- **CONSUMER_KEY** / **CONSUMER_SECRET**: OAuth credentials from your Salesforce Connected App
- **MY_DOMAIN_URL**: Your Salesforce org's My Domain URL

## Getting Started

> **Note:** This setup requires the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) to be installed.

### 1. Install Prerequisites

```bash
# Install Heroku AppLink CLI plugin
heroku plugins:install @heroku-cli/plugin-applink

# Authenticate to your Salesforce org
sf org login web -a <your-org-alias>
```

### 2. Generate JWT Certificate

```bash
# Get your SF CLI authenticated username
sf org display -o <your-org-alias> | grep Username

# Generate certificate with that email
./bin/generate_jwt_cert.sh --email <your-sf-username@example.com>
```

### 3. Configure Salesforce Connected App

1. Go to **Salesforce Setup > App Manager**
2. Create or edit a Connected App
3. Enable **"Use digital signatures"**
4. Upload `jwt/server.crt`
5. Under **Manage > Edit Policies**, set "Permitted Users" to "Admin approved users are pre-authorized"
6. Add your user to the pre-authorized list

### 4. Run AppLink Setup

**For Cursor Users:** Use the `/setup-applink` slash command for guided, interactive setup.

**For Non-Cursor Users:** Run the setup script directly:

```bash
./bin/setup_applink.sh \
    --org-alias <your-org-alias> \
    --agent-id <your-agentforce-agent-id> \
    --agent-user-email <your-sf-username@example.com>
```

The script will prompt for the Connected App Consumer Key and configure:
- Heroku AppLink JWT authorization
- Salesforce org connection
- Environment variables for the app

### Alternative: Direct OAuth Mode

For simpler development setups, use direct OAuth instead of JWT (skips steps 2-3):

```bash
./bin/setup_applink.sh \
    --org-alias <your-org-alias> \
    --agent-id <your-agentforce-agent-id> \
    --agent-user-email <your-email@example.com> \
    --auth-mode direct \
    --consumer-key <your-consumer-key> \
    --consumer-secret <your-consumer-secret>
```

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/heroku-reference-apps/agentforce-ui.git
cd agentforce-ui
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Salesforce Configuration (Required)
SF_AGENT_ID=your_agent_id_here
SF_CONSUMER_KEY=your_consumer_key_here
SF_CONSUMER_SECRET=your_consumer_secret_here
SF_MY_DOMAIN_URL=https://your-domain.my.salesforce.com

# UI Configuration (Optional - defaults provided)
NEXT_PUBLIC_APP_TITLE=AI Chat Assistant
NEXT_PUBLIC_APP_DESCRIPTION=Your intelligent AI assistant powered by Agentforce
NEXT_PUBLIC_APP_INTRO_MESSAGE=Hello! I'm your AI assistant. How can I help you today?
```

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3003`.

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `SF_AGENT_ID` | Your Salesforce Agentforce Agent ID |
| `SF_CONSUMER_KEY` | Consumer Key from your Salesforce Connected App |
| `SF_CONSUMER_SECRET` | Consumer Secret from your Salesforce Connected App |
| `SF_MY_DOMAIN_URL` | Your Salesforce org's My Domain URL |

### Optional UI Configuration

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `NEXT_PUBLIC_APP_TITLE` | "AI Chat Assistant" | Application title shown in the UI |
| `NEXT_PUBLIC_APP_DESCRIPTION` | "Your intelligent AI assistant powered by Agentforce" | Application description |
| `NEXT_PUBLIC_APP_INTRO_MESSAGE` | "Hello! I'm your AI assistant. How can I help you today?" | Welcome message shown to users |

## Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint for code quality checks

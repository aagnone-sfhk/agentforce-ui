# Agentforce UI Demo

A modern Next.js application showcasing a custom chat interface for Salesforce Agentforce Agents using the Agent API. This demo provides a clean, responsive UI for interacting with AI agents powered by Salesforce's Agentforce platform.

## Features

- 🤖 **Real-time Chat Interface**: Interactive chat UI with streaming responses
- 🎨 **Modern Design**: Clean, responsive interface built with Tailwind CSS
- ⚡ **Server-Sent Events**: Real-time message streaming for smooth user experience
- 🔧 **Configurable**: Customizable app title, description, and welcome messages
- 📱 **Responsive**: Mobile-friendly design that works across all devices
- 🚀 **One-Click Deploy**: Easy deployment to Heroku with environment configuration

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: Node.js 18+
- **Package Manager**: pnpm
- **AI Agent**: Salesforce Agentforce (Agent API)
- **Styling**: Tailwind CSS with Typography plugin
- **HTTP Client**: Axios
- **Validation**: Zod
- **Markdown**: React Markdown for rich message formatting

## Prerequisites

Before getting started, you'll need to set up your Salesforce Agentforce Agent. Follow the [Get Started guide](https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html) in the Agentforce developer documentation to obtain the required credentials:

- **AGENT_ID**: The unique identifier of your Agentforce Agent
- **CONSUMER_KEY** / **CONSUMER_SECRET**: OAuth credentials from your Salesforce Connected App
- **MY_DOMAIN_URL**: Your Salesforce org's My Domain URL

## Quick Deploy to Heroku

Deploy this application to Heroku with one click:

<a href="https://www.heroku.com/deploy?template=https://github.com/aagnone-sfhk/agentforce-ui">
<img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
</a>

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/aagnone-sfhk/agentforce-ui.git
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

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/message/        # API route for agent communication
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx           # Home page
├── chat/                   # Chat functionality
│   ├── agentforce.ts      # Agentforce API integration
│   ├── config.ts          # Chat configuration
│   ├── sse.ts             # Server-Sent Events handling
│   └── types.ts           # TypeScript types
├── components/             # Reusable components
│   ├── chat/              # Chat-specific components
│   └── ...                # Other UI components
├── hooks/                  # React hooks
│   ├── ChatContext.tsx    # Chat state management
│   └── useChat.ts         # Chat hook
└── config/                 # Configuration files
```

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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## License

MIT License

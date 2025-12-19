---
description: Configure Heroku AppLink for Agentforce Agent communication
---

# Setup Heroku AppLink for Agentforce

Configure this Heroku app for Agentforce Agent communication using the `setup_applink.sh` script.

## Instructions

I need help setting up Heroku AppLink for my Agentforce Agent. Please guide me through the `bin/setup_applink.sh` script.

### What I need you to do:

1. **Check prerequisites** - Verify I have the required tools and files:
   - Heroku CLI with AppLink plugin
   - Salesforce CLI authenticated to my org
   - JWT key files (for applink mode) or OAuth credentials (for direct mode)

2. **Gather required information** - Ask me for:
   - Salesforce org alias (from `sf org list`)
   - Agentforce Agent ID (from Salesforce Setup)
   - Agent user email address
   - Preferred authentication mode (applink or direct)

3. **Generate the command** - Build the appropriate `setup_applink.sh` command based on my answers

4. **Execute and troubleshoot** - Run the script and help resolve any issues

### Context

Reference the `.cursor/rules/setup-applink.mdc` rule for detailed documentation on:
- Script arguments and options
- Authentication modes (applink vs direct)
- Environment variables configured
- Troubleshooting common issues

### Quick Start Questions

Please ask me:
1. What is your Salesforce CLI org alias? (run `sf org list` to see available orgs)
2. What is your Agentforce Agent ID? (found in Salesforce Setup under Agents)
3. What is the email of the Agentforce service user?
4. Which auth mode do you prefer? 
   - `applink` (JWT, more secure, requires jwt/server.key)
   - `direct` (OAuth, simpler, requires consumer key/secret)
5. Do you need Data Cloud integration? (yes/no)
6. Do you want to publish the API spec to Salesforce? (yes/no)


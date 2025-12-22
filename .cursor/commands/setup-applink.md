---
description: Configure Heroku AppLink for Agentforce Agent communication
---

# Setup Heroku AppLink for Agentforce

Configure this Heroku app for Agentforce Agent communication using the `setup_applink.sh` script.

## Instructions

I need help setting up Heroku AppLink for my Agentforce Agent. Please guide me through the process.

### What I need you to do:

0. **Download Heroku app config**
   - `heroku config -s > .env`

1. **Check prerequisites** - Verify I have the required tools:
   - Heroku CLI with AppLink plugin (`heroku plugins | grep applink`)
   - Salesforce CLI authenticated to my org (`sf org list`)

2. **Gather required information** - Confirm or ask me for:
   - Salesforce org alias (from `sf org list`)
   - Agentforce Agent ID from `.env`
   - Preferred authentication mode (applink or direct) from `.env`

3. **Identify the two user roles** (for applink mode):

   **A) JWT Authentication User** - The Salesforce user who authenticates the JWT connection:
   - Get this from: `sf org display -o <alias> | grep Username`
   - This user's email goes in the JWT certificate
   - This user must be pre-authorized in the Connected App

   **B) Agentforce Service User** - The user context under which the Agent operates:
   - Passed to `--agent-user-email` in setup_applink.sh
   - Gets permission sets assigned for Agent access
   - Can be the same as the JWT user, but doesn't have to be

4. **JWT Certificate Validation** (for applink mode only):
   
   Run the validation script:
   ```bash
   ./bin/validate_jwt_cert.sh --org-alias <alias>
   ```
   
   **If validation passes** (exit code 0): Certificate matches SF CLI user, proceed to step 5
   
   **If validation fails** (exit code 1): Either certificate is missing or email doesn't match
   - Get the JWT auth user: `sf org display -o <alias> --json | jq -r '.result.username'`
   - Generate/regenerate certificate:
     ```bash
     ./bin/generate_jwt_cert.sh --email <jwt-auth-user@example.com> --force
     ```
   - Remind user to upload `jwt/server.crt` to Connected App

5. **Generate the command** - Build the appropriate `setup_applink.sh` command

6. **Execute and troubleshoot** - Run the script and help resolve any issues

### Context

Reference the `.cursor/rules/setup-applink.mdc` rule for detailed documentation on:
- Script arguments and options
- Authentication modes (applink vs direct)
- JWT certificate generation
- User roles (JWT auth vs Agentforce service)
- Troubleshooting common issues

### Quick Start Questions

Please ask me:
1. What is your Salesforce CLI org alias? (run `sf org list` to see available orgs)
2. What is the email of the **Agentforce service user**? (the user context for the Agent)
3. Do you want your agent to access Data Cloud? (yes/no)
4. Do you want to publish the API spec to Salesforce? (yes/no)

Then automatically:
- Get the JWT auth user: `sf org display -o <alias> --json | jq -r '.result.username'`
- Validate existing certificate (if any) matches that user

### Understanding the Two Users

| Role | Purpose | Where Used |
|------|---------|------------|
| **JWT Auth User** | Authenticates the JWT Bearer connection | Certificate email, Connected App pre-authorization |
| **Agentforce Service User** | User context for Agent operations | `--agent-user-email`, permission set assignment |

These CAN be the same user, but are conceptually different. The JWT auth user is determined by `sf org display` (the SF CLI authenticated user). The Agentforce service user is specified explicitly.

### JWT Certificate Validation Flow

Use the validation script to check certificate status:

```bash
# Validate certificate matches SF CLI user (returns exit code 0 if valid)
./bin/validate_jwt_cert.sh --org-alias <alias>

# If validation fails, get the correct email and regenerate
JWT_USER=$(sf org display -o <alias> --json | jq -r '.result.username')
./bin/generate_jwt_cert.sh --email "$JWT_USER" --force
```

After generating or regenerating certificates:
1. Salesforce Setup > App Manager > Edit Connected App
2. Check "Use digital signatures"
3. Upload `jwt/server.crt`
4. Under "Manage" > OAuth Policies, pre-authorize the JWT auth user

#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Heroku AppLink Setup for Agentforce
# =============================================================================
# Configures an AppLink-enabled Heroku app for Agentforce Agent communication.
# Supports both direct OAuth and AppLink JWT authentication modes.
# =============================================================================

# Global variables
sf_org_alias=""
agent_user_email=""
heroku_app_name=""
agent_id=""
auth_mode="applink"
consumer_key=""
consumer_secret=""
skip_api_publish=false
include_data_cloud=false
api_client_name="HerokuAgents"
permission_set_name="HerokuAgentsPermSet"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC}  $1"; }
log_error() { echo -e "${RED}❌${NC} $1" >&2; }

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Configure an AppLink-enabled Heroku app for Agentforce Agent communication.

REQUIRED OPTIONS:
    --org-alias <alias>           Salesforce CLI org alias (e.g., 'acme')
    --agent-id <id>               Agentforce Agent ID (e.g., '0Xx000000000000')
    --agent-user-email <email>    Email of the Agentforce agent user

AUTHENTICATION OPTIONS:
    --auth-mode <mode>            Authentication mode: 'applink' (default) or 'direct'
    --consumer-key <key>          OAuth Consumer Key (required for direct mode)
    --consumer-secret <secret>    OAuth Consumer Secret (required for direct mode)

OPTIONAL FLAGS:
    --include-data-cloud          Include Data Cloud connection setup
    --skip-api-publish            Skip API specification publishing
    -h, --help                    Show this help message

EXAMPLES:
    # AppLink JWT mode (recommended for production)
    $0 --org-alias acme --agent-id 0Xx000000000000 --agent-user-email agent@example.com

    # Direct OAuth mode (simpler setup)
    $0 --org-alias acme --agent-id 0Xx000000000000 --agent-user-email agent@example.com \\
       --auth-mode direct --consumer-key "3MVG9..." --consumer-secret "secret123"

    # With Data Cloud
    $0 --org-alias acme --agent-id 0Xx000000000000 --agent-user-email agent@example.com \\
       --include-data-cloud

PREREQUISITES:
    - Heroku CLI with AppLink plugin: heroku plugins:install @heroku-cli/plugin-applink
    - Salesforce CLI authenticated to target org: sf org login web -a <alias>
    - Agentforce Agent created in Salesforce Setup
    - (For applink mode) JWT private key file at jwt/server.key
    - (For applink mode) Connected App configured for JWT Bearer flow
    - (For direct mode) Connected App with Client Credentials flow enabled

AUTHENTICATION MODES:
    applink  - Uses Heroku AppLink SDK with JWT Bearer authentication.
               More secure, recommended for production. Requires JWT key file
               and Connected App configured for JWT flow.
               
    direct   - Uses OAuth 2.0 Client Credentials flow directly.
               Simpler setup, good for development. Requires Consumer Key
               and Consumer Secret from Connected App.

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            --org-alias)
                sf_org_alias="$2"
                shift 2
                ;;
            --agent-id)
                agent_id="$2"
                shift 2
                ;;
            --agent-user-email)
                agent_user_email="$2"
                shift 2
                ;;
            --auth-mode)
                auth_mode="$2"
                shift 2
                ;;
            --consumer-key)
                consumer_key="$2"
                shift 2
                ;;
            --consumer-secret)
                consumer_secret="$2"
                shift 2
                ;;
            --include-data-cloud)
                include_data_cloud=true
                shift
                ;;
            --skip-api-publish)
                skip_api_publish=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    local missing=()
    [[ -z "$sf_org_alias" ]] && missing+=("--org-alias")
    [[ -z "$agent_id" ]] && missing+=("--agent-id")
    [[ -z "$agent_user_email" ]] && missing+=("--agent-user-email")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required arguments: ${missing[*]}"
        echo ""
        usage
        exit 1
    fi

    # Validate auth mode
    if [[ "$auth_mode" != "applink" && "$auth_mode" != "direct" ]]; then
        log_error "Invalid auth mode: $auth_mode (must be 'applink' or 'direct')"
        exit 1
    fi

    # Validate direct mode requirements
    if [[ "$auth_mode" == "direct" ]]; then
        if [[ -z "$consumer_key" || -z "$consumer_secret" ]]; then
            log_error "Direct auth mode requires --consumer-key and --consumer-secret"
            exit 1
        fi
    fi

    # Validate email format
    if [[ ! "$agent_user_email" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
        log_error "Invalid email format: $agent_user_email"
        exit 1
    fi

    echo ""
    log_success "Configuration:"
    log_info "  Salesforce org alias: $sf_org_alias"
    log_info "  Agent ID: $agent_id"
    log_info "  Agent user email: $agent_user_email"
    log_info "  Auth mode: $auth_mode"
    log_info "  Include Data Cloud: $include_data_cloud"
    log_info "  Skip API publish: $skip_api_publish"
}

validate_prerequisites() {
    echo ""
    log_info "Validating prerequisites..."

    # Check Heroku CLI
    if ! command -v heroku &>/dev/null; then
        log_error "Heroku CLI not found. Install from: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    log_success "Heroku CLI found"

    # Check Salesforce CLI
    if ! command -v sf &>/dev/null; then
        log_error "Salesforce CLI not found. Install from: https://developer.salesforce.com/tools/sfdxcli"
        exit 1
    fi
    log_success "Salesforce CLI found"

    # Check AppLink plugin
    if ! heroku plugins 2>/dev/null | grep -q "@heroku-cli/plugin-applink"; then
        log_warn "AppLink plugin not found. Installing..."
        heroku plugins:install @heroku-cli/plugin-applink
    fi
    log_success "AppLink plugin available"

    # Check SF org authentication
    if ! sf org display -o "$sf_org_alias" &>/dev/null; then
        log_error "Not authenticated to Salesforce org '$sf_org_alias'"
        log_info "Run: sf org login web -a $sf_org_alias"
        exit 1
    fi
    log_success "Authenticated to Salesforce org: $sf_org_alias"

    # Check JWT key file for applink mode
    if [[ "$auth_mode" == "applink" ]]; then
        if [[ ! -f "jwt/server.key" ]]; then
            log_error "JWT private key not found at jwt/server.key"
            log_info "Generate with: openssl genrsa -out jwt/server.key 2048"
            log_info "Public key:    openssl rsa -in jwt/server.key -pubout -out jwt/server.pub"
            exit 1
        fi
        log_success "JWT key file found"
    fi
}

detect_heroku_app() {
    echo ""
    log_info "Detecting Heroku app..."

    if git remote get-url heroku &>/dev/null; then
        heroku_app_name=$(git remote get-url heroku | sed 's/.*\/\([^.]*\)\.git/\1/')
        log_success "Found Heroku app: $heroku_app_name"

        # Verify AppLink addon
        if ! heroku addons -a "$heroku_app_name" 2>/dev/null | grep -q heroku-applink; then
            log_error "Heroku AppLink addon not found on app '$heroku_app_name'"
            log_info "Add with: heroku addons:create heroku-applink -a $heroku_app_name"
            exit 1
        fi
        log_success "AppLink addon confirmed"
    else
        log_error "No Heroku remote found"
        log_info "Deploy via Heroku Button first, or run:"
        log_info "  heroku create <app-name>"
        log_info "  heroku addons:create heroku-applink"
        exit 1
    fi
}

get_sf_org_info() {
    echo ""
    log_info "Fetching Salesforce org information..."

    # Get My Domain URL from SF CLI
    local org_info
    org_info=$(sf org display -o "$sf_org_alias" --json 2>/dev/null)
    
    sf_instance_url=$(echo "$org_info" | jq -r '.result.instanceUrl')
    sf_username=$(echo "$org_info" | jq -r '.result.username')

    if [[ -z "$sf_instance_url" || "$sf_instance_url" == "null" ]]; then
        log_error "Could not retrieve Salesforce instance URL"
        exit 1
    fi

    log_success "Instance URL: $sf_instance_url"
    log_success "Username: $sf_username"
}

setup_direct_auth() {
    echo ""
    log_info "Configuring direct OAuth authentication..."

    heroku config:set \
        SF_AUTH_MODE="direct" \
        SF_CONSUMER_KEY="$consumer_key" \
        SF_CONSUMER_SECRET="$consumer_secret" \
        -a "$heroku_app_name"

    log_success "Direct OAuth credentials configured"
}

setup_applink_auth() {
    echo ""
    log_info "Configuring AppLink JWT authentication..."

    local jwt_connection_name="sf-jwt-${sf_org_alias}"
    local jwt_auth_name="auth-jwt-${sf_org_alias}"

    # Prompt for Connected App Client ID if not provided
    if [[ -z "$consumer_key" ]]; then
        echo ""
        log_info "Enter the Connected App Consumer Key (Client ID) for JWT flow:"
        read -r consumer_key
        if [[ -z "$consumer_key" ]]; then
            log_error "Consumer Key is required for JWT authentication"
            exit 1
        fi
    fi

    # Create JWT connection
    log_info "Creating JWT connection: $jwt_connection_name"
    heroku salesforce:connect:jwt "$jwt_connection_name" \
        -a "$heroku_app_name" \
        --client-id "$consumer_key" \
        --jwt-key-file jwt/server.key \
        --username "$sf_username"

    # Add JWT authorization
    log_info "Adding JWT authorization: $jwt_auth_name"
    heroku salesforce:authorizations:jwt:add "$jwt_auth_name" \
        -a "$heroku_app_name" \
        --connection-name "$jwt_connection_name"

    # Set config vars
    heroku config:set \
        SF_AUTH_MODE="applink" \
        JWT_CONNECTION_NAME="$jwt_auth_name" \
        -a "$heroku_app_name"

    log_success "AppLink JWT authentication configured"
}

setup_agentforce_config() {
    echo ""
    log_info "Setting Agentforce configuration..."

    heroku config:set \
        SF_MY_DOMAIN_URL="$sf_instance_url" \
        SF_AGENT_ID="$agent_id" \
        HEROKU_APP_ID="$(heroku apps:info -a "$heroku_app_name" --json | jq -r '.app.id')" \
        -a "$heroku_app_name"

    log_success "Agentforce configuration set"
}

setup_salesforce_connection() {
    echo ""
    log_info "Setting up Salesforce connection..."

    local sf_connection_name="sf-${sf_org_alias}"
    local sf_auth_name="auth-sf-${sf_org_alias}"

    heroku salesforce:connect "$sf_connection_name" -a "$heroku_app_name"
    heroku salesforce:authorizations:add "$sf_auth_name" -a "$heroku_app_name"

    log_success "Salesforce connection established: $sf_connection_name"
}

setup_data_cloud_connection() {
    echo ""
    log_info "Setting up Data Cloud connection..."

    local dc_connection_name="dc-${sf_org_alias}"
    local dc_auth_name="auth-dc-${sf_org_alias}"

    heroku datacloud:connect "$dc_connection_name" -a "$heroku_app_name"
    heroku datacloud:authorizations:add "$dc_auth_name" -a "$heroku_app_name"

    # Set Data Cloud connection name config var
    heroku config:set DC_CONNECTION_NAME="$dc_auth_name" -a "$heroku_app_name"

    log_success "Data Cloud connection established: $dc_connection_name"
}

publish_api_spec() {
    echo ""
    log_info "Publishing API specification..."

    if [[ ! -f "api-spec.yaml" ]]; then
        log_warn "api-spec.yaml not found, skipping API publish"
        return 0
    fi

    heroku salesforce:publish api-spec.yaml \
        --client-name "$api_client_name" \
        --connection-name "sf-${sf_org_alias}" \
        --authorization-connected-app-name "$api_client_name" \
        --authorization-permission-set-name "$permission_set_name" \
        -a "$heroku_app_name"

    log_success "API specification published"
}

assign_permissions() {
    echo ""
    log_info "Assigning permission sets..."

    # Assign to current user
    sf org assign permset --name "$permission_set_name" -o "$sf_org_alias" || true
    log_success "Permission set assigned to your user"

    # Assign to agent user
    sf org assign permset -o "$sf_org_alias" -n "$permission_set_name" -b "$agent_user_email" || true
    sf org assign permset -o "$sf_org_alias" -n "$api_client_name" -b "$agent_user_email" || true
    log_success "Permission sets assigned to agent user: $agent_user_email"
}

save_local_env() {
    echo ""
    log_info "Saving configuration to .env file..."

    heroku config -s -a "$heroku_app_name" > .env
    log_success "Configuration saved to .env for local development"
}

print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Configuration Summary:"
    echo "  • Heroku app:        $heroku_app_name"
    echo "  • Salesforce org:    $sf_org_alias"
    echo "  • Auth mode:         $auth_mode"
    echo "  • Agent ID:          $agent_id"
    [[ "$include_data_cloud" == true ]] && echo "  • Data Cloud:        auth-dc-${sf_org_alias}"
    echo ""
    echo "App URL: https://${heroku_app_name}.herokuapp.com"
    echo ""
    echo "Next Steps:"
    echo "  1. Verify your Agentforce Agent is active in Salesforce Setup"
    echo "  2. Test the chat interface at your app URL"
    echo "  3. For local development, use the .env file created"
    echo ""
    if [[ "$auth_mode" == "applink" ]]; then
        echo "JWT Authorization: auth-jwt-${sf_org_alias}"
        echo "  Ensure your Connected App has the JWT Bearer flow enabled"
        echo "  and the public key (jwt/server.pub) is uploaded."
    fi
}

main() {
    echo ""
    echo "🚀 Heroku AppLink Setup for Agentforce"
    echo "========================================"

    parse_arguments "$@"
    validate_prerequisites
    detect_heroku_app
    get_sf_org_info

    # Configure authentication
    if [[ "$auth_mode" == "direct" ]]; then
        setup_direct_auth
    else
        setup_applink_auth
    fi

    # Set Agentforce-specific config
    setup_agentforce_config

    # Setup Salesforce connection
    setup_salesforce_connection

    # Optional: Data Cloud connection
    if [[ "$include_data_cloud" == true ]]; then
        setup_data_cloud_connection
    fi

    # Optional: API spec publishing
    if [[ "$skip_api_publish" == false ]]; then
        publish_api_spec
        assign_permissions
    fi

    # Save local .env
    save_local_env

    print_summary
}

main "$@"

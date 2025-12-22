#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# JWT Certificate Validator for Heroku AppLink
# =============================================================================
# Validates that the JWT certificate email matches the SF CLI authenticated user.
# Returns exit code 0 if valid, 1 if mismatch or missing.
# =============================================================================

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

# Default values
sf_org_alias=""
cert_path="jwt/server.crt"
quiet=false

usage() {
    cat << EOF
Usage: $0 --org-alias <sf-org-alias> [OPTIONS]

Validate that the JWT certificate email matches the SF CLI authenticated user.

REQUIRED:
    --org-alias <alias>     Salesforce CLI org alias

OPTIONS:
    --cert <path>           Path to certificate (default: jwt/server.crt)
    --quiet                 Only output result, no details
    -h, --help              Show this help message

EXIT CODES:
    0   Certificate exists and email matches SF CLI user
    1   Certificate missing or email mismatch

EXAMPLES:
    # Basic validation
    $0 --org-alias my-org

    # Quiet mode (for scripting)
    $0 --org-alias my-org --quiet && echo "Valid" || echo "Invalid"

    # Custom certificate path
    $0 --org-alias my-org --cert certs/custom.crt

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
            --cert)
                cert_path="$2"
                shift 2
                ;;
            --quiet)
                quiet=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$sf_org_alias" ]]; then
        log_error "Missing required argument: --org-alias"
        echo ""
        usage
        exit 1
    fi
}

get_sf_username() {
    local org_info
    org_info=$(sf org display -o "$sf_org_alias" --json 2>/dev/null) || {
        log_error "Failed to get org info for alias: $sf_org_alias"
        log_info "Run: sf org login web -a $sf_org_alias"
        exit 1
    }
    
    echo "$org_info" | jq -r '.result.username'
}

get_cert_email() {
    if [[ ! -f "$cert_path" ]]; then
        return 1
    fi
    
    # Extract email from certificate subject
    # Try emailAddress field first, fall back to CN
    local email
    email=$(openssl x509 -in "$cert_path" -noout -subject -nameopt multiline 2>/dev/null | grep emailAddress | sed 's/.*= //' | head -1)
    
    if [[ -z "$email" ]]; then
        # Fall back to CN if no emailAddress
        email=$(openssl x509 -in "$cert_path" -noout -subject -nameopt multiline 2>/dev/null | grep commonName | sed 's/.*= //' | head -1)
    fi
    
    echo "$email"
}

main() {
    parse_arguments "$@"

    [[ "$quiet" == false ]] && echo ""
    [[ "$quiet" == false ]] && log_info "Validating JWT certificate..."

    # Get expected username from SF CLI
    local sf_username
    sf_username=$(get_sf_username)
    
    if [[ -z "$sf_username" || "$sf_username" == "null" ]]; then
        log_error "Could not determine SF CLI username"
        exit 1
    fi
    
    [[ "$quiet" == false ]] && log_info "SF CLI user: $sf_username"

    # Check if certificate exists
    if [[ ! -f "$cert_path" ]]; then
        [[ "$quiet" == false ]] && log_warn "Certificate not found: $cert_path"
        [[ "$quiet" == false ]] && echo ""
        [[ "$quiet" == false ]] && log_info "Generate with:"
        [[ "$quiet" == false ]] && echo "    ./bin/generate_jwt_cert.sh --email $sf_username"
        exit 1
    fi

    # Get email from certificate
    local cert_email
    cert_email=$(get_cert_email)
    
    if [[ -z "$cert_email" ]]; then
        log_error "Could not extract email from certificate"
        exit 1
    fi
    
    [[ "$quiet" == false ]] && log_info "Certificate email: $cert_email"

    # Compare
    if [[ "$sf_username" == "$cert_email" ]]; then
        [[ "$quiet" == false ]] && echo ""
        [[ "$quiet" == false ]] && log_success "Certificate email matches SF CLI user"
        exit 0
    else
        [[ "$quiet" == false ]] && echo ""
        log_error "MISMATCH: Certificate is for '$cert_email' but SF CLI user is '$sf_username'"
        [[ "$quiet" == false ]] && echo ""
        [[ "$quiet" == false ]] && log_info "Regenerate with:"
        [[ "$quiet" == false ]] && echo "    ./bin/generate_jwt_cert.sh --email $sf_username --force"
        exit 1
    fi
}

main "$@"


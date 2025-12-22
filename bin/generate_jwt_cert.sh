#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# JWT Certificate Generator for Heroku AppLink
# =============================================================================
# Generates a self-signed certificate and key pair for JWT Bearer authentication.
#
# IMPORTANT: The certificate email must match the Salesforce username of the
# user who will AUTHENTICATE via JWT. This is typically the SF CLI authenticated
# user (shown by `sf org display`), NOT necessarily the Agentforce service user.
#
# These are two different concepts:
#   - JWT Auth User: The SF user whose credentials authenticate the JWT flow
#   - Agentforce User: The user context under which the Agent operates
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
output_dir="jwt"
key_size=4096
validity_days=365
sf_email=""
org_name="Heroku AppLink"
force_overwrite=false

usage() {
    cat << EOF
Usage: $0 --email <jwt-auth-user-email> [OPTIONS]

Generate JWT certificate and key pair for Heroku AppLink authentication.

CRITICAL: The email MUST match the Salesforce username of the user who will
AUTHENTICATE via JWT Bearer flow. This is the user shown by:

    sf org display -o <your-org-alias> | grep Username

This is NOT necessarily the same as the Agentforce service user (--agent-user-email
in setup_applink.sh). The JWT auth user authenticates the connection; the Agentforce
user is the context under which the Agent operates.

REQUIRED:
    --email <email>         Salesforce username for JWT authentication
                            (from: sf org display -o <alias>)

OPTIONS:
    --output-dir <dir>      Output directory (default: jwt)
    --key-size <bits>       RSA key size (default: 4096)
    --validity <days>       Certificate validity in days (default: 365)
    --org <name>            Organization name in certificate (default: "Heroku AppLink")
    --force                 Overwrite existing files without prompting
    -h, --help              Show this help message

OUTPUTS:
    <output-dir>/server.key    Private key (keep secure, do NOT commit)
    <output-dir>/server.crt    Self-signed certificate (upload to Connected App)
    <output-dir>/server.pub    Public key extracted from certificate

EXAMPLES:
    # Get the correct email from SF CLI
    sf org display -o my-org | grep Username
    # Output: Username     admin@mycompany.com

    # Generate certificate with that username
    $0 --email admin@mycompany.com

    # Custom output directory
    $0 --email admin@mycompany.com --output-dir certs/applink

    # Extended validity and custom org
    $0 --email admin@mycompany.com --validity 730 --org "ACME Corp"

NEXT STEPS after generation:
    1. Upload server.crt to your Salesforce Connected App:
       - Go to Setup > App Manager > Your Connected App > Edit
       - Check "Use digital signatures"
       - Upload the server.crt file
    2. Pre-authorize the JWT user in the Connected App policies
    3. Run setup_applink.sh with --auth-mode applink

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            --email)
                sf_email="$2"
                shift 2
                ;;
            --output-dir)
                output_dir="$2"
                shift 2
                ;;
            --key-size)
                key_size="$2"
                shift 2
                ;;
            --validity)
                validity_days="$2"
                shift 2
                ;;
            --org)
                org_name="$2"
                shift 2
                ;;
            --force)
                force_overwrite=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate required email
    if [[ -z "$sf_email" ]]; then
        log_error "Missing required argument: --email"
        echo ""
        log_info "To find the correct email, run:"
        echo "    sf org display -o <your-org-alias> | grep Username"
        echo ""
        usage
        exit 1
    fi

    # Validate email format
    if [[ ! "$sf_email" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
        log_error "Invalid email format: $sf_email"
        exit 1
    fi

    # Validate key size
    if [[ ! "$key_size" =~ ^(2048|4096)$ ]]; then
        log_warn "Unusual key size: $key_size. Recommended: 2048 or 4096"
    fi
}

check_prerequisites() {
    if ! command -v openssl &>/dev/null; then
        log_error "OpenSSL not found. Please install OpenSSL first."
        exit 1
    fi
    log_success "OpenSSL found: $(openssl version)"
}

check_existing_files() {
    local files_exist=false
    
    if [[ -f "$output_dir/server.key" ]]; then
        files_exist=true
        log_warn "Existing file found: $output_dir/server.key"
    fi
    if [[ -f "$output_dir/server.crt" ]]; then
        files_exist=true
        log_warn "Existing file found: $output_dir/server.crt"
    fi
    if [[ -f "$output_dir/server.pub" ]]; then
        files_exist=true
        log_warn "Existing file found: $output_dir/server.pub"
    fi

    if [[ "$files_exist" == true && "$force_overwrite" == false ]]; then
        echo ""
        log_warn "Existing JWT files detected. Overwriting will invalidate any"
        log_warn "existing AppLink authorizations using these certificates."
        echo ""
        read -p "Do you want to overwrite? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Aborted. Use --force to skip this prompt."
            exit 0
        fi
    fi
}

generate_certificate() {
    echo ""
    log_info "Generating JWT certificate..."
    log_info "  JWT Auth User: $sf_email"
    log_info "  Organization: $org_name"
    log_info "  Key size: ${key_size} bits"
    log_info "  Validity: ${validity_days} days"
    log_info "  Output directory: $output_dir"
    echo ""

    # Create output directory
    mkdir -p "$output_dir"

    # Generate private key and self-signed certificate in one command
    # The -subj sets the certificate subject with email in the emailAddress field
    openssl req -x509 \
        -newkey "rsa:${key_size}" \
        -keyout "$output_dir/server.key" \
        -out "$output_dir/server.crt" \
        -days "$validity_days" \
        -nodes \
        -subj "/CN=${sf_email}/emailAddress=${sf_email}/O=${org_name}"

    log_success "Generated private key: $output_dir/server.key"
    log_success "Generated certificate: $output_dir/server.crt"

    # Extract public key from certificate
    openssl x509 -pubkey -noout -in "$output_dir/server.crt" > "$output_dir/server.pub"
    log_success "Extracted public key: $output_dir/server.pub"
}

print_certificate_info() {
    echo ""
    log_info "Certificate details:"
    openssl x509 -in "$output_dir/server.crt" -noout -subject -dates | sed 's/^/  /'
}

print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}🔐 JWT Certificate Generated!${NC}"
    echo "========================================"
    echo ""
    echo "Generated files:"
    echo "  • Private key:   $output_dir/server.key (KEEP SECURE)"
    echo "  • Certificate:   $output_dir/server.crt (upload to Salesforce)"
    echo "  • Public key:    $output_dir/server.pub"
    echo ""
    echo "JWT Auth User: $sf_email"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
    echo "  • NEVER commit server.key to version control"
    echo "  • The email ($sf_email) must match the Salesforce username"
    echo "    shown by: sf org display -o <alias>"
    echo "  • This user must be pre-authorized in the Connected App"
    echo ""
    echo "Next Steps:"
    echo "  1. Go to Salesforce Setup > App Manager"
    echo "  2. Find and edit your Connected App"
    echo "  3. Check 'Use digital signatures' and upload $output_dir/server.crt"
    echo "  4. Under 'Manage', set OAuth policies to pre-authorize the JWT user"
    echo "  5. Run: ./bin/setup_applink.sh --auth-mode applink ..."
    echo ""
}

main() {
    echo ""
    echo "🔐 JWT Certificate Generator for Heroku AppLink"
    echo "================================================"

    parse_arguments "$@"
    check_prerequisites
    check_existing_files
    generate_certificate
    print_certificate_info
    print_summary
}

main "$@"

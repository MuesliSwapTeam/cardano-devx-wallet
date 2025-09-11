#!/bin/bash

# Blockfrost Transaction Fetcher for Cardano Preprod Testnet
# Usage: ./get_transactions.sh <cardano_address> [api_key]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BLOCKFROST_API_URL="https://cardano-preprod.blockfrost.io/api/v0"
DEFAULT_API_KEY="preprodUCRP6WTpWi0DXWZF4eduE2VZPod9CjAJ"  # Replace with your actual API key

# Function to print colored output
print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to show usage
show_usage() {
    echo "Usage: $0 <cardano_address> [api_key]"
    echo ""
    echo "Arguments:"
    echo "  cardano_address   Cardano address (must start with addr_test1 for preprod)"
    echo "  api_key          Optional: Blockfrost API key (defaults to \$BLOCKFROST_PREPROD_API_KEY env var)"
    echo ""
    echo "Examples:"
    echo "  $0 addr_test1qq9prvx8ufwutkwxx9cmmuuajaqmjqwujqlp9d8pvg6gupcvluken35ncjnu0puetf5jvttedkze02d5kf890kquh60sut4cgu"
    echo "  $0 addr_test1qq9prvx8ufwutkwxx9cmmuuajaqmjqwujqlp9d8pvg6gupcvluken35ncjnu0puetf5jvttedkze02d5kf890kquh60sut4cgu your_api_key_here"
    echo ""
    echo "Environment Variables:"
    echo "  BLOCKFROST_PREPROD_API_KEY   Your Blockfrost preprod API key"
}

# Validate input arguments
if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    print_error "Invalid number of arguments"
    show_usage
    exit 1
fi

ADDRESS="$1"
API_KEY="${2:-${BLOCKFROST_PREPROD_API_KEY:-$DEFAULT_API_KEY}}"

# Validate address format
if [[ ! "$ADDRESS" =~ ^addr_test1 ]]; then
    print_error "Invalid address format. For preprod testnet, address must start with 'addr_test1'"
    exit 1
fi

# Check if API key is set
if [ "$API_KEY" = "$DEFAULT_API_KEY" ]; then
    print_warn "Using default API key. Please set BLOCKFROST_PREPROD_API_KEY environment variable or provide API key as argument"
fi

print_info "Fetching transactions for address: $ADDRESS"
print_info "Using Blockfrost Preprod API: $BLOCKFROST_API_URL"

# Step 1: Get address information to find stake address
print_info "Step 1: Getting address information..."
address_response=$(curl -s -H "project_id: $API_KEY" "$BLOCKFROST_API_URL/addresses/$ADDRESS")

# Check if address request was successful
if ! echo "$address_response" | jq -e . >/dev/null 2>&1; then
    print_error "Failed to fetch address information. Response: $address_response"
    exit 1
fi

# Check for API errors
if echo "$address_response" | jq -e '.error' >/dev/null 2>&1; then
    error_msg=$(echo "$address_response" | jq -r '.message // .error')
    print_error "API Error: $error_msg"
    exit 1
fi

stake_address=$(echo "$address_response" | jq -r '.stake_address // empty')

if [ -z "$stake_address" ] || [ "$stake_address" = "null" ]; then
    print_warn "No stake address found. This address may not have any transaction history."
    # Try to get transactions directly from the address
    print_info "Attempting to fetch transactions directly from address..."
    
    transactions_response=$(curl -s -H "project_id: $API_KEY" "$BLOCKFROST_API_URL/addresses/$ADDRESS/transactions")
    
    if ! echo "$transactions_response" | jq -e . >/dev/null 2>&1; then
        print_error "Failed to fetch transactions. Response: $transactions_response"
        exit 1
    fi
    
    transaction_count=$(echo "$transactions_response" | jq 'length')
    print_info "Found $transaction_count transactions for this address"
    
    if [ "$transaction_count" -eq 0 ]; then
        print_info "No transactions found for this address"
        exit 0
    fi
    
    echo "$transactions_response" | jq '.'
    exit 0
fi

print_info "Found stake address: $stake_address"

# Step 2: Get account information
print_info "Step 2: Getting account information..."
account_response=$(curl -s -H "project_id: $API_KEY" "$BLOCKFROST_API_URL/accounts/$stake_address")

if ! echo "$account_response" | jq -e . >/dev/null 2>&1; then
    print_error "Failed to fetch account information. Response: $account_response"
    exit 1
fi

# Check for API errors
if echo "$account_response" | jq -e '.error' >/dev/null 2>&1; then
    error_msg=$(echo "$account_response" | jq -r '.message // .error')
    print_error "API Error: $error_msg"
    exit 1
fi

controlled_amount=$(echo "$account_response" | jq -r '.controlled_amount')
ada_balance=$(echo "scale=6; $controlled_amount / 1000000" | bc)

print_info "Account balance: $ada_balance ADA ($controlled_amount lovelace)"

# Step 3: Get all payment addresses for the stake address
print_info "Step 3: Fetching all payment addresses for stake address..."

payment_addresses_response=$(curl -s -H "project_id: $API_KEY" "$BLOCKFROST_API_URL/accounts/$stake_address/addresses")

if ! echo "$payment_addresses_response" | jq -e . >/dev/null 2>&1; then
    print_error "Failed to fetch payment addresses. Response: $payment_addresses_response"
    exit 1
fi

# Check for API errors
if echo "$payment_addresses_response" | jq -e '.error' >/dev/null 2>&1; then
    error_msg=$(echo "$payment_addresses_response" | jq -r '.message // .error')
    print_error "API Error: $error_msg"
    exit 1
fi

# Extract payment addresses
payment_addresses=$(echo "$payment_addresses_response" | jq -r '.[].address')
address_count=$(echo "$payment_addresses" | wc -l)
print_info "Found $address_count payment addresses associated with stake address"

# Step 4: Get transactions for each payment address
print_info "Step 4: Fetching transactions for each payment address..."

all_tx_hashes=()

while IFS= read -r addr; do
    if [ -z "$addr" ] || [ "$addr" = "null" ]; then
        continue
    fi
    
    print_info "Fetching transactions for address: $addr"
    
    # Get all transactions for this address with pagination
    page=1
    count=100
    
    while true; do
        address_txs_response=$(curl -s -H "project_id: $API_KEY" \
            "$BLOCKFROST_API_URL/addresses/$addr/transactions?page=$page&count=$count&order=desc")
        
        if ! echo "$address_txs_response" | jq -e . >/dev/null 2>&1; then
            print_warn "Failed to fetch transactions for address $addr (page $page)"
            break
        fi
        
        # Check for API errors
        if echo "$address_txs_response" | jq -e '.error' >/dev/null 2>&1; then
            error_msg=$(echo "$address_txs_response" | jq -r '.message // .error')
            print_warn "API Error for address $addr: $error_msg"
            break
        fi
        
        page_count=$(echo "$address_txs_response" | jq 'length')
        
        if [ "$page_count" -eq 0 ]; then
            break
        fi
        
        # Extract transaction hashes
        page_tx_hashes=$(echo "$address_txs_response" | jq -r '.[].tx_hash')
        
        while IFS= read -r tx_hash; do
            if [ -n "$tx_hash" ] && [[ ! " ${all_tx_hashes[@]} " =~ " ${tx_hash} " ]]; then
                all_tx_hashes+=("$tx_hash")
            fi
        done <<< "$page_tx_hashes"
        
        print_info "Found $page_count transactions on page $page for address $addr"
        
        # If we got less than the full page size, we're done with this address
        if [ "$page_count" -lt "$count" ]; then
            break
        fi
        
        ((page++))
    done
    
done <<< "$payment_addresses"

total_transactions=${#all_tx_hashes[@]}
print_info "Total unique transactions found: $total_transactions"

if [ "$total_transactions" -eq 0 ]; then
    print_info "No transactions found for this address"
    exit 0
fi

# Step 5: Get detailed information for each transaction
print_info "Step 5: Fetching detailed transaction information..."

output_file="transactions_${ADDRESS}_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$output_file"

for i in "${!all_tx_hashes[@]}"; do
    tx_hash="${all_tx_hashes[$i]}"
    
    if [ -z "$tx_hash" ] || [ "$tx_hash" = "null" ]; then
        continue
    fi
    
    print_info "Fetching details for transaction $((i+1))/$total_transactions: $tx_hash"
    
    tx_details=$(curl -s -H "project_id: $API_KEY" "$BLOCKFROST_API_URL/txs/$tx_hash")
    
    if ! echo "$tx_details" | jq -e . >/dev/null 2>&1; then
        print_warn "Failed to fetch details for transaction $tx_hash"
        continue
    fi
    
    # Check for API errors
    if echo "$tx_details" | jq -e '.error' >/dev/null 2>&1; then
        print_warn "API Error for transaction $tx_hash: $(echo "$tx_details" | jq -r '.message // .error')"
        continue
    fi
    
    # Add transaction to output file
    tmp_file=$(mktemp)
    jq --argjson tx "$tx_details" '. += [$tx]' "$output_file" > "$tmp_file" && mv "$tmp_file" "$output_file"
done

print_info "Transaction details saved to: $output_file"
print_info "Summary:"
echo "  Address: $ADDRESS"
echo "  Stake Address: $stake_address"
echo "  Balance: $ada_balance ADA"
echo "  Total Transactions: $total_transactions"
echo "  Output File: $output_file"

# Display first few transactions as preview
print_info "Preview of first 3 transactions:"
jq '.[0:3] | .[] | {hash, block_time, fee, size}' "$output_file" 2>/dev/null || print_warn "Could not display preview"

print_info "Script completed successfully!"

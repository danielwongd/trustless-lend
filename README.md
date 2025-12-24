# Trustless Lend

Privacy-preserving ETH lending powered by Zama FHEVM. Users stake ETH, borrow cUSDT, repay, and withdraw while all sensitive amounts are kept encrypted on-chain.

## Table of Contents

- Overview
- The Problem
- The Solution
- Key Advantages
- Features
- Architecture
- Tech Stack
- Data and Privacy Model
- Repository Layout
- Getting Started
- Local Development
- Deployment
- Frontend Usage
- Testing
- Future Roadmap
- License

## Overview

Trustless Lend is a lending dApp that combines Ethereum smart contracts with Fully Homomorphic Encryption (FHE). The protocol keeps collateral and loan amounts confidential while still enforcing lending rules and safety checks on-chain. This protects users from leaking sensitive position sizes while preserving verifiable, non-custodial control.

## The Problem

Traditional on-chain lending exposes:

- Collateral and debt sizes, enabling copy-trading, liquidation targeting, and privacy loss.
- User behavior patterns that can be linked across wallets.
- Strategic lending data that competitors or malicious actors can exploit.

Users need credit access without publishing their exact financial positions to the public ledger.

## The Solution

Trustless Lend uses Zama FHEVM encrypted types to store and update balances and debts. The contract performs arithmetic and risk checks over ciphertext, so the chain never sees plaintext amounts. Users interact through a frontend that prepares encrypted inputs and submits them to the protocol.

## Key Advantages

- Confidential balances: stake and borrow amounts are encrypted on-chain.
- Trustless enforcement: loan rules are verified on-chain without revealing amounts.
- Reduced MEV surface: less actionable position data for observers.
- Non-custodial design: users retain control of funds through smart contracts.
- Transparent logic: contract code and rules remain publicly auditable.

## Features

- Stake ETH with encrypted accounting of collateral.
- Borrow cUSDT against encrypted collateral.
- Repay cUSDT to reduce encrypted debt.
- Withdraw ETH after repayment conditions are met.
- End-to-end encrypted flow using Zama FHEVM libraries.

## Architecture

1. Frontend collects user intent and prepares encrypted inputs.
2. Encrypted inputs are submitted to the lending contracts.
3. Contracts update encrypted balances and debts using FHEVM operations.
4. View and state transitions rely on encrypted data, avoiding plaintext leakage.

Supporting components:

- Zama FHEVM libraries for encrypted arithmetic and comparisons.
- A relayer/validation path for encrypted inputs as required by FHEVM.
- Hardhat tasks and deployment scripts for local and Sepolia deployments.

## Tech Stack

- Smart contracts: Solidity + Hardhat
- FHE: Zama FHEVM libraries and configuration
- Frontend: React + Vite
- Wallet/connectivity: Rainbow
- Read operations: viem
- Write operations: ethers
- Package manager: npm

## Data and Privacy Model

- Encrypted values are stored as ciphertext in contract state.
- Arithmetic and comparison operations are performed over ciphertext using FHEVM.
- The contract never stores or emits plaintext amounts for collateral or debt.
- Access control and business rules are enforced without requiring plaintext exposure.

## Repository Layout

- `contracts/`: Solidity contracts
- `deploy/`: Deployment scripts
- `tasks/`: Hardhat tasks
- `test/`: Test suite
- `ui/`: Frontend (React + Vite)
- `deployments/sepolia/`: Generated ABI and deployment artifacts
- `docs/`: Zama FHEVM and relayer references

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment Configuration (Hardhat)

Create a `.env` file for Hardhat with the following values:

```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
# Optional for verification
ETHERSCAN_API_KEY=your_etherscan_key
```

Notes:

- Deployments use a private key, not a mnemonic.
- The frontend does not use environment variables.

## Local Development

Compile contracts and run tests:

```bash
npx hardhat compile
npx hardhat test
```

Start a local node and deploy:

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

Local deployment is intended for contract testing. The frontend targets Sepolia and should not be configured to use localhost networks.

## Deployment

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

If you use contract verification:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend Usage

- The frontend lives in `ui/` and uses the existing layout and components.
- Copy the contract ABI from `deployments/sepolia/` into the frontend contract interface file.
- Update the frontend contract address constants to the Sepolia deployment.
- Read operations use viem; write operations use ethers.
- The frontend does not use localhost networks or localStorage.

## Testing

- Unit and integration tests live in `test/`.
- Run tests locally before deploying to Sepolia.

## Future Roadmap

- Dynamic interest rate model based on encrypted utilization.
- Encrypted liquidation thresholds with privacy-preserving alerts.
- Multi-collateral support beyond ETH.
- Improved UX for encrypted input generation and status tracking.
- Protocol-level risk parameters and governance controls.
- Extended audit coverage and formal verification of critical paths.

## License

See `LICENSE`.

import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, ethers } from 'ethers';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import {
  CUSDT_ABI,
  CUSDT_ADDRESS,
  TRUSTLESS_LEND_ABI,
  TRUSTLESS_LEND_ADDRESS,
} from '../config/contracts';
import '../styles/Home.css';

// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

type DecryptedPosition = {
  stake: string;
  debt: string;
  balance: string;
};

export function Home() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isPending, setIsPending] = useState({
    stake: false,
    withdraw: false,
    borrow: false,
    repay: false,
    decrypt: false,
  });
  const [decrypted, setDecrypted] = useState<DecryptedPosition | null>(null);

  const isConfigured =
    true;

  const readEnabled = Boolean(isConfigured && address);

  const { data: encryptedStake, refetch: refetchStake } = useReadContract({
    address: TRUSTLESS_LEND_ADDRESS,
    abi: TRUSTLESS_LEND_ABI,
    functionName: 'encryptedStakeOf',
    args: address ? [address] : undefined,
    query: { enabled: readEnabled },
  });

  const { data: encryptedDebt, refetch: refetchDebt } = useReadContract({
    address: TRUSTLESS_LEND_ADDRESS,
    abi: TRUSTLESS_LEND_ABI,
    functionName: 'encryptedDebtOf',
    args: address ? [address] : undefined,
    query: { enabled: readEnabled },
  });

  const { data: encryptedBalance, refetch: refetchBalance } = useReadContract({
    address: CUSDT_ADDRESS,
    abi: CUSDT_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: readEnabled },
  });

  const stakeHandle = useMemo(() => (typeof encryptedStake === 'string' ? encryptedStake : ''), [encryptedStake]);
  const debtHandle = useMemo(() => (typeof encryptedDebt === 'string' ? encryptedDebt : ''), [encryptedDebt]);
  const balanceHandle = useMemo(
    () => (typeof encryptedBalance === 'string' ? encryptedBalance : ''),
    [encryptedBalance],
  );

  const refreshReads = () => {
    void refetchStake();
    void refetchDebt();
    void refetchBalance();
  };

  const handleStake = async () => {
    setStatusMessage('');
    if (!isConfigured || !address || !signerPromise) {
      setStatusMessage('Connect a wallet and configure contract addresses first.');
      return;
    }

    let value: bigint;
    try {
      value = ethers.parseEther(stakeAmount || '0');
    } catch {
      setStatusMessage('Enter a valid ETH amount.');
      return;
    }

    if (value <= 0n) {
      setStatusMessage('Stake amount must be greater than zero.');
      return;
    }

    try {
      setIsPending(prev => ({ ...prev, stake: true }));
      const signer = await signerPromise;
      if (!signer) {
        setStatusMessage('Wallet signer not available.');
        return;
      }

      const contract = new Contract(TRUSTLESS_LEND_ADDRESS, TRUSTLESS_LEND_ABI, signer);
      const tx = await contract.stake({ value });
      setStatusMessage(`Stake submitted: ${tx.hash}`);
      await tx.wait();
      setStakeAmount('');
      setDecrypted(null);
      refreshReads();
      setStatusMessage('Stake confirmed on-chain.');
    } catch (error) {
      setStatusMessage(
        `Stake failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPending(prev => ({ ...prev, stake: false }));
    }
  };

  const handleWithdraw = async () => {
    setStatusMessage('');
    if (!isConfigured || !address || !signerPromise) {
      setStatusMessage('Connect a wallet and configure contract addresses first.');
      return;
    }

    let value: bigint;
    try {
      value = ethers.parseEther(withdrawAmount || '0');
    } catch {
      setStatusMessage('Enter a valid ETH amount.');
      return;
    }

    if (value <= 0n) {
      setStatusMessage('Withdraw amount must be greater than zero.');
      return;
    }

    try {
      setIsPending(prev => ({ ...prev, withdraw: true }));
      const signer = await signerPromise;
      if (!signer) {
        setStatusMessage('Wallet signer not available.');
        return;
      }

      const contract = new Contract(TRUSTLESS_LEND_ADDRESS, TRUSTLESS_LEND_ABI, signer);
      const tx = await contract.withdraw(value);
      setStatusMessage(`Withdraw submitted: ${tx.hash}`);
      await tx.wait();
      setWithdrawAmount('');
      setDecrypted(null);
      refreshReads();
      setStatusMessage('Withdraw confirmed on-chain.');
    } catch (error) {
      setStatusMessage(
        `Withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPending(prev => ({ ...prev, withdraw: false }));
    }
  };

  const handleBorrow = async () => {
    setStatusMessage('');
    if (!isConfigured || !address || !signerPromise || !instance) {
      setStatusMessage('Connect a wallet and wait for encryption service.');
      return;
    }

    let value: bigint;
    try {
      value = ethers.parseUnits(borrowAmount || '0', 6);
    } catch {
      setStatusMessage('Enter a valid cUSDT amount.');
      return;
    }

    if (value <= 0n) {
      setStatusMessage('Borrow amount must be greater than zero.');
      return;
    }

    try {
      setIsPending(prev => ({ ...prev, borrow: true }));
      const signer = await signerPromise;
      if (!signer) {
        setStatusMessage('Wallet signer not available.');
        return;
      }

      const input = instance.createEncryptedInput(TRUSTLESS_LEND_ADDRESS, address);
      input.add64(value);
      const encryptedInput = await input.encrypt();

      const contract = new Contract(TRUSTLESS_LEND_ADDRESS, TRUSTLESS_LEND_ABI, signer);
      const tx = await contract.borrow(encryptedInput.handles[0], encryptedInput.inputProof);
      setStatusMessage(`Borrow submitted: ${tx.hash}`);
      await tx.wait();
      setBorrowAmount('');
      setDecrypted(null);
      refreshReads();
      setStatusMessage('Borrow confirmed on-chain.');
    } catch (error) {
      setStatusMessage(
        `Borrow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPending(prev => ({ ...prev, borrow: false }));
    }
  };

  const handleRepay = async () => {
    setStatusMessage('');
    if (!isConfigured || !address || !signerPromise || !instance) {
      setStatusMessage('Connect a wallet and wait for encryption service.');
      return;
    }

    let value: bigint;
    try {
      value = ethers.parseUnits(repayAmount || '0', 6);
    } catch {
      setStatusMessage('Enter a valid cUSDT amount.');
      return;
    }

    if (value <= 0n) {
      setStatusMessage('Repay amount must be greater than zero.');
      return;
    }

    try {
      setIsPending(prev => ({ ...prev, repay: true }));
      const signer = await signerPromise;
      if (!signer) {
        setStatusMessage('Wallet signer not available.');
        return;
      }

      const input = instance.createEncryptedInput(TRUSTLESS_LEND_ADDRESS, address);
      input.add64(value);
      const encryptedInput = await input.encrypt();

      const contract = new Contract(TRUSTLESS_LEND_ADDRESS, TRUSTLESS_LEND_ABI, signer);
      const tx = await contract.repay(encryptedInput.handles[0], encryptedInput.inputProof);
      setStatusMessage(`Repay submitted: ${tx.hash}`);
      await tx.wait();
      setRepayAmount('');
      setDecrypted(null);
      refreshReads();
      setStatusMessage('Repay confirmed on-chain.');
    } catch (error) {
      setStatusMessage(
        `Repay failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPending(prev => ({ ...prev, repay: false }));
    }
  };

  const handleDecrypt = async () => {
    setStatusMessage('');
    if (!isConfigured || !address || !signerPromise || !instance) {
      setStatusMessage('Connect a wallet and wait for encryption service.');
      return;
    }

    try {
      setIsPending(prev => ({ ...prev, decrypt: true }));
      const signer = await signerPromise;
      if (!signer) {
        setStatusMessage('Wallet signer not available.');
        return;
      }

      const handlePairs: { handle: string; contractAddress: string }[] = [];
      if (stakeHandle && stakeHandle !== ZERO_HANDLE) {
        handlePairs.push({ handle: stakeHandle, contractAddress: TRUSTLESS_LEND_ADDRESS });
      }
      if (debtHandle && debtHandle !== ZERO_HANDLE) {
        handlePairs.push({ handle: debtHandle, contractAddress: TRUSTLESS_LEND_ADDRESS });
      }
      if (balanceHandle && balanceHandle !== ZERO_HANDLE) {
        handlePairs.push({ handle: balanceHandle, contractAddress: CUSDT_ADDRESS });
      }

      if (handlePairs.length === 0) {
        setDecrypted({ stake: '0', debt: '0', balance: '0' });
        setStatusMessage('No encrypted values to decrypt yet.');
        return;
      }

      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [TRUSTLESS_LEND_ADDRESS, CUSDT_ADDRESS];
      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays,
      );

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handlePairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const stakeValue = stakeHandle && result[stakeHandle] ? BigInt(result[stakeHandle]) : 0n;
      const debtValue = debtHandle && result[debtHandle] ? BigInt(result[debtHandle]) : 0n;
      const balanceValue = balanceHandle && result[balanceHandle] ? BigInt(result[balanceHandle]) : 0n;

      setDecrypted({
        stake: ethers.formatEther(stakeValue),
        debt: ethers.formatUnits(debtValue, 6),
        balance: ethers.formatUnits(balanceValue, 6),
      });
    } catch (error) {
      setStatusMessage(
        `Decrypt failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsPending(prev => ({ ...prev, decrypt: false }));
    }
  };

  const walletLabel = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';

  return (
    <div className="home">
      <Header />
      <main className="home-main">
        <section className="hero">
          <div className="hero-content">
            <div className="hero-copy">
              <p className="eyebrow">Encrypted lending on Sepolia</p>
              <h2 className="hero-title">Protect your position while you borrow.</h2>
              <p className="hero-subtitle">
                Stake ETH, mint confidential cUSDT, and keep balances private with Zama FHE.
              </p>
              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={handleDecrypt}
                  disabled={!isConfigured || !isConnected || isPending.decrypt || zamaLoading}
                >
                  {isPending.decrypt ? 'Decrypting...' : 'Decrypt position'}
                </button>
                <button className="ghost-button" onClick={refreshReads} disabled={!readEnabled}>
                  Refresh data
                </button>
              </div>
              {zamaError && <p className="status-text">Encryption error: {zamaError}</p>}
              {!isConfigured && (
                <p className="status-text">
                  Contract addresses are not configured. Update `ui/src/config/contracts.ts`.
                </p>
              )}
            </div>

            <div className="hero-card">
              <div className="hero-card-header">
                <p className="card-kicker">Your position</p>
                <span className="chip">{walletLabel}</span>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <span className="metric-label">Staked ETH</span>
                  <span className="metric-value">
                    {decrypted ? `${decrypted.stake} ETH` : 'Encrypted'}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Debt (cUSDT)</span>
                  <span className="metric-value">
                    {decrypted ? `${decrypted.debt} cUSDT` : 'Encrypted'}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">cUSDT Balance</span>
                  <span className="metric-value">
                    {decrypted ? `${decrypted.balance} cUSDT` : 'Encrypted'}
                  </span>
                </div>
              </div>

              <div className="handle-grid">
                <div>
                  <p className="handle-label">Stake handle</p>
                  <p className="handle-value">{stakeHandle ? stakeHandle.slice(0, 18) + '...' : '--'}</p>
                </div>
                <div>
                  <p className="handle-label">Debt handle</p>
                  <p className="handle-value">{debtHandle ? debtHandle.slice(0, 18) + '...' : '--'}</p>
                </div>
                <div>
                  <p className="handle-label">Balance handle</p>
                  <p className="handle-value">
                    {balanceHandle ? balanceHandle.slice(0, 18) + '...' : '--'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="action-grid">
          <div className="action-card">
            <h3>Stake ETH</h3>
            <p className="card-text">Deposit ETH and store the amount as encrypted collateral.</p>
            <div className="field-row">
              <input
                value={stakeAmount}
                onChange={event => setStakeAmount(event.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
              <span>ETH</span>
            </div>
            <button
              className="primary-button"
              onClick={handleStake}
              disabled={!isConfigured || !isConnected || isPending.stake}
            >
              {isPending.stake ? 'Staking...' : 'Stake ETH'}
            </button>
          </div>

          <div className="action-card">
            <h3>Borrow cUSDT</h3>
            <p className="card-text">Mint encrypted cUSDT against your collateral.</p>
            <div className="field-row">
              <input
                value={borrowAmount}
                onChange={event => setBorrowAmount(event.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
              <span>cUSDT</span>
            </div>
            <button
              className="primary-button"
              onClick={handleBorrow}
              disabled={!isConfigured || !isConnected || isPending.borrow || zamaLoading}
            >
              {isPending.borrow ? 'Borrowing...' : 'Borrow cUSDT'}
            </button>
          </div>

          <div className="action-card">
            <h3>Repay cUSDT</h3>
            <p className="card-text">Burn cUSDT with encrypted repayment amounts.</p>
            <div className="field-row">
              <input
                value={repayAmount}
                onChange={event => setRepayAmount(event.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
              <span>cUSDT</span>
            </div>
            <button
              className="primary-button"
              onClick={handleRepay}
              disabled={!isConfigured || !isConnected || isPending.repay || zamaLoading}
            >
              {isPending.repay ? 'Repaying...' : 'Repay cUSDT'}
            </button>
          </div>

          <div className="action-card">
            <h3>Withdraw ETH</h3>
            <p className="card-text">Withdraw unlocked ETH from your stake.</p>
            <div className="field-row">
              <input
                value={withdrawAmount}
                onChange={event => setWithdrawAmount(event.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
              <span>ETH</span>
            </div>
            <button
              className="primary-button"
              onClick={handleWithdraw}
              disabled={!isConfigured || !isConnected || isPending.withdraw}
            >
              {isPending.withdraw ? 'Withdrawing...' : 'Withdraw ETH'}
            </button>
          </div>
        </section>

        <section className="status-panel">
          <div>
            <h3>Status</h3>
            <p className="status-text">
              {statusMessage || 'Ready. Use the controls above to interact with the protocol.'}
            </p>
          </div>
          <div className="status-badges">
            <span className={`status-chip ${isConnected ? 'chip-live' : 'chip-muted'}`}>
              {isConnected ? 'Wallet connected' : 'Wallet not connected'}
            </span>
            <span className={`status-chip ${zamaLoading ? 'chip-muted' : 'chip-live'}`}>
              {zamaLoading ? 'Encrypting service loading' : 'Encryption ready'}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Trustless Lend',
  projectId: 'YOUR_PROJECT_ID', // Set via https://cloud.walletconnect.com
  chains: [sepolia],
  ssr: false,
});

/**
 * abis.ts
 *
 * ABI definitions for RemittanceStable and RemittanceEscrow.
 */

export const REMITTANCE_STABLE_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function mint(address to, uint256 amount, string transferId)",
  "function burnFrom(address from, uint256 amount, string transferId)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",
  "event Minted(address indexed to, uint256 amount, string transferId)",
  "event Burned(address indexed from, uint256 amount, string transferId)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const REMITTANCE_ESCROW_ABI = [
  "function getKey(string transferId) pure returns (bytes32)",
  "function getState(string transferId) view returns (uint8)",
  "function token() view returns (address)",
  "function lock(string transferId, address sender, address receiver, uint256 amount)",
  "function release(string transferId)",
  "function refund(string transferId)",
  "function escrows(bytes32) view returns (address sender, address receiver, uint256 amount, uint8 state)",
  "event Locked(bytes32 indexed transferKey, string transferId, address indexed sender, address indexed receiver, uint256 amount)",
  "event Released(bytes32 indexed transferKey, string transferId, address indexed receiver, uint256 amount)",
  "event Refunded(bytes32 indexed transferKey, string transferId, address indexed sender, uint256 amount)"
];

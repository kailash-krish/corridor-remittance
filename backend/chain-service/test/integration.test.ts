import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainService } from "../src/chainService";
import { encrypt, decrypt } from "../src/crypto";
import {
  minorUnitsToTokenUnits,
  tokenUnitsToMinorUnits,
  formatTokenUnits,
} from "../src/conversion";
import { config } from "../src/config";

describe("Chain Service End-to-End Integration Tests", () => {
  let chainService: ChainService;
  let tokenContract: any;
  let escrowContract: any;
  let admin: any;

  before(async () => {
    [admin] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("RemittanceStable");
    tokenContract = await TokenFactory.deploy(admin.address);
    await tokenContract.waitForDeployment();
    const tokenAddress = await tokenContract.getAddress();

    const EscrowFactory = await ethers.getContractFactory("RemittanceEscrow");
    escrowContract = await EscrowFactory.deploy(admin.address, tokenAddress);
    await escrowContract.waitForDeployment();
    const escrowAddress = await escrowContract.getAddress();

    chainService = new ChainService({
      provider: ethers.provider,
      adminSigner: admin,
      tokenAddress,
      escrowAddress,
    });
  });

  describe("Unit Conversions", () => {
    it("should correctly convert 100 AED (10,000 fils) to 100,000,000 token units", () => {
      const fils = 10_000; // 100 AED
      const tokens = minorUnitsToTokenUnits(fils);
      expect(tokens).to.equal(100_000_000n);
      expect(tokenUnitsToMinorUnits(tokens)).to.equal(fils);
      expect(formatTokenUnits(tokens)).to.equal("100.000000");
    });

    it("should throw for negative amounts", () => {
      expect(() => minorUnitsToTokenUnits(-100)).to.throw("Amount must be non-negative");
    });
  });

  describe("Custodial Key Encryption (AES-256-GCM)", () => {
    it("should encrypt and decrypt private keys securely", () => {
      const dummyKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
      const cipher = encrypt(dummyKey, config.MASTER_ENCRYPTION_KEY);
      expect(cipher).to.not.equal(dummyKey);

      const recovered = decrypt(cipher, config.MASTER_ENCRYPTION_KEY);
      expect(recovered).to.equal(dummyKey);
    });

    it("should fail decryption if ciphertext is tampered with", () => {
      const cipher = encrypt("secret-key", config.MASTER_ENCRYPTION_KEY);
      const parts = cipher.split(":");
      // tamper ciphertext
      const tampered = `${parts[0]}:deadbeef${parts[1].slice(8)}:${parts[2]}`;
      expect(() => decrypt(tampered, config.MASTER_ENCRYPTION_KEY)).to.throw();
    });
  });

  describe("Full Remittance Happy Path (Mint -> Lock -> Release -> Burn)", () => {
    const transferId = "tx-integration-happy-1";
    const senderUserId = "user-uae-100";
    const receiverUserId = "user-ind-200";
    const amountMinor = 50_000; // 500.00 AED

    it("Step 1: mintStable to sender custodial wallet", async () => {
      const receipt = await chainService.mintStable(transferId, senderUserId, amountMinor);
      expect(receipt.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);

      // Verify idempotency cache
      const receiptCached = await chainService.mintStable(transferId, senderUserId, amountMinor);
      expect(receiptCached.txHash).to.equal(receipt.txHash);
    });

    it("Step 2: lockForTransfer into escrow", async () => {
      const receipt = await chainService.lockForTransfer(
        transferId,
        senderUserId,
        receiverUserId,
        amountMinor
      );
      expect(receipt.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);

      const state = await chainService.getEscrowState(transferId);
      expect(state).to.equal(1); // 1 = LOCKED
    });

    it("Step 3: releaseToReceiver upon off-chain payout confirmation", async () => {
      const receipt = await chainService.releaseToReceiver(transferId);
      expect(receipt.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);

      const state = await chainService.getEscrowState(transferId);
      expect(state).to.equal(2); // 2 = RELEASED
    });

    it("Step 4: burnStable from receiver wallet to finalize lifecycle", async () => {
      const receipt = await chainService.burnStable(transferId, receiverUserId, amountMinor);
      expect(receipt.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("Remittance Failure & Refund Path (Mint -> Lock -> Refund)", () => {
    const transferId = "tx-integration-refund-1";
    const senderUserId = "user-uae-300";
    const receiverUserId = "user-ind-400";
    const amountMinor = 25_000; // 250.00 AED

    it("should execute Mint -> Lock -> Refund lifecycle", async () => {
      // 1. Mint
      await chainService.mintStable(transferId, senderUserId, amountMinor);

      // 2. Lock
      await chainService.lockForTransfer(transferId, senderUserId, receiverUserId, amountMinor);
      expect(await chainService.getEscrowState(transferId)).to.equal(1); // LOCKED

      // 3. Refund
      const receipt = await chainService.refund(transferId);
      expect(receipt.txHash).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(await chainService.getEscrowState(transferId)).to.equal(3); // REFUNDED
    });
  });
});

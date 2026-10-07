import { expect } from "chai";
import { ethers } from "hardhat";
import { RemittanceStable, RemittanceEscrow } from "../typechain-types";

describe("RemittanceEscrow Contract", () => {
  let token: RemittanceStable;
  let escrow: RemittanceEscrow;
  let admin: any;
  let sender: any;
  let receiver: any;
  const transferId = "tx-escrow-1001";
  const amount = 50_000_000n; // 50 RMTS

  beforeEach(async () => {
    [admin, sender, receiver] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("RemittanceStable");
    token = (await TokenFactory.deploy(admin.address)) as RemittanceStable;
    await token.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("RemittanceEscrow");
    escrow = (await EscrowFactory.deploy(admin.address, await token.getAddress())) as RemittanceEscrow;
    await escrow.waitForDeployment();

    // Mint tokens to sender and sender approves escrow
    await token.mint(sender.address, amount, transferId);
    await token.connect(sender).approve(await escrow.getAddress(), amount);
  });

  it("should successfully lock funds in escrow", async () => {
    const key = await escrow.getKey(transferId);

    await expect(
      escrow.lock(transferId, sender.address, receiver.address, amount)
    )
      .to.emit(escrow, "Locked")
      .withArgs(key, transferId, sender.address, receiver.address, amount);

    expect(await escrow.getState(transferId)).to.equal(1); // 1 = LOCKED
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
  });

  it("should prevent locking the same transferId twice (on-chain idempotency)", async () => {
    await escrow.lock(transferId, sender.address, receiver.address, amount);

    await expect(
      escrow.lock(transferId, sender.address, receiver.address, amount)
    ).to.be.revertedWith("Escrow: already locked");
  });

  it("should release locked funds to receiver", async () => {
    await escrow.lock(transferId, sender.address, receiver.address, amount);

    const key = await escrow.getKey(transferId);
    await expect(escrow.release(transferId))
      .to.emit(escrow, "Released")
      .withArgs(key, transferId, receiver.address, amount);

    expect(await escrow.getState(transferId)).to.equal(2); // 2 = RELEASED
    expect(await token.balanceOf(receiver.address)).to.equal(amount);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("should refund locked funds back to sender", async () => {
    await escrow.lock(transferId, sender.address, receiver.address, amount);

    const key = await escrow.getKey(transferId);
    await expect(escrow.refund(transferId))
      .to.emit(escrow, "Refunded")
      .withArgs(key, transferId, sender.address, amount);

    expect(await escrow.getState(transferId)).to.equal(3); // 3 = REFUNDED
    expect(await token.balanceOf(sender.address)).to.equal(amount);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("should reject release or refund if not in LOCKED state", async () => {
    await expect(escrow.release("nonexistent-tx")).to.be.revertedWith("Escrow: not locked");
    await expect(escrow.refund("nonexistent-tx")).to.be.revertedWith("Escrow: not locked");
  });
});

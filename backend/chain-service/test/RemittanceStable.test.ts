import { expect } from "chai";
import { ethers } from "hardhat";
import { RemittanceStable } from "../typechain-types";

describe("RemittanceStable Contract", () => {
  let token: RemittanceStable;
  let admin: any;
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    [admin, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RemittanceStable");
    token = await Factory.deploy(admin.address) as RemittanceStable;
    await token.waitForDeployment();
  });

  it("should initialize with correct name, symbol, and 6 decimals", async () => {
    expect(await token.name()).to.equal("Remittance Stable");
    expect(await token.symbol()).to.equal("RMTS");
    expect(await token.decimals()).to.equal(6);
  });

  it("should allow MINTER_ROLE to mint tokens", async () => {
    const mintAmount = 100_000_000n; // 100 RMTS
    await expect(token.mint(user1.address, mintAmount, "tx-123"))
      .to.emit(token, "Minted")
      .withArgs(user1.address, mintAmount, "tx-123");

    expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
  });

  it("should prevent non-minters from minting", async () => {
    await expect(
      token.connect(user1).mint(user1.address, 1000n, "tx-unauth")
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("should allow BURNER_ROLE to burn tokens", async () => {
    const amount = 50_000_000n;
    await token.mint(user1.address, amount, "tx-1");
    expect(await token.balanceOf(user1.address)).to.equal(amount);

    await expect(token.burnFrom(user1.address, amount, "tx-1"))
      .to.emit(token, "Burned")
      .withArgs(user1.address, amount, "tx-1");

    expect(await token.balanceOf(user1.address)).to.equal(0n);
  });

  it("should pause and unpause transfers", async () => {
    const amount = 10_000_000n;
    await token.mint(user1.address, amount, "tx-pause-1");

    await token.pause();
    expect(await token.paused()).to.be.true;

    await expect(
      token.connect(user1).transfer(user2.address, 1000n)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");

    await token.unpause();
    expect(await token.paused()).to.be.false;

    await expect(token.connect(user1).transfer(user2.address, 1000n)).to.not.be.reverted;
    expect(await token.balanceOf(user2.address)).to.equal(1000n);
  });
});

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("UniversalClaimLinks", function () {
  const STATUS_OPEN = 0n;
  const STATUS_EXECUTED = 1n;
  const STATUS_CANCELLED = 2n;

  async function deployFixture() {
    const [deployer, sender, receiver] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const rif = await MockERC20.deploy("RIF", "RIF");
    const usdrif = await MockERC20.deploy("USDRIF", "USDRIF");

    const UniversalClaimLinks = await ethers.getContractFactory("UniversalClaimLinks");
    const claimLinks = await UniversalClaimLinks.deploy(await rif.getAddress(), await usdrif.getAddress());

    const amount = ethers.parseEther("1");
    await rif.mint(sender.address, amount);
    await rif.mint(sender.address, ethers.parseEther("1000000"));
    await usdrif.mint(sender.address, ethers.parseEther("1000000"));

    return { deployer, sender, receiver, rif, usdrif, claimLinks, amount };
  }

  it("creates a claim and escrows tokens", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    await rif.connect(sender).approve(await claimLinks.getAddress(), amount);

    await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

    const c = await claimLinks.getClaim(1n);
    expect(c.amountIn).to.equal(amount);
    expect(c.expiry).to.equal(expiry);
    expect(c.status).to.equal(STATUS_OPEN);
    expect(c.sender).to.equal(sender.address);
    expect(c.receiver).to.equal(receiver.address);
    expect(c.tokenIn).to.equal(await rif.getAddress());

    expect(await rif.balanceOf(await claimLinks.getAddress())).to.equal(amount);
  });

  it("executes a claim once and pays the chosen output token (same token 1:1)", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;
    const expectedRifOut = amount;

    await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

    const before = await rif.balanceOf(receiver.address);
    await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());

    expect((await rif.balanceOf(receiver.address)) - before).to.equal(expectedRifOut);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_EXECUTED);
  });

  it("executes native claim into RIF at RBTC→RIF rate", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;
    const expectedRifOut = (amount * 50_000n * 10n ** 18n) / 10n ** 18n;

    await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });
    await rif.mint(await claimLinks.getAddress(), expectedRifOut);

    const before = await rif.balanceOf(receiver.address);
    await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());
    expect((await rif.balanceOf(receiver.address)) - before).to.equal(expectedRifOut);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_EXECUTED);
  });

  it("executes native claim into native RBTC (1:1)", async function () {
    const { sender, receiver, claimLinks, amount } = await deployFixture();
    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });

    const before = await ethers.provider.getBalance(receiver.address);
    await claimLinks.connect(receiver).executeClaim(1n, ethers.ZeroAddress);
    const after = await ethers.provider.getBalance(receiver.address);

    expect(after > before).to.equal(true);
  });

  it("executes RIF claim into native RBTC at RIF→RBTC rate (requires RBTC liquidity)", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    // Use a large RIF input so RBTC payout exceeds receiver gas costs.
    const bigAmount = ethers.parseEther("100000");
    await rif.connect(sender).approve(await claimLinks.getAddress(), bigAmount);
    await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), bigAmount, expiry);

    // Provide RBTC liquidity to pay out.
    const expectedRbtcOut = (bigAmount * 20_000_000_000_000n) / 10n ** 18n; // amount * RATE_RIF_TO_RBTC / 1e18
    await sender.sendTransaction({ to: await claimLinks.getAddress(), value: expectedRbtcOut });

    const before = await ethers.provider.getBalance(receiver.address);
    await claimLinks.connect(receiver).executeClaim(1n, ethers.ZeroAddress);
    const after = await ethers.provider.getBalance(receiver.address);
    expect(after > before).to.equal(true);
  });

  it("reverts on second execute (double claim)", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

    await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());

    let threw = false;
    try {
      await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("after expiry: receiver cannot execute; sender can cancel and reclaim", async function () {
    const { sender, receiver, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 100n;

    await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

    await time.increaseTo(expiry + 1n);

    let threw = false;
    try {
      await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);

    const before = await rif.balanceOf(sender.address);
    await claimLinks.connect(sender).cancelClaim(1n);

    expect((await rif.balanceOf(sender.address)) - before).to.equal(amount);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_CANCELLED);

    threw = false;
    try {
      await claimLinks.connect(sender).cancelClaim(1n);
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("creates a claim with native coin via createClaimNative (escrows RBTC, tokenIn is zero)", async function () {
    const { sender, receiver, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    const addr = await claimLinks.getAddress();

    await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });

    expect(await ethers.provider.getBalance(addr)).to.equal(amount);

    const c = await claimLinks.getClaim(1n);
    expect(c.tokenIn).to.equal(ethers.ZeroAddress);
    expect(c.amountIn).to.equal(amount);
  });

  it("after expiry: cancelClaim refunds native escrow to sender", async function () {
    const { sender, receiver, claimLinks, amount } = await deployFixture();
    const addr = await claimLinks.getAddress();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 100n;

    await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });

    await time.increaseTo(expiry + 1n);

    const before = await ethers.provider.getBalance(sender.address);
    await claimLinks.connect(sender).cancelClaim(1n);

    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_CANCELLED);

    const after = await ethers.provider.getBalance(sender.address);
    if (!(after > before)) {
      throw new Error("expected sender balance to increase after native refund (net of gas)");
    }
    if (!(after <= before + amount)) {
      throw new Error("expected refund not to exceed escrowed amount (gas deducted)");
    }
  });
});

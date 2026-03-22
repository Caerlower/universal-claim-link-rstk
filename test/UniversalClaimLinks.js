const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("UniversalClaimLinks", function () {
  const STATUS_OPEN = 0;
  const STATUS_EXECUTED = 1;
  const STATUS_CANCELLED = 2;

  async function deployFixture() {
    const [deployer, sender, receiver] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wrbtc = await MockERC20.deploy("Wrapped RBTC", "WRBTC");
    const rif = await MockERC20.deploy("RIF", "RIF");
    const usdrif = await MockERC20.deploy("USDRIF", "USDRIF");

    const UniversalClaimLinks = await ethers.getContractFactory("UniversalClaimLinks");
    const claimLinks = await UniversalClaimLinks.deploy(
      await wrbtc.getAddress(),
      await rif.getAddress(),
      await usdrif.getAddress()
    );

    const amount = ethers.parseEther("1");
    await wrbtc.mint(sender.address, amount);
    await rif.mint(sender.address, ethers.parseEther("1000000"));
    await usdrif.mint(sender.address, ethers.parseEther("1000000"));

    return { deployer, sender, receiver, wrbtc, rif, usdrif, claimLinks, amount };
  }

  it("creates a claim and escrows tokens", async function () {
    const { sender, receiver, wrbtc, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    await wrbtc.connect(sender).approve(await claimLinks.getAddress(), amount);

    await expect(
      claimLinks.connect(sender).createClaim(receiver.address, await wrbtc.getAddress(), amount, expiry)
    )
      .to.emit(claimLinks, "ClaimCreated")
      .withArgs(1n, sender.address, receiver.address, await wrbtc.getAddress(), amount, expiry);

    const c = await claimLinks.getClaim(1n);
    expect(c.amountIn).to.equal(amount);
    expect(c.expiry).to.equal(expiry);
    expect(c.status).to.equal(STATUS_OPEN);
    expect(c.sender).to.equal(sender.address);
    expect(c.receiver).to.equal(receiver.address);
    expect(c.tokenIn).to.equal(await wrbtc.getAddress());

    expect(await wrbtc.balanceOf(await claimLinks.getAddress())).to.equal(amount);
  });

  it("executes a claim once and pays the chosen output token", async function () {
    const { sender, receiver, wrbtc, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;
    const expectedRifOut = (amount * 50_000n * 10n ** 18n) / 10n ** 18n;

    await wrbtc.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await wrbtc.getAddress(), amount, expiry);

    await rif.mint(await claimLinks.getAddress(), expectedRifOut);

    const before = await rif.balanceOf(receiver.address);
    await expect(claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress()))
      .to.emit(claimLinks, "ClaimExecuted")
      .withArgs(
        1n,
        receiver.address,
        await wrbtc.getAddress(),
        await rif.getAddress(),
        amount,
        expectedRifOut
      );

    expect(await rif.balanceOf(receiver.address) - before).to.equal(expectedRifOut);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_EXECUTED);
  });

  it("reverts on second execute (double claim)", async function () {
    const { sender, receiver, wrbtc, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;
    const expectedRifOut = (amount * 50_000n * 10n ** 18n) / 10n ** 18n;

    await wrbtc.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await wrbtc.getAddress(), amount, expiry);
    await rif.mint(await claimLinks.getAddress(), expectedRifOut * 2n);

    await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());

    await expect(claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress())).to.be.revertedWithCustomError(
      claimLinks,
      "NotOpen"
    );
  });

  it("after expiry: receiver cannot execute; sender can cancel and reclaim", async function () {
    const { sender, receiver, wrbtc, rif, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 100n;

    await wrbtc.connect(sender).approve(await claimLinks.getAddress(), amount);
    await claimLinks.connect(sender).createClaim(receiver.address, await wrbtc.getAddress(), amount, expiry);

    await time.increaseTo(expiry + 1n);

    await expect(claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress())).to.be.revertedWithCustomError(
      claimLinks,
      "ClaimExpired"
    );

    const before = await wrbtc.balanceOf(sender.address);
    await expect(claimLinks.connect(sender).cancelClaim(1n))
      .to.emit(claimLinks, "ClaimCancelled")
      .withArgs(1n, sender.address, await wrbtc.getAddress(), amount);

    expect(await wrbtc.balanceOf(sender.address) - before).to.equal(amount);
    expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_CANCELLED);

    await expect(claimLinks.connect(sender).cancelClaim(1n)).to.be.revertedWithCustomError(claimLinks, "NotOpen");
  });

  it("creates a claim with native coin via createClaimNative (wraps into WRBTC mock)", async function () {
    const { sender, receiver, wrbtc, claimLinks, amount } = await deployFixture();

    const latest = await time.latest();
    const expiry = BigInt(latest) + 3600n;

    await expect(
      claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount })
    )
      .to.emit(claimLinks, "ClaimCreated")
      .withArgs(1n, sender.address, receiver.address, await wrbtc.getAddress(), amount, expiry);

    expect(await wrbtc.balanceOf(await claimLinks.getAddress())).to.equal(amount);
  });
});

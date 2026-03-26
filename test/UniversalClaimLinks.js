const { ethers } = require("hardhat");
const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("UniversalClaimLinks", function () {
  const STATUS_OPEN = 0n;
  const STATUS_EXECUTED = 1n;
  const STATUS_CANCELLED = 2n;

  async function deployFixture() {
    const [deployer, sender, receiver, stranger] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const rif = await MockERC20.deploy("RIF", "RIF");
    const usdrif = await MockERC20.deploy("USDRIF", "USDRIF");

    const UniversalClaimLinks = await ethers.getContractFactory("UniversalClaimLinks");
    const claimLinks = await UniversalClaimLinks.deploy(
      await rif.getAddress(),
      await usdrif.getAddress()
    );

    const amount = ethers.parseEther("1");
    await rif.mint(sender.address, ethers.parseEther("1000000"));
    await usdrif.mint(sender.address, ethers.parseEther("1000000"));

    return { deployer, sender, receiver, stranger, rif, usdrif, claimLinks, amount };
  }

  // ─── createClaim ────────────────────────────────────────────────────────────

  describe("createClaim", function () {
    it("escrows tokens and stores claim correctly", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(
        receiver.address, await rif.getAddress(), amount, expiry
      );

      const c = await claimLinks.getClaim(1n);
      expect(c.amountIn).to.equal(amount);
      expect(c.expiry).to.equal(expiry);
      expect(c.status).to.equal(STATUS_OPEN);
      expect(c.sender).to.equal(sender.address);
      expect(c.receiver).to.equal(receiver.address);
      expect(c.tokenIn).to.equal(await rif.getAddress());
      expect(await rif.balanceOf(await claimLinks.getAddress())).to.equal(amount);
    });

    it("reverts if receiver is zero address", async function () {
      const { sender, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          ethers.ZeroAddress, await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidReceiver");
    });

    it("reverts if receiver is sender", async function () {
      const { sender, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          sender.address, await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidReceiver");
    });

    // FIX 3 coverage
    it("reverts if receiver is the contract itself", async function () {
      const { sender, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          await claimLinks.getAddress(), await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidReceiver");
    });

    // FIX 4 coverage
    it("reverts if expiry exceeds MAX_EXPIRY_DURATION", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 31n * 24n * 3600n; // 31 days
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          receiver.address, await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidExpiry");
    });

    it("reverts if expiry is in the past", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) - 1n;
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          receiver.address, await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidExpiry");
    });

    it("reverts for unsupported tokenIn", async function () {
      const { sender, receiver, claimLinks, amount } = await deployFixture();
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const other = await MockERC20.deploy("OTHER", "OTHER");
      const expiry = BigInt(await time.latest()) + 3600n;
      await other.mint(sender.address, amount);
      await other.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          receiver.address, await other.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "UnsupportedToken");
    });

    // FIX 6 coverage
    it("reverts when paused", async function () {
      const { deployer, sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await claimLinks.connect(deployer).pause();
      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(sender).createClaim(
          receiver.address, await rif.getAddress(), amount, expiry
        )
      ).to.be.revertedWithCustomError(claimLinks, "EnforcedPause");
    });
  });

  // ─── createClaimNative ──────────────────────────────────────────────────────

  describe("createClaimNative", function () {
    it("escrows RBTC and stores tokenIn as zero address", async function () {
      const { sender, receiver, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });

      expect(await ethers.provider.getBalance(await claimLinks.getAddress())).to.equal(amount);
      const c = await claimLinks.getClaim(1n);
      expect(c.tokenIn).to.equal(ethers.ZeroAddress);
      expect(c.amountIn).to.equal(amount);
    });

    // FIX 3 coverage
    it("reverts if receiver is the contract itself", async function () {
      const { sender, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await expect(
        claimLinks.connect(sender).createClaimNative(
          await claimLinks.getAddress(), expiry, { value: amount }
        )
      ).to.be.revertedWithCustomError(claimLinks, "InvalidReceiver");
    });

    // FIX 4 coverage
    it("reverts if expiry exceeds MAX_EXPIRY_DURATION", async function () {
      const { sender, receiver, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 31n * 24n * 3600n;
      await expect(
        claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount })
      ).to.be.revertedWithCustomError(claimLinks, "InvalidExpiry");
    });

    // FIX 5 coverage
    it("emits LiquidityDeposited when RBTC sent to receive()", async function () {
      const { deployer, claimLinks, amount } = await deployFixture();
      await expect(
        deployer.sendTransaction({ to: await claimLinks.getAddress(), value: amount })
      ).to.emit(claimLinks, "LiquidityDeposited").withArgs(deployer.address, amount);
    });
  });

  // ─── executeClaim ───────────────────────────────────────────────────────────

  describe("executeClaim", function () {
    it("pays RIF→USDRIF at configured rate", async function () {
      const { sender, receiver, rif, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      const expectedOut = (amount * 1_900_000_000_000_000_000n) / 10n ** 18n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await usdrif.mint(await claimLinks.getAddress(), expectedOut);

      const before = await usdrif.balanceOf(receiver.address);
      await claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress());

      expect((await usdrif.balanceOf(receiver.address)) - before).to.equal(expectedOut);
      expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_EXECUTED);
    });

    it("pays native→RIF at RBTC→RIF rate", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      const expectedOut = (amount * 50_000n * 10n ** 18n) / 10n ** 18n;

      await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });
      await rif.mint(await claimLinks.getAddress(), expectedOut);

      const before = await rif.balanceOf(receiver.address);
      await claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress());
      expect((await rif.balanceOf(receiver.address)) - before).to.equal(expectedOut);
    });

    it("pays native→USDRIF at RBTC→USDRIF rate", async function () {
      const { sender, receiver, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      const expectedOut = (amount * 95_000n * 10n ** 18n) / 10n ** 18n;

      await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });
      await usdrif.mint(await claimLinks.getAddress(), expectedOut);

      const before = await usdrif.balanceOf(receiver.address);
      await claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress());
      expect((await usdrif.balanceOf(receiver.address)) - before).to.equal(expectedOut);
    });

    it("pays RIF→native RBTC at RIF→RBTC rate", async function () {
      const { sender, receiver, rif, claimLinks } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      const bigAmount = ethers.parseEther("100000");

      await rif.connect(sender).approve(await claimLinks.getAddress(), bigAmount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), bigAmount, expiry);

      const expectedOut = (bigAmount * 20_000_000_000_000n) / 10n ** 18n;
      await sender.sendTransaction({ to: await claimLinks.getAddress(), value: expectedOut });

      const before = await ethers.provider.getBalance(receiver.address);
      await claimLinks.connect(receiver).executeClaim(1n, ethers.ZeroAddress);
      expect((await ethers.provider.getBalance(receiver.address)) > before).to.equal(true);
    });

    // FIX 2 coverage
    it("reverts on same-token swap (RIF→RIF)", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

      await expect(
        claimLinks.connect(receiver).executeClaim(1n, await rif.getAddress())
      ).to.be.revertedWithCustomError(claimLinks, "UnsupportedToken");
    });

    it("reverts on double execute", async function () {
      const { sender, receiver, rif, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      const expectedOut = (amount * 1_900_000_000_000_000_000n) / 10n ** 18n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await usdrif.mint(await claimLinks.getAddress(), expectedOut);
      await claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress());

      await expect(
        claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress())
      ).to.be.revertedWithCustomError(claimLinks, "NotOpen");
    });

    it("reverts when called by non-receiver", async function () {
      const { sender, receiver, stranger, rif, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

      await expect(
        claimLinks.connect(stranger).executeClaim(1n, await usdrif.getAddress())
      ).to.be.revertedWithCustomError(claimLinks, "NotReceiver");
    });

    it("reverts after expiry", async function () {
      const { sender, receiver, rif, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 100n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await time.increaseTo(expiry + 1n);

      await expect(
        claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress())
      ).to.be.revertedWithCustomError(claimLinks, "ClaimExpired");
    });

    it("reverts with InsufficientLiquidity if pool cannot cover payout", async function () {
      const { sender, receiver, rif, usdrif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      // deliberately do NOT fund the contract with usdrif

      await expect(
        claimLinks.connect(receiver).executeClaim(1n, await usdrif.getAddress())
      ).to.be.revertedWithCustomError(claimLinks, "InsufficientLiquidity");
    });
  });

  // ─── cancelClaim ────────────────────────────────────────────────────────────

  describe("cancelClaim", function () {
    it("refunds ERC20 to sender after expiry", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 100n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await time.increaseTo(expiry + 1n);

      const before = await rif.balanceOf(sender.address);
      await claimLinks.connect(sender).cancelClaim(1n);
      expect((await rif.balanceOf(sender.address)) - before).to.equal(amount);
      expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_CANCELLED);
    });

    it("refunds native RBTC to sender after expiry", async function () {
      const { sender, receiver, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 100n;

      await claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount });
      await time.increaseTo(expiry + 1n);

      const before = await ethers.provider.getBalance(sender.address);
      await claimLinks.connect(sender).cancelClaim(1n);
      expect((await ethers.provider.getBalance(sender.address)) > before).to.equal(true);
      expect((await claimLinks.getClaim(1n)).status).to.equal(STATUS_CANCELLED);
    });

    it("reverts on double cancel", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 100n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await time.increaseTo(expiry + 1n);
      await claimLinks.connect(sender).cancelClaim(1n);

      await expect(
        claimLinks.connect(sender).cancelClaim(1n)
      ).to.be.revertedWithCustomError(claimLinks, "NotOpen");
    });

    it("reverts if called before expiry", async function () {
      const { sender, receiver, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);

      await expect(
        claimLinks.connect(sender).cancelClaim(1n)
      ).to.be.revertedWithCustomError(claimLinks, "NotExpired");
    });

    it("reverts if called by non-sender", async function () {
      const { sender, receiver, stranger, rif, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 100n;

      await rif.connect(sender).approve(await claimLinks.getAddress(), amount);
      await claimLinks.connect(sender).createClaim(receiver.address, await rif.getAddress(), amount, expiry);
      await time.increaseTo(expiry + 1n);

      await expect(
        claimLinks.connect(stranger).cancelClaim(1n)
      ).to.be.revertedWithCustomError(claimLinks, "NotSender");
    });
  });

  // ─── sweep (FIX 1) ──────────────────────────────────────────────────────────

  describe("sweep", function () {
    it("allows owner to sweep ERC20 tokens", async function () {
      const { deployer, rif, claimLinks, amount } = await deployFixture();
      await rif.mint(await claimLinks.getAddress(), amount);

      const before = await rif.balanceOf(deployer.address);
      await claimLinks.connect(deployer).sweep(await rif.getAddress(), amount);
      expect((await rif.balanceOf(deployer.address)) - before).to.equal(amount);
    });

    it("allows owner to sweep native RBTC", async function () {
      const { deployer, sender, claimLinks, amount } = await deployFixture();
      await sender.sendTransaction({ to: await claimLinks.getAddress(), value: amount });

      const before = await ethers.provider.getBalance(deployer.address);
      await claimLinks.connect(deployer).sweep(ethers.ZeroAddress, amount);
      expect((await ethers.provider.getBalance(deployer.address)) > before).to.equal(true);
    });

    it("reverts if called by non-owner", async function () {
      const { stranger, rif, claimLinks, amount } = await deployFixture();
      await rif.mint(await claimLinks.getAddress(), amount);
      await expect(
        claimLinks.connect(stranger).sweep(await rif.getAddress(), amount)
      ).to.be.revertedWithCustomError(claimLinks, "NotOwner");
    });
  });

  // ─── pause / unpause (FIX 6) ────────────────────────────────────────────────

  describe("pause / unpause", function () {
    it("owner can pause and unpause", async function () {
      const { deployer, claimLinks } = await deployFixture();
      await claimLinks.connect(deployer).pause();
      await claimLinks.connect(deployer).unpause();
    });

    it("reverts pause if called by non-owner", async function () {
      const { stranger, claimLinks } = await deployFixture();
      await expect(
        claimLinks.connect(stranger).pause()
      ).to.be.revertedWithCustomError(claimLinks, "NotOwner");
    });

    it("createClaimNative reverts when paused", async function () {
      const { deployer, sender, receiver, claimLinks, amount } = await deployFixture();
      const expiry = BigInt(await time.latest()) + 3600n;
      await claimLinks.connect(deployer).pause();
      await expect(
        claimLinks.connect(sender).createClaimNative(receiver.address, expiry, { value: amount })
      ).to.be.revertedWithCustomError(claimLinks, "EnforcedPause");
    });
  });
});

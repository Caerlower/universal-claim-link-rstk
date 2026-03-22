// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IWRBTC {
    function deposit() external payable;
}

/// @title UniversalClaimLinks
/// @notice Production claim-link escrow on Rootstock (or any EVM chain). Each claim locks the *actual* tokens
///         received from `transferFrom` (supports fee-on-transfer tokens). The receiver claims once before
///         expiry and chooses a supported output token at hardcoded rates. The contract must hold enough
///         `tokenOut` balance to pay (operational liquidity). Escrowed `tokenIn` stays in the contract after
///         execution unless the sender cancels after expiry.
/// @dev Native RBTC (wallet “tRBTC”) uses `createClaimNative`, which wraps via WRBTC `deposit()` then escrows WRBTC.
contract UniversalClaimLinks is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 internal constant STATUS_OPEN = 0;
    uint8 internal constant STATUS_EXECUTED = 1;
    uint8 internal constant STATUS_CANCELLED = 2;

    uint256 internal constant RATE_SCALE = 1e18;

    /// @dev Example cross-rates (18-decimal tokens). amountOut = amountIn * rate / RATE_SCALE. Replace before production.
    uint256 internal constant RATE_WRBTC_TO_RIF = 50_000e18;
    uint256 internal constant RATE_WRBTC_TO_USDRIF = 95_000e18;
    /// @dev Inverse of RATE_WRBTC_TO_RIF: RATE_SCALE**2 / RATE_WRBTC_TO_RIF
    uint256 internal constant RATE_RIF_TO_WRBTC = 20_000_000_000_000;
    /// @dev Inverse of RATE_WRBTC_TO_USDRIF: RATE_SCALE**2 / RATE_WRBTC_TO_USDRIF (integer floor)
    uint256 internal constant RATE_USDRIF_TO_WRBTC = 10_526_315_789_473;
    /// @dev RIF per USDRIF implied by WRBTC legs: (WRBTC->RIF) / (WRBTC->USDRIF) in fixed point.
    uint256 internal constant RATE_RIF_TO_USDRIF = 1_900_000_000_000_000_000;
    /// @dev Inverse of RATE_RIF_TO_USDRIF
    uint256 internal constant RATE_USDRIF_TO_RIF = 526_315_789_473_684_210;

    IERC20 public immutable tokenWRBTC;
    IERC20 public immutable tokenRIF;
    IERC20 public immutable tokenUSDRIF;

    uint256 public nextClaimId;

    struct Claim {
        uint128 amountIn;
        uint40 expiry;
        uint8 status;
        address sender;
        address receiver;
        address tokenIn;
    }

    mapping(uint256 claimId => Claim) private _claims;

    event ClaimCreated(
        uint256 indexed claimId,
        address indexed sender,
        address indexed receiver,
        address tokenIn,
        uint256 amountIn,
        uint40 expiry
    );

    event ClaimExecuted(
        uint256 indexed claimId,
        address indexed receiver,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event ClaimCancelled(uint256 indexed claimId, address indexed sender, address tokenIn, uint256 amountIn);

    error ZeroAddress();
    error InvalidReceiver();
    error InvalidAmount();
    error InvalidExpiry();
    error UnsupportedToken();
    error ClaimNotFound();
    error NotReceiver();
    error NotSender();
    error NotOpen();
    error ClaimExpired();
    error NotExpired();
    error InsufficientLiquidity();

    constructor(address wrbtc, address rif, address usdrif) {
        if (wrbtc == address(0) || rif == address(0) || usdrif == address(0)) revert ZeroAddress();
        if (wrbtc == rif || wrbtc == usdrif || rif == usdrif) revert UnsupportedToken();

        tokenWRBTC = IERC20(wrbtc);
        tokenRIF = IERC20(rif);
        tokenUSDRIF = IERC20(usdrif);

        nextClaimId = 1;
    }

    function createClaim(address receiver, IERC20 tokenIn, uint128 amountIn, uint40 expiry)
        external
        nonReentrant
        returns (uint256 claimId)
    {
        if (receiver == address(0) || receiver == msg.sender) revert InvalidReceiver();
        if (amountIn == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (!_isSupported(tokenIn)) revert UnsupportedToken();

        uint256 balBefore = tokenIn.balanceOf(address(this));
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 received = tokenIn.balanceOf(address(this)) - balBefore;
        if (received == 0) revert InvalidAmount();
        if (received > type(uint128).max) revert InvalidAmount();

        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(received),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: receiver,
            tokenIn: address(tokenIn)
        });

        emit ClaimCreated(claimId, msg.sender, receiver, address(tokenIn), received, expiry);
    }

    /// @notice Create a claim using native RBTC (testnet tRBTC / mainnet RBTC). Wraps to `tokenWRBTC` via `deposit()`.
    function createClaimNative(address receiver, uint40 expiry)
        external
        payable
        nonReentrant
        returns (uint256 claimId)
    {
        if (receiver == address(0) || receiver == msg.sender) revert InvalidReceiver();
        if (msg.value == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (msg.value > type(uint128).max) revert InvalidAmount();

        uint256 balBefore = tokenWRBTC.balanceOf(address(this));
        IWRBTC(payable(address(tokenWRBTC))).deposit{value: msg.value}();
        uint256 received = tokenWRBTC.balanceOf(address(this)) - balBefore;
        if (received == 0) revert InvalidAmount();
        if (received > type(uint128).max) revert InvalidAmount();

        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(received),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: receiver,
            tokenIn: address(tokenWRBTC)
        });

        emit ClaimCreated(claimId, msg.sender, receiver, address(tokenWRBTC), received, expiry);
    }

    function executeClaim(uint256 claimId, IERC20 tokenOut) external nonReentrant {
        Claim storage c = _claims[claimId];
        if (c.sender == address(0)) revert ClaimNotFound();
        if (c.status != STATUS_OPEN) revert NotOpen();
        if (block.timestamp >= c.expiry) revert ClaimExpired();
        if (msg.sender != c.receiver) revert NotReceiver();
        if (!_isSupported(tokenOut)) revert UnsupportedToken();

        uint256 rate = _conversionRate(c.tokenIn, address(tokenOut));
        if (rate == 0) revert UnsupportedToken();

        uint256 amountOut = Math.mulDiv(uint256(c.amountIn), rate, RATE_SCALE);
        if (amountOut == 0) revert InvalidAmount();

        if (IERC20(tokenOut).balanceOf(address(this)) < amountOut) revert InsufficientLiquidity();

        c.status = STATUS_EXECUTED;

        IERC20(tokenOut).safeTransfer(c.receiver, amountOut);

        emit ClaimExecuted(claimId, c.receiver, c.tokenIn, address(tokenOut), c.amountIn, amountOut);
    }

    function cancelClaim(uint256 claimId) external nonReentrant {
        Claim storage c = _claims[claimId];
        if (c.sender == address(0)) revert ClaimNotFound();
        if (c.status != STATUS_OPEN) revert NotOpen();
        if (block.timestamp < c.expiry) revert NotExpired();
        if (msg.sender != c.sender) revert NotSender();

        c.status = STATUS_CANCELLED;

        IERC20(c.tokenIn).safeTransfer(c.sender, c.amountIn);

        emit ClaimCancelled(claimId, c.sender, c.tokenIn, c.amountIn);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _claims[claimId];
    }

    function _isSupported(IERC20 token) internal view returns (bool) {
        address t = address(token);
        return t == address(tokenWRBTC) || t == address(tokenRIF) || t == address(tokenUSDRIF);
    }

    /// @dev Fixed-point rate: amountOut = amountIn * rate / RATE_SCALE. Tune `RATE_*` constants for your market.
    function _conversionRate(address tokenIn, address tokenOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return RATE_SCALE;

        address w = address(tokenWRBTC);
        address r = address(tokenRIF);
        address u = address(tokenUSDRIF);

        if (tokenIn == w && tokenOut == r) return RATE_WRBTC_TO_RIF;
        if (tokenIn == w && tokenOut == u) return RATE_WRBTC_TO_USDRIF;
        if (tokenIn == r && tokenOut == w) return RATE_RIF_TO_WRBTC;
        if (tokenIn == u && tokenOut == w) return RATE_USDRIF_TO_WRBTC;
        if (tokenIn == r && tokenOut == u) return RATE_RIF_TO_USDRIF;
        if (tokenIn == u && tokenOut == r) return RATE_USDRIF_TO_RIF;

        return 0;
    }
}

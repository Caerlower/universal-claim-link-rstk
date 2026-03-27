// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract UniversalClaimLinks is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint8 internal constant STATUS_OPEN = 0;
    uint8 internal constant STATUS_EXECUTED = 1;
    uint8 internal constant STATUS_CANCELLED = 2;

    uint256 internal constant RATE_SCALE = 1e18;
    uint256 internal constant MAX_EXPIRY_DURATION = 30 days;
    address internal constant TOKEN_NATIVE = address(0);

    uint256 internal constant RATE_RBTC_TO_RIF = 50_000e18;
    uint256 internal constant RATE_RBTC_TO_USDRIF = 95_000e18;
    uint256 internal constant RATE_RIF_TO_RBTC = 20_000_000_000_000;
    uint256 internal constant RATE_USDRIF_TO_RBTC = 10_526_315_789_473;
    uint256 internal constant RATE_RIF_TO_USDRIF = 1_900_000_000_000_000_000;
    uint256 internal constant RATE_USDRIF_TO_RIF = 526_315_789_473_684_210;

    IERC20 public immutable tokenRIF;
    IERC20 public immutable tokenUSDRIF;
    address public owner;
    uint256 public nextClaimId;

    struct Claim {
        uint128 amountIn;
        uint40 expiry;
        uint8 status;
        address sender;
        address receiver;   // address(0) for open claims until executed
        address tokenIn;
        bytes32 secretHash; // bytes32(0) for address-locked claims
    }

    mapping(uint256 => Claim) private _claims;

    event ClaimCreated(
        uint256 indexed claimId,
        address indexed sender,
        address indexed receiver, // address(0) = open claim
        address tokenIn,
        uint256 amountIn,
        uint40 expiry,
        bool isOpen
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
    event LiquidityDeposited(address indexed sender, uint256 amount);

    error ZeroAddress();
    error InvalidReceiver();
    error InvalidAmount();
    error InvalidExpiry();
    error InvalidSecret();
    error UnsupportedToken();
    error ClaimNotFound();
    error NotReceiver();
    error NotSender();
    error NotOpen();
    error ClaimExpired();
    error NotExpired();
    error InsufficientLiquidity();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address rif, address usdrif) {
        if (rif == address(0) || usdrif == address(0)) revert ZeroAddress();
        if (rif == usdrif) revert UnsupportedToken();
        tokenRIF = IERC20(rif);
        tokenUSDRIF = IERC20(usdrif);
        nextClaimId = 1;
        owner = msg.sender;
    }

    receive() external payable {
        emit LiquidityDeposited(msg.sender, msg.value);
    }

    // Address-locked ERC20 claim
    function createClaim(address receiver, IERC20 tokenIn, uint128 amountIn, uint40 expiry)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 claimId)
    {
        if (receiver == address(0) || receiver == msg.sender || receiver == address(this)) revert InvalidReceiver();
        if (amountIn == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (expiry > block.timestamp + MAX_EXPIRY_DURATION) revert InvalidExpiry();
        if (address(tokenIn) == TOKEN_NATIVE) revert UnsupportedToken();
        if (!_isSupported(tokenIn)) revert UnsupportedToken();

        uint256 received = _pullTokens(tokenIn, amountIn);
        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(received),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: receiver,
            tokenIn: address(tokenIn),
            secretHash: bytes32(0)
        });

        emit ClaimCreated(claimId, msg.sender, receiver, address(tokenIn), received, expiry, false);
    }

    // Address-locked native claim
    function createClaimNative(address receiver, uint40 expiry)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 claimId)
    {
        if (receiver == address(0) || receiver == msg.sender || receiver == address(this)) revert InvalidReceiver();
        if (msg.value == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (expiry > block.timestamp + MAX_EXPIRY_DURATION) revert InvalidExpiry();
        if (msg.value > type(uint128).max) revert InvalidAmount();

        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(msg.value),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: receiver,
            tokenIn: TOKEN_NATIVE,
            secretHash: bytes32(0)
        });

        emit ClaimCreated(claimId, msg.sender, receiver, TOKEN_NATIVE, msg.value, expiry, false);
    }

    // Open ERC20 claim (secret-based)
    function createClaimOpen(IERC20 tokenIn, uint128 amountIn, uint40 expiry, bytes32 secretHash)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 claimId)
    {
        if (secretHash == bytes32(0)) revert InvalidSecret();
        if (amountIn == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (expiry > block.timestamp + MAX_EXPIRY_DURATION) revert InvalidExpiry();
        if (address(tokenIn) == TOKEN_NATIVE) revert UnsupportedToken();
        if (!_isSupported(tokenIn)) revert UnsupportedToken();

        uint256 received = _pullTokens(tokenIn, amountIn);
        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(received),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: address(0),
            tokenIn: address(tokenIn),
            secretHash: secretHash
        });

        emit ClaimCreated(claimId, msg.sender, address(0), address(tokenIn), received, expiry, true);
    }

    // Open native claim (secret-based)
    function createClaimNativeOpen(uint40 expiry, bytes32 secretHash)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 claimId)
    {
        if (secretHash == bytes32(0)) revert InvalidSecret();
        if (msg.value == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (expiry > block.timestamp + MAX_EXPIRY_DURATION) revert InvalidExpiry();
        if (msg.value > type(uint128).max) revert InvalidAmount();

        claimId = nextClaimId++;
        _claims[claimId] = Claim({
            amountIn: uint128(msg.value),
            expiry: expiry,
            status: STATUS_OPEN,
            sender: msg.sender,
            receiver: address(0),
            tokenIn: TOKEN_NATIVE,
            secretHash: secretHash
        });

        emit ClaimCreated(claimId, msg.sender, address(0), TOKEN_NATIVE, msg.value, expiry, true);
    }

    // Backward-compatible execute for address-locked claims (or open claims with explicit empty secret).
    function executeClaim(uint256 claimId, address tokenOut) external nonReentrant {
        _executeClaim(claimId, tokenOut, "");
    }

    // Secret-aware execute for open claims.
    function executeClaim(uint256 claimId, address tokenOut, bytes calldata secret) external nonReentrant {
        _executeClaim(claimId, tokenOut, secret);
    }

    function _executeClaim(uint256 claimId, address tokenOut, bytes memory secret) internal {
        Claim storage c = _claims[claimId];
        if (c.sender == address(0)) revert ClaimNotFound();
        if (c.status != STATUS_OPEN) revert NotOpen();
        if (block.timestamp >= c.expiry) revert ClaimExpired();

        if (c.secretHash == bytes32(0)) {
            if (msg.sender != c.receiver) revert NotReceiver();
        } else {
            if (keccak256(secret) != c.secretHash) revert InvalidSecret();
            c.receiver = msg.sender;
        }

        if (!_isSupportedTokenOut(tokenOut)) revert UnsupportedToken();
        // Same-token payouts are only blocked for ERC20 legs.
        // Native->native is safe and should be allowed.
        if (tokenOut == c.tokenIn && tokenOut != TOKEN_NATIVE) revert UnsupportedToken();

        uint256 rate = _conversionRate(c.tokenIn, tokenOut);
        if (rate == 0) revert UnsupportedToken();

        uint256 amountOut = Math.mulDiv(uint256(c.amountIn), rate, RATE_SCALE);
        if (amountOut == 0) revert InvalidAmount();

        if (tokenOut == TOKEN_NATIVE) {
            if (address(this).balance < amountOut) revert InsufficientLiquidity();
        } else {
            if (IERC20(tokenOut).balanceOf(address(this)) < amountOut) revert InsufficientLiquidity();
        }

        c.status = STATUS_EXECUTED;

        if (tokenOut == TOKEN_NATIVE) {
            Address.sendValue(payable(c.receiver), amountOut);
        } else {
            IERC20(tokenOut).safeTransfer(c.receiver, amountOut);
        }

        emit ClaimExecuted(claimId, c.receiver, c.tokenIn, tokenOut, c.amountIn, amountOut);
    }

    function cancelClaim(uint256 claimId) external nonReentrant {
        Claim storage c = _claims[claimId];
        if (c.sender == address(0)) revert ClaimNotFound();
        if (c.status != STATUS_OPEN) revert NotOpen();
        if (block.timestamp < c.expiry) revert NotExpired();
        if (msg.sender != c.sender) revert NotSender();

        c.status = STATUS_CANCELLED;

        if (c.tokenIn == TOKEN_NATIVE) {
            Address.sendValue(payable(c.sender), c.amountIn);
        } else {
            IERC20(c.tokenIn).safeTransfer(c.sender, c.amountIn);
        }

        emit ClaimCancelled(claimId, c.sender, c.tokenIn, c.amountIn);
    }

    function sweep(address token, uint256 amount) external onlyOwner {
        if (token == TOKEN_NATIVE) {
            Address.sendValue(payable(owner), amount);
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _claims[claimId];
    }

    function _pullTokens(IERC20 token, uint128 amount) internal returns (uint256 received) {
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = token.balanceOf(address(this)) - balBefore;
        if (received == 0) revert InvalidAmount();
        if (received > type(uint128).max) revert InvalidAmount();
    }

    function _isSupported(IERC20 token) internal view returns (bool) {
        address t = address(token);
        return t == address(tokenRIF) || t == address(tokenUSDRIF);
    }

    function _isSupportedTokenOut(address tokenOut) internal view returns (bool) {
        return tokenOut == TOKEN_NATIVE || tokenOut == address(tokenRIF) || tokenOut == address(tokenUSDRIF);
    }

    function _conversionRate(address tokenIn, address tokenOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return RATE_SCALE;

        address r = address(tokenRIF);
        address u = address(tokenUSDRIF);

        if (tokenIn == TOKEN_NATIVE && tokenOut == r) return RATE_RBTC_TO_RIF;
        if (tokenIn == TOKEN_NATIVE && tokenOut == u) return RATE_RBTC_TO_USDRIF;
        if (tokenIn == r && tokenOut == TOKEN_NATIVE) return RATE_RIF_TO_RBTC;
        if (tokenIn == u && tokenOut == TOKEN_NATIVE) return RATE_USDRIF_TO_RBTC;
        if (tokenIn == r && tokenOut == u) return RATE_RIF_TO_USDRIF;
        if (tokenIn == u && tokenOut == r) return RATE_USDRIF_TO_RIF;

        return 0;
    }
}

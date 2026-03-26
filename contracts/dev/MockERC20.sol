// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice **Development only** — mintable ERC20 for Hardhat tests (`test/*.js`) and local Ignition deploys.
///         Production deployments use real Rootstock tokens with `UniversalClaimLinks`; do not rely on this contract on mainnet.
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev WETH-style wrap — useful for local experiments; native escrow uses `createClaimNative` without WRBTC.
    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}

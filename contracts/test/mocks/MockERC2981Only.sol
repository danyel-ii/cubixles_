// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract MockERC2981Only is ERC2981 {
    constructor(address receiver_, uint96 bps_) {
        _setDefaultRoyalty(receiver_, bps_);
    }
}

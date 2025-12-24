// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721Standard is ERC721 {
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _mint(to, tokenId);
    }
}

contract MockERC721RevertingOwnerOf is ERC721 {
    constructor() ERC721("RevertNFT", "RVRT") {}

    function ownerOf(uint256) public pure override returns (address) {
        revert("ownerOf reverted");
    }
}

contract MockERC721ReturnsWrongOwner is ERC721 {
    address private immutable _wrongOwner;

    constructor(address wrongOwner_) ERC721("WrongOwnerNFT", "WRNG") {
        _wrongOwner = wrongOwner_;
    }

    function ownerOf(uint256) public view override returns (address) {
        return _wrongOwner;
    }
}
